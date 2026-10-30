/* The massive example, "The Massive Test Story" (a generated story, not one to read for its own sake): 300 pages in twelve rooms, built in code when the writer asks for it (so it adds almost nothing
   to the file). It shows what the checker and the Map do with a big story: keys, locked doors, rooms you can leave and return to, side pages,
   good and bad endings, a few paragraphs that depend on what you carry. Seeded, so it is the same story every time.
   Copyright (c) 2026 LFC Foundry. MIT License. */
function massiveExample() {
  let seed = 20261024;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pick = a => a[Math.floor(rnd() * a.length)];
  /* a room: its name, its key, three ways in, and the sentences that give it a feel */
  const ROOMS = [
    ['Atrium', 'Brass key', ['east colonnade', 'marble stair', 'ticket hall'], ['A skylight drips onto a floor of black and white tiles.', 'Somewhere above you a clock has stopped at ten past three.', 'Dust lies in neat stripes where trolleys used to run.'], ['The brass handrail of the stair is warm, as if someone has just let go of it.', 'Rain you cannot hear runs down the inside of the tall windows.']],
    ['Reading Rooms', 'Salt key', ['long tables', 'card catalog', 'quiet gallery'], ['Green lamps still burn over desks nobody has used for years.', 'The books here are swollen and smell of the sea.', 'A pencil lies across an open ledger, as if its owner just stepped out.'], ['A card in the catalog has your handwriting on it, though you never wrote it.', 'The ladder here rolls a little by itself whenever you look away.']],
    ['Stacks', 'Iron key', ['aisle of maps', 'aisle of letters', 'ladder aisle'], ['The shelves lean like trees in a gale.', 'Every spine is stamped with a number and nothing else.', 'Your steps echo a moment later than they should.'], ['A book lies open on the floor, its pages turning in a draft that is not there.', 'The aisle numbers count down, and you cannot tell what they count toward.']],
    ['Flooded Cellars', 'Tide key', ['stone steps', 'rowing gallery', 'pump room'], ['Black water laps at the lowest shelves.', 'A rowing boat is tied to a pillar, its oars shipped.', 'Something knocks softly on the pipes and stops when you listen.'], ['The water is clear enough to show steps going down much farther than the cellar should.', 'A line on the wall marks a flood, with a date from next year.']],
    ['Map Room', 'Chart key', ['globe hall', 'plotting desk', 'compass floor'], ['Charts of coasts that no longer exist cover every wall.', 'A brass compass in the floor points a little to the left of north.', 'Pins mark a route that circles back on itself.'], ['One map shows this very room, and in it a small figure stands where you are standing.', 'The ink on the newest chart is still wet.']],
    ['Bell Tower', 'Bell key', ['winding stair', 'ringers chamber', 'clock loft'], ['The rope hangs slack, its end frayed.', 'Pigeons shift and mutter in the rafters.', 'From up here the harbor lamps look like a spilled necklace.'], ['The bell is cracked, and when the wind passes it hums a note you almost know.', 'Greasy fingerprints mark every rung of the ladder, all of them small.']],
    ['Gallery', 'Glass key', ['portrait corridor', 'sculpture court', 'dark room'], ['Eyes in the portraits seem to follow the lamp.', 'A marble hand reaches out of the wall holding nothing.', 'Frames lean face to the wall, waiting for a decision.'], ['A frame on the wall holds only a pale rectangle where a picture used to hang.', 'Your footsteps are softer here, as if the floor were listening.']],
    ['Workshop', 'Copper key', ['bindery', 'type room', 'glue loft'], ['Presses stand in rows, still inked.', 'A leather apron hangs on a nail, shaped like its wearer.', 'Rolls of paper curl on the benches like sleeping cats.'], ['A half-finished page sits locked in a press, its last line missing.', 'The smell of hot lead and linseed oil hangs in air that has not been warm for years.']],
    ['Garden Court', 'Moss key', ['fountain walk', 'glass house', 'wall garden'], ['Rain ticks on the leaves of plants that have no business living here.', 'A bench faces a dry fountain.', 'Snails have written their silver names on the flagstones.'], ['A single lit window glows high in the wall, though the wall has no rooms behind it.', 'The gravel path is wet, and recent footprints follow it in both directions.']],
    ['Lamp Gallery', 'Lens key', ['stair of mirrors', 'oil store', 'watch room'], ['The great lens is cold, a hive of glass.', 'Sea wind finds every gap in the windows.', 'Logbooks here are signed by keepers who share one handwriting.'], ['Salt has dried in white fans across the glass.', 'A spare wick lies on the sill, cut straight and clean.']],
    ['Records Vault', 'Wax key', ['sealed door', 'ledger cage', 'counting floor'], ['Wax seals dull as old coins hold every drawer shut.', 'A single fan turns in the ceiling for no reason.', 'The air is dry here, and strangely warm.'], ['A drawer stands open, and inside it is a ledger with your name on its spine.', 'The seals on the lowest drawers have been broken from the inside.']],
    ['Keeper’s Rooms', 'Lamp key', ['kitchen', 'stair landing', 'bedroom'], ['A kettle sits on the stove, quite cold.', 'There is a cup on the table with your name on it.', 'The bed is made and the window looks out at nothing at all.'], ['A pair of boots stands by the door, the laces tied and the soles still damp.', 'The window rattles gently, as if the sea were asking to come in.']]
  ];
  const STATES = ['Alarm raised', 'Met the archivist', 'Lamp lit', 'Tide let in'];
  const items = ROOMS.map((r, i) => ({ id: `i_key${i}`, name: r[1], kind: 'object', show: true })).concat(STATES.map((s, i) => ({ id: `i_st${i}`, name: s, kind: 'state', show: true })));
  const pages = [];
  const make = (id, name, texts, o = {}) => {
    const p = {
      id,
      name,
      heading: '',
      ending: !!o.ending,
      valence: o.valence || '',
      todo: false,
      blocks: texts.map(t => (typeof t === 'string' ? { text: t, needs: [], forbid: [], orPrev: false } : Object.assign({ needs: [], forbid: [], orPrev: false }, t))),
      gives: o.gives || [],
      takes: [],
      adds: {},
      sends: {},
      choices: []
    };
    pages.push(p);
    return p;
  };
  const go = (p, label, to, o = {}) => p.choices.push(Object.assign({ label, to, needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: false, why: '' }, o));
  const NOUNS = ['passage', 'landing', 'alcove', 'corridor', 'stair', 'antechamber'];
  ROOMS.forEach((room, r) => {
    const [rn, , ways, feel, more] = room;
    const pool = feel.concat(more); /* eight-and-more distinct lines per room, so no page says a line twice and neighbors never share one */
    const hub = `p_r${r}_hub`;
    const nextHub = r + 1 < ROOMS.length ? `p_r${r + 1}_hub` : 'p_final';
    const hubPage = make(hub, rn, [pool[0], pool[1], r ? `You came here from the ${ROOMS[r - 1][0].toLowerCase()} with the ${ROOMS[r - 1][1].toLowerCase()} still warm in your pocket.` : 'The doors close behind you. The archive has been waiting.']);
    if (r === 0) hubPage.id = 'p_start';
    const hubId = r === 0 ? 'p_start' : hub;
    /* three ways out of the hub: each a chain of six pages with two side pages off it */
    ways.forEach((way, w) => {
      let prev = hubPage;
      for (let k = 1; k <= 6; k++) {
        const id = `p_r${r}_w${w}_${k}`;
        const noun = pick(NOUNS);
        const along = [`The ${way} begins as a ${noun} that bends toward the ${pick(['left', 'right', 'dark', 'light'])}.`, `Further on, the ${way} narrows to a ${noun}.`, `The ${way} climbs, then drops, and the ${noun} ahead is darker.`, `A ${noun} opens off the ${way}, and you keep straight on.`, `The ${way} grows quiet; even your own footsteps seem to hold back.`, `The ${way} ends here, at a ${noun} with nothing beyond it.`][k - 1];
        const texts = k <= 3 ? [pool[2 + ((w + k) % 3)], along] : [along];
        if (k === 3 && w === 0) texts.push({ text: 'The lamp you carry throws a steady circle on the floor.', needs: ['i_st2'], forbid: [] });
        const isLast = k === 6;
        const last = r === ROOMS.length - 1;
        const o = isLast && w === 1 ? { ending: true, valence: 'bad' } : isLast && w === 2 && last ? { ending: true, valence: 'good' } : { gives: isLast && w === 0 ? [`i_key${r}`] : [] };
        const page = make(id, `${rn}, ${way} ${k}`, texts, o);
        go(prev, k === 1 ? `Take the ${way}` : 'Go on', id);
        if (!page.ending) go(page, isLast && w === 0 ? 'Return with what you found' : 'Turn back', hubId);
        prev = page;
        /* side pages off the way */
        if (k === 2 || k === 4) {
          const sid = `p_r${r}_w${w}_side${k}`;
          const sp = make(sid, `${rn}, ${way} alcove ${k / 2}`, k === 2 ? [`A small door stands ajar off the ${way}.`, 'Behind it is a shelf with one thing on it.'] : [`A narrower door in the ${way} is swollen shut but gives a little.`, 'Inside is a cupboard with a single thing in it.'], { gives: k === 2 && w === 0 && r < STATES.length ? [`i_st${r}`] : [] });
          go(page, 'Look through the small door', sid);
          go(sp, 'Step back out', id);
        }
      }
    });
    /* the gate to the next room: locked until you hold this room's key */
    const gate = make(`p_r${r}_gate`, `${rn}, gate`, [`A door of ${pick(['oak', 'iron', 'glass', 'salted pine'])} bars the way on.`, pool[3]]);
    go(hubPage, 'Try the door on', gate.id);
    go(gate, `Use the ${room[1].toLowerCase()}`, nextHub, { needs: [`i_key${r}`], lock: true, why: `It needs the ${room[1].toLowerCase()}, which is somewhere in the ${rn.toLowerCase()}.` });
    go(gate, 'Go back to the hall', hubId);
    /* two rooms get a short loop home, so the Map has crossings to show */
    if (r % 3 === 1) go(hubPage, 'Climb back to the start of the archive', 'p_start');
    if (r === 1) hubPage.choices.unshift(Object.assign({ label: 'Speak to the archivist' }, { to: `p_r${r}_arc`, needs: [], forbid: [], gives: [], takes: [], adds: {}, check: null, lock: false, why: '' }));
  });
  /* the archivist, and the true ending */
  const arc = make('p_r1_arc', 'The archivist', ['A thin figure lowers a lamp. “You are the new keeper,” it says, as if it had been told.', 'It does not say who told it.'], { gives: ['i_st1'] });
  go(arc, 'Thank them and go on', 'p_r1_hub');
  const fin = make('p_final', 'The last lamp', ['The great lamp stands ready, and so do you.', 'You strike the match.'], {});
  go(fin, 'Light the lamp', 'p_end_light', { needs: ['i_st2'], lock: true, why: 'You have not found the lamp’s fire yet.' });
  go(fin, 'Walk out into the night', 'p_end_walk');
  make('p_end_light', 'Ending: the light holds', ['Gold light pours down the stair and out to sea. Every ship you cannot see turns toward it.', 'You are the keeper now.'], { ending: true, valence: 'good' });
  make('p_end_walk', 'Ending: the dark', ['The archive closes behind you, quietly, as if it had never been open.'], { ending: true, valence: 'bad' });
  return {
    format: 'story-editor',
    version: 1,
    id: 's_massive',
    title: 'The Massive Test Story',
    author: '',
    start: 'p_start',
    items,
    givens: [],
    passages: pages,
    game: { back: 'off', tracker: false, comfort: true, odds: true, place: false, pal: 'paper' }
  };
}
