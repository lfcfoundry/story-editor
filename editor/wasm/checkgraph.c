/* checkgraph.c: the Story Editor checker's move-graph passes (canReach and firstCut in analyzeRun, core.js) as WebAssembly.
   The checker keeps every move between situations as pairs (from, to). Here they become a table of the moves backward, and two questions are
   answered over it: which situations can reach any of some targets, and, for up to 32 questions at once, which of some situations cannot
   reach any of the targets. The 32 share one pass: every situation carries a 32-bit set of the questions it can already answer "yes" for.
   Copyright (c) 2026 LFC Foundry. MIT License.
   Build: wasm/build.sh.  JavaScript (klGraphWasm in checkwalk.js) lays the tables out in memory and passes their addresses to init. */

typedef int i32;
typedef unsigned int u32;

static i32 n;
static i32 *off, *rev, *queue;
static u32 *label;
static unsigned char *ok, *inq;

/* edges: nE pairs (from, to). off: n + 1 values; fill: n values of scratch; rev: nE values. queue, label: n values; ok, inq: n bytes. */
void init(i32 nSit, i32 nE, i32 *edges, i32 *offP, i32 *fill, i32 *revP, i32 *queueP, u32 *labelP, unsigned char *inqP, unsigned char *okP) {
  i32 i, e;
  n = nSit; off = offP; rev = revP; queue = queueP; label = labelP; inq = inqP; ok = okP;
  for (i = 0; i <= n; i++) off[i] = 0;
  for (e = 0; e < nE; e++) off[edges[2 * e + 1] + 1]++;
  for (i = 0; i < n; i++) off[i + 1] += off[i];
  for (i = 0; i < n; i++) fill[i] = off[i];
  for (e = 0; e < nE; e++) rev[fill[edges[2 * e + 1]]++] = edges[2 * e];
}

/* ok[s] = 1 for every situation from which one of the nt targets can be reached (the targets included); the queue is used as a stack */
void canReach(i32 *targets, i32 nt) {
  i32 i, top = 0;
  for (i = 0; i < n; i++) ok[i] = 0;
  for (i = 0; i < nt; i++) {
    i32 t = targets[i];
    if (!ok[t]) { ok[t] = 1; queue[top++] = t; }
  }
  while (top) {
    i32 x = queue[--top], j;
    for (j = off[x]; j < off[x + 1]; j++) {
      i32 f = rev[j];
      if (!ok[f]) { ok[f] = 1; queue[top++] = f; }
    }
  }
}

static inline i32 next(i32 i) { return i + 1 == n ? 0 : i + 1; }

/* nq (at most 32) questions. Question q has toLens[q] situations in `to` (one list after another) and fromLens[q] in `from`.
   res[q] = the position, in question q's part of `from`, of the first situation that cannot reach any of its `to` situations, or -1. */
void firstCuts(i32 nq, i32 *toLens, i32 *to, i32 *fromLens, i32 *from, i32 *res) {
  i32 i, q, k, head = 0, tail = 0, count = 0;
  for (i = 0; i < n; i++) { label[i] = 0; inq[i] = 0; }
  for (q = 0; q < nq; q++) {
    u32 bit = 1u << q;
    for (k = 0; k < toLens[q]; k++, to++) {
      i32 t = *to;
      label[t] |= bit;
      if (!inq[t]) { inq[t] = 1; queue[tail] = t; tail = next(tail); count++; }
    }
  }
  while (count) {
    i32 x = queue[head], j;
    head = next(head); count--; inq[x] = 0;
    u32 m = label[x];
    for (j = off[x]; j < off[x + 1]; j++) {
      i32 f = rev[j];
      u32 nl = label[f] | m;
      if (nl != label[f]) {
        label[f] = nl;
        if (!inq[f]) { inq[f] = 1; queue[tail] = f; tail = next(tail); count++; }
      }
    }
  }
  for (q = 0; q < nq; q++) {
    res[q] = -1;
    for (k = 0; k < fromLens[q]; k++, from++)
      if (res[q] < 0 && !((label[*from] >> q) & 1)) res[q] = k;
  }
}
