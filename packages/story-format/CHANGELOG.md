# story-format changelog

What changed in each version, newest first, one plain line each. The full technical log, with sizes and test browsers, is kept by the maintainers.

## 2.0.0 · 2026-10-17
- The Twine importer moved to its own package, [twine-import](../twine-import/README.md), so this one is 59% smaller (27.1 KB to 11.5 KB gzipped). If you used `importTwine`, `twineRead`, `twineConvert` or the `twine-to-story` command, switch to the other package; they work the same there.

## 1.0.0 · 2026-10-12
- First release: create, clean and check story files, write a story as plain text, find and replace, a Markdown manuscript, counts, a Twine importer and a JSON Schema.
