# What's new in the Story Editor

Newest first, one plain line for each change you will notice. Dates are 2026 (month-day). The full technical log, with sizes and the exact browsers each release was tested in, is kept by the maintainers.

Releases since October 17 are tested in Firefox, Chromium, WebKitGTK and GNOME Web.

## October 24
- README: the keyboard actions (Ctrl+K, then `>`) and the phone changes are described, and the test browsers read Firefox, Chromium and WebKitGTK (GNOME Web was dropped from testing).
- On a phone, "Page type and effects" now opens as a sheet that slides up from the bottom (Done, a tap outside, or a pull down on the handle puts it away), so the page text no longer jumps down when you open it, and the Gets and Loses boxes get the full width. The one-line summary above the text is unchanged.
- On a phone, the Items tab's explanation paragraph is folded behind "What are objects, states and numbers?", so the list starts about 95 px higher (about one more item on screen). One tap opens it; on a computer it stays open as before.
- The Map's key now stays shown or hidden the way you left it, even after you reload or come back later. Before, it opened on top of the Start page every time on a laptop.

## October 23
- Ctrl+K (or Go to…) now also runs actions: type part of an action's name (map, export, undo, new page) or type > to see them all, then Enter. Page names work exactly as before, and with nothing typed the list is the same pages as before.
- On a phone, the Map's toolbar is now one row of layout buttons plus a More button (colors, search and playtest results sit behind it), and the zoom buttons float over the map. The map area is about 25% taller (552 to 690 px on a 390 x 844 screen). The map itself draws exactly as before.

## October 22
- Nothing changes in the editor you use; the maintainers' own checks got steadier and shorter (one flaky check in Chromium fixed, routine runs play half-size random-input tests).
- Opening the Map of a big story does less work: boxes and arrows are re-styled (search, highlight, paths) only when something about them changed, instead of rewriting every one after each drawn piece. For 300 pages after an edit, the screen freezes for about 44 instead of 62 ms in Firefox and opening takes about 39 instead of 57 ms there; Chromium, WebKit and GNOME Web are about the same or a little better.
- The Map's first screenful of a big story is now drawn in small pieces of about 4 ms instead of one stretch of up to 14 ms, so the page stays responsive while the Map opens. For 300 pages after an edit, the screen freezes for about 54 ms instead of 61 in Chromium, about 68 instead of 85 in Firefox, and opening takes about 205 ms instead of 310 in WebKit (GNOME Web: about the same, 220 vs 233). The picture is unchanged.
- The Speed report now runs on the shared field-report module: five quick taps in the top-left corner open two hidden buttons (Save speed report, Save error log) on any screen, and every error the page raises is kept for the log. Frames are counted only after you press Record frames, because an always-running frame counter made the Map take about 4 times longer to show its first two frames in Firefox (about 26 ms vs 110 ms in our test); with it off, start-up and Map open are the same as before in all four browsers. The page is about 4.8 KB larger.
- The Map opens a little sooner still for big stories: the background worker now also counts the crossings shown in the toolbar chip. For 300 pages, the part of opening the Map that freezes the screen takes about 28 ms instead of 36 in Firefox, 42 instead of 60 in Chromium, 75 instead of 86 in WebKitGTK and 98 instead of 107 in GNOME Web. The Map looks exactly the same.
- The Map opens sooner for big stories (60 pages or more): its layout is now worked out in the background a moment after you stop editing, so it is ready when you open the Map. For 300 pages, opening the Map after an edit takes about 75 ms instead of 101 in Firefox, 74 instead of 121 in Chromium, 280 instead of 328 in WebKitGTK and 257 instead of 370 in GNOME Web. The Map looks exactly the same, and a browser that does not allow background work builds it as before.
- The Map opens faster for big stories: from 120 pages up, only the boxes and arrows you can see (and a little around them) are drawn first, and the rest come in as you scroll or zoom. For 300 pages after an edit it opens in 100 ms instead of 186 in Firefox and 149 instead of 231 in Chromium; WebKitGTK and GNOME Web stay about the same. Smaller stories are drawn exactly as before, and a big Map looks the same (99.6 to 100% identical pictures). Search, the arrow counts, the key and Tab order cover the whole Map.
- The Map's crossing count (the number in the toolbar) is worked out in WebAssembly, with exactly the same answer (8 ms instead of 28 in Chromium, 14 instead of 33 in Firefox at 300 pages). A browser that will not run WebAssembly counts the old way.

## October 19
- New: the Speed report (Options → Speed report…) has a **Save as file** button, so a session on your phone or laptop can be kept as a small text file with the timings, device details and recent errors (never your story's words).
- The editor's first screen appears 17 to 27% sooner (Firefox 98 to 76 ms, Chromium 104 to 83, WebKitGTK 189 to 157, GNOME Web 333 to 242): the first check of your story now runs just after the screen is drawn, and the status line says "Checking" for those few milliseconds.
- The Map opens faster after you change a story: finding the pages every route must pass through now takes 2 to 3 ms instead of 8 to 27 ms at 300 pages (1 ms instead of 2 to 3 ms at 100 pages). The Map looks exactly the same.

## October 18
- Checking a story with more than 30 items and states is 12 to 44 times faster: a story that reaches the check's 200,000-situation limit now finishes in 25 to 72 ms instead of 0.5 to 1.8 seconds (up to 64 items and number groups; more than that checks the old way). A browser without WebAssembly checks the old way. The editor file is about 6 KB bigger, and its size limits were raised.
- Checking a big story that keeps its moves is up to 2.6 times faster again: the "can a player get stuck or miss a choice for good" part now runs in WebAssembly too. A 75,000-situation story takes 40 to 62 ms instead of 77 to 119 ms. Small stories and stories at the 200,000-situation limit are unchanged. A browser without WebAssembly checks the old way. The editor file is about 2 KB bigger.
- Checking a very big story is up to 15 times faster: stories that hit the check's 200,000-situation limit now finish in about 35 ms instead of 300 to 525 ms (and a 75,000-situation story takes about 80 to 120 ms instead of 235 to 315 ms). Small stories are unchanged. A browser without WebAssembly checks the old way. The editor file is about 6 KB bigger.
- The editor opens a little sooner: unpacking it is 12 to 48 ms quicker (48 ms in Chromium, 27 in Firefox, 21 in WebKitGTK, 12 in GNOME Web). A browser that will not run WebAssembly still opens it the old way. The editor file is about 6 KB bigger (270,967 to 276,707 bytes).

## October 17
- Fixed: the "Changed in another window" warning now appears whenever another window or copy has saved the story, so a forgotten tab can no longer quietly overwrite newer work.

## October 16
- The editor now lives at https://lfcfoundry.github.io/story-editor/.
- Fixed: the example in File → Paste an outline… no longer makes an empty page named "Cold night (bad ending)".

## October 14
- New phone layout: tabs along the bottom, one slim top bar, and a typing mode that leaves just one row above the keyboard. Swipe the page bar to move to the next or previous page.
- On a narrow computer window the logo moves to the bottom bar and the story counts stay on a slim line under the top bar.
- New: File → Paste an outline… turns an indented outline into pages and choices.
- New: writing notes on the Check tab for a word typed twice, an overused word, a name that may be a typo, near-identical choices and very long paragraphs.
- Undo and Redo now say what they will do, and a History list goes back to any of the last 20 steps.
- The Check tab shows when the story was last saved and has a Next problem button.
- New: File → Import Twine… brings in Twine 2, Twee 3 and Twine 1 stories, keeping their rules where it can and listing what it could not carry over.
- New: pinned routes. Pin a route you played, replay it after you edit, and see the first step that no longer works.
- New: seven page colors and a private note for each page.
- New: File → Translations… for up to 12 languages, filled in through a spreadsheet file. Games get a language menu, and right-to-left languages are supported.
- Games follow the phone's text size.
- New: Options → Safety shows how your story is saved and reminds you after 7 days without a file save.
- New: File → Save test script (.md) makes a checklist of routes that together take every choice.
- The ending recap shows "Roads not taken".
- A choice you already took in a game gets a check mark.
- In a game, the phone's back swipe goes back a page, and High contrast turns on if your device asks for it.
- A second window or copy of the editor is paused with a "Use this window instead" box, so two windows cannot overwrite each other.
- Fixed: the Aa text panel no longer runs off the left edge of a small screen.
- The editor file is about 2.5% smaller.

## October 12
- First open-source release (MIT License).
- The editor file is 10% smaller (249,190 to 224,251 bytes) and checks itself when it opens.
- Games now tell you when the browser will not keep their save, instead of silently losing your place.
- 23 bug fixes covering lost work, crashes and odd results. A dense 300-page map now draws in 0.4 seconds instead of 26 to 56.

## October 8
- The version number is now a date and time (for example 2026.10.08.2335) and shows on the opening screen.
- Write tab: a type-to-find page picker (Ctrl+K), back and forward through pages you visited, hide or show either side list, sort the page list, split a page, paste a scene, and a word count. Creating a new page from a choice takes 2 clicks instead of 4.
- New Game tab with a live preview of the colors and options before you export.
- New: Find and replace (Ctrl+Shift+F), an unfinished-page flag, File → Save manuscript (.md), and a "Why can't players reach this page?" explanation.
- Big stories check much faster; for example 200,001 situations to 441.
- The map opens faster: 797 to 253 ms in Firefox and 511 to 245 ms in Chromium for a 300-page story.
- The editor and the games unzip themselves when opened, which makes the editor 53% smaller (462 KB to 219 KB) and each game about 28% smaller.

## October 7
- The first ten features: numbers with bars, dice skill checks, locked choices with a reason, Back, an endings-found tracker, a reader text button (Aa), color presets, Test from here, an ending explorer and six starting stories.
- Games are smaller: only the features a story uses are included, and a smaller font is used for plain English stories. The editor shrank from 597,076 to 434,354 bytes.
- New: Options → Speed report… shows how fast the editor runs, with nothing sent anywhere.
- A game saves your place so that adding or removing pages starts fresh while a typo fix keeps your place. An optional Place code lets a reader copy and restore their place.

## October 5
- New Options menu (the gear) for the guide, shortcuts, light or dark, fonts, remembered preferences and the Advanced switches. The File menu is shorter.
- On Android, drop-down lists follow the dark editor.
- The example story no longer starts with warnings.

## October 4
- A new map with eight views: Flow, Top-down tree, Choke-point spine, Given lanes, Story shape, River, Arc and Matrix.
- A faster, more careful checker that explains what it did not check. Exported games shrank (Story A 66,630 to 47,502 bytes).
- Fixed: Save could overwrite the wrong file after Undo, an exported game could go blank after a re-export, and one failed write could block Export.
