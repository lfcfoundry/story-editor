/* ============================================================================
   CROSS-EQUIV: the Map's crossing count in WebAssembly (wasm/mapcross.c through klCrossWasm in checkwalk.js) must equal the JavaScript count in
   mapMetrics (maplayout.js) exactly. Random drawings, some on a coarse grid so segments touch, overlap and run along each other, are scored both ways.
   Usage: node cross-equiv.mjs [drawings=400] [seed=99]     Exit code 1 and the first difference on any failure.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const src = f => readFileSync(new URL(f, import.meta.url), 'utf8');
let wasmCtx;
const load = withWasm => {
  const ctx = createContext({ console, atob: s => Buffer.from(s, 'base64').toString('binary'), WebAssembly });
  runInContext(`${withWasm ? src('checkwalk.js') : ''}\n${src('maplayout.js')}\nthis.__mm = mapMetrics;`, ctx);
  if (withWasm) wasmCtx = ctx;
  return ctx.__mm;
};
const js = load(false),
  wasm = load(true);

if (wasmCtx.klCrossWasm([[[0, 0], [1, 1], 1], [[0, 1], [1, 0], 2]]) !== 1) (console.log('the WebAssembly counter did not run: nothing would be compared'), process.exit(1));

const drawings = +process.argv[2] || 400;
let seed = +process.argv[3] || 99;
const R = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed / 0x7fffffff);
function make() {
  const n = 2 + Math.floor(R() * (R() < 0.2 ? 250 : 60));
  const grid = R() < 0.3 ? 5 : 1000;
  const nodes = [];
  for (let i = 0; i < n; i++) nodes.push({ id: 'n' + i, x: Math.round(R() * grid), y: Math.round(R() * grid), w: 10, h: 10 });
  const m = Math.floor(n * (0.5 + R() * 2.5));
  const edges = [];
  for (let k = 0; k < m; k++) {
    const pts = [];
    for (let q = Math.floor(R() * 4); q > 0; q--) pts.push([Math.round(R() * grid), Math.round(R() * grid)]);
    edges.push({ from: 'n' + Math.floor(R() * n), to: 'n' + Math.floor(R() * n), pts });
  }
  return { kind: 'nodes', nodes, edges, dir: R() < 0.5 ? 'TB' : 'LR' };
}
let checked = 0,
  crossings = 0,
  bad = 0;
for (let t = 0; t < drawings; t++) {
  const L = make();
  const a = js(JSON.parse(JSON.stringify(L)), 0, null, null, true).raw.crossings;
  const b = wasm(JSON.parse(JSON.stringify(L)), 0, null, null, true).raw.crossings;
  checked++;
  crossings += a;
  if (a !== b && ++bad === 1) console.log(`DIFFERENT on drawing ${t}: JavaScript ${a}, WebAssembly ${b}`);
}
console.log(`${checked} drawings, ${crossings} crossings, ${bad} differences`);
if (!bad && !crossings) (console.log('nothing was crossing: the test proves nothing'), process.exit(1));
process.exit(bad ? 1 : 0);
