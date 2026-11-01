/* The page the site serves at /play/ (play/index.html) must be the editor this commit builds. It is run by npm test: the served page's own
   two scripts run in a bare Node sandbox (as lzma_pack.py's self-check does: no WebAssembly, so its JavaScript decoder unpacks), and the page
   they write must be exactly editor/story-editor.plain.html. If the editor was also built here (editor/story-editor.html, not kept in git),
   the two files must be the same bytes too. build.py writes all three; this catches a commit that left one behind.
   Usage: node tools/play-check.mjs    Copyright (c) 2026 LFC Foundry. MIT License. */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url).pathname;
const served = readFileSync(root + 'play/index.html');
const plain = readFileSync(root + 'editor/story-editor.plain.html', 'utf8');
let bad = 0;
const say = (ok, m) => { console.log((ok ? 'ok   ' : 'FAIL ') + m); if (!ok) bad++; };

const scripts = [...served.toString('latin1').matchAll(/<script>(.*?)<\/script>/gs)].map(m => Buffer.from(m[1], 'latin1').toString('utf8'));
say(scripts.length === 2, `play/index.html holds the packed editor's two scripts (found ${scripts.length})`);
if (scripts.length === 2) {
  const q = [], doc = { written: null, body: { textContent: '' }, open() {}, write(t) { this.written = (this.written ?? '') + t; }, close() {} };
  const ctx = vm.createContext({ document: doc, setTimeout(f) { q.push(f); return 0; }, requestAnimationFrame(f) { q.push(f); return 0; }, atob: globalThis.atob, TextDecoder });
  vm.runInContext('var window = this;', ctx);
  try { scripts.forEach(s => vm.runInContext(s, ctx)); while (q.length) q.shift()(); } catch (e) { doc.body.textContent = String(e); }
  say(!doc.body.textContent, 'it unpacks' + (doc.body.textContent ? ': ' + doc.body.textContent.slice(0, 80) : ''));
  say(doc.written === plain, `and the page it writes is exactly editor/story-editor.plain.html (${doc.written?.length ?? 0} and ${plain.length} characters)` + (doc.written === plain ? '' : '. Run "python3 build.py" in editor/ and commit play/index.html with the other built files.'));
}
if (existsSync(root + 'editor/story-editor.html')) say(Buffer.compare(readFileSync(root + 'editor/story-editor.html'), served) === 0, 'play/index.html is the same bytes as the editor built here (editor/story-editor.html)');
process.exit(bad ? 1 : 0);
