/* ============================================================================
   CHECK-WORKER-EQUIV: after an edit a big story is checked in a background worker (checkworker.js). The worker's code is the text of the
   same functions the page uses, so this proves two things for many random stories (items, states, numbers, dice checks, Givens, the
   large and wide shapes the wasm check uses):
     1. the text is complete: it runs in an empty context with only a clock, a way to answer and WebAssembly, and
     2. what it sends back (problems, warnings, notes, endings with their ways, counts, grouped, pruned, truncated) is exactly what
        analyze() gives on the page, and it can travel (structuredClone works on it).
   Usage: node check-worker-equiv.mjs [stories=120] [seed=3] [--prune]     --prune lists which names the worker text could do without.
   Exit code 1 and the first difference on any failure.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { makeGenStory } from '../packages/qa-kit/src/genstory.mjs';

const here = new URL('.', import.meta.url);
const src = f => readFileSync(new URL(f, here), 'utf8');
const atob = s => Buffer.from(s, 'base64').toString('latin1');
const main = createContext({ console, TextDecoder, TextEncoder, atob, performance });
runInContext(`${src('core.js')}\n${src('checkwalk.js')}\n${src('checkworker.js')}\nthis.__o = { normalizeProject, analyze, checkWorkerSource };`, main);
const { normalizeProject, analyze, checkWorkerSource } = main.__o;
let pageWasm = 0; // WebAssembly answers the page's own check gave, to compare with the worker's (a name missing in the worker quietly drops to JavaScript)
for (const name of ['klWalkWasm', 'klGraphWasm']) {
  const f = main[name];
  main[name] = (...a) => {
    const r = f(...a);
    if (r) pageWasm++;
    return r;
  };
}
const N = +process.argv[2] || 120, SEED = +process.argv[3] || 3;

let wasmMade = 0,
  wasmUsed = 0;
function runWorker(text, source) {
  const answers = [];
  const W = {
    performance,
    atob,
    TextDecoder,
    postMessage: m => answers.push(m),
    WebAssembly: new Proxy(WebAssembly, { get: (t, k) => (k === 'Instance' ? class extends WebAssembly.Instance { constructor(...a) { super(...a); wasmMade++; } } : t[k]) })
  };
  const ctx = createContext(W);
  runInContext(source, ctx);
  if (typeof ctx.onmessage !== 'function') throw new Error('the worker text does not set up onmessage');
  /* count the answers the WebAssembly walk and graph passes really gave (a missing piece would quietly fall back to JavaScript) */
  for (const name of ['klWalkWasm', 'klGraphWasm']) {
    const f = ctx[name];
    if (typeof f === 'function')
      ctx[name] = (...a) => {
        const r = f(...a);
        if (r) wasmUsed++;
        return r;
      };
  }
  ctx.onmessage({ data: { seq: 1, text } });
  return answers[0];
}
const pick = A => ({ problems: A.problems, warnings: A.warnings, notes: A.notes, endings: A.endings, states: A.states, grouped: A.grouped, pruned: A.pruned, truncated: A.truncated });

const gen = makeGenStory(normalizeProject);
const stories = [];
for (let n = 0; n < N; n++) stories.push(gen(SEED * 100000 + n, n % 5 === 0 ? { huge: true } : n % 7 === 0 ? { wide: true } : {}));
const keeper = JSON.parse(src('keepers-light.project.json'));
stories.push(normalizeProject(keeper.project || keeper));

function allSame(source, quiet) {
  let fails = 0;
  for (let i = 0; i < stories.length; i++) {
    const s = stories[i];
    const p0 = pageWasm;
    const want = JSON.stringify(pick(analyze(normalizeProject(JSON.parse(JSON.stringify(s))))));
    const pageUsed = pageWasm - p0;
    let got;
    try {
      const w0 = wasmUsed;
      const a = runWorker(JSON.stringify(s), source);
      if (wasmUsed - w0 !== pageUsed) throw new Error(`the worker used WebAssembly ${wasmUsed - w0} times, the page ${pageUsed}`);
      if (a.error) throw new Error(a.error);
      structuredClone(a.r);
      got = JSON.stringify(a.r);
    } catch (e) {
      got = 'ERR ' + e.message;
    }
    if (got !== want) {
      fails++;
      if (!quiet && fails <= 3) {
        let k = 0;
        while (got[k] === want[k]) k++;
        console.log(`FAIL story ${i}: first difference at ${k}\n  worker: ${got.slice(Math.max(0, k - 80), k + 120)}\n  page:   ${want.slice(Math.max(0, k - 80), k + 120)}`);
      }
      if (quiet) return fails;
    }
  }
  return fails;
}

if (process.argv.includes('--prune')) {
  wasmUsed = 0;
  allSame(checkWorkerSource(), true);
  const baseWasm = wasmUsed; // a name is only "not needed" if the answer and the use of WebAssembly stay the same
  const lists = ['CHECK_WORKER_FUNCS', 'CHECK_WORKER_DATA', 'CHECK_WORKER_ARROWS'];
  for (const L of lists) {
    const isArr = L === 'CHECK_WORKER_FUNCS';
    const keys = isArr ? runInContext(`${L}.map(f=>f.name)`, main) : Object.keys(runInContext(L, main));
    for (const k of keys) {
      const saved = isArr ? runInContext(`CHECK_WORKER_FUNCS.find(f=>f.name==='${k}')`, main) : runInContext(`${L}['${k}']`, main);
      if (isArr) runInContext(`CHECK_WORKER_FUNCS.splice(CHECK_WORKER_FUNCS.findIndex(f=>f.name==='${k}'),1)`, main);
      else runInContext(`delete ${L}['${k}']`, main);
      wasmUsed = 0;
      const f = allSame(checkWorkerSource(), true) || (wasmUsed === baseWasm ? 0 : 1);
      if (f) {
        // needed: put it back
        main.__saved = saved;
        if (isArr) runInContext('CHECK_WORKER_FUNCS.push(__saved)', main);
        else runInContext(`${L}['${k}']=__saved`, main);
      } else console.log('NOT NEEDED', k);
    }
  }
  console.log('kept funcs:', runInContext('CHECK_WORKER_FUNCS.map(f=>f.name).join(" ")', main));
  console.log('kept data:', Object.keys(runInContext('CHECK_WORKER_DATA', main)).join(' '), '| arrows:', Object.keys(runInContext('CHECK_WORKER_ARROWS', main)).join(' '));
  process.exit(0);
}

const fails = allSame(checkWorkerSource());
const wide = stories.filter(s => s.items.length).length;
if (!wasmUsed) {
  console.log('FAIL the worker never got an answer from WebAssembly');
  process.exit(1);
}
if (fails) {
  console.log(`check-worker-equiv: ${fails} of ${stories.length} stories differ`);
  process.exit(1);
}
console.log(`check-worker-equiv: ${stories.length} stories (${wide} with items), worker answer identical to analyze(), all of it can be cloned; WebAssembly answered ${wasmUsed} walks and graph passes in the worker`);
