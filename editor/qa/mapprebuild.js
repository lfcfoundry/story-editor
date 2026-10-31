/* The Map layout of a big story is built ahead in a background worker (ui4-map.js, mapPrebuild). Checks, in the real page under its own policy:
   a 300-page story gets a ready layout after the first check, then the other two plain views, and each is exactly what the usual build gives
   (graph, boxes, positions, order, crossings);
   an edit makes that layout stale (not used) and a fresh one follows; a small story starts no worker; the switch window.__mapPrebuild=false turns it off;
   and the Map opens and draws the same boxes either way.
   Usage: node mapprebuild.js [chromium|firefox|webkit]   (WEBKIT=epiphany node mapprebuild.js webkit  runs it in GNOME Web)   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const path = require('path');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || path.join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const nap = ms => new Promise(r => setTimeout(r, ms));
/* a seeded story of N pages with forward choices and some long jumps */
const mkSrc = `(([N])=>{let seed=7+N;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)&0x7fffffff;return seed/0x7fffffff;};const int=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const passages=[];for(let i=0;i<N;i++)passages.push({id:'p'+i,name:'Page '+i,blocks:[{text:'x',needs:[],forbid:[],orPrev:false}],gives:[],takes:[],choices:[],ending:i>N-4});
passages.forEach((p,i)=>{if(p.ending)return;for(let k=int(2,3);k>0;k--){const to=rnd()<0.85?'p'+Math.min(N-1,i+int(1,6)):'p'+int(0,N-1);p.choices.push({label:'c'+k,to,needs:[],forbid:[],gives:[],takes:[]});}});
return JSON.stringify(normalizeProject({id:'s',title:'t',start:'p0',items:[],givens:[],passages,game:{}}));})`;
const SAME = v => `(() => {
  const E = __editor, A = E.mapKept('${v}'), F = E.mapFresh('${v}');
  if (!A) return 'no ready layout';
  const seen = new Map();
  const eq = (x, y, p) => {
    if (x === y) return null;
    if (typeof x !== typeof y || x === null || y === null || typeof x !== 'object') return Number.isNaN(x) && Number.isNaN(y) ? null : p + ': ' + x + ' vs ' + y;
    if (seen.get(x) === y) return null; seen.set(x, y);
    const top = p === '', skip = k => top && ['ms', 'pt', 'groups', '_metrics', '_centers'].includes(k);
    const kx = Object.keys(x).filter(k => !skip(k)), ky = Object.keys(y).filter(k => !skip(k));
    if (kx.length !== ky.length) return p + ': ' + kx.length + ' keys vs ' + ky.length;
    for (const k of kx) { if (!(k in y)) return p + '.' + k + ' missing'; const d = eq(x[k], y[k], p + '.' + k); if (d) return d; }
    return null;
  };
  const pre = A._metrics && A._metrics.cross !== undefined; // the worker already counted the crossings
  const d = eq(A, F, '');
  if (d) return d;
  if (!pre) return 'the background layout has no crossing count yet';
  const ca = E.mapChip(A).raw, cf = E.mapChip(F).raw;
  return ca.crossings === cf.crossings && ca.backward === cf.backward && ca.edges === cf.edges ? 'same' : 'chip numbers differ: ' + JSON.stringify([ca, cf]);
})()`;
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  const open = async (n, init) => {
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    if (init) await pg.addInitScript(init);
    await pg.goto(EDITOR); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 30000 });
    const json = await pg.evaluate(`(${mkSrc})([${n}])`);
    /* the advanced Map is on, so all three plain views (flow, top-down, spine) are offered */
    await pg.evaluate(j => {
      localStorage.setItem('story-editor-v1', j);
      localStorage.setItem('story-editor-v1-settings', JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } }));
    }, json);
    await pg.reload(); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 30000 });
    return pg;
  };
  const built = pg => pg.evaluate(() => __editor.mapPre.built);
  const waitBuilt = (pg, n) => pg.waitForFunction(n => __editor.mapPre.built >= n, n, { timeout: 15000 }).then(() => true, () => false);

  let pg = await open(300);
  ok(await waitBuilt(pg, 1), 'a 300-page story gets its Map layout built in the background after the first check');
  ok(await waitBuilt(pg, 3), 'then the other two plain views (top-down, spine) are built too');
  for (const v of ['flow', 'down', 'spine']) ok(await pg.evaluate(SAME(v)) === 'same', `the background ${v} layout is exactly the usual layout: ` + await pg.evaluate(SAME(v)));
  const before = await built(pg);
  /* an edit: the old layout must not be offered, a new one follows */
  await pg.evaluate(() => { const E = __editor; E.project.passages[3].blocks[0].text += ' more'; E.refresh(); });
  ok(await pg.evaluate(() => __editor.mapKept()) === null, 'right after an edit the old layout is not offered');
  ok(await waitBuilt(pg, before + 3), 'new layouts are built for the edited story, all three views');
  ok(await pg.evaluate(SAME('flow')) === 'same', 'and they too equal the usual layout: ' + await pg.evaluate(SAME('flow')));
  /* opening the Map uses it and draws */
  const drew = await pg.evaluate(async () => { __editor.setView('map'); for (let t = 0; t < 100 && !document.querySelector('.mapbox g.node'); t++) await new Promise(r => setTimeout(r, 100)); return document.querySelectorAll('.mapbox g.node').length; }); /* waits for the first boxes (up to 10 s), not a fixed 0.6 s */
  ok(drew > 0, 'the Map opens and draws boxes (' + drew + ')');
  ok(!(await pg.evaluate(() => __editor.mapPre.bad)), 'the worker never gave up');
  await pg.close();

  pg = await open(20);
  await nap(1500);
  ok(await built(pg) === 0, 'a 20-page story starts no worker (it builds in a few ms by itself)');
  await pg.close();

  pg = await open(300, () => { window.__mapPrebuild = false; });
  await nap(2500);
  ok(await built(pg) === 0, 'with window.__mapPrebuild=false nothing is built in the background');
  const d2 = await pg.evaluate(async () => { __editor.setView('map'); for (let t = 0; t < 100 && !document.querySelector('.mapbox g.node'); t++) await new Promise(r => setTimeout(r, 100)); return document.querySelectorAll('.mapbox g.node').length; }); /* waits for the first boxes (up to 10 s), not a fixed 0.6 s */
  ok(d2 > 0, 'the Map still opens and draws boxes on its own (' + d2 + ')');
  await pg.close();

  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs[0] : ''));
  await b.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERR ' + (e && e.stack || e)); process.exit(1); });
