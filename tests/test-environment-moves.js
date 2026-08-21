/* HoopaDex — moves whose result depends on where the battle is happening
 * Run: node tests/test-environment-moves.js
 *
 * Reported from the live site: "for like nature power i want to know what the moves turns into
 * based on the location". The app showed PokeAPI's sentence — "Uses a move which depends upon the
 * terrain" — and stopped there, which tells a reader an answer exists and then withholds it.
 *
 * THIS IS THE ONE TABLE NOT DERIVED FROM SHOWDOWN, AND THAT IS THE POINT
 * ----------------------------------------------------------------------
 * Showdown is a battle simulator with no overworld. It has no cave or tall grass to be standing in,
 * so its per-generation mods collapse the whole table to a single hardcoded call:
 *
 *     gen3 mod: this.actions.useMove('swift', target)        // one row of a nine-row table
 *     gen4 mod: this.actions.useMove('triattack', pokemon)
 *     gen5 mod: this.actions.useMove('earthquake', pokemon)
 *
 * Each is a correct answer about a Showdown battle and a wrong answer about Ruby. Reaching for the
 * usual source here would have produced a confident, precise, single-row lie — this project's
 * defining failure mode, arrived at through the source it normally trusts most. The source is
 * Bulbapedia's wikitext instead, and the four terrain rows Showdown DOES model are cross-checked
 * against it by the generator, which fails the build on disagreement.
 *
 * What these assertions defend is the parser, because a wiki-markup parser fails quietly. Its
 * failure mode is not a crash: it is a plausible-looking table with a wrong name in it. Both real
 * defects found while building it were of that shape — one produced "volcano|Volcano}}" as the name
 * of a place, the other returned an entirely empty table for two of the three moves — and neither
 * would have thrown.
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

// --- load the shipped renderer, not a copy of it ----------------------------------------------
const envLine = lines.find(l => l.startsWith('const ENVMOVES='));
const ixLine = lines.find(l => l.startsWith('const IX='));
const start = lines.findIndex(l => l.startsWith('function renderEnvironmentMove('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function renderVariableMoveInfo('));
if (!envLine || !ixLine || start < 0 || end < 0) throw new Error('could not locate renderEnvironmentMove');
const app = (0, eval)(
  ixLine + '\n' + envLine + '\n' +
  'function ixRoman(g){return ["","I","II","III","IV","V","VI","VII","VIII","IX"][g]||g}\n' +
  'function ixTitle(s){return String(s).replace(/-/g," ").replace(/(^|\\s)[a-z]/g,c=>c.toUpperCase())}\n' +
  'var TC={};\n' +
  lines.slice(start, end).join('\n') +
  '\n;({ENVMOVES,renderEnvironmentMove})'
);
const { ENVMOVES, renderEnvironmentMove } = app;

// --- the embedded table is the generated one ---------------------------------------------------
const embedPath = path.join(ROOT, 'data', 'environment-moves.embed.json');
const a = src.indexOf('/*BEGIN-ENVMOVES*/'), b = src.indexOf('/*END-ENVMOVES*/');
check(fs.existsSync(embedPath), 'data/environment-moves.embed.json exists');
check(src.slice(a + '/*BEGIN-ENVMOVES*/'.length, b) === fs.readFileSync(embedPath, 'utf8').trim(),
  'the table embedded in the app is byte-identical to the generated one',
  'run: node build/generate-environment-moves.js && node build/embed-environment-moves.js');

// --- no wiki markup survived the parse ----------------------------------------------------------
/* The nested-template bug produced rows like {where:"volcano|Volcano}}"}. It did not throw, it did
   not empty the table, and every count still looked right — eleven rows across three moves simply
   named a place that does not exist. A character-class check is the only thing that catches it. */
const dirty = [];
Object.keys(ENVMOVES).forEach(slug => {
  const gens = ENVMOVES[slug].gens || {};
  Object.keys(gens).forEach(g => {
    (gens[g].rows || []).forEach(r => {
      if (/[{}\[\]|]/.test(r.where + r.gives + (r.type || ''))) dirty.push(slug + ' g' + g + ': ' + JSON.stringify(r));
    });
  });
});
check(dirty.length === 0, 'no row carries leftover wiki markup', dirty.slice(0, 3).join(' | '));

// --- all three moves parsed, across the generations they existed in -----------------------------
/* Two of the three came back completely empty on the first run, because their pages nest the
   generation headings one level deeper and write "Generation VIII onwards". An empty table renders
   as no panel at all, which is indistinguishable from "this move has no environment table". */
['nature-power', 'secret-power', 'camouflage'].forEach(slug => {
  const gens = (ENVMOVES[slug] || {}).gens || {};
  const withRows = Object.keys(gens).filter(g => (gens[g].rows || []).length);
  check(withRows.length >= 5, slug + ' has tables for at least five generations', withRows.join(','));
});

// --- Generation III: the case that was actually asked about --------------------------------------
const g3 = ENVMOVES['nature-power'].gens[3].rows;
const gives = (gen, where) => {
  const row = ENVMOVES['nature-power'].gens[gen].rows.find(r => new RegExp(where, 'i').test(r.where));
  return row ? row.gives : null;
};
check(g3.length === 9, 'Generation III Nature Power has nine environments', g3.length);
check(gives(3, 'cave') === 'Shadow Ball', 'a Gen III cave gives Shadow Ball', gives(3, 'cave'));
check(gives(3, 'tall grass') === 'Stun Spore', 'Gen III tall grass gives Stun Spore', gives(3, 'tall grass'));
check(gives(3, 'long grass') === 'Razor Leaf', 'and long grass gives Razor Leaf — a different row', gives(3, 'long grass'));
check(gives(3, 'sea water') === 'Surf', 'sea water gives Surf', gives(3, 'sea water'));
check(gives(3, 'pond water') === 'BubbleBeam', 'pond water gives BubbleBeam, not Surf', gives(3, 'pond water'));
check(gives(3, 'underwater') === 'Hydro Pump', 'and underwater gives Hydro Pump', gives(3, 'underwater'));
check(gives(3, 'building') === 'Swift', 'a building gives Swift', gives(3, 'building'));

/* The mapping changed in every generation, which is the whole reason this is generation-indexed.
   A cave is the clearest illustration: three different moves in three eras. If these ever collapse
   to one answer, the table has been flattened and the app is telling every generation the same
   thing — the failure this project exists to prevent. */
check(gives(5, 'cave') === 'Rock Slide', 'a Gen V cave gives Rock Slide instead', gives(5, 'cave'));
check(gives(6, 'cave') === 'Power Gem', 'and a Gen VI cave gives Power Gem', gives(6, 'cave'));
check(new Set([gives(3, 'cave'), gives(5, 'cave'), gives(6, 'cave')]).size === 3,
  'three generations, three different answers for the same place');

/* Showdown's per-generation mods say Swift, Tri Attack and Earthquake for gens 3-5. Those are the
   simulator's stand-ins for having no overworld. If any of them ever becomes the ONLY row for its
   generation, this data has been re-derived from Showdown and is wrong. */
check(ENVMOVES['nature-power'].gens[4].rows.length > 1,
  'Gen IV is a table, not the single row Showdown collapses it to');
check(ENVMOVES['nature-power'].gens[5].rows.length > 1, 'and so is Gen V');

// --- the terrain moves, which are the part Showdown can confirm ---------------------------------
check(gives(8, 'Grassy Terrain') === 'Energy Ball', 'Grassy Terrain gives Energy Ball');
check(gives(8, 'Misty Terrain') === 'Moonblast', 'Misty Terrain gives Moonblast');
check(gives(8, 'Electric Terrain') === 'Thunderbolt', 'Electric Terrain gives Thunderbolt');
check(gives(8, 'Psychic Terrain') === 'Psychic', 'Psychic Terrain gives Psychic');

// --- the rendered panel -------------------------------------------------------------------------
const r3 = renderEnvironmentMove('nature-power', 3);
check(/Shadow Ball/.test(r3) && /Stun Spore/.test(r3), 'the Gen III panel names the moves', r3.slice(0, 120));
check(/Gen III/.test(r3), 'and says which generation it is describing');
check(!/Power Gem/.test(r3), 'and does not leak a later generation into it');
check(/Power Gem/.test(renderEnvironmentMove('nature-power', 6)), 'while Gen VI does show Power Gem');

/* Gen IX has no table because the move cannot be used. Rendering nothing there would be worse than
   useless: the reader would conclude the app had no data, rather than that the answer is "you
   cannot pick this move". */
const r9 = renderEnvironmentMove('nature-power', 9);
check(/cannot be selected/.test(r9), 'Gen IX says the move cannot be selected at all', r9);
check(!/<table/.test(r9), 'and shows no table, because there is nothing to tabulate');

check(renderEnvironmentMove('tackle', 9) === '', 'a move with no environment table renders nothing');
check(renderEnvironmentMove('nature-power', 1) === '',
  'and neither does a generation before the move existed');
check(renderEnvironmentMove(undefined, 9) === '', 'a missing move name does not throw');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
