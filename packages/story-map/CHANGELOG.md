# story-map changelog

What changed in each version, newest first, one plain line each. The full technical log, with sizes and test browsers, is kept by the maintainers.

## 1.0.6 · 2026-10-31
- Nothing changes in what this package gives: the drawings are exactly the same. Inside, the page order is tried on flat number lists, crossings are counted with a faster tally, and the line-up step stops as soon as nothing moves, so a 316-page story is laid out about 15 to 25% faster again.

## 1.0.5 · 2026-10-31
- Nothing changes in what this package gives: the drawings are exactly the same. Inside, the choke points and route shares are found with less work, and the layout does less repeated work, so a 316-page story is laid out about 15 to 20% faster.

## 1.0.4 · 2026-10-22
- Nothing changes in what this package gives. Inside, the crossing count of a drawing can now also be worked out in the Story Editor's background worker, with the same answer.

## 1.0.3 · 2026-10-22
- Nothing changes in what this package gives. Inside, the flow, top-down and spine drawings are now built by one function, so the Story Editor can run the very same code in a background worker. The drawings are exactly the same.

## 1.0.2 · 2026-10-22
- Counting the crossings can be handed to a faster counter when the page that uses this package provides one (the Story Editor does, in WebAssembly). The counts are the same. Without one, nothing changes.

## 1.0.1 · 2026-10-19
- Finding the pages every route must pass is faster: at 300 pages it takes 2 to 3 ms instead of 8 to 27 ms (1 ms instead of 2 to 3 ms at 100 pages). The answers are the same.

## 1.0.0 · 2026-10-16
- Smaller download: a minified build is 33.2 KB (14.3 KB gzipped), about 41% less. The readable file is still there.
- Frozen (read-only) stories now work.

## 1.0.0 · 2026-10-12
- First release: pictures and numbers for the shape of a branching story, including drawings, the pages every route must pass, and simulated players that show where real players end up.
