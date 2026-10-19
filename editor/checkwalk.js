/* ============================================================================
   CHECKWALK: the checker's exploring loop (wasm/checkwalk.c) and its move-graph passes (wasm/checkgraph.c) as WebAssembly. core.js analyzeRun
   asks klWalkWasm for the walk and klGraphWasm for the graph passes, and uses the JavaScript code when they answer null (no WebAssembly, a page rule that refuses it, a story with more than 30 tracked bits, or anything
   unexpected). They give exactly the answers of the JavaScript code: wasm-equiv.mjs proves that on random stories.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */

/* the module, base64; written between the markers by wasm/embed.py from wasm/checkwalk.wasm */
const KL_WALK_B64 = /*WASM:BEGIN*/ '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' /*WASM:END*/;

/* the graph module, base64; written between the markers by wasm/embed.py from wasm/checkgraph.wasm */
const KL_GRAPH_B64 = /*GRAPH:BEGIN*/ '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' /*GRAPH:END*/;

let klGraphMod; // undefined: not tried yet; null: not usable; else { ex, mem, heap }

function klGraphInit() {
  if (klGraphMod !== undefined) return klGraphMod;
  klGraphMod = null;
  try {
    if (typeof WebAssembly !== 'object' || !KL_GRAPH_B64) return null;
    const txt = atob(KL_GRAPH_B64);
    const bytes = new Uint8Array(txt.length);
    for (let i = 0; i < txt.length; i++) bytes[i] = txt.charCodeAt(i);
    const mem = new WebAssembly.Memory({ initial: 16 });
    const inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), { env: { memory: mem } });
    const hb = inst.exports.__heap_base;
    klGraphMod = { ex: inst.exports, mem, heap: ((hb.value === undefined ? hb : hb.value) + 15) & ~15 };
  } catch (e) {
    klGraphMod = null;
  }
  return klGraphMod;
}

/**
 * The move graph's two questions in WebAssembly. `edges` holds pairs (from, to) of situation numbers 0 .. n - 1. Returns null when it cannot
 * (no WebAssembly, or anything unexpected), else { canReach(targets): Uint8Array, firstCuts(jobs): array }, with the answers of the
 * JavaScript versions in core.js, or null from either when it fails halfway. The Uint8Array is only good until the next call. firstCuts takes up to 32 jobs { good, hidden } and gives,
 * for each, the first of `hidden` that cannot reach any of `good`, or undefined.
 */
function klGraphWasm(edges, n) {
  const M = klGraphInit();
  if (!M || !(n > 0)) return null;
  try {
    const nE = edges.length >> 1;
    const reg = {};
    let bytes = 0;
    const take = (name, count, size) => {
      bytes = (bytes + 7) & ~7;
      reg[name] = bytes;
      bytes += count * size;
    };
    take('edges', nE * 2, 4);
    take('off', n + 1, 4);
    take('fill', n, 4);
    take('rev', nE, 4);
    take('queue', n, 4);
    take('label', n, 4);
    take('inq', n, 1);
    take('ok', n, 1);
    take('tail', 0, 1); // the questions of a call go after this
    const base = M.heap;
    const room = need => {
      if (base + need > 1 << 30) throw new Error('too big');
      const have = M.mem.buffer.byteLength;
      if (base + need > have) M.mem.grow(Math.ceil((base + need - have) / 65536));
    };
    room(bytes + 64);
    const P = name => base + reg[name];
    const e = new Int32Array(M.mem.buffer, P('edges'), nE * 2);
    if (edges.subarray) e.set(edges.subarray(0, nE * 2));
    else for (let i = 0; i < nE * 2; i++) e[i] = edges[i];
    const ex = M.ex;
    ex.init(n, nE, P('edges'), P('off'), P('fill'), P('rev'), P('queue'), P('label'), P('inq'), P('ok'));
    const canReach = targets => {
      const list = Array.isArray(targets) ? targets : Array.from(targets);
      const nt = list.length;
      room(bytes + nt * 4 + 64);
      const qa = new Int32Array(M.mem.buffer, P('tail'), nt);
      for (let k = 0; k < nt; k++) qa[k] = list[k];
      ex.canReach(P('tail'), nt);
      return new Uint8Array(M.mem.buffer, P('ok'), n);
    };
    const firstCuts = jobs => {
      const nq = jobs.length;
      let total = 0;
      for (const j of jobs) total += j.good.length + j.hidden.length;
      room(bytes + (total + 3 * nq) * 4 + 64);
      const buf = M.mem.buffer;
      const toLens = new Int32Array(buf, P('tail'), nq),
        fromLens = new Int32Array(buf, P('tail') + nq * 4, nq),
        res = new Int32Array(buf, P('tail') + nq * 8, nq),
        lists = new Int32Array(buf, P('tail') + nq * 12, total);
      let k = 0;
      const toAt = P('tail') + nq * 12;
      jobs.forEach((j, q) => {
        toLens[q] = j.good.length;
        for (const t of j.good) lists[k++] = t;
      });
      const fromAt = toAt + k * 4;
      jobs.forEach((j, q) => {
        fromLens[q] = j.hidden.length;
        for (const f of j.hidden) lists[k++] = f;
      });
      ex.firstCuts(nq, P('tail'), toAt, P('tail') + nq * 4, fromAt, P('tail') + nq * 8);
      return jobs.map((j, q) => (res[q] < 0 ? undefined : j.hidden[res[q]]));
    };
    /* an answer of null means "could not": the caller then uses the JavaScript version */
    const safe = f => x => {
      try {
        return f(x);
      } catch (err) {
        return null;
      }
    };
    return { canReach: safe(canReach), firstCuts: safe(firstCuts) };
  } catch (err) {
    return null;
  }
}

let klWalkMod; // undefined: not tried yet; null: not usable; else { ex, mem, heap }

function klWalkInit() {
  if (klWalkMod !== undefined) return klWalkMod;
  klWalkMod = null;
  try {
    if (typeof WebAssembly !== 'object' || !KL_WALK_B64) return null;
    const txt = atob(KL_WALK_B64);
    const bytes = new Uint8Array(txt.length);
    for (let i = 0; i < txt.length; i++) bytes[i] = txt.charCodeAt(i);
    const mem = new WebAssembly.Memory({ initial: 32 });
    const inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), { env: { memory: mem } });
    const hb = inst.exports.__heap_base;
    klWalkMod = { walk: inst.exports.walk, mem, heap: ((hb.value === undefined ? hb : hb.value) + 15) & ~15 };
  } catch (e) {
    klWalkMod = null;
  }
  return klWalkMod;
}

/**
 * Runs the walk in WebAssembly for the compiled story `a` ({ order, pre, fields, bitOf, pIndex, s0, starts: [flags before arriving, flags after],
 * deadAt (per page, the numbers forgotten there, or null), limit, edgeCap }). Returns null when it cannot, else the same tables the
 * JavaScript loop builds, as typed arrays, plus fill(), which puts the bookkeeping into the sets and maps analyzeRun uses.
 */
function klWalkWasm(a) {
  const M = klWalkInit();
  if (!M) return null;
  try {
    return klWalkRun(M, a);
  } catch (e) {
    return null;
  }
}

function klWalkRun(M, a) {
  const { order, pre, fields, bitOf, limit, edgeCap, starts } = a;
  const np = order.length;
  if (!(limit <= 1500000) || np === 0) return null;
  const fidx = new Map();
  fields.forEach((f, i) => fidx.set(f, i));
  const pool = [];
  /* fields: five values each (shift, mask, lowest value, groups, offset of the first-value table) */
  const fbase = 0;
  pool.length = fields.length * 5;
  fields.forEach((f, i) => {
    const off = pool.length;
    for (const v of f.first) pool.push(v);
    pool[fbase + i * 5] = f.sh;
    pool[fbase + i * 5 + 1] = f.m;
    pool[fbase + i * 5 + 2] = f.lo;
    pool[fbase + i * 5 + 3] = f.first.length;
    pool[fbase + i * 5 + 4] = off;
  });
  const keyIds = new Map();
  let maxFan = 1;
  let nBlockSlots = 0,
    nChoiceSlots = 0,
    nPickSlots = 0,
    nArrSlots = 0;
  const blockKey = [],
    choiceKey = [],
    pickKey = [],
    arrKey = [];
  const putCond = c => {
    pool.push(c.n, c.f, c.tn.length);
    for (const t of c.tn) pool.push(fidx.get(t.f), t.min);
    pool.push(c.tf.length);
    for (const t of c.tf) pool.push(fidx.get(t.f), t.min);
  };
  const tables = []; // [position to patch, values]
  const putAddsList = list => {
    pool.push(list.length);
    for (const ad of list) {
      pool.push(fidx.get(ad.f), -1);
      tables.push([pool.length - 1, ad.to]);
    }
  };
  const pageOff = new Array(np),
    view = new Array(np * 6);
  for (let pi = 0; pi < np; pi++) {
    const r = pre[pi],
      p = order[pi];
    if (p.choices.length > 60) return null; // the duplicate-label check keeps 64 labels per situation
    maxFan = Math.max(maxFan, p.choices.length * 2);
    pageOff[pi] = pool.length;
    pool.push(p.ending ? 1 : 0, r.giveClear, r.sends.length);
    for (const s of r.sends) pool.push(s.item, s.clear, s.set);
    pool.push(r.gives, r.takes);
    putAddsList(r.adds);
    pool.push(r.blocks.length);
    const blocksOff = pool.length;
    r.blocks.forEach((b, bi) => {
      putCond(b);
      pool.push(b.or ? 1 : 0, nBlockSlots++);
      blockKey.push(`${pi}:${bi}`);
    });
    pool.push(r.choices.length);
    const choicesOff = pool.length;
    r.choices.forEach((c, ci) => {
      if (c.ck && !c.ck.f) throw new Error('number missing');
      putCond(c);
      let key = 0;
      if (c.key) {
        if (!keyIds.has(c.key)) keyIds.set(c.key, keyIds.size + 1);
        key = keyIds.get(c.key);
      }
      pool.push(
        c.to === undefined ? -1 : c.to,
        c.fail === undefined ? -1 : c.fail,
        c.ck ? fidx.get(c.ck.f) : -1,
        c.ck ? c.ck.target : 0,
        key,
        c.g,
        c.t,
        c.clear,
        nChoiceSlots++
      );
      choiceKey.push(`${pi}:${ci}`);
      putAddsList(c.adds);
      const takes = p.choices[ci].takes.filter(id => bitOf[id] !== undefined);
      pool.push(takes.length);
      for (const id of takes) {
        pool.push(bitOf[id], nPickSlots++);
        pickKey.push(`${pi}:${ci}:${id}`);
      }
    });
    const arrOff = pool.length;
    const arrIds = [...new Set(p.gives.concat(p.takes))].filter(id => bitOf[id] !== undefined);
    pool.push(arrIds.length);
    for (const id of arrIds) {
      pool.push(bitOf[id], nArrSlots++);
      arrKey.push(`${pi}:${id}`);
    }
    view.splice(pi * 6, 6, p.ending ? 1 : 0, blocksOff, r.blocks.length, choicesOff, r.choices.length, arrOff);
  }
  for (const [at, vals] of tables) {
    pool[at] = pool.length;
    for (const v of vals) pool.push(v);
  }
  /* sizes */
  const sitCap = limit + 512 + maxFan + 16;
  let hashSize = 1024;
  while (hashSize < sitCap * 2) hashSize *= 2;
  const edgeMax = 4 * Math.min(sitCap, edgeCap + maxFan) + 1024;
  const nStart = starts.length;
  let bytes = 0;
  const reg = {};
  const take = (name, n, size) => {
    bytes = (bytes + 7) & ~7;
    reg[name] = bytes;
    bytes += n * size;
  };
  take('ctrl', 64, 4);
  take('tables', pool.length, 4);
  take('pageOff', np, 4);
  take('view', np * 6, 4);
  take('dead', np, 4);
  take('startPre', nStart, 4);
  take('startPost', nStart, 4);
  take('startOut', nStart, 4);
  take('sPage', sitCap, 4);
  take('sFlags', sitCap, 4);
  take('sFrom', sitCap, 4);
  take('sStep', sitCap, 4);
  take('hash', hashSize, 4);
  take('edges', edgeMax * 2, 4);
  take('reached', np, 1);
  take('okBlock', nBlockSlots, 1);
  take('shownBlock', nBlockSlots, 1);
  take('shownChoice', nChoiceSlots, 1);
  take('rolled', nChoiceSlots, 1);
  take('heldPick', nPickSlots, 1);
  take('arrSeen', np, 1);
  take('arrEver', nArrSlots, 1);
  take('arrAlways', nArrSlots, 1);
  take('endAt', np, 4);
  take('endCount', np, 4);
  take('dupes', np, 4);
  take('dupCi', np, 4);
  take('soft', np, 4);
  take('exits', sitCap, 1);
  const base = M.heap;
  const need = base + bytes + 64;
  if (need > 1 << 30) return null;
  const have = M.mem.buffer.byteLength;
  if (need > have) M.mem.grow(Math.ceil((need - have) / 65536));
  const buf = M.mem.buffer;
  const I = (name, n) => new Int32Array(buf, base + reg[name], n);
  const B = (name, n) => new Uint8Array(buf, base + reg[name], n);
  I('tables', pool.length).set(pool);
  I('pageOff', np).set(pageOff);
  I('view', np * 6).set(view);
  const dead = I('dead', np);
  dead.fill(0);
  if (a.deadAt)
    a.deadAt.forEach((list, pi) => {
      for (const f of list || []) dead[pi] |= f.m << f.sh;
    });
  I('startPre', nStart).set(starts.map(x => x[0]));
  I('startPost', nStart).set(starts.map(x => x[1]));
  B('reached', np).fill(0);
  B('okBlock', nBlockSlots).fill(0);
  B('shownBlock', nBlockSlots).fill(0);
  B('shownChoice', nChoiceSlots).fill(0);
  B('rolled', nChoiceSlots).fill(0);
  B('heldPick', nPickSlots).fill(0);
  B('arrSeen', np).fill(0);
  B('arrEver', nArrSlots).fill(0);
  B('arrAlways', nArrSlots).fill(1);
  I('endAt', np).fill(-1);
  I('endCount', np).fill(0);
  I('dupes', np).fill(-1);
  I('dupCi', np).fill(0);
  I('soft', np).fill(-1);
  B('exits', sitCap).fill(0);
  const ctrl = I('ctrl', 64);
  ctrl.fill(0);
  const P = n => base + reg[n];
  const names = ['LIMIT', 'EDGECAP', 'NPAGES', 'PAGEOFF', 'FIELDS', 'POOL', 'SPAN_UNUSED', 'SPAGE', 'SFLAGS', 'SFROM', 'SSTEP', 'HASH', 'HASHMASK', 'SITCAP', 'EDGES', 'EDGEMAX', 'NSTART', 'STARTPRE', 'STARTPOST', 'STARTOUT', 'VIEW', 'REACHED', 'OKBLOCK', 'SHOWNBLOCK', 'SHOWNCHOICE', 'ROLLED', 'HELDPICK', 'ARRSEEN', 'ARREVER', 'ARRALWAYS', 'ENDAT', 'ENDCOUNT', 'DUPES', 'DUPCI', 'SOFT', 'EXITS', 'DEADMASK', 'OUT_COUNT', 'OUT_EDGES', 'OUT_EDGESON', 'OUT_TRUNC', 'OUT_EVER', 'OUT_STATUS'];
  const C = Object.create(null);
  names.forEach((n, i) => (C[n] = i));
  ctrl[C.LIMIT] = limit;
  ctrl[C.EDGECAP] = edgeCap;
  ctrl[C.NPAGES] = np;
  ctrl[C.PAGEOFF] = P('pageOff');
  ctrl[C.FIELDS] = 0;
  ctrl[C.SPAGE] = P('sPage');
  ctrl[C.SFLAGS] = P('sFlags');
  ctrl[C.SFROM] = P('sFrom');
  ctrl[C.SSTEP] = P('sStep');
  ctrl[C.HASH] = P('hash');
  ctrl[C.HASHMASK] = hashSize - 1;
  ctrl[C.SITCAP] = sitCap;
  ctrl[C.EDGES] = P('edges');
  ctrl[C.EDGEMAX] = edgeMax;
  ctrl[C.NSTART] = nStart;
  ctrl[C.STARTPRE] = P('startPre');
  ctrl[C.STARTPOST] = P('startPost');
  ctrl[C.STARTOUT] = P('startOut');
  ctrl[C.VIEW] = P('view');
  ctrl[C.REACHED] = P('reached');
  ctrl[C.OKBLOCK] = P('okBlock');
  ctrl[C.SHOWNBLOCK] = P('shownBlock');
  ctrl[C.SHOWNCHOICE] = P('shownChoice');
  ctrl[C.ROLLED] = P('rolled');
  ctrl[C.HELDPICK] = P('heldPick');
  ctrl[C.ARRSEEN] = P('arrSeen');
  ctrl[C.ARREVER] = P('arrEver');
  ctrl[C.ARRALWAYS] = P('arrAlways');
  ctrl[C.ENDAT] = P('endAt');
  ctrl[C.ENDCOUNT] = P('endCount');
  ctrl[C.DUPES] = P('dupes');
  ctrl[C.DUPCI] = P('dupCi');
  ctrl[C.SOFT] = P('soft');
  ctrl[C.EXITS] = P('exits');
  ctrl[C.DEADMASK] = P('dead');
  ctrl[C.OUT_STATUS] = a.s0; // on the way in: the starting page
  const status = M.walk(P('ctrl'), P('tables'));
  if (status !== 0) return null;
  const count = ctrl[C.OUT_COUNT];
  const out = {
    sPage: I('sPage', count).slice(),
    sFlags: I('sFlags', count).slice(),
    sFrom: I('sFrom', count).slice(),
    stepCode: I('sStep', count).slice(),
    edges: ctrl[C.OUT_EDGESON] ? I('edges', ctrl[C.OUT_EDGES] * 2).slice() : null,
    truncated: !!ctrl[C.OUT_TRUNC],
    ever: ctrl[C.OUT_EVER],
    startOut: I('startOut', nStart).slice()
  };
  const exitBytes = B('exits', count);
  const exitList = [];
  for (let s = 0; s < count; s++) if (exitBytes[s]) exitList.push(s);
  out.exits = exitList;
  const reached = B('reached', np).slice(),
    okB = B('okBlock', nBlockSlots).slice(),
    shB = B('shownBlock', nBlockSlots).slice(),
    shC = B('shownChoice', nChoiceSlots).slice(),
    rolled = B('rolled', nChoiceSlots).slice(),
    held = B('heldPick', nPickSlots).slice(),
    arrSeen = B('arrSeen', np).slice(),
    arrEver = B('arrEver', nArrSlots).slice(),
    arrAlways = B('arrAlways', nArrSlots).slice(),
    endAt = I('endAt', np).slice(),
    endCount = I('endCount', np).slice(),
    dupes = I('dupes', np).slice(),
    dupCi = I('dupCi', np).slice(),
    soft = I('soft', np).slice();
  /** One step of the way to situation s: [label, page id, choice index] (a fourth entry true for a failed roll). */
  out.step = s => {
    const code = out.stepCode[s],
      ci = code & 0x3fffffff,
      from = out.sFrom[s];
    const c = order[out.sPage[from]].choices[ci];
    const label = c.label || '(unnamed choice)';
    return code & 0x40000000 ? [`${label} (fails the roll)`, order[out.sPage[s]].id, ci, true] : [label, order[out.sPage[s]].id, ci];
  };
  let seenSet = null;
  out.has = (pi, fl) => {
    if (!seenSet) {
      seenSet = new Set();
      for (let s = 0; s < count; s++) seenSet.add(out.sPage[s] * 1073741824 + out.sFlags[s]);
    }
    return seenSet.has(pi * 1073741824 + fl);
  };
  /** Puts the bookkeeping into the sets and maps analyzeRun reads afterwards, in the order the JavaScript loop would have made them. */
  out.fill = t => {
    for (let pi = 0; pi < np; pi++) if (reached[pi]) t.reachedPage.add(pi);
    blockKey.forEach((k, i) => {
      if (okB[i]) t.okBlock.add(k);
      if (shB[i]) t.shownBlock.add(k);
    });
    choiceKey.forEach((k, i) => {
      if (shC[i]) t.shownChoice.add(k);
      if (rolled[i]) t.rolled.set(k, rolled[i]);
    });
    pickKey.forEach((k, i) => t.heldOnPick.set(k, !!held[i]));
    arrKey.forEach((k, i) => {
      if (arrSeen[+k.slice(0, k.indexOf(':'))]) t.heldOnArrival.set(k, [!!arrEver[i], !!arrAlways[i]]);
    });
    const byFirst = (arr, fn) =>
      Array.from(arr.keys())
        .filter(pi => arr[pi] >= 0)
        .sort((x, y) => arr[x] - arr[y])
        .forEach(fn);
    byFirst(endAt, pi => {
      t.endingAt.set(pi, endAt[pi]);
      t.endingCount.set(pi, endCount[pi]);
    });
    byFirst(soft, pi => t.softlocks.set(pi, out.sFlags[soft[pi]]));
    byFirst(dupes, pi => t.dupes.set(pi, order[pi].choices[dupCi[pi]].label));
  };
  return out;
}
