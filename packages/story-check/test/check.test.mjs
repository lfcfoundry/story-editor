import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze, analyzeStructure, normalizeProject, makeProject, makePassage, makeChoice, makeItem } from '../dist/story-check.mjs';
import { makeGenStory } from '../../qa-kit/src/genstory.mjs';
import { loadEditor } from '../../qa-kit/src/editor-vm.mjs';

const ed = loadEditor(['analyze', 'analyzeStructure', 'normalizeProject']);
const genStory = makeGenStory(normalizeProject);

/** Everything analyze() returns except its three helper functions, plus what those functions answer for every page. */
const flat = (project, a) => JSON.stringify([{ ...a, explain: 0, canArrive: 0, why: 0 }, project.passages.map(p => a.why(p.id))]);

test('a story with a dead end, an unreachable ending and a missing key is reported', () => {
  const s = makeProject('Vault');
  const hall = s.passages[0];
  hall.blocks[0].text = 'A hall.';
  const key = makeItem('Key', 'object');
  s.items.push(key);
  const vault = makePassage('Vault');
  vault.ending = true;
  const attic = makePassage('Attic');
  attic.ending = true;
  const open = makeChoice('Open', vault.id);
  open.needs = [key.id]; // nobody ever gets the key
  hall.choices.push(open, makeChoice('Leave', ''));
  s.passages.push(vault, attic);
  const r = analyze(normalizeProject(s));
  assert.ok(r.problems.some(p => /does not lead anywhere/.test(p.msg)));
  assert.ok(r.problems.some(p => /nobody can reach it/.test(p.msg)));
  assert.ok(r.problems.some(p => p.pid === vault.id && p.code === 'unreachable-page'));
  assert.ok(r.problems.some(p => p.pid === attic.id && p.code === 'unreachable-page'));
  const whyVault = r.why(vault.id);
  assert.equal(whyVault.reachable, false);
  assert.deepEqual(whyVault.incoming[0].blockers, [{ kind: 'needs', id: key.id }]);
  const vaultEnd = r.endings.find(e => e.name === 'Vault');
  assert.equal(vaultEnd.reachable, false); // needs a key that exists nowhere
});

test('a conditional route available for one Given answer is reachable', () => {
  const story = makeProject('Given answer');
  const start = story.passages[0];
  start.blocks[0].text = 'Start.';
  const first = makeItem('First answer', 'state');
  const second = makeItem('Second answer', 'state');
  story.items.push(first, second);
  story.givens.push({ id: 'who', question: 'Who are you?', options: [first.id, second.id] });
  const end = makePassage('Second answer ending');
  end.ending = true;
  end.blocks[0].text = 'Done.';
  const choice = makeChoice('Choose the second answer', end.id);
  choice.needs = [second.id];
  start.choices.push(choice);
  story.passages.push(end);

  const analysis = analyze(normalizeProject(story));
  assert.equal(analysis.why(end.id).reachable, true);
  assert.equal(analysis.why(end.id).incoming[0].offered, true);
  assert.equal(analysis.endings.find(e => e.pid === end.id).reachable, true);
  assert.equal(analysis.problems.some(problem => problem.pid === end.id && problem.code === 'unreachable-page'), false);
});

test('cycles terminate and disconnected cycles are unreachable', () => {
  const story = makeProject('Cycles');
  const start = story.passages[0];
  start.blocks[0].text = 'Start.';
  const loop = makePassage('Loop');
  const islandA = makePassage('Island A');
  const islandB = makePassage('Island B');
  start.choices.push(makeChoice('Enter loop', loop.id));
  loop.choices.push(makeChoice('Go back', start.id));
  islandA.choices.push(makeChoice('To B', islandB.id));
  islandB.choices.push(makeChoice('To A', islandA.id));
  story.passages.push(loop, islandA, islandB);

  const analysis = analyze(normalizeProject(story));
  assert.equal(analysis.truncated, false);
  assert.equal(analysis.why(loop.id).reachable, true);
  assert.equal(analysis.why(islandA.id).reachable, false);
  assert.equal(analysis.why(islandB.id).reachable, false);
  assert.equal(analysis.problems.find(problem => problem.pid === islandA.id).code, 'unreachable-page');
  assert.equal(analysis.problems.find(problem => problem.pid === islandB.id).code, 'unreachable-page');
});

test('a truncated analysis leaves an undiscovered linked page indeterminate', () => {
  const story = makeProject('Truncated');
  const start = story.passages[0];
  start.blocks[0].text = 'Start.';
  const middle = makePassage('Middle');
  const end = makePassage('End');
  end.ending = true;
  start.choices.push(makeChoice('Continue', middle.id));
  middle.choices.push(makeChoice('Finish', end.id));
  story.passages.push(middle, end);

  const analysis = analyze(normalizeProject(story), 1);
  assert.equal(analysis.truncated, true);
  assert.equal(analysis.why(end.id).reachable, null);
  assert.equal(analysis.endings.find(ending => ending.pid === end.id).reachable, null);
  assert.equal(analysis.problems.some(problem => problem.pid === end.id && problem.code === 'unreachable-page'), false);
});

test('a normalized missing destination is reported as a broken choice', () => {
  const story = makeProject('Missing destination');
  const start = story.passages[0];
  start.blocks[0].text = 'Start.';
  start.choices.push(makeChoice('Go nowhere', 'missing-page'));

  const analysis = analyze(normalizeProject(story));
  assert.ok(analysis.problems.some(problem => problem.pid === start.id && /does not lead anywhere yet/.test(problem.msg)));
  assert.equal(analysis.problems.some(problem => problem.pid === start.id && problem.code === 'unreachable-page'), false);
});

test('a fixed story passes', () => {
  const s = makeProject('Two pages');
  const a = s.passages[0];
  a.blocks[0].text = 'Start.';
  const b = makePassage('End');
  b.ending = true;
  b.blocks[0].text = 'Done.';
  a.choices.push(makeChoice('Go', b.id));
  s.passages.push(b);
  const r = analyze(normalizeProject(s));
  assert.deepEqual(r.problems, []);
  assert.equal(r.endings.length, 1);
  assert.equal(r.endings[0].reachable, true);
});

test('structure summary names the shape of a story', () => {
  const s = ed.normalizeProject(JSON.parse(JSON.stringify(genStory(3))));
  const st = analyzeStructure(normalizeProject(s));
  assert.equal(typeof st.label, 'string');
  assert.ok(Array.isArray(st.bottlenecks));
});

test('identical answers to the editor on 150 random stories (every feature)', () => {
  for (let seed = 1; seed <= 150; seed++) {
    const p = genStory(seed);
    assert.equal(flat(p, analyze(p)), flat(p, ed.analyze(p)), `seed ${seed}`);
    assert.equal(JSON.stringify(analyzeStructure(p)), JSON.stringify(ed.analyzeStructure(p)), `structure, seed ${seed}`);
  }
});

test('bigger stories (many objects and states, wide numbers) also match', () => {
  for (let seed = 1; seed <= 12; seed++) {
    for (const opts of [{ huge: true }, { wide: true }]) {
      const p = genStory(seed * 31, opts);
      assert.equal(flat(p, analyze(p, 60000)), flat(p, ed.analyze(p, 60000)), `seed ${seed} ${JSON.stringify(opts)}`);
    }
  }
});

test('a key behind a one-way door is noted, and a story where the key can be fetched is not', () => {
  const build = oneWay => {
    const s = makeProject('Door');
    const start = s.passages[0];
    start.blocks[0].text = 'Start.';
    const key = makeItem('Key', 'object');
    s.items.push(key);
    const take = makeChoice('Take the key', '');
    take.gives = [key.id];
    const skip = makeChoice('Skip it', '');
    const hall = makePassage('Hall');
    hall.blocks[0].text = 'A hall.';
    const end = makePassage('Vault');
    end.ending = true;
    end.blocks[0].text = 'Done.';
    take.to = hall.id;
    skip.to = hall.id;
    start.choices.push(take, skip);
    const open = makeChoice('Open the door', end.id);
    open.needs = [key.id];
    hall.choices.push(open);
    if (!oneWay) hall.choices.push(makeChoice('Go back', start.id));
    s.passages.push(hall, end);
    return normalizeProject(s);
  };
  const note = r => r.notes.filter(n => /miss this choice for good/.test(n.msg));
  assert.equal(note(analyze(build(true))).length, 1);
  assert.equal(note(analyze(build(false))).length, 0);
});

test('the minified builds give the same answers as the readable ones', async () => {
  const min = await import('../dist/story-check.min.mjs');
  assert.deepEqual(Object.keys(min).sort(), Object.keys(await import('../dist/story-check.mjs')).sort());
  for (let seed = 1; seed <= 20; seed++) {
    const p = genStory(seed);
    assert.equal(flat(p, min.analyze(p)), flat(p, analyze(p)), `seed ${seed}`);
  }
});
