/* HoopaDex — a move's power, accuracy and PP in the generation on screen
 * Run: node tests/test-move-stats.js
 *
 * The app read exactly one field out of PokeAPI's `past_values` — `pv.type` — and dropped `power`,
 * `accuracy` and `pp` on the floor. 140 moves changed at least one of those. Measured on the live
 * build in Generation I before the fix:
 *
 *     Wing Attack   shown 60    actually 35
 *     Tackle        shown 40    actually 35
 *     Jump Kick     shown 100   actually 70
 *     Vine Whip     shown 45    actually 35
 *
 * AND IT REACHED THE CALCULATOR. `calcLocalRolls({power: md.power, ...})` took the modern number,
 * and `TAB_RELEVANCE` has no rule for `calc`, so the Damage Calc tab is visible in every generation.
 * A wrong label on a page is bad. A wrong number out of something called a calculator is worse, and
 * that is why this is a suite rather than a note in the backlog.
 *
 * The second defect was structural and is the one that would have come back. `moveCache` was
 * written from SIX places, each building the object by hand, and four of them set `pastTypes:{}`
 * outright — so whether the app knew a move's history depended on which code path fetched it first.
 * Open a move from the Pokedex and it was generation-aware; reach the same move through Team
 * Builder and it was not. Both render. All six now call makeMoveRecord.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

const vgLine = lines.find(l => l.startsWith('const VG_GEN='));
const start = lines.findIndex(l => l.startsWith('function movePastValues('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('const PASTABIL='));
if (!vgLine || start < 0 || end < 0) throw new Error('could not locate the move-record helpers');
const app = (0, eval)(
  vgLine + '\nvar GEN=9; function getDataGenNum(){return GEN}\n' +
  lines.slice(start, end).join('\n') +
  '\n;({movePastValues,makeMoveRecord,pastValueForGen,getMovePowerForGen,getMoveAccForGen,getMovePPForGen,' +
  'setGen:function(g){GEN=g}})'
);
const { movePastValues, makeMoveRecord, getMovePowerForGen, getMoveAccForGen, getMovePPForGen, setGen } = app;

/* A real Jump Kick shape, trimmed to the fields that matter. PokeAPI records the value AS IT WAS in
   that version group, so diamond-pearl 70 covers Generation IV and everything below it, black-white
   85 covers Generation V, and the top-level 100 covers Generation VI onward. */
const JUMP_KICK = {
  name: 'jump-kick', power: 100, accuracy: 95, pp: 10,
  type: { name: 'fighting' }, damage_class: { name: 'physical' },
  generation: { name: 'generation-i' }, effect_entries: [], flavor_text_entries: [],
  past_values: [
    { version_group: { name: 'diamond-pearl' }, power: 70, accuracy: null, pp: 25, type: null },
    { version_group: { name: 'black-white' }, power: 85, accuracy: null, pp: null, type: null },
  ],
};
const jk = makeMoveRecord(JUMP_KICK);

check(jk.power === 100 && jk.pp === 10, 'the modern values stay as the baseline', jk.power + '/' + jk.pp);
/* THE CONVENTION, and it is the opposite of every other table in this project. A past_values entry
   is the value the move had BEFORE the version group it is filed against — so `diamond-pearl: 70`
   means 70 in Generations I to III, and Generation IV is already the next value up.

   These expectations were originally written the other way round and passed, because the code had
   the same mistake. They were corrected against the Smogon engine, which carries the per-generation
   base powers directly: Jump Kick 70/70/70/85/100 for Generations I to V. */
check(getMovePowerForGen(jk, 1) === 70, 'Gen I Jump Kick is 70 base power', getMovePowerForGen(jk, 1));
check(getMovePowerForGen(jk, 3) === 70, 'and Gen III is still 70', getMovePowerForGen(jk, 3));
check(getMovePowerForGen(jk, 4) === 85,
  'but Gen IV is 85 — the diamond-pearl entry describes the generations BELOW it',
  getMovePowerForGen(jk, 4));
check(getMovePowerForGen(jk, 5) === 100, 'and Gen V is already the modern 100', getMovePowerForGen(jk, 5));
check(getMovePowerForGen(jk, 9) === 100, 'as is Gen IX');

/* PP was recorded on the Gen IV row only. Generation V has no pp of its own, so it must fall
   through to the next recorded value ABOVE it — not to the Gen IV one below, and not to null. */
check(getMovePPForGen(jk, 3) === 25, 'PP reads the diamond-pearl entry in the generations below it',
  getMovePPForGen(jk, 3));
check(getMovePPForGen(jk, 4) === 10,
  'and Gen IV, having no PP entry above it, takes the modern value', getMovePPForGen(jk, 4));
/* A null in past_values means "unchanged at this point", not "zero". Writing it through would blank
   a real number, and a blank accuracy renders as an em dash — a move that never misses. */
check(getMoveAccForGen(jk, 1) === 95, 'a null past value does not blank the real one', getMoveAccForGen(jk, 1));

// --- the extraction itself ----------------------------------------------------------------------
const past = movePastValues(JUMP_KICK);
check(past[4] && past[4].power === 70, 'a version group is mapped to its generation', JSON.stringify(past));
/* Bite is the clearest case of the convention, and the one that proves the old code was wrong: it
   is filed as gold-silver = normal, and Bite was Normal in Generation I ONLY. */
const biteT = makeMoveRecord({ name: 'bite', power: 60, accuracy: 100, pp: 25, type: { name: 'dark' },
  damage_class: { name: 'physical' }, generation: { name: 'generation-i' },
  effect_entries: [], flavor_text_entries: [],
  past_values: [{ version_group: { name: 'gold-silver' }, type: { name: 'normal' }, power: null, accuracy: null, pp: null }] });
check(app.pastValueForGen(biteT.pastTypes, 1) === 'normal', 'Bite is Normal in Gen I');
check(app.pastValueForGen(biteT.pastTypes, 2) === undefined,
  'and Dark from Gen II — the gold-silver entry does NOT cover Generation II',
  app.pastValueForGen(biteT.pastTypes, 2));
check(!('accuracy' in (past[4] || {})), 'and a null field is not recorded at all');
check(Object.keys(movePastValues({ past_values: [{ version_group: { name: 'not-a-game' }, power: 1 }] })).length === 0,
  'an unmapped version group is ignored rather than filed under generation undefined');
check(Object.keys(movePastValues({})).length === 0, 'a move with no past_values does not throw');

// --- type history now comes from the same extraction ---------------------------------------------
const bite = makeMoveRecord({
  name: 'bite', power: 60, accuracy: 100, pp: 25, type: { name: 'dark' },
  damage_class: { name: 'physical' }, generation: { name: 'generation-i' },
  effect_entries: [], flavor_text_entries: [],
  past_values: [{ version_group: { name: 'gold-silver' }, type: { name: 'normal' }, power: null, accuracy: null, pp: null }],
});
check(bite.pastTypes[2] === 'normal',
  'pastTypes is derived from the same extraction rather than hand-set to {}', JSON.stringify(bite.pastTypes));

// --- every cache write goes through the one builder -----------------------------------------------
/* The assertion that stops the six-copies problem returning. Four of the six sites used to set
   pastTypes:{}, which is not a visible bug — the page renders either way, with a modern type in an
   old generation. */
const handBuilt = (src.match(/moveCache\[[a-zA-Z]+\]=\{name:d\.name/g) || []).length;
check(handBuilt === 0, 'no move cache entry is still built by hand', handBuilt + ' hand-built sites remain');
check((src.match(/makeMoveRecord\(d\)/g) || []).length >= 6,
  'all six fetch paths build their record the same way');
/* Scoped to records built from API data. Two `pastTypes:{}` literals remain and both are correct:
   they are the placeholders written when a fetch FAILS or a move is stubbed, where an empty
   history is the true answer rather than a dropped field. Asserting on the bare string flagged
   those and would have pushed someone to "fix" a placeholder into claiming data it never had. */
const emptyFromApi = lines.filter(l => /pastTypes:\{\}/.test(l) && /d\.name/.test(l)).length;
check(emptyFromApi === 0,
  'no record built from API data hard-codes an empty type history', emptyFromApi + ' sites');

// --- the calculator ---------------------------------------------------------------------------------
/* These getters used to feed the local damage engine too. That engine was deleted in 5.37 — it
   disagreed with the Smogon bundle in every generation below VI — so the calculator now resolves
   base power inside the engine, from the generation it was constructed with. See
   tests/test-calc-engine.js. What remains here is the DISPLAY path: the move tooltip, the moves
   table and the search meta, which read these getters and have no engine to ask. */
check(!/calcLocalRolls/.test(src),
  'the local damage engine is gone, so nothing here feeds it', 'calcLocalRolls is still present');
check(/getMovePowerForGen\(m\)/.test(src) || /getMovePowerForGen\(md\)/.test(src),
  'the display sites still resolve power for the selected generation');

// --- the getters follow the selection ---------------------------------------------------------------
setGen(1);
check(getMovePowerForGen(jk) === 70, 'with no argument the getters read the selected generation', getMovePowerForGen(jk));
setGen(9);
check(getMovePowerForGen(jk) === 100, 'and follow it when it changes');
check(getMovePowerForGen(null) === null || getMovePowerForGen(null) === undefined,
  'a missing move does not throw');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
