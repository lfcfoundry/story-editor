/* The packed autosave (ui1-state.js, persistPacked): a big story is saved deflated ('LFZ1:' + length + ':' + base64), written after a small
   worker has checked that the packed copy reads back the same. Checks, in the real page:
     1. after an edit in a big story the save is packed, holds the story's length, and is at least 3 times smaller than the text;
     2. a reload opens the edited story from the packed save, without notices;
     3. a save that must happen at once (the tab closing) is written as plain text, and opens too;
     4. the spare copy is plain text;
     5. a damaged packed save is kept aside and the spare copy opens, with the notice;
     6. a small story is saved as plain text;
     7. after mixed edits (typing in two pages, Undo, a new page, more typing) every packed save reads back exactly the story, and saves after
        typing send only the changed stretch to the worker.
   Usage: node zsave.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const fs = require('fs');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sample = fs.readFileSync(__dirname + '/fixtures/sample.story.json', 'utf8');
/* a big story: the sample's pages four times over (copies renamed, their choices still pointing at the originals) */
const big = (() => { const s = JSON.parse(sample); const all = [...s.passages]; for (let k = 1; k < 4; k++) s.passages.forEach(p => all.push({ ...JSON.parse(JSON.stringify(p)), id: p.id + '_' + k, name: p.name + ' ' + k })); s.passages = all; return JSON.stringify(s); })();
const SETTINGS = JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } });
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  const ready = async () => { await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 20000 }); await pg.waitForTimeout(700); };
  /* the notices shown in the first 4 seconds after a start (polled: a notice stays about 3.5 s) */
  const notices = () => pg.evaluate(async () => { const out = new Set(); for (let i = 0; i < 40; i++) { const t = document.getElementById('toast'); if (t && t.textContent) out.add(t.textContent); await new Promise(r => setTimeout(r, 100)); } return [...out].join(' | '); });
  const stored = () => pg.evaluate(() => localStorage.getItem('story-editor-v1'));
  const type = async words => { const id = await pg.evaluate(() => window.__editor.project.passages[0].id); await pg.evaluate(id => window.__editor.openPage(id), id); await pg.waitForTimeout(150); const ta = pg.locator('#main textarea').first(); await ta.click(); await pg.keyboard.press('End'); await pg.keyboard.type(words, { delay: 5 }); };
  const waitPacked = () => pg.waitForFunction(() => (localStorage.getItem('story-editor-v1') || '').startsWith('LFZ1:') && (localStorage.getItem('story-editor-v1') || '').length > 0, null, { timeout: 10000 }).then(() => true, () => false);
  await pg.goto(EDITOR);
  await pg.evaluate(([s, st]) => { localStorage.clear(); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1', s); }, [big, SETTINGS]);
  await pg.reload(); await ready();
  /* 1. an edit in a big story: the save is packed */
  await type(' packed words');
  let packed = await waitPacked();
  await pg.waitForTimeout(300);
  let s = await stored();
  const len = await pg.evaluate(() => JSON.stringify(window.__editor.project).length);
  const held = s.startsWith('LFZ1:') ? +s.slice(5, s.indexOf(':', 5)) : -1;
  ok(packed && held === len, `after an edit the save is packed and holds the story's length (${held} of ${len})`);
  ok(s.length * 3 <= len, `and it is at least 3 times smaller (${s.length} characters for ${len}, ${(len / s.length).toFixed(1)} times)`);
  /* 4. the spare copy, renewed at the first save of a session, is plain text */
  const spare = await pg.evaluate(() => localStorage.getItem('story-editor-v1-backup') || '');
  ok(spare.startsWith('{') && !spare.includes('packed words'), 'the spare copy is plain text (the story before the edit)');
  /* 2. a reload opens the packed save */
  await pg.reload(); await pg.waitForFunction(() => window.__editor, null, { timeout: 20000 });
  const quiet = await notices();
  const back = await pg.evaluate(() => JSON.stringify(window.__editor.project));
  ok(back.includes('packed words') && back.length === len, 'a reload opens the edited story from the packed save');
  ok(!quiet, 'with no notice (' + quiet + ')');
  /* 3. a save that must happen at once is plain text, and opens too */
  await type(' at once');
  await pg.evaluate(() => window.__editor.persistNow());
  s = await stored();
  ok(s.startsWith('{') && s.includes('at once'), 'a save made at once (the tab closing) is plain text');
  await pg.reload(); await ready();
  ok(await pg.evaluate(() => JSON.stringify(window.__editor.project).includes('at once')), 'and opens');
  /* 7. mixed edits: each packed save is exactly the story; typing that follows a packed save sends only the changed stretch (Undo saves at once as plain text; a new page sends the whole text) */
  const exact = async (what, plain) => { await pg.waitForTimeout(1300);
    await pg.waitForFunction(() => !window.__editor.zsave.job, null, { timeout: 10000 }).catch(() => {});
    const r = await pg.evaluate(async () => { const raw = localStorage.getItem('story-editor-v1'); const t = await window.__editor.zsaveText(raw); return { packed: raw.startsWith('LFZ1:'), same: t === JSON.stringify(window.__editor.project) }; });
    ok(r.packed !== !!plain && r.same, `${what}: the ${plain ? 'plain' : 'packed'} save is exactly the story`); };
  const typeIn = async (k, words) => { const id = await pg.evaluate(k => window.__editor.project.passages[k].id, k); await pg.evaluate(id => window.__editor.openPage(id), id); await pg.waitForTimeout(150); const ta = pg.locator('#main textarea').first(); await ta.click(); await pg.keyboard.press('End'); await pg.keyboard.type(words, { delay: 5 }); };
  const parts0 = await pg.evaluate(() => window.__editor.zsave.parts);
  await typeIn(0, ' one'); await exact('typing');
  await typeIn(9, ' two'); await typeIn(0, ' three'); await exact('typing in two pages in one pause');
  await pg.evaluate(() => document.activeElement.blur()); await pg.keyboard.press('Control+z'); await exact('Undo (saved at once, so plain)', true);
  await typeIn(3, ' four'); await exact('typing after Undo');
  await pg.evaluate(() => { const P = window.__editor.project.passages; P.push({ ...JSON.parse(JSON.stringify(P[1])), id: 'zz_new', name: 'Zz new page' }); window.__editor.refresh(); });
  await typeIn(2, ' five'); await exact('a new page, then typing');
  await typeIn(14, ' six'); await exact('typing again');
  const parts = await pg.evaluate(() => window.__editor.zsave.parts) - parts0;
  ok(parts >= 2, `saves after typing that follow a packed save send only the changed stretch (${parts}; 2 expected)`);
  /* 5. a damaged packed save: kept aside, the spare opens, with the notice */
  await pg.evaluate(sp => { localStorage.setItem('story-editor-v1', 'LFZ1:5000:AAAAbroken'); localStorage.setItem('story-editor-v1-backup', sp); localStorage.removeItem('story-editor-v1-seq'); }, big);
  await pg.evaluate(() => indexedDB.deleteDatabase('story-editor-v1-safe'));
  await pg.reload(); await pg.waitForFunction(() => window.__editor, null, { timeout: 20000 });
  const seen = await notices();
  ok(await pg.evaluate(t => JSON.stringify(window.__editor.project).length === t, big.length) || await pg.evaluate(() => window.__editor.project.passages.length) === JSON.parse(big).passages.length, 'a damaged packed save: the spare copy opens');
  ok(/earlier copy was restored/.test(seen), 'with the notice (' + seen.slice(0, 80) + ')');
  ok(await pg.evaluate(() => localStorage.getItem('story-editor-v1-damaged')) === 'LFZ1:5000:AAAAbroken', 'and the damaged save is kept aside');
  /* 6. a small story stays plain */
  await pg.evaluate(([s, st]) => { localStorage.clear(); localStorage.setItem('story-editor-v1-settings', st); localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1', s); }, [sample, SETTINGS]);
  await pg.reload(); await ready();
  await type(' small words'); await pg.waitForTimeout(1500);
  s = await stored();
  ok(s.startsWith('{') && s.includes('small words'), 'a small story is saved as plain text');
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
