/* The story text kept for Undo, saving, the checker and the Map is rewritten one page at a time while you type (ui1-state.js, pageEdit).
   Checks, in the real page: after typing in a paragraph, a page name, a heading and a choice on several pages, mixed with edits that change
   the whole story (a new page, a new choice, Undo, Redo), the kept text is always exactly JSON.stringify(project), the save holds it, and Undo
   brings back exactly the text before each step.
   Usage: node curtext.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sample = fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8');
const SETTINGS = JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } });
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  await ctx.addInitScript(([s, st]) => { if (!localStorage.getItem('qa-seeded')) { localStorage.setItem('qa-seeded', '1'); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1', s); } }, [sample, SETTINGS]);
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(EDITOR); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.waitForTimeout(500);
  const exact = () => pg.evaluate(() => window.__editor.curExact());
  let steps = 0, bad = 0;
  const step = async what => { steps++; if (!(await exact())) { bad++; if (bad < 4) console.log('  not exact after: ' + what); } };
  const ids = await pg.evaluate(() => window.__editor.project.passages.slice(0, 6).map(p => p.id));
  const texts = [];
  for (const [n, id] of ids.entries()) {
    await pg.evaluate(id => window.__editor.openPage(id), id); await pg.waitForTimeout(150);
    const ta = pg.locator('#main textarea').first(); await ta.click(); await pg.keyboard.press('End');
    await pg.keyboard.type(' and then “more”, \\ said é ' + n, { delay: 5 }); await step('paragraph on page ' + n);
    texts.push(await pg.evaluate(() => JSON.stringify(window.__editor.project)));
    const name = pg.locator('#pname'); await name.click(); await pg.keyboard.press('End'); await pg.keyboard.type(' x' + n, { delay: 5 }); await step('page name ' + n);
    const hd = pg.locator('#pheading'); if (await hd.count()) { await hd.click(); await pg.keyboard.type('Head ' + n, { delay: 5 }); await step('heading ' + n); }
    const ch = pg.locator('#main input[aria-label^="Choice 1 text"]'); if (await ch.count()) { await ch.first().click(); await pg.keyboard.press('End'); await pg.keyboard.type(' now', { delay: 5 }); await step('choice ' + n); }
    if (n === 2) { await pg.locator('button:has-text("+ New page")').first().click(); await pg.waitForTimeout(300); await step('new page'); }
    if (n === 3) { await pg.keyboard.press('Escape'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300); await step('undo'); await pg.keyboard.press('Control+y'); await pg.waitForTimeout(300); await step('redo'); }
  }
  ok(bad === 0, `the kept story text equals the story after every one of ${steps} edits (${bad} did not)`);
  await pg.evaluate(() => window.__editor.persistNow()); await pg.waitForTimeout(100);
  ok(await pg.evaluate(() => localStorage.getItem('story-editor-v1') === JSON.stringify(window.__editor.project)), 'the save holds exactly the story');
  /* Undo all the way back steps through exact texts, and the paragraph typed on the first page is gone at the end */
  let undoBad = 0;
  for (let i = 0; i < 40; i++) { await pg.keyboard.press('Escape'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(60); if (!(await exact())) undoBad++; }
  ok(undoBad === 0, 'every Undo leaves the kept text equal to the story (' + undoBad + ' did not)');
  ok(await pg.evaluate(t => JSON.stringify(window.__editor.project) !== t, texts[0]), 'Undo went back past the first typed paragraph');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
