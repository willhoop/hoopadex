/* HoopaDex — historical Pokémon typing tests
 * Run: node tests/test-past-types.js
 *
 * Slices the REAL POKEMON_PAST_TYPES table and the REAL filterTypesForGen() out of
 * app/index.html rather than copying them, so the tests cannot drift from shipped code.
 *
 * They pin the behaviour fixed on 2026-08-02. Before it, the app had no record of what a
 * species used to be: filterTypesForGen() merely DELETED types that did not exist yet.
 * Subtraction works when Fairy was ADDED to a species, but loses a type where Fairy
 * REPLACED one — Togetic and Togekiss were Normal/Flying and rendered as pure Flying in
 * Generations II–V. That is not cosmetic: Normal/Flying is immune to Ghost and neutral to
 * Fighting, while pure Flying is neither.
 *
 * Expected values are cross-checked against Serebii's Black/White dex (Togetic is listed
 * there as Normal/Flying); the table is generated from Pokémon Showdown's mod data.
 */
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8').split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('const POKEMON_PAST_TYPES='));
const fnAt = lines.findIndex((l, i) => i > start && l.startsWith('function filterTypesForGen'));
const end = lines.findIndex((l, i) => i > fnAt && l === '}');
if (start < 0 || end < 0) throw new Error('could not locate POKEMON_PAST_TYPES / filterTypesForGen');
const app = eval(lines.slice(start, end + 1).join('\n') + '\n;({POKEMON_PAST_TYPES,filterTypesForGen})');
const TABLE = app.POKEMON_PAST_TYPES;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + detail); }
}
// now = present-day typing as PokeAPI serves it
function t(name, id, now, gen, want) {
  const got = app.filterTypesForGen(now, gen, id).join('/');
  check(got === want, `${name} gen ${gen} = ${want}`, `got ${got}`);
}

// --- the regression this suite exists for -------------------------------------------
// Fairy REPLACED Normal here, so subtraction loses a type outright.
t('Togetic',  176, ['fairy', 'flying'], 5, 'normal/flying');
t('Togetic',  176, ['fairy', 'flying'], 2, 'normal/flying');
t('Togetic',  176, ['fairy', 'flying'], 6, 'fairy/flying');
t('Togekiss', 468, ['fairy', 'flying'], 5, 'normal/flying');
t('Togekiss', 468, ['fairy', 'flying'], 9, 'fairy/flying');

// --- Fairy ADDED: subtraction happened to be right, must stay right ------------------
t('Jigglypuff', 39,  ['normal', 'fairy'],  5, 'normal');
t('Marill',     183, ['water', 'fairy'],   5, 'water');
t('Mawile',     303, ['steel', 'fairy'],   5, 'steel');
t('Gardevoir',  282, ['psychic', 'fairy'], 5, 'psychic');
t('Whimsicott', 547, ['grass', 'fairy'],   5, 'grass');

// --- Fairy REPLACED the only type: falls back to a single type -----------------------
t('Clefable',  36,  ['fairy'], 5, 'normal');
t('Clefable',  36,  ['fairy'], 6, 'fairy');
t('Granbull',  210, ['fairy'], 5, 'normal');
t('Togepi',    175, ['fairy'], 5, 'normal');

// --- Steel arriving in Gen II --------------------------------------------------------
t('Magnemite', 81, ['electric', 'steel'], 1, 'electric');
t('Magnemite', 81, ['electric', 'steel'], 2, 'electric/steel');
t('Magneton',  82, ['electric', 'steel'], 1, 'electric');

// --- species not in the table still get the subtractive fallback ---------------------
t('Charizard',  6, ['fire', 'flying'],  5, 'fire/flying');
t('Umbreon',  197, ['dark'],            1, 'normal'); // Dark did not exist in Gen I
t('Scizor',   212, ['bug', 'steel'],    1, 'bug');

// --- structural invariants ------------------------------------------------------------
const VALID = new Set(['normal','fire','water','electric','grass','ice','fighting','poison','ground',
  'flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']);
const entries = Object.entries(TABLE);
check(entries.length > 0, 'table is not empty', `${entries.length} entries`);
check(entries.every(([, r]) => Object.values(r).every(ts => ts.length >= 1 && ts.length <= 2)),
  'every historical typing has one or two types', '');
check(entries.every(([, r]) => Object.values(r).every(ts => ts.every(x => VALID.has(x)))),
  'every type name is a real type', '');
// A historical entry must never contain a type that did not exist by its own cutoff.
const anachronism = entries.filter(([, r]) => Object.entries(r).some(([cut, ts]) =>
  ts.includes('fairy') || (+cut <= 2 && (ts.includes('dark') || ts.includes('steel')))));
check(anachronism.length === 0, 'no historical entry claims a type that did not exist yet',
  `offenders: ${anachronism.map(([id]) => id).join(', ')}`);

// The cutoff closest to the selected generation must win. No shipping species is revised twice,
// so the mechanism is proved on a synthetic one — without this, reading the cutoffs from the wrong
// end of the list passes unnoticed.
TABLE[999999] = { 2: ['bug'], 6: ['bug', 'steel'] };
check(app.filterTypesForGen(['bug','fairy'], 1, 999999).join('/') === 'bug',
  'twice-revised species: gen 1 takes the earliest cutoff', app.filterTypesForGen(['bug','fairy'],1,999999).join('/'));
check(app.filterTypesForGen(['bug','fairy'], 3, 999999).join('/') === 'bug/steel',
  'twice-revised species: gen 3 takes the later cutoff', app.filterTypesForGen(['bug','fairy'],3,999999).join('/'));
check(app.filterTypesForGen(['bug','fairy'], 6, 999999).join('/') === 'bug/fairy',
  'twice-revised species: gen 6 is unmodified', app.filterTypesForGen(['bug','fairy'],6,999999).join('/'));
delete TABLE[999999];

// A duplicate key would silently drop an entry, exactly as it did in PAST_STATS.
const literal = lines.slice(start, lines.findIndex((l, i) => i > start && l.trim() === '};') + 1).join('\n');
const seen = new Map();
for (const m of literal.matchAll(/(?:^|[,{\s])(\d+):\s*\{/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
check(dupes.length === 0, 'no duplicate ids in the POKEMON_PAST_TYPES literal', `duplicated: ${dupes.join(', ')}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
