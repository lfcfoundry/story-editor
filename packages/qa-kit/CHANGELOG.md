# qa-kit changelog

What changed in each version, newest first, one plain line each. The full technical log, with sizes and test browsers, is kept by the maintainers.

## 0.3.0 · 2026-10-31
- Faster: suites in one browser run several at a time, longest first, using the times saved after the last all-green run (or a committed `times-seed.json`). In Story Editor's own runner this took a quick run from 98 to 75 s.

## 0.2.1 · 2026-10-17
- Faster: Firefox starts in about 0.85 s instead of 1.7 s, about 30 seconds saved over the editor's 29 quick suites.

## 0.2.0 · 2026-10-17
- New: the same Playwright-style calls now also drive WebKitGTK.

## 0.1.0 · 2026-10-12
- First release: a test runner with three tiers and one retry, and Playwright-style calls over Puppeteer's WebDriver BiDi so tests run on stock Firefox. It also has a seeded random story generator.
