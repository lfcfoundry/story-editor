/* ============================================================================
   WASM-EQUIV: the checker's WebAssembly walk and graph passes (checkwalk.js) must give exactly the answers of the JavaScript code in core.js.
   For many random stories (items, states, numbers, dice checks, Givens, hand-overs, locked choices), at several limits and with and
   without forgetting dead numbers, analyze() is run three ways (the walk and the graph passes in WebAssembly, only the graph passes, only JavaScript), and everything
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
/* mode: 'both' (walk and graph passes in WebAssembly), 'graph' (only the graph passes), 'none' (JavaScript only) */
function load(mode) {
  const withWasm = mode !== 'none';
  const ctx = createContext({ console, TextDecoder, TextEncoder, atob: s => Buffer.from(s, 'base64').toString('latin1') });
  runInContext(`${src('core.js')}\n${withWasm ? src('checkwalk.js') : ''}\nthis.__o = { normalizeProject, analyze };`, ctx);
  const o = ctx.__o;
  if (withWasm) {
    ctx.walkUsed = 0;
    ctx.graphUsed = 0;
    ctx.graphFailed = 0;
    ctx.graphJobs = 0;
    ctx.graphFull = 0;
    runInContext(
      `klWalkWasm = (function (f) { return function (a) { ${mode === 'graph' ? 'return null;' : 'const r = f(a); if (r) walkUsed++; return r;'} }; })(klWalkWasm);` +
        `klGraphWasm = (function (f) { return function (e, n) { const r = f(e, n); if (!r) return r; graphUsed++; const w = g => x => { const v = g(x); if (v === null) graphFailed++; return v; }; return { canReach: w(r.canReach), firstCuts: j => { graphJobs += j.length; if (j.length === 32) graphFull++; return w(r.firstCuts)(j); } }; }; })(klGraphWasm);`,
      ctx
    );
  }
  return { ...o, used: () => ctx.walkUsed || 0, graphUsed: () => ctx.graphUsed || 0, graphFailed: () => ctx.graphFailed || 0, jobs: () => ctx.graphJobs || 0, full: () => ctx.graphFull || 0 };
}
const W = load('both'), G = load('graph'), J = load('none');
const N = +process.argv[2] || 300, SEED = +process.argv[3] || 1;

/* a longer story with numbers, dice and items, like a real one (the same shape the speed tests use) */
let seed = 7;
const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function longStory(norm, n, nObj, nStat, extra, gate) {
  const items = [];
  for (let i = 0; i < nObj; i++) items.push({ id: 'o' + i, name: 'O' + i, kind: i % 3 === 2 ? 'state' : 'object', show: true });
  for (let i = 0; i < nStat; i++) items.push({ id: 't' + i, name: 'T' + i, kind: 'stat', show: true, lo: 0, hi: 5, start: 2 });
  const passages = [];
  for (let i = 0; i < n; i++) passages.push({ id: 'p' + i, name: 'Page ' + i, blocks: [{ text: 'x', needs: [], forbid: [], orPrev: false }, { text: 'y', needs: nObj && rnd() < 0.4 ? ['o' + int(0, nObj - 1)] : [], forbid: [], orPrev: rnd() < 0.3 }], gives: [], takes: [], choices: [], ending: i > n - 4 });
  passages.forEach((p, i) => {
    if (nObj && rnd() < (gate ? 0.6 : 0.25)) p.gives = ['o' + int(0, nObj - 1)];
    if (nObj && rnd() < (gate ? 0.03 : 0.1)) p.takes = ['o' + int(0, nObj - 1)];
    if (p.ending) return;
    for (let k = int(1, extra ? 4 : 3); k > 0; k--) {
      const c = { label: rnd() < 0.15 ? 'same' : 'c' + k + p.id, to: rnd() < 0.05 ? '' : 'p' + (rnd() < 0.8 ? Math.min(n - 1, i + int(1, 8)) : int(0, n - 1)), needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: rnd() < 0.2, why: '' };
      if (nObj && rnd() < (gate ? 0.35 : 0.15)) c.needs = ['o' + int(0, nObj - 1)];
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
let checked = 0, fails = 0, withTrap = 0, withCut = 0, turn = 0;
function same(label, project, limit, opt) {
  const pids = project.passages.map(p => p.id);
  const run = X => X.analyze(X.normalizeProject(JSON.parse(JSON.stringify(project))), limit, opt);
  const rj = run(J), b = clean(rj, pids);
  if (/never reach an ending/.test(b)) withTrap++;
  if (/miss this choice for good/.test(b)) withCut++;
  /* the graph-only run (a JavaScript walk, so slow) takes every fourth comparison */
  for (const [name, X] of turn++ % 4 === 0 ? [['wasm', W], ['graph', G]] : [['wasm', W]]) {
    const a = clean(run(X), pids);
    checked++;
    if (a !== b) {
      fails++;
      if (fails <= 3) {
        let i = 0; while (a[i] === b[i]) i++;
        console.log(`FAIL ${label} limit ${limit} ${JSON.stringify(opt || {})} (${name}): first difference at ${i}\n  ${name}: ${a.slice(Math.max(0, i - 80), i + 120)}\n  js:   ${b.slice(Math.max(0, i - 80), i + 120)}`);
      }
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
/* many gated choices, so that a check asks more than 32 way-back questions (a full batch, and several) */
for (let n = 0; n < Math.max(10, N / 6); n++) {
  const st = longStory(J.normalizeProject, int(40, 90), int(5, 8), int(0, 1), 0, true);
  same('gated' + n, st, 200000);
}
console.log(`${checked} comparisons, ${fails} differences; the WebAssembly walk answered ${W.used()} and the graph passes ${W.graphUsed() + G.graphUsed()}; ${withTrap} stories report a trap and ${withCut} a missed choice; ${W.jobs() + G.jobs()} way-back questions, ${W.full() + G.full()} batches of a full 32`);
if (!W.used() || !G.graphUsed()) { console.log('FAIL the WebAssembly walk or graph passes were never used (are the modules usable here?)'); process.exit(1); }
if (W.graphFailed() + G.graphFailed()) { console.log('FAIL the WebAssembly graph passes failed halfway ' + (W.graphFailed() + G.graphFailed()) + ' times (the JavaScript fallback hid it)'); process.exit(1); }
process.exit(fails ? 1 : 0);
