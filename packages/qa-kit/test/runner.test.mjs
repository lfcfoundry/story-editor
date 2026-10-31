/* Exercises src/runner.js on a tiny fake project: one passing suite, one that fails the first time and passes on the retry
   (flaky), and one that always fails. Checks the printed lines, the summary, the exit code, the retry log, and what "smart" does.
   Copyright (c) 2026 LFC Foundry. MIT License. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, existsSync, readFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUNNER = new URL('../src/runner.js', import.meta.url).pathname;

/** A fake project in a temp folder. Suites are node scripts: they print PASS lines and are handed the engine name. */
function fake() {
  const dir = mkdtempSync(join(tmpdir(), 'qa-kit-test-'));
  writeFileSync(join(dir, 'src.txt'), 'v1');
  writeFileSync(join(dir, 'good.js'), "console.log('PASS first check on ' + process.argv[2]); console.log('PASS second check');\n");
  writeFileSync(join(dir, 'flaky.js'), `const fs = require('fs'); const m = __dirname + '/flaky.marker';
if (!fs.existsSync(m)) { fs.writeFileSync(m, '1'); console.log('FAIL not yet'); process.exit(1); }
console.log('PASS passes on the second try');\n`);
  writeFileSync(join(dir, 'bad.js'), "console.log('PASS before the failure'); console.log('FAIL always'); process.exit(1);\n");
  const config = suites => `module.exports = { root: '.', sources: ['src.txt'], engines: ['one'],
    suites: ${JSON.stringify(suites)},
    extra: [{ name: 'extra-cmd', cmd: [process.execPath, '-e', "console.log('PASS from an extra command')"], watch: [], quick: true }] };`;
  const write = suites => writeFileSync(join(dir, 'qa.config.cjs'), config(suites));
  const run = (...args) => spawnSync(process.execPath, [RUNNER, join(dir, 'qa.config.cjs'), ...args], { cwd: dir, encoding: 'utf8' });
  return { dir, write, run, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const S = (name, file, quick = true) => ({ name, file, watch: ['src.txt'], quick, engines: ['one'] });

test('pass, pass* (flaky) and FAIL are told apart, and the exit code is 1', () => {
  const f = fake();
  f.write([S('good', 'good.js'), S('flaky', 'flaky.js'), S('bad', 'bad.js')]);
  const r = f.run('quick');
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /^pass\s+[\d.]+ s\s+good one$/m);
  assert.match(r.stdout, /^pass\*\s+[\d.]+ s\s+flaky one$/m);
  assert.match(r.stdout, /^FAIL\s+[\d.]+ s\s+bad one$/m);
  assert.match(r.stdout, /FAIL always/);
  assert.match(r.stdout, /quick: 5 suites, 3 pass, 1 pass\* \(flaky\), 1 FAIL, \d+ s in all\. Slowest: /);
  assert.ok(existsSync(join(f.dir, 'logs', 'good-one.log')), 'every suite has a log');
  assert.ok(existsSync(join(f.dir, 'logs', 'flaky-one.first-try.log')), 'the failed first try of a flaky suite is kept');
  assert.match(readFileSync(join(f.dir, 'logs', 'bad-one.log'), 'utf8'), /FAIL always/);
  f.done();
});

test('all green: exit code 0, --only filters, and a quick run writes no stamp', () => {
  const f = fake();
  f.write([S('good', 'good.js'), S('flaky', 'flaky.js')]);
  const r = f.run('quick');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /quick: 4 suites, 3 pass, 1 pass\* \(flaky\), 0 FAIL/);
  assert.ok(!existsSync(join(f.dir, '.stamp')));
  const only = f.run('quick', '--only', 'good');
  assert.equal(only.status, 0);
  assert.match(only.stdout, /quick: 1 suites, 1 pass, 0 pass\*/);
  f.done();
});

test('smart re-runs a non-quick suite only when a watched source changed since the last green run', () => {
  const f = fake();
  f.write([S('good', 'good.js'), S('slow', 'good.js', false)]);
  const first = f.run('smart');
  assert.match(first.stdout, /changed since the last all-green run: src\.txt/);
  assert.match(first.stdout, /slow one/);
  assert.ok(existsSync(join(f.dir, '.stamp')), 'a green smart run leaves a stamp');
  const second = f.run('smart');
  assert.match(second.stdout, /changed since the last all-green run: nothing/);
  assert.doesNotMatch(second.stdout, /slow one/);
  const later = new Date(Date.now() + 5000);
  utimesSync(join(f.dir, 'src.txt'), later, later);
  assert.match(f.run('smart').stdout, /slow one/, 'a newer source brings the suite back');
  f.done();
});

test('a suite that prints fewer PASS lines than the last green full run fails ("lost checks")', () => {
  const f = fake();
  f.write([S('good', 'good.js')]);
  assert.equal(f.run('full').status, 0);
  const counts = JSON.parse(readFileSync(join(f.dir, 'counts.json'), 'utf8'));
  assert.equal(counts['good one'], 2);
  writeFileSync(join(f.dir, 'good.js'), "console.log('PASS only one');\n");
  const r = f.run('full');
  assert.equal(r.status, 1);
  assert.match(r.stdout, /only 1 checks ran; the last all-green run had 2/);
  assert.equal(f.run('full', '--reset-counts').status, 0);
  f.done();
});

test('--help prints usage and exits 0; a missing config exits 2', () => {
  const h = spawnSync(process.execPath, [RUNNER, '--help'], { encoding: 'utf8' });
  assert.equal(h.status, 0);
  assert.match(h.stdout, /quick\|smart\|full/);
  const m = spawnSync(process.execPath, [RUNNER, join(tmpdir(), 'no-such-config.cjs'), 'quick'], { encoding: 'utf8' });
  assert.equal(m.status, 2);
});

test('the pool takes the longest suite first on the next run, by the times saved after a green run', () => {
  const f = fake();
  writeFileSync(join(f.dir, 'slow.js'), "setTimeout(() => console.log('PASS slow one done'), 1300);\n");
  f.write([S('quickone', 'good.js'), S('slowone', 'slow.js')]);
  const env = { ...process.env, QA_JOBS: '1' }; // one worker, so the printed order is the order the suites ran in
  const run = () => spawnSync(process.execPath, [RUNNER, join(f.dir, 'qa.config.cjs'), 'quick'], { cwd: f.dir, encoding: 'utf8', env });
  const order = out => out.split('\n').filter(l => /^pass\s/.test(l) && /one one$/.test(l)).map(l => l.trim().split(/\s+/).slice(-2)[0]);
  const first = run();
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.deepEqual(order(first.stdout), ['quickone', 'slowone'], 'with no saved times the listed order is kept');
  const times = JSON.parse(readFileSync(join(f.dir, 'times.json'), 'utf8'));
  assert.ok(times['slowone one'] > times['quickone one'], 'a green run saves how long each suite took: ' + JSON.stringify(times));
  const second = run();
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.deepEqual(order(second.stdout), ['slowone', 'quickone'], 'the slow suite listed last starts first');
  f.done();
});

test('a committed times-seed.json orders a fresh checkout that has no times.json yet', () => {
  const f = fake();
  writeFileSync(join(f.dir, 'slow.js'), "setTimeout(() => console.log('PASS slow one done'), 300);\n");
  f.write([S('quickone', 'good.js'), S('slowone', 'slow.js')]);
  writeFileSync(join(f.dir, 'times-seed.json'), JSON.stringify({ 'slowone one': 9, 'quickone one': 1 }));
  const r = spawnSync(process.execPath, [RUNNER, join(f.dir, 'qa.config.cjs'), 'quick'], { cwd: f.dir, encoding: 'utf8', env: { ...process.env, QA_JOBS: '1' } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const order = r.stdout.split('\n').filter(l => /^pass\s/.test(l) && /one one$/.test(l)).map(l => l.trim().split(/\s+/).slice(-2)[0]);
  assert.deepEqual(order, ['slowone', 'quickone']);
  f.done();
});
