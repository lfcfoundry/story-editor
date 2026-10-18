# What's new in the Story Editor

Newest first, one plain line for each change you will notice. Dates are 2026 (month-day). The full technical log, with sizes and the exact browsers each release was tested in, is kept by the maintainers.

Releases since October 17 are tested in Firefox, Chromium, WebKitGTK and GNOME Web.

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
