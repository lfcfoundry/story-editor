/* mapcross.c: the Map's crossing count (mapMetrics in maplayout.js) as WebAssembly.
   Segments are given as 4 numbers each (x0, y0, x1, y1) with the number of the arrow each belongs to. Two segments of different arrows cross when
   each lies strictly on both sides of the other's line; pairs whose bounding boxes do not overlap are dismissed first. It is the same arithmetic,
   in the same doubles, as the JavaScript (mapSegCross), so the count is the same.
   Copyright (c) 2026 LFC Foundry. MIT License.
   Build: wasm/build.sh.  JavaScript (klCrossWasm in checkwalk.js) lays the segments out in memory and passes their addresses. */

typedef int i32;

static inline i32 sg(double v) { return v > 0 ? 1 : v < 0 ? -1 : 0; }
static inline i32 side(double px, double py, double qx, double qy, double rx, double ry) { return sg((qx - px) * (ry - py) - (qy - py) * (rx - px)); }

/* f: n segments of 4 doubles; id: n arrow numbers; ord: n numbers and lo: n doubles of scratch.
   Returns how many pairs of segments of different arrows cross. The segments are put in order of their left end, so each one is only compared with
   the ones that start before its right end (the others cannot cross it): the same pairs as comparing every pair, found much sooner. */
i32 crossings(i32 n, const double *f, const i32 *id, i32 *ord, double *lo) {
  i32 i, j, a, b, c = 0, gap;
  for (i = 0; i < n; i++) {
    double x0 = f[4 * i], x1 = f[4 * i + 2];
    lo[i] = x0 < x1 ? x0 : x1;
    ord[i] = i;
  }
  /* shell sort by left end */
  for (gap = n / 2; gap > 0; gap /= 2)
    for (a = gap; a < n; a++) {
      i32 t = ord[a], k = a;
      double key = lo[t];
      while (k >= gap && lo[ord[k - gap]] > key) { ord[k] = ord[k - gap]; k -= gap; }
      ord[k] = t;
    }
  for (a = 0; a < n; a++) {
    i = ord[a];
    double ax = f[4 * i], ay = f[4 * i + 1], bx = f[4 * i + 2], by = f[4 * i + 3];
    double xh = ax < bx ? bx : ax, yl = ay < by ? ay : by, yh = ay < by ? by : ay;
    for (b = a + 1; b < n; b++) {
      j = ord[b];
      if (lo[j] > xh) break;
      double cx = f[4 * j], cy = f[4 * j + 1], dx = f[4 * j + 2], dy = f[4 * j + 3];
      double ql = cy < dy ? cy : dy, qh = cy < dy ? dy : cy;
      if (yh < ql || qh < yl) continue;
      if (id[i] == id[j]) continue;
      if (side(ax, ay, bx, by, cx, cy) * side(ax, ay, bx, by, dx, dy) < 0 && side(cx, cy, dx, dy, ax, ay) * side(cx, cy, dx, dy, bx, by) < 0) c++;
    }
  }
  return c;
}
