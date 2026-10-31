/* ============================================================================
   UNDO-DELTA-EQUIV: the undo list keeps only the newest step whole and older steps as differences (ui1-state.js pushUndo / popUndo /
   undoText). Random stories of text are pushed and popped in random order next to a plain list of whole copies, with a small budget so old
   steps are dropped too: every popped text, every rebuilt text and the kept steps must be exactly the plain list's.
   Usage: node undo-delta-equiv.mjs     Exit code 1 on the first difference.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const src = readFileSync(new URL('ui1-state.js', import.meta.url), 'utf8');
const part = src.slice(src.indexOf('/* Only the newest undo snapshot'), src.indexOf('/* ----- the story as text, rewritten one page'));
if (!/function undoText/.test(part) || !/function popUndo/.test(part)) throw new Error('undo code not found in ui1-state.js');
const ctx = createContext({});
runInContext(`const UNDO_STEPS = 40, UNDO_BYTES = 300000; const undoStack = []; let undoBytes = 0;\n${part}\nthis.X = { pushUndo, popUndo, undoText, undoStack, undoDelta, undoApply, bytes: () => undoBytes };`, ctx);
const X = ctx.X;

let seed = 11;
const rnd = n => ((seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff), seed % n);
const fail = m => {
  console.error(`FAIL ${m}`);
  process.exit(1);
};
/* 1. one difference at a time, any place and size (chunk edges included) */
for (let t = 0; t < 3000; t++) {
  const L = rnd(3) ? rnd(20000) : rnd(50);
  let s = '';
  for (let i = 0; i < L; i++) s += 'ab{"c'[rnd(5)];
  const i = rnd(L + 1),
    j = i + rnd(L - i + 1);
  const next = s.slice(0, i) + (rnd(2) ? '' : 'xy"z'.repeat(rnd(800))) + s.slice(j);
  const d = X.undoDelta(s, next);
  if (X.undoApply(next, d) !== s || d.a + d.b > Math.min(s.length, next.length)) fail(`difference ${t} does not rebuild the old text`);
}
/* 2. the whole list against plain copies, with the same budget rule */
const plain = [];
let plainBytes = 0,
  text = 'x'.repeat(5000),
  steps = 0;
for (let t = 0; t < 8000; t++) {
  if (rnd(3)) {
    const at = rnd(text.length + 1);
    const big = rnd(40) === 0; // now and then a whole new story (Open, New story), otherwise a small edit somewhere
    const add = 'word '.repeat(big ? 5000 : 80).slice(0, big ? rnd(25000) : rnd(300) + 1);
    text = text.slice(0, at) + add + text.slice(Math.min(text.length, at + (big || text.length > 40000 ? rnd(30000) : rnd(250))));
    X.pushUndo({ s: text, e: 0, t });
    plain.push(text);
    plainBytes += text.length;
    while (plain.length > 40 || (plainBytes > 300000 && plain.length > 1)) plainBytes -= plain.shift().length;
    steps++;
  } else if (plain.length) {
    const a = X.popUndo().s,
      b = plain.pop();
    plainBytes -= b.length;
    if (a !== b) fail(`pop ${t} gave a different text`);
    text = a;
  }
  if (X.undoStack.length !== plain.length || X.bytes() !== plainBytes) fail(`step ${t}: ${X.undoStack.length} steps kept, plain ${plain.length}`);
  if (t % 97 === 0) for (let i = 0; i < plain.length; i++) if (X.undoText(i) !== plain[i]) fail(`step ${t}: snapshot ${i} rebuilds wrong`);
}
console.log(`ok: 3000 single differences and ${steps} undo steps over 8000 pushes and pops rebuild exactly, and the same steps are kept`);
