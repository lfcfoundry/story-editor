/* checkgraph.c: the Story Editor checker's move-graph passes (canReach and firstCut in analyzeRun, core.js) as WebAssembly.
   The checker keeps every move between situations as pairs (from, to). Here they become a table of the moves backward, and two questions are
   answered over it: which situations can reach any of some targets, and, for up to 32 questions at once, which of some situations cannot
   reach any of the targets. The 32 share one pass: every situation carries a 32-bit set of the questions it can already answer "yes" for.
   Copyright (c) 2026 LFC Foundry. MIT License.
   Build: wasm/build.sh.  JavaScript (klGraphWasm in checkwalk.js) lays the tables out in memory and passes their addresses to init. */

typedef int i32;
typedef unsigned int u32;

static i32 n;
static i32 *off, *rev, *queue, *scr;
static u32 *label;
static unsigned char *ok, *inq;

/* edges: nE pairs (from, to). off: n + 1 values; fill: n values of scratch; rev: nE values. queue, label: n values; ok, inq: n bytes. */
void init(i32 nSit, i32 nE, i32 *edges, i32 *offP, i32 *fill, i32 *revP, i32 *queueP, u32 *labelP, unsigned char *inqP, unsigned char *okP, i32 *scrP) {
  i32 i, e;
  n = nSit; scr = scrP; off = offP; rev = revP; queue = queueP; label = labelP; inq = inqP; ok = okP;
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

/* nq (at most 32) questions. Question q has toLens[q] situations in `to` (one list after another) and fromLens[q] in `from`.
   res[q] = the position, in question q's part of `from`, of the first situation that cannot reach any of its `to` situations, or -1.
   Every situation ends up with the set of questions it can answer "yes" for: the union of the targets reachable from it. Moves are kept
   backward (rev), so labels flow along rev edges. The strongly connected parts are found first (Tarjan, written with its own stack); parts
   come out last-reached first, so going through them backward visits every part after all the parts that feed it, and each edge is used once. */
void firstCuts(i32 nq, i32 *toLens, i32 *to, i32 *fromLens, i32 *from, i32 *res) {
  i32 i, q, k, r, e, nord = 0, sp = 0, cp = 0, nc = 0, cnt = 0;
  i32 *idx = scr, *low = scr + n, *ord = scr + 2 * n, *stk = scr + 3 * n, *cs = scr + 4 * n, *ce = scr + 5 * n;
  for (i = 0; i < n; i++) { label[i] = 0; inq[i] = 0; idx[i] = -1; }
  for (q = 0; q < nq; q++) {
    u32 bit = 1u << q;
    for (k = 0; k < toLens[q]; k++, to++) label[*to] |= bit;
  }
  for (r = 0; r < n; r++) {
    if (idx[r] >= 0) continue;
    idx[r] = low[r] = cnt++; stk[sp++] = r; inq[r] = 1; cs[0] = r; ce[0] = off[r]; cp = 1;
    while (cp) {
      i32 x = cs[cp - 1];
      if (ce[cp - 1] < off[x + 1]) {
        i32 w = rev[ce[cp - 1]++];
        if (idx[w] < 0) { idx[w] = low[w] = cnt++; stk[sp++] = w; inq[w] = 1; cs[cp] = w; ce[cp] = off[w]; cp++; }
        else if (inq[w] && idx[w] < low[x]) low[x] = idx[w];
      } else {
        i32 lx = low[x];
        if (lx == idx[x]) {
          i32 w;
          do { w = stk[--sp]; inq[w] = 0; ord[nord++] = w; low[w] = nc; } while (w != x);
          nc++;
        }
        cp--;
        if (cp && lx < low[cs[cp - 1]]) low[cs[cp - 1]] = lx;
      }
    }
  }
  for (i = nord; i > 0;) {
    i32 c = low[ord[i - 1]], j = i;
    u32 all = 0;
    while (j > 0 && low[ord[j - 1]] == c) all |= label[ord[--j]];
    for (k = j; k < i; k++) {
      i32 x = ord[k];
      label[x] = all;
      for (e = off[x]; e < off[x + 1]; e++) label[rev[e]] |= all;
    }
    i = j;
  }
  for (q = 0; q < nq; q++) {
    res[q] = -1;
    for (k = 0; k < fromLens[q]; k++, from++)
      if (res[q] < 0 && !((label[*from] >> q) & 1)) res[q] = k;
  }
}
