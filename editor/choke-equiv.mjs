/* ============================================================================
   CHOKE-EQUIV: the Map's choke points (mapImportance in maplayout.js, worked out on flat number lists with a search that stops at the
   first goal page) must be exactly the pages found the plain way: take a page out, and see whether any other goal page can still be
   reached from the start. Random stories (loops, dead ends, pages with no way in, a start that is not on the list, goals that include
   the start) are compared page by page. The traffic shares (also worked out on flat number lists) are compared with the plain way too:
   lists of arrows with the loops dropped, added up in the same order, so they must match to the last digit.
   Usage: node choke-equiv.mjs [stories=2000] [seed=1]     Exit code 1 and the first difference on any failure.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const ctx = createContext({ console });
runInContext(`${readFileSync(new URL('maplayout.js', import.meta.url), 'utf8')}\nthis.__mi = mapImportance;`, ctx);
const mapImportance = ctx.__mi;

const stories = +process.argv[2] || 2000;
let seed = +process.argv[3] || 1;
const R = () => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed / 0x7fffffff);

/* the plain way */
function reference(start, ids, links, goal) {
  const outs = {};
  ids.forEach(id => (outs[id] = []));
  const isIn = new Set(ids);
  links.forEach(l => isIn.has(l.from) && isIn.has(l.to) && outs[l.from].push(l.to));
  const reach = skip => {
    const seen = new Set([start]);
    const todo = [start];
    while (todo.length) for (const w of outs[todo.pop()]) if (w !== skip && !seen.has(w)) (seen.add(w), todo.push(w));
    return seen;
  };
  const base = reach(null);
  const choke = new Set([start]);
  if (goal.length)
    ids
      .filter(id => base.has(id) && id !== start)
      .forEach(v => {
        const r = reach(v);
        if (goal.filter(t => t !== v).every(t => !r.has(t))) choke.add(v);
      });
  return choke;
}

/* the plain way, for the traffic shares */
function trafficReference(start, ids, links, passages) {
  const byId = {},
    outs = {},
    isIn = {};
  passages.forEach(p => (byId[p.id] = p));
  ids.forEach(id => ((isIn[id] = true), (outs[id] = [])));
  links.forEach(l => isIn[l.from] && isIn[l.to] && outs[l.from].push(l.to));
  const state = { [start]: 1 },
    post = [],
    dag = { [start]: [] },
    stack = [[start, 0]];
  while (stack.length) {
    const top = stack[stack.length - 1],
      v0 = top[0],
      list = outs[v0];
    if (top[1] < list.length) {
      const w = list[top[1]++];
      if (state[w] === 1) continue;
      dag[v0].push(w);
      if (!state[w]) {
        state[w] = 1;
        dag[w] = [];
        stack.push([w, 0]);
      }
    } else {
      state[v0] = 2;
      post.push(v0);
      stack.pop();
    }
  }
  const topo = post.slice().reverse(),
    pin = {},
    pout = {},
    traffic = {};
  let max = 0;
  topo.forEach(v => {
    pin[v] = v === start ? 1 : pin[v] || 0;
    dag[v].forEach(w => (pin[w] = (pin[w] || 0) + pin[v]));
  });
  post.forEach(v => {
    let sum = byId[v].ending || !dag[v].length ? 1 : 0;
    dag[v].forEach(w => (sum += pout[w] || 0));
    pout[v] = sum;
  });
  topo.forEach(v => (max = Math.max(max, pin[v] * pout[v])));
  topo.forEach(v => (traffic[v] = max ? (pin[v] * pout[v]) / max : 0));
  return traffic;
}

let checked = 0,
  pages = 0,
  chokes = 0;
for (let t = 0; t < stories; t++) {
  const n = 1 + Math.floor(R() * (t % 10 === 0 ? 120 : 25));
  const passages = [];
  for (let i = 0; i < n; i++) {
    const r = R();
    passages.push({
      id: 'p' + i,
      ending: r < 0.2,
      valence: r < 0.1 ? 'good' : r < 0.15 ? 'bad' : undefined
    });
  }
  const links = [];
  for (let j = Math.floor(R() * n * (1 + R() * 2)); j > 0; j--) {
    const a = Math.floor(R() * n);
    links.push({
      from: 'p' + a,
      to: 'p' + (R() < 0.15 ? a : Math.floor(R() * n))
    });
  }
  for (let i = 0; i < n - 1; i++) if (R() < 0.6) links.push({ from: 'p' + i, to: 'p' + (i + 1) });
  const start = 'p' + (R() < 0.05 ? n + 3 : Math.floor(R() * Math.min(n, 3)));
  const ids = passages.map(p => p.id).filter(() => R() < 0.97);
  const got = mapImportance({ start, passages }, ids, links);
  if (!ids.includes(start)) continue;
  const want = reference(start, ids, links, got.goal);
  const have = new Set(Object.keys(got.choke));
  checked++;
  pages += ids.length;
  chokes += want.size;
  const same = want.size === have.size && [...want].every(id => have.has(id));
  if (!same) {
    console.log(`FAIL story ${t}: expected ${[...want].sort()} got ${[...have].sort()}`);
    process.exit(1);
  }
  const wantT = trafficReference(start, ids, links, passages);
  if (JSON.stringify(Object.entries(wantT)) !== JSON.stringify(Object.entries(got.traffic))) {
    console.log(`FAIL story ${t}: traffic differs`);
    process.exit(1);
  }
}
console.log(`choke-equiv: ${checked} stories, ${pages} pages, ${chokes} choke points, 0 differences, traffic shares equal`);
