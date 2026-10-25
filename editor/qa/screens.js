/* Big screens and phones on their side: the big-screen text scale-up keeps the page inside the window and the Map's pointer maths exact;
   a short touch screen gets the phone layout with the tabs in a rail on the left.
   Usage: node screens.js [chromium|firefox]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const FILE = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sample = fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8').replace('"s_keepers_light"', '"s_screens_test"');
const SETTINGS = JSON.stringify({ chosen: true, remember: true, tourDone: true, advanced: { write: true, map: true, items: true, game: true } });
const seed = ([s, st]) => { if (!localStorage.getItem('qa-seeded')) { localStorage.setItem('qa-seeded', '1'); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1', s); } };
async function open(b, opts) {
  const ctx = await b.newContext(Object.assign({ locale: 'en-US' }, opts)); await ctx.addInitScript(seed, [sample, SETTINGS]);
  const pg = await ctx.newPage(); pg.errs = []; pg.on('pageerror', e => pg.errs.push(e.message));
  await pg.goto(FILE); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.waitForTimeout(500);
  return [ctx, pg];
}
(async () => {
  const b = await B.launch();
  /* ---- a big screen: 2560 x 1440 ---- */
  let [ctx, pg] = await open(b, { viewport: { width: 2560, height: 1440 } });
  const rootPx = pg => pg.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  const big = await rootPx(pg);
  ok(big === 20, 'at 2560 x 1440 the text is drawn 25% larger: root size ' + big + ' px');
  for (const t of ['Write', 'Map', 'Items', 'Check', 'Game', 'Play']) {
    await pg.click('#tabs button:has-text("' + t + '")'); await pg.waitForTimeout(500);
    const m = await pg.evaluate(() => { const r = document.getElementById('app').getBoundingClientRect(); const e = document.scrollingElement; return { bottom: Math.round(r.bottom), h: innerHeight, over: e.scrollHeight - e.clientHeight, overX: e.scrollWidth - e.clientWidth }; });
    ok(m.over <= 1 && m.overX <= 1 && m.bottom <= m.h + 1, t + ': the page fits the window (no page scroll): ' + JSON.stringify(m));
  }
  await pg.click('#tabs button:has-text("Map")'); await pg.waitForTimeout(800);
  const nodeAt = name => pg.evaluate(n => { const el = [...document.querySelectorAll('.node')].find(e => e.textContent.trim().startsWith(n)); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, name);
  const a0 = await nodeAt('Hall');
  ok(a0 && a0.w > 0, 'the Map shows the Hall card: ' + JSON.stringify(a0));
  if (a0) {
    const cx = a0.x + a0.w / 2, cy = a0.y + a0.h / 2;
    const hit = await pg.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const n = e && e.closest('.node'); return n ? n.textContent.trim().slice(0, 12) : null; }, [cx, cy]);
    ok(hit && /^Hall/.test(hit), 'the point on the Hall card hits the Hall card: ' + hit);
    for (let i = 0; i < 4; i++) { await pg.locator('#main button[aria-label="Zoom in"]').click(); await pg.waitForTimeout(150); }
    await pg.waitForTimeout(500);
    const a = await nodeAt('Hall');
    /* pan: press on empty map (top left corner of the map area) and drag; every card should move by the same amount on screen */
    const pt = await pg.evaluate(() => { const m = document.getElementById('main').getBoundingClientRect(); return [m.x + m.width / 2, m.y + m.height / 2]; });
    await pg.mouse.move(pt[0], pt[1]); await pg.mouse.down(); await pg.mouse.move(pt[0] - 6, pt[1] - 6); await pg.mouse.move(pt[0] - 120, pt[1] - 90, { steps: 8 }); await pg.mouse.up(); await pg.waitForTimeout(500);
    const a2 = await nodeAt('Hall');
    const dx = Math.round(a2.x - a.x), dy = Math.round(a2.y - a.y);
    ok(Math.abs(dx + 120) <= 4 && Math.abs(dy + 90) <= 4, 'dragging the map 120 x 90 moves the (enlarged) cards 120 x 90 the other way on screen: ' + dx + ' x ' + dy);
  }
  ok(pg.errs.length === 0, 'no script errors on the big screen: ' + pg.errs.join(' | '));
  await ctx.close();
  /* ---- a laptop-size window is not scaled ---- */
  [ctx, pg] = await open(b, { viewport: { width: 1920, height: 1080 } });
  const norm = await rootPx(pg);
  ok(norm === 16, 'at 1920 x 1080 the text keeps its normal size: root size ' + norm + ' px');
  await ctx.close();
  /* ---- a phone on its side (Chromium has real touch emulation; the others cannot report a coarse pointer) ---- */
  if (which === 'chromium') {
    [ctx, pg] = await open(b, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const rail = await pg.evaluate(() => { const r = document.getElementById('tabrow').getBoundingClientRect(); const m = document.getElementById('main').getBoundingClientRect(); return { x: r.x, w: Math.round(r.width), h: Math.round(r.height), mainLeft: Math.round(m.x), n: document.querySelectorAll('#tabs button').length, topWide: document.getElementById('top').getBoundingClientRect().width }; });
    ok(rail.x === 0 && rail.w >= 56 && rail.w <= 80 && rail.h >= 380 && rail.mainLeft >= rail.w && rail.n === 6, 'sideways: the six tabs stand in a rail on the left: ' + JSON.stringify(rail));
    const top = await pg.evaluate(() => Math.round(document.getElementById('top').getBoundingClientRect().height));
    ok(top <= 50, 'sideways: the top bar is one slim row: ' + top);
    for (const t of ['Write', 'Map', 'Items', 'Check', 'Game', 'Play']) {
      await pg.click('#tabs button:has-text("' + t + '")'); await pg.waitForTimeout(400);
      const o = await pg.evaluate(() => { const e = document.scrollingElement; return [e.scrollWidth - e.clientWidth, e.scrollHeight - e.clientHeight]; });
      ok(o[0] <= 1 && o[1] <= 1, 'sideways ' + t + ': the page itself does not scroll: ' + o.join(','));
    }
    await pg.click('#tabs button:has-text("Write")'); await pg.waitForTimeout(300);
    const ta = await pg.evaluate(() => { const t = document.querySelector('#main textarea'); const r = t.getBoundingClientRect(); const p = document.querySelector('.pinbar'); const pr = p.getBoundingClientRect(); return { top: Math.round(r.y), pinLeft: Math.round(pr.x), pinH: Math.round(pr.height) }; });
    ok(ta.top < 200 && ta.pinLeft >= 56, 'sideways Write: the text starts high and the + Choice bar clears the rail: ' + JSON.stringify(ta));
    ok(pg.errs.length === 0, 'no script errors sideways: ' + pg.errs.join(' | '));
    await ctx.close();
  }
  /* ---- long menus on a phone: they scroll above the bottom bars, and the text size is four taps ---- */
  for (const [w, h] of [[390, 700], [390, 560]]) {
    [ctx, pg] = await open(b, { viewport: { width: w, height: h } });
    await pg.click('#morebtn'); await pg.waitForTimeout(300);
    const m = await pg.evaluate(() => { const p = document.getElementById('morepop'); const r = p.getBoundingClientRect(); const bars = [document.getElementById('tabrow'), document.querySelector('.pinbar')].filter(e => e && e.getClientRects().length).map(e => e.getBoundingClientRect().top); return { top: Math.round(r.top), bottom: Math.round(r.bottom), tabTop: Math.round(document.getElementById('tabrow').getBoundingClientRect().top), scrolls: p.scrollHeight > p.clientHeight + 1, z: getComputedStyle(p).zIndex, pinTop: bars.length ? Math.round(Math.min(...bars)) : null }; });
    ok(m.bottom <= m.tabTop + 1, h + ' px tall: the ⋯ menu ends above the tab bar: ' + JSON.stringify(m));
    ok(m.scrolls, h + ' px tall: the ⋯ menu is longer than the screen and scrolls');
    await pg.evaluate(() => { const p = document.getElementById('morepop'); p.scrollTop = p.scrollHeight; }); await pg.waitForTimeout(150);
    const last = await pg.evaluate(() => { const p = document.getElementById('morepop'); const bs = p.querySelectorAll('button'); const lb = bs[bs.length - 1].getBoundingClientRect(); const pr = p.getBoundingClientRect(); const hit = document.elementFromPoint(lb.x + lb.width / 2, lb.y + lb.height / 2); return { text: bs[bs.length - 1].textContent, inside: lb.bottom <= pr.bottom + 1 && lb.top >= pr.top, hit: !!(hit && p.contains(hit)) }; });
    ok(last.inside && last.hit, h + ' px tall: scrolled to the end, the last entry (' + last.text + ') is fully visible and not covered: ' + JSON.stringify(last));
    const sizes = await pg.evaluate(() => [...document.querySelectorAll('#morepop .sizerow button')].map(e => e.getAttribute('aria-label')));
    ok(sizes.join() === 'Small,Medium,Large,Extra large', 'the text size row shows all four sizes: ' + sizes.join());
    await pg.evaluate(() => document.querySelector('#morepop .sz-x').scrollIntoView({ block: 'center' }));
    await pg.click('#morepop .sz-x'); await pg.waitForTimeout(200);
    const st = await pg.evaluate(() => ({ body: document.body.classList.contains('wsize-x'), open: !document.getElementById('morepop').hidden, on: document.querySelector('#morepop .sz-x').getAttribute('aria-checked') }));
    ok(st.body && st.open && st.on === 'true', 'one tap on Extra large applies it, keeps the menu open and marks it: ' + JSON.stringify(st));
    await pg.click('#morepop .sz-s'); await pg.waitForTimeout(200);
    ok(await pg.evaluate(() => document.body.classList.contains('wsize-s') && !document.body.classList.contains('wsize-x')), 'and one tap on Small goes straight back down');
    ok(pg.errs.length === 0, 'no script errors with the menus: ' + pg.errs.join(' | '));
    await ctx.close();
  }
  /* the File menu on a computer window that is not very tall also scrolls instead of running off the screen */
  [ctx, pg] = await open(b, { viewport: { width: 1280, height: 420 } });
  await pg.click('#menubtn'); await pg.waitForTimeout(300);
  const fm = await pg.evaluate(() => { const p = document.getElementById('menupop'); const r = p.getBoundingClientRect(); return { bottom: Math.round(r.bottom), h: innerHeight, scrolls: p.scrollHeight > p.clientHeight + 1 }; });
  ok(fm.bottom <= fm.h && fm.scrolls, '420 px tall window: the File menu fits and scrolls: ' + JSON.stringify(fm));
  await ctx.close();
  /* ---- the massive example ---- */
  [ctx, pg] = await open(b, { viewport: { width: 1280, height: 800 } });
  await pg.click('#menubtn'); await pg.click('#menupop >> text=Massive example'); await pg.waitForTimeout(300);
  await pg.click('dialog button:has-text("Load example")'); await pg.waitForTimeout(1500);
  const ms = await pg.evaluate(() => ({ pages: window.__editor.project.passages.length, title: window.__editor.project.title, items: window.__editor.project.items.length }));
  ok(ms.pages >= 300 && ms.title === 'The Drowned Archive', 'the massive example loads over 300 pages: ' + JSON.stringify(ms));
  await pg.click('#tabs button:has-text("Check")'); await pg.waitForTimeout(1500);
  const ct = await pg.evaluate(() => document.getElementById('main').innerText);
  ok(/No problems found/.test(ct) && /endings can be reached/.test(ct), 'the checker finds no problems and reaches every ending: ' + ct.replace(/\s+/g, ' ').slice(0, 200));
  await pg.click('#tabs button:has-text("Map")'); await pg.waitForTimeout(2500);
  const nodes = await pg.evaluate(() => document.querySelectorAll('.node').length);
  ok(nodes > 20, 'the Map draws the part of the big story in view: ' + nodes + ' boxes');
  await pg.click('#menubtn'); await pg.click('#menupop >> text=Example story'); await pg.waitForTimeout(300);
  await pg.click('dialog button:has-text("Load example")'); await pg.waitForTimeout(1200);
  ok(await pg.evaluate(() => window.__editor.project.title === 'The Keeper’s Light' && window.__editor.project.passages.length === 34), 'the small example is still one pick away');
  ok(pg.errs.length === 0, 'no script errors with the examples: ' + pg.errs.join(' | '));
  await ctx.close();
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
