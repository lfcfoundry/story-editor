/* After an edit, a big story is checked in a background worker (ui4-views.js, checkInWorker; the code is checkworker.js). Checks, in the real page under its own policy:
   with the worker forced on, an edit is answered by it and the answer equals the page's own check (problems, warnings, endings, counts); the explainers the worker cannot
   send (samples, why, explain, canArrive) still answer, equal to the page's; two quick edits leave the answer for the last story; the switch window.__checkWorker=false
   turns it off; a browser that refuses workers falls back to the page check; and a story that checks fast starts no worker by itself.
   Usage: node checkworker.js [chromium|firefox|webkit]   Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox'; const B = require('./engine').pick(which);
const path = require('path');
const EDITOR = require('url').pathToFileURL(process.env.QA_EDITOR || path.join(__dirname, '..', 'story-editor.html')).href;
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
/* a seeded story with objects, states, numbers and dice checks, so the check has real work (and the WebAssembly walk) */
const mkSrc = `(([N])=>{let seed=11+N;const rnd=()=>{seed=(Math.imul(seed,1103515245)+12345)&0x7fffffff;return seed/0x7fffffff;};const int=(a,b)=>a+Math.floor(rnd()*(b-a+1));
const items=[];for(let i=0;i<6;i++)items.push({id:'o'+i,name:'O'+i,kind:i%3===2?'state':'object',show:true});for(let i=0;i<2;i++)items.push({id:'t'+i,name:'T'+i,kind:'stat',show:true,lo:0,hi:5,start:2});
const passages=[];for(let i=0;i<N;i++)passages.push({id:'p'+i,name:'Page '+i,blocks:[{text:'x',needs:[],forbid:[],orPrev:false}],gives:rnd()<0.2?['o'+int(0,5)]:[],takes:rnd()<0.05?['o'+int(0,5)]:[],choices:[],ending:i>N-4});
passages.forEach((p,i)=>{if(p.ending)return;for(let k=int(2,3);k>0;k--){const c={label:'c'+k+p.id,to:'p'+(rnd()<0.8?Math.min(N-1,i+int(1,6)):int(0,N-1)),needs:[],forbid:[],gives:[],takes:[],adds:{},check:null,lock:false,why:''};
if(rnd()<0.2)c.needs=['o'+int(0,5)];if(rnd()<0.1)c.gives=['o'+int(0,5)];if(rnd()<0.2)c.adds['t'+int(0,1)]=int(-2,2);if(rnd()<0.15)c.check={stat:'t'+int(0,1),target:int(2,12),fail:'p'+int(0,N-1)};p.choices.push(c);}});
return JSON.stringify(normalizeProject({id:'s',title:'t',start:'p0',items,givens:[],passages,game:{}}));})`;
const SUMMARY = `(() => { const E = __editor, a = E.analysis, f = E.checkFresh(); const pick = r => JSON.stringify({ p: r.problems, w: r.warnings, e: r.endings, s: r.states, g: r.grouped, pr: r.pruned, t: r.truncated });
  const pid = E.project.passages[E.project.passages.length - 2].id;
  return { same: pick(a) === pick(f), ex: JSON.stringify(a.explain(pid)) === JSON.stringify(f.explain(pid)), sm: JSON.stringify(a.samples(pid, 1)) === JSON.stringify(f.samples(pid, 1)), why: JSON.stringify(a.why(pid)) === JSON.stringify(f.why(pid)), states: a.states }; })()`;
(async () => {
  const b = await B.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1200, height: 850 } });
  const open = async (n, init) => {
    const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await pg.addInitScript(() => { try { localStorage.setItem('story-editor-v1-toured', '1'); } catch (e) {} });
    if (init) await pg.addInitScript(init);
    await pg.goto(EDITOR); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 30000 });
    const json = await pg.evaluate(`(${mkSrc})([${n}])`);
    await pg.evaluate(j => localStorage.setItem('story-editor-v1', j), json);
    await pg.reload(); await pg.waitForFunction(() => window.__editor && !document.getElementById('splash'), null, { timeout: 30000 });
    await pg.waitForFunction(() => __editor.analysis, null, { timeout: 15000 });
    return pg;
  };
  const edit = (pg, i) => pg.evaluate(i => { const E = __editor; E.project.passages[i].blocks[0].text += ' more'; E.refresh(); }, i);
  const waitDone = (pg, n) => pg.waitForFunction(n => __editor.checkPre.done >= n, n, { timeout: 15000 }).then(() => true, () => false);

  /* forced on: the worker answers and it is the page's answer */
  let pg = await open(120, () => { window.__checkHybridMs = 0; });
  await edit(pg, 3);
  ok(await waitDone(pg, 1), 'with the worker forced on, an edit is answered by the worker');
  ok(await pg.evaluate(() => __editor.checkPre.posted >= 1), 'a check was sent to the worker');
  let r = await pg.evaluate(SUMMARY);
  ok(r.same, 'the worker answer (problems, warnings, endings, counts) equals the page check');
  ok(r.ex && r.sm && r.why, 'the explainers made on request (explain, samples, why) equal the page ones');
  ok(r.states > 0, 'the story has situations to check: ' + r.states);
  await pg.waitForFunction(() => { const el = document.querySelector('#statusline'); return el && el.textContent.trim() && !/Checking/.test(el.textContent); }, null, { timeout: 5000 }).then(() => ok(true, 'the status line is not left on "Checking" once the worker answers'), () => ok(false, 'the status line stays on "Checking" or is empty'));
  /* two quick edits: the answer is for the last story */
  await edit(pg, 4); await edit(pg, 5);
  ok(await waitDone(pg, 2), 'after two quick edits an answer comes');
  await pg.waitForFunction(() => { const E = __editor; return E.checkPre.done >= 2; });
  r = await pg.evaluate(SUMMARY);
  ok(r.same, 'and it is the answer for the story as it is now');
  /* the explainers still work when the story changes between the answer and the question */
  /* the Check tab opens from the same result and agrees */
  await pg.evaluate(() => __editor.setView('check'));
  ok(await pg.evaluate(SUMMARY).then(x => x.same), 'the Check tab shows the same check');
  await pg.close();

  /* switched off */
  pg = await open(120, () => { window.__checkHybridMs = 0; window.__checkWorker = false; });
  await edit(pg, 3); await new Promise(r => setTimeout(r, 1200));
  ok(await pg.evaluate(() => __editor.checkPre.posted === 0), 'window.__checkWorker=false sends nothing to the worker');
  ok((await pg.evaluate(SUMMARY)).same, 'and the page check is current');
  await pg.close();

  /* no workers here: the page checks for itself */
  pg = await open(120, () => { window.__checkHybridMs = 0; window.Worker = function () { throw new Error('no workers'); }; });
  await edit(pg, 3); await new Promise(r => setTimeout(r, 1200));
  ok(await pg.evaluate(() => __editor.checkPre.bad === true), 'a browser that refuses workers is noted');
  ok((await pg.evaluate(SUMMARY)).same, 'and the page check still gives the answer');
  await pg.close();

  /* a small story checks fast: no worker of its own accord */
  pg = await open(12, () => { window.__checkHybridMs = 1000; }); // a loaded machine can make even a small check slow, so the limit is set well above any real check
  await edit(pg, 3); await new Promise(r => setTimeout(r, 1200));
  ok(await pg.evaluate(() => __editor.checkPre.posted === 0), 'a check under the limit starts no worker');
  ok((await pg.evaluate(SUMMARY)).same, 'and is checked on the page');
  await pg.close();

  ok(errs.length === 0, 'no errors in the page' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  console.log(fails ? `${fails} FAILED` : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FAIL ' + (e && e.stack || e)); process.exit(1); });
