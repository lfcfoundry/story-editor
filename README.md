# Story Editor

A single-file, offline editor for interactive "choose your own path" stories. You add pages and choices in your browser, the editor checks that every page and ending can really be reached, shows your story as a map, and turns each story into one small game file that anyone can play in a browser, online or offline. This is a beta.

**How it does it:** the whole editor is one HTML file (stored compressed inside a tiny page that unpacks itself) that runs entirely in your browser. Your story is kept in your browser's own storage as you type and nothing is sent anywhere. The checker is plain JavaScript that tries every combination of items, numbers and dice a player could be in, and **Export** builds the game page from your story and zips it.

**Open the editor:** https://lfcfoundry.github.io/story-editor/
(or download `index.html` from this page and double-click it; nothing needs installing).

## Why it exists

Writing a branching story is easy; knowing that it works is hard. A choice can lead nowhere, an ending can need a key nobody can pick up, a dice check can make a page impossible to reach, and a plain text file warns you about none of it. The Story Editor exists so that someone who does not program can write such a story, be told in plain words what is wrong with it, and hand the result to a reader as one small file with no server, account or install. How it differs from Twine, Ink, Yarn Spinner and ChoiceScript, with sources, is in [docs/FORMAT-COMPARISON.md](docs/FORMAT-COMPARISON.md). Its pieces are also cut out as small packages (next section) so people and AI helpers can read, check and play the same stories from code.

## Code you can reuse

Everything is MIT-licensed and has no dependencies. The editor's logic was cut out into small packages, **generated from the editor's own sources** (so there is one copy to maintain, and a test fails if they drift apart). Each folder has a README (what it does, how it differs from what already exists, its limits), an `AGENTS.md` for AI helpers, TypeScript types, an example you can run, and tests that require **identical answers to the editor** on hundreds of random stories.

| Package | One line |
|---|---|
| [story-format](packages/story-format/README.md) | The data model for branching stories as plain JSON, with a JSON Schema, a safe sanitizer for any input, a plain-text story syntax, find/replace, Markdown manuscript. |
| [twine-import](packages/twine-import/README.md) | Reads Twine stories (Twine 2 HTML, Twee 3, Twine 1) and turns SugarCube and Harlowe code into rules, with a plain-words report of what it could not carry over. |
| [story-outline](packages/story-outline/README.md) | Turns an indented outline (page names, choices indented under them) into pages and choices, or into a whole story. |
| [story-diff](packages/story-diff/README.md) | Says in plain words what one edit did to a story: "Add page “The Cellar”", "Delete a choice on “Start”". |
| [story-check](packages/story-check/README.md) | An exact checker: explores every combination of items, numbers and dice to find dead ends and endings no player can reach, and says why. |
| [story-player](packages/story-player/README.md) | One story in, one small offline HTML game out; plus a "play it from code" session and a terminal player. |
| [story-map](packages/story-map/README.md) | Layered, arc, matrix and shape drawings of a story graph, choke points, simulated players, drawing metrics, SVG output. |
| [zip-page](packages/zip-page/README.md) | Shrinks one HTML page into a self-unzipping page, with a small readable inflater as fallback. |
| [qa-kit](packages/qa-kit/README.md) | A tiered test runner and a Playwright-style call surface over Puppeteer's WebDriver BiDi, so suites also run on stock Firefox; a seeded random-story generator. |
| [contract-kit](packages/contract-kit/README.md) | A guide, with a small helper, for keeping two implementations of one rule set from drifting apart (a fast checker and a slow reference, an editor and its exported game): random inputs, side-by-side comparison, a field table, a time limit. |
| [ai-collab-kit](packages/ai-collab-kit/README.md) | A written process for a person and an AI assistant building software together: ten habits, test and speed recipes, pitfalls, templates. |
| [editor/](editor/README.md) | The full editor sources, its build, and its browser test suites ([editor/qa](editor/qa/README.md)). |

Only pieces that are not already well covered by open source were split out; each README names the closest existing projects and says honestly how this one differs. Small pieces for browser games (curtains, saves, frame pacing and more) live in the sibling repository [JS-modules](https://github.com/lfcfoundry/JS-modules).

## Build and test from source

```
npm install                 # esbuild and prettier, for the package build
npm run build               # regenerate packages/*/src/generated.js and dist/ from editor/*.js
npm test                    # packages up to date, README samples, every package's tests, the editor's contract test (no browser needed)
npm run editor              # build the editor: editor/story-editor.html (needs Python 3 and one npm install)
```

The browser suites (Firefox and Chromium) are in `editor/qa`; see its README. For people and AI helpers: [AGENTS.md](AGENTS.md), [llms.txt](llms.txt), [CONTRIBUTING.md](CONTRIBUTING.md). History and measurements: [docs/](docs/README.md).

## Your stories stay yours

- The editor works offline and sends nothing anywhere. Your stories are kept in your own browser as you type.
- **Save** (Ctrl+S) also writes a `.story.json` file you can keep, back up or move to another device, and **Open** brings it back.
  In Chrome and Edge, Save writes straight back to the same file; Firefox and Safari download a copy each time.
- If the latest autosave can't be read, the editor opens the spare copy it keeps and tells you.

## The quick tour

The first time you open the editor it offers a short spotlight tour of the main areas; replay it any time from **Options → Take the tour**.

1. **Write:** add a page, type its text, add choices and point each choice at another page. Mark a page as an ending (good, bad or neutral).
   Press **Ctrl+K** to jump to any page by typing part of its name; the same type-to-find box picks where a choice leads. ‹ › step back and forward,
   the panel buttons hide the side lists, click an item to give it, paste a scene with `-` lines as choices, and Ctrl+Shift+Enter splits a page at the cursor. Drag the ⋮⋮ grip to reorder choices and paragraphs. The first page can never be an ending.
2. **Check:** the Check tab tells you about pages nobody can reach, choices that lead nowhere, endings players can't get to, and traps.
3. **Map:** see the whole story as a picture. Several views, from a plain flow to a bird's-eye "story shape". Click a page to open it.
4. **Items:** objects and states players can get or lose, numbers (with bars), dice skill checks, and locked choices. Turn on
   **Options → Advanced** to show more tools.
5. **Play:** try the story right inside the editor, or start from any page with "Test from here".
6. **Share:** **Export game** makes one small HTML file (about 25-50 KB for a typical story). Send it to anyone; it opens in any
   modern browser, online or off. **Options → Quick guide** inside the editor explains each part in plain words.

## Handy while writing

- **Find and replace** (Ctrl+Shift+F, or **Find...** above the page list) searches every page name, heading, paragraph and choice.
- **Unfinished flag:** the bookmark button on a page marks it as unfinished; the Check tab lists them.
- **Why can't players reach this page?** is in a page's ... menu, and the Check tab lists pages no simulated player reached.
- **Game tab:** turn on **Options, Advanced, Game** and a Game tab appears between Check and Play. It holds the options for your exported
  games and a live preview of your own story; hover over or arrow through the colors to try each one.
- **Save manuscript (.md)** in the File menu writes all the words of your story as one text file for proofreading.

## What players of your game get

Saves their place automatically, a Back button (if you turn it on), a reader comfort button (Aa) for text size, spacing and colors,
an "endings found" count, and optional place codes to continue on another device. Games are accessible to screen readers and work on
phones, tablets and computers.

## Works in

Current Firefox, Chrome, Edge and Safari on computers, Android and iPhone/iPad. Exported games work in somewhat older browsers than the
editor does (roughly Chrome/Edge 80, Firefox 74, iOS 13.4 for games; Chrome/Edge 98, Firefox 98, iOS 15.4 for the editor).

**Browsers used to test each release.** Each row of [docs/CHANGELOG.md](docs/CHANGELOG.md) ends with "Tested in": the browsers and versions behind that build, or "not recorded" where the run did not write them down. The latest editor build was tested on Firefox 157.0.1, Chromium 141.0.7390.37 (Playwright's bundled build) and Chromium 153.0.8010.0 (not ungoogled), which were the browsers available then. From 2026-10-17 the standing rule is Firefox 158, ungoogled Chromium 155 and WebKitGTK 2.52.6 (GNOME Web 46.5), one at a time. No run on those three is recorded yet.

## More from LFC Foundry

- [Apple Press](https://github.com/JNFoo/apple-press): a clicker game for kids ([play](https://jnfoo.github.io/apple-press/))
- [Fancy, the Banana](https://github.com/lfcfoundry/fancy-banana): a one-tap flying-banana arcade game ([play](https://lfcfoundry.github.io/fancy-banana/))
- [Pineapple Defense](https://github.com/JNFoo/pineapple-defense): a flick-to-throw pineapples-at-penguins game ([play](https://jnfoo.github.io/pineapple-defense/))
- [JS-modules](https://github.com/lfcfoundry/JS-modules): small dependency-free pieces for single-file browser games ([demos](https://lfcfoundry.github.io/JS-modules/))

## Credits and attributions

- Copyright (c) 2026 LFC Foundry, MIT License (see [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md)). Forged by LFC Foundry ([github.com/lfcfoundry](https://github.com/lfcfoundry)).
- Written by JNFoo with AI assistance (Claude, by Anthropic). The packages are cut from the editor's own sources and contain no third-party source code.
- **Typeface:** Inter Tight, © 2016 The Inter Project Authors (https://github.com/rsms/inter), under the SIL Open Font License 1.1. The font files keep that license and are not covered by the MIT License.
- **Packer and decoder:** the LZMA packer and decoder in `editor/lzma/` are copied from the sibling [JS-modules](https://github.com/lfcfoundry/JS-modules) repository (`tools/lzma-pack`, `modules/lzma-decode`).
- **Twine and its story formats:** File → Import Twine… reads the *file formats* of Twine, SugarCube and Harlowe. No code, text or data was copied from them; their licenses (checked 2026-10-14) and the trademark notes are in [NOTICE.md](NOTICE.md). Twine, Ink, Yarn Spinner and ChoiceScript are compared from their public documentation in [docs/FORMAT-COMPARISON.md](docs/FORMAT-COMPARISON.md).
- **Sample story:** "The Keeper's Light" is an original story by JNFoo, included under the MIT License.
- **Tools you install yourself** keep their own licenses and are not part of this repository: esbuild, Prettier, Zopfli, Puppeteer, Playwright and the test browsers.
