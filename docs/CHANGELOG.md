# What's new in the Story Editor

Newest first, one plain line for each change you will notice. Dates are 2026 (month-day). The full technical log, with sizes and the exact browsers each release was tested in, is kept by the maintainers.

Releases since October 17 are tested in Firefox, Chromium, WebKitGTK and GNOME Web.

## October 31
- Memory: while you type in a big story, the editor no longer keeps Map drawings it prepared in the background for older versions of the story, which were never shown. In a 2,040-page story that is about 16 MB less (61 to 45 MB in Chrome after a few typing pauses). Drawings you have seen are still kept, so Undo brings back the same picture.
- Checker: a story too big for the quick check (over 200,000 situations) is now checked fully in the background, up to 5 million. The status line says "Checking further" until the full answer arrives, usually within a second, and any edit starts it again. In test stories the full check found 8 to 16 more problems.
- Writing notes: after each pause in typing, the notes for a big story are worked out in about 0.6 to 0.75 times the time (2,040 pages: Chrome 2.7 to 1.9 ms, Firefox 4 to 3, Safari-style browsers 7 to 4), and the editor keeps about 1 MB less in memory. The notes are exactly the same.
- Story Page Map: for big stories, the Map views prepared in the background no longer make the screen stutter as they arrive. Each one now holds up the page about half as long (in a 2,040-page story about 0.4 times as long in Chrome, 0.55 in Firefox, 0.47 in Safari-style browsers). The drawings are exactly the same.
- Safer autosave: each autosave is now also kept in a second, sturdier store in your browser. Chrome writes its usual autosave to disk only about once a minute, so a crash could lose the last minute of typing; now, if the browser closes before it finished storing your newest changes, the editor brings them back the next time it opens and tells you, and Undo shows the older copy.
- Opening a big story: the start freezes much less. With a 2,040-page story the freezes at start take about 0.3 times as long as before in Chrome, 0.6 times in Firefox and 0.8 times in Safari-style browsers, and typing a page's name costs 2 to 4 ms per key instead of 27 to 48. The editor's letters no longer flicker from a stand-in font as it opens. Nothing else you see changes.
- The Safety window's "Space" line now shows how much of the browser's 5 MB autosave room is used, and that this room is shared with other pages from the same place. It used to show a much larger number that was not the autosave's room.
- Typing in big stories: the editor does 17 to 30% less work per keystroke in a 316-page story, typing in a 2,040-page story reaches the screen about 30% sooner in Chrome (median 26 to 18 ms), and the pause after typing no longer freezes it for 170 to 235 ms (now about 60 ms). Undo keeps only what changed between steps, so 80 edits hold about 6 MB instead of 22 MB. Everything you see and save is exactly the same.
- Checker memory: after a big story, the checker gives back memory it no longer needs, in the page and in its background helper (in Chrome about 7 MB less with the 34-page example open). Answers are the same.
- Checker: big stories with numbers are checked up to a fifth faster after each edit; the answers are exactly the same.
- Story Page Map: for big stories the other Map views are now prepared in the background too, so switching views no longer freezes the screen (in Chrome about 50 to 24 ms).
- Story Page Map: building the Map's graph does less work, so layouts are about 5 to 15% faster in Chrome and Safari-style browsers (Firefox about the same). The drawings are exactly the same.
- The landing page and README explain what the editor is, how it works and why it exists in a few short lines, with a list of what people use it for.
- Story Page Map: the Map's layout is faster again, about 15 to 30% for a 316-page story and up to half the time for small ones. The drawings are exactly the same, and a new test checks 360 drawings against the old ones on every change.
- Story Page Map: the Map's layout does less work (page importance is found in one pass instead of a search for every page, and repeated passes are skipped), so a 316-page story is laid out about 15 to 20% faster and small ones up to 30%. The drawings are exactly the same.
- A developer changelog (`docs/CHANGELOG-DEV.md`) now lists every change since October 4 in three depths, Quick, Details and Deep. This page stays the short plain list.
- Landing page and README: the checker numbers are measured again (the real 34-page example is checked in 0.7 ms after an edit in all three browsers, the 316-page test story in about 7 ms) and a 100-page row is added.
- Typing: the totals line at the top is no longer rebuilt on a keystroke that changes none of its numbers, and word counts are remembered per paragraph (about 0.5 ms less work per keystroke).
- Checker: stories of about 100 pages are checked about 30% faster (45 ms to 30 ms) because the "can a player come back for it" pass now goes through the move graph once instead of repeating. Answers are identical.
- Checker: the real 34-page example is checked about twice as fast after an edit, because the checker remembers each paragraph's word count, quote marks and sentences until that paragraph changes. Answers are identical.

## October 30
- Checker: small stories are checked up to 6 times faster (a 5-page story 0.4 ms to 0.07 ms, the 34-page example about 20% faster) because the checker no longer clears a table sized for 200,000 situations on every check. Answers are identical.
- The landing page is now the front door at https://lfcfoundry.github.io/story-editor/ and the editor moved to https://lfcfoundry.github.io/story-editor/play/. Bookmarks to the old editor address now show the landing page, which has an Open the editor button.
- Map: on medium windows (about 1000 px wide) the toolbar now stays on one row, using short names (Good, Bad, Playtest, Compare). Hover for the full name.
- Checker: a quiet note (not a problem) when a page says the same sentence more than once. Pairs that can never show together, like a paragraph and its "otherwise", are left alone. You can ignore it.

## October 29
- Landing page and README: a "Why it is this fast" section below the measures table says in one paragraph that the speed comes from deliberate work so the engine can scale as games get bigger and more sophisticated.
- Landing page: the logo (heart, icons and the red Story Editor name) now sits in the header below the badges on the same left edge as the title, the way the Apple Press page places its logo, instead of in a band under the header.
- New landing page, now the front page of the site (https://lfcfoundry.github.io/story-editor/): what the editor is, why it exists and the packages you can reuse, in the same look as the other LFC Foundry projects. The README now opens with the same summary and links to it. It now has measured numbers for the checker, the Map, start-up and file sizes in the three test browsers, plain descriptions of objects and states, the advanced features and what the checker covers, and links to two playable example stories (`examples/`: The Keeper's Light and The Drowned Archive, with The Keeper's Light as a .story.json to open in the editor). The hero shows the editor's logo (a heart holding a flag, a smile, a frown and a gift) that draws itself in, and sits still for anyone who has reduced motion turned on. The "Why it exists" section now sits right under "What it is", above the feature boxes. The example section gives each story a made-up illustration, its premise, a typical playthrough length (estimated from the checker's shortest routes), desktop and phone screenshots, and a picture of the Story Page Map in action. In the checker chart, a bar too short to hold its number now shows the number just outside the bar's end, and bars are drawn to true proportion. The first highlight box is now compatibility (Twine imports, devices). The logo sits in its own band right above "What it is", and the title in the header stays text. The band shows the full logo: the animated heart and icons with the red "Story Editor" name beside it, as in the editor's own top bar. The Drowned Archive no longer repeats sentences: the old generator could pick the same line twice for one page and reused one line down a whole corridor, so each room now has five lines and the corridors use fresh wording; a new test (`tools/example-prose.mjs`, part of `npm test`) fails if the examples (The Keeper's Light and the built-in Massive example) repeat a sentence on a page or between neighboring pages. The generated 316-page story is now called The Massive Test Story (menu: Massive example, a generated test story) and its speed numbers stay, described as a generated 316-page test story. The Drowned Archive is now a real hand-written story of 51 pages and 8 endings (`tools/archive-story.mjs` writes `examples/the-drowned-archive.story.json`; the game is `examples/the-drowned-archive.html`): a question before page one, two numbers (Tide and Nerve), a dice check, locked choices with reasons, text that changes with what you carry, and the checker finishes it with no problems, warnings or notes (150,541 situations). The highlights now lead with compatibility, then no ads, no accounts and no network, one file that runs almost anywhere, and open source with the quick tour; the one-file box also says nothing to install, no administrator rights and no special computing knowledge needed; the page and README say Story Page Map for the feature (the editor and games keep the short label Map); the same rename is made in the design and format documents under `docs/`. The editor itself is unchanged apart from the built-in Massive example text. The twine-import package is rebuilt as 1.0.1 so it carries the nesting limit added on October 25.

## October 25
- Twine import now refuses a story whose code nests more than 300 levels deep with the same plain message as before ("nested so deeply that it cannot be read"), at once; it used to stop only when the engine ran out of stack, which took anywhere from 40 ms to 8 seconds. Stories nested under 300 levels read exactly as before. Steadier checks: the Map picture check waits for two identical pictures, the Twine check reports damaged-file failures apart from story differences.
- Long menus (the ⋯ menu and File on a phone, any menu on a short window) now scroll and stop above the bottom bars, so every entry can be reached; before, the bottom of the list sat under the page bar and the tab bar. A soft fade and a small ▾ arrow at the bottom of a long menu show that more entries (such as Advanced…) wait below; it goes away at the end of the list.
- Writing text size is now four buttons (Small, Medium, Large, Extra large) in the Options menu, one tap each, and the menu stays open so you can watch the boxes change. It used to cycle one size per click.
- Two examples in the File menu: "The Keeper's Light" (34 pages, the small one) and "The Drowned Archive" (over 300 pages in twelve rooms, with keys, locked doors, side pages, good and bad endings), to see how the checker and the Map handle a big story. It is built when you pick it, so it adds almost nothing to the file.

## October 24
- In the Check report, a passage the checker proves can never be reached now has a "Why?" button that opens the explanation (which choice would lead there and what is missing). The story-check package is now version 1.1.0.
- On a phone turned sideways, the editor now uses the phone layout with the six tabs in a rail down the left edge and a slimmer top bar, so the page gets the full height: on a 844 x 390 screen the Write tab shows about 3 lines of text where it showed 1 (it used the computer layout with a three-row header before).
- On big screens (2200 px wide or more, such as a QHD or 4K monitor at 100%), the text and controls are drawn 25% larger and the side lists are a little wider. Smaller screens are unchanged.
- The hidden radio buttons of the page-type and item-type controls no longer make the whole page scroll on short screens.
- On a phone, the Play tab's note ("This is exactly how your exported game behaves...") now sits below the story instead of above it, so the story starts about 62 px higher and the second choice shows on the first screen. Computers are unchanged.
- On a phone, the "Page type and effects" button now sits at the end of the icon row instead of on a row of its own, so the page's text starts about 52 px higher (about one more line on screen). It still opens the same bottom sheet.
- The test runner can pick up after a machine restart: `qa.js full --resume` skips the suite-and-browser cells that already passed on the same sources, and `qa.js --status` shows how far a run got and whether the machine restarted. Nothing changes for the editor.
- On a big story (a check that takes more than 8 ms), the check after an edit now runs in a background worker, so typing is not interrupted: the longest pause after an edit in a 300-page stress story went from 51 to 25 ms in Chromium, 37 to 19 ms in Firefox and 40 to 32 ms in WebKitGTK. The status line says "Checking" for a moment before the answer. Everything else checks on the page as before (the Check and Map tabs, small stories, and browsers without workers).
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
