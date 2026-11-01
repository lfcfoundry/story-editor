# Story Editor developer changelog

What changed in each release, newest first, for developers, in three depths: **Quick** (what changed), **Details** (the numbers with the browsers named) and **Deep** (design reasons, tests, what was tried). Users read [CHANGELOG.md](CHANGELOG.md) instead: one plain line per change. Releases since October 17 are tested in Firefox, Chromium and WebKitGTK; the browsers and versions are named in each Deep entry.

## 2026-11-01 · Writing notes read each paragraph's words once

### Quick
- `writingPage` split the page's whole text into words (`writeWords(all)`) and then split each paragraph again to count its words for the long-paragraph note. Now it splits each paragraph once and joins the lists for the whole page. A word never spans two paragraphs, so the lists are the same.
- The "choices that read alike" note worked out each choice's key words once per pair of choices. Now it does it once per choice.

### Details
`writingPage` over every page of a 2,040-page story (the work `writingWarm` does in slices after a story opens), median of 21 interleaved runs. New/old, lower is better:

| | Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Words once per paragraph | 0.85x | 0.81x | 0.81x |
| Keys once per choice | 0.95x | 0.96x | 0.96x |
| **Both** | **0.77x** (114 to 88 ms) | **0.76x** (109 to 83 ms) | **0.78x** (124 to 97 ms) |

### Deep
- **Same notes.** The bench compares every page's notes and word lists from the old and new code before timing them. `writing-cache-equiv` (npm test) passes.
- **Where the rest goes.** Of the remaining time, about 18 ms is the "typed twice" pattern, about 22 ms the capitalized and lower-case word scan, and about 17 ms the word split. Merging the two scans is not exact (their word patterns differ on digits), so they stay apart.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `helpers`, `bugs12`, `foundry`, `top10-player`, `write1`, `fuzz1`; `npm test`.

## 2026-11-01 · The page and item lists listen once for all their rows

### Quick
- Every page-list row got eleven listeners of its own: `click`, `dragstart`, `contextmenu` (from `h()`), `touchstart` / `touchmove` / `touchend` / `touchcancel` and a capturing `click` guard (`longPress`), and `dragover` / `dragleave` / `drop` in written order (`reorderTarget`). Each one has its own closure. At 2,040 pages that came to 44,725 listeners after opening the story.
- Now `listRows(ul)` puts one set of listeners on `#pages` and `#itemlist`. A row is a button registered with `listRow(btn, { click, drag, menu, press, reorder })` in a WeakMap, and each event finds its row with `closest('button')`. The reorder logic is shared as `reorderOver` / `reorderClear` / `reorderDrop`; `reorderTarget` is gone (it had no other users).

### Details
2,040-page story (the example story 40 times over), Chromium 155.0.8059.39, after opening with garbage collected:

| | before | after |
|---|---|---|
| Event listeners added while opening | 44,725 | 298 |
| Heap snapshot, JS and page objects (lower is better) | 44.8 MB | 37.3 MB |
| Of that, browser-side objects | 27.0 MB | 20.7 MB |
| V8 heap in use | 18.5 MB | 17.2 MB |

Early-stop A/B with a 5% limit, new/old, lower is better:

| | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Reopen until the editor exists | 0.82x (noisy) | 0.95x | 0.92x |
| Page switch | 0.99x (noisy) | 1.00x | 0.85x |

Pages alone and items alone were each measured. The page list carries almost all of the gain, and the items list adds about 120 listeners' worth in this story. Both stacked are kept, because a story with many items gains the same way.

### Deep
- **Same answers.** `click`, `dragstart` and `contextmenu` run the row's own handler. The long press keeps one timer per list; there is only one finger at a time.
- **Long-press guard.** The guard that stops the lifted finger from also clicking now listens in the capture phase on the list, so it covers the whole row. Before, it sat on the button, so a lift on the button's own padding (not on its name or icons) still opened the page under the menu.
- **Drop target.** A drop on a row stops at the list, as it stopped at the row before; nothing between the row and the list listens.
- **Why it was hidden.** Each listener is small, but a 2,040-page list holds them for every row, and in Chromium each one also carries a registration record and a vector slot on the page side. The V8 heap shows only 1.3 MB of it.
- **New suite `listrows`.** Rows carry no listeners. Clicking a name opens the page. Right-click opens the menu and Escape closes it. Dragging carries the id and name. In written order, a drop on the top half moves the page there and clears the bar, and a drop on itself changes nothing. Clicking an item gives it to the page, and right-clicking an item opens its menu. Where touch events can be made (Chromium), a long press opens the menu and the lifted finger does not open the page. The suite passes against the old build too, apart from the listener count.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6. Suites: `listrows`, `listdots`, `fix2`, `inter`, `marks`, `opts`, `real`, `round3`, `tools8`, `top10-editor`, `top10-export`, `touch1` (Chromium), `write1`, `write2`, `phone`, `fuzz1`.

## 2026-11-01 · Undo steps reuse the stretch one-page edits changed instead of comparing whole texts

### Quick
- `pushUndo` stored each older snapshot as a difference found by `undoDelta`, which compares the two whole story texts from both ends. `pageEdit` already knows the stretch it changed, so `commit` now folds each edit's stretch into `undoSpan` (prefix kept = smallest `at`, suffix kept = smallest `keep`), and `pushUndo` uses it when the snapshot and the current text are the ones it describes. Anything else (a whole-story replace, a restore, a stretch that does not match) still goes through `undoDelta`.
- Shipped on the owner's call although no end-to-end gain could be measured.

### Details
`undoDelta` alone on a 1.8 M character story text with one edit in the middle, median of 31: Chromium 155 0.4 ms, Firefox 158 about 2 ms, WebKitGTK 2.52.6 about 1 ms (timer steps of 1 ms in the last two). The kept stretch costs well under 0.01 ms. It runs once per undo step (each typing pause), not per key.

Input-handler time over 5 typing bursts at 2,040 pages, early-stop A/B with 8 to 24 rounds, new/old, lower is better: Chromium 0.95 (ok), Firefox 1.02 (inconclusive, noisy), WebKitGTK 1.01 (inconclusive, noisy). An earlier 4-round run read 0.96 / 1.14 / 0.85. Neither run shows a change beyond noise.

### Deep
- **Safety.** The stretch may be wider than the exact difference, which only keeps a few more characters in the step. With `globalThis.__verCheck` on (undohist sets it), every step is checked to rebuild its text exactly.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `undohist`, `curtext`, `fuzz1`, `topbar`, `zsave`, `crashsafe`, `write1`; `npm test` (including `undo-delta-equiv`).

## 2026-11-01 · Packed autosave: big stories saved deflated, the worker sent only the changed stretch

### Quick
A story of 64 K characters or more (`ZSAVE_FROM`) is autosaved as `LFZ1:` + its length + `:` + base64 of the deflated UTF-8 text, about 4 times smaller. A small worker deflates with the browser's `CompressionStream`, inflates the result again and compares it with the text, and only then returns the packed text; the page just writes it. The worker keeps the text it packed last, so after a typing pause the page sends only the stretch that changed (`zsaveSpan`, fed by `pageEdit`: how many characters are kept at the start, how many at the end, and the new middle). Saves that must happen at once (`persistNow`: the tab closing, Undo, another story replacing this one), small stories, the spare copy, and any trouble stay plain text. Opening reads either form (`zsaveText`, inflated before `init`).

### Details
Page time blocked by autosaving over 4 typing pauses (5 saves: `localStorage` get and set, posting to the worker, reading its answer), 2,040 pages (1.84 M characters, 447 K packed). Early-stop A/B (5% limit), new/old, lower is better:

| Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|
| 0.40x (0.39-0.42), about 87 to 35 ms | 0.26x (0.16-0.33), noisy, about 38 to 10 ms | 0.66x (0.63-0.75), about 21 to 15 ms |

Time until the editor has started (`init` done, before the 4-second splash ends) when reopening that story after an edit, packed against plain: Chromium 0.88x ok (6 rounds), Firefox 1.00x ok (13 rounds), **WebKitGTK 1.14x slower** (median 362 to 400 ms). Unpacking costs WebKitGTK about 17 to 23 ms cold (base64 1 ms, `DecompressionStream` 11 to 18 ms the first time in a page, `TextDecoder` 4 ms); the rest is scheduling around the asynchronous unpack. A first measurement until the splash was gone hid this behind the splash's fixed timing. Starting the unpacking in a worker from a small script in the page's head, so it ran while the browser read the editor's big script, was worse: WebKitGTK 1.22x, Firefox 1.17x, Chromium 0.89x against plain, so it was dropped.

### Deep
- **What was tried.** Posting the whole text each save: Chromium 0.54x, Firefox 0.49x, but WebKitGTK 1.51x, because its plain `setItem` of 1.8 MB costs only about 2 to 3 ms while posting the string costs about 5. Encoding to bytes on the page and transferring the buffer: Chromium 1.22x (the `TextEncoder` call alone is 9 ms there). Finding the changed stretch by comparing the old and new texts in 64 K slices: 0.7 / 3 / 2 ms per save (Chromium / Firefox / WebKitGTK), more than Firefox's post. `pageEdit` already knows where it splices, so the stretch costs nothing to find.
- **Safety.** The worker checks that the stretch belongs to the text it holds (the sequence number of the last text it was sent, and the lengths); if not, it asks for the whole text, once. A packed copy that does not inflate back to the same text is never written: the save is made plain and the packed path is switched off for the session. On opening, a packed save is checked against its zlib header and its stated length; a damaged one is kept aside (`-damaged`) and the spare copy opens, with the usual notice.
- The worker keeps one copy of the story (about 3.7 MB at 2,040 pages), and the page keeps the text it last sent (usually the same string Undo already holds).
- `Uint8Array.fromBase64` / `toBase64` are used where the browser has them, with `atob` / `btoa` loops as the fallback.
- New suite `zsave`: a packed save after an edit (holding the story's length, at least 3 times smaller); a reload opens it with no notice; a save made at once is plain and opens; the spare copy is plain; a damaged packed save goes to the spare with its notice; a small story stays plain; after mixed edits (typing in two pages in one pause, Undo, a new page, more typing) every packed save inflates to exactly the story, and saves after typing send only the changed stretch. `crashsafe` now watches the notice from inside the page (the context init-script observer no longer saw it).
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `zsave`, `crashsafe`, `safety`, `twowin`, `nosave`, `curtext`, `fuzz1`, `bugs12`, `top5-safe` pass; `npm test` passes.

## 2026-11-01 · Page switch keeps the page list element; story order looks pages up through one Map (round 38)

### Quick
- **S.** `renderSide` emptied `#side` and made a new `ul#pages` on every call, so `renderList` (which already reuses unchanged rows) put all 2,046 rows into a new list. The browser then laid every row out again when the page's paragraph boxes measured themselves (`autosizeAll` → `scrollHeight`). That cost about 67 ms of a page switch in a Chromium profile. Now the list element stays in place, the parts above it are made again, and only changed rows are swapped (two, on a switch: the old and new current page).
- **F.** `listedPages` (story order) and `nextUnwritten` looked each page up with `byId`, a scan of every page for each page (n×n, about 11 ms at 2,040 pages). They now use one `pagesById()` Map per call, first page per id winning, as `byId` does.
- Round 38's third idea (word counts) is already in PR 81 (`klPageWords`). Its "story text rebuilt on every key" was measured on the old /play/ copy; since PR 69, text keys go through `pageEdit`.

### Details
Median of 7 page-list clicks (click plus forced layout), 2,040 pages. Early-stop A/B (5% limit), new/old, lower is better:

| | Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| S alone | 0.33x | 0.35x | 0.26x |
| F alone | 0.88x ok | 0.74x | 0.96x ok |
| **S + F** | **0.23x** | **0.23x** | **0.20x** |

All three against the same build (the editor as merged in PR 82), each browser in its own run. F alone is within the 5% limit or faster everywhere.

### Deep
- **Stacking.** S and F together beat S alone in every browser: S takes the layout away, which leaves F's lookups as a large share of what remains.
- **Scroll position.** The kept list keeps its own scroll position; `sideScrollFix` still brings the open page into view.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6. Page-list suites: `fix2`, `inter`, `listdots`, `marks`, `opts`, `real`, `round3`, `tools8`, `top10-editor`, `touch1` (Chromium), `write1`, `write2`, `phone`, `fuzz1`.

## 2026-10-31 · Page list problem dots follow the newest check

### Quick
`renderList` (the page list, redrawn after every check since PR 70) read `bad`, the problem set that `renderSide` computed when the whole side panel was last built. The dots therefore showed an old check until something rebuilt the side panel, such as opening a page. `renderList` now takes `problemSet()` itself.

### Details
- 2,040-page story, Chromium 155.0.8059.39: after start, no row had a dot although the check found problems on 1,989 pages. Opening the first page then rebuilt 1,989 rows (about 22,000 listeners) to add them. With the fix the dots come with the first check's answer, and opening a page rebuilds only the two rows whose selection changed.
- `problemSet()` walks the check's problem list (about 2,000 entries at 2,040 pages), well under 1 ms.

### Deep
- Found while tracing why opening a page doubled the page's event listeners in a heap snapshot: the row keys changed in their problem part (`!!bad[p.id]`, false to true on 1,989 rows).
- New suite `qa/listdots.js` (3 browsers). It uses a story with an unreachable copy of every page (34 problems) and checks that every row's dot matches the newest check, after the first check without opening a page, and after an edit and its Undo. On the previous build the first check reads 34 rows wrong.
## 2026-10-31 · The Map keys its layouts by a story version number instead of a fingerprint of the whole text

### Quick
`sigOf(cur)` hashed the whole story text (31-multiply over every character) to name the story's version in Map cache keys, the play-test cache and the built-ahead marks (`mapAhead`, `mapDropAhead`). It ran once per new `cur`, which is after every typing pause, and a fresh text is also a joined string, so it was flattened first: 13 ms in Chromium and Firefox and 20 ms in WebKitGTK at 2,040 pages (1.8 M characters). `curVer` now numbers the versions: every place that sets `cur` to new text takes a new number, and a snapshot (`snap`) keeps its number, so Undo and Redo bring the same number back. `curSig()` returns `v` + the number. The file record still uses `sigOf`, because it must match across reloads.

### Details
Page time in all worker answer handlers over 4 typing pauses, 2,040 pages. Early-stop A/B (5% limit), new/old, lower is better:

| Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|
| 0.58x (0.57-0.61) | 0.51x (0.50-0.77) | 0.36x (0.33-0.78) |

### Deep
- **The only risk:** a number that stands for two texts would show a layout from another version. Two numbers for one text (text typed back to what it was) just miss the cache. With `window.__verCheck` on, `curSig()` also fingerprints the text and throws if a number has been seen with another text. `mapprebuild`, `mapkey`, `curtext` and `fuzz1` turn it on. A build with one missing bump (in `commit`) fails `mapprebuild` and `fuzz1` at once ("story version 1 stood for two different texts").
- The places that set `cur`: `commit`, `restore`, `undoMany`, `replaceProject`, `applyStamp` and `init`.
- A `Map` from text to number was also measured: 4 to 6 ms per new text, because the engine still hashes or compares the long string.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `mapprebuild`, `mapkey`, `curtext`, `fuzz1` pass with the check on.
## 2026-10-31 · Map views built ahead are reused when only words on pages changed

### Quick
After every typing pause the background worker built two Map views again for the new story text, and the page unpacked each answer, although typing in a paragraph never changes a layout. The worker now strips paragraph texts, headings and notes before it builds and hashes what is left with the view and options (`mapStructKey`: the length and two 32-bit FNV-1a hashes). The page sends the hash of the last never-shown layout it holds for that view (`mapPre.last`), and when they match the worker answers `same` without building. The page then keeps that layout for the new version of the story.

### Details
Page time in all worker answer handlers (the check and the Map views built ahead) over 4 typing pauses, 2,040 pages. Early-stop A/B (5% limit), new/old, lower is better:

| Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|
| 0.48x (0.43-0.49), median about 147 to 67 ms | 0.75x (0.66-0.94), noisy, 5 rounds | 0.63x (0.57-0.92) |

In each run the worker built 10 layouts before and 2 after; the other 8 were answered `same`.

### Deep
- Because the worker builds from the stripped story, a layout cannot depend on the stripped words. `map-worker-equiv.mjs` now gives its random stories paragraph texts, headings and notes and still finds the worker's 1,920 layouts equal to the Map tab's own build from the full story. After each answer it sends the same story with only those words changed (it must answer `same`, 720 times) and with a renamed page (it must build again).
- Only a layout that was never shown is reused (`mapAhead` still marks it), so nothing drawn on screen is shared between two versions. Like any layout built ahead, it is dropped when the story changes again; at most one per view is held for the comparison, the same layouts the cache keeps for the current story.
- `mapprebuild`: after a paragraph edit the three layouts are kept without building and equal a fresh build for the edited story; a renamed page gets three new builds. In this run the Chromium leg of the suite took 35 s instead of 96 s.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `mapprebuild`, `mapkey`, `checkworker`, `csp` pass; `npm test` passes.

## 2026-10-31 · Top bar redraw: kept word counts, tabs reused, one time formatter

### Quick
`renderTop` runs after every key and every check. Three costs in it are gone:
- `storyStats` looked up every paragraph and choice of every page in `KL_WORDS` (0.75 ms per call at 2,040 pages in Chromium). `klPageWords(p)` keeps each page's count with the strings it was counted from and compares them by reference.
- The tab buttons and the phone's drawer bar were rebuilt, with their listeners and icons, every time. They are now made again only when what they show changes (the open tab, the Game tab switch, the number of problems; the open page and its name).
- The status line's `toLocaleTimeString([], options)` set up the language rules on every call. `clockText()` uses one `Intl.DateTimeFormat` (the History list uses it too).

### Details
All `requestAnimationFrame` work while typing 19 keys in a paragraph and the pause after, 2,040 pages. Early-stop A/B (5% limit), new/old, lower is better:

| | Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Time formatter alone | 0.99x (0.96-1.07), inconclusive after 16 rounds | 0.92x (0.86-1.01), ok | 1.05x (0.93-1.20), inconclusive, noisy |
| Kept word counts alone | 0.88x (0.84-0.90) | 0.66x (0.62-0.72) | 0.79x (0.58-1.00), noisy |
| Tabs and drawer bar reused alone | 0.83x (0.75-0.92) | 0.77x (0.74-0.82) | 0.70x (0.52-0.81), noisy |
| All three | **0.62x (0.59-0.63)** | **0.44x (0.37-0.60)**, noisy | **0.50x (0.44-0.57)** |

Together they beat the product of the three alone in every browser (Chromium 0.72x expected, 0.62x measured).

### Deep
- Found with a CPU profile of 6 typing pauses at 2,040 pages (Chromium): 44 ms under `renderTop`, of which `storyStats` 17.9 ms (klWordCount 9.3), `statusParts` 7 ms (5.4 ms on the `toLocaleTimeString` line), tab and icon building most of the rest.
- The time formatter alone is within noise here, but it is the same per-call `Intl` setup as the A to Z sort (see that entry), so it stays in.
- `klPageWords` keeps references to the page's own strings, so it holds no copies. `stats-cache-equiv.mjs` (new, in `npm test`) edits 30 random stories 60 times each (texts, headings, choice labels, paragraphs and choices added, removed and swapped, pages added and removed) and compares the totals with a fresh count; breaking the label or heading comparison makes it fail.
- `storyStats` lives in `core.js`, so the `story-format` package was regenerated (`npm run build`); its word totals are unchanged.
- New suite `qa/topbar.js` (3 browsers): the Check tab's badge follows the check after start, typing, a new unlinked page and its Undo; typing keeps the same tab elements; the drawer bar's page button follows a rename; a tab click selects that tab. Leaving the problem count out of the tabs key, or the name out of the bar key, makes it fail.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `topbar`, `phone`, `undohist`, `opts`, `top10-editor`, `screens` pass; `npm test` passes.

## 2026-10-31 · Page list A to Z: one collator, and the last order kept

### Quick
`listedPages()` sorted A to Z with `localeCompare(x, y, undefined, { sensitivity: 'base', numeric: true })`. Called with options, every comparison sets up the language rules again: sorting 2,040 names took 66 ms in Chromium, 32 in Firefox and 142 in WebKitGTK, and the page list is redrawn after every check and every key in a page name. `azPages()` now uses one `Intl.Collator`, made the first time it is needed. It also keeps the last order: with the same pages and names it is returned as it is, and when a name changed, the old order (nearly sorted already) is sorted again. Names that compare equal fall back to the story's order, which is what a fresh stable sort gave, so the order is identical.

### Details
Sorting 2,040 names alone, median of 9 (lower is better): Chromium 155.0.8059.39 66 to 2.4 ms, Firefox 158 32 to 1, WebKitGTK 2.52.6 142 to 3, same order in all three.

Work per key in the page-name box with the list sorted A to Z, 2,040 pages. Early-stop A/B (5% limit), new/old, lower is better:

| | Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Collator alone | 0.12x (0.10-0.14) | 0.31x (0.21-0.37) | 0.08x (0.06-0.10) |
| Collator and the kept order | 0.08x (0.07-0.09), about 73 to 7 ms | 0.21x (0.06-0.29), about 47 to 6 ms | 0.07x (0.05-0.09), about 125 to 9-14 ms |

All took 4 rounds; some were marked noisy, but every interval is far below 1.

### Deep
- Found while looking at what `renderList` costs per redraw: the sort was a hidden cost only in A to Z mode (written order and story order do not sort by name).
- The kept order is dropped when another order is shown, so it never holds a closed story's pages.
- No other `localeCompare` with options in our repositories.
- `qa/write1.js` gains three checks (3 browsers): a page renamed key by key moves to the top, renamed pages move to the end with numbers in order (Zz9 before Zz10), and two names that differ only in capitals keep the story's order. The pages get their old names back afterwards.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `write1`, `phone` pass.

## 2026-10-31 · Writing notes keep their name and word totals between checks

### Quick
After each typing pause `writingChecks` merged every page's lower-case words into a new set (about 80,000 adds at 2,040 pages) and added up every page's capitalized words again, although only one page had changed. `writingTotals` now keeps both with the cache, together with the list of page parts they were added up from. Parts that changed have their lower-case words taken off and the new ones added (a count of pages per word). The name totals are kept when every changed part has the same page and the same capitalized words; otherwise they are added up again. When pages are added or removed, only the stretch between the unchanged start and end of the list is looked at. The notes are identical.

### Details
Writing notes after an edit, 2,040-page story, warm cache (median of 31 edits per load). Early-stop A/B (5% limit), new/old, lower is better:

| | Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Typing in a page | 0.25x (0.18-0.31), about 2.0 to 0.5 ms | 0.29x (0.00-0.33), 3 to 0-1 ms | 0.20x (0.20-0.22), 5 to 1 ms |
| A page added | 0.33x (0.22-0.38), about 2.0 to 0.6 ms | 0.33x (0.33-0.33), 3 to 1 ms | 0.25x (0.22-0.35), 4 to 1-2 ms |

All took 4 rounds. Firefox and WebKitGTK time in whole milliseconds.

### Deep
- Where the time went before (Chromium, 2,040 pages, per check): page parts 0.2-0.3 ms, merging the lower-case words 1.1 ms, adding up the names 0.2 ms; the pairwise name comparison was 0 (57 names).
- Tried alone first: only the lower-case words kept (a set of the parts counted last time, diffed with a new set): 0.39x/0.41x/0.50x. Stacked with the kept names and the index-by-index diff: 0.25x/0.29x/0.20x, about twice the gain of either alone.
- The first version rebuilt the counts when the number of pages changed, which made adding a page 1.28x (Chromium) and 1.5x (WebKitGTK) slower than before; the unchanged-start-and-end stretch fixed it.
- A part is never changed after `writingPart` makes it, so the same part object always has the same words. The kept names also check that the page id is the same, so two pages with the same names that change places still move a name's first page.
- `writing-cache-equiv.mjs`: the rare spellings (Marta, Tobyn) now come only from edits, so name notes appear (410 in the run), edits also write them in lower case, and a new case swaps two pages with the same names. Breaking the subtraction, the add check or the page-id check each makes it fail.
- The plain editor's size ceiling went from 720,000 to 740,000 bytes (the stack was at 720,105), under the owner's Oct 18 rule to raise ceilings while chasing speed.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `write1`, `write2`, `helpers` pass; `npm test` passes.

## 2026-10-31 · Paragraph box auto-height skips the measure when the text still fits

### Quick
`autosize` set the box's height to auto and read `scrollHeight` back on every key, which made the browser lay the page out twice per key (research round 25). It now gets the text from before the key. If the key only inserted text (nothing taken out) and the text still fits (`scrollHeight <= clientHeight`), it returns without touching the height. Box heights are identical.

### Details
Work per key in a paragraph box (the input handlers, auto-height included), 51-page story, 40 keys. Early-stop A/B (5% limit), new/old, lower is better:

| Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|
| 0.38x (median 0.8 to 0.3 ms) | 0.47x (0.29-0.59), sum of 40 keys | 0.27x (0.26-0.47), sum of 40 keys |

All three took 4 rounds. Firefox and WebKitGTK time in whole milliseconds, so the sum of the 40 keys is compared.

### Deep
- Only pure insertions can skip, checked by `onlyAdded` (common prefix, then the rest of the old text must end the new one). A deletion or a replaced selection can need fewer lines, so it always measures.
- Tried and dropped: CSS `field-sizing: content` (all three browsers support it). It removes the measuring entirely, but boxes come out 1 to 12 px different from today (54.4 vs 66 px for an empty two-line box, 64 vs 66 in WebKitGTK), so it would be a look change.
- New suite `qa/autosize.js` (3 browsers): after 75 edits on 3 pages (words that fit, words that wrap, new lines, deletions, typing at the start, a replaced selection), every paragraph box equals a fresh measure. With the insertion check removed it fails on 24 of 75.

## 2026-10-31 · Packed page starts after two frames and decodes base64 natively; every delivered file is Latin-1 (rounds 29 and 33)

### Quick
- **Round 29 (start script, `lzma/lzma_pack.py`).** The loader decodes its base64 with `Uint8Array.fromBase64` where the browser has it (the `atob` copy loop stays as the fallback). It starts after two animation frames or 100 ms, whichever comes first, instead of a fixed 30 ms `setTimeout`. One frame was too soon: Firefox then painted nothing until the editor was ready. The 100 ms timer covers a tab opened in the background, where frames do not run. The packer's Node self-check gains a `hidden` mode with no animation frames, and every mode must write the page exactly once.
- **Round 33 (one character above U+00FF doubles a page's text in Chromium).**
  - The emoji are gone from the license header (`foundry-header.txt`, `core.js foundryHeader`, so exported games too), as the owner chose.
  - `minify.mjs` writes the script and styles in ASCII (esbuild `charset: 'ascii'`, plus `\u` escapes for the characters esbuild leaves in regular expression literals).
  - `build.py` escapes the two JSON data blocks (`\u`) and the markup (`&#x...;`).
  - The build stops if any character above U+00FF is left in the plain page, the artifact page or the packed page (a `STORY_READABLE` build only warns).

### Details
Time until the editor is ready (`#app` has its parts and the page is complete), fresh tab over http, early-stop A/B (5% limit), new/old, lower is better:

| | Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Round 29 alone | 0.985 ok (noisy) | 0.81 ok | 0.875 faster |
| Round 33 alone | 0.98 ok | 1.05 inconclusive (16 rounds) | 0.94 ok |
| Both | **0.876 faster** | 0.93 ok | 1.006 ok |

First contentful paint stays at the same time ("Opening...": Chromium 40-44 ms, Firefox 39 ms, WebKitGTK 21-23 ms). Chromium renderer memory 4 s after load (memory-infra, median of 3 fresh browsers): `partition_alloc`, where Blink keeps page text, 3.13 to 2.65 MB; total 60.6 to 60.4 MB. Packed page 313,590 to 313,771 bytes (+181).

### Deep
- **Same page.** In Chromium and Firefox, the editor's visible text, its body HTML, every CSS rule and the two JSON data blocks (parsed) are identical between the old and new plain pages.
- **Escapes in regular expressions.** A `\u` escape means the same character in a pattern; a character above U+FFFF becomes its two halves, which is what a pattern without the `u` flag sees anyway, and a pair a `u`-flag pattern reads as one. `minify.mjs` refuses to escape a character that follows a backslash, because the escape would change its meaning there.
- **Exported games.** The header is 18 bytes smaller. Rule functions copied into games by their text keep working; the export suites pass.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `foundry`, `packed`, `csp`, `top10-export` pass. `npm test` passes, with the regenerated story-player package. `build.py`'s self-check of the packed page passes in its plain, wasm, refused-wasm, broken-wasm and hidden-tab modes.
## 2026-10-31 · The /play/ page is the current build, and npm test keeps it so

### Quick
`play/index.html`, the page GitHub Pages serves at /play/, was still the copy made in PR 57 (the build from PR 49): `build.py` wrote only `editor/story-editor.html` (not kept in git), and nothing copied it, so PRs 58 to 75 never reached the site. The committed `story-editor.plain.html` and `story-editor.artifact.html` had also stopped at PR 69. `build.py` now writes `play/index.html` too, and this change commits a fresh build of all three.

### Details
New npm test step `tools/play-check.mjs`: it runs the served page's own two scripts in a bare Node sandbox (no WebAssembly, so the JavaScript LZMA decoder unpacks it) and requires the page they write to be exactly `editor/story-editor.plain.html`; when the editor was built in the same folder it also requires `play/index.html` to be the same bytes as `editor/story-editor.html`. On the old copy it fails (687,939 characters unpacked against 711,544 in the committed plain page); on the fresh build it passes (718,656 both).

### Deep
- The build stamp (`STAMP`, the build time) changes the bytes on every build, which is why rebuilt files were often left out of commits. From now on every change to the editor commits the built files (`play/index.html`, `story-editor.plain.html`, `story-editor.artifact.html`, `sizes-last.json`); the check keeps the served page and the plain page from the same build.
- No editor code changes here. **Tested:** `npm test` passes, including the new step; the packed page's own self-check in `build.py` (plain, wasm, refused wasm, broken wasm) passes.

## 2026-10-31 · Map layouts built ahead are let go when the story changes

### Quick
`mapCache` keeps up to 16 layouts, keyed by the story's fingerprint, so that Undo brings back the same picture. Since PR 68, the background worker adds two layouts built ahead after every typing pause, so a big story filled the cache with layouts of older versions that were never shown. Layouts built ahead and not yet shown are now dropped as soon as the story changes (`mapDropAhead`). Layouts that were shown are kept as before.

### Details
- Chromium 155.0.8059.39, 2,040-page story: page heap after start, opening a page and 4 typing pauses, after garbage collection (heap snapshot, lower is better): 60.8 to 45.0 MB. Strings went from 465,000 to 126,000, and Map link labels from 30,080 to 7,520 (one layout's worth).
- The mechanism (how many layouts are kept) does not depend on the browser. The `mapprebuild` suite checks it in all three.

### Deep
- Found with heap snapshots grouped by what holds each string (`bench/map/bigstr.js`). After typing, `label<links<G` held 4 layouts' worth of strings, and with the cache full it reached 16.
- The built-ahead mark lives in a WeakMap (`mapAhead`, layout to story fingerprint), so layouts keep exactly the same keys (`mapprebuild` compares them key by key). `mapBuild` removes the mark when a layout is shown.
- New `mapprebuild` check: after an edit, at most 3 layouts are kept (one per plain view). Without the fix it reads 6 and fails.
- Found in the same snapshots, not yet fixed: opening a page doubles the page's event listeners (22,800 to 44,900) and adds about 9 MB at 2,040 pages.

## 2026-10-31 · Deep check past 200,000 situations

### Quick
When a check stops at its 200,000-situation limit, a second background worker checks the same story again up to 5,000,000 (`KL_DEEP_LIMIT`). Any edit stops it; its answer replaces the partial one only if the story is unchanged, and the worker is closed after each answer so its memory is given back. The WebAssembly walk now runs up to that limit (it stopped at 1.5 million and fell back to the JavaScript walk).

### Details
Generated stories with many objects, time from the first answer to the deep one (in the worker, lower is better) and problems found:

| Story | Problems at 200,000 | Problems in full | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|---|---|
| 269,109 situations | 13 | 21 | 96 ms | 116 ms | 154 ms |
| 1,214,606 situations | 20 | 28 | 324 ms | 371 ms | 622 ms |
| 2,371,595 situations | 28 | 44 | 799 ms | 824 ms | 1,014 ms |

- Peak memory of the page's process (Chromium, 400 x 700 window): +10, +69 and +115 MB for those three stories while the deep check runs, given back when it ends.
- The same deep checks with the JavaScript walk took 315 to 883 MB; the WebAssembly walk 69 to 238 MB, with the same answers (6 stories compared, up to 5,000,002 situations).

### Deep
- `deepCheckSoon()` runs from `afterCheck` when the answer for the current text is truncated with more than 200,000 situations and is not already deep. It uses the same worker source as the ordinary check, with the limit in the message. `deepCancel()` runs from `scheduleCheck` and `runCheck`. Explainers for a deep answer come from an ordinary check made on the page when asked, as for the other worker.
- The status line shows "Checking further" while a deep check of the current text runs, and the Check tab's banner says one is running. `window.__deepCheck = false` turns it off.
- New suite `qa/deepcheck.js`: the deep answer equals a deep check made on the page, the status line and Check tab show the full answer, the worker is closed, an edit stops the old deep check and the edited story gets its own, the switch turns it off, and a story that fits starts none.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `deepcheck`, `checkworker` pass; `npm test` passes.

## 2026-10-31 · Writing notes without a signature string

### Quick
Each page's cached part of the writing notes (`writingPart`) was checked with a signature string. That string joined the page's name, every paragraph and every choice wording, so every check rebuilt a copy of the whole story's text and the cache kept that copy alive. The part now keeps references to the strings it was worked out from and compares them field by field. The notes are identical.

### Details
Writing notes after an edit, 2,040-page story with a warm cache. Each load takes the median of 31 edits. Early-stop A/B (5% limit), new/old, lower is better:

| Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|
| 0.64x (0.55-0.70), 2.7 to 1.9 ms | 0.75x (0.50-0.75), 4 to 3 ms (whole-ms timer) | 0.57x (0.54-0.57), 7 to 4 ms |

All three took 4 rounds. Chromium page heap with the warm cache, after garbage collection: 6.0 to 5.0 MB (lower is better).

### Deep
- Found by profiling typing pauses at 2,040 pages. `writingPart` self time was 18 ms over 6 pauses, nearly all of it spent building the signature.
- `part.was` holds the limits key, id, name, ending, the paragraph texts and the choice wordings. Each is the page's own string, so a page that did not change compares by reference.
- `writing-cache-equiv.mjs` was blind to choice wording and to endings: its random generator's lowest bit only alternates, so two choices that read alike were never made. It now makes them (271 "alike" notes over the run). Breaking each comparison on purpose (wording, ending, limits, paragraph text, name) makes it fail.

## 2026-10-31 · Map views built ahead arrive as text

### Quick
The Map worker's answer for a view built ahead (PR 68) now comes back as JSON text instead of objects, and the story text is sent to the worker only when it changed. The page's thread spends much less time taking each answer in. The layouts are identical.

### Details
Main-thread cost of the first two views built ahead at start of a 2,040-page story. This is the time from the worker sending an answer to the page's handler starting (the browser's copy), plus the handler itself, summed over 2 answers. Early-stop A/B (5% limit), new/old, lower is better:

| Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|
| 0.39x (0.34-0.49), 4 rounds | 0.55x (0.41-0.63), 4 rounds | 0.47x (0.44-0.57), 4 rounds |

The same layout, sent four ways from a worker, median of 9 (page thread, ms, lower is better):

| Way | Chromium | Firefox | WebKitGTK |
|---|---|---|---|
| Objects (before) | 32.0 | 26.0 | 34.0 |
| Objects without the box lookup and centers | 26.1 | 23.0 | 25.0 |
| JSON text (chosen) | 10.9 | 10.0 | 14.0 |
| JSON as UTF-8 bytes, transferred | 12.9 | 14.0 | 15.0 |

Sending the story text once saves 2-5 ms of copying on the page per later view (Chromium 2.1-2.9 ms, WebKitGTK 2-5 ms).

### Deep
- A 2,040-page layout holds about 13,000 objects, 15,000 arrays and 36,000 strings. Copying objects rebuilds every one on the page's thread before the message event runs, in all three browsers. JSON.parse builds the same graph about 3 times faster.
- `mapPackPlain` (in the worker's function list) leaves out what the page rebuilds in a moment: `L.nodes`/`L.edges` (the same lists as the graph's), `L.pos`, `L._centers` (a lazy cache) and each waypoint's `edge` link back to its arrow. These are the only cycles. `mapUnpackPlain` puts them back with the same sharing.
- The worker keeps the last story text and parses it per job, so nothing it builds can leak from one job to the next. The page sends `{ forget: true }` once every view is ready, so the worker drops its copy. After a worker error the text is sent again.
- `map-worker-equiv.mjs` now compares the unpacked text answer with the Map tab's own build: 1,920 layouts (seed 7) and 3,840 (seed 11), with the story sent with the first job only and again after "forget".
- Tried: objects with the box lookup and centers left out (only 10-25% less), and UTF-8 bytes transferred (slower to decode than a string).

## 2026-10-31 · Crash-safe autosave copy (save-kit durableCopy)

### Quick
Every autosave is also written to IndexedDB with `durability: 'strict'` through save-kit 1.4.0's `durableCopy`. If the browser closed before its newest localStorage saves reached the disk, the next start brings the newer copy back through Open's swap-in path, with a notice; Undo shows the older copy. Approved by the owner with the notice.

### Details
- Crash test, Chromium 155.0.8059.39 (puppeteer, edit, wait 2 s, kill the browser, reopen; `bench/kill/kill.js`, 3 runs): today's editor lost the edit 3 of 3, with the copy it came back 3 of 3.
- Main-thread time of one autosave, 2,040 pages (1.8 MB), median of 12 (lower is better): 18.6-19.0 ms before, 17.3-17.5 ms with the copy (same within noise; the IndexedDB write runs off the page's thread).
- Packed editor 311,572 to about 312,400 bytes.

### Deep
- `editor/savekit-durable.js` is save-kit 1.4.0's durable part copied unchanged (checked against JS-modules main); it is first in `UI_PARTS`. One write at a time, only the newest waiting text is kept.
- Each save carries a number that only goes up (`max(Date.now(), last + 1)`), kept in localStorage (`story-editor-v1-seq`) and in the IndexedDB record. At start, after the first check, `safeCopy.newer(seq)` answers with a copy whose number is higher; it is used only if it differs from the open story, the story was not edited meanwhile, and it passes `savable`.
- The copy is opened at page load, before any save, so a save made before the check runs cannot cover up the newer copy.
- New suite `qa/crashsafe.js` (Firefox 158, Chromium 155, WebKitGTK 2.52.6): puts back an older localStorage save the way a crash leaves it (no save on the way out), and checks the edit comes back with the notice, the save then holds it, Undo shows the older copy, a normal reload changes nothing, and a copy older than the localStorage save is never used. The notice is checked from a log of every notice shown, since in Chromium it comes about 130 ms after load, before the page is ready to test.
- Firefox could not be kill-tested here (the hard-kill test needs a display for Firefox); research round 18 found IndexedDB kept every save in Firefox as well.

## 2026-10-31 · Start-up of big stories, page list rows, Safety space line

### Quick
Opening a big story does less work before the first screen. For a big saved story the typeface is made from its bytes before the first layout (as an @font-face it arrived just after it, and every text was laid out again). The first check of a story with 500 or more pages goes to the background checker; the writing checks fill in 6 ms slices after the first screen; three whole-page layouts at start are now one (the window width for menus, the page list's scroll and the phone keyboard lift were read too early); the keyboard lift sets its style only when it changes (setting it restyled every element). Page list rows are made again only when something they show changes. The Safety dialog's space line counts the autosave's real room. Everything on screen is the same.

### Details
Start of a big story, the freeze time (time to the first frame plus every later gap between frames over 50 ms in the first 3.5 s), new build over PR 69, early-stop A/B (`qa-guide/ab-sequential`, 90% interval, lower is better):

| Story | Chromium 155.0.8059.39 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| 2,040 pages | 0.29x (0.26-0.49), 4 rounds | 0.59x (0.48-0.67), 4 rounds | 0.82x (0.77-0.87), 4 rounds |
| 510 pages | 0.64x (0.51-0.87), 4 rounds | | |
| 51 pages | 1.04x (0.81-1.15), 16 rounds, noisy | 0.55x (0.32-0.93), noisy | 0.96x (0.91-1.08), 16 rounds, noisy |

The 51-page story takes the same path as before (no early typeface), so its results are noise; an A-against-A control in Firefox gave 0.84x (0.80-0.98).

- Typing in a page's name box at 2,040 pages, the input handler's median of 40 keys (lower is better): Chromium 38.1 to 3.3 ms, Firefox 36 to 2 ms, WebKitGTK 48 to 4 ms.
- 51-page and 510-page stories: no change beyond noise in the three browsers.
- Safety space line: the sum of UTF-8 bytes of every localStorage key and value against 5 MB (5,242,880 bytes), the same count all three browsers use (research round 12). `storage.estimate()` reports other storage and a quota of gigabytes.

### Deep
- The first check of a story with 500 or more pages counts as slow (`CHECK_BIG_PAGES`), so it goes to the worker like any check that took longer than the hybrid limit. `writingWarmSoon()` (200 or more pages) fills the per-page writing cache in 6 ms slices from a timer, so the first Check tab or status line read finds it warm; `writingChecks` uses the same `writingLimits` and `writingPart` as before, checked equal to the old helpers on 19 slices.
- Forced layouts were found by tracing with `disabled-by-default-devtools.timeline.stack`: `window.innerWidth` read at load for the menus (now read when a menu opens), `ul.scrollTop = 0` and the open page's in-view check in `renderSide` (now in `sideScrollFix` before the next frame, and a zero scroll is not set on a new list), the item list's zero scroll, and the visualViewport lift (now before the first frame and only on change; setting `--kb` on the root restyled the whole page, 85 ms at 2,040 pages).
- Page list rows are kept in a WeakMap by page with a key of everything a row shows; unchanged rows are reused, and the list is rebuilt in order only when rows move.
- Typeface: `#font-ui` is now `<script type="text/plain">` (exported games still copy its @font-face text). When the saved story is 200,000 characters or more (`UI_FONT_BYTES_FROM`), `loadUiFont` decodes the base64 and adds `new FontFace(name, bytes)`, which is ready at once in all three browsers (2 to 6 ms); otherwise it adds the @font-face style as before. Found with invalidation tracking: "Fonts changed" on every text node, 55 to 137 ms of layout at 2,040 pages in Chromium. The first check's answer leaves the writing notes to the warm-up's last slice (handling it went from 20-34 to 10-15 ms in Chromium).
- QA: `packages/qa-kit` 0.3.0 runs the suites of one browser as a longest-first pool by saved times (the QA thread's patch; a zero time no longer counts as unknown), with two new kit tests; both runners read the committed `editor/qa/times-seed.json` when there is no `times.json` yet (a cold quick run 98 s to 75 s in the QA audit).
- Tried and dropped: `content-visibility: auto` on page list rows. It helped while the start had three layouts, but after the merge into one it made no difference in Chromium or Firefox, and WebKitGTK showed its first screen 200 to 300 ms later with it.
- Test harness: `qa/helpers.js` now seeds the story from the test and reloads, with no start-up script. In Chromium a script injected at the start of a file page can see an old copy of the storage after a reload (research round 18); "the ignored note is remembered" failed about 1 in 6 runs before and passed 10 of 10 after.
- Not changed (on a card): the first layout costs about 60 ms even with a 51-page story, so no block under 50 ms needs the start to be split behind the opening screen, which would show the page filling in.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `helpers`, `phone`, `screens`, `round3`, `mapcull`, `mapprebuild`, `textstress`, `top5-new`, `fix2`, `inter`, `marks`, `opts`, `real`, `tools8`, `top10-editor`, `top10-export`, `write1`, `write2`, `checkworker`, `curtext` and `safety` pass in all three; `npm test` passes.

## 2026-10-31 · Hidden per-keystroke and memory costs

### Quick
A keystroke no longer redoes whole-story work. The saved story text is spliced (only the edited page's JSON piece is rewritten, and "did anything change" is compared at the size of one page); Undo keeps the newest step whole and older ones as differences; the story fingerprint (`sigOf`) remembers its last text; the writing checks keep each page's part until that page changes; the autosave does not parse text the editor built itself. The checker's WebAssembly memories are let go when a small story follows a big one, and at once on the page when the worker takes over. Everything is identical: the saved text, Undo, the History list, every note and check.

### Details
Editor's own work per keystroke (input handler, 40 keys), 316-page test story, median of 3 alternating rounds, before to after (lower is better):

| Measure | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Typing in one paragraph | 5.98 to 4.99 ms | 7.17 to 5.60 ms | 11.62 to 8.18 ms |
| Each key a new undo step (two fields in turn) | 3.95 to 2.66 ms | 4.28 to 3.05 ms | 6.83 to 4.90 ms |
| 34-page example, typing in one paragraph | 1.54 to 1.26 ms | 1.45 to 1.50 ms (timer is whole ms) | 2.40 to 1.90 ms |

- 2,040 pages (research round 14's `ty.js`, Chromium, 2 rounds): key to frame median 24.3-28.3 to 18.0-18.2 ms, worst 35.6-38.2 to 26.2-30.4 ms, longest freeze after the pause 170-235 to 52-63 ms. Firefox could not be driven by that tool here (it needs a display).
- JavaScript heap after 80 edits in the 316-page story (Chromium, after a forced garbage collection): 21.9 to 6.1 MB.
- Checker WebAssembly memory with the shared hook (`round7-elias-fano-trim/survey/hook.js`, `WASM_MEM.gc()` then `WASM_MEM.all()`), small 400 x 700 window, a 300-page generated story then the 34-page example: page 10.5 to 2.1 MB, worker 11.5 to 3.1 MB, total 22 to 5.2 MB (the 16 MB baseline). Real renderer memory (RssAnon, Chromium): 126 to 121 MB.
- Check after an edit: no change beyond noise in 3 browsers (7 story sizes, 3 rounds, plus a 4-round Chromium recheck).

### Deep
- Splice: `storyText()` stringifies each passage on its own and the outer object with a marker in place of `passages`, so the result equals `JSON.stringify(project)` and `cutAt` knows each page's offsets. `pageEdit(page)` (text, heading, name and choice-wording handlers pass their page to `commit`) re-stringifies that page and splices it in; it falls back to the whole text when the passages array or `cur` changed under it. New suite `qa/curtext.js` types in four kinds of fields on 6 pages with a new page, Undo and Redo mixed in, and checks `cur === JSON.stringify(project)` after every step, that the save equals the story and that 40 Undos stay exact (3 browsers).
- Undo: `pushUndo` turns the old top into `{ a, b, m }` (shared start and end lengths, its own middle) against the new step, found with 2 KB native slice compares and then letter by letter; `popUndo` makes the next one whole; `undoText(i)` rebuilds any step for `stepInfo` and History. The 24 M-character budget still counts each step at its whole size, so exactly the same steps are kept. New test `editor/undo-delta-equiv.mjs` (in `npm test`): 3,000 single differences and 5,339 undo steps over 8,000 random pushes and pops against plain copies; it fails if a pop does not rebuild or the budget drifts.
- Memory: `klWalkTrim` / `klGraphTrim` start a fresh instance of the compiled module when memory is over 4 MB (walk) or 2 MB (graph) and 4 times what 3 calls in a row needed (one check can walk twice with different limits, so one small call is not enough); `klCheckRelease()` does it at once when the worker's answer arrives. New test `editor/walk-trim-equiv.mjs`: 108 checks of 36 mixed stories against a checker that never lets go, 0 differences, 19 memories let go, small stories after big ones hold no more than a fresh checker. Tried and dropped: sizing the walk's tables to 4 times the last count with a full-size retry. It cut only reserved, untouched pages (resident memory the same) and made the first check after opening a much bigger story 10 to 25% slower.
- Writing checks: `writingPage` holds one page's notes (before the ignore list) and its capitalized and lower-case words; `writingChecks` replays them in page order, so the spelling check's first-seen order and 1,500-name cap are unchanged. A page's part is reused while a signature of its id, name, ending, texts, choice wording and the limits is the same. New test `editor/writing-cache-equiv.mjs`: 1,200 random edits in 30 stories, cached against uncached; the same run was also checked once against the previous `helpers.js`.
- Found while testing, not caused by this change: in headless Chromium on a file page, a quick reload sometimes started from storage without the newest writes (the spare copy and a just-saved setting both gone), so `qa/helpers.js` "the ignored note is remembered" fails now and then, in the previous build too (1 of 8 under load). Left for the storage work.
- **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `curtext`, `undohist`, `write1`, `write2`, `helpers` (see above), `checkworker`, `walk`, `reachability`, `mapprebuild`, `mapkey` and `phone` pass in all three; `npm test` passes. Packed editor 309,335 to 310,755 bytes.

## 2026-10-31 · Checker pruned-first hint and Map views built ahead

### Quick
`analyze` remembers whether the last check of a story with numbers needed the pruned check, and if so runs it first instead of a plain check to `PRUNE_AFTER` that is thrown away. The Map's background worker now builds the other plain views (flow, top-down, spine) after the one you last used, also while the Map is open, so switching views finds them ready.

### Details
Check after an edit, median of 3 alternating rounds (Firefox 6), before to after (lower is better):

| Story | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| Generated 300 pages, 8 objects, 3 numbers (stops at 200,000 situations) | 28.2 to 23.5 ms | 26.6 to 21.4 ms | 29.2 to 25.8 ms |
| Generated 100 pages (78,726 situations) | 26.3 to 25.4 ms | 31.4 to 28.4 ms | 31.0 to 29.4 ms |

Stories under 20,000 situations or without numbers take the old path and are unchanged. Longest frame gap after picking another Map view, 300-page story, advanced Map on, median of 3 pages: top-down 53 to 24 ms (Chromium), 58 to 50 ms (Firefox), 404 to 322 ms (WebKitGTK); spine 51 to 22, 55 to 34, 299 to 269 ms.

### Deep
Pruning only merges situations, so a pruned check that passes `PRUNE_AFTER` (or stops at the limit) proves the plain check would have passed it too, and the plain-first order would have returned this very pruned answer; otherwise (the story shrank) the old order runs. New test `editor/prune-hint-equiv.mjs` (in `npm test`): 48 random stories, 28 over `PRUNE_AFTER`, checked with the hint on and off against the plain-first order, 0 differences; it fails if the hint answer is always returned. The worker source declares the hint too. The 300-page test story was also run to 5,000,000 situations (pruned and plain) and still did not finish, so no exact reduction can finish it at typing speed; its "did not finish" note stays. The Map chain builds one view at a time and starts the next on each answer, kept or dropped; a view drawn meanwhile or a changed story drops a result as before. `qa/mapprebuild.js` now checks all three views equal the usual build and that an edit rebuilds all three; `__editor.mapView(v)` was added for the suites. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `mapprebuild`, `mapkey`, `mapcull`, `checkworker` and `walk` pass in all three; `npm test` passes.

## 2026-10-31 · Story Page Map graph build

### Quick
`mapGraph` and `mapSizeNodes` do less work: no reach search unless a Given is picked, one-next/one-previous run detection instead of Sets, arrow merging in a nested Map instead of string keys, a plain loop for box sizes, and boxes created with every field the layout fills in. Drawings are identical.

### Details
Warm layout build, median of 3 alternating rounds, before to after (lower is better):

| Story, view | Chromium 155 | Firefox 158 | WebKitGTK 2.52.6 |
|---|---|---|---|
| 316 pages, flow | 2.58 to 2.44 ms | 3.10 to 3.00 ms | 3.33 to 2.88 ms |
| 316 pages, top-down | 2.70 to 2.51 ms | 2.95 to 2.82 ms | 3.12 to 2.63 ms |
| 34-page example, flow | 0.31 to 0.25 ms | 0.34 to 0.27 ms | 0.24 to 0.18 ms |
| 51-page example, flow | 0.41 to 0.35 ms | 0.43 to 0.40 ms (4-round recheck) | 0.34 to 0.29 ms |

- `map-golden.mjs` now also covers the filtered path (a third of the stories pick a Given), regenerated from the previous code; 0 differences.
- `story-map` 1.0.6 to 1.0.7 (no change in what it gives).

### Deep
Five ideas, each alone and all together (three browsers, one at a time, 3 alternating rounds). Alone, every one is inside the noise in at least two browsers (316 pages flow, Chromium / Firefox / WebKitGTK: reach skip 2.69 / 3.13 / 2.88 ms; run detection 2.54 / 3.47 / 3.03; nested Map merge 2.62 / 3.10 / 3.04; sizing loop 2.44 / 3.05 / 3.15; pre-shaped boxes 2.48 / 3.33 / 3.27); together they give the 5 to 28% above in Chromium and WebKitGTK. Firefox's 51-page number was 0.43 to 0.83 ms in the first 3 rounds (one slow round), so it was rerun for 4 rounds: 0.43 to 0.40 ms; its 316-page flow row is within plus or minus 5% across runs. The browser bench now passes no Given pick (`as: {}`), the case the Map tab uses unless the reader picks one, so the reach skip is measured where it applies. Node profile that pointed here (316 pages): `mapGraph` was about 0.68 ms of 4.1 ms outside `mapImportance`, with the run Sets (0.21 ms) and the arrow merge (0.19 ms) the largest parts. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `mapcull`, `mapprebuild` and `mapkey` pass in all three; `npm test` passes (including `map-golden`, `map-worker-equiv`, `choke-equiv`).

## 2026-10-31 · Landing page and README: what it is and why it exists

### Quick
"What it is and how it works" is a one-line summary plus four one-line bullets (write, check, see, share); "Why it exists" is one short paragraph (why branching stories break, why rules are data instead of code, why one offline file) plus six one-line use cases. A first, longer version (PR 65) was cut to this the same night as too dense.

### Details
- Landing page: new `.steps` and `.uses` list styles; section order and headings unchanged.
- README: the same text, keeping the download note and the link to `docs/FORMAT-COMPARISON.md`.

### Deep
Every claim is one the page or the code already backs: the 200,000-situation limit, the 25 to 50 KB games, the Twine 1/2 and Twee 3 import, the choke-point and simulated-player Map views, and the MIT packages. The comparison with other tools is kept to "most story tools leave this to playtesting or random test runs", matching the sourced table in `docs/FORMAT-COMPARISON.md` (ChoiceScript's Quicktest and Randomtest are not guarantees by their authors' own account). **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `landing` passes in all three; docs drift check passes.


### Quick
Ordering and crossing counts run on flat number lists with a faster crossing tally, and the line-up step works on reused number buffers and stops as soon as a round moves nothing. Drawings are identical; a 316-page story is laid out 17 to 29% faster than after the previous release, small stories 18 to 59%.

### Details
- Layout build (`mapBuildPlain`), warm, median of 3 alternating rounds, before to after, 316 pages flow view: Chromium 155.0.8059.39 3.44 to 2.62 ms, Firefox 158.0 4.30 to 3.58 ms, WebKitGTK 2.52.6 4.37 to 3.10 ms; top-down view 3.19 to 2.58 / 4.07 to 3.50 / 4.20 to 3.10 ms. 34-page example: 0.35 to 0.28 / 0.84 to 0.37 / 0.30 to 0.19 ms; 51-page example 0.47 to 0.39 / 1.18 to 0.48 / 0.50 to 0.35 ms.
- Every drawing is identical: 1,800 layouts compared with the previous code (seeded stories of 10 to 250 pages, three views, with and without last time's order), 0 differences.
- New permanent test `editor/map-golden.mjs`: 360 drawing fingerprints written by the previous code, in `npm test`. It fails when one coordinate moves by a billionth.
- `story-map` 1.0.5 to 1.0.6 (no change in what it gives).

### Deep
The rule for this round: retest the ideas dropped earlier, alone and then all together, on the guess that together they beat the sum of the parts. Four pieces: (1) ordering on flat typed arrays (positions, lanes and barycenters by node index, neighbor lists in CSR form), dropped in the previous release as inside the noise; (2) the crossing count between two layers with the Barth-Jünger-Mutzel accumulator tree over lower positions sorted per upper node, instead of comparing edge pairs; (3) the PAVA line-up (`placeFlat`) on reused Float64 buffers, with the very same additions in the same order as `mapPlaceLine`; (4) an exact early stop in placement: once one round of each kind (up/down and both ways) changed nothing, later rounds cannot change anything either, so they are skipped. Alone, 316 pages flow, Chromium / Firefox / WebKitGTK: (2) 2.73 / 4.25 / 3.93 ms; (1)+(2) 2.67 / 3.23 / 3.50; (3)+(4) 3.01 / 4.63 / 4.29; (1) alone was inside the noise last time. All four: 2.62 / 3.58 / 3.10. Flat ordering alone did nothing, but with the accumulator count on the same flat lists it gives Firefox its biggest gain (34-page example 0.84 to 0.37 ms), so the dropped idea paid off only stacked. The Firefox 316-page number varies most between rounds (a 4-round recheck gave 22% and 15%). Also tried and dropped: skipping situations whose items can no longer matter in the checker (2% fewer situations on the 51-page example, but it changed the checker's notes, so unsafe). **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: `mapcull`, `mapprebuild`, `mapkey`, `bugs12` and `screens` pass in all three; `npm test` passes (including `map-golden`, `map-worker-equiv`, `choke-equiv` and packages up to date).

## 2026-10-31 · Story Page Map layout

### Quick
The Map's layout does less repeated work: choke points are found with one dominator pass instead of a search per page, and the order, placement and route-share passes skip or flatten repeated work. The drawings are identical; a 316-page story is laid out 15 to 20% faster, small stories up to 30%.

### Details
- Layout build (`mapBuildPlain`, flow view), warm, median of 3 alternating rounds, before to after: 316 pages Firefox 158.0 5.35 to 4.25 ms, Chromium 155.0.8059.39 4.01 to 3.26 ms, WebKitGTK 2.52.6 5.47 to 4.35 ms; 51-page example 0.84 to 0.58 / 0.56 to 0.44 / 0.70 to 0.49 ms; 34-page example 0.61 to 0.47 / 0.36 to 0.30 / 0.41 to 0.29 ms. First call in a fresh page, 316 pages: 15 to 13 / 18.3 to 14 / 12 to 9 ms.
- Every picture is identical (positions, arrow points, crossings, size) on the three examples in the flow, top-down and spine views.
- `mapImportance` choke points: Cooper-Harvey-Kennedy dominators on flat number lists (about 15% of the layout time before). Alone it is the biggest single piece: Chromium 316 pages 4.01 to 3.34 ms; in Firefox and WebKitGTK it is inside the noise (about 8%) until stacked.
- Editor +1,287 bytes. `story-map` 1.0.4 to 1.0.5 (no change in what it gives).

### Deep
Six changes, each measured alone and then all together (three browsers, one at a time, alternating builds, 3 rounds): (1) `transpose` skips a layer whose own order and both neighbor layers' orders have not changed since it last found nothing to swap (`ver`, `settled`), the idea from netflow-sankey 2.3.2; (2) a pair's swap decision is kept for the rest of one `transpose` call (`kept`), also from netflow-sankey 2.3.2; (3) the ordering rounds stop when an ordering returns that an earlier round or the start already had, because a round is decided by the orderings alone (the idea behind netflow-sankey 2.3.1's skipped repeats), which also avoids the last crossing count; (4) placement runs on flat number lists, with each layer's gaps and choke flags worked out once instead of every round (same additions in the same order); (5) the choke points are the dominators of a made-up page every goal page leads to, found by one iterative pass in reverse finishing order, so a page is a choke point when it dominates it (before, one search per reached page that stopped at the first goal page); (6) the route shares (`traffic`) are counted on flat number lists in the old order. Alone, in the browsers: (1), (2) and (4) are inside the noise; (3) saves 10 to 25% on the 34- and 51-page examples in Chromium and WebKitGTK and nothing on 316 pages; (5) is the one clear single gain on 316 pages in Chromium; (6) is inside the noise. All six together are 14 to 35% faster warm on every story, view and browser, more than the sum of the parts for the small examples, which is why the small ones gain most. Tried and not adopted: ordering on flat typed arrays (`sweep`, `transpose` and the crossing count on index lists, identical pictures, inside the noise; it conflicts with (1) to (3), which need the object layout). Proofs: `choke-equiv.mjs` (5,513 random stories, 93,497 pages, 10,821 choke points) now also compares the route shares to the plain way to the last digit, and fails on a deliberately wrong dominator chain or a changed sum; pictures compared with a position hash against the previous layout on the three examples in three views, and the stack against the old code on 3,203 stories' importance output (0 differences). Profile that pointed here (Node, 316 pages, 7.1 ms per layout): `mapImportance` 15%, `mapCrossPairs` and `totalCross` about 12%, placement about 14%, ordering about 12%. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6: picked run 45 of 45 pass in Firefox; `mapcull`, `mapprebuild`, `mapkey`, `bugs12` and `screens` pass in all three; `npm test` passes (including `map-worker-equiv`, `choke-equiv` and packages up to date).

## 2026-10-31 · PR 61

### Quick
**typing path and landing numbers.** `renderTop` (`editor/ui5-app.js`) rebuilds the totals line only when a signature of the stats changes

### Details
- Chromium profile of typing in a 100-page story: `renderTop` 2.4 to 2.5% of time down to 1.4 to 1.7%, about 0.5 ms of roughly 7.8 ms a keystroke (5.5 ms is the browser's layout and paint, the checker about 0.05 ms).
- Chromium 155.0.8059.39 / Firefox 158.0 / WebKitGTK 2.52.6): 34-page example after an edit 0.67 / 0.70 / 0.73 ms (before 1.51 / 1.67 / 2.16); 316-page test story 6.84 / 7.31 / 7.23 ms (before 9.58 / 9.14 / 12.0);
- JavaScript only, 316 pages 33 / 47 / 43 ms; new row for a 100-page story 30 / 28 / 30 ms.
- Tiles now say 24,313 situations in 7 ms and 4.9 to 6.4 times faster; bars redrawn.

### Deep
PR 61 (merged 2026-10-31 as 62002d3, owner tapped Merge it): **typing path and landing numbers.** `renderTop` (`editor/ui5-app.js`) rebuilds the totals line only when a signature of the stats changes; `storyStats` (`editor/core.js`) remembers each heading, paragraph and choice label's word count in a WeakMap (`klWordCount`) until that text changes. Chromium profile of typing in a 100-page story: `renderTop` 2.4 to 2.5% of time down to 1.4 to 1.7%, about 0.5 ms of roughly 7.8 ms a keystroke (5.5 ms is the browser's layout and paint, the checker about 0.05 ms). Landing page and README checker rows measured again 2026-10-31 (average of many repeated checks, previous build vs this build alternating, median of 3 rounds; Chromium 155.0.8059.39 / Firefox 158.0 / WebKitGTK 2.52.6): 34-page example after an edit 0.67 / 0.70 / 0.73 ms (before 1.51 / 1.67 / 2.16); 316-page test story 6.84 / 7.31 / 7.23 ms (before 9.58 / 9.14 / 12.0); JavaScript only, 316 pages 33 / 47 / 43 ms; new row for a 100-page story 30 / 28 / 30 ms. Tiles now say 24,313 situations in 7 ms and 4.9 to 6.4 times faster; bars redrawn. The old rows used a different timing method, so old and new are not a like-for-like pair. Editor +108 bytes. Picked run Firefox 158.0 49 of 49 pass; phone, write1, screens, top10-editor and landing pass in all three browsers; docs-drift ok (it was failing on main for a removed file name). **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6.

## 2026-10-31 · PR 60

### Quick
The "come back for it" pass in the checker goes through the move graph once: a 100-page story is checked about 30% faster, with identical answers.

### Details
- Labels and notes identical (`wasm-equiv` 400 stories seed 5: 1,313 comparisons, 0 differences, 177 stories with missed-choice notes, 5 full batches of 32). 100-page generated story (78,726 situations, 206,025 moves): `firstCuts` 23.4 to 7.8 ms Firefox 158.0, 20.3 to 7.3 ms Chromium 155.0.8059.39; whole check 39.6 to 28.2 / 45.2 to 30.4 / 42.2 to 30.0 ms (Firefox / Chromium / WebKitGTK 2.52.6), median of 3 alternating rounds; 50 pages 80 to 88%; 300 pages (limit hit, no graph) unchanged.
- Editor +440 bytes; checkgraph.wasm 1,646 to 2,279.

### Deep
PR 60 (merged 2026-10-31 as aa9c25d, owner tapped Merge it): `firstCuts` in `wasm/checkgraph.c` (the "a player who arrives without it can never come back for it" pass) finds the move graph's strongly connected parts once (iterative Tarjan, 6 scratch lists of n numbers) and passes the 32-bit label sets through them in order, each move used once, instead of a repeating work queue. Labels and notes identical (`wasm-equiv` 400 stories seed 5: 1,313 comparisons, 0 differences, 177 stories with missed-choice notes, 5 full batches of 32). 100-page generated story (78,726 situations, 206,025 moves): `firstCuts` 23.4 to 7.8 ms Firefox 158.0, 20.3 to 7.3 ms Chromium 155.0.8059.39; whole check 39.6 to 28.2 / 45.2 to 30.4 / 42.2 to 30.0 ms (Firefox / Chromium / WebKitGTK 2.52.6), median of 3 alternating rounds; 50 pages 80 to 88%; 300 pages (limit hit, no graph) unchanged. Editor +440 bytes; checkgraph.wasm 1,646 to 2,279. Picked run Firefox 44 of 44; walk, reachability, checkworker pass in 3 browsers.

## 2026-10-31 · PR 59

### Quick
The checker remembers each paragraph's word count, quote marks and sentences until it changes: the 34-page example is checked about twice as fast after an edit, with identical answers.

### Details
- Check after a one-paragraph edit, alternating, median of 3 rounds, PR 58 build vs this build, Firefox 158.0 / Chromium 155.0.8059.39 / WebKitGTK 2.52.6: 34-page example 1.26 to 0.64 / 1.27 to 0.84 / 1.90 to 0.88 ms; generated one-word-paragraph stories within noise (74 to 113%).
- Editor +324 bytes.

### Deep
PR 59 (merged 2026-10-31 as 9ef74d1, owner tapped Merge it): the checker remembers per-paragraph facts between checks (`klTextFacts`: placeholder word, straight/curly quote, word count, sentences of 25+ characters, kept in a WeakMap keyed by the block, choice or page; `klRepeatWord` per page), so an edit rescans only the changed text. Also carried in the background checker's text. Check after a one-paragraph edit, alternating, median of 3 rounds, PR 58 build vs this build, Firefox 158.0 / Chromium 155.0.8059.39 / WebKitGTK 2.52.6: 34-page example 1.26 to 0.64 / 1.27 to 0.84 / 1.90 to 0.88 ms; generated one-word-paragraph stories within noise (74 to 113%). Editor +324 bytes. New round3 check: answers after edits equal a fresh copy's (fails when the memory is broken). Picked run Firefox 47 pass, 1 flaky-then-pass (screens), 0 fail; round3, checkworker, walk, top10-player, landing pass in 3 browsers.

## 2026-10-31 · PR 58

### Quick
The WebAssembly walk's situation table no longer clears 2 MB on every check: a 5-page story is checked up to 6 times faster.

### Details
- Check time per call, alternating base vs new, median of 3 rounds, Firefox 158.0 / Chromium 155.0.8059.39 / WebKitGTK 2.52.6: 5 pages 0.43 to 0.054 / 0.39 to 0.070 / 0.48 to 0.16 ms; 34-page example 1.64 to 1.36 / 1.54 to 1.23 / 2.20 to 1.94 ms; 100 and 300 pages within noise (91 to 105%).
- Editor +317 bytes; checkwalk.wasm 3,711 to 4,017 and checkwalk64.wasm 3,743 to 4,050 (limit 4,096).

### Deep
PR 58 (merged 2026-10-31 as 8ff7083, owner tapped Merge it): the WebAssembly walk's situation table no longer clears 2 MB on every check. It starts at the size the last walk with the same limit needed (at least 1,024 slots) and doubles when half full (`HASHMAX` replaces an unused control slot; exit flags are set when a situation is made). Check time per call, alternating base vs new, median of 3 rounds, Firefox 158.0 / Chromium 155.0.8059.39 / WebKitGTK 2.52.6: 5 pages 0.43 to 0.054 / 0.39 to 0.070 / 0.48 to 0.16 ms; 34-page example 1.64 to 1.36 / 1.54 to 1.23 / 2.20 to 1.94 ms; 100 and 300 pages within noise (91 to 105%). Editor +317 bytes; checkwalk.wasm 3,711 to 4,017 and checkwalk64.wasm 3,743 to 4,050 (limit 4,096). Also: the background checker's text lacked the new table memory and silently fell back to the JavaScript walk (found before merge, fixed); `check-worker-equiv.mjs` now compares WebAssembly use in the worker with the page and is part of the picked run. Picked run 43 of 43 plus worker, fuzz1, top10-player in 3 browsers.

## 2026-10-30 · PR 57

### Quick
The landing page is the site root (`index.html`, https://lfcfoundry.github.io/story-editor/) and the editor moved to `play/index.html`...

### Details
- Old `/about.html` is gone and the old editor address now shows the landing page (no copies kept: 30 KB and 300 KB).

### Deep
PR 57 (merged 2026-10-30 as 618daf4, owner tapped Merge it): the landing page is the site root (`index.html`, https://lfcfoundry.github.io/story-editor/) and the editor moved to `play/index.html` (https://lfcfoundry.github.io/story-editor/play/), unchanged (still the copy from PR 49, not refreshed). "Open the editor" buttons, README, llms.txt, FOUNDATION and the landing check (`editor/qa/landing.js` reads `index.html`) use the new addresses. Old `/about.html` is gone and the old editor address now shows the landing page (no copies kept: 30 KB and 300 KB). Landing check passes in Firefox 158.0, Chromium 155.0.8059.39, WebKitGTK 2.52.6. No speed paths touched.

## 2026-10-30 · PR 56

### Quick
Map toolbar stays on one row on medium windows. Between 701 and 1279 px wide the long names switch to short ones (Good/Bad, Playtest, Compare; full names stay in tooltips and...

### Deep
PR 56 (merged 2026-10-30 as 624b900, owner tapped Merge it): Map toolbar stays on one row on medium windows. Between 701 and 1279 px wide the long names switch to short ones (Good/Bad, Playtest, Compare; full names stay in tooltips and aria-labels) and the search box narrows; one row (32 px) now holds down to about 1000 px, before about 1280 px (66 px, two rows at 1000 px); below about 900 px it still wraps. Phones and wide windows unchanged. `editor/ui4-map.js` full/short spans, one media rule in `editor/ui.css`. Picked run Firefox 158.0: 45 of 45 pass; mapkey, mapcull, screens, phone, landing pass in Firefox 158.0, Chromium 155.0.8059.39, WebKitGTK 2.52.6 (15 of 15). No speed paths touched, nothing timed. Before/after pictures: a maintainers' folder

## 2026-10-30 · PR 55

### Quick
Checker shows a quiet "repeated sentence" note (`editor/core.js`, sentences of 25+ letters per page; skips "otherwise" chains and needs/forbid-exclusive blocks); test in...

### Deep
PR 55 (merged 2026-10-30 as b4bdeea, owner tapped Merge it): checker shows a quiet "repeated sentence" note (`editor/core.js`, sentences of 25+ letters per page; skips "otherwise" chains and needs/forbid-exclusive blocks); test in `editor/qa/round3.js`; `story-check` package regenerated (version still 1.1.0); `npm test` green.

## 2026-10-30 · PR 54

### Quick
Logo and Story Editor name in the page header below the badges like Apple Press; "Why it is this fast" paragraph (no bullets, owner asked) after the measures table on the page...

### Deep
PR 54 (merged 2026-10-30 as fd76716, owner tapped Merge it): logo and Story Editor name in the page header below the badges like Apple Press; "Why it is this fast" paragraph (no bullets, owner asked) after the measures table on the page and README; landing check updated; Drowned Archive rebuilt as a real story.

## 2026-10-29 · PR 53

### Quick
Landing page `about.html` (Pages path /story-editor/about.html; the editor stays the Pages root) and a new README top (what it is, why it exists, highlights; the rest of the...

### Details
- Tightened on the owner's card tap (2026-10-29 7:10 PM Eastern): landing page and README now carry measured numbers (checker 13-14 ms for 24,313 situations on 316 pages in all 3 browsers, 4.7 to 6.6 times faster with WebAssembly, Map, start-up, sizes), plain descriptions of objects and states, the advanced features and what the checker covers, and links to two playable examples under `examples/`.
- Logo added to the hero on the owner's request (2026-10-29 7:2x PM Eastern): the editor's own logo, drawn in once, still under reduced motion;
- Drowned Archive repeated sentences fixed in `editor/massive.js` (generator picked the same line twice per page and reused lines down corridors), new `tools/example-prose.mjs` in npm test, Archive .story.json added, game rebuilt (45 KB).

### Deep
PR 53 (merged 2026-10-30 as 1361ee0, owner tapped Merge it): landing page `about.html` (Pages path /story-editor/about.html; the editor stays the Pages root) and a new README top (what it is, why it exists, highlights; the rest of the README unchanged); claims checked (export size 42 KB for the Keeper's Light, 43 KB for the massive example, against "about 25 to 50 KB"); new check `editor/qa/landing.js` passes in 3 browsers; twine-import rebuilt as 1.0.1 (the nesting limit from PR 51 had not been regenerated, so `npm test` "packages up to date" was red on main; my miss in PR 51). JS-modules' version table still lists twine-import 1.0.0 and needs its owner to refresh. Tightened on the owner's card tap (2026-10-29 7:10 PM Eastern): landing page and README now carry measured numbers (checker 13-14 ms for 24,313 situations on 316 pages in all 3 browsers, 4.7 to 6.6 times faster with WebAssembly, Map, start-up, sizes), plain descriptions of objects and states, the advanced features and what the checker covers, and links to two playable examples under `examples/`. Logo added to the hero on the owner's request (2026-10-29 7:2x PM Eastern): the editor's own logo, drawn in once, still under reduced motion; `landing.js` now checks it is visible, at least 80 px tall and above the first section. 2026-10-29/30 (owner asks): Why it exists under What it is; examples with illustrations, premise, length, screenshots and the Story Page Map picture; numbers outside short bars; compatibility box first; logo in its own band above What it is (title stays text); Drowned Archive repeated sentences fixed in `editor/massive.js` (generator picked the same line twice per page and reused lines down corridors), new `tools/example-prose.mjs` in npm test, Archive .story.json added, game rebuilt (45 KB).

## 2026-10-26 · PR 52

### Quick
`editor/qa/real.js` drags wait for the page's own dragstart and dragover events in Chromium, and the checker-notes check waits for the notes instead of 800 ms.

### Deep
PR 52 merged (01bc7e4) by the auto-merge rule (test file only, no app change, all 3 browsers pass): `editor/qa/real.js` drags wait for the page's own dragstart and dragover events in Chromium, and the checker-notes check waits for the notes instead of 800 ms. Cause of the old flake: Playwright's Chromium drag code decides a drag started with a zero-delay check, so a late dragstart under load means no drag events. 0 failures and 0 retries in 48 whole-suite runs under load (about 4% of single drags failed before). `real` chromium takes about 20 s instead of 16 s.

## 2026-10-25 · PR 51

### Quick
Twine reader refuses code nested over 300 levels (`TWINE_MAX_NEST` in `editor/twine.js`) with the same plain message, 17 ms every time (was 17 ms to 8 s, depending on how warm...

### Deep
PR 51 merged (6ddc091) on the owner's tap ("Merge it"): Twine reader refuses code nested over 300 levels (`TWINE_MAX_NEST` in `editor/twine.js`) with the same plain message, 17 ms every time (was 17 ms to 8 s, depending on how warm the engine was); smaller things in the checks: `mapcull` takes pictures until two in a row match, `twine-diff` keeps damaged-file failures apart from story differences, `real` prints a note when a drag needed a retry. Checks twine, twine-diff, mapcull, real pass in 3 browsers.

## 2026-10-25 · PR 50

### Quick
File, Options and the phone ⋯ menus scroll and stay above the bottom bars (max height, z-index 40; was 777 px tall in a 700 px viewport)

### Details
- Options "Writing text size" is a row of four buttons S/M/L/XL, menu stays open, replaces cycling; new File entry "Massive example: The Drowned Archive" (`editor/massive.js`, seeded, 316 pages, 16 items, 15 endings, check 72 ms, 0 problems) beside "Example story: The Keeper's Light"; new `screens` suite; long menus also show a soft fade and a ▾ arrow while more entries wait below (asked for because Advanced… sat out of sight at the bottom).
- Full run Firefox+Chromium 93 suites, WebKitGTK 43, 0 FAIL, 3 pass* registered.

### Deep
PR 50 merged (e9065a0) on the owner's tap ("Merge it"), after "Add it" for the fade: File, Options and the phone ⋯ menus scroll and stay above the bottom bars (max height, z-index 40; was 777 px tall in a 700 px viewport); Options "Writing text size" is a row of four buttons S/M/L/XL, menu stays open, replaces cycling; new File entry "Massive example: The Drowned Archive" (`editor/massive.js`, seeded, 316 pages, 16 items, 15 endings, check 72 ms, 0 problems) beside "Example story: The Keeper's Light"; new `screens` suite; long menus also show a soft fade and a ▾ arrow while more entries wait below (asked for because Advanced… sat out of sight at the bottom). Full run Firefox+Chromium 93 suites, WebKitGTK 43, 0 FAIL, 3 pass* registered.

## 2026-10-24 · PR 49

### Quick
"Why?" button in the Check report for passages the checker proves unreachable (opens the existing why-dialog); story-check 1.1.0 (problems from the unreachable-page rules carry...

### Details
- `npm test` green (27 s).
- Full run Firefox+Chromium 93 suites (92 pass, 1 retry: `real` Chromium, six drag checks in a row failed once, passed on retry, 3 of 3 clean alone; registered in the flaky register, cause unproven, Write-tab drag code untouched by this PR), WebKitGTK 43 suites 0 failed, 0 flaky; wall 246 s and 223 s.

### Deep
PR 49 merged (16e0fc4) by the auto-merge rule (outside-review branch adopted on the owner's card tap "Adopt, after Firefox fix", 2026.10.24.2319 Eastern): "Why?" button in the Check report for passages the checker proves unreachable (opens the existing why-dialog); story-check 1.1.0 (problems from the unreachable-page rules carry `code: 'unreachable-page'`, README and types and bundles updated, 5 new unit tests). An outside review commit 162014f applied unchanged on main (448dcc0). My additions: `editor/qa/reachability.js` three `.filter({hasText})` lookups replaced with `:has-text("...")` selectors (no qa-kit driver change), the suite registered in the live list `editor/qa/qa.js` (it had only been added to the stale `qa.config.cjs`), story-check version and both changelog lines. `reachability` passes in Firefox 158, Chromium 155 and WebKitGTK 2.52.6 (3 of 3 jobs); `npm test` green (27 s). No look change beyond the new button, no speed change (checker walk untouched). Full run Firefox+Chromium 93 suites (92 pass, 1 retry: `real` Chromium, six drag checks in a row failed once, passed on retry, 3 of 3 clean alone; registered in the flaky register, cause unproven, Write-tab drag code untouched by this PR), WebKitGTK 43 suites 0 failed, 0 flaky; wall 246 s and 223 s.

## 2026-10-24 · PR 48

### Quick
Responsive UI. (1) A short touch screen (max-height 500 px, coarse pointer) uses the phone layout via the new `PHONE_Q` (`(max-width: 820px), (max-height: 500px) and (pointer:...

### Details
- A short touch screen (max-height 500 px, coarse pointer) uses the phone layout via the new `PHONE_Q` (`(max-width: 820px), (max-height: 500px) and (pointer: coarse)`, replacing the width-only query in ui1-state.js, ui4-phone.js, ui5-app.js and six ui.css blocks); the six tabs stand in a 64 px left rail, top bar one slim row, + Choice bar clears the rail; on 844 x 390 Write shows about 3 lines of text instead of 1.
- At 2200 x 1200 or larger, root font 20 px and body 18.75 px (25% larger) and wider side lists; zoom was tried and rejected because the Map pan moved the cards 1.25 times the pointer distance (-150 x -113 for a 120 x 90 drag), now exact.
- New suite `screens.js` (2560 x 1440: no page scroll on 6 tabs, exact Map pan; 1920 x 1080 unscaled; sideways rail checks in Chromium only, Firefox and WebKitGTK lack touch emulation).
- Full run Firefox+Chromium 91 suites, WebKitGTK 42 suites, 0 failed, 0 flaky; one machine restart, resumed.

### Deep
PR 48 merged (448dcc0) on the owner's tap ("Merge it"): responsive UI. (1) A short touch screen (max-height 500 px, coarse pointer) uses the phone layout via the new `PHONE_Q` (`(max-width: 820px), (max-height: 500px) and (pointer: coarse)`, replacing the width-only query in ui1-state.js, ui4-phone.js, ui5-app.js and six ui.css blocks); the six tabs stand in a 64 px left rail, top bar one slim row, + Choice bar clears the rail; on 844 x 390 Write shows about 3 lines of text instead of 1. (2) At 2200 x 1200 or larger, root font 20 px and body 18.75 px (25% larger) and wider side lists; zoom was tried and rejected because the Map pan moved the cards 1.25 times the pointer distance (-150 x -113 for a 120 x 90 drag), now exact. (3) `.seg{position:relative}` so the hidden radio inputs stop adding 191 px of page scroll on short screens. New suite `screens.js` (2560 x 1440: no page scroll on 6 tabs, exact Map pan; 1920 x 1080 unscaled; sideways rail checks in Chromium only, Firefox and WebKitGTK lack touch emulation). Full run Firefox+Chromium 91 suites, WebKitGTK 42 suites, 0 failed, 0 flaky; one machine restart, resumed. CSS only, no timing change expected. Pictures: story-editor-ui/landscape-write-before.png, landscape-write-after.png, landscape-map-after.png, qhd-write-after.png.

## 2026-10-24 · PR 47

### Quick
Phone Play tab, the note "This is exactly how your exported game behaves..." moves below the story (placement by `phoneLayout()`); story starts at y 383 instead of 445 on a 390...

### Deep
PR 47 merged (a03dae0) on the owner's tap ("Merge it"): phone Play tab, the note "This is exactly how your exported game behaves..." moves below the story (placement by `phoneLayout()`); story starts at y 383 instead of 445 on a 390 px wide screen (62 px higher), second choice on the first screen; computers unchanged. Full run Firefox+Chromium 89 suites and WebKitGTK 41 suites, 0 failed, 0 flaky; one machine restart mid-run, resumed with `--resume`. Pictures: story-editor-ui/phone-play-before.png and phone-play-after.png.

## 2026-10-24 · PR 46

### Quick
Phone Write page type and effects button moved into the icon row (PR 42 sheet unchanged); first paragraph starts about 52 px higher (y 314 to 262 on a 390 px wide screen)

### Deep
PR 46 merged (0aea927) on the owner's tap ("Merge it"): phone Write page type and effects button moved into the icon row (PR 42 sheet unchanged); first paragraph starts about 52 px higher (y 314 to 262 on a 390 px wide screen); `phone` and `real` pass in Firefox, Chromium, WebKitGTK; full run 0 failed; one WebKitGTK `last` retry, registered in the flaky register (cause unproven). Affects: Story Editor phone Write tab only.

## 2026-10-24 · Changed

### Quick
Phone Write: the page type and effects button moved into the icon row (short label, e.g.

### Deep
Phone Write: the page type and effects button moved into the icon row (short label, e.g. Page or Good ending · Gets 2; full words in its label), first paragraph starts about 52 px higher (y 314 to 262 on a 390 px wide screen); phone and real suites pass in 3 browsers, picked run 33 suites pass. Merged as PR 46 on the owner's tap.

## 2026-10-24 · Changed

### Quick
Qa.js: resume ledger and status (same idea as JS-modules test-runner 1.2.0): each passed (tier, suite, browser) cell is written to qa/.resume/<fingerprint>.jsonl (fingerprint =...

### Deep
qa.js: resume ledger and status (same idea as JS-modules test-runner 1.2.0): each passed (tier, suite, browser) cell is written to qa/.resume/<fingerprint>.jsonl (fingerprint = hash of the editor sources, the qa scripts and the browser paths); `--resume` skips those cells, keeping their check counts; `--status` prints cells per browser, the last cell, restart or same boot, and whether a run is alive. Proof: 3 palette cells recorded, 3 skipped on resume; one cell removed, only that one reran.

## 2026-10-24 · PR 43

### Quick
README and editor README text only (Ctrl+K actions, phone changes, test browsers listed as Firefox 158, Chromium 155, WebKitGTK 2.52.6)

### Deep
PR 43 merged (738754d) by the auto-merge rule: README and editor README text only (Ctrl+K actions, phone changes, test browsers listed as Firefox 158, Chromium 155, WebKitGTK 2.52.6); `npm test` green; no editor code changed.

## 2026-10-24 · PR 44

### Quick
Checker worker. Full run Firefox+Chromium 89 suites 0 fail (2 retries, both my tests: checkworker limit, real blob filter, fixed), WebKitGTK 41 suites 0 fail (1 unrelated...

### Deep
PR 44 merged (315aee3) on the owner's tap: checker worker. Full run Firefox+Chromium 89 suites 0 fail (2 retries, both my tests: checkworker limit, real blob filter, fixed), WebKitGTK 41 suites 0 fail (1 unrelated retry: last, registered); `npm test` green; machine restarts at about 15:03 and 15:10 handled by the restart-safe steps.

## 2026-10-24 · Changed

### Quick
Checker after an edit runs in a background worker when the last check took over 8 ms (checkworker.js, built from the checker's own functions; check-worker-equiv.mjs proves 201...

### Deep
Checker after an edit runs in a background worker when the last check took over 8 ms (checkworker.js, built from the checker's own functions; check-worker-equiv.mjs proves 201 random stories identical and wasm used in the worker). Longest pause after an edit, 300-page stress story, median of interleaved runs (ms, lower is better): Chromium 155 50.9 to 24.6, Firefox 158 37 to 19, WebKitGTK 2.52.6 40 to 32. Edit time and Map open unchanged. New suite checkworker.

## 2026-10-24 · Changed

### Quick
README and editor README: Ctrl+K actions and phone changes described; test browsers listed as Firefox 158, Chromium 155, WebKitGTK 2.52.6 (GNOME Web dropped).

### Deep
README and editor README: Ctrl+K actions and phone changes described; test browsers listed as Firefox 158, Chromium 155, WebKitGTK 2.52.6 (GNOME Web dropped). Docs only; npm test all green.

## 2026-10-24 · Changed

### Quick
Phone: Page type and effects opens as a slide-up sheet (Done, tap outside, pull-down handle) instead of expanding in place; page text no longer jumps; phone and real suites...

### Deep
Phone: Page type and effects opens as a slide-up sheet (Done, tap outside, pull-down handle) instead of expanding in place; page text no longer jumps; phone and real suites updated; 3 browsers pass. PR pending your tap.

## 2026-10-24 · PR 37

### Quick
Ctrl+K runs actions

### Details
- New suite `palette` (fails 7 checks on main's build, 0 on this one).
- Full run (Firefox, Chromium, WebKitGTK): 124 suites, 123 pass, `top5-safe` WebKitGTK failed once under load and passed 4 of 4 after; repeat WebKitGTK lane 38 pass, 1 flaky pass (`bugs12`).

### Deep
**Ctrl+K runs actions** (`ui2-widgets.js` picker `commands`, `ui3-write.js` action list, help text). 12 actions (go to a tab, Play, New page, Export game, Undo, Redo, show/hide side lists); `>` lists all, typing part of a name offers matches under the pages; hidden tabs not offered; empty list and page jumping unchanged. New suite `palette` (fails 7 checks on main's build, 0 on this one). GNOME Web removed from the test lanes (owner, 2026-10-24). Full run (Firefox, Chromium, WebKitGTK): 124 suites, 123 pass, `top5-safe` WebKitGTK failed once under load and passed 4 of 4 after; repeat WebKitGTK lane 38 pass, 1 flaky pass (`bugs12`). **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6.

## 2026-10-24 · PR 38

### Quick
Map key remembers shown or hidden

### Deep
**Map key remembers shown or hidden** (`prefs.mapKey` in `ui1-state.js`, saved on toggle in `ui4-map.js`). First visit unchanged (open on wide screens, closed on phones); afterwards as left, reload included; follows Remember preferences. New suite `mapkey` (fails 1 on the old build, 0 now). Full run (Firefox, Chromium, WebKitGTK): 127 suites, 127 pass, 585 s. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6.

## 2026-10-24 · tooling

### Quick
Splash race removed from the test harness

### Details
- Each page load waited out the 4.4 s opening animation because the one-time removal ran before the page created it; now a watcher removes it on arrival.
- Per load: Chromium 4.7 to 0.33 s, Firefox 5.1 to 0.8 s (lower is better).
- Full run 585 to 529 s (3 browsers, 127 suites;
- CPU-bound at 87%, so the saving is smaller than the waiting removed).

### Deep
**Splash race removed from the test harness** (`editor/qa/engine.js`, `packages/qa-kit/src/bidi.js`, `qa/mapprebuild.js`; no change to the editor). Each page load waited out the 4.4 s opening animation because the one-time removal ran before the page created it; now a watcher removes it on arrival. Per load: Chromium 4.7 to 0.33 s, Firefox 5.1 to 0.8 s (lower is better). Full run 585 to 529 s (3 browsers, 127 suites; CPU-bound at 87%, so the saving is smaller than the waiting removed). `mapprebuild` waits for the boxes, not a fixed 0.6 s. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6.

## 2026-10-24 · PR 40

### Quick
Phone Items: the explanation folds away

### Details
- On a phone the 95 px explanation paragraph sits behind "What are objects, states and numbers?" (one tap opens it); the list starts 95 px higher, about one more item on a 390 x 844 screen (higher is better for items visible).
- Full run (3 browsers, 127 suites): 126 pass, 1 flaky pass (`bugs12` WebKitGTK, the Map key placed too late for a fixed 0.7 s wait, being fixed), 558 s.

### Deep
**Phone Items: the explanation folds away** (`details.hintfold` in `renderItems`, `ui4-views.js`; `ui.css`). On a phone the 95 px explanation paragraph sits behind "What are objects, states and numbers?" (one tap opens it); the list starts 95 px higher, about one more item on a 390 x 844 screen (higher is better for items visible). Laptop unchanged. Two new checks in `qa/phone.js` fail on the old build and pass in all three browsers. Full run (3 browsers, 127 suites): 126 pass, 1 flaky pass (`bugs12` WebKitGTK, the Map key placed too late for a fixed 0.7 s wait, being fixed), 558 s. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6.

## 2026-10-24 · tooling 2

### Quick
`bugs12` waits for the Map key

### Deep
**`bugs12` waits for the Map key** (`qa/bugs12.js`; no editor change): a fixed 0.7 s wait became a wait for the key's position. `bugs12` Firefox / Chromium / WebKitGTK 33.0 / 30.2 / 43.6 s to 30.5 / 28.2 / 41.1 s alone (lower is better); WebKitGTK lane under load: 60 s with no retry (was 144 s with one); lane 4 min 48 s to 4 min 5 s. Tried and dropped: `round3` short sleeps to a page-quiet wait, 27.8 to 30.4 s (slower). **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6.

## 2026-10-23 · Phone look

### Quick
Phone Map toolbar folds to one row

### Details
- Map area on 390 x 844: 552 to 690 px (+25%).
- Laptop and the map drawing unchanged (`mapcull` picture match 99.5% passes in all four browsers).
- `ffsmoke` marks the first-run tour as seen (72 s to 9 s per run, it waited out a 30 s timeout).
- Full run: 124 suites, 122 pass, 1 flaky pass (`write1` Firefox, open), 1 fail fixed above.

### Deep
**Phone Map toolbar folds to one row** (`editor/ui4-map.js` `mapMoreTools`, `editor/ui.css`). Four toolbar rows (243 px) become one row of layout buttons plus a More button (colors, search, Playtest results); the zoom buttons float over the map. Map area on 390 x 844: 552 to 690 px (+25%). Laptop and the map drawing unchanged (`mapcull` picture match 99.5% passes in all four browsers). Tooling in the same PR: routine half-size fuzz runs no longer trip the check-count floor (PR 35 side effect); `ffsmoke` marks the first-run tour as seen (72 s to 9 s per run, it waited out a 30 s timeout). Full run: 124 suites, 122 pass, 1 flaky pass (`write1` Firefox, open), 1 fail fixed above. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6, GNOME Web 46.5 (its three suites).

## 2026-10-22 · Tooling

### Quick
Steadier and shorter checks

### Details
- `safety` waits for the once-a-day reminder check to have run instead of a fixed 3.3 s five times, and marks the page it reloads away from: the Chromium flake was the check reading the old page after `reload()` (twice, in two different checks).
- Chromium `safety` 128 s and 86 s with retries before, 47 s and clean in 3 runs (also 3 under load) after;
- Firefox 50 s, WebKitGTK 60 s (was 128 s with a retry).
- `real` presses the Play tab again after 5 s (up to 3 times); its WebKitGTK/Firefox timeouts have no proven cause.

### Deep
**Steadier and shorter checks** (`editor/qa/safety.js`, `real.js`, `qa.js`, `README.md`; `editor/ui5-app.js` gains the read-only test hook `__editor.nudgeRuns`, no change a player or writer can see). `safety` waits for the once-a-day reminder check to have run instead of a fixed 3.3 s five times, and marks the page it reloads away from: the Chromium flake was the check reading the old page after `reload()` (twice, in two different checks). Chromium `safety` 128 s and 86 s with retries before, 47 s and clean in 3 runs (also 3 under load) after; Firefox 50 s, WebKitGTK 60 s (was 128 s with a retry). With the reminder switched off on purpose `safety` fails in Firefox and Chromium, so it still notices. `real` presses the Play tab again after 5 s (up to 3 times); its WebKitGTK/Firefox timeouts have no proven cause. Routine runs (smart, sample, quick) play half of `fuzz1` and `fuzz2` with a rotating part (Firefox alone: 74 s to 23 s and 67 s to 29 s); the full run and `--full-fuzz` play them whole. Third full run on this branch: 124 suites, 0 FAIL, 1 flaky pass (the `safety` Chromium race fixed here), 623 s. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6 (GNOME Web 46.5 runs only `csp`, `epismoke` and `walk`, which this change does not touch).

## 2026-10-22 · Tooling

### Quick
Check runner: `--since <rev>` and `--plan`, and a real wait for WebKit to exit

### Details
- The WebKitGTK and GNOME Web lanes now wait until no WebKit process is left (at most 25 s) instead of starting at once; measured 1.6 s in a four-browser `csp` run, all four passing.
- Fixed waits counted first: 477 `waitForTimeout` calls, 188 s of literal wait, already ended early by `engine.js`.
- Measured (Firefox 158.0, same machine, 2026-10-22): the picked run for a Map-only change (`smart --since` the commit before it) is 33 suites in 89 s; the full run is 124 suites in four browsers in 585 s (the research file recorded 368 to 399 s for 113 suites, so the full run is not shorter and this PR does not claim it is; the gain is that routine changes no longer need it, about 6.6 times less time).
- The runner's local web server now retries on another port (up to 5 times): in one full run it never answered and `twowin` and `top5-safe` failed in all three browsers with connection refused, then passed when run alone (62, 57, 63 s and 23, 22, 23 s).

### Deep
**Check runner: `--since <rev>` and `--plan`, and a real wait for WebKit to exit** (`editor/qa/qa.js`, `editor/qa/README.md`; from the QA speed-up brief, owner chose "All, in order" 2026-10-23). `smart --since origin/main` picks suites from the git diff instead of `.stamp` file times, which are useless in a new session; `--plan` lists the jobs and runs nothing; `--since` never writes `.stamp`. Proved by changing files on purpose: no change gives only the quick suites (31 jobs), `ui4-speed.js` adds `top5-safe` and `top5-new`, `maplayout.js` adds `mapcull` and `mapprebuild` (33 jobs). The WebKitGTK and GNOME Web lanes now wait until no WebKit process is left (at most 25 s) instead of starting at once; measured 1.6 s in a four-browser `csp` run, all four passing. Fixed waits counted first: 477 `waitForTimeout` calls, 188 s of literal wait, already ended early by `engine.js`. Measured (Firefox 158.0, same machine, 2026-10-22): the picked run for a Map-only change (`smart --since` the commit before it) is 33 suites in 89 s; the full run is 124 suites in four browsers in 585 s (the research file recorded 368 to 399 s for 113 suites, so the full run is not shorter and this PR does not claim it is; the gain is that routine changes no longer need it, about 6.6 times less time). The runner's local web server now retries on another port (up to 5 times): in one full run it never answered and `twowin` and `top5-safe` failed in all three browsers with connection refused, then passed when run alone (62, 57, 63 s and 23, 22, 23 s). Nothing makes a failing check pass; the full run before a release stays. **Tested in:** Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6, GNOME Web 46.5 (`csp`).

## 2026-10-22 · Changed

### Quick
The Map skips style writes that would change nothing

### Details
- Profile of the Map open after an edit, 300 pages, Chromium: restyle about 16 ms to about 14 ms in the call, `applySearch` 7 to 10 (noise), call total about 45 to 40 ms.
- Alternating pairs, old vs new (lower is better), open total: Chromium 61 vs 60 ms, Firefox 57 vs 39 ms, WebKitGTK 198 vs 200 ms, GNOME Web 202 vs 201 ms (7 pairs); longest freeze: Firefox 62 vs 44 ms, Chromium 52 vs 51 ms, WebKitGTK 116 vs 76 ms (3 pairs), GNOME Web 111 vs 104 ms.

### Deep
**The Map skips style writes that would change nothing** (`editor/ui4-map.js`: `paintEdges`, `applyPaths` and `applySearch` remember what they last applied to each arrow and box (`sig`, `pkv`, `hitv`/`dimv`, tied to the element) and write only on a change; `applyPaths` skips the path-key lookups when no path is shown). Before, every drawn slice rewrote `dim`, `pg`, `pb`, `hit`, `onp` and the arrowhead of every drawn item. Profile of the Map open after an edit, 300 pages, Chromium: restyle about 16 ms to about 14 ms in the call, `applySearch` 7 to 10 (noise), call total about 45 to 40 ms. Alternating pairs, old vs new (lower is better), open total: Chromium 61 vs 60 ms, Firefox 57 vs 39 ms, WebKitGTK 198 vs 200 ms, GNOME Web 202 vs 201 ms (7 pairs); longest freeze: Firefox 62 vs 44 ms, Chromium 52 vs 51 ms, WebKitGTK 116 vs 76 ms (3 pairs), GNOME Web 111 vs 104 ms. Search, clear, search again leave the same dim and hit counts as before (checked in Firefox). Also adopts field-report 1.0.2 (only its `VERSION` constant changed). **Tested in:** Firefox 158.0 (smart check 33 of 33), ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6, GNOME Web 46.5 (`mapcull` 10 of 10 each).

## 2026-10-22 · Changed

### Quick
The Map's first window is drawn in 4 ms slices

### Details
- `reveal()` and `drawFrames()` draw boxes then arrows for at most 4 ms per frame; before, `reveal()` drew the first screenful in one stretch of up to 14 ms and the following frames up to 6 ms).
- `mapcull` picture check passes (99.5% or better) in Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6 and GNOME Web 46.5. 300 pages after an edit, 4 and 3 alternating pairs (old vs new, lower is better): longest freeze while opening about 61 vs 54 ms in Chromium, 85 vs 68 ms in Firefox, 79 vs 70 ms in WebKitGTK, 107 vs 125 ms in GNOME Web (noise); open total (call plus two frames) about 70 vs 64 ms Chromium, 76 vs 52 ms Firefox, 310 vs 205 ms WebKitGTK, 233 vs 220 ms GNOME Web.
- The synchronous part of the open call stays about 39 ms in Chromium (layout adoption, toolbar and skeleton; not drawing).
- Size: plain +13 bytes.

### Deep
**The Map's first window is drawn in 4 ms slices** (`editor/ui4-map.js`: new `SLICE_MS = 4`; `reveal()` and `drawFrames()` draw boxes then arrows for at most 4 ms per frame; before, `reveal()` drew the first screenful in one stretch of up to 14 ms and the following frames up to 6 ms). Same boxes and arrows in the same order; `mapcull` picture check passes (99.5% or better) in Firefox 158.0, ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6 and GNOME Web 46.5. 300 pages after an edit, 4 and 3 alternating pairs (old vs new, lower is better): longest freeze while opening about 61 vs 54 ms in Chromium, 85 vs 68 ms in Firefox, 79 vs 70 ms in WebKitGTK, 107 vs 125 ms in GNOME Web (noise); open total (call plus two frames) about 70 vs 64 ms Chromium, 76 vs 52 ms Firefox, 310 vs 205 ms WebKitGTK, 233 vs 220 ms GNOME Web. The synchronous part of the open call stays about 39 ms in Chromium (layout adoption, toolbar and skeleton; not drawing). Size: plain +13 bytes. **Tested in:** Firefox 158.0 (smart check, 33 of 33), Chromium 155, WebKitGTK 2.52.6, GNOME Web 46.5 (mapcull 10 of 10 each).

## 2026-10-22 · Changed

### Quick
Speed report rebuilt on the shared field-report 1.0.1 module

### Details
- **Frames are off until Record frames is pressed:** with the module's frames always on, Map open (300 pages, after an edit) took longer to show its first two frames in Firefox 158.0 (about 110-165 ms vs about 26-45 ms; longest freeze unchanged); with frames off the 3-run alternating pairs match the old build in all four browsers: Map open total about 64 vs 67 ms in Chromium 155 (lower is better), about 282 vs 274 ms WebKitGTK 2.52.6, about 274 vs 263 ms GNOME Web 46.5, about 83 vs 53-81 ms Firefox (noisy), first paint 36-48 vs 36-48 ms Chromium, 20-23 vs 19-25 ms WebKitGTK, 46-58 vs 50-61 ms GNOME Web, 36-39 vs 36-39 ms Firefox.
- Size: plain +9.5 KB (678,090 bytes), packed +4.9 KB (297,116 bytes).

### Deep
**Speed report rebuilt on the shared field-report 1.0.1 module** (`editor/field-report.js` copied unchanged from JS-modules, packed first by `build.py`; `editor/ui1-state.js` starts it as `fieldReport`; `editor/ui4-speed.js` keeps only the editor's own timings, `speedExtras`, and a window with Copy report, Save speed report, Save error log, Record frames). Removed the old frame recorder, the "It stuttered!" bar and the editor's own error log and listeners. Five taps in the top-left corner open the module's panel; the saved files are `story-editor-speed-YYYYMMDD-HHMM.md` and `story-editor-errors-YYYYMMDD-HHMM.md`. **Frames are off until Record frames is pressed:** with the module's frames always on, Map open (300 pages, after an edit) took longer to show its first two frames in Firefox 158.0 (about 110-165 ms vs about 26-45 ms; longest freeze unchanged); with frames off the 3-run alternating pairs match the old build in all four browsers: Map open total about 64 vs 67 ms in Chromium 155 (lower is better), about 282 vs 274 ms WebKitGTK 2.52.6, about 274 vs 263 ms GNOME Web 46.5, about 83 vs 53-81 ms Firefox (noisy), first paint 36-48 vs 36-48 ms Chromium, 20-23 vs 19-25 ms WebKitGTK, 46-58 vs 50-61 ms GNOME Web, 36-39 vs 36-39 ms Firefox. Size: plain +9.5 KB (678,090 bytes), packed +4.9 KB (297,116 bytes). Checks: `top5-new` (41) and `top5-safe` rewritten for the new report; five-tap check sends the pointer presses from the page when GNOME Web refuses real taps. **Tested in:** Firefox 158.0 (smart check, 40 of 40), ungoogled Chromium 155.0.8059.39, WebKitGTK 2.52.6, GNOME Web (Epiphany) 46.5. Upstream note: the module file says 1.0.1 in its header but `VERSION` inside still reads 1.0.0.

## 2026-10-22 · Changed

### Quick
The background worker also counts the crossings for the Map's toolbar chip

### Details
- **Measured** (300 pages, edit, rest 3 s, open the Map; the part that freezes the screen, i.e. the `setView` call, ms, lower is better, mean of 3 alternating runs, before PR 29 baseline vs now): Firefox 158.0 36 → 28 (22% faster);
- Chromium 155.0.8059.39-1 60 → 42 (30%);
- WebKitGTK 2.52.6 86 → 75 (13%);
- GNOME Web 46.5 107 → 98 (8%).

### Deep
**The background worker also counts the crossings for the Map's toolbar chip** (`editor/maplayout.js`: `mapSegCross` and `mapMetrics` join `MAP_WORKER_FUNCS`, and the worker runs `mapMetrics(L, 0, null, null, true)` after the layout so the crossing count and arrow directions sit on the layout (`L._metrics`, `L._centers`) when the page takes it in; the page's `mapScore` then finds them done. The worker has no WebAssembly counter, so it counts in JavaScript off the main thread; the answer is the same as the WebAssembly one (`cross-equiv.mjs`). `editor/map-worker-equiv.mjs` and `editor/qa/mapprebuild.js` now also compare the chip numbers (1,920 layouts; 4 browsers); `__editor.mapChip` for the check; `packages/story-map` 1.0.4, bookkeeping, package output identical). **Measured** (300 pages, edit, rest 3 s, open the Map; the part that freezes the screen, i.e. the `setView` call, ms, lower is better, mean of 3 alternating runs, before PR 29 baseline vs now): Firefox 158.0 36 → 28 (22% faster); Chromium 155.0.8059.39-1 60 → 42 (30%); WebKitGTK 2.52.6 86 → 75 (13%); GNOME Web 46.5 107 → 98 (8%). Whole open (setView plus two frames): Firefox 77 → 66, Chromium 93 → 70, WebKitGTK 308 → 290, GNOME Web 282 → 288 (2% slower, inside its run-to-run spread of 253 to 312 before and 226 to 338 after, under the 5% line). Edit time (`refresh()`) unchanged: Firefox 24 → 23, Chromium 33.2 → 32.9, WebKitGTK 52 → 49, GNOME Web 54 → 49. Package size: packed +55 bytes. Other timings on this machine ran noisier than in the PR 29 log (the same PR 29 build opened in 93 ms in Chromium now, 74 ms then). **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6, GNOME Web 46.5 for `mapprebuild` and the A/B runs; smart check (34 suites) in Firefox; `npm test` in Node.

## 2026-10-22 · Changed

### Quick
A big story's Map layout is built ahead in a background worker

### Details
- `mapPrebuildSoon`/`mapPrebuild`/`mapPrebuilt` (called at the end of `runCheck`, 300 ms after the last check) post the story text and the Map settings to a blob worker and keep the answer in `mapCache` under the key the Map would use (`mapLayoutKey`), but only if the story text is unchanged, no Map was drawn since (the stay-put order `mapPrev` is the same object) and no layout is cached; otherwise the answer is thrown away and the Map builds itself as before; a browser that refuses workers, or a worker error, switches the feature off for the session.
- `L.groups` is now worked out the first time a score reads it (it was built for every view; with Givens that is up to 8 graph builds on the page), except for the Given lanes view that needs it to lay out.
- **Measured** (300 pages, edit, rest 3 s, then open the Map: setView plus two frames, ms, lower is better, mean of 3 alternating runs; and the longest freeze while it opens): Firefox 158.0 101 → 75 (26% faster; freeze 110 → 88);
- Chromium 155.0.8059.39-1 121 → 74 (39%; freeze 112 → 65);

### Deep
**A big story's Map layout is built ahead in a background worker** (stories of 60 pages or more). `editor/maplayout.js`: new `MAP_PLAIN`, `mapSizeNodes`, `mapLayerPlain`, `mapBuildPlain` (graph, box sizes and layered drawing of the flow, down and spine views in one call) and `mapWorkerSource()`, which builds the worker's code from the text of the same functions (`MAP_WORKER_FUNCS`), so there is one copy of the logic. `editor/ui4-map.js`: `mapBuildFresh` now sizes boxes and lays out the plain views through those same functions; `mapPrebuildSoon`/`mapPrebuild`/`mapPrebuilt` (called at the end of `runCheck`, 300 ms after the last check) post the story text and the Map settings to a blob worker and keep the answer in `mapCache` under the key the Map would use (`mapLayoutKey`), but only if the story text is unchanged, no Map was drawn since (the stay-put order `mapPrev` is the same object) and no layout is cached; otherwise the answer is thrown away and the Map builds itself as before; a browser that refuses workers, or a worker error, switches the feature off for the session. Only flow, down and spine with colors other than odds/heat are built ahead. `L.groups` is now worked out the first time a score reads it (it was built for every view; with Givens that is up to 8 graph builds on the page), except for the Given lanes view that needs it to lay out. `editor/build.py`: page policy gains `worker-src blob:` (the one allowed addition besides `'wasm-unsafe-eval'`); `editor/qa/csp.js` checks it and that an exported game does not carry it. New checks: `editor/map-worker-equiv.mjs` (in `npm test`: the worker text runs in an empty context and gives the same graph, boxes, positions, order and crossings as the page build, 1,920 layouts / 44,184 boxes: flow, down, spine; merge on and off; traffic sizing on and off; with and without Givens answers; with and without last time's order) and `editor/qa/mapprebuild.js` (a 300-page story gets a ready layout that deep-equals the usual one, an edit makes it stale and a new one follows, a 20-page story starts no worker, `window.__mapPrebuild=false` turns it off). Speed report gains a `map ahead` line (time the page spends taking the layout in). **Measured** (300 pages, edit, rest 3 s, then open the Map: setView plus two frames, ms, lower is better, mean of 3 alternating runs; and the longest freeze while it opens): Firefox 158.0 101 → 75 (26% faster; freeze 110 → 88); Chromium 155.0.8059.39-1 121 → 74 (39%; freeze 112 → 65); WebKitGTK 2.52.6 328 → 280 (15%; freeze 128 → 112); GNOME Web 46.5 370 → 257 (31%; freeze 166 → 134). The edit itself is not slower (time of `refresh()`, 6 alternating pairs, median: Chromium 35.8 → 34.8, Firefox 27 → 24; WebKitGTK and GNOME Web 3 pairs, same inside noise) and neither is the check freeze 0.5 s after it (Chromium 87, 83, 95 → 80, 81, 78). The page spends 1 to 4 ms taking the layout in (Chromium 4.3 ms). The worker works out the layout in 40 to 170 ms off the main thread (Chromium 42, Firefox 77, WebKitGTK 87, GNOME Web 104 for the first one). Layouts equal the usual ones box by box in all four browsers. Cost: the page grows by about 8.8 KB (plain 659,317 → 668,164 bytes; packed 288,488 → 292,144), and the worker runs after each check of a 60+ page story (about 16 ms of its own thread when warm). `packages/story-map` 1.0.3 (bookkeeping: `maplayout.js` changed; the package's own output is byte-identical). Not a gain: showing the side panels after the first frame ("first screen first") measured no first-paint change in any of the four browsers (Firefox 37/33/36 vs 40/34/36 ms, Chromium 48/36/32 vs 32/36/36, WebKitGTK 22/21/23 vs 24/19/18, GNOME Web 75/46/50 vs 57/59/60), so it was not shipped; "compile wasm early" does not apply (the modules compile in under 1 ms). **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6 and GNOME Web 46.5 for `mapprebuild` and the A/B runs; smart check (41 suites) in Firefox; `npm test` in Node.

## 2026-10-22 · Changed

### Quick
Big Maps (120 pages or more) draw only what is in view, and the Map's crossing count runs in WebAssembly

### Details
- `drawIn`/`drawFrames`/`reveal` draw the window first (up to 14 ms), then a margin of 0.3 windows in frames of about 6 ms; new pieces are inserted before the next one already drawn so keyboard order and stacking match a full draw;
- `editor/wasm/mapcross.c` (944 bytes): the crossing count sorts segments by left end and compares only overlapping ones;
- **Measured** (300 pages, open the Map after an edit, setView plus two frames, median of 3 alternating runs, ms, lower is better): Firefox 158.0 186 → 100 (46% faster);
- Chromium 155.0.8059.39 231 → 149 (35%);

### Deep
**Big Maps (120 pages or more) draw only what is in view, and the Map's crossing count runs in WebAssembly** (PR 28, stacked on PR 27). `editor/ui4-map.js`: each arrow is now a data record (`newEdge`, made at once, with its key entries) and a picture (`fillEdge`, made when it scrolls into view); page boxes likewise (`noteNode` then `drawNode`); `drawIn`/`drawFrames`/`reveal` draw the window first (up to 14 ms), then a margin of 0.3 windows in frames of about 6 ms; new pieces are inserted before the next one already drawn so keyboard order and stacking match a full draw; Tab on a box draws 8 before and after it; `light`, `applyPaths`, `applySearch` and the key count from the data, so search counts, arrows in/out and legend cover the whole Map. The key above Start is placed from the layout (`autoKey`) instead of `getBoundingClientRect` on every box. `editor/wasm/mapcross.c` (944 bytes): the crossing count sorts segments by left end and compares only overlapping ones; `klCrossWasm` in `editor/checkwalk.js` lays out memory; `mapMetrics` falls back to the JavaScript loop. **Measured** (300 pages, open the Map after an edit, setView plus two frames, median of 3 alternating runs, ms, lower is better): Firefox 158.0 186 → 100 (46% faster); Chromium 155.0.8059.39 231 → 149 (35%); WebKitGTK 2.52.6 196 → 200 (2% slower, inside about 10% run noise); GNOME Web 46.5 186 → 187. Crossing count alone, first open: Chromium 27.6 → 8 ms, Firefox 33 → 14 ms. Longest single freeze (stall probe, one run each): Firefox map open after edit 192 to 220 → 178 to 212 ms (inside noise); Chromium 264 → 128 ms. Layout build (35 to 45 ms cold) is now the largest piece left. Size: packed editor +1,834 bytes (288,488 → 290,864 incl. PR 27). **Checks:** `cross-equiv.mjs` 1,100 random drawings, 0 differences; new suite `mapcull` (300-page story drawn all at once against drawn in parts: same key, search count "43 matches on 43 of 300 pages", arrows in/out, Tab order, same boxes and arrows in the same order once the window has walked over the whole Map) passes in all four browsers; pictures identical (share of equal pixel values): Firefox 100%, Chromium 99.8%, WebKitGTK 99.93 to 99.99%, GNOME Web 99.64 to 99.68% (differences are the toolbar timing number and, in GNOME Web, small spread-out differences not yet explained); full check 118 of 118, 0 flaky, 583 s; `npm test` all green. **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6, GNOME Web 46.5.

## 2026-10-18 · Added

### Quick
Speed report: "Save as file" button, and a steady `inter` check

### Details
- `inter` (Map interaction check) failed 1 of 13 recent Chromium runs with `dimmed opacity 0.377316`: it read the opacity of dimmed page boxes while the 0.2 s fade was still running; it now waits (up to 3 s) until the opacity is under 0.3 before reading it, nothing is skipped; 3 Chromium runs in a row, 0 failures.

### Deep
**Speed report: "Save as file" button, and a steady `inter` check** (`editor/ui4-speed.js`: new button saves the report text, which already holds the timings, device details and the recent error log, as `story-editor-report-<build stamp>.txt` through `saveFile`, i.e. the system Save window where there is one and a download otherwise; `editor/qa/top5-new.js` checks the saved name, text and type in Firefox and Chromium; `editor/qa/inter.js`). Why: the testing rules ask for a hidden error log that turns phone and laptop sessions into bug reports; the editor already had the error log inside the Speed report (Options -> Speed report, or `#report`), only the file was missing. `inter` (Map interaction check) failed 1 of 13 recent Chromium runs with `dimmed opacity 0.377316`: it read the opacity of dimmed page boxes while the 0.2 s fade was still running; it now waits (up to 3 s) until the opacity is under 0.3 before reading it, nothing is skipped; 3 Chromium runs in a row, 0 failures. Not a speed change. **Tested in:** Firefox 158.0 (reports 158.0b5) and ungoogled Chromium 155.0.8059.39-1 for `top5-new` and `inter`; smart check in the next line of notes.

## 2026-10-18 · Changed

### Quick
The first screen is drawn 17 to 27% sooner: the first check now runs just after it

### Details
- Why: the example story's first check at start-up cost 10 ms in Firefox, 9.4 in Chromium, 24 in WebKitGTK and 35 in GNOME Web (most of it setting up the two wasm modules and running cold code), all before anything was drawn.
- Compile-early (instantiating the modules in the background) was tried and dropped: start-up needs them for that first check anyway, and compile itself costs 0.1-0.3 ms in Chromium and under 1 ms in Firefox.
- Time until the first screen is drawn (`READY_AT`, ms from the page being asked for, smaller is better, median of 8 alternating loads, headless): Firefox 158.0 98 to 76;
- Chromium 155 104 to 83;

### Deep
**The first screen is drawn 17 to 27% sooner: the first check now runs just after it** (`editor/ui5-app.js`: `init` no longer calls `runCheck()` before `renderAll()`; the ready callback that sets `READY_AT` now runs the first check when none has been made; the status line already showed "Checking" when there is no result for the current story). Why: the example story's first check at start-up cost 10 ms in Firefox, 9.4 in Chromium, 24 in WebKitGTK and 35 in GNOME Web (most of it setting up the two wasm modules and running cold code), all before anything was drawn. Compile-early (instantiating the modules in the background) was tried and dropped: start-up needs them for that first check anyway, and compile itself costs 0.1-0.3 ms in Chromium and under 1 ms in Firefox. Time until the first screen is drawn (`READY_AT`, ms from the page being asked for, smaller is better, median of 8 alternating loads, headless): Firefox 158.0 98 to 76; Chromium 155 104 to 83; WebKitGTK 2.52.6 189 to 157; GNOME Web 46.5 333 to 242. Not changed: total time until the check result is shown (it moves after the first screen, same work). **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6, GNOME Web 46.5, one at a time; smart check (Firefox and WebKitGTK, 73 suites): 73 pass, 0 flaky, 0 failed.

## 2026-10-18 · Changed

### Quick
The Map finds the pages every route must pass through (choke points) 4 to 11 times faster

### Details
- Time of `mapGraph` at 300 pages, ms, smaller is better, before to after (median of 10 calls, versions alternated): Firefox 158.0 23 to 2;
- Chromium 155 8.2 to 1.7;
- WebKitGTK 2.52.6 27 to 3;
- GNOME Web 46.5 24 to 3.

### Deep
**The Map finds the pages every route must pass through (choke points) 4 to 11 times faster** (`mapImportance` in `editor/maplayout.js`: one search per reached page on flat Int32Array lists with a stamp array, each search stopping at the first goal page it meets, instead of an object-keyed full search per page; new `editor/choke-equiv.mjs` in `npm test`; `packages/story-map` 1.0.1). Why: profiling a 300-page story showed `mapReach` and `mapImportance` as the biggest part of building the Map's graph. Time of `mapGraph` at 300 pages, ms, smaller is better, before to after (median of 10 calls, versions alternated): Firefox 158.0 23 to 2; Chromium 155 8.2 to 1.7; WebKitGTK 2.52.6 27 to 3; GNOME Web 46.5 24 to 3. At 100 pages: 2-3 to 1 in all four. Same answers: 1,818 random stories, 0 differences; a deliberately broken copy was caught (control: 1,356 of 3,000 differed in an earlier version of the same test). Not changed: the rest of the Map tab (about 80 ms warm at 300 pages) is page-box drawing and layout; switching to the Map with an unchanged story is within noise (Firefox 76 to 85 ms, Chromium 91 to 81 ms, 5 alternating rounds, run-to-run spread about 10%). After an edit the Map spends about 14-30 ms building the layout, 5-7 ms counting crossings, 25-39 ms in the check, 20-27 ms creating page boxes and about 25 ms in the first layout. Sizes: plain editor 659,317 bytes (92% of the 720,000 ceiling), packed 288,488 bytes (87% of 330,000). **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6, GNOME Web 46.5, one at a time; quick check (Firefox and WebKitGTK) 73 suites, 0 failed, 2 passed on retry (`tools8` Firefox, `safety` WebKitGTK).

## 2026-10-18 · Changed

### Quick
The checker's WebAssembly walk now also takes stories with 31 to 64 tracked items and numbers

### Details
- Why: a story whose items and number groups need more than 30 bits had been checked with BigInt flags in JavaScript, 20 to 30 times slower than the same size of story under 30 bits.
- JavaScript to WebAssembly): 60 pages with 40 items: Firefox 158.0 1,008 to 72 ms (14x), ungoogled Chromium 155.0.8059.39-1 768 to 62 ms (12x), WebKitGTK 2.52.6 1,828 to 42 ms (44x), GNOME Web 46.5 1,587 to 44 ms (36x); 100 pages with 45 items: 635 to 28 (23x), 478 to 32 (15x), 1,105 to 47 (24x), 1,071 to 34 (32x); 100 pages with 55 items: 769 to 25 (31x), 539 to 33 (16x), 1,069 to 31 (34x), 1,022 to 35 (29x); 150 pages with 60 items: 632 to 30 (21x), 488 to 39 (13x), 952 to 48 (20x), 1,049 to 31 (34x).
- Proof of equal answers: `wasm-equiv.mjs` adds stories with 31 to 58 items, one with exactly 64 (the top bit in use), one with 63, one with 70 (too many, so JavaScript on both sides) and eight stories that give all 64 items and then need and take one at the edge of each 32-bit half (bits 0, 29, 30, 31, 32, 33, 62, 63): 225 comparisons on 60 stories and 985 on each of two runs of 300 stories (seeds 2 and 3), 2,195 in all, 0 differences, 146 and 137 of them with 64-bit flags.
- `walk` (real browsers) adds a 60-page story with 40 items: the 64-bit walk really runs (4 times), same answers, at least 3 times as fast (Firefox 774 to 41 ms), and still correct without WebAssembly.

### Deep
**The checker's WebAssembly walk now also takes stories with 31 to 64 tracked items and numbers** (`editor/wasm/checkwalk.c` built a second time with `-DW64` into `checkwalk64.wasm`, 3,743 bytes; the 32-bit module is 3,711; `editor/checkwalk.js` chooses by `bits`; `analyzeRun` in `core.js` passes `bits: nb` instead of skipping big stories; `packages/story-check` regenerated as 1.0.3; `editor/wasm-equiv.mjs`, `editor/qa/walk.js`, `editor/build.py` ceilings). Owner's rule of 2026-10-18 (relayed 8:28 PM Eastern, 2026-10-18): "forget size ceilings while we are in pursuit of raw performance", and the wasm standard. Why: a story whose items and number groups need more than 30 bits had been checked with BigInt flags in JavaScript, 20 to 30 times slower than the same size of story under 30 bits. Time of `analyze` on generated stories that reach the 200,000-situation limit (smaller is better; median of 3 alternating rounds of 2 calls; JavaScript to WebAssembly): 60 pages with 40 items: Firefox 158.0 1,008 to 72 ms (14x), ungoogled Chromium 155.0.8059.39-1 768 to 62 ms (12x), WebKitGTK 2.52.6 1,828 to 42 ms (44x), GNOME Web 46.5 1,587 to 44 ms (36x); 100 pages with 45 items: 635 to 28 (23x), 478 to 32 (15x), 1,105 to 47 (24x), 1,071 to 34 (32x); 100 pages with 55 items: 769 to 25 (31x), 539 to 33 (16x), 1,069 to 31 (34x), 1,022 to 35 (29x); 150 pages with 60 items: 632 to 30 (21x), 488 to 39 (13x), 952 to 48 (20x), 1,049 to 31 (34x). Answers equal in every browser run. How: the C code reads and writes flags through one type (`fl_t`) and one reader (`RF`): one 32-bit word as before, or two words (low first) for 64 bits; the tables JavaScript writes put every bit set in W words, and the situations come back as a BigUint64Array, which is what the BigInt code in `core.js` already expects. Past 64 bits, without WebAssembly, or on any surprise the JavaScript loop runs. A second module (instead of one 64-bit module for all) keeps stories under 30 bits at exactly their old speed and both under Chromium's 4,096-byte synchronous compile limit. Proof of equal answers: `wasm-equiv.mjs` adds stories with 31 to 58 items, one with exactly 64 (the top bit in use), one with 63, one with 70 (too many, so JavaScript on both sides) and eight stories that give all 64 items and then need and take one at the edge of each 32-bit half (bits 0, 29, 30, 31, 32, 33, 62, 63): 225 comparisons on 60 stories and 985 on each of two runs of 300 stories (seeds 2 and 3), 2,195 in all, 0 differences, 146 and 137 of them with 64-bit flags. A deliberate bug (clearing the high word of every situation) gave 18 differences in 173; two other bugs I first tried (dropping the top bit consistently everywhere) were not caught, because a consistent loss changes no verdict, which is why the edge-bit stories exist. `walk` (real browsers) adds a 60-page story with 40 items: the 64-bit walk really runs (4 times), same answers, at least 3 times as fast (Firefox 774 to 41 ms), and still correct without WebAssembly. Size (smaller is better): editor 653,285 to 658,847 bytes plain, packed 285,399 to 288,284; the build ceilings were raised to 720,000 (92 percent used) and 330,000 (87 percent used) on the owner's word; exported games unchanged (Keeper's Light 60,153, standard 25-page game 51,761, with the Place code 54,998). `packages/story-check` 1.0.3: nothing changes for users. Exported story games were measured too and left alone: a generated 25-page game is ready (DOMContentLoaded) in 5 to 6 ms in Firefox 158.0 and 36 to 47 ms in ungoogled Chromium 155 (mostly the browser's own page set-up; the same game has 27 KB of HTML), and a click on a choice takes under 1 ms in both, so there is no compute for WebAssembly to take; the Place code replay is a loop over the path length. WebKitGTK and GNOME Web were not measured for games (the test adapter does not set page content). **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6 and GNOME Web (Epiphany) 46.5 for the timings and the `walk` check; Node 22.22.0 for `wasm-equiv` and the package tests (`npm test` all green); the full check on the built editor: 118 suites, 118 pass, 0 flaky, 0 FAIL, 532 s (the new `walk` also passes in GNOME Web 46.5, 23.5 s).

## 2026-10-18 · Changed

### Quick
The checker's way-back passes now run in WebAssembly too

### Details
- Moving that search to C alone gave only about 1.5x (it is memory-bound), so the real change is the method: the questions are asked 32 at a time and answered in one pass, every situation carrying a 32-bit set of the questions it can already answer yes for (a stack instead of a queue for the same pass was slower: 56 ms against 20 ms in Node, so the queue stayed).
- Used whenever the checker keeps the moves (up to 150,000 situations); stories above that never ran these passes.
- Time of `analyze` on generated stories with the walk already in WebAssembly (smaller is better; median of 4 alternating rounds of 3 calls; graph passes in JavaScript to in WebAssembly): 60 pages, 45,117 situations: ungoogled Chromium 155.0.8059.39-1 40 to 29 ms (1.4x), Firefox 158.0 35 to 21 ms (1.7x), WebKitGTK 2.52.6 31 to 23 ms (1.3x), GNOME Web 46.5 38 to 23 ms (1.7x); 100 pages, 74,606 situations: 119 to 46 ms (2.6x), 89 to 40 ms (2.2x), 103 to 62 ms (1.7x), 77 to 48 ms (1.6x); 90 pages, 91,817 situations: 129 to 50 ms (2.6x), 112 to 47 ms (2.4x), 98 to 54 ms (1.8x), 117 to 67 ms (1.7x); 110 pages, 88,530 situations: 129 to 65 ms (2.0x), 99 to 44 ms (2.3x), 101 to 50 ms (2.0x), 91 to 62 ms (1.5x).
- A 30-page story (124 situations) takes 1 to 2 ms either way, and stories stopped at the 200,000-situation limit do not keep moves, so they are unchanged.

### Deep
**The checker's way-back passes now run in WebAssembly too** (`editor/wasm/checkgraph.c` 1,646 bytes, `editor/checkwalk.js` `klGraphWasm`, hook in `analyzeRun` in `core.js`; `packages/story-check` regenerated as 1.0.2; `editor/wasm-equiv.mjs` and `editor/qa/walk.js` extended). Owner's rule of 2026-10-18 (wasm is the standard for hot code, JavaScript the fallback); the follow-up to the checker walk of the row below, which left the later graph passes in JavaScript. After the walk moved to WebAssembly, a profile showed `firstCut` (the check behind "a player who arrives without it can never come back for it") at about 60 percent of a 75,000-situation check: 25 questions, each a search over nearly the whole move graph (1,667,535 situation visits in all). Moving that search to C alone gave only about 1.5x (it is memory-bound), so the real change is the method: the questions are asked 32 at a time and answered in one pass, every situation carrying a 32-bit set of the questions it can already answer yes for (a stack instead of a queue for the same pass was slower: 56 ms against 20 ms in Node, so the queue stayed). The table of backward moves and the trap search (`canReach`) are in C as well. The answers are the same by construction (the same reachability sets, then the first unreached situation of each question), and the notes still come out in the same order. Used whenever the checker keeps the moves (up to 150,000 situations); stories above that never ran these passes. Without WebAssembly, or when any call fails halfway (the call answers null and the JavaScript version is built then), the JavaScript code runs, unchanged. Time of `analyze` on generated stories with the walk already in WebAssembly (smaller is better; median of 4 alternating rounds of 3 calls; graph passes in JavaScript to in WebAssembly): 60 pages, 45,117 situations: ungoogled Chromium 155.0.8059.39-1 40 to 29 ms (1.4x), Firefox 158.0 35 to 21 ms (1.7x), WebKitGTK 2.52.6 31 to 23 ms (1.3x), GNOME Web 46.5 38 to 23 ms (1.7x); 100 pages, 74,606 situations: 119 to 46 ms (2.6x), 89 to 40 ms (2.2x), 103 to 62 ms (1.7x), 77 to 48 ms (1.6x); 90 pages, 91,817 situations: 129 to 50 ms (2.6x), 112 to 47 ms (2.4x), 98 to 54 ms (1.8x), 117 to 67 ms (1.7x); 110 pages, 88,530 situations: 129 to 65 ms (2.0x), 99 to 44 ms (2.3x), 101 to 50 ms (2.0x), 91 to 62 ms (1.5x). A 30-page story (124 situations) takes 1 to 2 ms either way, and stories stopped at the 200,000-situation limit do not keep moves, so they are unchanged. Since the check began using WebAssembly at all (100 pages, 74,606 situations, all JavaScript to now): about 235 to 46 ms in Chromium, 287 to 40 in Firefox, 312 to 62 in WebKitGTK, 290 to 48 in GNOME Web (the earlier figures are from the previous row's run, the later from this one). Answers equal in every browser run (`same` true on all five stories in each). Proof of equal answers: `wasm-equiv.mjs` now compares three ways (walk and graph passes in WebAssembly, graph passes only, JavaScript only) on random stories plus 'gated' stories built to ask more than 32 questions in one check (so a full batch of 32, bit 31 included, is exercised): 207 comparisons on 60 stories, 882 on each of two runs of 300 stories (seeds 2 and 3), 1,971 in all, 0 differences; the runs cover 193 and 164 stories with a trap note and 136 and 121 with a missed-choice note. Two deliberate bugs are caught: a wrong first-unreached position gave 13 differences, and losing bit 31 of the set gave 1. A failure halfway in WebAssembly would be hidden by the fallback, so the test counts failed calls and fails on any. The test takes about 13 s for 60 stories (it was about 11 s before; the graph-only run takes every fourth comparison to keep that down). New in `walk` (real browsers): the graph passes really run (at least 2 times, 4 seen) and are off when WebAssembly is missing. Size (smaller is better): editor 648,402 to 653,285 bytes plain (ceiling 660,000, 99 percent; 6.7 KB left), packed 283,180 to 285,399 bytes (ceiling 295,000, 97 percent); exported games unchanged (the Keeper's Light 60,153, standard 25-page game 51,761, with the Place code 54,998). `packages/story-check` 1.0.2: nothing changes for users, 42,027 to 42,472 bytes minified for `story-check.min.mjs` (+0.4 KB). The module is under Chromium's 4,096-byte synchronous compile limit with room to spare (1,646 bytes). **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6 and GNOME Web (Epiphany) 46.5 for the timings and the `walk` check (passes in all four); Node 22.22.0 for `wasm-equiv` and the package tests (`npm test` all green, 23 s); the full check on the built editor: 118 suites, 118 pass, 0 flaky, 0 FAIL, 498 s.

## 2026-10-18 · Changed

### Quick
The checker's exploring loop now runs in WebAssembly

### Details
- JavaScript to WebAssembly): 100 pages, 74,606 situations: ungoogled Chromium 155.0.8059.39-1 235 to 107 ms (2.2x), Firefox 158.0 287 to 117 ms (2.5x), WebKitGTK 2.52.6 312 to 96 ms (3.2x), GNOME Web 46.5 290 to 79 ms (3.7x); 300 pages at the 200,002-situation limit: 303 to 35 ms (8.6x), 354 to 27 ms (13x), 377 to 41 ms (9.2x), 435 to 35 ms (12x); 150 pages at the limit: 382 to 35 ms (11x), 447 to 29 ms (15x), 484 to 36 ms (13x), 525 to 67 ms (7.8x).
- A 30-page story with 124 situations takes 1 to 2 ms either way.
- The test is `wasm-equiv.mjs` (60 stories in about 4 s) in `npm test` and the quick check.
- Size (smaller is better): editor 635,223 to 648,402 bytes plain (ceiling 660,000, 98%), packed 276,707 to 283,180 bytes (ceiling 295,000, 96%); exported games unchanged.

### Deep
**The checker's exploring loop now runs in WebAssembly** (`editor/wasm/checkwalk.c` 3,702 bytes, `editor/checkwalk.js`, hook in `analyzeRun` in `core.js`; `packages/story-check` regenerated as 1.0.1; new `editor/wasm-equiv.mjs`). Owner's rule of 2026-10-18 (wasm is the standard for hot code, JavaScript the fallback) and his pick "Unpacker + checker" on the card. The loop that visits every situation (page + items + number groups), with its bookkeeping (reached pages, shown choices and paragraphs, endings, stuck pages, duplicate labels, roll outcomes, who held what), is C; the table of the rules is built in JavaScript, the sets and maps are rebuilt from flat tables, and the later passes (graph, messages, explanations) are unchanged JavaScript. Used only when the tracked items fit in 30 bits and no page has more than 60 choices; otherwise, or without WebAssembly, or on any surprise, the JavaScript loop runs. Time of `analyze` on generated stories (smaller is better; median of 4 alternating rounds of 3 calls; JavaScript to WebAssembly): 100 pages, 74,606 situations: ungoogled Chromium 155.0.8059.39-1 235 to 107 ms (2.2x), Firefox 158.0 287 to 117 ms (2.5x), WebKitGTK 2.52.6 312 to 96 ms (3.2x), GNOME Web 46.5 290 to 79 ms (3.7x); 300 pages at the 200,002-situation limit: 303 to 35 ms (8.6x), 354 to 27 ms (13x), 377 to 41 ms (9.2x), 435 to 35 ms (12x); 150 pages at the limit: 382 to 35 ms (11x), 447 to 29 ms (15x), 484 to 36 ms (13x), 525 to 67 ms (7.8x). A 30-page story with 124 situations takes 1 to 2 ms either way. The remaining time in the 75,000-situation case is the later graph passes, still JavaScript. Proof of equal answers: 874 comparisons of everything `analyze` returns (messages, endings and their shortest ways, counts, explanations of every page) on random stories at several limits, with and without forgetting dead numbers, 0 differences; with one deliberate bug in the C (`need <= 11`) the same test finds 25 differences in 155. The test is `wasm-equiv.mjs` (60 stories in about 4 s) in `npm test` and the quick check. Size (smaller is better): editor 635,223 to 648,402 bytes plain (ceiling 660,000, 98%), packed 276,707 to 283,180 bytes (ceiling 295,000, 96%); exported games unchanged. `packages/story-check` 1.0.1: nothing changes for users, 41.5 to 42.0 KB minified. **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6 and GNOME Web (Epiphany) 46.5 for the timings; Node 22.22.0 for `wasm-equiv` and the package tests; the full check on the built editor: 117 suites, 0 FAIL, one retried pass (`inter` in Chromium, a dimmed-opacity timing check unrelated to this change); the new `walk` check passes in all four browsers (about 10 to 17 s each).

## 2026-10-18 · Changed

### Quick
The packed editor now unpacks itself with WebAssembly

### Details
- First decode of the editor's 200,288-byte payload (635,223 bytes unpacked), median of 6 alternating runs on a fresh page: ungoogled Chromium 69.7 to 21.7 ms (3.2x), Firefox 48 to 21 ms (2.3x), WebKitGTK 52 to 31 ms (1.7x), GNOME Web 48 to 36 ms (1.3x); smaller is better.
- Cost: the packed editor goes from 270,967 to 276,707 bytes (the newer packer alone is 1.4 KB smaller, the wasm bytes add 5.9 KB because they cannot be packed); ceiling 295,000 (94 percent used).
- New checks in `packed-check`: the wasm unpacker really runs (1 instance made), the page still opens with `WebAssembly` missing, and with module creation refused (three pages at once, about 5 s more per browser).

### Deep
**The packed editor now unpacks itself with WebAssembly** (`editor/build.py` `wasm=True`; `editor/lzma/` refreshed from JS-modules `tools/lzma-pack` and `modules/lzma-decode` 1.1.0, commit 32ee091, with the 4,087-byte `wasm/lzma-decode.wasm`, its C source and `build.sh`; `editor/qa/packed-check.js` extended). Owner's rule of 2026-10-18: WebAssembly is the standard for hot code, plain JavaScript the fallback. First decode of the editor's 200,288-byte payload (635,223 bytes unpacked), median of 6 alternating runs on a fresh page: ungoogled Chromium 69.7 to 21.7 ms (3.2x), Firefox 48 to 21 ms (2.3x), WebKitGTK 52 to 31 ms (1.7x), GNOME Web 48 to 36 ms (1.3x); smaller is better. Cost: the packed editor goes from 270,967 to 276,707 bytes (the newer packer alone is 1.4 KB smaller, the wasm bytes add 5.9 KB because they cannot be packed); ceiling 295,000 (94 percent used). If the browser has no WebAssembly or refuses it, the loader uses the JavaScript unpacker; the hash check still guards both. New checks in `packed-check`: the wasm unpacker really runs (1 instance made), the page still opens with `WebAssembly` missing, and with module creation refused (three pages at once, about 5 s more per browser). Hot-path timings behind the choice: a maintainers' folder. Exported games are unchanged. **Tested in:** Firefox 158.0 (reports 158.0b5), ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6 and GNOME Web (Epiphany) 46.5 (`packed-check`, 9 of 9 each); quick check 29 of 29 in Firefox 158.0.

## 2026-10-17 · Changed

### Quick
The editor's checks run faster

### Details
- Quick check: 74.7 s to 56.7 s (smaller is better; 25% less time) and 151 s to 121 s of processor time, 29 of 29 suites pass.
- Full check: 686 s (recorded earlier the same day) to 368 to 399 s in four full runs, 113 of 113 suites pass (the last run had one retried pass, `motion` in Chromium, since fixed).
- Where it came from: Firefox starts from a warm copy of its profile (1.7 s to 0.85 s per start, `qa-kit` 0.2.1);
- Chromium brings its page to the front before acting, which removed about 2 s from each click in `real` (46 s to 11 s) and waits that end early like Firefox's (`round3` 41.8 s to 24.9 s, `safety` 32.6 s to 19.4 s, `twowin` 29.4 s to 20.5 s);

### Deep
**The editor's checks run faster** (test tools only; the editor and the exported games are unchanged). Quick check: 74.7 s to 56.7 s (smaller is better; 25% less time) and 151 s to 121 s of processor time, 29 of 29 suites pass. Full check: 686 s (recorded earlier the same day) to 368 to 399 s in four full runs, 113 of 113 suites pass (the last run had one retried pass, `motion` in Chromium, since fixed). Where it came from: Firefox starts from a warm copy of its profile (1.7 s to 0.85 s per start, `qa-kit` 0.2.1); Chromium brings its page to the front before acting, which removed about 2 s from each click in `real` (46 s to 11 s) and waits that end early like Firefox's (`round3` 41.8 s to 24.9 s, `safety` 32.6 s to 19.4 s, `twowin` 29.4 s to 20.5 s); `fix2` no longer waits 30 s for a missing button in each browser (42 s to 10 s); `bugs12` waits for results instead of sleeping (39 s to 31 s); seven suites at a time instead of five on four cores. One check (`real`, WebKitGTK) now waits for the new choice instead of 120 ms. The test-browser repo address in `AGENTS.md` is now a private repository. Details: `editor/qa/README.md`. The full check now also has a short GNOME Web lane after WebKitGTK (the policy check and a new 8 s smoke check, `editor/qa/epismoke.js`, which uses script clicks because GNOME Web refuses WebDriver clicks). **Tested in:** Firefox 158.0b5, ungoogled Chromium 155.0.8059.39-1, WebKitGTK 2.52.6 and GNOME Web (Epiphany) 46.5 (full check, 111 suites plus 2 in GNOME Web; each full run had one check pass on its retry, a different one each time: `real` in WebKitGTK (twice, now hardened in six places), `safety` in Chromium (older than this change; it now prints more detail), `motion` in Chromium (the first-visit tour covered the page once; fixed). The WebKitGTK lane runs 5 suites at a time instead of 7: 187 s and no retried pass, against 241 s and four with seven).

## 2026-10-17 · Changed

### Quick
Exported story games now allow WebAssembly too

### Details
- Each exported game grows 19 bytes (the Keeper's Light 60,134 to 60,153, a standard 25-page game 51,742 to 51,761, with the Place code 54,979 to 54,998) and still sits 439 to 502 bytes under its size ceiling, so no ceiling was raised.

### Deep
**Exported story games now allow WebAssembly too** (`editor/core.js` `CSP_OFFLINE`, so `packages/story-player` and its `dist` files are regenerated; check `editor/qa/csp.js` extended). The owner chose yes on 2026-10-17: the same one word, `'wasm-unsafe-eval'`, in the games' `script-src`, nothing else in the policy changed. Each exported game grows 19 bytes (the Keeper's Light 60,134 to 60,153, a standard 25-page game 51,742 to 51,761, with the Place code 54,979 to 54,998) and still sits 439 to 502 bytes under its size ceiling, so no ceiling was raised. No game uses WebAssembly yet, so nothing behaves differently today. The `csp` check now also builds a game, confirms it carries the same policy as the editor page, and compiles a tiny WebAssembly module inside it; without the change it fails (the browser says the module is refused). The story-player package test also checks for the token. **Tested in:** Firefox 158.0b5, ungoogled Chromium 155.0.8059.39-1 and WebKitGTK 2.52.6 (full tier: 111 suites, 110 pass, 1 pass on retry, 0 fail, 7 min 27 s; the retried one was the `last` suite in WebKitGTK, a size-comparison check for the device-font game that passed on its second try and is not tied to this change; package tests green). The `csp` check, editor page and a built game, also passed in GNOME Web (Epiphany) 46.5 on WebKitGTK 2.52.6, one browser at a time (`WEBKIT=epiphany node csp.js webkit`; the session reported Epiphany 46.5). That run used the copy of webkit-driver 1.1.0 already in this repo: the check needs no mouse input, so JS-modules' webkit-driver 1.2.0 (pointer events in GNOME Web) was not needed and was not adopted. The other suites were not run in GNOME Web.

## 2026-10-17 · Changed

### Quick
The editor's own page policy now allows WebAssembly

### Details
- `story-editor.plain.html` +19 bytes (635,185 to 635,204), the delivered packed file +40 bytes (270,944 to 270,984).

### Deep
**The editor's own page policy now allows WebAssembly** (`editor/build.py`, one word added to `script-src`: `'wasm-unsafe-eval'`; new check `editor/qa/csp.js`). This is the owner's rule of 2026-10-17 for all our pages. Nothing else in the policy changed (still no network, no forms, no base tag, no `'unsafe-eval'`). No editor feature uses WebAssembly yet, so nothing behaves differently today; it only stops the policy from blocking a module when one is adopted. `story-editor.plain.html` +19 bytes (635,185 to 635,204), the delivered packed file +40 bytes (270,944 to 270,984). The new `csp` check reads the policy text and compiles an 8-byte WebAssembly module inside a script of the page: it passes in all three browsers, and on the old policy it fails (the browser says the module is refused). **Exported games are not changed**: they use a separate policy line (`CSP_OFFLINE` in `core.js`) and wait for the owner's answer. **Tested in:** Firefox 158.0b5, ungoogled Chromium 155.0.8059.39-1 and WebKitGTK 2.52.6 for the new check; quick tier on Firefox and WebKitGTK, 54 of 54 suites; Chromium for the other suites not rerun for this change.

## 2026-10-17 · Changed

### Quick
Text only: Net Flow Map is now called Netflow Map

### Deep
**Text only: Net Flow Map is now called Netflow Map** (`AGENTS.md`, the rule that the story map is its own product). The app and its repo were renamed (a private repository); the rule itself is unchanged, and the only mention in this repo was that one line (4 uses of the old name, now all 4 use the new one, with a note once that it used to be called Net Flow Map). Older changelog rows keep the old name on purpose. No code changed. **Tested in:** not run (a text-only change; no browser involved).

## 2026-10-17 · Fixed

### Quick
The "Changed in another window" warning now appears whenever another window or copy has saved the story

### Details
- The two-windows suite grew from 22 to 32 checks (10 new); on the old build 5 of them fail and the run then stops, on the new one all pass in Firefox, Chromium and WebKitGTK.
- Cost: `story-editor.html` +83 bytes (635,102 to 635,185), packed +104 bytes (270,840 to 270,944).

### Deep
**The "Changed in another window" warning now appears whenever another window or copy has saved the story** (`editor/ui1-state.js`, `ui5-app.js`; checks in `editor/qa/twowin.js`). Before, that warning came only from the browser's `storage` event and only in browsers without Web Locks; where Web Locks exist, a copy of the editor that does not share the lock (or a tab that slept and missed the event) could be overwritten by this window's next autosave with no warning. Now (1) the event is listened to in every browser, and (2) the autosave itself looks at the stored story before it writes: if it is a whole story that this window did not write and does not hold, nothing is written and the box asks "Load their version" or "Keep mine" (their version becomes the spare copy). Saves the person asks for (Keep mine, New story, Open, Example) are not stopped. The two-windows suite grew from 22 to 32 checks (10 new); on the old build 5 of them fail and the run then stops, on the new one all pass in Firefox, Chromium and WebKitGTK. Cost: `story-editor.html` +83 bytes (635,102 to 635,185), packed +104 bytes (270,840 to 270,944). Exported games are not changed. Not changed: save-kit is still not used by the editor (its fit was reviewed in this thread: the editor already has a stronger whole-story check, spare copy and writer lock). **Tested in:** Firefox 158.0b5 and ungoogled Chromium 155.0.8059.39-1 (full tier without WebKitGTK: 74 suites, 74 pass); the first full run on all three, with WebKitGTK 2.52.6, passed 105 of 108 with 2 passing on retry and 1 failure (`safety` on Chromium, in one run only; it passed in 14 later runs alone, in parallel and under load, and in the second full run, and the test now prints the window's state before the reload so a repeat can be explained). `twowin` in WebKitGTK passed in that first run.

## 2026-10-17 · Added

### Quick
WebKitGTK is now the third browser for the Story Editor's checks

### Details
- Time: quick tier on Firefox plus WebKitGTK is 52 suites in 285 s (about 3 min for the WebKitGTK part); the full tier is 108 suites in 686 s (11 min 26 s) against about 6 min 45 s for 74 suites on two browsers.
- `story-editor.html` +21 bytes, 635,081 to 635,102; packed 270,852 to 270,840).

### Deep
**WebKitGTK is now the third browser for the Story Editor's checks** (`packages/qa-kit/src/webkit.js`, `webkit-driver.js`, `editor/qa/qa.js`, `engine.js`, `gamefeel.js`, `safety.js`, `write1.js`, `real.js`; one editor change below). (1) Every suite that runs on Firefox now also runs in WebKitGTK 2.52.6 except two: `ffsmoke` (it checks the Firefox stand-in itself) and `touch1` (WebKitGTK 2.52.6 has no touch events). That is 34 of the 36 Firefox suites. `node qa.js full` runs Firefox, then Chromium, then WebKitGTK, one browser at a time; `--webkit` adds it to the quick tier, `--no-webkit` leaves it out of the full tier, `--webkit-only` runs just that lane. (2) The adapter is 310 lines on top of the 218-line WebKit driver (a copy of JS-modules `tools/webkit-driver` 1.1.0), and the suites' own checks are unchanged: only four suites needed edits, each still checking the real behavior (`safety` has a new check for a browser with no storage-size report, `gamefeel` expects Esc not to go Back where the browser has no close-watcher, `write1` compares against the real window width, `real` now waits for the Save window before it looks for anything that should not happen). (3) Time: quick tier on Firefox plus WebKitGTK is 52 suites in 285 s (about 3 min for the WebKitGTK part); the full tier is 108 suites in 686 s (11 min 26 s) against about 6 min 45 s for 74 suites on two browsers. (4) Found by the new lane and fixed: the row of tabs under the editor's toolbar showed a sideways scroll bar that sat over the tabs and swallowed clicks near the bottom edge in WebKitGTK; it is now hidden (`scrollbar-width:none` on `#tabs`, the tabs still scroll; `story-editor.html` +21 bytes, 635,081 to 635,102; packed 270,852 to 270,840). (5) One check in `real` raced the Save window in WebKitGTK (1 of 1 full runs); after the fix it passed 3 of 3 alone there, and on Firefox and Chromium. Limits, in plain words: WebKitGTK cannot make its window narrower than 447 px (a 390 px phone check runs at 447 and says so in the output), and a browser's storage is dropped when the last window of a context closes. **Tested in:** Firefox 158.0b5, ungoogled Chromium 155.0.8059.39-1 and WebKitGTK 2.52.6 (full tier: 107 pass, 1 pass on retry, 0 fail, run before the `real` fix; `real` alone after it on all three). GNOME Web 46.5 not run.

## 2026-10-17 · Changed

### Quick
Faster, fairer checks

### Details
- The quick tier went from about 150 s to about 102 to 107 s on a four-core machine (about 30% faster, same CPU time, about 250 s): five checks at a time instead of three (112 s) and a hidden 30 s wait in `tools8` removed (it clicked a button by a name that did not exist inside its container, waited out the limit on every run, then fell back to the right name).
- `PROFILE=1` now lists the eight slowest single calls with the suite and line, which is how the 30 s wait was found.
- The `real` suite waits for what it checks (focus in the new choice box, the new page, the unsaved dot) instead of sleeping 200 ms and 100 ms; it failed on Chromium 155 only because typing started before the box had focus, and passed on Chromium 141.
- A full run on both browsers takes about 6 min 45 s here (73 of 74 suites passed before the `real` fix, which then passed alone: Firefox 13 s, Chromium 51 s).

### Deep
**Faster, fairer checks** (`editor/qa/qa.js`, `engine.js`, `tools8.js`, `real.js`, `packages/qa-kit/src/bidi.js`; no editor change). (1) The quick tier went from about 150 s to about 102 to 107 s on a four-core machine (about 30% faster, same CPU time, about 250 s): five checks at a time instead of three (112 s) and a hidden 30 s wait in `tools8` removed (it clicked a button by a name that did not exist inside its container, waited out the limit on every run, then fell back to the right name). (2) `PROFILE=1` now lists the eight slowest single calls with the suite and line, which is how the 30 s wait was found. (3) Every run prints the real Firefox and Chromium versions on line 1, `CHROMIUM_PATH` makes the Chromium suites use the approved build (no silent fallback; a wrong path stops the run), and the full tier runs Firefox suites first, then Chromium suites, so only one browser is open at a time. (4) The `real` suite waits for what it checks (focus in the new choice box, the new page, the unsaved dot) instead of sleeping 200 ms and 100 ms; it failed on Chromium 155 only because typing started before the box had focus, and passed on Chromium 141. Not changed: every check is still run, none was loosened. A full run on both browsers takes about 6 min 45 s here (73 of 74 suites passed before the `real` fix, which then passed alone: Firefox 13 s, Chromium 51 s). WebKitGTK is not covered: the suites have no WebKit driver yet. **Tested in:** Firefox 158.0b5 and ungoogled Chromium 155.0.8059.39-1 (quick tier, full tier, `real` suite on both); WebKitGTK 2.52.6 not run for these suites.

## 2026-10-17 · Changed

### Quick
`contract-kit` 1.1.0

### Details
- The code grew from 101 to 308 lines (1.9 KB to 7.2 KB minified).

### Deep
**`contract-kit` 1.1.0** (`packages/contract-kit/`): fixes six ways its checks could pass when they should fail (async answers, empty-message and string throws, `rnd()` reaching 1, `watchReads` identity and frozen data, a crash on a table without a display list), adds `shrink` (a failing story of 4,096 bytes, 9 pages and 10 choices cut to 685 bytes, 1 page and 3 choices in 126 tries), `agreeAsync`, `tags`/`expect`, `seconds`, `checkKept`, a browser-safe `contract-kit/core`, and a `clone: false` option (126 ms to 72 ms for 200 runs of the checker). The code grew from 101 to 308 lines (1.9 KB to 7.2 KB minified). **Tested in:** Node 22.22.0 package tests; the core's fixed checks in Firefox 158.0, ungoogled Chromium 155.0.8059.39-1 and WebKitGTK 2.52.6, one at a time, all matching Node.

## 2026-10-16 · Added

### Quick
Plain-words changelogs for the six packages that had none

### Details
- Each says what is new or how much better with measured numbers: for example the minified builds are about 40% (story-check, 68.8 to 41.5 KB), 21% (story-player), 41% (story-map) and 33% (zip-page) smaller, and the checker went from 679 ms to 294 ms on a 48,000-situation story.

### Deep
**Plain-words changelogs for the six packages that had none** (`packages/story-check`, `story-player`, `story-map`, `zip-page`, `qa-kit`, `ai-collab-kit`, each `CHANGELOG.md`, listed in `package.json` and linked from the README). Each says what is new or how much better with measured numbers: for example the minified builds are about 40% (story-check, 68.8 to 41.5 KB), 21% (story-player), 41% (story-map) and 33% (zip-page) smaller, and the checker went from 679 ms to 294 ms on a 48,000-situation story. **Tested in:** Node 22.22.0 package tests and docs check (`npm test`, all green); documentation only, no browser was used.

## 2026-10-16 · Fixed

### Quick
The example in File → Paste an outline…

### Deep
**The example in File → Paste an outline…** wrote “(bad ending)” inside a choice, which made an empty page literally named “Cold night (bad ending)”. The example now puts the ending on its own page line, as the reader expects (`ui4-helpers.js`). The reader itself is unchanged. **Tested in:** Firefox 157.0.1 (the `helpers` suite, after this change) and Node 22.22.0 (`npm test`). Chromium was not rerun after this change.

## 2026-10-16 · Added

### Quick
`contract-kit`

### Deep
**`contract-kit`**: the idea behind `editor/contract.mjs` (a second, simple implementation compared with the fast one on random inputs, a table of fields that the analyzer must read, a time limit) written as a guide, with a hand-written helper of about 100 lines (`seeded`, `agree`, `watchReads`, `checkFieldTable`, `guarded`) and tests. Not generated from the editor; the contract test itself is unchanged. **Tested in:** Node 22.22.0 package tests only; no browser (the package does not touch the editor).

## 2026-10-16 · Added

### Quick
Two small packages cut from the editor: `story-outline` and `story-diff`.

### Deep
**Two small packages cut from the editor: `story-outline` and `story-diff`.** `story-outline` is the reader behind File → Paste an outline… plus `outlineToProject(text, title)`, which makes a whole story from an outline; `story-diff` is `describeChange`, the label on the Undo and Redo buttons, now also accepting story objects as well as JSON text. To make the outline step reusable, the planning code moved from `ui4-helpers.js` into `helpers.js` as `outlinePlan(parsed, project)` with the open story passed in; the editor behaves the same. No changes for readers of the editor. **Tested in:** Node 22.22.0 package tests; the `helpers` and `undohist` editor suites on Chromium 141.0.7390.37 (Playwright's bundled build), Chromium 153.0.8010.0 (not ungoogled) and Firefox 157.0.1; then Firefox 157.0.1 quick tier, 28 of 28 (run on the build before the example fix in the 2142 row).

## 2026-10-16 · Changed

### Quick
Twine import is now its own package, `twine-import`

### Details
- Minified `story-format` went from 71.7 KB to 29.5 KB;
- `twine-import` minified is 53.5 KB.

### Deep
**Twine import is now its own package, `twine-import`** (`tools/extract-packages.mjs`, `packages/twine-import/`). It was part of `story-format`; people who only want the story data model no longer carry the importer. `story-format` is 2.0.0 because `importTwine`, `twineRead`, `twineConvert` and the `twine-to-story` command left it (they work the same in `twine-import`, which has its own copy of the small model it needs). Minified `story-format` went from 71.7 KB to 29.5 KB; `twine-import` minified is 53.5 KB. The editor itself is unchanged (it reads `twine.js` directly). Fixtures and tests moved with it. **Tested in:** Node 22.22.0 package tests. The editor is unchanged by this row; the same pull request's editor build ran on Firefox 157.0.1 (quick tier, 28 of 28).

## 2026-10-16 · Changed

### Quick
Checker and format package speed-ups, and minified package builds

### Details
- The checker's note "a player who arrives without it can never come back for it" now uses one flat table of backward moves and stops as soon as every missing situation has been reached: a finished check of a 48,000-situation story went from 679 ms to 294 ms, with identical answers on 156 test stories.
- `storyManuscript` and `storyStats` look pages and items up in a map instead of searching the list for each choice (a 3,000-page manuscript took 40 ms and grew faster than the page count).
- Every package now also ships `dist/<name>.min.mjs` and `dist/<name>.min.global.js` (same code, names shortened; story-check 69 KB to 41 KB, story-format 118 KB to 72 KB); the CDN fields in each `package.json` point at the minified script.

### Deep
**Checker and format package speed-ups, and minified package builds** (`editor/core.js`, `tools/extract-packages.mjs`). (1) The checker's note "a player who arrives without it can never come back for it" now uses one flat table of backward moves and stops as soon as every missing situation has been reached: a finished check of a 48,000-situation story went from 679 ms to 294 ms, with identical answers on 156 test stories. (2) `normalizeProject` no longer writes `_newId` onto the pages you pass in, so frozen data works; new options `{ ids: 'sequential' }` (same file, same ids every time: `p_1`, `i_1` ...) and `{ notes: [] }` (collects what the author should hear). The editor's behavior is unchanged. (3) `storyManuscript` and `storyStats` look pages and items up in a map instead of searching the list for each choice (a 3,000-page manuscript took 40 ms and grew faster than the page count). (4) Every package now also ships `dist/<name>.min.mjs` and `dist/<name>.min.global.js` (same code, names shortened; story-check 69 KB to 41 KB, story-format 118 KB to 72 KB); the CDN fields in each `package.json` point at the minified script. **Tested in:** Node 22.22.0 package tests and the contract test; selected editor suites on Chromium 141.0.7390.37 (Playwright's bundled build). No Firefox run: Firefox could not be installed in the container then.

## 2026-10-16 · Changed

### Quick
Repository renamed to `story-editor`

### Deep
**Repository renamed to `story-editor`** (https://github.com/lfcfoundry/story-editor, Pages: https://lfcfoundry.github.io/story-editor/). The old repository name is replaced in the READMEs, AGENTS.md, llms.txt, FOUNDATION.md, the root and package `package.json` files, `packages/index.json`, the jsDelivr import examples and the story schema `$id`. The built editor does not contain the repository name, so it is unchanged. The row below keeps the old name because it records the earlier move. **Tested in:** not recorded for this build. (Link and text changes.)

## 2026-10-16 · Changed

### Quick
Story Editor moved

### Details
- Packages regenerated, editor rebuilt, root `index.html` refreshed; the size budget moved by +5 to +22 bytes.

### Deep
**Story Editor moved** to https://github.com/lfcfoundry (the lfcfoundry organization on GitHub). Every link to the old JNFoo address in the READMEs, AGENTS.md, llms.txt, FOUNDATION.md, the package metadata (author is now LFC Foundry; repository, homepage, jsDelivr and schema links) and the "Forged by LFC Foundry" link in the editor, in the file header and in every exported game now points to https://github.com/lfcfoundry. The author and committer of every commit stay JNFoo (hooks unchanged), as do the credits in NOTICE for who wrote the code and the sample story; the other games stay under JNFoo until they move. Packages regenerated, editor rebuilt, root `index.html` refreshed; the size budget moved by +5 to +22 bytes. **Tested in:** not recorded for this build. (Link and text changes.)

## 2026-10-15 · Changed

### Quick
JS-modules moved

### Deep
**JS-modules moved** to https://github.com/lfcfoundry/JS-modules (Pages: https://lfcfoundry.github.io/JS-modules/). Every link to the old JNFoo address in the READMEs, AGENTS.md, llms.txt, FOUNDATION.md and the copied packer and decoder headers now points to the new one; the other games stay under JNFoo. Rebuilt, and the root `index.html` was refreshed to match. **Tested in:** not recorded for this build. (Link and text changes.)

## 2026-10-15 · Changed

### Quick
LFC Foundry notices on all software

### Details
- Game size ceilings raised by 700 bytes each for the header (about 1,430 bytes, 700 gzipped): Keeper's Light 60,129 of 60,600, Standard 51,737 of 52,200, Place code 54,974 of 55,500; editor 633,431 plain (ceiling 660,000), 270,103 packed (ceiling 295,000).

### Deep
**LFC Foundry notices on all software** (owner's standing rule, Oct 15). Copyright holder is now LFC Foundry in every file header, LICENSE, NOTICE, README and package metadata (85 files); JNFoo stays the author and committer of every commit. The LFC Foundry header comment (application name, forged by, MIT text, branding notice; text in `editor/foundry-header.txt`) now starts the delivered editor (packed, plain and artifact builds) and every exported game, zipped or not (`foundryHeader()` in `core.js`; the game's own title is the application name, dashes in a title cannot close the comment, and a line says the story's words and art stay the story's author's). The only visible credit is the editor app's footer "Forged by LFC Foundry • MIT Licensed" (a slim line on wide windows; the last entry of the ⋯ menu on narrow ones, to keep the height); games show no credit and the page title is unchanged. `build.py` now writes the delivered file as bytes (the header holds emoji). Game size ceilings raised by 700 bytes each for the header (about 1,430 bytes, 700 gzipped): Keeper's Light 60,129 of 60,600, Standard 51,737 of 52,200, Place code 54,974 of 55,500; editor 633,431 plain (ceiling 660,000), 270,103 packed (ceiling 295,000). New suite `foundry`. **Tested in:** not recorded for this build. (Link and text changes.)

## 2026-10-14 · Changed

### Quick
Narrow window on a computer

### Details
- `phone` suite gained 9 checks (logo and name at bottom left, counters under the top bar and in one place on Map, Items, Check and Game, not on Play, not in the menu, tabs still without sideways scroll, phone unchanged).

### Deep
**Narrow window on a computer** (not a touch phone): the logo and app name move from the top bar to the bottom bar, at the left beside the tabs (one node, moved by `placeChrome` in `ui4-phone.js`; the click still replays the opening), and the story counters (pages, items, choices, words, endings) stay on a slim line under the top bar on every tab, in the same place, instead of inside the ⋯ menu. The Play tab leaves the counters off at every width. On a touch phone nothing changes: no logo in the top bar, counters first in the ⋯ menu. New `body.touch` and `body.brandlow` classes; `phone` suite gained 9 checks (logo and name at bottom left, counters under the top bar and in one place on Map, Items, Check and Game, not on Play, not in the menu, tabs still without sideways scroll, phone unchanged). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-14 · Changed

### Quick
Phone layout

### Deep
**Phone layout** (`ui4-phone.js`, `ui.css` section 16, `ui5-app.js`, `ui3-write.js`, `ui4-status.js`). Tabs are a bottom icon bar (six columns, icon plus a tiny label, no sideways scroll, red count on Check). The top bar is one row (File, Save, Undo, Redo, title, ⋯); the ⋯ menu holds the story size and problems, History…, Export game, the quick guide, the tour and the options (no Keyboard shortcuts entry on touch devices). The Write tab pins one 49 px page-name bar (☰ Pages, ‹ › back and forward through visited pages, the page picker, ↑ to the page's name, flags and type, Items); swiping that bar left or right opens the next or previous page in the list (one-time tip); the page's own header scrolls away and its type and effects fold into one "Page type and effects" line. **Typing mode**: while a text box has the keyboard, the top bar, page bar and tabs fold away and one slim row stays above the keyboard (+ Paragraph, + Choice, Undo, Redo, Done); the viewport meta uses `interactive-widget=resizes-content` and the row follows `visualViewport`. The map toolbar wraps into rows with larger icons. Remaining small touch targets raised (map icons 38×36, path chips, checkboxes 20 px, segmented buttons). **Touch wording**: the first-time tour has touch and phone variants and its Export and last steps point at ⋯; the quick guide has a "Using a phone or tablet" section and shortcut sentences have touch versions; an item's press-and-hold menu now has Gets and Loses (or Add a change for a number) and its hint says "tap = Gets · press and hold = more". Measured at 390×844: fixed top chrome 105 px before text starts (was 252 px fixed header plus a 107 px sticky page header, and 53 px of bottom bar); the first paragraph starts at 292 px. New suite `phone` (Firefox 158 and Chromium; Firefox cannot emulate a coarse pointer, so it uses `__editor.touch(true)` and `__editor.typing(true)`). Sizes: editor 628,858 plain (ceiling 660,000), 267,403 packed (ceiling 295,000); games unchanged. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-14 · Added

### Quick
First round of offline helper features (phase 5 of docs/UI-ADULT-PHASES.md; no AI, no network, chosen by the owner).

### Details
- **File → Paste an outline…** (`helpers.js` `parseOutline`, `ui4-helpers.js`): one page per line, indented lines are choices (`Choice → Page`, also `->` and `=>`) or paragraphs, `(ending)`, `(good ending)`, `(bad ending)`; live preview with counts and anything that could not be used; pages named only in a choice are added empty; one Undo removes all of it; a story holding only the empty first page takes the outline as its own pages.
- Size ceilings raised: editor 620,000 to 660,000 plain and 275,000 to 295,000 packed (this round used 13 KB; more UI phases are planned; owner said to raise first and trim later).

### Deep
First round of offline helper features (phase 5 of docs/UI-ADULT-PHASES.md; no AI, no network, chosen by the owner). **File → Paste an outline…** (`helpers.js` `parseOutline`, `ui4-helpers.js`): one page per line, indented lines are choices (`Choice → Page`, also `->` and `=>`) or paragraphs, `(ending)`, `(good ending)`, `(bad ending)`; live preview with counts and anything that could not be used; pages named only in a choice are added empty; one Undo removes all of it; a story holding only the empty first page takes the outline as its own pages. **Writing notes** in the Check tab (`writingChecks`): a word typed twice in a row, a word overused on a page, a name that may be a typo (one letter from a commonly used capitalized word never written in lower case), choices that read almost alike (exact repeats stay with the checker), long paragraphs and pages (limits 150 and 600 words, changeable); each note has Open page and Ignore (kept in this browser only); the count shows in the status line. Fixed from the earlier round: below 1,360 px wide the top bar wrapped Export onto a second row after the History button was added (title now shrinks; under 1,200 px the totals take their own row), and the phone status line wraps instead of scrolling. Size ceilings raised: editor 620,000 to 660,000 plain and 275,000 to 295,000 packed (this round used 13 KB; more UI phases are planned; owner said to raise first and trim later). Sizes: editor 612,584 plain, 262,807 packed; games unchanged. New suite `helpers`. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-14 · Added

### Quick
Four picks from the single-file UI research (adult edition; list of the rest in docs/UI-ADULT-PHASES.md).

### Details
- **Reader language + direction**: new `lang0c` field (story language code, `l0c` in the story file, in the schema and typings; not stored for English), set beside the language name in File → Translations; exported pages carry `lang` and `dir="rtl"` for right-to-left languages, switching languages in the reader updates both, game CSS uses logical edges.
- Sizes: editor 599,300 plain (ceiling 620,000), 257,663 packed (ceiling 275,000); games +108 bytes: Keeper's Light 58,699, Standard 50,307, Place code 53,544 (ceilings unchanged).

### Deep
Four picks from the single-file UI research (adult edition; list of the rest in docs/UI-ADULT-PHASES.md). **Named Undo + History** (`changes.js`, `ui4-status.js`): Undo and Redo say what they will do ("Undo: Delete page “The Cellar”", worked out only when the button is pointed at, by comparing two saved copies, so commits cost nothing), a ▾ History button lists the last 20 steps and goes back to just before any of them in one restore, a toast offers Redo, and the changed page is shown and flashed (not when motion is reduced); delete toasts name the page. **Save line + problems strip** in the tab row: checker verdict (same honest "not fully checked" wording), Next problem, saved-in-this-browser time, age of the last file copy; wraps under the tabs on phones. **Reader language + direction**: new `lang0c` field (story language code, `l0c` in the story file, in the schema and typings; not stored for English), set beside the language name in File → Translations; exported pages carry `lang` and `dir="rtl"` for right-to-left languages, switching languages in the reader updates both, game CSS uses logical edges. **Reader follows phone text size**: text in rem and the `text-scale` meta. New suite `undohist` (Firefox 158 and Chromium). Sizes: editor 599,300 plain (ceiling 620,000), 257,663 packed (ceiling 275,000); games +108 bytes: Keeper's Light 58,699, Standard 50,307, Place code 53,544 (ceilings unchanged). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-14 · Added

### Quick
Three features chosen after the comparison with Twine, Ink, Yarn Spinner and ChoiceScript.

### Details
- Routes live in the browser (the last one and up to 12 pinned, per story), not in the story file (`routes.js`).
- **Translations** (File → Translations…): add up to 12 languages, save a CSV sheet (UTF-8 with a byte-order mark; columns Where first used, Original, one per language), fill it in a spreadsheet, import it (comma, semicolon or tab; empty cells change nothing; rows that match no text are reported and skipped); translations are keyed by the exact words, so moving pages never mixes them and an edited sentence simply shows as not translated; an exported game with a language carries a small `klFeatLang` module and a language menu, remembers the reader's choice, and translates its own words (the eight fixed button and label words) too, while a game without languages is byte-for-byte unchanged apart from the shared helper.
- **Size ceilings raised on request, with the reasons recorded in `build.py` (the owner said to raise them now and discuss compressing later, and expects more growth once the UI research is shared):** editor 565,000 → 620,000 plain and 246,000 → 275,000 packed (now 587,933 / 253,986, +27.7 KB / +9.8 KB since the Twine build);
- Keeper's Light, Standard and Place code games +1,300 bytes each (now 58,599; 50,199; 53,436, +64 bytes each for the translation helper).

### Deep
Three features chosen after the comparison with Twine, Ink, Yarn Spinner and ChoiceScript. **Pinned routes** (Play tab): pin the route you are playing, replay any pinned route after you edit, and the first step that no longer works is named in a plain sentence; the Check tab counts pinned routes that still work. Routes live in the browser (the last one and up to 12 pinned, per story), not in the story file (`routes.js`). **Page colors and notes**: seven colors and a private note per page (`color`, `note`, display-only, left out of exports, listed in `FIELD_CONTRACT`); a stripe and a note icon on the map, a dot in the page list, "Color and note…" in the page menu and a mark button on the page bar. **Translations** (File → Translations…): add up to 12 languages, save a CSV sheet (UTF-8 with a byte-order mark; columns Where first used, Original, one per language), fill it in a spreadsheet, import it (comma, semicolon or tab; empty cells change nothing; rows that match no text are reported and skipped); translations are keyed by the exact words, so moving pages never mixes them and an edited sentence simply shows as not translated; an exported game with a language carries a small `klFeatLang` module and a language menu, remembers the reader's choice, and translates its own words (the eight fixed button and label words) too, while a game without languages is byte-for-byte unchanged apart from the shared helper. Story file gains optional `langs` and `lang0` (schema and typings updated). New suites marks, routes and translate pass in Firefox 158 and Chromium; contract test gained a translation section. **Size ceilings raised on request, with the reasons recorded in `build.py` (the owner said to raise them now and discuss compressing later, and expects more growth once the UI research is shared):** editor 565,000 → 620,000 plain and 246,000 → 275,000 packed (now 587,933 / 253,986, +27.7 KB / +9.8 KB since the Twine build); Keeper's Light, Standard and Place code games +1,300 bytes each (now 58,599; 50,199; 53,436, +64 bytes each for the translation helper). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-14 · Added

### Quick
Import Twine

### Details
- Editor +50 KB plain / +20 KB packed (ceilings raised to 565,000 / 246,000); story-format dist +121 KB.

### Deep
**Import Twine** (File → Import Twine…, `importTwine` in story-format, `twine-to-story` command): Twine 2 HTML (single story or library archive), Twee 3 text and Twine 1 HTML become a story in this format. Every `[[link]]` form becomes a choice. SugarCube, Twine 1 and Harlowe code can be kept as flagged text or turned into rules: yes/no flags, bounded numbers, pick-one sets, "been there" flags, if / else-if / else as conditional paragraphs and choices, link setters, goto as "Continue"; Chapbook, Snowman and other code is flagged. A plain-words report lists what was converted, flagged or left out. Checked with a reference player over random SugarCube and Harlowe stories (exhaustive, 0 differences) and 1,326 damaged files (0 crashes). **The author named in the Twine file is kept word for word, never replaced; none named means an empty Author box and a report line.** The licenses of Twine and its story formats were read from their own pages and recorded in NOTICE.md (Harlowe's could not be read). Editor +50 KB plain / +20 KB packed (ceilings raised to 565,000 / 246,000); story-format dist +121 KB. New suites: twine (Firefox 158 and Chromium), twine-diff, story-format twine tests. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-14 · Added

### Quick
Fifteen more picks from the project-notes cross-check (the "first 15" of the open list): **(A9)** Options → Safety: what the autosave is, when the story was last saved to a...

### Details
- **(A19)** File → Save test script (.md): a tick-box checklist of routes that together take every choice at least once, every skill-check outcome included; the contract test replays every route and checks the cover against the brute-force play-out.
- **(A11)** local names are shortened in the shipped editor: 551,832 → 509,265 bytes plain, 229,939 → 224,159 packed (−2.5%); ceilings lowered to 520,000 and 229,000.
- Size ceilings for the games raised by 600, 700 and 500 bytes for the recap (58,600; 50,200; 53,500).

### Deep
Fifteen more picks from the project-notes cross-check (the "first 15" of the open list): **(A9)** Options → Safety: what the autosave is, when the story was last saved to a file, space used, and a button asking the browser to keep it; a start-up reminder after 7 days without a file save (at most once a day, never for an almost empty story). **(A20)** every file save writes a revision number and time into the story (`rev`, `savedAt`, display-only; shown in the toast and the Safety box). **(A21)** an ordered `MIGRATIONS` list in `core.js` for the day the format becomes 2, a test with an old-release fixture, and a note when a file comes from a newer format. **(A17)** the ending recap lists "Roads not taken": choices open to anyone on the pages you passed that you did not pick (never one that needs or forbids an item). **(A19)** File → Save test script (.md): a tick-box checklist of routes that together take every choice at least once, every skill-check outcome included; the contract test replays every route and checks the cover against the brute-force play-out. **(A10)** the Speed report says when the file arrived, when the editor's code started (the unpacking) and when the first screen was drawn. **(A11)** local names are shortened in the shipped editor: 551,832 → 509,265 bytes plain, 229,939 → 224,159 packed (−2.5%); ceilings lowered to 520,000 and 229,000. **(A13, A14, A15, A5)** the test runner prints the expected time first and a `next:` hint after a failure, keeps a flake ledger (`--history`), skips suites by their failure history in `smart` and has a rotating `sample` tier, and `--against <rev> [--expect-fail]` proves a new check fails on the build from before the fix. **(A6)** failing fuzz runs shrink to a smallest case (`fuzz3.mjs` for damaged stories, `Fuzzer.shrink` in JS-modules `fuzz-kit`). **(A4)** `tools/docs-drift.mjs` (part of `npm test`) fails when a document names a file that is not in the repository. **(A22)** the AI kit's AGENTS template gains an always / ask first / never list and cost habits. **(A3)** `tools/storage-probe` in JS-modules: a one-button page that says whether copies of a page in different folders share saved data. Size ceilings for the games raised by 600, 700 and 500 bytes for the recap (58,600; 50,200; 53,500). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-14 · Added

### Quick
Seven picks from the project-notes cross-check (STORY-EDITOR-CROSSCHECK.md): **(A1)** the contract test now compares the paragraphs and choices a player sees with a plain-words...

### Details
- Size ceilings raised by 500 bytes (Keeper's Light 58,000;

### Deep
Seven picks from the project-notes cross-check (STORY-EDITOR-CROSSCHECK.md): **(A1)** the contract test now compares the paragraphs and choices a player sees with a plain-words reading and stops after 90 seconds instead of hanging; `qa/mutants.py` shows that all 14 deliberate rule bugs are caught (10 before). **(A2)** the editor's autosave is guarded: a second window or copy is paused with a "Use this window instead" box (Web Locks, with a storage-event fallback). **(A7)** in a stand-alone game the phone's back swipe or button (and Esc) does Back while there is a page to go back to (CloseWatcher). **(A8)** the game starts in High contrast when the system asks (prefers-contrast: more) until the reader chooses; a forced-colors rule keeps locked choices apart. **(A18)** a choice already taken in this run gets a check mark and lighter type (the game's saved place gains `seen`). **(A16)** new `textstress` suite: found and fixed the Aa panel running off the left edge of a 320 px screen at Larger text and on ending pages. **(A12)** the house-rule git hooks were added to `tools/hooks` by another session at the same time, so nothing was built for it. Size ceilings raised by 500 bytes (Keeper's Light 58,000; Standard 49,500; Place code on 53,000). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-12 · Fixed

### Quick
Games now say so when the browser will not keep their save (a private window, blocked site data or a full disk): a short note on the page, "This browser is not saving your...

### Details
- Costs 487 bytes in every game (Standard 25-page game 48,219 to 48,706).

### Deep
Games now say so when the browser will not keep their save (a private window, blocked site data or a full disk): a short note on the page, "This browser is not saving your place... you will start over", instead of silently losing progress. Checked once at the start and by every save; it goes away if saving starts working. Costs 487 bytes in every game (Standard 25-page game 48,219 to 48,706). New suite nosave in Firefox and Chromium (normal, blocked from the start, full disk later). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-12 · Changed

### Quick
The editor file is now packed with LZMA instead of zipped: 249,190 to 224,251 bytes (-10%; 169,502 gzipped), opening checks a hash of the unpacked page and shows a plain...

### Details
- Stored as base64 so it works from a file and from any web server (the raw-bytes form, 173,313 bytes, fails on servers that send a UTF-8 charset header, such as GitHub Pages, so it is not used).
- New suite packed-check (file, http with a UTF-8 header, damaged file) in Firefox and Chromium; full QA 45 suites, 0 failures.

### Deep
The editor file is now packed with LZMA instead of zipped: 249,190 to 224,251 bytes (-10%; 169,502 gzipped), opening checks a hash of the unpacked page and shows a plain message if the file was changed. Stored as base64 so it works from a file and from any web server (the raw-bytes form, 173,313 bytes, fails on servers that send a UTF-8 charset header, such as GitHub Pages, so it is not used). Packer and decoder copied from JS-modules into editor/lzma/. Exported games stay zipped: the browser can zip but has no LZMA compressor, and a JavaScript one would cost more than it saves. New suite packed-check (file, http with a UTF-8 header, damaged file) in Firefox and Chromium; full QA 45 suites, 0 failures. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-12 · Added

### Quick
Open-source release under the MIT License (Copyright JNFoo): editor sources, packages cut from them (story-format, story-check, story-player, story-map, zip-page; a test fails...

### Deep
Open-source release under the MIT License (Copyright JNFoo): editor sources, packages cut from them (story-format, story-check, story-player, story-map, zip-page; a test fails if they drift), qa-kit, ai-collab-kit, root AGENTS.md, llms.txt, packages/index.json and these docs. Browser suites now use the bundled example story. Full QA green on Firefox 158 and Chromium. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-12 · Fix

### Quick
Bug review (#94 to #99). Three read-only code reviews, then four fuzzers (random editor clicks, random games played as real games, 13,500 damaged story files, 320 damaged saved...

### Details
- Three read-only code reviews, then four fuzzers (random editor clicks, random games played as real games, 13,500 damaged story files, 320 damaged saved game places) and a regression suite (bugs12). 23 fixes: game (dice memory, damaged Place codes and their lost message, the Aa panel's Esc and cut-off rows, Start over on stuck pages, Test from here), lost work (Save in flight, saved-or-not after a reload, spare copy before a story is replaced, full disk, closing when nothing is kept, damaged autosave notice, Extra large text), crashes and odd results (odd-shaped files, Undo with a dialog open, double delete, focus after leaving a box, resize closing menus, lost drag pointer, tour while typing, map key on resize) and speed (a dense 300-page map 26 to 56 s down to 0.4 s with identical drawings).
- Editor 536,247 bytes plain / 249,194 zipped; the standard 25-page game 48,219 bytes.

### Deep
Bug review (#94 to #99). Three read-only code reviews, then four fuzzers (random editor clicks, random games played as real games, 13,500 damaged story files, 320 damaged saved game places) and a regression suite (bugs12). 23 fixes: game (dice memory, damaged Place codes and their lost message, the Aa panel's Esc and cut-off rows, Start over on stuck pages, Test from here), lost work (Save in flight, saved-or-not after a reload, spare copy before a story is replaced, full disk, closing when nothing is kept, damaged autosave notice, Extra large text), crashes and odd results (odd-shaped files, Undo with a dialog open, double delete, focus after leaving a box, resize closing menus, lost drag pointer, tour while typing, map key on resize) and speed (a dense 300-page map 26 to 56 s down to 0.4 s with identical drawings). Reported but not changed: Place code fingerprint ignores choices; same story in two tabs; a few minor items (see BUG-REVIEW-2026.10.12.md). Full QA 43 of 43 on Firefox 158 and Chromium (one Chromium suite needed a retry once, then passed three times in a row); new suites bugs12, fuzz1, fuzz2 and fuzz3. Editor 536,247 bytes plain / 249,194 zipped; the standard 25-page game 48,219 bytes. **Tested in:** Firefox 158 and Chromium (version not recorded): full QA 43 of 43, as the row says.

## 2026-10-08 · Changed

### Quick
Checks rebuilt for Firefox 158 only (#65): quick about 1 minute, full about 3.5 minutes (was 14 to 30+).

### Deep
Checks rebuilt for Firefox 158 only (#65): quick about 1 minute, full about 3.5 minutes (was 14 to 30+). The slowest suite, top10-lite, runs its walk inside the page (14 minutes to 50 s). Chromium only in the full check; the scratch folder shrank from 177 MB to about 85 MB (the old Firefox 142, 267 MB, lived outside it and was deleted separately) and documented in qa/README.md. Firefox 142 dropped at the owner's request. **Tested in:** Firefox 158 (stock); Chromium only in the full check (version not recorded).

## 2026-10-08 · Changed

### Quick
Map scoring and counting (#67): the toolbar's quick score, layout scores kept per picture, short sorted list for nearest neighbours, visits counted by page number.

### Deep
Map scoring and counting (#67): the toolbar's quick score, layout scores kept per picture, short sorted list for nearest neighbours, visits counted by page number. First visit 511 to 430 ms (Chromium) and 797 to 527 ms (Firefox); later visits 165 to 72 ms and 280 to 70 to 100 ms. Identical output (qa/map-equiv.mjs, qa/count-equiv.mjs). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Fixed

### Quick
Text-matching rules audited (#66): the contract's name scan, the build's font-character check, the script-tag guard, and the test runner's failure lines (six flaws).

### Deep
Text-matching rules audited (#66): the contract's name scan, the build's font-character check, the script-tag guard, and the test runner's failure lines (six flaws). Fonts proved not byte-repeatable without SOURCE\_DATE\_EPOCH; the build now sets it. Budget numbers made repeatable (seeded random numbers and clock). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Added

### Quick
Zipped files (#68): the editor (Zopfli, 462 KB to 219 KB) and every exported game (the browser's compressor, about 28% smaller) unzip themselves when opened, with a built-in...

### Deep
Zipped files (#68): the editor (Zopfli, 462 KB to 219 KB) and every exported game (the browser's compressor, about 28% smaller) unzip themselves when opened, with a built-in unzipper for browsers without DecompressionStream. Opening costs about 30 ms (editor) and 3 to 11 ms (games). Editor ceiling 470,000 plain, 230,000 zipped. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Changed

### Quick
Simulated players (#69): per page, once, which choices lead anywhere, whether choices or paragraphs have conditions, and whether arriving changes anything; the game's rules are...

### Deep
Simulated players (#69): per page, once, which choices lead anywhere, whether choices or paragraphs have conditions, and whether arriving changes anything; the game's rules are skipped only when that is certain. Identical output on 1,002 simulations (qa/playtest-equiv.mjs); the proof itself checked by breaking each shortcut on purpose. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Changed

### Quick
Map first visit (#70): the 2,000 simulated players run only when something reads them (Compare table, an earlier flow view, odds/heat colors); mapGroups hands out its outcome...

### Deep
Map first visit (#70): the 2,000 simulated players run only when something reads them (Compare table, an earlier flow view, odds/heat colors); mapGroups hands out its outcome groups lazily and mapScore's quick call no longer asks. 300 pages: Firefox 158 797 to 253 ms, Chromium 511 to 245 ms. Same Compare scores on 12 stories (qa/compare-equiv.js). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Added

### Quick
Starter guide (STARTER-GUIDE.md and a Doc), starter kit zip (guide, qa kit, build tooling, sources), and this chart and changelog exported as OPTIMIZATION-CHART.md and...

### Deep
Starter guide (STARTER-GUIDE.md and a Doc), starter kit zip (guide, qa kit, build tooling, sources), and this chart and changelog exported as OPTIMIZATION-CHART.md and CHANGELOG.md. Doc brought up to date: status, open issues, test tooling (now the qa kit), this changelog. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Changed

### Quick
Dead numbers in the checker (#72): a number nothing ahead can read is reset so equal situations merge; applied automatically only when an unpruned run would pass 20,000...

### Details
- Editor ceilings raised to 490,000 plain and 240,000 zipped; build 480,651 / 226,418 bytes.

### Deep
Dead numbers in the checker (#72): a number nothing ahead can read is reset so equal situations merge; applied automatically only when an unpruned run would pass 20,000 situations. contract.mjs compares pruned and unpruned verdicts on 1,500 random stories (identical; 21 of 400 had fewer situations) and six deliberate breaks of the pruning are all caught. 5 numbers over 8 sections: 200,001 situations (truncated) to 441; 8 numbers: 200,002 to 705. Editor ceilings raised to 490,000 plain and 240,000 zipped; build 480,651 / 226,418 bytes. Full check 29 of 29 in Firefox 158 and Chromium (new suite tools8). **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Added

### Quick
Writing and report aids (#71, #73): Find and replace (Ctrl+Shift+F; plain text, Match case, Whole words, literal replacement, one Undo step); unfinished-page flag (display-only...

### Deep
Writing and report aids (#71, #73): Find and replace (Ctrl+Shift+F; plain text, Match case, Whole words, literal replacement, one Undo step); unfinished-page flag (display-only field, left out of exports, listed on the Check tab); "Why can't players reach this page?" (why(pid) in the checker) and the "Pages nobody reached" card; File, Save manuscript (.md). Quick guide and shortcuts list updated. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Changed

### Quick
Game tab (#74): Game options moved from the Options menu and the Copy game code window to a Game tab between Check and Play, shown only while the Game switch is on, with the...

### Deep
Game tab (#74): Game options moved from the Options menu and the Copy game code window to a Game tab between Check and Play, shown only while the Game switch is on, with the real game player as a live preview (hover, focus or arrow through the colors to try them; click or Enter to keep). Advanced box shows what each switch changed. Pushed to GitHub: the repo's index.html is now the zipped build and the Pages site serves it. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Changed

### Quick
Write tab upgrade (#75 to #85): one type-to-find page picker (also Ctrl+K), Go › / Write › buttons, ‹ › history and From chips, hide/show buttons for both side lists, page list...

### Details
- Measured against the previous build: new page from a choice 4 to 2 actions; give or take an item 2 to 1; moving a choice 5 clicks to 1 drag; about 6 screens of scrolling removed when pointing at or returning to a page deep in a 120-page story; writing area +58% with both lists hidden; choices 0.76 to 0.18 screens down at 1700 px.
- Editor 511,954 bytes plain / 238,691 zipped.

### Deep
Write tab upgrade (#75 to #85): one type-to-find page picker (also Ctrl+K), Go › / Write › buttons, ‹ › history and From chips, hide/show buttons for both side lists, page list Sort (Written / Story / A to Z), click and Shift+click on item chips, empty-page hint and Next to write, split page (Ctrl+Shift+Enter), paste a scene, drag grips, wide two-column layout, phone pinned bar, word count, smart quotes (off by default), text size, two-choice template. Measured against the previous build: new page from a choice 4 to 2 actions; give or take an item 2 to 1; moving a choice 5 clicks to 1 drag; about 6 screens of scrolling removed when pointing at or returning to a page deep in a 120-page story; writing area +58% with both lists hidden; choices 0.76 to 0.18 screens down at 1700 px. Full QA green on Firefox 158 and Chromium; new suites write1 and write2 and the effort.js counter. Editor 511,954 bytes plain / 238,691 zipped. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-08 · Feature

### Quick
New version stamp style: year.month.day.time in US Eastern, 24-hour (this build is 2026.10.08.2335).

### Deep
New version stamp style: year.month.day.time in US Eastern, 24-hour (this build is 2026.10.08.2335). It shows on the opening screen and at the top of the Quick guide, and is used for the dates in this changelog from now on. Older rows keep their old dates. Suite round3 checks the format. **Tested in:** not recorded for this build. Standing practice then: the quick tier on Firefox 158 and the full tier on Firefox 158 and then Chromium (Chromium version not recorded).

## 2026-10-07 · Research

### Quick
"Advanced Features Research" doc: about 50 ideas sorted by Advanced tab, a ranked top 10, a "skip or handle with care" list and sources (three research threads, about 7.6...

### Deep
"Advanced Features Research" doc: about 50 ideas sorted by Advanced tab, a ranked top 10, a "skip or handle with care" list and sources (three research threads, about 7.6 minutes, roughly 0.45M tokens). Nothing built. **Tested in:** no build was tested (chart, decision or research).

## 2026-10-07 · Decided

### Quick
Owner's answers on the research list: a fourth Advanced switch, "Game"; numbers and skill checks go under Items; images opt-in only, no audio.

### Deep
Owner's answers on the research list: a fourth Advanced switch, "Game"; numbers and skill checks go under Items; images opt-in only, no audio. The first 10 features are approved, with the checker extended alongside every one. **Tested in:** no build was tested (chart, decision or research).

## 2026-10-07 · Added

### Quick
This chart, and the measurement scripts in `scratchpad/dr/` (sizes, old against new exports and checker, bit mask against BigInt, start-up in two engines, map view switches,...

### Deep
This chart, and the measurement scripts in `scratchpad/dr/` (sizes, old against new exports and checker, bit mask against BigInt, start-up in two engines, map view switches, minify and font probes). **Tested in:** no build was tested (chart, decision or research).

## 2026-10-07 · Added

### Quick
Firefox 142.0.1 (Playwright build v1495) installed in a scratch folder

### Deep
Firefox 142.0.1 (Playwright build v1495) installed in a scratch folder; `ffsmoke.js` passes (five tabs, Options menu, no errors). Firefox joins every test run from now on. **Tested in:** the install check `ffsmoke.js` passed on Firefox 142.0.1.

## 2026-10-07 · Added

### Quick
New Chromium and Firefox suites (`top10-export.js`, `top10-player.js`, `top10-editor.js`, `top10-phone.js`) and `dr/bench-numbers.js`.

### Deep
New Chromium and Firefox suites (`top10-export.js`, `top10-player.js`, `top10-editor.js`, `top10-phone.js`) and `dr/bench-numbers.js`. Measurements for this round: sizes #39 and #40, start-up, checker cost with numbers (#29). **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Fixed

### Quick
Two class names clashed with older styles (`.keys`, `.swatch`) and were renamed.

### Deep
Two class names clashed with older styles (`.keys`, `.swatch`) and were renamed. The Quest starter first failed the checker's own rules (a locked sword nobody could reach; an unused item) and was redesigned. The structure detector mislabeled three starters until its rules were tightened (sorter needs forks of at most 30% of pages; hubs include the start page; key pages are those that at least half the endings pass through). **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Changed

### Quick
Game styles: colors now come from one generated table of presets (`PALETTES`) instead of fixed values; sizes in `em` so the Aa button scales everything; editor's own copy of...

### Deep
Game styles: colors now come from one generated table of presets (`PALETTES`) instead of fixed values; sizes in `em` so the Aa button scales everything; editor's own copy of the Play colors removed. Menus: Options gains Game options… while the Game switch is on; Advanced shows four switches. Quick guide has sections for numbers, dice checks, locked choices and what players see. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Changed

### Quick
Checker (`analyze`) understands numbers (bit fields), dice checks (win and lose edges), locked choices and number tests; new answers `samples`, `explain`, `canArrive`,...

### Deep
Checker (`analyze`) understands numbers (bit fields), dice checks (win and lose edges), locked choices and number tests; new answers `samples`, `explain`, `canArrive`, `analyzeStructure`; warnings for checks that can never fail or never pass, locks with no condition, thresholds that cannot be reached, and wide ranges. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Added

### Quick
Contract test

### Deep
**Contract test** (`contract.mjs`, `FIELD_CONTRACT`, `KL_RULES`) inside the build: the checker must agree with a brute-force play of the real game functions on 400 random stories, every story field must be classified and handled by the checker and export, and every color preset must reach 4.5:1 contrast. A failure stops the build. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Added

### Quick
The first 10 features

### Details
- Test from here; ending explorer; story shape detector, 6 starting stories (File → New story) and pacing card.
- A fourth Advanced switch, Game, holds the reader options (also Options → Game options… and the export window).

### Deep
**The first 10 features** (started 5:08 PM, built by 6:20 PM): Numbers with bars and "Only if ≥ n"; dice skill checks (2 dice + number vs target) with fail-forward and shown odds; locked choices with a reason; Back with history and an author option for rolls; "endings found" tracker; reader comfort button Aa; color presets; Test from here; ending explorer; story shape detector, 6 starting stories (File → New story) and pacing card. A fourth Advanced switch, Game, holds the reader options (also Options → Game options… and the export window). **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Added

### Quick
New suite `top10-lite.js`, run in Chromium (18 stories, 1,057 screens) and Firefox 142 (19 stories, 1,087 screens): lite and full games always show the same screens; a wrong...

### Deep
New suite `top10-lite.js`, run in Chromium (18 stories, 1,057 screens) and Firefox 142 (19 stories, 1,087 screens): lite and full games always show the same screens; a wrong lite game is caught. The three `top10-*` suites and `ffsmoke.js` pass in Firefox, and the three `top10-*` suites, `real.js`, `opts.js`, `last.js` (threshold lowered because the small typeface saves less) `fix2.js`, `dlg.js` and `inter.js` pass in Chromium. Start-up measured again: no change. **Tested in:** Chromium and Firefox 142, as the row says (Chromium version not recorded).

## 2026-10-07 · Changed

### Quick
Shipped editor shrunk

### Deep
**Shipped editor shrunk** (`minify.mjs`: comments and spacing in the script and styles; `STORY_READABLE=1` to skip). 597,076 → 434,354 bytes. The quick guide's game sizes now read about 44 KB (25-page story) and about 27 KB with the system font. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Added

### Quick
Smaller typeface

### Deep
**Smaller typeface** (`InterTight-ascii.woff2`, 12,928 bytes) for games whose story and title use only plain English characters; `KL_LITE_FONT` lists them and `build.py` checks the list against the font. The font-switch text now says "about 17 KB smaller". **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Changed

### Quick
Lite export is the default for every save

### Deep
**Lite export is the default for every save** (owner, 6:39 PM): the player is a core plus seven feature modules (`klFeatAsk`, `Back`, `Dice`, `Locks`, `Bars`, `Tracker`, `Comfort`) and `game.css` has matching `@part` sections; `klFeatures()` picks what a story needs; only the chosen color preset is carried. The Play tab in the editor still has everything. Contract test section 6 and `top10-lite.js` guard it. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Changed

### Quick
Evening round, 8:10 PM to about 9:10 PM (build 8:33 PM)

### Details
- Sizes: editor 434,354 → 452,560 bytes;
- Story A 43,912 → 42,928;
- Story B 38,704 → 38,007;
- Keepers 57,027 → 55,644.

### Deep
**Evening round, 8:10 PM to about 9:10 PM (build 8:33 PM)**: grouped numbers in the checker (#47: Quest 28 → 23 situations, 3 numbers 6,165 → 4,624); map zoom by CSS transform (#49); shorter ids in exported games (#50); old vendor prefixes dropped (#52); two-at-a-time test runner (#53). Sizes: editor 434,354 → 452,560 bytes; Story A 43,912 → 42,928; Story B 38,704 → 38,007; Keepers 57,027 → 55,644. Tests, Chromium and Firefox 142: top10-export 24, top10-player 20, top10-editor 18 pass in both; top5-new 40 pass in both; top10-lite Chromium 19 stories / 1,087 screens identical (negative control differs), Firefox 19 stories / 1,087 screens identical (negative control differed as required, 872 s); real.js 47, opts.js 18, last.js 3, fix2.js 8, dlg.js 8, inter.js 22 pass in Chromium; ffsmoke.js passes in Firefox. Contract test in the build: 400 random stories, numbers grouped in 184. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Added

### Quick
Speed report (#48)

### Deep
**Speed report (#48)**: Options → Speed report… or #report on the address (ui4-speed.js). Always-on timings of tab switches, checker runs and map zoom steps; a frame recorder with an "It stuttered!" bar; Copy report gives plain text. Holds no story words; nothing is sent. New suite top5-new.js (40 checks) passes in Chromium and Firefox 142. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · Added

### Quick
Place code and fingerprinted saves (#51)

### Deep
**Place code and fingerprinted saves (#51)**: a game saves its place under a fingerprint of the story's shape (a story with pages added or removed starts fresh; a typo fix keeps the place), and the endings-found list uses it too. The optional Place code panel (a game option, off by default) copies and replays a code with the game's own rules. **Tested in:** Firefox 142.0.1 (Playwright build v1495) and Chromium (version not recorded), as the other 2026-10-07 rows state; not recorded per build.

## 2026-10-07 · to 08

### Quick
Night round, programming lessons 1 to 7 and 10 (#55 to #64): one table for game options, checked saves with a spare copy, error log in the Speed report, size budgets that stop...

### Deep
Night round, programming lessons 1 to 7 and 10 (#55 to #64): one table for game options, checked saves with a spare copy, error log in the Speed report, size budgets that stop the build, a calculated opening brush stroke, text boxes sized in one batch, test tiers and condition waits. Editor 452,560 to 456,875 bytes. **Tested in:** not recorded for this build. The rows around it record Firefox 142.0.1 and Chromium for 2026-10-07 and Firefox 158 from row #65 on.

## 2026-10-05 · Changed

### Quick
American English pass over code, guide, tooltips and README (color, gray, center, neighbor, canceled, check instead of tick).

### Deep
American English pass over code, guide, tooltips and README (color, gray, center, neighbor, canceled, check instead of tick). Build 470 KB, then 473 KB. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-05 · Fixed

### Quick
Options menu ran 3 px past the right edge at 390 px width; it now pins to the screen edge.

### Deep
Options menu ran 3 px past the right edge at 390 px width; it now pins to the screen edge. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-05 · Added

### Quick
Options menu (⚙) after Save: guide, shortcuts, light or dark, system font for exports and for the editor, Remember preferences, and Advanced… with Write, Map and Items switches...

### Deep
Options menu (⚙) after Save: guide, shortcuts, light or dark, system font for exports and for the editor, Remember preferences, and Advanced… with Write, Map and Items switches (always saved). With all off the editor is simpler: no per-choice give or take button, no Givens or "Shown as", Map limited to Flow, Top-down tree and Matrix. Map on adds the "As:" selects and a "Playtest results" pill. Hands over hidden for now, with a note under Good to know. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-05 · Fixed

### Quick
Android: drop-down lists now follow the dark editor (`appearance: base-select`, Chrome 135+, phones and tablets only).

### Deep
Android: drop-down lists now follow the dark editor (`appearance: base-select`, Chrome 135+, phones and tablets only). Page warnings fold into one line ("⚠ 7 things to look at"); problems stay visible. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-05 · Changed

### Quick
Menus shortened: File is Save, Save as…, Open…, Import old format…, New story, Example story, Copy game code…

### Deep
Menus shortened: File is Save, Save as…, Open…, Import old format…, New story, Example story, Copy game code…; Options is Quick guide, Keyboard shortcuts, Light / dark, Use system font - Export, Use system font - Editor, Remember preferences, Advanced…. Longer explanations moved into tooltips. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-05 · Changed

### Quick
Example story: the first page no longer takes seven items away (nothing leads back to it, so they did nothing and caused the warnings).

### Deep
Example story: the first page no longer takes seven items away (nothing leads back to it, so they did nothing and caused the warnings). Check tab: no problems, 8 of 8 endings, 649 situations. Browser minimums worked out (see Project constraints). **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-04 · Research

### Quick
Font study (40 fonts), code audit (7 confirmed bugs, checker gaps, export size breakdown) and an independent review; backup of the sources saved as `editor-backup-2146/`.

### Deep
Font study (40 fonts), code audit (7 confirmed bugs, checker gaps, export size breakdown) and an independent review; backup of the sources saved as `editor-backup-2146/`. **Tested in:** no build was tested (chart, decision or research).

## 2026-10-04 · Fixed

### Quick
Save could overwrite the wrong file after Undo or after importing an old story; an exported game could go blank after a re-export without Givens; one failed write blocked Export

### Deep
Save could overwrite the wrong file after Undo or after importing an old story; an exported game could go blank after a re-export without Givens; one failed write blocked Export; Esc on dialogs did not settle prompts or return focus; File menu keyboard use. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-04 · Changed

### Quick
Map rebuilt: slim toolbar, eight views (Flow, Top-down tree, Choke-point spine, Given lanes, Story shape, an earlier flow view, Arc, Matrix), neighbor highlight, auto-folding...

### Deep
Map rebuilt: slim toolbar, eight views (Flow, Top-down tree, Choke-point spine, Given lanes, Story shape, an earlier flow view, Arc, Matrix), neighbor highlight, auto-folding runs, Compare views scores, layout cache. Dialogs became native `<dialog>`; custom tooltips; code modernized to ES2020 and formatted with Prettier. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-04 · Changed

### Quick
Checker rewritten: bit masks with BigInt above 30 tracked items, trap loops, duplicate choices, orphan pages, honest "not checked", Good to know list, 200,000-situation limit,...

### Deep
Checker rewritten: bit masks with BigInt above 30 tracked items, trap loops, duplicate choices, orphan pages, honest "not checked", Good to know list, 200,000-situation limit, `EDGE_CAP`. Fuzz test 400 stories, 0 mismatches. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-04 · Changed

### Quick
Exported games smaller: minified game code and styles at build time, trimmed story data, Inter Tight.

### Deep
Exported games smaller: minified game code and styles at build time, trimmed story data, Inter Tight. Story A 66,630 → 47,502 bytes at the time. **Tested in:** not recorded for this build. (Before browser versions were written down.)

## 2026-10-04 · Added

### Quick
An earlier flow view made interactive (follow a band, trace a page, side panel)

### Deep
an earlier flow view made interactive (follow a band, trace a page, side panel); Story shape reworked with a legend; Merge on by default; Fisheye disabled and the Fold switch removed (runs fold on their own); per-story system font; gift-and-heart icon for give or take; Gets, Loses and Hands over on the page-type line; icons in the Quick guide. **Tested in:** not recorded for this build. (Before browser versions were written down.)
