/* The crash-safe copy (ui1-state.js, safeSave; save-kit's durableCopy): every autosave is also written to IndexedDB, and at the next start a
   copy newer than the localStorage save is brought back. Checks, in the real page, by putting back an older localStorage save the way a
   browser crash leaves it (the newest saves had not reached the disk):
     1. the newest edit comes back, with the notice, and the save then holds it;
     2. Undo brings back the older copy;
     3. a normal reload (both copies the same) changes nothing and shows no notice;
     4. a copy older than the localStorage save is never used.
   Usage: node crashsafe.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sample = fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8');
const SETTINGS = JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } });
const NOTE = 'Your newest changes were brought back';
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  /* every notice shown since the page opened (the notice can come and go before the page is ready to test, about 130 ms in Chromium) */
  await ctx.addInitScript(() => { window.__toasts = []; document.addEventListener('DOMContentLoaded', () => { const t = document.getElementById('toast'); if (t) new MutationObserver(() => window.__toasts.push(t.textContent)).observe(t, { childList: true, characterData: true, subtree: true }); }); });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  const ready = async () => { await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.waitForTimeout(700); };
  const toast = () => pg.evaluate(() => window.__toasts.join(' | '));
  await pg.goto(EDITOR);
  await pg.evaluate(([s, st]) => { localStorage.clear(); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1', s); }, [sample, SETTINGS]);
  await pg.reload(); await ready();
  /* an edit, saved to both places */
  const id = await pg.evaluate(() => window.__editor.project.passages[0].id);
  await pg.evaluate(id => window.__editor.openPage(id), id); await pg.waitForTimeout(150);
  const ta = pg.locator('#main textarea').first(); await ta.click(); await pg.keyboard.press('End');
  await pg.keyboard.type(' the newest words', { delay: 5 });
  await pg.evaluate(() => window.__editor.persistNow()); await pg.evaluate(() => window.__editor.safeFlushed());
  const edited = await pg.evaluate(() => localStorage.getItem('story-editor-v1'));
  ok(edited.includes('the newest words'), 'the edit is saved');
  /* 3. a normal reload: nothing changes, no notice */
  await pg.reload(); await ready(); await pg.waitForTimeout(400);
  ok(await pg.evaluate(t => JSON.stringify(window.__editor.project) === t, edited), 'a normal reload opens the same story');
  ok(!(await toast()).includes(NOTE), 'and shows no notice');
  /* 1. the crash: localStorage still holds the save from before the edit, with its older number */
  await pg.evaluate(s => { localStorage.setItem('story-editor-v1', s); localStorage.setItem('story-editor-v1-seq', '1'); Storage.prototype.setItem = () => {}; }, sample); // a crash: no save on the way out
  await pg.reload(); await ready();
  await pg.waitForFunction(() => JSON.stringify(window.__editor.project).includes('the newest words'), null, { timeout: 5000 }).catch(() => {});
  ok(await pg.evaluate(t => JSON.stringify(window.__editor.project) === t, edited), 'after a crash the newest edit is brought back');
  ok((await toast()).includes(NOTE), 'with the notice');
  await pg.evaluate(() => window.__editor.persistNow());
  ok(await pg.evaluate(t => localStorage.getItem('story-editor-v1') === t, edited), 'the save then holds it');
  /* 2. Undo shows the older copy */
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(300);
  ok(await pg.evaluate(() => !JSON.stringify(window.__editor.project).includes('the newest words')), 'Undo brings back the older copy');
  await pg.keyboard.press('Control+y'); await pg.waitForTimeout(300);
  await pg.evaluate(() => window.__editor.persistNow()); await pg.evaluate(() => window.__editor.safeFlushed());
  /* 4. a copy older than the localStorage save is never used: a later save (higher number) only in localStorage */
  const later = await pg.evaluate(() => { const p = JSON.parse(localStorage.getItem('story-editor-v1')); p.passages[0].name += ' later'; return JSON.stringify(p); });
  await pg.evaluate(t => { localStorage.setItem('story-editor-v1', t); localStorage.setItem('story-editor-v1-seq', String(Date.now() + 60000)); Storage.prototype.setItem = () => {}; }, later);
  await pg.reload(); await ready(); await pg.waitForTimeout(500);
  ok(await pg.evaluate(() => window.__editor.project.passages[0].name.endsWith(' later')), 'a copy older than the save is not used');
  ok(!(await toast()).includes(NOTE), 'and no notice shows');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
