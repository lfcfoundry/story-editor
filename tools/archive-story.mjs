/* Writes examples/the-drowned-archive.story.json: "The Drowned Archive", a hand-written story of about 55 pages that shows what the
   editor can do: a question before page one, objects and states, two numbers (Tide and Nerve), a dice check, locked choices with a
   reason, text that changes with what you carry, and eight endings. The story text lives here so it can be read and edited as code.
   Usage: node tools/archive-story.mjs. Copyright (c) 2026 LFC Foundry. MIT License. */
import { writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url).pathname;

const G = ['g_heir', 'g_insp', 'g_thief'];
const items = [
  { id: 'i_lantern', name: 'Storm lantern', kind: 'object', show: true },
  { id: 'i_clockkey', name: 'Clock key', kind: 'object', show: true },
  { id: 'i_bob', name: 'Pendulum bob', kind: 'object', show: true },
  { id: 'i_moil', name: 'Machine oil', kind: 'object', show: true },
  { id: 'i_oil', name: 'Lamp oil', kind: 'object', show: true },
  { id: 'i_watch', name: 'Tomas’s watch', kind: 'object', show: true },
  { id: 'i_vaultkey', name: 'Vault key', kind: 'object', show: true },
  { id: 'i_ledger', name: 'Ledger of Names', kind: 'object', show: true },
  { id: 'i_trust', name: 'Ines trusts you', kind: 'state', show: false },
  { id: 'i_lamp', name: 'Lamp lit', kind: 'state', show: false },
  { id: 'g_heir', name: 'Heir', kind: 'state', show: false },
  { id: 'g_insp', name: 'Inspector', kind: 'state', show: false },
  { id: 'g_thief', name: 'Thief', kind: 'state', show: false },
  { id: 'i_tide', name: 'Tide', kind: 'stat', show: true, lo: 0, hi: 5, start: 0 },
  { id: 'i_nerve', name: 'Nerve', kind: 'stat', show: true, lo: 0, hi: 2, start: 1 }
];

const pages = [];
const block = b => (typeof b === 'string' ? { text: b, needs: [], forbid: [], orPrev: false } : { text: b.t, needs: b.n || [], forbid: b.f || [], orPrev: !!b.or });
/* P(id, name, blocks, options): options are ending, valence, gives, takes, adds */
const P = (id, name, blocks, o = {}) => {
  const p = { id, name, heading: '', ending: !!o.ending, valence: o.valence || '', todo: false, color: '', note: '', blocks: blocks.map(block), gives: o.gives || [], takes: o.takes || [], adds: o.adds || {}, sends: {}, choices: [] };
  pages.push(p);
  return p;
};
/* C(page, label, to, options): options are n (needs), f (forbid), gives, takes, adds, check, why (shown greyed out instead of hidden) */
const C = (p, label, to, o = {}) =>
  p.choices.push({ label, to, needs: o.n || [], forbid: o.f || [], gives: o.gives || [], takes: o.takes || [], adds: o.adds || {}, check: o.check || null, lock: !!o.why, why: o.why || '' });
const tide = n => `t:i_tide:${n}`;

/* ---------- the causeway ---------- */
const start = P('p_start', 'The causeway', [
  'The causeway is a ribbon of wet stone with the sea on both sides of it, and the sea is coming in. Ahead, the Meridian Archive stands on its mudflat like a ship that ran aground and decided to become a building.',
  { t: 'Your grandmother’s ledger is somewhere inside. The letter that brought you here said so, in a hand you almost know.', n: ['g_heir'] },
  { t: 'The county’s seal is in your coat pocket and a closing order is in your bag. The keeper has not answered a letter in four months.', n: ['g_insp'] },
  { t: 'You know what the vault is said to hold, and the tide table says you have until dawn.', n: ['g_thief'] }
]);
const watch = P('p_watch', 'Watching the tide', [
  'You stand and count. The water takes a paving stone every dozen breaths, quietly and without hurry.',
  'Behind you the mainland is a row of lamps already far off. Ahead, one window high in the Archive glows the color of weak tea.'
], { adds: { i_tide: 1 } });
const turn = P('p_end_turn', 'Ending: the mainland', ['You turn and walk back along the causeway with the sea at your heels. By morning the water has covered the stones, and the Meridian Archive sits alone in the middle of it again, as it has for years.', 'Some stories are better left unopened. You will never know which one this was.'], { ending: true });
C(start, 'Walk on to the archive door', 'p_atrium');
C(start, 'Stop and watch the water come in', 'p_watch');
C(start, 'Turn back to the mainland', 'p_end_turn');
C(watch, 'Walk on to the archive door', 'p_atrium');
C(watch, 'Turn back to the mainland', 'p_end_turn');

/* ---------- the atrium ---------- */
const atrium = P('p_atrium', 'Atrium', [
  'The doors close behind you with a sound like a book shutting. A black and white floor runs away into the dark, and a skylight drips onto it, one slow drop at a time.',
  'High on the far wall hangs a great clock, its hands stopped at ten past three. Under it stands a desk with a blotter, a pen and a note pinned down by a brass tack.',
  { t: 'It is very dark beyond the first pillars.', f: ['i_lantern'] },
  { t: 'Your lantern throws a steady circle on the floor, and the dark keeps its distance.', or: true },
  { t: 'A thin skin of water has found the floor and is creeping in under the doors.', n: [tide(3)] },
  { t: 'The water has reached the doors, and the black and white floor is a shallow lake.', n: [tide(5)] }
]);
const lantern = P('p_lantern', 'The storm lantern', ['The storm lantern hangs on a hook by the door as if someone were expected. It is full and the wick is trimmed.', 'You light it, and the Atrium shrinks to a room.'], { gives: ['i_lantern'] });
const clock = P('p_clock', 'The note and the stopped clock', [
  'The note on the desk is in a hurried hand: THE TIDE GATE HAS FAILED. DO NOT WIND THE CLOCK. IF YOU ARE READING THIS, START WITH THE LAMP AND KEEP YOUR FEET DRY. It is signed I. V.',
  { t: 'You know the V. Ines Varga was your grandmother’s cousin, and the only Varga who never came home.', n: ['g_heir'] },
  { t: 'The date on the note is six weeks old, which is two weeks before your last unanswered letter.', n: ['g_insp'] },
  { t: 'Whoever left this expected someone worse than you.', n: ['g_thief'] },
  { t: 'Beside the desk a storm lantern hangs on a hook, full and trimmed, as if someone were expected.', f: ['i_lantern'] },
  'The clock face is cracked from corner to corner. Under the glass someone has scratched a tally of small marks, hundreds of them, in rows.',
  'The pendulum case below is empty. The bob that should hang there is gone, and so is the key that winds it.',
  { t: 'Your report will call this negligence. It does not feel like negligence.', n: ['g_insp'] },
  { t: 'Grandmother used to say the Meridian never lost time. She said it only misplaced it.', n: ['g_heir'] }
]);
C(atrium, 'Read the note and look closely at the clock', 'p_clock');
C(clock, 'Take the storm lantern from its hook', 'p_lantern', { f: ['i_lantern'] });
C(atrium, 'Go through the oak door to the Reading Rooms', 'p_reading');
C(atrium, 'Try the arched door to the Stacks', 'p_stacks');
C(atrium, 'Follow the iron stair down to the Cellars', 'p_cellars', { n: ['i_lantern'], f: [tide(5)], why: 'You cannot go down those stairs without a light, and not at all once the water is this high.' });
C(atrium, 'Cross to the Keeper’s Rooms', 'p_keeper');
C(atrium, 'Climb the winding stair toward the Bell Tower', 'p_tower', { n: ['i_lantern'], why: 'The stair has no windows. You will need a light.' });
C(atrium, 'Go to the great doors', 'p_doors');
for (const p of [lantern, clock]) C(p, 'Back to the middle of the Atrium', 'p_atrium');

const doors = P('p_doors', 'The great doors', [
  'The great doors stand a hand’s width open on the night. The causeway runs away from them, pale, a little thinner than when you came.',
  { t: 'The seal in your pocket would close these doors for good, and on the county’s word nobody would open them again.', n: ['g_insp'] },
  { t: 'The causeway is gone. Past the doors there is only sea.', n: [tide(5)] }
]);
C(doors, 'Press the county’s seal to the doors and close the Archive', 'p_end_sealed', { n: ['g_insp'] });
C(doors, 'Wade out toward the water', 'p_end_stranded', { n: [tide(5)] });
C(doors, 'Back to the middle of the Atrium', 'p_atrium');

/* ---------- the reading rooms ---------- */
const reading = P('p_reading', 'Reading Rooms', [
  'Green-shaded lamps still burn over long tables, though the cord that feeds them runs through a pool of standing water.',
  'The books are swollen to twice their size and smell of the sea. Someone has laid them out in rows, open and face down, as if drying them.',
  { t: 'A tide line on the paneling stops exactly at your knee.', n: [tide(3)] }
]);
const catalog = P('p_catalog', 'The card catalog', [
  'The drawers slide out heavily. One card has been pulled halfway and left standing like a loose tooth.',
  { t: 'It says VARGA, your family’s name, and a shelf mark that matches no shelf you have seen.', n: ['g_heir'] },
  { t: 'It says INSPECTOR, FINAL VISIT, and the date written beside it is tomorrow.', n: ['g_insp'] },
  { t: 'It says VAULT, WEST WALL, KEY HELD BY THE KEEPER.', n: ['g_thief'] }
]);
const shelf = P('p_shelf', 'The tide tables', [
  'Behind a row of tide tables you find a flat tin box. Inside it, wrapped in oilcloth, lies a clock key of black iron, its bow worn smooth by one thumb.'
], { gives: ['i_clockkey'] });
const gallery = P('p_gallery', 'The quiet gallery', [
  'From the gallery the tables look like a field of small islands. Pigeons have come in through a broken pane and nested among the pencil boxes.',
  'At the rail someone has left a thermos, still faintly warm. Whoever drank from it left only minutes ago.'
]);
C(reading, 'Open the card catalog', 'p_catalog');
C(reading, 'Search the shelves for a clock-maker’s manual', 'p_shelf', { n: ['i_lantern'], f: ['i_clockkey'], why: 'The shelves are too dark to search without a light.' });
C(reading, 'Walk the quiet gallery above the tables', 'p_gallery');
C(reading, 'Back to the Atrium', 'p_atrium');
for (const p of [catalog, shelf, gallery]) C(p, 'Step back into the Reading Rooms', 'p_reading');

/* ---------- the stacks and the vault ---------- */
const stacks = P('p_stacks', 'The Stacks', [
  'The shelves lean like trees in a gale, and every spine carries a number and nothing else. Your steps come back to you a moment late.',
  'Two aisles run off into the dark, Maps and Letters, and at the far end a steel door waits under a single bulb.'
]);
const letters = P('p_letters', 'Aisle of Letters', [
  'The letters are tied in bundles by year, each addressed to the same man: Tomas Varga, Keeper, Meridian Archive. Each is signed with one initial, I.',
  'Every envelope is dated the same day, in a different year, and every one of them is stamped ten past three.',
  { t: 'Nobody ever told your family what happened to Tomas. These are the answer, and they are all unopened.', n: ['g_heir'] }
], { adds: { i_nerve: 1 } });
const maps = P('p_maps', 'Aisle of Maps', [
  'The map of the Archive is pinned flat under glass: every room, every stair, and a blue line crawling across it that marks the high water of each flood since 1926.',
  'In pencil over the Cellars someone has written: PUMP WORKS IF FED. BOB IS IN THE WORKSHOP, NOT THE CLOCK.'
]);
const ladder = P('p_ladder_top', 'Above the Stacks', [
  'At the top, on a shelf under the roof, a green diary lies open. It is Ines Varga’s, and the last page is the same page written again and again in the same words.',
  'It says: The water came at ten past three, and Tomas was below. I stopped the clock so that it could not be later than that.'
]);
const fall = P('p_fall', 'A bad rung', ['The rung gives way and you go down the ladder faster than you went up. You land in the aisle on your hands, with the lantern swinging wildly at your wrist.', 'Nothing is broken but your patience, and the tide has not waited for you to find your feet.'], { adds: { i_tide: 1 } });
C(stacks, 'Walk the Aisle of Letters', 'p_letters');
C(stacks, 'Walk the Aisle of Maps', 'p_maps');
C(stacks, 'Climb the ladder to the top shelf', 'p_ladder_top', { n: ['i_lantern'], check: { stat: 'i_nerve', target: 8, fail: 'p_fall' }, why: 'You cannot climb that ladder in the dark.' });
C(stacks, 'Go to the steel door at the end', 'p_vault_door');
C(stacks, 'Back to the Atrium', 'p_atrium');
C(letters, 'Back to the Stacks', 'p_stacks');
C(maps, 'Back to the Stacks', 'p_stacks');
C(ladder, 'Climb down to the Stacks', 'p_stacks');
C(fall, 'Get up and go back to the Stacks', 'p_stacks');

const vdoor = P('p_vault_door', 'The vault door', [
  'A steel door with a wheel lock, painted green a long time ago. The wax seals on its frame are dull as old coins.',
  'Through the grille you can see the corner of a reading stand and the edge of a cage lamp, neither of them in use.'
]);
const vjam = P('p_vault_jam', 'The lock holds', ['The pick snaps in the lock. The wheel will not turn for you now, and the lock is the one thing in the Archive as stubborn as you are.', 'Behind you a drop of water lands on a shelf, then another.'], { adds: { i_tide: 1 } });
const vault = P('p_vault', 'Records Vault', [
  'Wax-sealed drawers climb to the ceiling, and a single fan turns overhead for no reason. The air is dry here, which feels like a lie.',
  'A ledger sits on a reading stand under a cage lamp that has never been switched on. Beside it, in a glass case, lies a silver medal on a ribbon.'
]);
const ledger = P('p_ledger', 'The Ledger of Names', ['The Ledger of Names is heavier than it looks. Every page holds a name, a date and a tide height.', 'Every family in the town is in it: everyone the sea has ever taken, and everyone it gave back. The last pages are blank, with a border drawn and waiting.'], { gives: ['i_ledger'] });
const silver = P('p_silver_take', 'The silver medal', ['The medal comes away from its ribbon with a small tearing sound. It reads: To T. Varga, for courage at Meridian Light.', { t: 'It would fetch more than a year’s wages, and you already know the buyer.', n: ['g_thief'] }, { t: 'It feels wrong in your pocket, like a stone that belongs to someone else.', f: ['g_thief'] }]);
C(vdoor, 'Open the door with the vault key', 'p_vault', { n: ['i_vaultkey'], takes: ['i_vaultkey'] });
C(vdoor, 'Work the lock with the pick from your boot', 'p_vault', { n: ['g_thief'], f: ['i_vaultkey'], check: { stat: 'i_nerve', target: 8, fail: 'p_vault_jam' } });
C(vdoor, 'Back to the Stacks', 'p_stacks');
C(vjam, 'Step back from the door', 'p_vault_door');
C(vault, 'Take the Ledger of Names', 'p_ledger', { f: ['i_ledger'] });
C(vault, 'Take the silver medal from its case', 'p_silver_take');
C(vault, 'Leave the vault', 'p_stacks');
C(ledger, 'Turn back to the vault', 'p_vault');
C(silver, 'Walk out along the causeway with the medal', 'p_end_thief', { f: [tide(5)] });
C(silver, 'Put it back and turn to the vault', 'p_vault');

/* ---------- the cellars ---------- */
const cellars = P('p_cellars', 'The Cellars', [
  'The iron stair ends at a lower floor of black water laying itself against the lowest shelves. A rowing boat is tied to a pillar, its oars shipped.',
  { t: 'The water is over your ankles now, and colder than it has any right to be.', n: [tide(3)] },
  { t: 'Something knocks softly on a pipe somewhere in the dark, as steady as a heart.', f: [tide(3)] }
], { adds: { i_tide: 1 } });
const oilstore = P('p_oilstore', 'The oil store', ['Rows of cans line the wall, most of them rusted shut. One at the back still has its stopper, and when you shake it something inside moves like good machine oil.'], { gives: ['i_moil'] });
const pump = P('p_pump', 'The pump room', ['The pump room hums with a pump that does not hum. A brass wheel as big as a door sits behind a grille, and a tag on the housing says: FEED ME OR WADE.']);
const pumprun = P('p_pump_run', 'The pump turns', ['The motor coughs, turns, and catches. Somewhere in the walls a great valve opens, and the water around your knees starts to leave in a long, reluctant sigh.'], { takes: ['i_moil'], adds: { i_tide: -3 } });
const deep = P('p_cellar_deep', 'The flooded aisle', [
  'You go down the flooded aisle with the lantern held high, and the water holds you up to the ribs. At the end an alcove has been built into the wall, and a grating hides a small dry shelf.',
  'On the shelf lies a pocket watch, stopped at ten past three. Someone wound it every day for years before they stopped, and it is still dry.'
], { gives: ['i_watch'] });
const drown = P('p_end_drown', 'Ending: the cellars', ['The floor drops away under you. You have time to think that the sea has been patient with this building for a very long time, and that it has not been patient with you.', 'The lantern floats for a while, and then the dark closes over it.'], { ending: true, valence: 'bad' });
const boat = P('p_boat', 'The rowing boat', ['You untie the boat and push off between the pillars, using the shelves for handholds. The cellar is a drowned town of its own, with streets of dark water and a skyline of boxes.', 'A steel door in the far wall stands just above the surface. You bring the boat alongside and climb through.']);
C(cellars, 'Wade to the pump room', 'p_pump');
C(cellars, 'Search the oil store', 'p_oilstore', { f: ['i_moil'] });
C(cellars, 'Untie the rowing boat', 'p_boat');
C(cellars, 'Wade deeper toward the knocking, into the flooded aisle', 'p_cellar_deep', { n: ['i_lantern'], f: ['i_watch'], check: { stat: 'i_nerve', target: 8, fail: 'p_end_drown' } });
C(cellars, 'Climb back up to the Atrium', 'p_atrium');
C(oilstore, 'Wade back to the middle of the cellar', 'p_cellars');
C(pump, 'Pour the machine oil in and turn the wheel', 'p_pump_run', { n: ['i_moil'], why: 'The pump is dry. It needs oil to run.' });
C(pump, 'Wade back to the middle of the cellar', 'p_cellars');
C(pumprun, 'Wade back to the middle of the cellar', 'p_cellars');
C(deep, 'Wade back to the foot of the stair', 'p_cellars');
C(boat, 'Go on into the Workshop', 'p_workshop');
C(boat, 'Row back to the foot of the stair', 'p_cellars');

/* ---------- the workshop ---------- */
const workshop = P('p_workshop', 'Workshop', [
  'Presses stand in rows, still inked, and a leather apron hangs on a nail, shaped like its wearer. Rolls of paper curl on the benches like sleeping cats.',
  { t: 'Water has begun to seep under the door, and the lowest drawers are floating.', n: [tide(3)] }
]);
const bench = P('p_bench', 'The clock-maker’s bench', ['Clock parts lie sorted in dishes: springs, pawls, a coil of fine chain. In the center of the bench, wrapped in a clean rag, sits a pendulum bob of polished brass as heavy as a fist.'], { gives: ['i_bob'] });
const press = P('p_press', 'The press', [
  'A single sheet is locked in the press. When you pull the proof it is the same warning you read on the Atrium desk, and the ink is still wet at the edges.',
  'In the margin there is a thumbprint, small and sure, as if someone had checked the page by touch.'
]);
const loft = P('p_loft', 'The glue loft', ['Up a short ladder the loft is full of drums of glue and bales of cloth. In the middle of it all stands a can of lamp oil with a green ribbon tied round its handle.'], { gives: ['i_oil'] });
C(workshop, 'Search the clock-maker’s bench', 'p_bench', { f: ['i_bob'] });
C(workshop, 'Look at the press', 'p_press');
C(workshop, 'Climb to the glue loft', 'p_loft', { f: ['i_oil'] });
C(workshop, 'Back to the Atrium', 'p_atrium');
for (const p of [bench, press, loft]) C(p, 'Step back into the Workshop', 'p_workshop');

/* ---------- the keeper's rooms and Ines ---------- */
const keeper = P('p_keeper', 'Keeper’s Rooms', [
  'A corridor of narrow doors, each with a brass number, and only one of them has light underneath.',
  'A kettle is steaming on a stove somewhere close, which is the first warm thing you have met since the causeway.'
]);
const kitchen = P('p_kitchen', 'The kitchen', [
  'The kitchen has been lived in by one person for a very long time. One cup is washed and upside down on the rack, and a second sits on the table with something written on its saucer.',
  { t: 'It says your name.', n: ['g_heir'] },
  { t: 'It says INSPECTOR, TOMORROW.', n: ['g_insp'] },
  { t: 'It says WHOEVER COMES FIRST.', n: ['g_thief'] }
]);
const bedroom = P('p_bedroom', 'The bedroom', [
  'The bed is made with the care of someone who expects inspection, and the window looks out at the sea through a single pane wiped clear in a circle.',
  'On the dresser a photograph shows two young people in oilskins on the causeway, laughing at whoever held the camera. On the back someone has written: Tomas and Ines, the week before.'
]);
const ines = P('p_ines', 'Ines Varga', [
  'The door opens before you knock. A woman in a gray cardigan stands there with a lamp in one hand and a watch chain, with nothing on it, in the other. She is perhaps seventy and has the look of someone awake for a very long time.',
  '“You are late,” says Ines Varga, “but not by much.”',
  { t: '“You have the Varga chin,” she adds, and almost smiles.', n: ['g_heir'] },
  { t: '“I know the coat,” she says. “It is the county’s. I wondered when they would come.”', n: ['g_insp'] },
  { t: '“And you are not who you say you are,” she says, mildly, “but you came through the rain, and that counts.”', n: ['g_thief'] }
]);
const iclock = P('p_ines_clock', 'About the clock', [
  '“It is not broken,” she says. “It is held.” She does not look toward the Atrium when she says it.',
  '“The clock runs the tide gate, and the gate runs the sea out of the Archive twice a day. I stopped it at ten past three because if the clock stops, so does the day, and what happened on that day cannot happen again.”',
  '“That was forty years ago,” she adds. “The sea has been winning for six weeks.”'
]);
const ibrother = P('p_ines_brother', 'About her brother', [
  '“Tomas was keeper before me,” she says. “He went down to the Cellars at ten past three on a Tuesday to close the gate by hand, because the clock would not do it in time.”',
  '“I could hear the water. I could hear him. I wound the clock backward as far as it would go, and then it stopped, and I decided that was the same as saving him.”'
], { adds: { i_nerve: 1 } });
const iwatch = P('p_ines_watch', 'Tomas’s watch', [
  'Her hand goes to her mouth. “Tomas’s.” She takes it as if it might be hot, and then closes both hands around it.',
  '“He kept it dry,” she whispers. “He kept it dry for me, down there, with the water coming up.” For a while neither of you says anything, and the kettle fills the silence.'
], { takes: ['i_watch'], gives: ['i_trust'], adds: { i_nerve: 1 } });
const ikey = P('p_ines_key', 'The vault key', ['She takes a small brass key from a green ribbon round her neck and presses it into your hand.', '“The Ledger of Names is in the vault. Every name the sea has taken is in it, and I would like them kept somewhere that is not here.”'], { gives: ['i_vaultkey'] });
C(keeper, 'Knock on the door with the light under it', 'p_ines');
C(keeper, 'Look into the kitchen', 'p_kitchen');
C(keeper, 'Look into the bedroom', 'p_bedroom');
C(keeper, 'Go along the passage to the Workshop', 'p_workshop');
C(keeper, 'Back to the Atrium', 'p_atrium');
C(kitchen, 'Back to the corridor', 'p_keeper');
C(bedroom, 'Back to the corridor', 'p_keeper');
C(ines, 'Ask about the clock', 'p_ines_clock');
C(ines, 'Ask about her brother', 'p_ines_brother');
C(ines, 'Show her the pocket watch', 'p_ines_watch', { n: ['i_watch'] });
C(ines, 'Ask her for the vault key', 'p_ines_key', { n: ['i_trust'], f: ['i_vaultkey'], why: 'She does not trust you enough yet.' });
C(ines, 'Leave her and go back to the corridor', 'p_keeper');
for (const p of [iclock, ibrother, iwatch, ikey]) C(p, 'Sit with her a little longer', 'p_ines');

/* ---------- the tower ---------- */
const tower = P('p_tower', 'The winding stair', [
  'The stair winds up through the dark in a spiral of iron, and your lantern turns it into a smaller dark.',
  { t: 'Water is running down the steps toward you, one step at a time.', n: [tide(5)] }
]);
const clockroom = P('p_clockroom', 'The clock room', [
  'The works fill the room: iron wheels as tall as a person, all of them still. The pendulum hangs where it has hung for years, a bare rod and an empty hook.',
  'On the wall someone has chalked a short list in a tidy hand: KEY. BOB. HER.'
]);
const clockwork = P('p_clockwork', 'The clockwork', [
  'You hang the bob on its hook and fit the iron key into the winding square. It goes in with a click you feel in your teeth.',
  'The rod trembles, wanting to swing. All it needs is one hand on the key.'
]);
const lampgal = P('p_lampgallery', 'Lamp gallery', [
  'The great lens is cold, a hive of glass, and a whole wall of windows leans out over the black water.',
  'Far off, the lights of the grain barges nose along the channel toward a reef they cannot see.',
  { t: 'The lens glows white and steady, and the channel is empty of danger.', n: ['i_lamp'] }
]);
const lamplit = P('p_lamp_lit', 'The lamp lit', ['The wick takes, and the great lens catches the flame and throws it, a long white road across the water.', 'The first barge turns in the channel, then the second, and a long way off a horn sounds that might be thanks.'], { takes: ['i_oil'], gives: ['i_lamp'] });
C(tower, 'Climb to the clock room', 'p_clockroom');
C(tower, 'Climb on to the lamp gallery', 'p_lampgallery');
C(tower, 'Go back down to the Atrium', 'p_atrium');
C(clockroom, 'Fit the bob and the key', 'p_clockwork', { n: ['i_bob', 'i_clockkey'], why: 'The works need a key and a bob. Both are somewhere in the Archive.' });
C(clockroom, 'Go back to the stair', 'p_tower');
C(clockwork, 'Wind the clock, with Ines’s blessing', 'p_end_clock_good', { n: ['i_trust'] });
C(clockwork, 'Wind the clock anyway', 'p_end_flood', { f: ['i_trust'] });
C(clockwork, 'Step back from the works', 'p_clockroom');
C(lampgal, 'Light the great lamp', 'p_lamp_lit', { n: ['i_oil', 'i_lantern'], f: ['i_lamp'], why: 'The lamp is dry. It needs oil, and a flame to light it from.' });
C(lampgal, 'Shelve the Ledger of Names in the lamp room, above the water', 'p_end_ledger', { n: ['i_ledger', 'i_lamp'] });
C(lampgal, 'Go back down the stair', 'p_tower');
C(lamplit, 'Look out over the barges', 'p_lampgallery');

/* ---------- the endings ---------- */
P('p_end_clock_good', 'Ending: ten past three', [
  'The clock moves. It is a small movement, a tremor in the rod and then the first tick in forty years, and it sounds like a door opening in an empty house.',
  'Far below, a great valve turns. The sea begins to leave the Archive by the way it came in, and Ines Varga, at the foot of the stair, puts her hand flat on the wall and listens to her brother’s hour end.',
  'At eleven minutes past three the clock strikes once. It is the loudest sound you have ever heard, and the kindest.'
], { ending: true, valence: 'good' });
P('p_end_ledger', 'Ending: the names are kept', [
  'You set the Ledger of Names on the shelf in the lamp room, where the sea has never reached. When you turn around, the pages of the blank section are already filling in.',
  'The clock below stays stopped, and the Archive will go on drowning twice a day. But the barges find the channel, the names stay dry, and in the morning a woman in a gray cardigan brings you tea without saying a word.'
], { ending: true, valence: 'good' });
P('p_end_flood', 'Ending: the gate opens early', [
  'You turn the key. The clock leaps forward, as if it had been holding its breath, and every wheel in the room spins at once.',
  'Somewhere below, the tide gate opens onto a sea that was not ready. The Archive fills from the bottom up, shelf by shelf, name by name, and the last sound you hear is a woman’s voice calling a name that is not yours.'
], { ending: true, valence: 'bad' });
P('p_end_sealed', 'Ending: sealed', [
  'The county’s seal comes down on the great doors with a sound like a stamp on a letter. SEALED, it says, and a date, and your name.',
  'You walk out along the last of the causeway with the tide at your ankles and the Archive dark behind you. In the morning you will file your report, and you will never be able to say what you left inside it.'
], { ending: true, valence: 'bad' });
P('p_end_thief', 'Ending: a quiet fortune', [
  'You walk out along the causeway with the silver medal warm in your pocket and the water lapping politely at the stones. Nobody stops you. Nobody even wakes.',
  'It sells for more than you hoped. It is a long time before you stop hearing, somewhere behind the sound of your own steps, a clock that is not ticking.'
], { ending: true });
P('p_end_stranded', 'Ending: the causeway is gone', [
  'You wade out of the doors and find the causeway gone and the mainland a smear of lights across a mile of water. The tide is at your waist and rising.',
  'There is nothing to do but go back inside and climb. The Archive will give you shelter, and a long wait, and a window to watch the sea take the stones one by one.'
], { ending: true, valence: 'bad' });

const story = {
  format: 'story-editor',
  version: 1,
  id: 's_archive',
  title: 'The Drowned Archive',
  author: '',
  start: 'p_start',
  items,
  givens: [{ id: 'gv_why', question: 'Why have you come to the Meridian Archive?', options: G }],
  passages: pages,
  game: { back: 'off', tracker: true, comfort: true, odds: true, place: false, pal: 'paper' }
};
for (const g of G) story.items.find(i => i.id === g).name = { g_heir: 'I am a Varga, come for a family ledger', g_insp: 'I am the county inspector, here to close it', g_thief: 'I came for what is in the vault' }[g];
writeFileSync(root + 'examples/the-drowned-archive.story.json', JSON.stringify(story, null, 1));
console.log(`${pages.length} pages, ${pages.filter(p => p.ending).length} endings, ${pages.reduce((n, p) => n + p.blocks.reduce((m, b) => m + b.text.split(/\s+/).length, 0), 0)} words`);
