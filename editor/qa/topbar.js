/* The top bar's tabs and the phone's drawer bar are made again only when what they show changed (ui5-app.js renderTop). Checks, in the
   real page, with a story whose copied pages lead nowhere (problems on most pages):
     1. the Check tab's badge shows the newest check's number of problems, after start, after typing, after a new page nothing leads to,
        and after its Undo;
     2. typing and the check after it keep the same tab buttons;
     3. a renamed page shows its new name on the drawer bar's page button, and a tab click selects that tab.
   Usage: node topbar.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
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
  /* the Check tab's badge against the newest check, and the tab buttons as elements */
  /* waits up to 5 s for the badge to settle on the check (the check runs in a worker after a pause), then reads both */
  const badge = async () => { await pg.waitForFunction(() => { const el = document.querySelector('#tabs [data-tab="check"] .badge'); return el && el.textContent === String(window.__editor.checkFresh().problems.length); }, null, { timeout: 5000 }).catch(() => {}); return badgeNow(); };
  const badgeNow = () => pg.evaluate(() => { const n = window.__editor.checkFresh().problems.length; const el = document.querySelector('#tabs [data-tab="check"] .badge'); return { n, text: el ? el.textContent : '(none)' }; });
  let c = await badge();
  ok(c.n > 0 && c.text === String(c.n), `the Check tab's badge shows the check's ${c.n} problems (${c.text})`);
  const first = await pg.evaluate(() => window.__editor.project.passages[0].id);
  await pg.evaluate(id => window.__editor.openPage(id), first); await pg.waitForTimeout(300);
  await pg.evaluate(() => { window.__tabs = [...document.querySelectorAll('#tabs [role=tab]')]; });
  const ta = pg.locator('#main textarea').first(); await ta.click(); await pg.keyboard.press('End');
  await pg.keyboard.type(' and on', { delay: 30 }); await pg.waitForTimeout(1500);
  const kept = await pg.evaluate(() => { const now = [...document.querySelectorAll('#tabs [role=tab]')]; return now.length === window.__tabs.length && now.every((t, i) => t === window.__tabs[i]); });
  ok(kept, 'typing and its check keep the same tab buttons (nothing they show changed)');
  c = await badge();
  ok(c.text === String(c.n), `the badge still matches after typing (${c.text} of ${c.n})`);
  /* a new page nothing leads to (Ctrl+K, a new name, Enter) adds a problem: the badge follows; Undo brings the old number back */
  const before = c.n;
  await pg.keyboard.press('Escape'); await pg.keyboard.press('Control+k'); await pg.waitForTimeout(150); await pg.keyboard.type('Zzz lonely room'); await pg.waitForTimeout(150); await pg.keyboard.press('Enter');
  await pg.waitForTimeout(1500);
  c = await badge();
  ok(c.n !== before && c.text === String(c.n), `after a change in the number of problems the badge follows the newest check (${c.text}; the check found ${c.n}, was ${before})`);
  await pg.keyboard.press('Escape'); await pg.evaluate(() => document.activeElement && document.activeElement.blur()); await pg.keyboard.press('Control+z'); await pg.waitForTimeout(1500);
  c = await badge();
  ok(c.text === String(c.n) && c.n === before, `and after Undo (${c.text} of ${c.n})`);
  /* the page-name box: the phone bar's page button carries the new name */
  await pg.fill('#pname', 'Renamed hall'); await pg.waitForTimeout(400);
  const bar = await pg.evaluate(() => { const e = document.querySelector('#drawerbar .cd-nm'); return e ? e.textContent : '(none)'; });
  ok(bar === 'Renamed hall', `the page button in the drawer bar follows a renamed page (${bar})`);
  /* switching tabs still redraws them: the Map tab is the selected one */
  await pg.click('#tabs [data-tab="map"]'); await pg.waitForTimeout(500);
  const sel = await pg.evaluate(() => [...document.querySelectorAll('#tabs [role=tab]')].filter(t => t.getAttribute('aria-selected') === 'true').map(t => t.dataset.tab).join());
  ok(sel === 'map', `after a tab click only that tab is selected (${sel})`);
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
