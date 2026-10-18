/* The checker's WebAssembly walk (checkwalk.js) in a real browser: on big generated stories, analyze() gives exactly the same answers with the walk in WebAssembly
   and with the JavaScript loop, the WebAssembly walk really runs, and with WebAssembly missing the checker still works. Prints both times.
   Usage: node walk.js [chromium|firefox|webkit]   (WEBKIT=epiphany node walk.js webkit  runs it in GNOME Web)   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const path = require('path');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || path.join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
/* runs inside the page: three generated stories, answers from both walks, and the time of each */
function inPage(useWasm) {
  let seed = 7; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  function mk(N, nObj, nStat) {
    seed = 7 + N; const items = [];
    for (let i = 0; i < nObj; i++) items.push({ id: 'o' + i, name: 'O' + i, kind: 'object', show: true });
    for (let i = 0; i < nStat; i++) items.push({ id: 't' + i, name: 'T' + i, kind: 'stat', show: true, lo: 0, hi: 5, start: 2 });
    const passages = [];
    for (let i = 0; i < N; i++) passages.push({ id: 'p' + i, name: 'Page ' + i, blocks: [{ text: 'x', needs: [], forbid: [], orPrev: false }], gives: [], takes: [], choices: [], ending: i > N - 6 });
    passages.forEach((p, i) => {
      if (nObj && rnd() < 0.25) p.gives = ['o' + int(0, nObj - 1)];
      if (p.ending) return;
      for (let k = int(2, 3); k > 0; k--) {
        const c = { label: 'c' + k, to: 'p' + (rnd() < 0.8 ? Math.min(N - 1, i + int(1, 8)) : int(0, N - 1)), needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: false, why: '' };
        if (nObj && rnd() < 0.15) c.needs = ['o' + int(0, nObj - 1)];
        if (nStat && rnd() < 0.2) c.adds['t' + int(0, nStat - 1)] = int(-1, 2);
        if (nStat && rnd() < 0.2) c.check = { stat: 't' + int(0, nStat - 1), target: int(2, 9), fail: 'p' + int(0, N - 1) };
        p.choices.push(c);
      }
    });
    return normalizeProject({ id: 's', title: 't', start: 'p0', items, givens: [], passages, game: {} });
  }
  const real = window.klWalkWasm; let used = 0;
  window.klWalkWasm = useWasm ? function (a) { const r = real(a); if (r) used++; return r; } : 0;
  const out = [];
  for (const [N, o, s] of [[30, 3, 1], [100, 6, 2], [300, 8, 3]]) {
    const p = mk(N, o, s); analyze(p);
    const t0 = performance.now(); const r = analyze(p); const ms = performance.now() - t0;
    out.push({ pages: N, states: r.states, truncated: !!r.truncated, ms: Math.round(ms), json: JSON.stringify([r.problems, r.warnings, r.notes, r.endings, r.states, r.grouped, r.pruned, r.truncated, r.samples]) });
  }
  window.klWalkWasm = real;
  return { out, used };
}
(async () => {
  const b = await B.launch(); const errs = [];
  const ready = pg => pg.waitForFunction(() => window.__editor && !document.getElementById('splash') && typeof klWalkWasm === 'function', null, { timeout: 30000 });
  const ctx = await b.newContext({ viewport: { width: 1200, height: 800 } });
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(EDITOR); await ready(pg);
  const w = await pg.evaluate(inPage, true), j = await pg.evaluate(inPage, false);
  ok(w.used >= 6, 'the WebAssembly walk ran for the generated stories (' + w.used + ' times; a story with numbers is checked twice when it is big)');
  w.out.forEach((x, i) => ok(x.json === j.out[i].json, `${x.pages} pages, ${x.states} situations${x.truncated ? ' (stopped at the limit)' : ''}: same answers in WebAssembly and JavaScript (${x.json.length} characters compared)`));
  ok(w.out[1].states > 50000 && w.out[2].truncated, 'the big stories really are big: ' + w.out.map(x => x.states).join(', ') + ' situations');
  console.log('time of analyze, JavaScript then WebAssembly: ' + w.out.map((x, i) => `${x.pages} pages ${j.out[i].ms} -> ${x.ms} ms`).join('; '));
  ok(w.out[2].ms * 1.5 < j.out[2].ms, `the WebAssembly walk is at least 1.5 times as fast on the biggest story (${j.out[2].ms} -> ${w.out[2].ms} ms)`);
  await ctx.close();
  /* with WebAssembly missing the checker still works and gives the same answers */
  const c2 = await b.newContext({ viewport: { width: 1200, height: 800 } });
  await c2.addInitScript(() => { try { delete window.WebAssembly; } catch (e) { window.WebAssembly = undefined; } });
  const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(EDITOR); await ready(p2);
  const n = await p2.evaluate(inPage, true);
  ok(n.used === 0 && n.out.every((x, i) => x.json === j.out[i].json), 'without WebAssembly the walk is not used and the answers are the same');
  ok(!errs.length, 'no errors: ' + errs.join('; '));
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
