/* The example stories read well: no sentence is said twice on one page, and no page shares a sentence with a page you can step to from it.
   (Repetition is allowed in stories people write; the examples are the ones we show off.) Checks The Keeper's Light (examples/ .story.json)
   and The Drowned Archive (built by editor/massive.js). `--write` also refreshes examples/the-drowned-archive.story.json from massive.js.
   Usage: node tools/example-prose.mjs [--write]. Copyright (c) 2026 LFC Foundry. MIT License. */
import { readFileSync, writeFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url).pathname;
const sandbox = {};
vm.runInNewContext(readFileSync(root + 'editor/massive.js', 'utf8') + '\nthis.massiveExample = massiveExample;', sandbox);
const stories = {
  'The Keeper’s Light': JSON.parse(readFileSync(root + 'examples/the-keepers-light.story.json', 'utf8')),
  'The Drowned Archive': sandbox.massiveExample()
};
if (process.argv.includes('--write')) writeFileSync(root + 'examples/the-drowned-archive.story.json', JSON.stringify(stories['The Drowned Archive']));

/* a sentence with the block that says it; two blocks that can never show together (one needs what the other forbids, or one is the "otherwise" of the other) may repeat each other */
const lines = p => { let chain = -1; return (p.blocks || []).flatMap(b => { if (!b.orPrev) chain++; b = Object.assign({ chain }, b); return (b.text || '').split(/(?<=[.!?”"])\s+/).map(t => t.trim()).filter(t => t.length >= 25).map(t => ({ t, b })); }); };
const exclusive = (x, y) => x.chain === y.chain || (x.needs || []).some(n => (y.forbid || []).includes(n)) || (y.needs || []).some(n => (x.forbid || []).includes(n));
let bad = 0;
for (const [title, st] of Object.entries(stories)) {
  const byId = new Map(st.passages.map(p => [p.id, p]));
  const sent = new Map(st.passages.map(p => [p.id, lines(p)]));
  const found = [];
  for (const p of st.passages) {
    const mine = sent.get(p.id);
    mine.forEach((x, i) => { if (mine.some((y, j) => j > i && y.t === x.t && !exclusive(x.b, y.b))) found.push(`"${p.name}" says "${x.t}" twice`); });
    for (const c of p.choices || []) {
      if (!byId.has(c.to) || c.to === p.id) continue;
      const seen = new Set();
      for (const x of mine) if (!seen.has(x.t) && sent.get(c.to).some(y => y.t === x.t)) { seen.add(x.t); found.push(`"${p.name}" and the page "${byId.get(c.to).name}" it leads to both say "${x.t}"`); }
    }
  }
  console.log(`${found.length ? 'FAIL' : 'pass'}  ${title}: ${found.length} repeated sentence${found.length === 1 ? '' : 's'}`);
  found.slice(0, 8).forEach(f => console.log('        ' + f));
  if (found.length > 8) console.log(`        ...and ${found.length - 8} more`);
  bad += found.length;
}
process.exit(bad ? 1 : 0);
