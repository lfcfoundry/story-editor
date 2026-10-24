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
  await b.close(); console.log(fails ? `\n${fails} FAILED` : '\nALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
