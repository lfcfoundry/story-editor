# twine-import changelog

What changed in each version, newest first, one plain line each. The full technical log, with sizes and test browsers, is kept by the maintainers.

## 1.0.1 · 2026-10-29
- A story whose code nests more than 300 levels deep is now refused at once with the same plain message (it used to stop only when the engine ran out of stack, which took 40 ms to 8 seconds). Stories nested less deeply read exactly as before.

## 1.0.0 · 2026-10-17
- First release: reads Twine 2, Twee 3 and Twine 1 stories and turns them into this format, keeping SugarCube and Harlowe rules as real rules. It lists everything it could not carry over and never invents an author. The `twine-to-story` command comes with it. It is 20.6 KB gzipped.
