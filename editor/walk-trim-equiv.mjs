/* ============================================================================
   WALK-TRIM-EQUIV: checker memory left large by a big story is let go when small stories follow (checkwalk.js klWalkTrim, klGraphTrim) or
   when the worker takes over (klCheckRelease). Random stories of mixed sizes, in a mixed order, are checked with the trims, and again in a
   fresh checker that never trims, and every problem, warning, note, ending, count and flag must be the same. The test also counts that the
   trims really ran, and that a small story after big ones holds no more than a fresh checker takes for it (or 4 MB).
   Usage: node walk-trim-equiv.mjs     Exit code 1 on the first difference.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const src = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const load = trim => {
  const ctx = createContext({ console, TextDecoder, TextEncoder, atob: s => Buffer.from(s, 'base64').toString('latin1') });
  runInContext(
    `${src('core.js')}\n${src('checkwalk.js')}\n` +
      `var trims = 0;` +
      (trim
        ? `klWalkTrim = (function (f) { return function (w, need) { const m = klWalkMods[w]; const r = f(w, need); if (r !== m) trims++; return r; }; })(klWalkTrim);` +
          `klGraphTrim = (function (f) { return function (M, need) { const r = f(M, need); if (r !== M) trims++; return r; }; })(klGraphTrim);`
        : `klWalkTrim = w => klWalkMods[w]; klGraphTrim = M => M; klCheckRelease = () => {};`) +
      `this.X = { normalizeProject, analyze, release: () => klCheckRelease(), trims: () => trims, mem: () => klWalkMods.map(m => (m ? m.mem.buffer.byteLength : 0)).concat(klGraphMod ? klGraphMod.mem.buffer.byteLength : 0) };`,
    ctx
  );
  return ctx.X;
};
const X = load(true),
  R = load(false);
let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed / 0x7fffffff);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function story(N, nObj, nStat, sd) {
  seed = sd;
  const items = [];
  for (let i = 0; i < nObj; i++) items.push({ id: 'o' + i, name: 'O' + i, kind: 'object', show: true });
  for (let i = 0; i < nStat; i++) items.push({ id: 't' + i, name: 'T' + i, kind: 'stat', show: true, lo: 0, hi: 5, start: 2 });
  const passages = [];
  for (let i = 0; i < N; i++) passages.push({ id: 'p' + i, name: 'Page ' + i, blocks: [{ text: 'x', needs: [], forbid: [], orPrev: false }], gives: [], takes: [], choices: [], ending: i > N - 3 });
  passages.forEach((p, i) => {
    if (nObj && rnd() < 0.25) p.gives = ['o' + int(0, nObj - 1)];
    if (p.ending) return;
    for (let k = int(2, 3); k > 0; k--) {
      const c = { label: 'c' + k, to: 'p' + (rnd() < 0.8 ? Math.min(N - 1, i + int(1, 8)) : int(0, N - 1)), needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: false, why: '' };
      if (nObj && rnd() < 0.15) c.needs = ['o' + int(0, nObj - 1)];
      if (nStat && rnd() < 0.2) c.adds['t' + int(0, nStat - 1)] = int(-1, 2);
      if (nStat && rnd() < 0.2) c.check = { stat: 't' + int(0, nStat - 1), target: int(2, 9), fail: 'p' + int(0, N - 1) };
      p.choices.push(c);
    }
  });
  return X.normalizeProject({ id: 's', title: 't', start: 'p0', items, givens: [], passages, game: {} });
}
const sum = r => JSON.stringify({ p: r.problems, w: r.warnings, n: r.notes, e: r.endings, s: r.states, g: r.grouped, pr: r.pruned, t: r.truncated });
const plan = [[12, 2, 0], [100, 6, 2], [20, 3, 1], [60, 4, 2], [80, 6, 2], [25, 2, 1], [150, 8, 3], [30, 3, 0], [120, 5, 2], [12, 1, 0], [100, 7, 2], [40, 3, 1]];
let n = 0,
  held = 0,
  small = 0;
for (let round = 0; round < 3; round++)
  for (const [N, o, s] of plan) {
    const p = story(N + round, o, s, 7 + N * 3 + round);
    for (let k = 0; k < 3; k++) {
      // three checks in a row, as while typing
      const r = X.analyze(p),
        ref = R.analyze(p);
      n++;
      if (sum(r) !== sum(ref)) {
        console.log(`FAIL: ${N + round} pages, ${o} objects, ${s} numbers, check ${k + 1}: the answer differs from a checker that never lets memory go`);
        process.exit(1);
      }
    }
    if (round === 1 && N > 100) X.release(); // as when the worker answers
    if (N <= 30) {
      // a small story after big ones: no more memory than a fresh checker takes for it, within a tenth (growth comes in 64 KB steps), or the 4 MB below which nothing is let go)
      small++;
      const F = load(false);
      F.analyze(p);
      const fresh = F.mem();
      if (X.mem().every((b, i) => b <= Math.max(4 << 20, fresh[i] * 1.1))) held++;
    }
  }
if (!X.trims() || held < small) {
  console.log(`FAIL: memory not let go (${X.trims()} trims; small stories held no more than a fresh checker ${held} of ${small} times)`);
  process.exit(1);
}
console.log(`walk-trim-equiv: ${n} checks of ${plan.length * 3} stories, 0 differences; ${X.trims()} memories let go; every small story after big ones held no more than a fresh checker`);
