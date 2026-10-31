/* ============================================================================
   MAP-WORKER-EQUIV: a big story's Map layout is built ahead in a background worker. The worker's code is not a second copy: it is the text of the
   same functions (mapWorkerSource in maplayout.js). This check proves two things for random stories (loops, dead ends, Givens, long jumps):
     1. the text really is complete: it runs in an empty context with nothing else of the editor in it, and
     2. the layout it gives (graph, box sizes, positions, order, crossings, and the crossing count the toolbar chip shows), sent as text and unpacked the
        way the page does (mapPackPlain, mapUnpackPlain), is exactly what the Map tab's own build gives, with the same shared boxes and arrows, for each
        plain view (flow, down, spine), merged arrows on and off, traffic sizing on and off, with and without last time's order, when the story text is
        sent with the first job only (and again after the worker was told to forget it).
   It also reads the page text of ui4-map.js, to confirm the Map tab builds these views through the same functions.
   Usage: node map-worker-equiv.mjs [stories=60] [seed=7]     Exit code 1 and the first difference on any failure.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const here = f => new URL(f, import.meta.url);
const main = createContext({ console, performance });
runInContext(`${readFileSync(here('core.js'), 'utf8')}\n${readFileSync(here('maplayout.js'), 'utf8')}\nthis.__api = { normalizeProject, mapBuildPlain, mapWorkerSource, MAP_PLAIN, mapMetrics, mapUnpackPlain };`, main);
const { normalizeProject, mapBuildPlain, mapWorkerSource, MAP_PLAIN, mapMetrics, mapUnpackPlain } = main.__api;

/* the worker: only the text, in a context that has a clock and a way to answer, nothing else */
const answers = [];
const worker = createContext({ performance, postMessage: m => answers.push(m), console: undefined });
runInContext(mapWorkerSource(), worker);
if (typeof worker.onmessage !== 'function') {
  console.log('FAIL the worker text does not set up onmessage');
  process.exit(1);
}

const stories = +process.argv[2] || 60;
let seed = +process.argv[3] || 7;
const R = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed / 0x7fffffff);
const int = (a, b) => a + Math.floor(R() * (b - a + 1));

function makeStory(n, withGivens) {
  const items = [];
  const givens = [];
  if (withGivens) {
    items.push({ id: 'ga', name: 'A', kind: 'state', show: false }, { id: 'gb', name: 'B', kind: 'state', show: false });
    givens.push({ id: 'g1', question: 'Who?', options: ['ga', 'gb'] });
  }
  const passages = [];
  for (let i = 0; i < n; i++) {
    passages.push({ id: 'p' + i, name: 'Page ' + i, blocks: [{ text: 'x', needs: [], forbid: [], orPrev: false }], gives: [], takes: [], choices: [], ending: i > n - 4 && R() < 0.8, valence: R() < 0.3 ? 'good' : R() < 0.3 ? 'bad' : undefined });
  }
  passages.forEach((p, i) => {
    if (p.ending) return;
    for (let k = int(1, 3); k > 0; k--) {
      const far = R() < 0.15;
      const to = 'p' + (far ? int(0, n - 1) : Math.min(n - 1, i + int(1, 6)));
      const c = { label: 'c' + k, to, needs: [], forbid: [], gives: [], takes: [] };
      if (withGivens && R() < 0.3) c.needs = [R() < 0.5 ? 'ga' : 'gb'];
      p.choices.push(c);
    }
  });
  return normalizeProject({ id: 's', title: 't', start: R() < 0.9 ? 'p0' : 'p' + int(0, n - 1), items, givens, passages, game: {} });
}

/* same-shaped, ignoring the clock: walks both, which share references the same way (the layout and the graph point at the same boxes) */
function diff(a, b, path, seen) {
  if (a === b) return null;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b) ? null : `${path}: ${a} vs ${b}`;
  if (seen.get(a) === b) return null;
  seen.set(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return `${path}: ${ka.length} keys vs ${kb.length}`;
  for (const k of ka) {
    if (!(k in b)) return `${path}.${k}: missing`;
    const d = diff(a[k], b[k], `${path}.${k}`, seen);
    if (d) return d;
  }
  return null;
}

let compared = 0;
let boxes = 0;
for (let t = 0; t < stories; t++) {
  const n = int(2, t % 7 === 0 ? 160 : 40);
  const project = makeStory(n, t % 3 === 0);
  const text = JSON.stringify(project);
  let sent = false; // like the page: the story text goes with the first job only, the worker keeps it
  if (t % 5 === 4) worker.onmessage({ data: { forget: true } }); // and after "forget" the next job brings it again
  for (const view of MAP_PLAIN) {
    for (const merge of [true, false]) {
      for (const traffic of [false, true]) {
        for (const as of t % 3 === 0 ? [{}, { g1: 'ga' }] : [{}]) {
          for (const withPrev of [false, true]) {
            const o = { as, open: {}, merge, traffic, prev: undefined };
            if (withPrev) {
              const first = mapBuildPlain(JSON.parse(text), view, { ...o, prev: undefined }).L;
              o.prev = first.order;
            }
            const want = mapBuildPlain(JSON.parse(text), view, o);
            mapMetrics(want.L, 0, null, null, true); // the worker also does this, so the page finds the toolbar chip's numbers done
            answers.length = 0;
            worker.onmessage({ data: { seq: 1, view, text: sent ? undefined : text, o: JSON.parse(JSON.stringify(o)) } });
            sent = true;
            const got = answers[0];
            if (!got || got.error || typeof got.json !== 'string') {
              console.log(`FAIL story ${t} (${n} pages) ${view}: the worker said ${got ? got.error || 'no text' : 'nothing'}`);
              process.exit(1);
            }
            const back = mapUnpackPlain(got.json); // the answer as the page unpacks it
            delete want.L._centers; // a cache the crossing count fills; the page works it out again when it needs it
            const d = diff({ G: want.G, L: want.L }, back, '', new Map());
            if (d) {
              console.log(`FAIL story ${t} (${n} pages) ${view} merge=${merge} traffic=${traffic} as=${JSON.stringify(as)} prev=${withPrev}: ${d}`);
              process.exit(1);
            }
            compared++;
            boxes += want.L.nodes.length;
          }
        }
      }
    }
  }
}

/* the Map tab builds the plain views through these same functions, and the page rule that allows the worker is there */
const tab = readFileSync(here('ui4-map.js'), 'utf8');
const need = ['mapSizeNodes(G, viewName, mapOpts.traffic)', "mapLayerPlain(G, viewName, root, prev)", "mapLayerPlain(G, 'flow', root, prev)"];
for (const s of need)
  if (!tab.includes(s)) {
    console.log(`FAIL ui4-map.js no longer builds through ${s}`);
    process.exit(1);
  }
console.log(`PASS ${compared} layouts (${boxes} boxes) from the worker's own text equal the Map tab's build, in an empty context`);
