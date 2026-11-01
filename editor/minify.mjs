/* Shrinks the editor's own script and styles for the finished file: comments, spacing and the names of local variables and parameters
   (measured 2026-10-14: 551,832 -> 509,265 bytes plain, 229,939 -> 224,159 packed). Top-level names (functions, constants, the kl* rules) stay
   as they are, because esbuild never renames them in a plain script: the exported games copy the rule functions by their text and the error log
   in the Speed report names the functions an error passed through. Structure is unchanged (no syntax rewriting).
   Characters outside ASCII are written as escapes (charset: 'ascii'): one character above U+00FF anywhere in a page makes Chromium keep the
   whole page's text at 2 bytes per character (round 33, 2026-10-31); the escape means exactly the same character.
   Usage: node minify.mjs js|css < input > output.
   build.py runs it unless the environment variable STORY_READABLE is set (handy when hunting a bug in the browser). */
import { transformSync } from 'esbuild';
import { readFileSync } from 'node:fs';

const kind = process.argv[2];
const source = readFileSync(0, 'utf8');
const out =
  kind === 'css'
    ? transformSync(source, { loader: 'css', minify: true, charset: 'ascii', target: ['chrome98', 'safari15', 'firefox98'] }).code
    : transformSync(source, { minifyWhitespace: true, minifyIdentifiers: true, charset: 'ascii', target: 'es2020', legalComments: 'none' }).code;
/* esbuild leaves regular expression literals as they are; a \u escape means the same character there too (a character above U+FFFF as its two
   halves, which is what a pattern without the u flag sees anyway, and a pair a u-flag pattern reads as one) */
if (/\\[^\x00-\x7f]/.test(out)) throw new Error('a backslash stands right before a character outside ASCII; an escape there would change its meaning');
process.stdout.write(out.replace(/[^\x00-\xff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')));
