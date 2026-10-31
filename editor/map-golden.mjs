/* ============================================================================
   MAP-GOLDEN: the Map's plain layouts (flow, top-down, spine) must not move. Seeded random stories of 10 to 250 pages, laid out with and
   without last time's order, are reduced to one fingerprint each (page boxes, arrow points, choke points, crossings, size, order) and
   compared with map-golden.json, written by the layout code before any speed work changed it. A change that is meant to move the
   drawings rewrites the file on purpose: node map-golden.mjs --write.
   Usage: node map-golden.mjs [--write]     Exit code 1 and the first story that differs.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { createHash } from 'node:crypto';

const here = new URL('.', import.meta.url);
const ctx = createContext({ console });
runInContext(`${readFileSync(new URL('core.js', here), 'utf8')}\n${readFileSync(new URL('maplayout.js', here), 'utf8')}\nthis.X = { normalizeProject, mapBuildPlain };`, ctx);
const { normalizeProject, mapBuildPlain } = ctx.X;

let seed = 7;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed / 0x7fffffff);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
function story(N, nObj, sd) {
  seed = sd;
  const items = [];
  for (let i = 0; i < nObj; i++) items.push({ id: 'o' + i, name: 'O' + i, kind: 'object', show: true });
  const passages = [];
  for (let i = 0; i < N; i++)
    passages.push({ id: 'p' + i, name: 'Page ' + i, blocks: [{ text: 'x', needs: [], forbid: [], orPrev: false }], gives: [], takes: [], choices: [], ending: rnd() < 0.08 || i > N - 3, valence: rnd() < 0.5 ? 'good' : undefined });
  passages.forEach((p, i) => {
    if (nObj && rnd() < 0.25) p.gives = ['o' + int(0, nObj - 1)];
    if (p.ending) return;
    for (let k = int(1, 4); k > 0; k--) {
      const c = { label: 'c' + k + '_' + i, to: 'p' + (rnd() < 0.7 ? Math.min(N - 1, i + int(1, 8)) : int(0, N - 1)), needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: false, why: '' };
      if (nObj && rnd() < 0.15) c.needs = ['o' + int(0, nObj - 1)];
      p.choices.push(c);
    }
  });
  return { id: 's', title: 't', start: 'p0', items, givens: [], passages, game: {} };
}
const R = (k, v) => (typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v === undefined ? null : v);
const print = r => createHash('md5').update(JSON.stringify({ n: r.G.nodes.map(n => [n.id, n.x, n.y, n.choke]), p: r.L.edges.map(e => e.pts), c: r.L.crossings, w: r.L.width, h: r.L.height, o: r.L.order }, R)).digest('hex').slice(0, 16);

const got = [];
for (let sd = 1; sd <= 120; sd++) {
  const j = JSON.stringify(story([10, 30, 60, 120, 250][sd % 5], sd % 6, sd));
  /* no Given picked (the usual case), or a pick the story has no Given for (the filtered path, which then hides nothing) */
  const as = sd % 3 === 0 ? { g: 'x' } : {};
  for (const v of ['flow', 'down', 'spine']) {
    const a = mapBuildPlain(normalizeProject(JSON.parse(j)), v, { as, open: {}, merge: sd % 2 === 0, traffic: null, prev: null });
    const b = mapBuildPlain(normalizeProject(JSON.parse(j)), v, { as, open: {}, merge: true, traffic: null, prev: a.L.order });
    got.push(`${sd} ${v} ${print(a)} ${print(b)}`);
  }
}
const file = new URL('map-golden.json', here);
if (process.argv.includes('--write')) {
  writeFileSync(file, JSON.stringify(got, null, 0).replace(/","/g, '",\n"') + '\n');
  console.log(`map-golden: wrote ${got.length} fingerprints`);
} else {
  const want = JSON.parse(readFileSync(file, 'utf8'));
  for (let i = 0; i < want.length; i++)
    if (want[i] !== got[i]) {
      console.log(`FAIL: story ${want[i].split(' ').slice(0, 2).join(' ')} lays out differently`);
      process.exit(1);
    }
  console.log(`map-golden: ${got.length} layouts, each drawn with and without last time's order (${got.length * 2} drawings), 0 differences`);
}
