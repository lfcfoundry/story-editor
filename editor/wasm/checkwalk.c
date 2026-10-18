/* checkwalk.c: the Story Editor checker's exploring loop (analyzeRun in core.js, "the walk") as WebAssembly.
   It explores every situation (page + items + number groups) a player can reach, breadth first, exactly as the JavaScript loop does, and
   fills flat tables that the JavaScript turns back into the same sets and maps. Only stories whose tracked items fit in 30 bits come here.
   Copyright (c) 2026 LFC Foundry. MIT License.
   Build: wasm/build.sh.  The tables it reads are written by klWalkWasm in checkwalk.js; both sides must agree on the layout below. */

typedef int i32;
typedef unsigned int u32;
typedef unsigned long long u64;

/* ---- control block: i32 values, written by JavaScript (indices are the C_* names) ---- */
enum {
  C_LIMIT, C_EDGECAP, C_NPAGES, C_PAGEOFF, C_FIELDS, C_POOL, C_SPAN_UNUSED,
  C_SPAGE, C_SFLAGS, C_SFROM, C_SSTEP, C_HASH, C_HASHMASK, C_SITCAP,
  C_EDGES, C_EDGEMAX,
  C_NSTART, C_STARTPRE, C_STARTPOST, C_STARTOUT,
  C_VIEW, C_REACHED, C_OKBLOCK, C_SHOWNBLOCK, C_SHOWNCHOICE, C_ROLLED, C_HELDPICK, C_ARRSEEN, C_ARREVER, C_ARRALWAYS,
  C_ENDAT, C_ENDCOUNT, C_DUPES, C_DUPCI, C_SOFT, C_EXITS, C_DEADMASK,
  C_OUT_COUNT, C_OUT_EDGES, C_OUT_EDGESON, C_OUT_TRUNC, C_OUT_EVER, C_OUT_STATUS
};

static i32 *K;   /* control block */
static i32 *pool;

#define F(n) (K[n])
#define PTR(n) ((i32 *)(unsigned long)(K[n]))
#define BPTR(n) ((unsigned char *)(unsigned long)(K[n]))

/* field record in the pool: sh, mask, lo, ngroups, firstOff  (5 values) */
static inline i32 fv(i32 fl, i32 *f) { return (i32)(((u32)fl >> f[0]) & (u32)f[1]); }

/* a condition: n, f, ntn, (field,min)*ntn, ntf, (field,min)*ntf ; returns the offset after it */
static inline i32 *fieldRec(i32 idx) { return pool + K[C_FIELDS] + idx * 5; }
static inline i32 okc(i32 fl, i32 *c, i32 **after) {
  i32 n = c[0], f = c[1], ntn = c[2], i;
  i32 *p = c + 3;
  i32 ok = ((fl & n) == n) && ((fl & f) == 0);
  for (i = 0; i < ntn; i++, p += 2) {
    i32 *fr = fieldRec(p[0]);
    if (ok && pool[fr[4] + fv(fl, fr)] < p[1]) ok = 0;
  }
  i32 ntf = *p++;
  for (i = 0; i < ntf; i++, p += 2) {
    i32 *fr = fieldRec(p[0]);
    if (ok && pool[fr[4] + fv(fl, fr)] >= p[1]) ok = 0;
  }
  *after = p;
  return ok;
}

/* number changes: count, (field, toOff)* ; toOff points at ngroups values */
static inline i32 addTo(i32 fl, i32 *p, i32 **after) {
  i32 n = *p++, i;
  for (i = 0; i < n; i++, p += 2) {
    i32 *fr = fieldRec(p[0]);
    i32 g = fv(fl, fr);
    i32 v = pool[p[1] + g];
    fl = (fl & ~(fr[1] << fr[0])) | (v << fr[0]);
  }
  *after = p;
  return fl;
}

/* page record: ending, giveClear, nSends,(item,clear,set)*, gives, takes, adds..., nBlocks, blocks..., nChoices, choices..., nArr, arrbits..., deadSlot */
/* We keep per-page parsed offsets by walking the record each time it is used; records are short. */

static inline u32 hashOf(i32 pi, i32 fl) {
  u64 x = ((u64)(u32)pi << 32) | (u32)fl;
  x ^= x >> 33; x *= 0xff51afd7ed558ccdULL; x ^= x >> 33; x *= 0xc4ceb9fe1a85ec53ULL; x ^= x >> 33;
  return (u32)x;
}

static i32 nSit;
static i32 edgesOn;
static i32 nEdges;
static i32 status;

/* find (pi, fl) in the hash; returns situation number or -1 */
static i32 findSit(i32 pi, i32 fl) {
  i32 *hash = PTR(C_HASH), *sPage = PTR(C_SPAGE), *sFlags = PTR(C_SFLAGS);
  u32 mask = (u32)K[C_HASHMASK], h = hashOf(pi, fl) & mask;
  for (;;) {
    i32 s = hash[h];
    if (s < 0) return -1;
    if (sPage[s] == pi && sFlags[s] == fl) return s;
    h = (h + 1) & mask;
  }
}

/* klArrive in bit form on the page record at `rec` (after the ending flag) */
static i32 arrive(i32 pi, i32 fl) {
  i32 *r = pool + PTR(C_PAGEOFF)[pi];
  i32 giveClear = r[1], nSends = r[2], i;
  i32 *p = r + 3;
  i32 n = fl & ~giveClear;
  for (i = 0; i < nSends; i++, p += 3)
    if (fl & p[0]) n = (n & ~p[1]) | p[2];
  i32 gives = p[0], takes = p[1];
  n = (n | gives) & ~takes;
  p += 2;
  i32 *after;
  return addTo(n, p, &after);
}

static i32 visit(i32 pi, i32 fl, i32 from, i32 step) {
  i32 dm = PTR(C_DEADMASK)[pi];
  fl &= ~dm;
  i32 s = findSit(pi, fl);
  if (s >= 0) return s;
  if (nSit >= K[C_SITCAP]) { status = -1; return 0; }
  s = nSit++;
  i32 *hash = PTR(C_HASH);
  u32 mask = (u32)K[C_HASHMASK], h = hashOf(pi, fl) & mask;
  while (hash[h] >= 0) h = (h + 1) & mask;
  hash[h] = s;
  PTR(C_SPAGE)[s] = pi; PTR(C_SFLAGS)[s] = fl; PTR(C_SFROM)[s] = from; PTR(C_SSTEP)[s] = step;
  return s;
}

/* the arrival slots of page pi: nArr then (bit, slot) pairs; found after the choices */
static void noteArrival(i32 pi, i32 fl, i32 *arr) {
  unsigned char *seen = BPTR(C_ARRSEEN), *ever = BPTR(C_ARREVER), *always = BPTR(C_ARRALWAYS);
  i32 n = arr[0], i;
  seen[pi] = 1;
  for (i = 0; i < n; i++) {
    i32 h = (fl & arr[1 + 2 * i]) != 0, slot = arr[2 + 2 * i];
    ever[slot] |= h;
    always[slot] &= h;
  }
}

/* the parsed shape of a page record, written by JavaScript: ending, blocksOff, nBlocks, choicesOff, nChoices, arrOff */
typedef struct { i32 ending; i32 *blocks; i32 nBlocks; i32 *choices; i32 nChoices; i32 *arr; } PageView;
static inline void pageView(i32 pi, PageView *v) {
  i32 *w = PTR(C_VIEW) + pi * 6;
  v->ending = w[0]; v->blocks = pool + w[1]; v->nBlocks = w[2]; v->choices = pool + w[3]; v->nChoices = w[4]; v->arr = pool + w[5];
}

i32 walk(i32 *ctrl, i32 *tables) {
  K = ctrl; pool = tables;
  i32 limit = F(C_LIMIT), edgeCap = F(C_EDGECAP), npages = F(C_NPAGES), i;
  i32 *hash = PTR(C_HASH);
  for (i = 0; i <= K[C_HASHMASK]; i++) hash[i] = -1;
  nSit = 0; edgesOn = 1; nEdges = 0; status = 0;
  i32 truncated = 0, ever = 0;
  i32 *edges = PTR(C_EDGES), edgeMax = F(C_EDGEMAX);
  unsigned char *reached = BPTR(C_REACHED), *okBlock = BPTR(C_OKBLOCK), *shownBlock = BPTR(C_SHOWNBLOCK), *shownChoice = BPTR(C_SHOWNCHOICE),
    *rolled = BPTR(C_ROLLED), *heldPick = BPTR(C_HELDPICK), *exits = BPTR(C_EXITS);
  i32 *endAt = PTR(C_ENDAT), *endCount = PTR(C_ENDCOUNT), *dupes = PTR(C_DUPES), *dupCi = PTR(C_DUPCI), *soft = PTR(C_SOFT);
  i32 *sPage = PTR(C_SPAGE), *sFlags = PTR(C_SFLAGS);
  (void)npages;
  /* the starting situations: note the arrival at the first page, then enter it */
  i32 ns = F(C_NSTART);
  i32 *startPre = PTR(C_STARTPRE), *startPost = PTR(C_STARTPOST), *startOut = PTR(C_STARTOUT);
  {
    i32 s0page = K[C_OUT_STATUS];   /* the start page index is passed in OUT_STATUS on the way in */
    PageView pv; pageView(s0page, &pv);
    for (i = 0; i < ns; i++) {
      noteArrival(s0page, startPre[i], pv.arr);
      startOut[i] = visit(s0page, startPost[i], -1, 0);
    }
  }
  for (i32 s = 0; s < nSit; s++) {
    if (status) break;
    if (nSit > limit) { truncated = 1; break; }
    if (edgesOn && nSit > edgeCap) edgesOn = 0;
    i32 pi = sPage[s], fl = sFlags[s];
    PageView pv; pageView(pi, &pv);
    reached[pi] = 1;
    ever |= fl;
    {
      i32 chainDone = 0;
      i32 *p = pv.blocks;
      for (i32 b = 0; b < pv.nBlocks; b++) {
        i32 *after; i32 ok = okc(fl, p, &after);
        i32 or_ = after[0], slot = after[1];
        p = after + 2;
        if (ok) okBlock[slot] = 1;
        i32 show;
        if (or_) { show = !chainDone && ok; if (show) chainDone = 1; }
        else { show = ok; chainDone = ok; }
        if (show) shownBlock[slot] = 1;
      }
    }
    if (pv.ending) {
      if (endAt[pi] < 0) endAt[pi] = s;
      endCount[pi]++;
      exits[s] = 1;
      continue;
    }
    if (pv.nChoices == 0) { exits[s] = 1; continue; }
    i32 anyShown = 0;
    i32 shownKeys[64]; i32 nKeys = 0;   /* labels shown so far in this situation (a page with more than 63 keyed choices keeps checking the first 64) */
    i32 *p = pv.choices;
    for (i32 ci = 0; ci < pv.nChoices; ci++) {
      i32 *after; i32 ok = okc(fl, p, &after);
      i32 to = after[0], fail = after[1], ckField = after[2], ckTarget = after[3], key = after[4], g = after[5], t = after[6], clear = after[7], cslot = after[8];
      i32 *q = after + 9;
      i32 *adds = q;
      i32 na = *q++; q += na * 2;
      i32 *takesP = q;
      i32 nt = *q++; q += nt * 2;
      p = q;
      if (!ok) continue;
      anyShown = 1;
      shownChoice[cslot] = 1;
      if (key) {
        i32 dup = 0, k;
        for (k = 0; k < nKeys; k++) if (shownKeys[k] == key) { dup = 1; break; }
        if (dup && dupes[pi] < 0) { dupes[pi] = s; dupCi[pi] = ci; }
        if (nKeys < 64) shownKeys[nKeys++] = key;
      }
      if (to < 0 || (ckField >= 0 && fail < 0)) { exits[s] = 1; continue; }
      for (i32 k = 0; k < nt; k++) if (fl & takesP[1 + 2 * k]) heldPick[takesP[2 + 2 * k]] = 1;
      i32 *dummy;
      i32 chosen = (((fl & ~clear) | g) & ~t);
      chosen = addTo(chosen, adds, &dummy);
      PageView tv; pageView(to, &tv);
      noteArrival(to, chosen, tv.arr);
      i32 win = 1, lose = 0;
      if (ckField >= 0) {
        i32 *fr = fieldRec(ckField);
        i32 need = ckTarget - (pool[fr[4] + fv(fl, fr)] + fr[2]);
        win = need <= 12;
        lose = need > 2;
        rolled[cslot] |= (win ? 1 : 0) | (lose ? 2 : 0);
      }
      if (win) {
        i32 t2 = visit(to, arrive(to, chosen), s, ci);
        if (status) break;
        if (edgesOn) { if (nEdges >= edgeMax) { status = -2; break; } edges[2 * nEdges] = s; edges[2 * nEdges + 1] = t2; nEdges++; }
      }
      if (lose) {
        PageView fvw; pageView(fail, &fvw);
        noteArrival(fail, chosen, fvw.arr);
        i32 t2 = visit(fail, arrive(fail, chosen), s, ci | 0x40000000);
        if (status) break;
        if (edgesOn) { if (nEdges >= edgeMax) { status = -2; break; } edges[2 * nEdges] = s; edges[2 * nEdges + 1] = t2; nEdges++; }
      }
    }
    if (status) break;
    if (!anyShown) {
      exits[s] = 1;
      if (soft[pi] < 0) soft[pi] = s;
    }
  }
  K[C_OUT_COUNT] = nSit; K[C_OUT_EDGES] = nEdges; K[C_OUT_EDGESON] = edgesOn; K[C_OUT_TRUNC] = truncated; K[C_OUT_EVER] = ever; K[C_OUT_STATUS] = status;
  return status;
}
