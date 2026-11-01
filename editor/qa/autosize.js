/* Paragraph boxes keep exactly the height a full measure gives (ui2-widgets.js autosize): a key that only adds text and still fits skips the
   measuring, so this checks, after words that fit, words that wrap onto a new line, new lines, deletions and a replaced selection, that every
   box's height equals what measuring it again gives.
   Usage: node autosize.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sample = fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8');
const SETTINGS = JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } });
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(EDITOR);
  await pg.evaluate(([s, st]) => { localStorage.clear(); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1', s); }, [sample, SETTINGS]);
  await pg.reload(); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.waitForTimeout(500);
  /* the boxes whose height differs from a fresh measure (the same rule as autosize: at least 54 px) */
  const off = () => pg.evaluate(() => [...document.querySelectorAll('#main .block textarea')].filter(t => { const h = t.style.height; t.style.height = 'auto'; const want = Math.max(t.scrollHeight + 2, 54); t.style.height = h; return h && parseFloat(h) !== want; }).length);
  let steps = 0, bad = 0;
  const step = async what => { steps++; await pg.waitForTimeout(80); const n = await off(); if (n) { bad++; console.log(`  ${n} box(es) off after: ${what}`); } };
  for (const i of [0, 2, 5]) {
    const id = await pg.evaluate(i => window.__editor.project.passages[i].id, i); await pg.evaluate(id => window.__editor.openPage(id), id); await pg.waitForTimeout(300);
    const ta = pg.locator('#main .block textarea').first(); await ta.click(); await pg.keyboard.press('End');
    for (const w of ' and then a few more words that will wrap onto another line of the box'.split(/(?= )/)) { await pg.keyboard.type(w, { delay: 3 }); await step('typing "' + w + '"'); }
    await pg.keyboard.press('Shift+Enter'); await step('a new line');
    await pg.keyboard.type('x', { delay: 3 }); await step('a letter on it');
    for (let k = 0; k < 30; k++) { await pg.keyboard.press('Backspace'); if (k % 5 === 4) await step('deleting'); }
    await pg.keyboard.press('Home'); await pg.keyboard.type('Then ', { delay: 3 }); await step('typing at the start');
    await pg.keyboard.press('Control+a'); await pg.keyboard.type('short', { delay: 3 }); await step('a replaced selection');
  }
  ok(bad === 0, `every paragraph box has exactly its measured height after each of ${steps} edits (${bad} were off)`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
