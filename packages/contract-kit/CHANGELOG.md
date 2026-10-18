# contract-kit changelog

What changed in each version, newest first, one plain line each. The full technical log, with sizes and test browsers, is kept by the maintainers.

## 1.1.0 · 2026-10-17
- Fixed six ways a check could pass when it should have failed, including async functions that disagreed, odd errors, and data that cannot be changed.
- New: a failing input is cut down to the smallest one that still fails (a 4,096-byte story became 685 bytes). Also new: comparing async functions, naming the features random inputs should have, a time limit, and a check for fields an exporter drops.
- Works in browsers, Deno and Bun through `contract-kit/core`.
- Faster: 126 ms down to 72 ms (about 1.7 times faster) when your functions do not change their input.
- Bigger: the helper went from 1.9 KB to 7.2 KB minified, the price of the new checks.

## 1.0.0 · 2026-10-17
- First release: a written guide and a 101-line helper for keeping two versions of the same rules from drifting apart.
