/* The page list in a big story (over 300 pages) builds only the rows on screen plus a few either side; two spacer items hold the scroll height.
   Checks: few rows in the page, the scroll height matches the page count, top / middle / end show the right names, opening a far page scrolls to it,
   Tab stays inside the list, and a small story has no spacers. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs'), path = require('path');
const FILE = require('url').pathToFileURL(process.env.QA_EDITOR || path.join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const base = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'examples', 'the-drowned-archive.story.json'), 'utf8'));
function big(mult) { const s = JSON.parse(JSON.stringify(base)), ids = new Set(base.passages.map(p => p.id)), all = [];
  for (let k = 0; k < mult; k++) { const walk = v => typeof v === 'string' ? (ids.has(v) && k ? k + '-' + v : v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, walk(b)])) : v;
    base.passages.forEach(p => { const c = walk(p); if (k) c.name = c.name + ' ' + k; all.push(c); }); }
  s.passages = all; return JSON.stringify(s); }
(async () => {
  const b = await B.launch();
  const open = async mult => { const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
    await pg.goto(FILE);
    await pg.evaluate(s => { localStorage.clear(); localStorage.setItem('story-editor-v1', s); localStorage.setItem('story-editor-v1-settings', JSON.stringify({ chosen: true, remember: true })); localStorage.setItem('story-editor-v1-toured', '1'); }, big(mult));
    await pg.reload(); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 30000 }); await pg.waitForTimeout(600); return pg; };
  const info = pg => pg.evaluate(() => { const u = document.getElementById('pages'), bs = [...u.querySelectorAll('button')], top = u.getBoundingClientRect().top, h = u.clientHeight;
    const vis = bs.filter(x => { const r = x.getBoundingClientRect(); return r.bottom > top + 1 && r.top < top + h - 1; });
    return { rows: bs.length, spacers: u.querySelectorAll('li[aria-hidden]').length, sh: u.scrollHeight, st: u.scrollTop, vis: vis.length, first: vis[0] ? vis[0].textContent : '', last: vis.length ? vis[vis.length - 1].textContent : '', cur: !!vis.find(x => x.getAttribute('aria-current') === 'true') }; });
  let pg = await open(1);
  let i = await info(pg);
  ok(i.spacers === 0 && i.rows === base.passages.length, `a ${base.passages.length}-page story builds every row, no spacers`);
  await pg.context().close();
  pg = await open(14);
  const total = base.passages.length * 14;
  const names = await pg.evaluate(() => window.__editor.project.passages.map(p => p.name));
  i = await info(pg);
  ok(i.spacers === 2 && i.rows < 150 && i.vis >= 10, `${total} pages: ${i.rows} rows built, ${i.vis} on screen`);
  const rowH = await pg.evaluate(() => document.querySelector('#pages li:not([aria-hidden])').getBoundingClientRect().height);
  ok(Math.abs(i.sh - total * rowH) < total * 0.05 + 2, `scroll height ${Math.round(i.sh)} matches ${total} rows of ${rowH.toFixed(1)} px`);
  ok(i.first.startsWith(names[0].slice(0, 10)), 'the top shows the first page');
  for (const frac of [0.5, 0.83, 1]) {
    await pg.evaluate(f => { const u = document.getElementById('pages'); u.scrollTop = f * (u.scrollHeight - u.clientHeight); }, frac); await pg.waitForTimeout(250);
    i = await info(pg);
    const at = Math.round(i.st / rowH);
    ok(i.vis >= 10 && names.slice(Math.max(0, at - 1), at + 3).some(n => i.first.includes(n.slice(0, 12)) || n.includes(i.first.trim().slice(0, 12))) && i.spacers === 2, `at ${Math.round(frac * 100)}% the rows on screen start at page ${at} (${i.first.slice(0, 20)}), ${i.rows} rows built`);
  }
  i = await info(pg);
  ok(i.last.includes(names[names.length - 1].slice(0, 12)), 'the end shows the last page');
  /* opening a far page scrolls the list to it */
  const far = Math.floor(total * 0.3);
  await pg.evaluate(id => window.__editor.openPage(id), await pg.evaluate(n => window.__editor.project.passages[n].id, far)); await pg.waitForTimeout(500);
  i = await info(pg);
  ok(i.cur, `opening page ${far} puts it in view in the list`);
  /* Tab moves along the rows and stays in the list */
  await pg.evaluate(() => document.querySelector('#pages button[aria-current="true"]').focus());
  for (let k = 0; k < 6; k++) await pg.keyboard.press('Tab');
  ok(await pg.evaluate(() => !!document.activeElement.closest('#pages')), 'Tab moves along the rows and stays inside the list');
  ok(pg.errs.length === 0, 'no page errors' + (pg.errs.length ? ': ' + pg.errs[0] : ''));
  await b.close();
  if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
  console.log('all passed');
})().catch(e => { console.log('FAIL ' + e.message); process.exit(1); });
