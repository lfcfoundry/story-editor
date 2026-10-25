/* Big maps draw only the boxes and arrows near the window (the rest as they scroll into view). This checks that such a map looks and behaves like one drawn
   all at once: the same key, search count, "arrows in / out" count, Tab order, the same boxes and arrows in the same order once everything is in, and a picture
   that matches (99.5% of pixel values or better) at the start and after scrolling to the far corner.
   Usage: node mapcull.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
process.env.SHOTS = '1'; // this suite compares pictures
const which = process.argv[2] || 'firefox';
const B = require('./engine').pick(which);
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || require('path').join(__dirname, '..', 'story-editor.html')).href;
let fails = 0;
const ok = (c, m) => {
  console.log((c ? 'PASS ' : 'FAIL ') + m);
  if (!c) fails++;
};
const N = 300;
/* a story of N pages, most choices leading a few pages on, a few leading anywhere, some pages giving objects (so arrows carry badges) */
const MK = `(([N,o,s])=>{let seed=7;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)&0x7fffffff;return seed/0x7fffffff;};const int=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const items=[];for(let i=0;i<o;i++)items.push({id:'o'+i,name:'O'+i,kind:'object',show:true});for(let i=0;i<s;i++)items.push({id:'t'+i,name:'T'+i,kind:'stat',show:true,lo:0,hi:5,start:2});
const passages=[];for(let i=0;i<N;i++)passages.push({id:'p'+i,name:'Page '+i,blocks:[{text:'x'+(i%7===0?' lamp':''),needs:[],forbid:[],orPrev:false}],gives:[],takes:[],choices:[],ending:i>N-6,valence:i>N-3?'good':'bad'});
passages.forEach((p,i)=>{if(o&&rnd()<0.25)p.gives=['o'+int(0,o-1)];if(p.ending)return;for(let k=int(2,3);k>0;k--){const to=rnd()<0.8?'p'+Math.min(N-1,i+int(1,8)):'p'+int(0,N-1);p.choices.push({label:'c'+k,to,needs:[],forbid:[],gives:rnd()<0.1?['o0']:[],takes:[]});}});
return JSON.stringify(normalizeProject({id:'s',title:'t',start:'p0',items,givens:[],passages,game:{}}));})`;
const SETTINGS = JSON.stringify({ chosen: true, remember: true, advanced: { write: true, map: true, items: true, game: true } });

/* the share of equal pixel values between two PNGs, worked out inside the page */
const pctSame = (pg, a, b) =>
  pg.evaluate(
    async ([x, y]) => {
      const load = async s => {
        const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const g = c.getContext('2d');
        g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, c.width, c.height);
      };
      const p = await load(x),
        q = await load(y);
      if (p.width !== q.width || p.height !== q.height) return -1;
      let same = 0,
        y0 = 1e9,
        y1 = -1,
        x0 = 1e9,
        x1 = -1;
      for (let i = 0; i < p.data.length; i++) {
        if (p.data[i] === q.data[i]) same++;
        else {
          const y = Math.floor(i / 4 / p.width);
          y0 = Math.min(y0, y);
          y1 = Math.max(y1, y);
          const x = (i / 4) % p.width;
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
        }
      }
      window.__diffRows = y1 < 0 ? 'none' : `rows ${y0} to ${y1}, columns ${Math.floor(x0)} to ${Math.floor(x1)}`;
      return (100 * same) / p.data.length;
    },
    [a.toString('base64'), b.toString('base64')]
  );

async function run(b, culled) {
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 }, locale: 'en-US' });
  const errs = [];
  const json = await (async () => {
    const t = await ctx.newPage();
    await t.goto(EDITOR);
    await t.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 30000 });
    const j = await t.evaluate(`(${MK})(${JSON.stringify([N, 8, 3])})`);
    await t.close();
    return j;
  })();
  await ctx.addInitScript(
    ([s, st, cull]) => {
      if (!cull) window.__mapCullMin = 1e9; // draw everything at once, as before
      if (!localStorage.getItem('qa-seeded')) {
        localStorage.setItem('qa-seeded', '1');
        localStorage.setItem('story-editor-v1-settings', st);
        localStorage.setItem('story-editor-v1', s);
      }
    },
    [json, SETTINGS, culled]
  );
  const pg = await ctx.newPage();
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(EDITOR);
  await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 30000 });
  const settle = () =>
    pg.waitForFunction(
      () => {
        const n = document.querySelectorAll('.mapbox g.node').length + document.querySelectorAll('.mapbox path.edge').length;
        if (window.__cnt === n) window.__same = (window.__same || 0) + 1;
        else {
          window.__cnt = n;
          window.__same = 0;
        }
        return window.__same > 8;
      },
      null,
      { polling: 50, timeout: 20000 }
    );
  /* a picture is taken only once two in a row are the same: a count of boxes that stopped changing does not prove the drawing is finished, and under load the window is drawn a little late */
  const still = async () => {
    let prev = Buffer.from(await pg.screenshot({}));
    for (let i = 0; i < 40; i++) {
      await pg.waitForTimeout(150);
      const now = Buffer.from(await pg.screenshot({}));
      if (now.equals(prev)) return now;
      prev = now;
    }
    return prev;
  };
  const r = { culled, errs };
  const t0 = Date.now();
  await pg.evaluate(() => __editor.setView('map'));
  await pg.waitForSelector('.mapbox g.node', { timeout: 20000 });
  r.firstNodes = await pg.evaluate(() => document.querySelectorAll('.mapbox g.node').length);
  await settle();
  r.settleMs = Date.now() - t0;
  r.nodesStart = await pg.evaluate(() => document.querySelectorAll('.mapbox g.node').length);
  r.edgesStart = await pg.evaluate(() => document.querySelectorAll('.mapbox path.edge').length);
  r.keyText = await pg.evaluate(() =>
    [...document.querySelectorAll('.fkey .keyitem')]
      .filter(e => !e.hidden)
      .map(e => e.textContent.trim())
      .join('|')
  );
  r.keyShown = await pg.evaluate(() => !!document.querySelector('.fkey') && !document.querySelector('.fkey').hidden);
  r.shot0 = await still();
  /* search count */
  await pg.locator('.maptools input').first().fill('lamp');
  await pg.waitForTimeout(400);
  await settle();
  r.search = await pg.evaluate(() => document.querySelector('.maptools .searchwrap .mapcount, .maptools .searchwrap span:last-child')?.textContent || '');
  r.searchBox = await pg.evaluate(() => [...document.querySelectorAll('.maptools .searchwrap *')].map(e => e.textContent.trim()).filter(Boolean).join('|'));
  await pg.locator('.maptools input').first().fill('');
  await pg.waitForTimeout(300);
  /* arrows in / out for the start page */
  await pg.evaluate(() => document.querySelector('.mapbox g.node.start').focus());
  await pg.waitForTimeout(200);
  r.lightText = await pg.evaluate(() => [...document.querySelectorAll('.maptools .searchwrap *')].map(e => e.textContent.trim()).filter(Boolean).join('|'));
  /* Tab order from the start page */
  const ids = [];
  for (let i = 0; i < 24; i++) {
    await pg.keyboard.press('Tab');
    ids.push(await pg.evaluate(() => document.activeElement?.getAttribute?.('data-id') || document.activeElement?.tagName));
  }
  r.tabIds = ids.join(',');
  await pg.evaluate(() => document.activeElement.blur());
  /* scrolled to the far corner */
  await pg.evaluate(() => {
    const bx = document.querySelector('.mapbox');
    bx.scrollLeft = bx.scrollWidth;
    bx.scrollTop = bx.scrollHeight;
  });
  await pg.waitForTimeout(200);
  await settle();
  r.shot1 = await still();
  /* the whole map (Fit zooms out until every box is in view) */
  await pg.locator('.maptools button:has-text("Fit")').click();
  await pg.waitForTimeout(300);
  await settle();
  /* even zoomed out as far as it goes the window may not show it all: walk the window over every part, then everything is in */
  const dims = await pg.evaluate(() => {
    const bx = document.querySelector('.mapbox');
    return { sw: bx.scrollWidth, sh: bx.scrollHeight, cw: bx.clientWidth, ch: bx.clientHeight };
  });
  for (let y = 0; y < dims.sh; y += Math.max(100, dims.ch - 100))
    for (let x = 0; x < dims.sw; x += Math.max(100, dims.cw - 100)) {
      await pg.evaluate(([a, c]) => { const bx = document.querySelector('.mapbox'); bx.scrollLeft = a; bx.scrollTop = c; }, [x, y]);
      await pg.waitForTimeout(80);
    }
  await pg.evaluate(() => { const bx = document.querySelector('.mapbox'); bx.scrollLeft = 0; bx.scrollTop = 0; });
  await pg.waitForTimeout(200);
  await settle();
  r.nodesAll = await pg.evaluate(() => [...document.querySelectorAll('.mapbox g.node')].map(e => e.getAttribute('data-id')).join(','));
  r.edgesAll = await pg.evaluate(() => [...document.querySelectorAll('.mapbox path.edge')].map(e => e.getAttribute('d')).join(';'));
  r.shot2 = await still();
  await ctx.close();
  return r;
}

(async () => {
  const b = await B.launch();
  console.log('browser: ' + which + ' ' + (b.version ? (typeof b.version === 'function' ? await b.version() : b.version) : ''));
  const full = await run(b, false);
  const part = await run(b, true);
  ok(full.errs.length === 0 && part.errs.length === 0, 'no page errors' + (full.errs.concat(part.errs).length ? ': ' + full.errs.concat(part.errs).join(' | ') : ''));
  ok(full.nodesStart >= N * 0.9, `drawn all at once: ${full.nodesStart} boxes, ${full.edgesStart} arrows`);
  ok(part.nodesStart < full.nodesStart * 0.6 && part.nodesStart > 10, `a big map draws only the part near the window: ${part.nodesStart} of ${full.nodesStart} boxes, ${part.edgesStart} of ${full.edgesStart} arrows`);
  ok(part.keyShown === full.keyShown && part.keyText === full.keyText && part.keyText.length > 20, `the key lists the same things: "${part.keyText}" against "${full.keyText}"`);
  ok(part.searchBox === full.searchBox && /match/.test(part.searchBox), `the search count covers the whole map: "${part.searchBox}" against "${full.searchBox}"`);
  ok(part.lightText === full.lightText && /arrow/.test(part.lightText), `the arrows in/out count is the same: "${part.lightText}" against "${full.lightText}"`);
  ok(part.tabIds === full.tabIds, `Tab visits the boxes in the same order: ${part.tabIds.slice(0, 80)}`);
  ok(part.nodesAll === full.nodesAll, `once everything is in, the same boxes in the same order (${part.nodesAll.split(',').length} against ${full.nodesAll.split(',').length})`);
  ok(part.edgesAll === full.edgesAll, `and the same arrows in the same order (${part.edgesAll.split(';').length} against ${full.edgesAll.split(';').length})`);
  const pg = await (await b.newContext({ viewport: { width: 400, height: 300 } })).newPage();
  await pg.goto('about:blank');
  const p0 = await pctSame(pg, part.shot0, full.shot0);
  const p1 = await pctSame(pg, part.shot1, full.shot1);
  const p2 = await pctSame(pg, part.shot2, full.shot2);
  console.log('where the last pictures differ: ' + (await pg.evaluate(() => window.__diffRows)) + ' of a 1200 by 850 picture');
  console.log(`pictures identical: start ${p0.toFixed(3)}%, far corner ${p1.toFixed(3)}%, whole map ${p2.toFixed(3)}%`);
  ok(p0 >= 99.5 && p1 >= 99.5 && p2 >= 99.5, 'pictures match at 99.5% or better');
  console.log(`first boxes on screen: ${part.firstNodes} (vs ${full.firstNodes}); settled in ${part.settleMs} ms (vs ${full.settleMs} ms, includes waiting)`);
  await b.close();
  console.log(fails ? `${fails} FAIL` : 'all pass');
  process.exit(fails ? 1 : 0);
})().catch(e => {
  console.error(e);
  process.exit(2);
});
