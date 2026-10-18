/* ============================================================================
   WASM-EQUIV: the checker's WebAssembly walk (checkwalk.js) must give exactly the answers of the JavaScript loop in core.js.
   For many random stories (items, states, numbers, dice checks, Givens, hand-overs, locked choices), at several limits and with and
   without forgetting dead numbers, analyze() is run twice, once with the walk in WebAssembly and once with the JavaScript loop, and everything
   it returns is compared: problems, warnings, notes, endings with their shortest ways, counts, and the explanations for every page.
   Stories this walk does not take (more than 30 tracked bits) are checked too: they must come out the same because both runs use JavaScript.
   Usage: node wasm-equiv.mjs [stories=300] [seed=1]     Exit code 1 and the first difference on any failure.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { makeGenStory } from '../packages/qa-kit/src/genstory.mjs';

const here = new URL('.', import.meta.url);
const src = f => readFileSync(new URL(f, here), 'utf8');
function load(withWasm) {
  const ctx = createContext({ console, TextDecoder, TextEncoder, atob: s => Buffer.from(s, 'base64').toString('latin1') });
  runInContext(`${src('core.js')}\n${withWasm ? src('checkwalk.js') : ''}\nthis.__o = { normalizeProject, analyze, ${withWasm ? 'klWalkWasm' : ''} };`, ctx);
  const o = ctx.__o;
  let used = 0;
  if (withWasm) {
    runInContext('klWalkWasm = (function (f) { return function (a) { const r = f(a); if (r) this_used++; return r; }; })(klWalkWasm);', Object.assign(ctx, { this_used: 0 }));
  }
  return { ...o, used: () => ctx.this_used || 0 };
}
const W = load(true), J = load(false);
const N = +process.argv[2] || 300, SEED = +process.argv[3] || 1;

/* a longer story with numbers, dice and items, like a real one (the same shape the speed tests use) */
let seed = 7;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function longStory(norm, n, nObj, nStat, extra) {
  const items = [];
  for (let i = 0; i < nObj; i++) items.push({ id: 'o' + i, name: 'O' + i, kind: i % 3 === 2 ? 'state' : 'object', show: true });
  for (let i = 0; i < nStat; i++) items.push({ id: 't' + i, name: 'T' + i, kind: 'stat', show: true, lo: 0, hi: 5, start: 2 });
  const passages = [];
  for (let i = 0; i < n; i++) passages.push({ id: 'p' + i, name: 'Page ' + i, blocks: [{ text: 'x', needs: [], forbid: [], orPrev: false }, { text: 'y', needs: nObj && rnd() < 0.4 ? ['o' + int(0, nObj - 1)] : [], forbid: [], orPrev: rnd() < 0.3 }], gives: [], takes: [], choices: [], ending: i > n - 4 });
  passages.forEach((p, i) => {
    if (nObj && rnd() < 0.25) p.gives = ['o' + int(0, nObj - 1)];
    if (nObj && rnd() < 0.1) p.takes = ['o' + int(0, nObj - 1)];
    if (p.ending) return;
    for (let k = int(1, extra ? 4 : 3); k > 0; k--) {
      const c = { label: rnd() < 0.15 ? 'same' : 'c' + k + p.id, to: rnd() < 0.05 ? '' : 'p' + (rnd() < 0.8 ? Math.min(n - 1, i + int(1, 8)) : int(0, n - 1)), needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: rnd() < 0.2, why: '' };
      if (nObj && rnd() < 0.15) c.needs = ['o' + int(0, nObj - 1)];
      if (nObj && rnd() < 0.08) c.forbid = ['o' + int(0, nObj - 1)];
      if (nObj && rnd() < 0.1) c.gives = ['o' + int(0, nObj - 1)];
      if (nObj && rnd() < 0.08) c.takes = ['o' + int(0, nObj - 1)];
      if (nStat && rnd() < 0.2) c.adds['t' + int(0, nStat - 1)] = int(-2, 2);
      if (nStat && rnd() < 0.2) c.check = { stat: 't' + int(0, nStat - 1), target: int(2, 14), fail: 'p' + int(0, n - 1) };
      if (nStat && rnd() < 0.1) c.needs.push('n:t' + int(0, nStat - 1) + ':' + int(1, 5));
      p.choices.push(c);
    }
  });
  return norm({ id: 's', title: 't', start: 'p0', items, givens: rnd() < 0.3 && nObj > 1 ? [{ question: 'q', options: ['o0', 'o1'] }] : [], passages, game: {} });
}

const gen = makeGenStory(J.normalizeProject);
const clean = (r, pids) => {
  const o = { problems: r.problems, warnings: r.warnings, notes: r.notes, endings: r.endings, states: r.states, grouped: r.grouped, pruned: r.pruned, truncated: r.truncated, samples: r.samples };
  o.explain = pids.map(pid => { try { return r.explain(pid); } catch (e) { return 'ERR ' + e.message; } });
  o.why = pids.map(pid => { try { return r.why(pid); } catch (e) { return 'ERR ' + e.message; } });
  return JSON.stringify(o);
};
let checked = 0, fails = 0;
function same(label, project, limit, opt) {
  const pw = JSON.parse(JSON.stringify(project)), pj = JSON.parse(JSON.stringify(project));
  const rw = W.analyze(W.normalizeProject(pw), limit, opt), rj = J.analyze(J.normalizeProject(pj), limit, opt);
  const pids = project.passages.map(p => p.id);
  const a = clean(rw, pids), b = clean(rj, pids);
  checked++;
  if (a !== b) {
    fails++;
    if (fails <= 3) {
      let i = 0; while (a[i] === b[i]) i++;
      console.log(`FAIL ${label} limit ${limit} ${JSON.stringify(opt || {})}: first difference at ${i}\n  wasm: ${a.slice(Math.max(0, i - 80), i + 120)}\n  js:   ${b.slice(Math.max(0, i - 80), i + 120)}`);
    }
  }
}
for (let n = 0; n < N; n++) {
  const s = gen(SEED * 100000 + n, n % 5 === 0 ? { huge: true } : n % 7 === 0 ? { wide: true } : {});
  same('gen' + n, s, 200000);
  if (n % 3 === 0) same('gen' + n, s, 40);
  if (n % 4 === 0) same('gen' + n, s, 200000, { prune: n % 8 === 0 });
}
for (let n = 0; n < Math.max(20, N / 5); n++) {
  const st = longStory(J.normalizeProject, int(10, 80), int(0, 7), int(0, 3), n % 2);
  same('long' + n, st, 200000);
  same('long' + n, st, 3000);
  same('long' + n, st, 200000, { prune: true });
}
const stats = W.used();
console.log(`${checked} comparisons, ${fails} differences; the WebAssembly walk answered ${stats} of them`);
if (!stats) { console.log('FAIL the WebAssembly walk was never used (is the module usable here?)'); process.exit(1); }
process.exit(fails ? 1 : 0);
