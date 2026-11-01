/* ============================================================================
   HELPERS: two offline writing helpers that read only text the author already has or pastes in.
     parseOutline   an indented outline becomes pages and choices (File → Paste an outline…); outlinePlan and outlineToProject put them into a story
     writingChecks  repeated words, names spelled two ways, very long paragraphs and pages, choices that read alike
   Pure functions over plain data: nothing here touches the screen, the story or the network.
   Copyright (c) 2026 LFC Foundry. MIT License.
   ============================================================================ */

/* ----- paste an outline ----- */

const OUTLINE_MAX_LINES = 3000;
const OUTLINE_NAME_MAX = 80;
const OUTLINE_ARROW = /\s*(?:→|->|=>)\s*/;

/**
 * Reads an outline:
 *   a line at the left edge is a page (optionally ending "(ending)", "(good ending)" or "(bad ending)");
 *   an indented line under it with an arrow, "Choice text → Page name", is a choice;
 *   any other indented line is a paragraph of that page.
 * Bullets and numbers in front of a line ("- ", "* ", "1. ") are ignored, tabs count as four spaces, blank lines and lines starting with # are skipped.
 * Returns { pages, issues, lines } where pages are { name, ending, valence, texts[], choices[{ label, to }] } in order, `to` being a page name ('' = nowhere yet).
 * Never throws; things that could not be used are listed in `issues` in plain words.
 */
function parseOutline(text) {
  const issues = [];
  const raw = String(text || '').replace(/^﻿/, '').split(/\r\n|\r|\n/);
  let lines = raw.map((s, i) => ({ n: i + 1, s: s.replace(/\t/g, '    ') })).filter(x => x.s.trim() && !/^\s*#/.test(x.s));
  if (lines.length > OUTLINE_MAX_LINES) {
    issues.push(`Only the first ${OUTLINE_MAX_LINES} lines were read; the other ${lines.length - OUTLINE_MAX_LINES} were left out.`);
    lines = lines.slice(0, OUTLINE_MAX_LINES);
  }
  const indentOf = s => s.length - s.trimStart().length;
  const base = lines.length ? Math.min(...lines.map(x => indentOf(x.s))) : 0;
  const clean = s => s.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '').trim();
  const pages = [];
  const byName = Object.create(null);
  let page = null;
  lines.forEach(({ n, s }) => {
    const body = clean(s);
    if (!body) return;
    if (indentOf(s) <= base) {
      let name = body;
      let ending = false;
      let valence = '';
      const m = /\s*\((?:(good|bad)\s+)?(?:ending|end)\)\s*$/i.exec(name);
      if (m) {
        ending = true;
        valence = (m[1] || '').toLowerCase();
        name = name.slice(0, m.index).trim();
      }
      if (name.length > OUTLINE_NAME_MAX) {
        issues.push(`Line ${n}: a page name over ${OUTLINE_NAME_MAX} letters was shortened.`);
        name = name.slice(0, OUTLINE_NAME_MAX).trim();
      }
      if (!name) {
        issues.push(`Line ${n}: a page with no name was skipped, with the lines under it.`);
        page = null;
        return;
      }
      const key = name.toLowerCase();
      if (byName[key]) {
        page = byName[key];
        issues.push(`Line ${n}: the page “${name}” is listed twice, so its lines were joined.`);
        if (ending) {
          page.ending = true;
          page.valence = valence || page.valence;
        }
        return;
      }
      page = { name, ending, valence, texts: [], choices: [] };
      byName[key] = page;
      pages.push(page);
      return;
    }
    if (!page) return; // under a skipped page
    const parts = body.split(OUTLINE_ARROW);
    if (parts.length >= 2) {
      const to = parts.pop().trim().slice(0, OUTLINE_NAME_MAX);
      const label = parts.join(' → ').trim();
      if (!label) {
        issues.push(`Line ${n}: a choice with no words on it was skipped.`);
        return;
      }
      if (!to) issues.push(`Line ${n}: the choice “${label}” leads nowhere yet.`);
      page.choices.push({ label, to });
    } else page.texts.push(body);
  });
  if (!pages.length && lines.length) issues.push('No pages were found. Write each page name at the left edge, its choices indented under it.');
  return { pages, issues, lines: lines.length };
}

/**
 * Turns what parseOutline read into the pages to add to the story `proj`: names made unique, choices pointed at pages, endings given no choices.
 * Returns { pages, empties, blank, issues }: `pages` are the new pages, `empties` the pages named only in a choice, `blank` the story's
 * untouched first page if it is to be replaced (the caller removes it and starts the story at pages[0]), `issues` plain-words notes.
 * Nothing in `proj` is changed.
 */
function outlinePlan(parsed, proj) {
  const issues = parsed.issues.slice();
  const taken = new Set(proj.passages.map(p => outlineName(p).trim().toLowerCase()));
  const blank = proj.passages.length === 1 && isBlankPage(proj.passages[0]) ? proj.passages[0] : null;
  if (blank) taken.delete(outlineName(blank).trim().toLowerCase());
  const made = new Map(); // outline name (lowercase) -> the page to make
  const create = [];
  parsed.pages.forEach(op => {
    let name = op.name;
    let n = 2;
    while (taken.has(name.toLowerCase())) name = `${op.name} ${n++}`;
    if (name !== op.name) issues.push(`A page called “${op.name}” is already in the story, so the new one is named “${name}”.`);
    taken.add(name.toLowerCase());
    const p = makePassage(name);
    if (op.texts.length) p.blocks = op.texts.map(makeBlock);
    if (op.ending) {
      p.ending = true;
      p.valence = op.valence;
      if (op.choices.length) issues.push(`“${op.name}” is an ending, so its ${op.choices.length === 1 ? 'choice was' : 'choices were'} left out.`);
    }
    made.set(op.name.toLowerCase(), p);
    create.push({ p, op });
  });
  const existing = new Map(proj.passages.filter(p => p !== blank).map(p => [outlineName(p).trim().toLowerCase(), p]));
  const empties = []; // pages named only in a choice
  create.forEach(({ p, op }) => {
    if (p.ending) return;
    op.choices.forEach(c => {
      let dest = '';
      if (c.to) {
        const key = c.to.toLowerCase();
        const target = made.get(key) || existing.get(key) || empties.find(e => e.name.toLowerCase() === key);
        if (target) dest = target.id;
        else {
          const e = makePassage(c.to);
          empties.push(e);
          dest = e.id;
        }
      }
      p.choices.push(makeChoice(c.label, dest));
    });
  });
  if (empties.length) issues.push(`${empties.length === 1 ? 'A page is' : `${empties.length} pages are`} named in a choice but not written yet, so ${empties.length === 1 ? 'it was' : 'they were'} added empty: ${empties.slice(0, 5).map(e => `“${e.name}”`).join(', ')}${empties.length > 5 ? ', …' : ''}.`);
  return { pages: create.map(x => x.p), empties, blank, issues };
}

/** A page with nothing written on it (the one a new story starts with). */
function isBlankPage(p) {
  return !p.blocks.some(b => String(b.text).trim()) && !p.choices.length && !p.ending && !p.todo && !p.note && !p.heading && !p.gives.length && !p.takes.length;
}

/** A page's name, or a stand-in if it is blank. */
function outlineName(p) {
  return (p && p.name) || 'Untitled page';
}

/**
 * A new story from an outline, in one call: { project, issues }. The outline's first page is the start page. Needs the story model
 * (makeProject and friends) from core.js. Never throws on odd text; `issues` says what could not be used, and `project` is
 * null if the outline holds no pages.
 */
function outlineToProject(text, title) {
  const parsed = parseOutline(text);
  if (!parsed.pages.length) return { project: null, issues: parsed.issues };
  const proj = makeProject(title || 'Untitled story');
  const plan = outlinePlan(parsed, proj);
  proj.passages = plan.pages.concat(plan.empties);
  proj.start = plan.pages[0].id;
  return { project: normalizeProject(JSON.parse(JSON.stringify(proj))), issues: plan.issues };
}

/* ----- writing checks ----- */

const WRITE_STOP = new Set(
  'about after again against almost already always another because before between could every first never other should still their there these thing think those through under until where which while would whose being really something'.split(' ')
);
const WRITE_OK_TWICE = new Set(['had', 'that']);
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’]*/gu;

/** Words of a text, lowercase. */
const writeWords = t => (String(t || '').toLowerCase().match(WORD_RE) || []).map(w => w.replace(/['’]+$/, ''));

/** True if two words differ by one letter added, dropped or changed, or by two letters swapped. */
function oneOff(a, b) {
  if (a === b) return false;
  const d = a.length - b.length;
  if (d > 1 || d < -1) return false;
  if (!d) {
    let i = 0;
    while (a[i] === b[i]) i++;
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // one letter changed
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // two letters swapped
  }
  const [s, l] = d < 0 ? [a, b] : [b, a];
  let i = 0;
  while (s[i] === l[i] && i < s.length) i++;
  return s.slice(i) === l.slice(i + 1);
}

/** A choice label with case, punctuation and the little words that do not change its meaning taken out. */
function alikeKey(label) {
  return writeWords(label).filter(w => !['the', 'a', 'an', 'to', 'and', 'of'].includes(w));
}

/** One page's part of writingChecks (see WRITE_CACHE): its notes before the ignore list, and its words for the spelling check. */
function writingPage(p, texts, L, nameOf, mins, q) {
  const adds = [];
  const push = (kind, key, msg) => adds.push([kind, key, msg]);
  const caps = new Map(); // capitalized word -> times on this page, in the order first seen
  const lower = new Set();
  const all = texts.join('\n');
  /* a word never spans two paragraphs, so the page's words are its paragraphs' words in turn (the long-paragraph check below counts them) */
  const paraWords = texts.map(writeWords);
  let words = paraWords[0] || [];
  if (paraWords.length > 1) {
    words = [];
    for (const pw of paraWords) for (let i = 0; i < pw.length; i++) words.push(pw[i]);
  }
  /* a word typed twice in a row */
  let reps = 0;
  const re = /(^|[^\p{L}\p{N}'’])(\p{L}[\p{L}'’]*)[ \t]+\2(?![\p{L}\p{N}'’])/giu;
  for (const m of all.matchAll(re)) {
    if (WRITE_OK_TWICE.has(m[2].toLowerCase()) || reps >= 3) continue;
    reps++;
    push('repeat', `repeat|${p.id}|${m[2].toLowerCase()}|${reps}`, `On ${nameOf(p)} the word ${q(m[2])} is typed twice in a row: ${q(`${m[2]} ${m[2]}`)}.`);
  }
  /* a word used again and again on one page */
  if (words.length >= 60) {
    const n = new Map();
    words.forEach(w => {
      if (w.length >= 5 && !WRITE_STOP.has(w)) n.set(w, (n.get(w) || 0) + 1);
    });
    [...n.entries()]
      .filter(([, c]) => c >= 5 && c / words.length >= 0.04)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .forEach(([w, c]) => push('overuse', `overuse|${p.id}|${w}`, `On ${nameOf(p)} the word ${q(w)} comes up ${c} times in ${words.length} words. Is there another way to say it?`));
  }
  /* capitalized words (for the spelling check below) and which words are ever written in lower case */
  for (const m of all.matchAll(/\p{L}[\p{L}'’]*/gu)) {
    const w = m[0];
    if (w[0] === w[0].toLowerCase()) lower.add(w);
    else if (/^\p{Lu}\p{Ll}{2,}$/u.test(w)) caps.set(w, (caps.get(w) || 0) + 1);
  }
  /* long paragraphs and pages */
  let total = 0;
  texts.forEach((t, i) => {
    const w = paraWords[i].length;
    total += w;
    if (w > L.para) push('long', `long|${p.id}|para`, `A paragraph on ${nameOf(p)} is ${w} words (${mins(w)} to read). Would it read better as two?`);
  });
  if (total > L.page) push('long', `long|${p.id}|page`, `${nameOf(p)} is ${total} words (${mins(total)} to read), a long time before the player chooses.`);
  /* choices that read alike */
  if (!p.ending) {
    const cs = (p.choices || []).filter(c => String(c.label || '').trim());
    const keys = cs.map(c => alikeKey(String(c.label).trim())); // once per choice, not once per pair
    let pairs = 0;
    const seen = new Set();
    for (let i = 0; i < cs.length && pairs < 20; i++) {
      for (let j = i + 1; j < cs.length && pairs < 20; j++) {
        const a = String(cs[i].label).trim();
        const b = String(cs[j].label).trim();
        if (a.toLowerCase() === b.toLowerCase()) continue; // exactly alike: the checker already says so
        const ka = keys[i];
        const kb = keys[j];
        if (!ka.length || !kb.length) continue;
        const same = ka.join(' ') === kb.join(' ');
        const shared = ka.filter(w => kb.includes(w)).length;
        const close = Math.min(ka.length, kb.length) >= 3 && shared / (ka.length + kb.length - shared) >= 0.8;
        const pk = [ka.join(' '), kb.join(' ')].sort().join('|');
        if ((same || close) && !seen.has(pk)) {
          seen.add(pk);
          pairs++;
          push('alike', `alike|${p.id}|${ka.join(' ')}|${kb.join(' ')}`, `On ${nameOf(p)} the choices ${q(a)} and ${q(b)} read almost alike. Players may not see the difference.`);
        }
      }
    }
  }
  return { adds, caps: [...caps], lower: [...lower] };
}

/* Each page's own part of the writing checks (its notes, and the capitalized and lower-case words the spelling check needs) is kept with the
   page until its words, choices, name or the limits change, so a pause in typing re-reads one page, not all of them (a 2,000-page story spent
   about 170 ms here in Chromium). writing-cache-equiv.mjs checks the answers equal the uncached ones. */
const WRITE_CACHE = new WeakMap(); // page -> { was, adds: [[kind, key, msg]], caps: [[word, count]], lower: [words] }

/** The limits with their defaults, and the wording helpers the notes use. */
function writingLimits(lim) {
  const L = Object.assign({ para: 150, page: 600, wpm: 230, ignore: new Set() }, lim || {});
  L.q = s => `“${s}”`;
  L.nameOf = p => L.q((p.name || 'Untitled page').trim() || 'Untitled page');
  L.mins = w => {
    const s = (w / L.wpm) * 60;
    return s < 50 ? 'under a minute' : `about ${Math.round(s / 60)} minute${Math.round(s / 60) === 1 ? '' : 's'}`;
  };
  L.sig = `${L.para}|${L.page}|${L.wpm}`;
  return L;
}
/** Page p's part of the writing checks, from `cache` while the page and the limits are unchanged. The part keeps what it was worked out
    from (`was`: the limits, id, name, ending, the paragraph texts and choice wordings, all references to the page's own strings), and is
    checked against the page field by field. A signature string joining all of that cost one copy of the whole story's text per check (about
    3 ms at 2,000 pages in Chromium, after every typing pause) and kept that copy alive in the cache. */
function writingPart(p, L, cache) {
  const blocks = p.blocks || [],
    choices = p.choices || [];
  let part = cache && cache.get(p);
  const w = part && part.was;
  if (w && w.lim === L.sig && w.id === p.id && w.name === p.name && w.ending === !!p.ending && w.texts.length === blocks.length && w.labels.length === choices.length) {
    let same = true;
    for (let i = 0; same && i < blocks.length; i++) same = w.texts[i] === String(blocks[i].text || '');
    for (let i = 0; same && i < choices.length; i++) same = w.labels[i] === String(choices[i].label || '');
    if (same) return part;
  }
  const texts = blocks.map(b => String(b.text || ''));
  part = writingPage(p, texts, L, L.nameOf, L.mins, L.q);
  if (cache) {
    part.was = { lim: L.sig, id: p.id, name: p.name, ending: !!p.ending, texts, labels: choices.map(c => String(c.label || '')) };
    cache.set(p, part);
  }
  return part;
}
/** Fills WRITE_CACHE for the pages from `from` on, for at most `ms` milliseconds; returns where it stopped (pages.length when done). The
    editor runs this in small slices after a story opens, so the first writing checks of a big story do not freeze the page in one go. */
function writingWarm(project, lim, from, ms) {
  const L = writingLimits(lim);
  const pages = project.passages || [];
  const t0 = performance.now();
  let i = from;
  while (i < pages.length) {
    writingPart(pages[i++], L, WRITE_CACHE);
    if ((i & 15) === 0 && performance.now() - t0 > ms) break;
  }
  return i;
}

/* The name check needs each capitalized word (count, first page) and every word ever written in lower case. Merging every page's lists after
   each typing pause added ~80,000 words to a set at 2,000 pages, so the totals are kept with the cache with the parts they came from. Only
   changed parts are looked at: their lower-case words are taken off and the new ones added (pages per word); the names are kept when each
   changed part has the same page and capitalized words. If pages were added or removed, only the stretch between the unchanged start and
   end is looked at and the names are added up again. Parts never change once made (writingPart makes a new one). */
const WRITE_SUM = new WeakMap(); // cache -> { parts: [part per page], names: Map, lower: Map lower-case word -> pages using it }
function sameCaps(a, b) {
  if (a.was.id !== b.was.id || a.caps.length !== b.caps.length) return false;
  for (let i = 0; i < a.caps.length; i++) if (a.caps[i][0] !== b.caps[i][0] || a.caps[i][1] !== b.caps[i][1]) return false;
  return true;
}
function writingTotals(pages, parts, cache) {
  let t = cache && WRITE_SUM.get(cache);
  if (t) {
    const { lower } = t,
      old = t.parts;
    const take = was =>
        was.lower.forEach(w => {
          const n = lower.get(w) - 1;
          if (n) lower.set(w, n);
          else lower.delete(w);
        }),
      put = part => part.lower.forEach(w => lower.set(w, (lower.get(w) || 0) + 1));
    t.parts = parts;
    if (old.length === parts.length) {
      let keep = true;
      for (let i = 0; i < parts.length; i++) {
        if (old[i] === parts[i]) continue;
        if (keep && !sameCaps(old[i], parts[i])) keep = false;
        take(old[i]);
        put(parts[i]);
      }
      if (keep) return t;
    } else {
      let a = 0,
        e = 0;
      const n = Math.min(old.length, parts.length);
      while (a < n && old[a] === parts[a]) a++;
      while (e < n - a && old[old.length - 1 - e] === parts[parts.length - 1 - e]) e++;
      for (let i = a; i < old.length - e; i++) take(old[i]);
      for (let i = a; i < parts.length - e; i++) put(parts[i]);
    }
  } else {
    const lower = new Map();
    parts.forEach(part => part.lower.forEach(w => lower.set(w, (lower.get(w) || 0) + 1)));
    t = { parts, names: null, lower };
    if (cache) WRITE_SUM.set(cache, t);
  }
  /* a name's first page is where it is first seen; the list stops growing at 1,500 names */
  const names = new Map(); // a capitalized word -> { n, pid }
  parts.forEach((part, i) =>
    part.caps.forEach(([w, k]) => {
      const e = names.get(w);
      if (e) e.n += k;
      else if (names.size < 1500) names.set(w, { n: k, pid: pages[i].id });
    })
  );
  t.names = names;
  return t;
}

/**
 * The writing checks. `lim` = { para, page, wpm, ignore } where para and page are word counts, wpm the reading speed, ignore a Set of keys the author turned off.
 * Returns [{ pid, kind, key, msg }]: kinds 'repeat', 'overuse', 'name', 'long', 'alike'. Notes for the author, never mistakes in the story.
 * `cache` (WRITE_CACHE unless null) keeps each page's part between calls.
 */
function writingChecks(project, lim, cache = WRITE_CACHE) {
  const L = writingLimits(lim);
  const { q } = L;
  const out = [];
  const add = (pid, kind, key, msg) => {
    if (!L.ignore.has(key)) out.push({ pid, kind, key, msg });
  };
  const pages = project.passages || [];
  const parts = pages.map(p => {
    const part = writingPart(p, L, cache);
    part.adds.forEach(a => add(p.id, a[0], a[1], a[2]));
    return part;
  });
  const { names, lower } = writingTotals(pages, parts, cache);
  /* the same name spelled two ways: a rare spelling one letter away from a common one, neither ever written as an everyday word (in lower case) */
  const list = [...names.entries()].filter(([w]) => !lower.has(w.toLowerCase()));
  list.forEach(([rare, r]) => {
    if (r.n > 2) return;
    let best = null;
    list.forEach(([common, c]) => {
      if (common === rare || c.n < Math.max(3, r.n * 2) || !oneOff(rare.toLowerCase(), common.toLowerCase())) return;
      if (rare.length === common.length + 1 && /s$/i.test(rare)) return; // a plural, not a typo
      if (!best || c.n > best.c.n) best = { common, c };
    });
    if (best) add(r.pid, 'name', `name|${rare.toLowerCase()}`, `${q(rare)} (${r.n} time${r.n === 1 ? '' : 's'}) may be a typo for ${q(best.common)} (${best.c.n} times).`);
  });
  return out;
}
