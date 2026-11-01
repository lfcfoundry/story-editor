/* The Map's key (legend): it stays shown or hidden the way the writer left it, across reloads. Usage: node mapkey.js [chromium|firefox]
   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const FILE = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sample = fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8');
(async () => {
  const b = await B.launch();
  const ctx = await b.newContext({ viewport: { width: 1366, height: 800 } });
  await ctx.addInitScript(([s]) => { if (!localStorage.getItem('qa-seeded')) { localStorage.setItem('qa-seeded', '1'); localStorage.setItem('story-editor-v1-settings', JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } })); localStorage.setItem('story-editor-v1-story', s); } }, [sample]);
  await ctx.addInitScript(() => { window.__verCheck = true; }); // curSig: no story version number may stand for two texts
  const errs = []; const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  const load = async () => { await pg.goto(FILE); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.click('#tabs button:has-text("Map")'); await pg.waitForSelector('.fkhead'); await pg.waitForTimeout(300); };
  const open = () => pg.evaluate(() => document.querySelector('.fktoggle').getAttribute('aria-expanded') === 'true');
  await load();
  ok(await open(), 'first time on a wide screen the key is shown');
  await pg.click('.fkhead'); await pg.waitForTimeout(200);
  ok(!(await open()), 'a click on its head hides it');
  await load();
  ok(!(await open()), 'after a reload it is still hidden');
  await pg.click('.fkhead'); await pg.waitForTimeout(200);
  await load();
  ok(await open(), 'shown again, it stays shown after a reload');
  ok(!errs.length, 'no errors: ' + errs.join(' | '));
  await b.close(); console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL crash: ' + e.message); process.exit(1); });
