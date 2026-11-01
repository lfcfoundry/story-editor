/* ============================================================================
   STATS-CACHE-EQUIV: storyStats keeps each page's word count with the strings it was counted from (core.js klPageWords). Random stories are
   edited step by step (paragraph text, headings, choice wording, paragraphs and choices added and removed, pages added and removed, endings),
   and after every step the totals must equal a count made from scratch.
   Usage: node stats-cache-equiv.mjs     Exit code 1 on the first difference.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const ctx = createContext({ console });
runInContext(
  `${readFileSync(new URL("core.js", import.meta.url), "utf8")}\nthis.X = { storyStats };`,
  ctx,
);
const { storyStats } = ctx.X;
let seed = 11;
const rnd = (n) => (
  (seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff),
  (seed >>> 4) % n
);
const W =
  "the lantern stair keeper harbor tide rope door light window storm".split(
    " ",
  );
const text = () =>
  Array.from({ length: rnd(12) }, () => W[rnd(W.length)]).join(
    rnd(3) ? " " : "  \n ",
  );
let nid = 0;
const page = () => ({
  id: `p${nid++}`,
  name: "P",
  heading: rnd(3) ? "" : text(),
  ending: !rnd(5),
  valence: ["", "good", "bad"][rnd(3)],
  blocks: Array.from({ length: rnd(4) }, () => ({ text: text() })),
  choices: Array.from({ length: rnd(4) }, () => ({ label: text() })),
});
const fresh = (project) => {
  const n = (t) => (String(t || "").match(/\S+/g) || []).length;
  let words = n(project.title);
  project.passages.forEach((p) => {
    words += n(p.heading);
    p.blocks.forEach((b) => (words += n(b.text)));
    p.choices.forEach((c) => (words += n(c.label)));
  });
  return words;
};
let steps = 0;
for (let story = 0; story < 30; story++) {
  const project = {
    title: text(),
    items: [],
    givens: [],
    passages: Array.from({ length: 3 + rnd(30) }, page),
  };
  for (let k = 0; k < 60; k++) {
    const P = project.passages;
    const p = P[rnd(P.length)];
    switch (rnd(9)) {
      case 0:
        if (p.blocks.length)
          p.blocks[rnd(p.blocks.length)].text += rnd(2) ? " w" : "w";
        break;
      case 1:
        if (p.blocks.length) p.blocks[rnd(p.blocks.length)].text = text();
        break;
      case 2:
        p.heading = rnd(2) ? text() : "";
        break;
      case 3:
        if (p.choices.length) p.choices[rnd(p.choices.length)].label = text();
        break;
      case 4:
        rnd(2)
          ? p.blocks.splice(rnd(p.blocks.length + 1), 0, { text: text() })
          : p.blocks.splice(rnd(p.blocks.length), 1);
        break;
      case 5:
        rnd(2)
          ? p.choices.push({ label: text() })
          : p.choices.splice(rnd(p.choices.length), 1);
        break;
      case 6:
        P.splice(rnd(P.length + 1), 0, page());
        break;
      case 7:
        if (P.length > 1) P.splice(rnd(P.length), 1);
        break;
      default:
        if (p.blocks.length > 1)
          [p.blocks[0], p.blocks[1]] = [
            p.blocks[1],
            p.blocks[0],
          ]; /* two paragraphs change places */
    }
    const st = storyStats(project);
    const want = fresh(project);
    steps++;
    if (
      st.words !== want ||
      st.choices !== project.passages.reduce((s, q) => s + q.choices.length, 0)
    ) {
      console.log(
        `FAIL: story ${story}, step ${k}: storyStats says ${st.words} words, a fresh count ${want}`,
      );
      process.exit(1);
    }
  }
}
console.log(
  `stats-cache-equiv: ${steps} edits in 30 random stories, kept word counts equal fresh ones every time`,
);
