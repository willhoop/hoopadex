/* HoopaDex — dual-type species lookup tests
 * Run: node tests/test-dual-typing.js
 *
 * Slices the REAL POKEMON_PAST_TYPES table, filterTypesForGen(), dualTypeMatchesGen() and
 * hasPastTypeOverride() out of app/index.html so the tests cannot drift from shipped code.
 *
 * The Defending Type Calculator lists the species that have the selected pair. Membership comes
 * from PokeAPI's per-type lists, which are CURRENT typing only — so the generation correction is
 * the entire correctness risk. Gen 1 Magnemite is pure Electric; if the correction is skipped it
 * appears under Electric/Steel in Gen 1, which is exactly the class of wrong-but-plausible output
 * that renders identically to a right one.
 *
 * These two functions are the whole decision, deliberately kept pure so this suite needs neither a
 * DOM nor a network.
 */
const fs = require('fs');
const path = require('path');

// Defaults to the shipped file. HOOPADEX_SRC points it at a mutated copy instead, so the "does
// this suite go red on broken code" check never has to damage the working tree — an auto-commit
// hook here would happily commit and push a file broken for ten seconds.
const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

function slice(startsWith, endsWith) {
  const a = lines.findIndex(l => l.startsWith(startsWith));
  const b = lines.findIndex((l, i) => i > a && l.startsWith(endsWith));
  if (a < 0 || b < 0) throw new Error('could not locate ' + startsWith + ' .. ' + endsWith);
  return lines.slice(a, b).join('\n');
}

// Table + generation resolver, then the two pure predicates that sit on top of them.
const dataPart = slice('const POKEMON_PAST_TYPES={', '// When the list is ordered by a stat');
const logicPart = slice('function dualTypeMatchesGen(', 'let dualMonToken=0;');

const app = eval(dataPart + '\n' + logicPart +
  '\n;({POKEMON_PAST_TYPES,filterTypesForGen,dualTypeMatchesGen,hasPastTypeOverride})');

const { dualTypeMatchesGen: match, hasPastTypeOverride: override } = app;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

// --- the slice actually brought the real code across -----------------------------------
check(typeof match === 'function', 'dualTypeMatchesGen was sliced out of the app', typeof match);
check(typeof override === 'function', 'hasPastTypeOverride was sliced out of the app', typeof override);
check(Object.keys(app.POKEMON_PAST_TYPES).length >= 20, 'the past-types table came across', Object.keys(app.POKEMON_PAST_TYPES).length);

// --- Magnemite: the canonical historical retype (pure Electric until Gen 2) --------------
check(match(81, 2, 'electric', 'steel', ['electric', 'steel']) === true,
  'Gen 2 Magnemite IS Electric/Steel');
check(match(81, 1, 'electric', 'steel', ['electric', 'steel']) === false,
  'Gen 1 Magnemite is NOT Electric/Steel — the current-typing intersection must be corrected');
check(match(82, 1, 'electric', 'steel', ['electric', 'steel']) === false,
  'Gen 1 Magneton is NOT Electric/Steel either');

// --- the Fairy retypes of Gen 6 ---------------------------------------------------------
check(match(39, 6, 'normal', 'fairy', ['normal', 'fairy']) === true,
  'Gen 6 Jigglypuff IS Normal/Fairy');
check(match(39, 5, 'normal', 'fairy', ['normal', 'fairy']) === false,
  'Gen 5 Jigglypuff is NOT Normal/Fairy — Fairy did not exist');

// --- Togetic: the add-back path. Its Gen 5 typing is a pair it no longer has, so it can only
//     be found by walking the past-types table, never by intersecting current type lists. ----
check(match(176, 5, 'normal', 'flying', []) === true,
  'Gen 5 Togetic IS Normal/Flying, found without any current-typing input');
check(match(176, 5, 'fairy', 'flying', ['fairy', 'flying']) === false,
  'Gen 5 Togetic is NOT Fairy/Flying');
check(match(176, 6, 'fairy', 'flying', ['fairy', 'flying']) === true,
  'Gen 6 Togetic IS Fairy/Flying');

// --- the override gate decides whether the historical list is authoritative --------------
check(override(176, 5) === true, 'the past-types table overrides Togetic in Gen 5');
check(override(176, 6) === false, 'the past-types table does not override Togetic in Gen 6');
check(override(6, 5) === false, 'a species absent from the table is never overridden');

// --- species with no historical revision must still resolve normally --------------------
check(match(6, 3, 'fire', 'flying', ['fire', 'flying']) === true,
  'Gen 3 Charizard IS Fire/Flying');
check(match(6, 9, 'flying', 'fire', ['fire', 'flying']) === true,
  'the selected pair is order-independent');
check(match(6, 3, 'fire', 'dragon', ['fire', 'flying']) === false,
  'a pair the species does not have is rejected');

// --- the type-existence fallback must not claim a type that did not exist yet ------------
check(match(700, 5, 'fairy', 'normal', ['fairy']) === false,
  'Gen 5 cannot return a Fairy typing for a species with no table entry');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
