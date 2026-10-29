/* The landing page (about.html): no errors, nothing fetched, fits phone and laptop in light and dark, links are well formed and the package pages it names exist.
   Usage: node landing.js [firefox|chromium|webkit]   SHOTS=1 keeps pictures in work/shots. Copyright (c) 2026 LFC Foundry. MIT License. */
const which = process.argv[2] || 'firefox';
const B = require('./engine').pick(which);
const fs = require('fs');
const path = require('path');
const FILE = require('url').pathToFileURL(process.env.QA_LANDING || path.join(__dirname, '..', '..', 'about.html')).href;
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
(async () => {
  const b = await B.launch();
  for (const [name, vp] of [['laptop', { width: 1280, height: 800 }], ['phone', { width: 390, height: 780 }]]) {
    for (const theme of ['light', 'dark']) {
      const ctx = await b.newContext({ viewport: vp });
      const pg = await ctx.newPage();
      const errs = [], reqs = [];
      pg.on('pageerror', e => errs.push(e.message));
      pg.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
      await pg.goto(FILE);
      await pg.evaluate(t => { document.documentElement.dataset.theme = t; }, theme);
      await pg.waitForTimeout(200);
      const m = await pg.evaluate(() => {
        const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
        const h1 = document.querySelector('h1');
        const mods = [...document.querySelectorAll('.mod')].map(a => a.getAttribute('href'));
        const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href'));
        const cut = [...document.querySelectorAll('.tile,.mod,.btn')].filter(e => e.scrollWidth > e.clientWidth + 1).length;
        return { h1: h1 && h1.textContent, h1vis: h1 && vis(h1), sw: document.documentElement.scrollWidth, iw: innerWidth, mods, links, cut, lang: document.documentElement.lang, title: document.title, h2s: [...document.querySelectorAll('h2')].map(e => e.textContent), rows: document.querySelectorAll('tbody tr').length, cells: [...document.querySelectorAll('td.win')].map(e => e.textContent), btns: [...document.querySelectorAll('.hero .btn')].map(a => [a.textContent, a.getAttribute('href'), vis(a)]) };
      });
      const tag = `${name}, ${theme}`;
      ok(errs.length === 0, `${tag}: no page errors${errs.length ? ': ' + errs.join(' | ') : ''}`);
      ok(reqs.length === 0, `${tag}: nothing is fetched from the network${reqs.length ? ': ' + reqs.join(' ') : ''}`);
      ok(m.h1 === 'Story Editor' && m.h1vis, `${tag}: the heading shows`);
      ok(m.sw <= m.iw, `${tag}: no sideways scroll (${m.sw} in ${m.iw})`);
      ok(m.cut === 0, `${tag}: no tile, link or button is cut off (${m.cut})`);
      if (name === 'laptop' && theme === 'light') {
        ok(m.lang === 'en' && m.title === 'Story Editor', 'page language and title are set');
        ok(m.btns.length === 3 && m.btns.every(x => x[2]) && m.btns[0][1] === 'https://lfcfoundry.github.io/story-editor/' && m.btns[1][1] === 'examples/the-keepers-light.html', 'the three hero buttons show, the first opens the editor and the second plays the example: ' + JSON.stringify(m.btns));
        const root0 = path.join(__dirname, '..', '..');
        const rel = m.links.filter(h => !/^https:/.test(h));
        ok(m.links.filter(h => /^https:/.test(h)).every(h => /^https:\/\/(lfcfoundry\.github\.io\/|github\.com\/lfcfoundry(\/|$))/.test(h)), 'every web link goes to the project or its pages');
        ok(rel.length >= 3 && rel.every(h => /^examples\/[a-z.-]+$/.test(h) && fs.existsSync(path.join(root0, h))), 'every other link is an example file that exists: ' + rel.join(' '));
        ok(m.h2s.join('|') === 'What it is and how it works|By the numbers|Objects and states|Advanced features|A checker that plays every route|Why it exists|Try an example story|Packages you can reuse', 'the sections come in the expected order: ' + m.h2s.join(' | '));
        ok(m.rows >= 6 && m.cells.every(c => /^\d/.test(c)), 'the numbers table has its rows and every measurement starts with a number (' + m.rows + ' rows)');
        const root = path.join(__dirname, '..', '..');
        const missing = m.mods.map(h => (/packages\/([a-z-]+)\/README\.md$/.exec(h) || [])[1]).filter(n => !n || !fs.existsSync(path.join(root, 'packages', n, 'README.md')));
        ok(m.mods.length === 8 && missing.length === 0, `the ${m.mods.length} package tiles name packages that exist${missing.length ? ' (missing: ' + missing.join(',') + ')' : ''}`);
        const rd = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
        ok(/story-editor\/about\.html/.test(rd), 'the README links to the landing page');
      }
      if (process.env.SHOTS) await pg.screenshot({ path: path.join(__dirname, 'work', 'shots', `landing-${name}-${theme}.png`), fullPage: true });
      await ctx.close();
    }
  }
  /* the example games open and play: one choice taken, nothing fetched, no errors */
  for (const f of ['the-keepers-light', 'the-drowned-archive']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 780 } });
    const pg = await ctx.newPage();
    const errs = [], reqs = [];
    pg.on('pageerror', e => errs.push(e.message));
    pg.on('request', r => { if (!/^(file|data|blob):/.test(r.url())) reqs.push(r.url()); });
    await pg.goto(require('url').pathToFileURL(path.join(__dirname, '..', '..', 'examples', f + '.html')).href);
    await pg.waitForTimeout(1500);
    const before = await pg.evaluate(() => document.body.innerText.slice(0, 300));
    await pg.click('button >> nth=0');
    await pg.waitForTimeout(500);
    const after = await pg.evaluate(() => document.body.innerText.slice(0, 300));
    ok(errs.length === 0 && reqs.length === 0 && before.length > 40 && before !== after, `example game ${f}: opens, one choice moves the story, no errors, nothing fetched`);
    await ctx.close();
  }
  await b.close();
  console.log(fails ? fails + ' FAILED' : 'all passed');
  process.exit(fails ? 1 : 0);
})();
