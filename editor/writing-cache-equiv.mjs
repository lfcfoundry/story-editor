/* ============================================================================
   WRITING-CACHE-EQUIV: writingChecks keeps each page's part between calls (helpers.js WRITE_CACHE). Random stories with names spelled two
   ways, words typed twice, overused words, long paragraphs and choices that read alike are edited step by step (text, page names, choice
   wording, endings, new and removed pages, other limits and ignore lists), and after every step the cached answer must equal the uncached one.
   Usage: node writing-cache-equiv.mjs     Exit code 1 on the first difference.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const ctx = createContext({});
runInContext(`${readFileSync(new URL('helpers.js', import.meta.url), 'utf8')}\nthis.X = { writingChecks };`, ctx);
const { writingChecks } = ctx.X;
let seed = 5;
const rnd = n => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed % n);
const WORDS = 'the lantern stair keeper harbor Marla Marta Marlo Tobin Tobyn tide nerve rope rope door that had light lighthouse window storm storm'.split(' ');
const sentence = () => {
  const n = 3 + rnd(30);
  const w = [];
  for (let i = 0; i < n; i++) w.push(WORDS[rnd(WORDS.length)]);
  return `${w.join(' ')}.`;
};
const para = () => Array.from({ length: 1 + rnd(rnd(4) ? 3 : 12) }, sentence).join(' ');
const LABELS = ['Go up the stair', 'Go up the stairs', 'Climb the stair', 'Open the door', 'Open the old door', 'Wait', 'Run to the harbor'];
let nid = 0;
const page = () => ({ id: `p${nid++}`, name: `Page ${WORDS[rnd(WORDS.length)]}`, ending: !rnd(6), blocks: Array.from({ length: 1 + rnd(3) }, () => ({ text: para() })), choices: Array.from({ length: rnd(4) }, () => ({ label: LABELS[rnd(LABELS.length)] })) });
let steps = 0;
for (let story = 0; story < 30; story++) {
  const project = { passages: Array.from({ length: 5 + rnd(40) }, page) };
  let lim = { para: 150, page: 600, wpm: 230, ignore: new Set() };
  for (let k = 0; k < 40; k++) {
    const P = project.passages;
    const p = P[rnd(P.length)];
    switch (rnd(9)) {
      case 0: p.blocks[rnd(p.blocks.length)].text += rnd(2) ? ' storm storm' : ' Marla'; break;
      case 1: p.blocks[0].text = para(); break;
      case 2: p.name = `Page ${WORDS[rnd(WORDS.length)]}`; break;
      case 3: if (p.choices.length) p.choices[rnd(p.choices.length)].label = LABELS[rnd(LABELS.length)]; break;
      case 4: p.ending = !p.ending; break;
      case 5: P.splice(rnd(P.length + 1), 0, page()); break;
      case 6: if (P.length > 2) P.splice(rnd(P.length), 1); break;
      case 7: lim = { ...lim, para: 20 + rnd(150), page: 100 + rnd(600), wpm: 100 + rnd(200) }; break;
      default: {
        const all = writingChecks(project, lim, null);
        lim = { ...lim, ignore: new Set(all.filter(() => !rnd(3)).map(x => x.key)) };
      }
    }
    const a = JSON.stringify(writingChecks(project, lim));
    const b = JSON.stringify(writingChecks(project, lim, null));
    steps++;
    if (a !== b) {
      console.log(`FAIL: story ${story}, step ${k}: the cached writing checks differ from the uncached ones`);
      process.exit(1);
    }
  }
}
console.log(`writing-cache-equiv: ${steps} edits in 30 random stories, cached writing checks equal the uncached ones every time`);
