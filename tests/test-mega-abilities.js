/* HoopaDex — Legends: Z-A mega ability tests
 * Run: node tests/test-mega-abilities.js
 *
 * Why this suite exists. An architecture audit on 2026-08-03 mutated
 * CHAMP_MEGA_ABILITIES — it changed Mega Barbaracle's ability from Tough Claws
 * to Levitate — and ran all 23 suites. Every one of them stayed green. The
 * table was generated from Pokemon Showdown by build/generate-mega-abilities.js
 * and committed to data/mega-abilities.json, but nothing ever compared the two
 * again, so the shipped table could be edited to say anything at all.
 *
 * data/mega-abilities.json is derived from Showdown's pokedex.ts, which is a
 * published artefact, so this is a genuine correctness check and not merely a
 * consistency one: if the app and the derivation disagree, the app is wrong.
 *
 * Regenerate with `node build/generate-mega-abilities.js`; never hand-edit
 * either side.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const CACHE = path.join(ROOT, 'data', 'mega-abilities.json');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

// --- slice the real table out of the app ------------------------------------------------
const i = src.indexOf('const CHAMP_MEGA_ABILITIES=[');
check(i >= 0, 'CHAMP_MEGA_ABILITIES is present in the app');
const j = src.indexOf('];', i);
const literal = src.slice(i + 'const CHAMP_MEGA_ABILITIES='.length, j + 1);
const APP = eval('(' + literal + ')');

check(Array.isArray(APP) && APP.length > 0, 'the table parses and is not empty', APP.length);

// --- compare against the committed derivation -------------------------------------------
const derived = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
const ROWS = derived.rows;

check(ROWS.length === APP.length,
  'the app ships exactly as many rows as the derivation produced',
  `app ${APP.length}, derived ${ROWS.length}`);

const key = r => r.pokemon + ' => ' + r.ability;
const appSet = new Set(APP.map(key));
const derSet = new Set(ROWS.map(key));

const wrong = [...appSet].filter(k => !derSet.has(k));
const absent = [...derSet].filter(k => !appSet.has(k));

// This is the assertion the mutation defeated. It compares content, not counts:
// swapping one ability for another leaves the length identical.
check(wrong.length === 0,
  'every ability the app claims is the one Showdown records — regenerate, do not edit',
  wrong.join(' | '));
check(absent.length === 0,
  'no derived pairing was dropped on the way into the app',
  absent.join(' | '));

// --- structural invariants ---------------------------------------------------------------
check(APP.every(r => typeof r.pokemon === 'string' && r.pokemon.startsWith('Mega ')),
  'every row names a Mega forme');
check(APP.every(r => typeof r.ability === 'string' && r.ability.trim() === r.ability && r.ability.length > 2),
  'every ability name is presentable');

// A species may legitimately appear twice (two possible abilities), but an identical
// pokemon+ability pair twice is a copy-paste fault, and a Set would hide it at runtime.
const seen = new Map();
APP.forEach(r => seen.set(key(r), (seen.get(key(r)) || 0) + 1));
const dupes = [...seen].filter(([, n]) => n > 1).map(([k]) => k);
check(dupes.length === 0, 'no duplicated pokemon+ability pair', dupes.join(' | '));

check(typeof derived.zaMegaFormes === 'number' && derived.zaMegaFormes > 0,
  'the derivation records how many Z-A mega formes it found', derived.zaMegaFormes);
check(/generate-mega-abilities\.js/.test(derived.generated || ''),
  'the derivation says which generator produced it', derived.generated);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
