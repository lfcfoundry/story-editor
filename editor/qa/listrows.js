/* The page and item lists listen once for all their rows (ui2-widgets.js listRows): each row used to carry eleven listeners of its own.
   Checks, in the real page, that every row still answers as before:
     1. the page list and the item list each have far fewer listeners than rows would need (counted while the story opens);
     2. clicking the name inside a page row opens that page;
     3. right-clicking a page row opens its menu, and Escape closes it;
     4. dragging a page row carries the page's id and name;
     5. in written order, dropping one page row on the top half of another moves it there (and a drop on itself changes nothing);
     6. clicking an object in the item list puts it in the open page's Gets box; right-click opens the item menu;
     7. where the browser can make touch events: a long press on a row opens its menu, and the lifted finger does not also open the page.
   Usage: node listrows.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const story = fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8');
const SETTINGS = JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } });
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(() => {
    const n = (window.__rowListeners = { rows: 0, lists: 0 }); const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (t, f, o) { if (this.tagName === 'UL' && /^(pages|itemlist)$/.test(this.id)) n.lists++; else if (this.tagName === 'BUTTON' && this.getAttribute('draggable') === 'true') n.rows++; return add.call(this, t, f, o); };
  });
  await pg.goto(EDITOR);
  await pg.evaluate(([s, st]) => { localStorage.clear(); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1', s); }, [story, SETTINGS]);
  await pg.reload(); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.waitForTimeout(1200);
  const E = (f, a) => pg.evaluate(f, a);
  const counts = await E(() => ({ ...window.__rowListeners, pages: document.querySelectorAll('#pages li').length, items: document.querySelectorAll('#itemlist button[draggable]').length }));
  ok(counts.pages > 5 && counts.items > 0 && counts.rows < 20 && counts.lists <= 40, `rows carry no listeners of their own (${counts.pages} page rows, ${counts.items} item rows; listeners on draggable buttons ${counts.rows}, on the two lists ${counts.lists})`);

  /* 2. a click on the name inside a row opens the page */
  const pick = await E(() => { const p = window.__editor.project.passages[2]; return { id: p.id, name: p.name }; });
  await E(name => { const s = [...document.querySelectorAll('#pages .nm')].find(x => x.textContent === name); s.click(); }, pick.name); await pg.waitForTimeout(300);
  ok(await E(name => [...document.querySelectorAll('#pages button[aria-current=true] .nm')].some(x => x.textContent === name), pick.name), 'clicking the name in a page row opens that page');

  /* 3. right-click: the page menu */
  await E(() => { const s = document.querySelectorAll('#pages .nm')[1]; const r = s.getBoundingClientRect(); s.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 4, button: 2 })); });
  await pg.waitForTimeout(150);
  ok(await E(() => !!document.querySelector('.ctx')), 'right-clicking a page row opens its menu');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  ok(await E(() => !document.querySelector('.ctx')), 'and Escape closes it');

  /* 4. dragging a row carries the page */
  const drag = await E(() => { const btn = document.querySelectorAll('#pages button[draggable]')[3]; const dt = new DataTransfer();
    btn.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const id = dt.getData('application/x-story-page'), name = dt.getData('text/plain'); return { id, name, want: window.__editor.project.passages.find(p => p.id === id)?.name }; });
  ok(drag.id && drag.name === drag.want, `dragging a page row carries its id and name (${drag.name})`);

  /* 5. written order: drop the 5th row on the top half of the 2nd */
  await E(() => document.querySelector('.sortbtn').click()); await pg.waitForTimeout(150);
  await E(() => { const it = [...document.querySelectorAll('.ctx button, .ctx [role=menuitem], .ctx li')].find(x => /written/i.test(x.textContent)); it && it.click(); }); await pg.waitForTimeout(300);
  const order = () => E(() => window.__editor.project.passages.map(p => p.id));
  const o0 = await order();
  const dropOn = (from, to, top) => E(([from, to, top]) => {
    const rows = [...document.querySelectorAll('#pages button[draggable]')]; const nm = rows.map(r => r.querySelector('.nm').textContent);
    const P = window.__editor.project.passages; const target = rows[nm.indexOf(P.find(p => p.id === to).name)]; const r = target.getBoundingClientRect();
    const dt = new DataTransfer(); dt.setData('application/x-story-page', from); const y = top ? r.top + 2 : r.bottom - 2;
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 5, clientY: y }); target.querySelector('.nm').dispatchEvent(over);
    const bar = target.classList.contains(top ? 'ins-before' : 'ins-after');
    target.querySelector('.nm').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 5, clientY: y }));
    return { prevented: over.defaultPrevented, bar, cleared: !target.classList.contains('ins-before') && !target.classList.contains('ins-after') };
  }, [from, to, top]);
  const d = await dropOn(o0[4], o0[1], true); await pg.waitForTimeout(300);
  const o1 = await order();
  ok(d.prevented && d.bar && d.cleared, 'a dragged page over a row shows the bar on the right half, and the drop clears it');
  ok(o1[1] === o0[4] && o1[2] === o0[1] && o1.length === o0.length, 'dropping a page on the top half of another moves it before that page');
  await dropOn(o1[3], o1[3], false); await pg.waitForTimeout(200);
  ok(JSON.stringify(await order()) === JSON.stringify(o1), 'a drop on itself changes nothing');

  /* 6. items: a click gives the object to the open page; right-click opens the item menu */
  const gets = () => E(() => JSON.stringify(window.__editor.project));
  const g0 = await gets();
  let gave = false;
  for (let k = 0; k < 8 && !gave; k++) {
    const any = await E(k => { const all = document.querySelectorAll('#itemlist button[draggable]'); if (k >= all.length) return false; all[k].querySelector('.nm').click(); return true; }, k);
    if (!any) break;
    await pg.waitForTimeout(250);
    gave = (await gets()) !== g0;
  }
  ok(gave, 'clicking an item puts it on the open page');
  await E(() => { const s = document.querySelector('#itemlist button[draggable] .nm'); const r = s.getBoundingClientRect(); s.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 4, clientY: r.top + 4, button: 2 })); });
  await pg.waitForTimeout(150);
  ok(await E(() => !!document.querySelector('.ctx')), 'right-clicking an item opens its menu');
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);

  /* 7. long press (only where touch events can be made) */
  const canTouch = await E(() => { try { new TouchEvent('touchstart', { touches: [new Touch({ identifier: 1, target: document.body, clientX: 1, clientY: 1 })] }); return true; } catch (e) { return false; } });
  if (canTouch) {
    const sel0 = await E(() => document.querySelector('#pages button[aria-current=true] .nm').textContent);
    await E(() => { const s = document.querySelectorAll('#pages .nm')[5]; const r = s.getBoundingClientRect(); const t = new Touch({ identifier: 7, target: s, clientX: r.left + 4, clientY: r.top + 4 });
      s.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [t], targetTouches: [t], changedTouches: [t] })); window.__lp = { s, t }; });
    await pg.waitForTimeout(750);
    ok(await E(() => !!document.querySelector('.ctx')), 'a long press on a page row opens its menu');
    await E(() => { const { s, t } = window.__lp; s.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], changedTouches: [t] })); s.click(); });
    await pg.waitForTimeout(250);
    ok((await E(() => document.querySelector('#pages button[aria-current=true] .nm').textContent)) === sel0, 'and the lifted finger does not also open the page');
    await pg.keyboard.press('Escape');
  } else console.log('PASS long press not checked here: this browser cannot make touch events');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
