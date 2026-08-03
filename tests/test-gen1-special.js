/* HoopaDex — Generation I Special stat tests
 * Run: node tests/test-gen1-special.js
 *
 * Generation I had ONE Special stat, used for both attacking and defending. Gen II split it in two.
 * The app showed the modern pair for Gen I, which is a different game's stat line.
 *
 * The trap is that the obvious shortcut is wrong. "Just show modern Special Attack" fails for 46 of
 * the 151 species, because the split frequently kept the old Special as the new Special DEFENCE and
 * raised Special Attack — Charizard's Gen I Special was 85, its modern SpA is 109 and SpD is 85.
 * Chansey's was 105 against a modern SpA of 35. Neither modern stat is reliably the Gen I value, so
 * the table is generated from Showdown's gen1 mod, where spa === spd encodes the single stat.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

const m = src.match(/^const GEN1_SPECIAL=(\{.*?\});$/m);
check(!!m, 'GEN1_SPECIAL is embedded in the app');
if (!m) { console.log('\n' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); }
const SPECIAL = eval('(' + m[1] + ')');

// --- coverage ----------------------------------------------------------------------------
check(Object.keys(SPECIAL).length === 151, 'all 151 Generation I species are covered',
  Object.keys(SPECIAL).length);
const missing = [];
for (let i = 1; i <= 151; i++) if (!(i in SPECIAL)) missing.push(i);
check(missing.length === 0, 'no gaps in the dex range', missing);
check(Object.keys(SPECIAL).every(k => +k >= 1 && +k <= 151),
  'and nothing outside Generation I crept in');
const bad = Object.entries(SPECIAL).filter(([, v]) => !(v >= 1 && v <= 255));
check(bad.length === 0, 'every Special value is a plausible base stat', bad);

// --- the values that prove it is real Gen I data, not modern Special Attack ---------------
// Each of these differs from the modern SpA, so a shortcut implementation gets them wrong.
const KNOWN = [
  [6, 85, 'Charizard'],       // modern SpA 109
  [113, 105, 'Chansey'],      // modern SpA 35
  [131, 95, 'Lapras'],        // modern SpA 85
  [130, 100, 'Gyarados'],     // modern SpA 60
  [144, 125, 'Articuno'],     // modern SpA 95
  [97, 115, 'Hypno'],         // modern SpA 73
  [73, 120, 'Tentacruel'],    // modern SpA 80
  [128, 70, 'Tauros'],        // modern SpA 40
  [59, 80, 'Arcanine'],       // modern SpA 100
  [65, 135, 'Alakazam'],      // unchanged by the split — included so the test is not all one way
];
KNOWN.forEach(([id, val, name]) => check(SPECIAL[id] === val,
  name + ' (#' + id + ') has a Gen I Special of ' + val, SPECIAL[id]));

// --- the derivation is committed and agrees with what shipped -----------------------------
const CACHE = path.join(ROOT, 'data', 'gen1-special.json');
check(fs.existsSync(CACHE), 'the derivation is committed alongside the app');
if (fs.existsSync(CACHE)) {
  const d = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const drift = Object.keys(SPECIAL).filter(k => d.special[k] !== SPECIAL[k]);
  check(drift.length === 0, 'the embedded table still matches the derivation — regenerate, do not edit',
    drift.slice(0, 8));
  check(d.differsFromModernSpA.length === 46,
    '46 species differ from modern Special Attack, which is why this table has to exist',
    d.differsFromModernSpA.length);
}

// --- the display collapses the pair, and only in Gen I ------------------------------------
check(/function gen1StatRows\(stats\)\{/.test(src), 'gen1StatRows exists to collapse the pair');
check(/if\(getDataGenNum\(\)!==1\)return stats;/.test(src),
  'and returns the list untouched for every other generation');
check(/const bars=gen1StatRows\(stats\)\.map/.test(src), 'the stat bars go through it');
check(/const bst=gen1StatRows\(stats\)\.reduce/.test(src),
  'and so does the base stat total — Gen I counts Special once, giving five stats not six');
check(/special:"SPECIAL"/.test(src), 'the collapsed row is labelled SPECIAL');

// getStatsForGen must set BOTH halves, so the calculator and the comparison view need no special
// case — only the visible list is collapsed.
check(/if\(a\)a\.base_stat=sp;/.test(src) && /if\(d\)d\.base_stat=sp;/.test(src),
  'both special halves are set to the Gen I value, so every consumer stays correct');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
