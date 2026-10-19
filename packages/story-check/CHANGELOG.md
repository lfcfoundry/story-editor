# story-check changelog

What changed in each version, newest first, one plain line each. The full technical log, with sizes and test browsers, is kept by the maintainers.

## 1.0.2 · 2026-10-18
- Nothing changes for you. Inside, the checker can also hand its "stuck or missed choice" passes to a WebAssembly version when the host page provides one (the Story Editor does: up to 2.6 times faster on big stories); on its own it works as before.

## 1.0.1 · 2026-10-18
- Nothing changes for you. Inside, the checker can hand its exploring loop to a faster WebAssembly version when the host page provides one (the Story Editor does: up to 15 times faster on very big stories); on its own it works as before. 42.0 KB minified, 0.5 KB more.

## 1.0.0 · 2026-10-16
- Faster: a 48,000-situation story checks in 294 ms instead of 679 ms (2.3 times faster), with identical answers.
- Smaller download: a minified build is 41.5 KB (16.5 KB gzipped), about 40% less. The readable file is still there.
- Frozen (read-only) stories now work, and two new options give repeatable ids and collect notes for the author.

## 1.0.0 · 2026-10-12
- First release: the Story Editor's checker as one file with no dependencies. It tells you about dead ends, whether any player can reach each page and ending, and why a page is out of reach.
