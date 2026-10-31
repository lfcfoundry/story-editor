/* The deep check (ui4-views.js, deepCheckSoon): a story that stops the ordinary check at 200,000 situations is checked again in a second
   background worker up to KL_DEEP_LIMIT. Checks, in the real page: the deep answer replaces the partial one and equals a deep check made on the
   page; the status line says "Checking further" while it runs and not after; an edit stops it and the edited story gets its own deep answer;
   window.__deepCheck=false turns it off; a story that fits in 200,000 starts none.
   Usage: node deepcheck.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const path = require('path');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || path.join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
/* generated stories with many objects: (200, 12, 5) has 269,109 situations, (200, 14, 1) has 1,214,606, (60, 4, 9) fits easily */
function story(N, nObj, sd) {
  let seed = sd; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648), int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const items = []; for (let i = 0; i < nObj; i++) items.push({ id: 'o' + i, name: 'O' + i, kind: 'object', show: true });
  const passages = []; for (let i = 0; i < N; i++) passages.push({ id: 'p' + i, name: 'Page ' + i, blocks: [{ text: 'x', needs: [], forbid: [], orPrev: false }], gives: [], takes: [], choices: [], ending: i > N - 3 });
  passages.forEach((p, i) => { if (rnd() < 0.25) p.gives = ['o' + int(0, nObj - 1)]; if (p.ending) return;
    for (let k = int(2, 3); k > 0; k--) { const c = { label: 'c' + k, to: 'p' + (rnd() < 0.8 ? Math.min(N - 1, i + int(1, 8)) : int(0, N - 1)), needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: false, why: '' };
      if (rnd() < 0.15) c.needs = ['o' + int(0, nObj - 1)]; p.choices.push(c); } });
  return JSON.stringify({ format: 'story-editor', id: 's', title: 't', start: 'p0', items, givens: [], passages, game: {} });
}
const SUMMARY = `(() => { const E = __editor, a = E.analysis, f = E.checkDeep(); const pick = r => JSON.stringify({ p: r.problems, w: r.warnings, e: r.endings, s: r.states, g: r.grouped, pr: r.pruned, t: r.truncated });
  return { same: pick(a) === pick(f), states: a.states, truncated: a.truncated, deep: !!a.deep }; })()`;
const status = pg => pg.evaluate(() => document.getElementById('statusline').innerText.replace(/\s+/g, ' '));
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  const open = async (json, init) => {
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    if (init) await pg.addInitScript(init);
    await pg.goto(EDITOR); await pg.waitForFunction(() => window.__editor, null, { timeout: 30000 });
    await pg.evaluate(j => { localStorage.setItem('story-editor-v1-toured', '1'); localStorage.setItem('story-editor-v1-settings', JSON.stringify({ chosen: true, remember: true })); localStorage.setItem('story-editor-v1', j); }, json);
    await pg.reload(); await pg.waitForFunction(() => window.__editor && __editor.analysis, null, { timeout: 30000 });
    return pg;
  };
  const deepDone = (pg, n, ms) => pg.waitForFunction(n => __editor.deepPre.done >= n && __editor.analysis && __editor.analysis.deep, n, { timeout: ms || 60000 }).then(() => true, () => false);

  /* a story past 200,000: the deep answer comes and is the full one */
  let pg = await open(story(200, 12, 5));
  ok(await deepDone(pg, 1), 'a story that stops the check at 200,000 gets a deep answer');
  let r = await pg.evaluate(SUMMARY);
  ok(r.deep && !r.truncated && r.states > 200000, 'the deep answer covers the whole story: ' + r.states + ' situations');
  ok(r.same, 'and equals a deep check made on the page');
  const st = await status(pg);
  ok(!/Not fully checked|Checking further/.test(st), 'the status line no longer says the story is not fully checked: ' + st);
  ok(await pg.evaluate(() => !__editor.deepPre.worker), 'the deep worker is closed after its answer');
  await pg.evaluate(() => __editor.setView('check'));
  ok(await pg.evaluate(() => !/too large to check completely/.test(document.getElementById('main').innerText)), 'the Check tab shows the full answer');
  await pg.close();

  /* a bigger story: the status line says so while it runs, an edit stops it, the edited story gets its own answer */
  pg = await open(story(200, 14, 1));
  await pg.waitForFunction(() => __editor.deepPre.posted >= 1, null, { timeout: 20000 });
  const during = await status(pg);
  ok(/Checking further/.test(during) || (await pg.evaluate(() => __editor.deepPre.done >= 1)), 'while it runs the status line says "Checking further": ' + during);
  await pg.evaluate(() => { const E = __editor; E.project.passages[3].blocks[0].text += ' more'; E.refresh(); });
  const cancelled = await pg.evaluate(() => __editor.deepPre.cancelled);
  ok(cancelled >= 1 || (await pg.evaluate(() => __editor.deepPre.done >= 1)), 'an edit stops the deep check of the old story (' + cancelled + ' stopped)');
  ok(await deepDone(pg, 1, 120000), 'the edited story gets a deep answer');
  r = await pg.evaluate(SUMMARY);
  ok(r.deep && r.same && r.states > 1000000, 'it is the answer for the story as it is now: ' + r.states + ' situations');
  await pg.close();

  /* switched off */
  pg = await open(story(200, 12, 5), () => { window.__deepCheck = false; });
  await new Promise(r => setTimeout(r, 2500));
  ok(await pg.evaluate(() => __editor.deepPre.posted === 0 && __editor.analysis.truncated), 'window.__deepCheck=false starts no deep check');
  await pg.close();

  /* a story that fits starts none */
  pg = await open(story(60, 4, 9));
  await new Promise(r => setTimeout(r, 1500));
  ok(await pg.evaluate(() => __editor.deepPre.posted === 0 && !__editor.analysis.truncated), 'a story that fits in 200,000 starts no deep check');
  await pg.close();

  ok(errs.length === 0, 'no errors in the page' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? fails + ' FAIL' : 'all pass'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
