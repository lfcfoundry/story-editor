# story-player changelog

What changed in each version, newest first, one plain line each. The full technical log, with sizes and test browsers, is kept by the maintainers.

## 1.0.1 · 2026-10-17
- Games built by this package now allow WebAssembly, so a game can use it later. Nothing behaves differently today, and each game is 19 bytes bigger.

## 1.0.0 · 2026-10-16
- Smaller download: a minified build is 56.5 KB (21.3 KB gzipped), about 21% less. The readable file is still there.
- Frozen (read-only) stories now work.

## 1.0.0 · 2026-10-12
- First release: turns a story into one offline page that plays in any browser, with no server, internet or tracking. It also makes a self-unzipping page, lets code play a story by the game's own rules, and has a command line.
