/* ============================================================================
   PRUNE-HINT-EQUIV: analyze() tries the pruned check first when the last check needed it (klPruneHint). The answer must be exactly the one
   the plain-first order gives, whichever way the hint points: random stories with numbers, small ones (under PRUNE_AFTER situations) and big
   ones, are checked both ways and every problem, warning, note, ending, count and flag is compared.
   Usage: node prune-hint-equiv.mjs     Exit code 1 on the first difference.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const ctx = createContext({ console });
runInContext(`${readFileSync(new URL('core.js', import.meta.url), 'utf8')}\nthis.X = { normalizeProject, analyze, analyzeRun, PRUNE_AFTER, setHint: v => { klPruneHint = v; } };`, ctx);
const X = ctx.X;

let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed / 0x7fffffff);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function story(N, nObj, nStat) {
  seed = 7 + N;
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
      if (rnd() < 0.2) c.adds['t' + int(0, nStat - 1)] = int(-1, 2);
      if (rnd() < 0.2) c.check = { stat: 't' + int(0, nStat - 1), target: int(2, 9), fail: 'p' + int(0, N - 1) };
      p.choices.push(c);
    }
  });
  return X.normalizeProject({ id: 's', title: 't', start: 'p0', items, givens: [], passages, game: {} });
}
const sum = r => JSON.stringify({ p: r.problems, w: r.warnings, n: r.notes, e: r.endings, s: r.states, g: r.grouped, pr: r.pruned, t: r.truncated });
let n = 0,
  big = 0;
for (const [N, o, s] of [[30, 3, 1], [50, 4, 1], [60, 4, 2], [80, 5, 2], [100, 6, 2], [40, 6, 3], [120, 4, 2], [150, 3, 3]])
  for (let k = 0; k < 6; k++) {
    const p = story(N + k, o, s);
    const first = X.analyzeRun(p, X.PRUNE_AFTER, false);
    const ref = first.truncated ? X.analyzeRun(p, 200000, true) : first;
    if (first.truncated) big++;
    for (const h of [false, true]) {
      X.setHint(h);
      n++;
      if (sum(X.analyze(p)) !== sum(ref)) {
        console.log(`FAIL: ${N + k} pages, ${o} objects, ${s} numbers, hint ${h}: the answer differs from the plain-first order`);
        process.exit(1);
      }
    }
  }
console.log(`prune-hint-equiv: ${n} checks of ${n / 2} stories (${big} over PRUNE_AFTER), both hint states, 0 differences`);
