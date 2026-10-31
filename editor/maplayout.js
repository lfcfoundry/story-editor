/* ============================================================================
   PART 1b · MAP LAYOUT  (pure functions: no page, no DOM; the Map tab draws what these return)
   ----------------------------------------------------------------------------
   A story is a directed graph: pages are nodes, choices are arrows. There is no
   single best picture of a graph; each drawing trades some qualities for others
   (fewer crossing arrows, related pages close together, groups kept apart, a
   picture that stays put while you edit, speed). So the Map offers several
   views, measures each against those qualities, and lets the author choose by task.

     1. mapGraph       what to draw: Given filter, folded runs, merged arrows
     2. mapImportance  choke points (every route to the goal passes there) and traffic
     3. layered        the main engine, a Sugiyama-style layered drawing:
                         layers   = how many choices from the start
                         order    = crossing reduction (barycenter sweeps + adjacent swaps),
                                    seeded with the previous order so the picture stays put
                         place    = least-squares placement under order constraints, solved
                                    exactly per layer by pool-adjacent-violators; long arrows
                                    get invisible waypoints so they run straight through gaps
                         options  = left-to-right or top-down; choke points held on one line
                                    (spine); pages kept inside lanes (Given lanes); box sizes
                                    from flow (river)
     4. arcLayout, matrixLayout, shapeLayout   the other views
     5. playtest       thousands of simulated players picking at random, using the game's
                       own rules: visits, moves between pages, and how runs end
     6. mapMetrics     scores a drawing on crossings, neighborhood preservation, group
                       separation, stability, reading direction, compactness and time
   ============================================================================ */
const MAP_W = 176; // a normal page box, in map units
const MAP_H = 56;

/** True if a player whose Given answers are `as` ({givenId: answerId}) could ever see choice `c`. */
function mapChoiceVisible(project, c, as) {
  for (const g of project.givens || []) {
    const pick = as?.[g.id];
    if (!pick || !g.options.includes(pick)) continue;
    if ((c.needs || []).some(id => id !== pick && g.options.includes(id))) return false;
    if ((c.forbid || []).includes(pick)) return false;
  }
  return true;
}

/** Breadth-first distances from `root` along `outs` (id -> [ids]), never entering `skip`. */
function mapReach(root, outs, skip) {
  const d = { [root]: 0 };
  if (root === skip) return {};
  const q = [root];
  for (let i = 0; i < q.length; i++) {
    for (const w of outs[q[i]] || [])
      if (w !== skip && d[w] === undefined) {
        d[w] = d[q[i]] + 1;
        q.push(w);
      }
  }
  return d;
}

/**
 * Choke points and traffic for the pages `ids` joined by `links` ({from, to}).
 * The goal is the good endings; if there are none yet, the neutral endings; if none, the pages where the
 * story simply stops so far; if none, every ending. A choke point is a page every route from the start to
 * the goal must pass through (the start always is one). Traffic is the share of all routes from the start
 * to any ending or dead end (loops ignored) that pass through a page.
 */
function mapImportance(project, ids, links) {
  const byId = {},
    outs = {},
    isIn = {},
    start = project.start;
  project.passages.forEach(p => {
    byId[p.id] = p;
  });
  ids.forEach(id => {
    isIn[id] = true;
    outs[id] = [];
  });
  links.forEach(l => {
    if (isIn[l.from] && isIn[l.to]) outs[l.from].push(l.to);
  });
  const choke = {},
    traffic = {};
  if (!isIn[start]) return { choke, traffic, goal: [], spine: [] };
  const base = mapReach(start, outs, null),
    reached = ids.filter(id => base[id] !== undefined);
  const pick = f => reached.filter(id => f(byId[id]));
  let goal = pick(p => p.ending && p.valence === 'good');
  if (!goal.length) goal = pick(p => p.ending && !p.valence);
  if (!goal.length) goal = pick(p => !p.ending && !outs[p.id].length);
  if (!goal.length) goal = pick(p => p.ending);
  choke[start] = true;
  if (goal.length) {
    /* A page is a choke point when, with it taken out, no goal page can be reached from the start: it is on every route to the goals, so it
       dominates a made-up page that every goal page leads to. The dominators come from one pass of the Cooper-Harvey-Kennedy method
       (the nearest dominator of every page, repeated in reverse finishing order until nothing changes) on flat number lists: the same set
       as taking each page out and searching again, found without a search for every page. */
    const n = ids.length,
      at = new Map(ids.map((id, i) => [id, i])),
      off = new Int32Array(n + 2),
      isGoal = new Uint8Array(n);
    ids.forEach((id, i) => {
      off[i + 1] = off[i] + outs[id].length + (0 | 0);
    });
    const adj = new Int32Array(off[n]);
    ids.forEach((id, i) => outs[id].forEach((w, k) => (adj[off[i] + k] = at.get(w))));
    goal.forEach(g => (isGoal[at.get(g)] = 1));
    const s = at.get(start),
      T = n; // the made-up page every goal page leads to
    if (isGoal[s] !== 1) {
      /* depth-first finishing order from the start, goal pages also leading to T */
      const num = new Int32Array(n + 1).fill(-1), // finishing number
        seen = new Uint8Array(n + 1),
        post = new Int32Array(n + 1),
        stk = new Int32Array(n + 1),
        it = new Int32Array(n + 1);
      let np = 0,
        sp = 0;
      seen[s] = 1;
      stk[sp++] = s;
      while (sp) {
        const x = stk[sp - 1];
        const deg = x === T ? 0 : off[x + 1] - off[x] + (isGoal[x] ? 1 : 0);
        if (it[x] < deg) {
          const k = it[x]++,
            w = k < off[x + 1] - off[x] ? adj[off[x] + k] : T;
          if (!seen[w]) {
            seen[w] = 1;
            stk[sp++] = w;
          }
        } else {
          num[x] = np;
          post[np++] = x;
          sp--;
        }
      }
      /* predecessors (of reached pages only) */
      const pc = new Int32Array(n + 2);
      for (let i = 0; i < np; i++) {
        const x = post[i];
        if (x === T) continue;
        for (let k = off[x]; k < off[x + 1]; k++) pc[adj[k] + 1]++;
        if (isGoal[x]) pc[T + 1]++;
      }
      for (let i = 0; i <= n; i++) pc[i + 1] += pc[i];
      const pl = new Int32Array(pc[n + 1]),
        fill = pc.slice();
      for (let i = 0; i < np; i++) {
        const x = post[i];
        if (x === T) continue;
        for (let k = off[x]; k < off[x + 1]; k++) pl[fill[adj[k]]++] = x;
        if (isGoal[x]) pl[fill[T]++] = x;
      }
      const idom = new Int32Array(n + 1).fill(-1);
      idom[s] = s;
      const meet = (a, b) => {
        while (a !== b) {
          while (num[a] < num[b]) a = idom[a];
          while (num[b] < num[a]) b = idom[b];
        }
        return a;
      };
      for (let changed = true; changed; ) {
        changed = false;
        for (let i = np - 1; i >= 0; i--) {
          const x = post[i];
          if (x === s) continue;
          let ni = -1;
          for (let k = pc[x]; k < pc[x + 1]; k++) {
            const p = pl[k];
            if (idom[p] === -1) continue;
            ni = ni === -1 ? p : meet(p, ni);
          }
          if (ni !== idom[x]) {
            idom[x] = ni;
            changed = true;
          }
        }
      }
      const isChokeN = new Uint8Array(n);
      for (let x = idom[T]; x !== s && x !== -1; x = idom[x]) isChokeN[x] = 1;
      for (const v of reached) if (v !== start && isChokeN[at.get(v)]) choke[v] = true;
    }
  }
  /* routes: drop arrows that go back into a loop (depth-first), then count paths in what is left. On flat number lists; every sum is added in
     the order the old lists gave, so the shares come out the same to the last digit. */
  const nR = ids.length,
    atR = new Map(ids.map((id, i) => [id, i])),
    offR = new Int32Array(nR + 1);
  ids.forEach((id, i) => {
    offR[i + 1] = offR[i] + outs[id].length;
  });
  const adjR = new Int32Array(offR[nR]),
    keepR = new Uint8Array(offR[nR]),
    stateR = new Uint8Array(nR),
    curR = new Int32Array(nR),
    stkR = new Int32Array(nR),
    postR = new Int32Array(nR),
    keptN = new Int32Array(nR);
  ids.forEach((id, i) => outs[id].forEach((w, k) => (adjR[offR[i] + k] = atR.get(w))));
  const s0 = atR.get(start);
  let np = 0,
    sp = 0;
  stateR[s0] = 1;
  stkR[sp++] = s0;
  while (sp) {
    const x = stkR[sp - 1],
      e = offR[x] + curR[x];
    if (e < offR[x + 1]) {
      curR[x]++;
      const w = adjR[e];
      if (stateR[w] === 1) continue; // an arrow back into the current route: a loop
      keepR[e] = 1;
      keptN[x]++;
      if (!stateR[w]) {
        stateR[w] = 1;
        stkR[sp++] = w;
      }
    } else {
      stateR[x] = 2;
      postR[np++] = x;
      sp--;
    }
  }
  const pinR = new Float64Array(nR),
    poutR = new Float64Array(nR);
  let max = 0;
  for (let i = np - 1; i >= 0; i--) {
    const v = postR[i];
    if (v === s0) pinR[v] = 1;
    for (let e = offR[v]; e < offR[v + 1]; e++) if (keepR[e]) pinR[adjR[e]] += pinR[v];
  }
  for (let i = 0; i < np; i++) {
    const v = postR[i];
    let sum = byId[ids[v]].ending || !keptN[v] ? 1 : 0;
    for (let e = offR[v]; e < offR[v + 1]; e++) if (keepR[e]) sum += poutR[adjR[e]];
    poutR[v] = sum;
  }
  for (let i = np - 1; i >= 0; i--) max = Math.max(max, pinR[postR[i]] * poutR[postR[i]]);
  for (let i = np - 1; i >= 0; i--) {
    const v = postR[i];
    traffic[ids[v]] = max ? (pinR[v] * poutR[v]) / max : 0;
  }
  const spine = Object.keys(choke).sort((a, b) => base[a] - base[b]);
  return { choke, traffic, goal, spine, depth: base };
}

/**
 * Which boxes and arrows to draw. opts: as ({givenId: answerId}), fold (bool), open ({firstPageId: true} for
 * folded runs opened up), merge (bool).
 * Returns { nodes: [{id, pages, run}], edges: [{from, to, srcs: [{pid, ci, label, gated}], gated}],
 *           groupOf: {pageId: nodeId}, runs: [[pageIds]] (every foldable run, folded or open), hidden, imp, links }.
 */
function mapGraph(project, opts = {}) {
  const byId = {},
    as = opts.as || {};
  const filtering = Object.values(as).some(Boolean);
  project.passages.forEach(p => {
    byId[p.id] = p;
  });
  let links = [];
  project.passages.forEach(p =>
    p.choices.forEach((c, ci) => {
      if (byId[c.to] && !p.ending && (!filtering || mapChoiceVisible(project, c, as)))
        links.push({ from: p.id, to: c.to, ci, label: c.label, gated: !!(c.needs.length || c.forbid.length) });
      /* a skill check has a second way out: the page for a failed roll */
      if (c.check && byId[c.check.fail] && !p.ending && (!filtering || mapChoiceVisible(project, c, as)))
        links.push({ from: p.id, to: c.check.fail, ci, label: `${c.label} (if the roll fails)`, gated: true, fail: true });
    })
  );
  const outs = {};
  links.forEach(l => {
    (outs[l.from] ||= []).push(l.to);
  });
  const reach = filtering && byId[project.start] ? mapReach(project.start, outs, null) : {}; // only a Given filter can hide pages
  const keep = {};
  let hidden = 0;
  project.passages.forEach(p => {
    if (!filtering || reach[p.id] !== undefined) keep[p.id] = true;
    else hidden++;
  });
  links = links.filter(l => keep[l.from] && keep[l.to]);
  const ids = project.passages.filter(p => keep[p.id]).map(p => p.id);
  const imp = mapImportance(project, ids, links);
  /* runs: u and v join when u's only next page is v and v's only previous page is u (no start, no endings) */
  /* each page's one next (and one previous) page, or null when it has several: all a run needs */
  const succ = new Map(),
    pred = new Map();
  links.forEach(l => {
    const s = succ.get(l.from),
      q = pred.get(l.to);
    if (s === undefined) succ.set(l.from, l.to);
    else if (s !== l.to) succ.set(l.from, null);
    if (q === undefined) pred.set(l.to, l.from);
    else if (q !== l.from) pred.set(l.to, null);
  });
  const only = v => v || null;
  const chainNext = u => {
    const v = only(succ.get(u));
    if (!v || v === u || v === project.start || byId[v].ending || byId[u].ending) return null;
    return only(pred.get(v)) === u ? v : null;
  };
  const hasPrev = new Set();
  ids.forEach(u => {
    const v = chainNext(u);
    if (v) hasPrev.add(v);
  });
  const runs = [];
  ids.forEach(u => {
    if (hasPrev.has(u) || u === project.start) return;
    const run = [u];
    let v = chainNext(u);
    while (v && !run.includes(v)) {
      run.push(v);
      v = chainNext(v);
    }
    if (run.length >= 2) runs.push(run);
  });
  const runOf = {};
  if (opts.fold)
    runs.forEach(run => {
      if (!opts.open?.[run[0]])
        run.forEach(id => {
          runOf[id] = run;
        });
    });
  const nodes = [],
    groupOf = {};
  ids.forEach(id => {
    const run = runOf[id];
    if (run && run[0] !== id) return;
    /* every field the layout fills in later is there from the start, so all boxes share one shape and stay fast to read */
    const node = run ? { id: `run:${id}`, pages: run.slice(), run: true } : { id, pages: [id], run: false };
    node.traffic = 0;
    node.choke = false;
    node.k = 1;
    node.w = 0;
    node.h = 0;
    node.v = null;
    node.layer = 0;
    node.x = 0;
    node.y = 0;
    node.loose = false;
    node.pages.forEach(pid => {
      groupOf[pid] = node.id;
    });
    nodes.push(node);
  });
  const edges = [],
    seen = new Map(); // from group -> (to group -> merged arrow)
  links.forEach(l => {
    const a = groupOf[l.from],
      b = groupOf[l.to];
    if (a === b && l.from !== l.to) return; // a step inside a folded run
    const src = { pid: l.from, ci: l.ci, label: l.label, gated: l.gated };
    let row = seen.get(a);
    if (!row) seen.set(a, (row = new Map()));
    const was = row.get(b);
    if (opts.merge && was) {
      was.srcs.push(src);
      was.gated &&= l.gated;
      return;
    }
    const e = { from: a, to: b, srcs: [src], gated: l.gated };
    row.set(b, e);
    edges.push(e);
  });
  return { nodes, edges, groupOf, runs, hidden, imp, links };
}

/* ---------------------------------------------------------------------------
   The layered engine
   --------------------------------------------------------------------------- */

/**
 * Least-squares placement of boxes along one line, keeping their order: positions x minimizing
 * Σ w·(x − want)² with each box at least `gap` after the one before (gaps[i] between i and i+1).
 * Exact, by pool-adjacent-violators on the shifted problem. `lo` (optional) is a floor for the first box.
 */
function mapPlaceLine(want, w, gaps, lo) {
  const n = want.length,
    off = new Array(n);
  off[0] = 0;
  for (let i = 1; i < n; i++) off[i] = off[i - 1] + gaps[i - 1];
  const blocks = []; // each: [sum of w·target, sum of w, count]
  for (let i = 0; i < n; i++) {
    blocks.push([w[i] * (want[i] - off[i]), w[i], 1]);
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1],
        a = blocks[blocks.length - 2];
      if (a[0] / a[1] <= b[0] / b[1]) break;
      blocks.pop();
      a[0] += b[0];
      a[1] += b[1];
      a[2] += b[2];
    }
  }
  const out = new Array(n);
  let i = 0,
    floor = lo === undefined ? -Infinity : lo;
  for (const b of blocks) {
    const v = Math.max(b[0] / b[1], floor);
    for (let k = 0; k < b[2]; k++, i++) out[i] = v + off[i];
    floor = -Infinity;
  }
  if (lo !== undefined && out[0] < lo) {
    const d = lo - out[0];
    for (let k = 0; k < n; k++) out[k] += d;
  }
  for (let k = 1; k < n; k++) if (out[k] < out[k - 1] + gaps[k - 1]) out[k] = out[k - 1] + gaps[k - 1]; // tidy rounding
  return out;
}

/** Crossings between two neighboring layers, given each segment as [position in upper, position in lower]. */
function mapCrossPairs(segs) {
  segs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = segs.length;
  if (n < 2) return 0;
  /* A pair crosses when its upper position is larger and its lower position smaller. Counted with a running tally over the lower
     positions (a Fenwick tree), so a story with thousands of choices costs n log n, not n squared; the count is the same. */
  const lows = [...new Set(segs.map(x => x[1]))].sort((x, y) => x - y);
  const idx = new Map(lows.map((v, i) => [v, i + 1]));
  const tree = new Int32Array(lows.length + 2);
  let c = 0,
    done = 0;
  for (let i = 0; i < n; ) {
    let j = i;
    while (j < n && segs[j][0] === segs[i][0]) j++;
    for (let k = i; k < j; k++) {
      let q = 0;
      for (let t = idx.get(segs[k][1]); t > 0; t -= t & -t) q += tree[t];
      c += done - q; // earlier (smaller upper position) segments that end lower down than this one
    }
    for (let k = i; k < j; k++) {
      for (let t = idx.get(segs[k][1]); t < tree.length; t += t & -t) tree[t]++;
      done++;
    }
    i = j;
  }
  return c;
}

/**
 * A layered drawing of graph G (from mapGraph, with n.w / n.h set).
 * opts: dir 'LR' | 'TB'; root (node id); spine (bool: hold choke points on one line);
 *       lane (node -> lane number, for Given lanes); prev ({nodeId: number}, the order last time, to keep
 *       the picture stable); gapLayer, gapNode (spacing).
 * Returns { nodes (with x, y, w, h, layer, loose), edges (with pts: waypoints, kind fwd|back|flat|self),
 *           width, height, order: {nodeId: number}, lanes: [{lane, from, to}], dir }.
 */
function layered(G, opts = {}) {
  const dir = opts.dir || 'LR',
    LR = dir === 'LR';
  const byNode = {},
    outs = {},
    ins = {};
  G.nodes.forEach(n => {
    byNode[n.id] = n;
    outs[n.id] = [];
    ins[n.id] = [];
  });
  G.edges.forEach(e => {
    outs[e.from].push(e.to);
    ins[e.to].push(e.from);
  });
  /* 1. layers: choices from the start; anything not reached is laid out after, from its own first page */
  const layer = {};
  let maxL = 0;
  const bfs = (r, base, loose) => {
    if (layer[r] !== undefined) return;
    layer[r] = base;
    byNode[r].loose = loose;
    const q = [r];
    for (let i = 0; i < q.length; i++)
      for (const w of outs[q[i]])
        if (layer[w] === undefined) {
          layer[w] = layer[q[i]] + 1;
          byNode[w].loose = loose;
          q.push(w);
        }
    q.forEach(id => {
      maxL = Math.max(maxL, layer[id]);
    });
  };
  if (opts.root && byNode[opts.root]) bfs(opts.root, 0, false);
  G.nodes.forEach(n => {
    if (layer[n.id] === undefined && !ins[n.id].some(f => layer[f] === undefined && f !== n.id)) bfs(n.id, maxL + 1, true);
  });
  G.nodes.forEach(n => {
    if (layer[n.id] === undefined) bfs(n.id, maxL + 1, true);
  });
  /* 2. waypoints: an arrow that spans several layers gets one invisible stop per layer it crosses */
  const L = []; // L[k] = list of vertex records in layer k
  const vert = []; // all vertices: real { id, node } and waypoints { dummy: true, edge }
  const addV = (rec, k) => {
    rec.layer = k;
    rec.idx = vert.length;
    vert.push(rec);
    (L[k] ||= []).push(rec);
    return rec;
  };
  G.nodes.forEach(n => {
    n.v = addV({ id: n.id, node: n, dummy: false }, layer[n.id]);
  });
  const links = []; // neighboring-layer links between vertices: [upper vertex, lower vertex, weight]
  G.edges.forEach(e => {
    const a = byNode[e.from],
      b = byNode[e.to],
      la = layer[e.from],
      lb = layer[e.to];
    e.chain = [];
    if (e.from === e.to) {
      e.kind = 'self';
      return;
    }
    if (la === lb) {
      e.kind = 'flat';
      return;
    }
    e.kind = lb > la ? 'fwd' : 'back';
    const lo = Math.min(la, lb),
      hi = Math.max(la, lb);
    let prevV = (lb > la ? a : b).v;
    for (let k = lo + 1; k < hi; k++) {
      const d = addV({ dummy: true, edge: e }, k);
      e.chain.push(d);
      links.push([prevV, d, prevV.dummy ? 8 : 2]);
      prevV = d;
    }
    links.push([prevV, (lb > la ? b : a).v, prevV.dummy ? 2 : 1]);
    if (e.kind === 'back') e.chain.reverse(); // waypoints in the order the arrow travels
  });
  const up = vert.map(() => []),
    down = vert.map(() => []);
  links.forEach(([u, d, w]) => {
    down[u.idx].push([d, w]);
    up[d.idx].push([u, w]);
  });
  /* 3. order inside each layer: start from last time's order (stable) or depth-first order, then reduce crossings */
  const nL = L.length;
  for (let k = 0; k < nL; k++) L[k] ||= [];
  const dfsRank = {};
  let rank = 0;
  const seenD = new Set(),
    visitD = id => {
      if (seenD.has(id)) return;
      seenD.add(id);
      dfsRank[id] = rank++;
      outs[id].forEach(visitD);
    };
  if (opts.root && byNode[opts.root]) visitD(opts.root);
  G.nodes.forEach(n => visitD(n.id));
  const prev = opts.prev || {};
  const laneOf = v => (v.dummy ? (opts.lane ? laneOfEdge(v.edge) : 0) : opts.lane ? opts.lane(v.node) : 0);
  const laneOfEdge = e => Math.min(opts.lane(byNode[e.from]), opts.lane(byNode[e.to]));
  const rn = Math.max(1, rank); // last time's order is a fraction (0-1) within the layer; so is depth-first rank / count
  L.forEach(list =>
    list.forEach(v => {
      v.key = v.dummy ? (dfsRank[v.edge.from] + dfsRank[v.edge.to]) / 2 / rn : (prev[v.id] ?? dfsRank[v.id] / rn);
    })
  );
  L.forEach(list => {
    list.sort((a, b) => laneOf(a) - laneOf(b) || a.key - b.key);
    list.forEach((v, i) => {
      v.pos = i;
    });
  });
  /* Ordering on flat number lists (same arithmetic, same order): one list of vertex numbers per layer, their places in one list, and the
     links of every vertex as index-and-neighbor lists. */
  const nV = vert.length,
    posA = new Int32Array(nV),
    laneA = new Float64Array(nV),
    baryA = new Float64Array(nV);
  const csr = lists => {
    const start = new Int32Array(nV + 1);
    for (let i = 0; i < nV; i++) start[i + 1] = start[i] + lists[i].length;
    const nb = new Int32Array(start[nV]);
    for (let i = 0; i < nV; i++) for (let j = 0; j < lists[i].length; j++) nb[start[i] + j] = lists[i][j][0].idx;
    return [start, nb];
  };
  const [uS, uN] = csr(up),
    [dS, dN] = csr(down);
  const LA = L.map(list => Int32Array.from(list, v => v.idx));
  vert.forEach(v => {
    posA[v.idx] = v.pos;
    laneA[v.idx] = laneOf(v);
  });
  const byBary = (a, b) => laneA[a] - laneA[b] || baryA[a] - baryA[b] || posA[a] - posA[b];
  /* Crossings between layer k and k+1 (accumulator tree of Barth, Juenger and Mutzel): the layer list is already in position order, each
     vertex's lower positions are put in order, and a tree over the lower layer counts earlier links that end further down. */
  let cxLow = new Int32Array(64),
    cxTree = new Int32Array(64);
  const crossBetween = k => {
    const upper = LA[k],
      nLow = LA[k + 1].length;
    const m = dS[nV];
    if (cxLow.length < m) cxLow = new Int32Array(m);
    if (cxTree.length < nLow + 2) cxTree = new Int32Array(2 * nLow + 2);
    cxTree.fill(0, 0, nLow + 2);
    let c = 0,
      done = 0;
    for (let j = 0; j < upper.length; j++) {
      const u = upper[j],
        s0 = dS[u],
        len = dS[u + 1] - s0;
      if (!len) continue;
      for (let t = 0; t < len; t++) cxLow[t] = posA[dN[s0 + t]];
      if (len > 1) cxLow.subarray(0, len).sort();
      for (let t = 0; t < len; t++) {
        let q = 0;
        for (let x = cxLow[t] + 1; x > 0; x -= x & -x) q += cxTree[x];
        c += done - q;
      }
      for (let t = 0; t < len; t++) {
        for (let x = cxLow[t] + 1; x <= nLow + 1; x += x & -x) cxTree[x]++;
        done++;
      }
    }
    return c;
  };
  const totalCross = () => {
    let c = 0;
    for (let k = 0; k + 1 < nL; k++) c += crossBetween(k);
    return c;
  };
  const ver = new Int32Array(nL).fill(0),
    settled = new Int32Array(3 * nL).fill(-2);
  const snapshot = () => LA.map(list => list.slice());
  let best = snapshot(),
    bestC = totalCross();
  const sweep = (k, S, N) => {
    const list = LA[k];
    for (let j = 0; j < list.length; j++) {
      const v = list[j],
        a = S[v],
        e = S[v + 1];
      let sum = 0;
      for (let t = a; t < e; t++) sum += posA[N[t]];
      baryA[v] = e > a ? sum / (e - a) : posA[v];
    }
    list.sort(byBary);
    let moved = false;
    for (let j = 0; j < list.length; j++) {
      if (posA[list[j]] !== j) moved = true;
      posA[list[j]] = j;
    }
    if (moved) ver[k]++;
  };
  /** Swaps neighbors in a layer while that removes crossings (and keeps lanes in place); a settled layer with unchanged neighbors is skipped,
      and a pair's decision is kept for the rest of the call. */
  const transpose = k => {
    const s0 = k > 0 ? ver[k - 1] : -1,
      s2 = k + 1 < nL ? ver[k + 1] : -1;
    if (settled[3 * k] === s0 && settled[3 * k + 1] === ver[k] && settled[3 * k + 2] === s2) return;
    const list = LA[k];
    let improved = true,
      guard = 0;
    const kept = new Map();
    while (improved && guard++ < 8) {
      improved = false;
      for (let i = 0; i + 1 < list.length; i++) {
        const a = list[i],
          b = list[i + 1];
        if (laneA[a] !== laneA[b]) continue;
        const key = a * nV + b;
        let d = kept.get(key);
        if (d === undefined) {
          let before = 0,
            after = 0;
          const tally = (S, N) => {
            for (let p = S[a]; p < S[a + 1]; p++)
              for (let q = S[b]; q < S[b + 1]; q++) {
                const x = posA[N[p]],
                  y = posA[N[q]];
                if (x > y) before++;
                else if (x < y) after++;
              }
          };
          if (k + 1 < nL) tally(dS, dN);
          if (k > 0) tally(uS, uN);
          d = after < before;
          kept.set(key, d);
        }
        if (d) {
          posA[a] = i + 1;
          posA[b] = i;
          list[i] = b;
          list[i + 1] = a;
          improved = true;
        }
      }
      if (improved) ver[k]++;
    }
    if (!improved) {
      settled[3 * k] = s0;
      settled[3 * k + 1] = ver[k];
      settled[3 * k + 2] = s2;
    } else settled[3 * k] = -2;
  };
  const big = vert.length > 600; // very large maps: fewer passes, so the map stays quick
  /* a round is decided by the orderings alone, so a repeated ordering means every later round repeats */
  const seenOrd = [];
  const ordOf = () => {
    const a = new Int32Array(nV);
    let n = 0;
    for (let k = 0; k < nL; k++) for (let i = 0; i < LA[k].length; i++) a[n++] = LA[k][i];
    return a;
  };
  const sameOrd = (a, b) => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  };
  seenOrd.push(ordOf());
  for (let it = 0; it < (big ? 2 : 6) && bestC > 0; it++) {
    for (let k = 1; k < nL; k++) sweep(k, uS, uN);
    for (let k = nL - 2; k >= 0; k--) sweep(k, dS, dN);
    if (!big) for (let k = 0; k < nL; k++) transpose(k);
    const now = ordOf();
    if (seenOrd.some(o => sameOrd(o, now))) break;
    seenOrd.push(now);
    const c = totalCross();
    if (c < bestC) {
      bestC = c;
      best = snapshot();
    }
  }
  best.forEach((list, k) => {
    L[k] = Array.from(list, i => vert[i]);
    L[k].forEach((v, i) => {
      v.pos = i;
    });
  });
  /* 4. place: along each layer, as near as possible to the vertices it links with (least squares, order kept) */
  const across = v => (v.dummy ? 0 : LR ? v.node.h : v.node.w);
  const gapN = opts.gapNode ?? (LR ? 22 : 28),
    gapD = 12;
  const gapOf = (a, b) => (across(a) + across(b)) / 2 + (a.dummy || b.dummy ? gapD : gapN) + (opts.lane && laneOf(a) !== laneOf(b) ? 40 : 0);
  L.forEach(list => {
    let c = 0;
    list.forEach((v, i) => {
      if (i) c += gapOf(list[i - 1], v);
      v.c = c;
    });
  });
  const isChoke = v => !v.dummy && opts.spine && v.node.choke;
  /* The same least-squares placement on flat number lists: each layer's gaps and choke flags are worked out once (they never change
     between rounds), and the links of every vertex sit in three lists (start, neighbor, weight) in the original order, so every sum adds up
     in the same order and the result is the same to the last digit. */
  const nVp = vert.length,
    cA = new Float64Array(nVp);
  vert.forEach(v => {
    cA[v.idx] = v.c;
  });
  const csrW = lists => {
    const start = new Int32Array(nVp + 1);
    for (let i = 0; i < nVp; i++) start[i + 1] = start[i] + lists[i].length;
    const nb = new Int32Array(start[nVp]),
      wt = new Float64Array(start[nVp]);
    for (let i = 0; i < nVp; i++)
      for (let j = 0; j < lists[i].length; j++) {
        nb[start[i] + j] = lists[i][j][0].idx;
        wt[start[i] + j] = lists[i][j][1];
      }
    return [start, nb, wt];
  };
  const upF = csrW(up),
    downF = csrW(down),
    bothF = csrW(vert.map((_, i) => up[i].concat(down[i])));
  const gapsOf = L.map(list => list.map((v, i) => (i ? gapOf(list[i - 1], v) : 0)).slice(1)),
    chokeOf = L.map(list => list.map(isChoke));
  /* mapPlaceLine on reused flat buffers: the same steps and the same arithmetic, so the same numbers, without making arrays each call. */
  let pvOff = new Float64Array(64),
    pvS = new Float64Array(64),
    pvW = new Float64Array(64),
    pvN = new Int32Array(64),
    pvWant = new Float64Array(64),
    pvWt = new Float64Array(64);
  const placeFlat = (n, gaps, k) => {
    const off = pvOff,
      S = pvS,
      Wb = pvW,
      Nb = pvN;
    off[0] = 0;
    for (let i = 1; i < n; i++) off[i] = off[i - 1] + gaps[i - 1];
    let nb = 0;
    for (let i = 0; i < n; i++) {
      S[nb] = pvWt[i] * (pvWant[i] - off[i]);
      Wb[nb] = pvWt[i];
      Nb[nb] = 1;
      nb++;
      while (nb > 1) {
        const b = nb - 1,
          a = nb - 2;
        if (S[a] / Wb[a] <= S[b] / Wb[b]) break;
        S[a] += S[b];
        Wb[a] += Wb[b];
        Nb[a] += Nb[b];
        nb--;
      }
    }
    const list = L[k];
    let i = 0;
    for (let bI = 0; bI < nb; bI++) {
      const v = Math.max(S[bI] / Wb[bI], -Infinity);
      for (let t = 0; t < Nb[bI]; t++, i++) pvOff[i] = v + off[i];
    }
    for (let t = 1; t < n; t++) if (pvOff[t] < pvOff[t - 1] + gaps[t - 1]) pvOff[t] = pvOff[t - 1] + gaps[t - 1];
    let changed = false;
    for (let t = 0; t < n; t++) {
      const id = list[t].idx;
      if (cA[id] !== pvOff[t]) changed = true;
      cA[id] = pvOff[t];
    }
    return changed;
  };
  const placeLayer = (k, F) => {
    const list = L[k],
      n = list.length;
    if (!n) return false;
    if (pvWant.length < n) {
      const cap = 2 * n;
      pvOff = new Float64Array(cap);
      pvS = new Float64Array(cap);
      pvW = new Float64Array(cap);
      pvN = new Int32Array(cap);
      pvWant = new Float64Array(cap);
      pvWt = new Float64Array(cap);
    }
    const [S, N, W] = F;
    for (let i = 0; i < n; i++) {
      const v = list[i],
        id = v.idx;
      let s = 0,
        sw = 0;
      for (let e = S[id]; e < S[id + 1]; e++) {
        s += cA[N[e]] * W[e];
        sw += W[e];
      }
      if (chokeOf[k][i]) {
        pvWant[i] = 0;
        pvWt[i] = 1000;
      } else {
        pvWant[i] = sw ? s / sw : cA[id];
        pvWt[i] = sw ? sw + (v.dummy ? 2 : 0) : 0.2;
      }
    }
    return placeFlat(n, gapsOf[k], k);
  };
  /* A round of one kind (the up-then-down passes, or the both-sides passes) that moves nothing would move nothing again; once a round of
     each kind in a row has moved nothing, every later round is the same, so the loop stops there. */
  let stillA = false,
    stillB = false;
  for (let it = 0; it < (big ? 3 : 8); it++) {
    const B = it % 3 === 2;
    let moved = false;
    for (let k = 1; k < nL; k++) if (placeLayer(k, B ? bothF : upF)) moved = true;
    for (let k = nL - 2; k >= 0; k--) if (placeLayer(k, B ? bothF : downF)) moved = true;
    if (moved) stillA = stillB = false;
    else if (B) stillB = true;
    else stillA = true;
    if (stillA && stillB) break;
  }
  vert.forEach(v => {
    v.c = cA[v.idx];
  });
  /* lanes: shift each lane so it sits in its own band */
  let lanes = [];
  if (opts.lane) {
    const ext = {}; // lane -> [min, max] of positions
    vert.forEach(v => {
      const ln = laneOf(v),
        lo = v.c - across(v) / 2,
        hi = v.c + across(v) / 2;
      ext[ln] = ext[ln] ? [Math.min(ext[ln][0], lo), Math.max(ext[ln][1], hi)] : [lo, hi];
    });
    const order = Object.keys(ext)
        .map(Number)
        .sort((a, b) => a - b),
      shift = {};
    let at = 0;
    order.forEach(ln => {
      shift[ln] = at - ext[ln][0] + 28;
      lanes.push({ lane: ln, from: at, to: at + (ext[ln][1] - ext[ln][0]) + 56 });
      at += ext[ln][1] - ext[ln][0] + 56 + 16;
    });
    vert.forEach(v => {
      v.c += shift[laneOf(v)];
    });
  }
  /* 5. coordinates: layers along the reading direction, positions across it */
  const gapL = opts.gapLayer ?? (LR ? 80 : 64);
  const depthOf = [];
  let at = 0;
  for (let k = 0; k < nL; k++) {
    let m = 0;
    L[k].forEach(v => {
      if (!v.dummy) m = Math.max(m, LR ? v.node.w : v.node.h);
    });
    depthOf[k] = [at, m || 20];
    at += (m || 20) + gapL;
  }
  let minC = Infinity;
  vert.forEach(v => {
    minC = Math.min(minC, v.c - across(v) / 2);
  });
  if (!isFinite(minC)) minC = 0;
  const pad = 20;
  vert.forEach(v => {
    const [d0, dm] = depthOf[v.layer];
    const along = d0 + dm / 2,
      acrossC = v.c - minC;
    if (v.dummy) {
      v.x = LR ? pad + along : pad + acrossC;
      v.y = LR ? pad + acrossC : pad + along;
      return;
    }
    const n = v.node;
    n.layer = v.layer;
    n.x = LR ? pad + along - n.w / 2 : pad + acrossC - n.w / 2;
    n.y = LR ? pad + acrossC - n.h / 2 : pad + along - n.h / 2;
  });
  lanes = lanes.map(l => ({ lane: l.lane, from: pad + l.from - minC, to: pad + l.to - minC }));
  G.edges.forEach(e => {
    e.pts = e.chain.map(v => [v.x, v.y]);
  });
  let W = 0,
    H = 0;
  G.nodes.forEach(n => {
    W = Math.max(W, n.x + n.w);
    H = Math.max(H, n.y + n.h);
  });
  vert.forEach(v => {
    if (v.dummy) {
      W = Math.max(W, v.x);
      H = Math.max(H, v.y);
    }
  });
  if (lanes.length) {
    if (LR) H = Math.max(H, lanes[lanes.length - 1].to);
    else W = Math.max(W, lanes[lanes.length - 1].to);
  }
  const order = {};
  L.forEach(list =>
    list.forEach(v => {
      if (!v.dummy) order[v.id] = (v.pos + 0.5) / list.length;
    })
  );
  const pos = {};
  G.nodes.forEach(n => {
    pos[n.id] = n;
    delete n.v;
  });
  return { kind: 'nodes', dir, nodes: G.nodes, edges: G.edges, pos, order, lanes, width: W + pad + 60, height: H + pad + 30, crossings: bestC };
}

/* ---------------------------------------------------------------------------
   The plain layered views, built in one piece (so the Map tab can also build them in the background)
   --------------------------------------------------------------------------- */

const MAP_PLAIN = ['flow', 'down', 'spine']; // the layered views that need nothing but the story and a few settings

/** Gives every page box its size: normal, or larger by traffic (and the choke points a little larger in the spine view). */
function mapSizeNodes(G, viewName, traffic) {
  G.nodes.forEach(n => {
    let t = -Infinity,
      ch = false;
    for (const id of n.pages) {
      t = Math.max(t, G.imp.traffic[id] || 0);
      if (G.imp.choke[id]) ch = true;
    }
    n.traffic = t;
    n.choke = ch;
    let k = 1;
    if (traffic) k = 1 + 0.45 * n.traffic;
    if (viewName === 'spine' && n.choke) k = Math.max(k, 1.2);
    n.k = k;
    n.w = MAP_W * k;
    n.h = MAP_H * k;
  });
}

/** The layered drawing for one of the MAP_PLAIN views. `prev` is last time's order (so the picture stays put). */
function mapLayerPlain(G, viewName, root, prev) {
  if (viewName === 'down') return layered(G, { dir: 'TB', root, prev });
  if (viewName === 'spine') return layered(G, { dir: 'LR', root, prev, spine: true });
  return layered(G, { dir: 'LR', root, prev });
}

/** Graph, box sizes and layout of a MAP_PLAIN view in one call: { G, L }. o = { as, open, merge, traffic, prev }. */
function mapBuildPlain(project, viewName, o) {
  const G = mapGraph(project, { as: o.as, fold: true, open: o.open, merge: o.merge });
  mapSizeNodes(G, viewName, o.traffic);
  const L = mapLayerPlain(G, viewName, G.groupOf[project.start], o.prev);
  return { G, L };
}

/* The worker's answer travels as JSON text. Handing the layout over as objects costs the page 25-35 ms of copying for a 2,000-page story (the
   browser rebuilds some 30,000 small objects and strings on the page's thread before the answer arrives); the same layout as text costs it
   10-14 ms (JSON.parse is far quicker at that than the copy), and the worker does the writing. Left out of the text, because the page
   rebuilds them in a moment: the layout's own lists of boxes and arrows (the same lists as the graph's), its box lookup (pos), its centers
   (worked out again when needed) and each waypoint's link back to its arrow. */
function mapPackPlain(G, L) {
  const rest = Object.assign({}, L);
  delete rest.nodes;
  delete rest.edges;
  delete rest.pos;
  delete rest._centers;
  for (const e of G.edges) for (const c of e.chain || []) delete c.edge;
  return JSON.stringify({ G, L: rest });
}
/** The page's side of mapPackPlain: { G, L } as mapBuildPlain gave them, with the same shared boxes and arrows. */
function mapUnpackPlain(json) {
  const { G, L } = JSON.parse(json);
  L.nodes = G.nodes;
  L.edges = G.edges;
  const pos = {};
  for (const n of G.nodes) pos[n.id] = n;
  L.pos = pos;
  for (const e of G.edges) for (const c of e.chain || []) c.edge = e;
  return { G, L };
}

/* What a plain layout is made from, as one fingerprint: the story without the words a player reads on a page (paragraph texts, headings, notes;
   the layout never uses them), and the view and options. The worker strips those words before it builds, so the layout cannot depend on them,
   and answers "same" when the fingerprint equals the one of the layout the page already holds: typing in a paragraph then costs the page no
   new layout (it was about 20 ms of page time after every typing pause at 2,000 pages). Two 32-bit FNV-1a hashes and the length. */
function mapStructKey(story, view, o) {
  for (const p of story.passages || []) {
    delete p.heading;
    delete p.note;
    for (const b of p.blocks || []) delete b.text;
  }
  const s = `${JSON.stringify(story)}|${JSON.stringify([view, o])}`;
  let a = 0x811c9dc5,
    b = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x050c5d1f) ^ (b >>> 15);
  }
  return `${s.length}:${a >>> 0}:${b >>> 0}`;
}

/* The plain views can be built in a background worker (the Map tab, ui4-map.js, starts it): the worker's code is these functions as text,
   so there is one copy of the logic. It also counts the crossings for the toolbar chip (mapMetrics keeps that on the layout, so the page finds it done). The list must hold everything mapBuildPlain uses (the check map-worker-equiv.mjs proves it). */
const MAP_WORKER_FUNCS = [
  mapChoiceVisible, mapReach, mapImportance, mapGraph, mapPlaceLine, mapCrossPairs, layered, mapSizeNodes, mapLayerPlain, mapBuildPlain, mapSegCross, mapMetrics, mapPackPlain, mapStructKey
];
function mapWorkerSource() {
  const fns = MAP_WORKER_FUNCS.map(f => f.toString()).join('\n');
  return `'use strict';\nconst MAP_W=${MAP_W},MAP_H=${MAP_H};\n${fns}\nlet story=null;\nonmessage=e=>{const m=e.data;if(m.forget){story=null;return}try{const t=performance.now();if(m.text!==undefined)story=m.text;const st=JSON.parse(story),h=mapStructKey(st,m.view,m.o);if(m.have===h){postMessage({seq:m.seq,same:true,h});return}const r=mapBuildPlain(st,m.view,m.o);mapMetrics(r.L,0,null,null,true);postMessage({seq:m.seq,json:mapPackPlain(r.G,r.L),ms:performance.now()-t,h})}catch(x){postMessage({seq:m.seq,error:String(x&&x.message||x)})}};`;
}

/* ---------------------------------------------------------------------------
   Other views
   --------------------------------------------------------------------------- */

/** Arc diagram: every page on one line in reading order; arcs above for choices forward, below for choices back. */
function arcLayout(G, base) {
  const nodes = G.nodes.slice().sort((a, b) => a.layer - b.layer || (base.order[a.id] ?? 0) - (base.order[b.id] ?? 0));
  const step = 34,
    pad = 40;
  let maxSpan = 1;
  nodes.forEach((n, i) => {
    n.ai = i;
  });
  const pos = {};
  nodes.forEach(n => {
    pos[n.id] = n;
  });
  G.edges.forEach(e => {
    maxSpan = Math.max(maxSpan, Math.abs(pos[e.to].ai - pos[e.from].ai));
  });
  const lift = Math.min((maxSpan * step) / 2, 520),
    y0 = pad + lift;
  nodes.forEach(n => {
    n.cx = pad + n.ai * step;
    n.cy = y0;
  });
  return { kind: 'arc', nodes, edges: G.edges, pos, baseline: y0, width: pad * 2 + nodes.length * step, height: y0 + 190 };
}

/** Matrix: a grid with a row and a column per page; a filled square where a choice leads from row to column. */
function matrixLayout(G, base) {
  const nodes = G.nodes.slice().sort((a, b) => a.layer - b.layer || (base.order[a.id] ?? 0) - (base.order[b.id] ?? 0));
  nodes.forEach((n, i) => {
    n.mi = i;
  });
  const pos = {};
  nodes.forEach(n => {
    pos[n.id] = n;
  });
  const cell = 18,
    head = 150;
  return { kind: 'matrix', nodes, edges: G.edges, pos, cell, head, width: head + nodes.length * cell + 150, height: head + nodes.length * cell + 30 }; // room on the right for the slanted column names
}

/**
 * Story shape: the stretches between choke points, each summarized by its pattern.
 * Every page belongs to the last choke point that every route to it passes through.
 */
function shapeLayout(project, G) {
  const imp = G.imp,
    spine = imp.spine.filter(id => G.groupOf[id] !== undefined);
  const outs = {};
  G.links.forEach(l => {
    (outs[l.from] ||= []).push(l.to);
  });
  const byId = {};
  project.passages.forEach(p => {
    byId[p.id] = p;
  });
  const all = Object.keys(G.groupOf);
  const owner = {};
  spine.forEach((c, i) => {
    const without = mapReach(project.start, outs, c);
    all.forEach(id => {
      if (id !== c && without[id] === undefined && imp.depth[id] !== undefined) owner[id] = i;
    });
  });
  spine.forEach((c, i) => {
    owner[c] = i;
  });
  const segs = spine.map((c, i) => ({ i, from: c, to: spine[i + 1] || null, pages: [], endings: { good: 0, bad: 0, neutral: 0 } }));
  all.forEach(id => {
    if (spine.includes(id)) return;
    const s = segs[owner[id] ?? 0];
    if (!s) return;
    s.pages.push(id);
    const p = byId[id];
    if (p.ending) s.endings[p.valence || 'neutral']++;
  });
  segs.forEach(s => {
    const inside = new Set(s.pages.concat([s.from]));
    const end = s.to;
    /* routes from this choke point to the next, ignoring loops */
    const memo = {},
      onPath = new Set();
    const count = v => {
      if (v === end) return 1;
      if (memo[v] !== undefined) return memo[v];
      if (onPath.has(v)) return 0;
      onPath.add(v);
      let c = 0;
      for (const w of outs[v] || []) if (w === end || (inside.has(w) && w !== s.from)) c += count(w);
      onPath.delete(v);
      return (memo[v] = c);
    };
    s.routes = end ? count(s.from) : 0;
    let loops = false;
    G.links.forEach(l => {
      if (inside.has(l.from) && inside.has(l.to) && (imp.depth[l.to] ?? 0) <= (imp.depth[l.from] ?? 0) && l.to !== end) loops = true;
    });
    s.loops = loops;
    const ends = s.endings.good + s.endings.bad + s.endings.neutral;
    const rest = s.pages.filter(id => !byId[id].ending).length;
    s.pattern = !end
      ? ends
        ? 'The finale'
        : 'Still being written'
      : !rest
        ? 'Straight on'
        : s.routes <= 1
          ? 'A straight road'
          : 'Branch and rejoin';
    if (end && ends) s.pattern += `, with ${ends} ending${ends === 1 ? '' : 's'} off it`;
    if (loops) s.pattern += ', with a loop';
  });
  return { kind: 'shape', segs, spine };
}

/* ---------------------------------------------------------------------------
   Simulated players
   --------------------------------------------------------------------------- */

/**
 * Plays the story `opts.runs` times (default 2,000) with the game's own rules (klVisibleChoices, klChoose,
 * klArrive). Seeded, so the same story and settings always give the same numbers and nothing flickers.
 * opts.mode: how each simulated player picks among the choices they can see:
 *   'random'  any of them, equally likely
 *   'first'   always the first one listed (the author's "main line")
 *   'curious' a choice leading somewhere they have not been yet, if there is one
 * opts.as: {givenId: answerId} to make every player give those answers (others are picked at random).
 * Each run is kept (its pages in order, as numbers, and how it ended), so a choice or page can be followed:
 * see playtestFilter. "stuck" covers dead ends, unfinished choices, and players still wandering after 400 moves.
 * Returns { runs, ids, paths, results, ends, visits, moves, through, outcome }.
 */
function playtest(project, opts = {}) {
  const runs = opts.runs || 2000,
    mode = opts.mode || 'random',
    as = opts.as || {};
  const byId = {},
    index = {};
  project.passages.forEach((p, i) => {
    byId[p.id] = p;
    index[p.id] = i;
  });
  const ids = project.passages.map(p => p.id);
  let seed = 0x9e3779b9;
  const rnd = () => {
    // mulberry32: small, fast, good enough for dice
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const paths = [],
    results = [],
    ends = [];
  const st = klStatMap(project.items);
  /* pacing: what each simulated reader reads (words), how many pages they press through with only one choice in a row, dice rolled */
  const words = [],
    stretch = [],
    rolled = [];
  const countWords = b => {
    const m = String(b.text || '').match(/\S+/g);
    return m ? m.length : 0;
  };
  /* Worked out once per page instead of once per step (a simulated player steps up to 400 times, 2,000 times over). Every shortcut
     below gives exactly what calling the game's rule would, and only applies when that is certain:
       usable  the page's choices that lead somewhere (the game's rules are then asked only about the choices with conditions)
       plain   no choice has a condition, so `usable` is what every player sees, whatever they hold
       steady  no paragraph has a condition, so every player reads the same words (`wordsAll`)
       quiet   arriving changes nothing (nothing given, taken, or counted), so the player holds exactly what they held before
     (klArrive also drops numbers equal to 0; no rule can tell a 0 from a missing number, so skipping it changes no result.) */
  const info = project.passages.map(p => {
    const usable = (p.choices || []).filter(c => byId[c.to] && (!c.check || byId[c.check.fail]));
    const blocks = p.blocks || [];
    const steady = !blocks.some(b => (b.needs && b.needs.length) || (b.forbid && b.forbid.length) || b.orPrev);
    return {
      usable,
      plain: !(p.choices || []).some(c => (c.needs && c.needs.length) || (c.forbid && c.forbid.length)),
      steady,
      wordsAll: steady ? blocks.reduce((n, b) => n + countWords(b), 0) : 0,
      quiet: !(p.gives && p.gives.length) && !(p.takes && p.takes.length) && !(p.adds && Object.keys(p.adds).length)
    };
  });
  const curious = mode === 'curious';
  if (byId[project.start])
    for (let r = 0; r < runs; r++) {
      let flags = klInit({}, st);
      (project.givens || []).forEach(g => {
        if (!g.options.length) return;
        flags[g.options.includes(as[g.id]) ? as[g.id] : g.options[Math.floor(rnd() * g.options.length)]] = true;
      });
      let p = byId[project.start];
      flags = klArrive(flags, p, st);
      const path = [index[p.id]],
        seen = curious ? new Set([p.id]) : null;
      let result = 'stuck',
        w = 0,
        run = 0,
        longest = 0,
        dice = 0;
      for (let step = 0; step < 400; step++) {
        const pi = info[path[path.length - 1]];
        if (pi.steady) w += pi.wordsAll;
        else
          klVisibleBlocks(p, flags).forEach(b => {
            w += countWords(b);
          });
        if (p.ending) {
          result = p.valence || 'neutral';
          break;
        }
        const cs = pi.plain ? pi.usable : pi.usable.filter(c => klCondOk(c, flags));
        if (!cs.length) break;
        run = cs.length === 1 ? run + 1 : 0;
        longest = Math.max(longest, run);
        let c;
        if (mode === 'first') c = cs[0];
        else if (curious) {
          const fresh = cs.filter(x => !seen.has(x.to));
          c = (fresh.length ? fresh : cs)[Math.floor(rnd() * (fresh.length || cs.length))];
        } else c = cs[Math.floor(rnd() * cs.length)];
        let roll = 0;
        if (c.check) {
          roll = Math.floor(rnd() * 6) + Math.floor(rnd() * 6) + 2; // two dice, the same as the game
          dice++;
        }
        const dest = byId[klTarget(flags, c, roll)];
        const chosen = klChoose(flags, c, st);
        flags = info[index[dest.id]].quiet ? chosen : klArrive(chosen, dest, st);
        p = dest;
        path.push(index[p.id]);
        if (curious) seen.add(p.id);
      }
      paths.push(Uint16Array.from(path));
      results.push(result);
      ends.push(p.ending ? p.id : '');
      words.push(w);
      stretch.push(longest);
      rolled.push(dice);
    }
  return { runs: paths.length, ids, paths, results, ends, words, stretch, rolled, ...playtestCount({ ids, paths, results }, null) };
}

/**
 * Totals for the runs in `pick` (an array of run numbers; null for every run): how many players saw each page
 * (once per player), how often each move was taken, and how the players who saw a page ended.
 */
function playtestCount(pt, pick) {
  /* Counted by page number, not by name: the strings (names and "from>to" keys) are made once at the end, in the order they were first
     met, so the totals are exactly what counting by name gives, in less time. */
  const n = pt.ids.length;
  const seenIn = new Int32Array(n);
  const visitsN = new Int32Array(n);
  const throughN = new Int32Array(n * 4);
  const firstSeen = [];
  const moveN = new Map();
  const slot = { good: 0, bad: 1, neutral: 2, stuck: 3 };
  const outcome = { good: 0, bad: 0, neutral: 0, stuck: 0 };
  const list = pick || pt.paths.map((_, i) => i);
  let turn = 0;
  for (const r of list) {
    turn++; // counts every entry of the list, so a run named twice is counted twice, as before
    const path = pt.paths[r],
      result = pt.results[r],
      k = slot[result];
    outcome[result]++;
    for (let i = 0; i < path.length; i++) {
      const at = path[i];
      if (i) {
        const key = path[i - 1] * 65536 + at;
        moveN.set(key, (moveN.get(key) || 0) + 1);
      }
      if (seenIn[at] !== turn) {
        seenIn[at] = turn;
        if (!visitsN[at]) firstSeen.push(at);
        visitsN[at]++;
        throughN[at * 4 + k]++;
      }
    }
  }
  const visits = {},
    moves = {},
    through = {};
  for (const at of firstSeen) {
    const id = pt.ids[at];
    visits[id] = visitsN[at];
    through[id] = { good: throughN[at * 4], bad: throughN[at * 4 + 1], neutral: throughN[at * 4 + 2], stuck: throughN[at * 4 + 3] };
  }
  for (const [key, count] of moveN) moves[`${pt.ids[Math.floor(key / 65536)]}>${pt.ids[key % 65536]}`] = count;
  return { visits, moves, through, outcome, count: list.length };
}

/** The runs that saw page `id` (sel.page) or took the move from sel.from to sel.to. */
function playtestFilter(pt, sel) {
  const a = pt.ids.indexOf(sel.page ?? sel.from),
    b = sel.to ? pt.ids.indexOf(sel.to) : -1,
    out = [];
  pt.paths.forEach((path, r) => {
    for (let i = 0; i < path.length; i++) {
      if (path[i] !== a) continue;
      if (b < 0 || path[i + 1] === b) {
        out.push(r);
        break;
      }
    }
  });
  return out;
}

/* ---------------------------------------------------------------------------
   Scoring a drawing
   --------------------------------------------------------------------------- */

/** Do the segments (a,b) and (c,d) cross? */
function mapSegCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * Scores layout `L` (nodes with x, y, w, h; edges with pts) on the qualities that compete in graph drawing.
 * Each score is 0-1, higher is better:
 *   crossings   few arrows cross                         (1 / (1 + crossings per arrow))
 *   neighbors  pages linked by a choice sit near each other (k-nearest-neighbor preservation)
 *   groups      pages reached by the same Given answers (or heading to the same kind of ending) sit together
 *   stability   little moved since the last drawing of this view (the author's mental map)
 *   flow        arrows point the reading way (left to right, or down)
 *   compact     the picture's shape suits a wide screen, with little empty space
 *   speed       how quickly it was drawn
 * `cls` maps page box id -> group name; `prevPos` maps id -> [x, y] from last time.
 */
function mapMetrics(L, ms, cls, prevPos, quick) {
  /* Everything below except "stability" depends only on the drawing itself, and a drawing never changes once built (the map keeps it for
     the next visit), so it is worked out once and kept on L. `quick` is for the toolbar chip, which shows only the crossings, the backward
     arrows and the milliseconds: the nearest-neighbor, group and compactness scores are left for the Compare table. */
  const nodes = L.nodes,
    n = nodes.length;
  const center = nd => [nd.cx ?? nd.x + nd.w / 2, nd.cy ?? nd.y + nd.h / 2];
  const C = (L._centers ||= (() => {
    const c = {};
    nodes.forEach(nd => {
      c[nd.id] = center(nd);
    });
    return c;
  })());
  const memo = (L._metrics ||= {});
  /* crossings: each arrow as a polyline through its waypoints */
  const cross = (memo.cross ??= (() => {
    const segs = [];
    L.edges.forEach((e, ei) => {
      if (e.from === e.to) return;
      const pts = [C[e.from]].concat(e.pts || [], [C[e.to]]);
      for (let i = 0; i + 1 < pts.length; i++) segs.push([pts[i], pts[i + 1], ei]);
    });
    let cr = 0;
    if (L.kind === 'arc') {
      const side = e => (L.pos[e.to].ai > L.pos[e.from].ai ? 1 : -1);
      const iv = L.edges
        .filter(e => e.from !== e.to)
        .map(e => [Math.min(L.pos[e.from].ai, L.pos[e.to].ai), Math.max(L.pos[e.from].ai, L.pos[e.to].ai), side(e)]);
      for (let i = 0; i < iv.length; i++)
        for (let j = i + 1; j < iv.length; j++) {
          const [a, b, s] = iv[i],
            [c, d, t] = iv[j];
          if (s === t && ((a < c && c < b && b < d) || (c < a && a < d && d < b))) cr++;
        }
    } else if (L.kind === 'matrix') cr = 0;
    else if (segs.length <= 4000) {
      /* WebAssembly counts them when it can (checkwalk.js): the same arithmetic, and it does not have to warm up first */
      const fast = typeof klCrossWasm === 'function' ? klCrossWasm(segs) : null;
      if (fast !== null) cr = fast;
      else {
        /* two segments whose bounding boxes do not overlap cannot cross, so most pairs are dismissed with four comparisons */
        const box = segs.map(s => [Math.min(s[0][0], s[1][0]), Math.max(s[0][0], s[1][0]), Math.min(s[0][1], s[1][1]), Math.max(s[0][1], s[1][1])]);
        for (let i = 0; i < segs.length; i++) {
          const bi = box[i];
          for (let j = i + 1; j < segs.length; j++) {
            const bj = box[j];
            if (bi[1] < bj[0] || bj[1] < bi[0] || bi[3] < bj[2] || bj[3] < bi[2]) continue;
            if (segs[i][2] === segs[j][2]) continue;
            if (mapSegCross(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) cr++;
          }
        }
      }
    } else cr = L.crossings ?? 0;
    return cr;
  })());
  const ne = Math.max(1, L.edges.length);
  /* flow: arrows that go the reading way */
  const flow = (memo.flow ??= (() => {
    let f = 0,
      t = 0;
    L.edges.forEach(e => {
      if (e.from === e.to) return;
      const a = C[e.from],
        b = C[e.to],
        d = L.dir === 'TB' ? b[1] - a[1] : b[0] - a[0];
      t++;
      if (d > 0) f++;
    });
    return { fwd: f, fl: t };
  })());
  const { fwd, fl } = flow;
  if (quick) return { scores: null, raw: { crossings: cross, moved: 0, ms, backward: fl - fwd, edges: L.edges.length } };
  const dist = (a, b) => Math.hypot(C[a][0] - C[b][0], C[a][1] - C[b][1]);
  /* neighborhood preservation: of each page's k nearest boxes (k = how many pages it links with), how many it links with */
  const nb = (memo.nb ??= (() => {
    const adj = {};
    L.edges.forEach(e => {
      if (e.from !== e.to) {
        (adj[e.from] ||= new Set()).add(e.to);
        (adj[e.to] ||= new Set()).add(e.from);
      }
    });
    let np = 0,
      npn = 0;
    if (n > 1 && n <= 600)
      nodes.forEach(nd => {
        const k = adj[nd.id]?.size || 0;
        if (!k) return;
        /* the k nearest other boxes, nearest first and, among equal distances, in page order: the same k that sorting all of them and
           taking the first k gives, found by keeping a short sorted list instead of sorting everything */
        const near = [];
        for (const o of nodes) {
          if (o === nd) continue;
          const d = dist(nd.id, o.id);
          if (near.length === k && d >= near[k - 1][0]) continue;
          let at = near.length;
          while (at > 0 && near[at - 1][0] > d) at--;
          near.splice(at, 0, [d, o]);
          if (near.length > k) near.pop();
        }
        np += near.filter(x => adj[nd.id].has(x[1].id)).length / k;
        npn++;
      });
    return { np, npn };
  })());
  /* group separation: share of pages whose nearest box is in the same group */
  const gr = (memo.gr ??= (() => {
    let gs = 0,
      gsn = 0;
    if (cls && n > 1 && n <= 600)
      nodes.forEach(nd => {
        if (!cls[nd.id]) return;
        let best = null,
          bd = Infinity;
        nodes.forEach(o => {
          if (o !== nd && cls[o.id]) {
            const d = dist(nd.id, o.id);
            if (d < bd) {
              bd = d;
              best = o;
            }
          }
        });
        if (best) {
          gs += cls[best.id] === cls[nd.id] ? 1 : 0;
          gsn++;
        }
      });
    return { gs, gsn };
  })());
  const { np, npn } = nb,
    { gs, gsn } = gr;
  /* stability: mean distance moved since last time, compared with a box width */
  let mv = 0,
    mvn = 0;
  if (prevPos)
    nodes.forEach(nd => {
      const p = prevPos[nd.id];
      if (p) {
        mv += Math.hypot(C[nd.id][0] - p[0], C[nd.id][1] - p[1]);
        mvn++;
      }
    });
  /* compact: closeness to a 16:10 picture, times how much of it the boxes fill */
  const W = L.width || 1,
    H = L.height || 1,
    r = W / H,
    target = 1.6;
  let area = 0;
  nodes.forEach(nd => {
    area += (nd.w || 12) * (nd.h || 12);
  });
  const fill = Math.min(1, (area / (W * H)) * 4);
  const grid = L.kind === 'matrix'; // a matrix has no arrows to cross and no reading direction to follow
  const s = {
    crossings: grid ? null : 1 / (1 + cross / ne),
    neighbors: npn ? np / npn : 1,
    groups: gsn ? gs / gsn : null,
    stability: mvn ? Math.max(0, 1 - mv / mvn / MAP_W) : null,
    flow: grid ? null : fl ? fwd / fl : 1,
    compact: (Math.min(r, target) / Math.max(r, target)) * 0.5 + fill * 0.5,
    speed: 1 / (1 + ms / 60)
  };
  return { scores: s, raw: { crossings: cross, moved: mvn ? mv / mvn : 0, ms, backward: fl - fwd, edges: L.edges.length } };
}

/** How much each quality counts for each task (they add up to 1). */
const MAP_TASKS = {
  edit: { label: 'Editing the structure', w: { crossings: 0.3, neighbors: 0.2, stability: 0.2, flow: 0.15, compact: 0.1, speed: 0.05 } },
  beats: { label: 'Studying story beats', w: { flow: 0.3, crossings: 0.25, compact: 0.2, neighbors: 0.1, stability: 0.1, speed: 0.05 } },
  vars: { label: 'Following variables', w: { groups: 0.35, crossings: 0.2, neighbors: 0.2, stability: 0.15, speed: 0.1 } }
};
/** One number for a task: the weighted mean of the scores that apply (a missing score's weight is shared out). */
function mapTaskScore(scores, task) {
  let s = 0,
    w = 0;
  for (const [k, wk] of Object.entries(MAP_TASKS[task].w))
    if (scores[k] !== null && scores[k] !== undefined) {
      s += scores[k] * wk;
      w += wk;
    }
  return w ? s / w : 0;
}
