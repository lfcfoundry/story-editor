/* The page list's problem dots follow the newest check (ui3-write.js renderList). They used to come from the check that was current when the
   side panel was last built in full, so after a story opened, or after an edit that made or fixed a problem, the dots stayed stale until
   another page was opened. Checks, in the real page, with a story whose copied pages lead nowhere (problems on most pages):
     1. after the first check, without opening a page, every page with a problem has a dot and no other page has one;
     2. an edit that gives a page a problem, and its Undo, move the dot with the next check.
   Usage: node listdots.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sample = JSON.parse(fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8'));
/* a second copy of every page whose choices still point at the originals: the copies cannot be reached */
const copy = JSON.parse(JSON.stringify(sample.passages)).map(p => ({ ...p, id: p.id + '_c', name: p.name + ' (copy)' }));
const story = JSON.stringify({ ...sample, passages: sample.passages.concat(copy) });
const SETTINGS = JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } });
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(EDITOR);
  await pg.evaluate(([s, st]) => { localStorage.clear(); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1', s); }, [story, SETTINGS]);
  await pg.reload(); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.waitForTimeout(1200);
  /* the rows with a dot, against the pages the newest check found problems on */
  const compare = () => pg.evaluate(() => { const want = new Set(window.__editor.checkFresh().problems.map(x => x.pid));
    const rows = [...document.querySelectorAll('#pages li')]; const names = new Map(window.__editor.project.passages.map(p => [p.name, p.id]));
    let right = 0, wrong = 0; rows.forEach(li => { const id = names.get(li.querySelector('.nm').textContent); const dot = !!li.querySelector('.dot'); if (dot === want.has(id)) right++; else wrong++; });
    return { right, wrong, want: want.size }; });
  let c = await compare();
  ok(c.want > 0 && c.wrong === 0, `after the first check every row's dot matches the check (${c.want} pages with problems, ${c.wrong} rows wrong)`);
  /* an edit that sends the first page's first choice nowhere gives it a problem; Undo takes it back */
  const first = await pg.evaluate(() => window.__editor.project.passages[0].id);
  await pg.evaluate(id => window.__editor.openPage(id), first); await pg.waitForTimeout(300);
  const before = c.want;
  await pg.evaluate(() => { const ta = document.querySelector('#main textarea'); ta.focus(); ta.value = ''; ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await pg.waitForTimeout(1500);
  c = await compare();
  ok(c.wrong === 0, `after an edit the dots follow the newest check (${c.want} pages with problems, was ${before}; ${c.wrong} rows wrong)`);
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(1500);
  c = await compare();
  ok(c.wrong === 0 && c.want === before, `and after Undo (${c.want} pages with problems; ${c.wrong} rows wrong)`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
