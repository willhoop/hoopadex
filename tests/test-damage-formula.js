/* HoopaDex — local damage calculator tests
 * Run: node tests/test-damage-formula.js
 *
 * Why this suite exists. On 2026-08-03 an architecture audit mutated the shipped damage
 * arithmetic three separate ways and ran all 23 suites against each mutant:
 *
 *   critical hits multiply by 2.5x instead of 1.5x   -> all 23 green
 *   STAB becomes 1.9x instead of 1.5x                -> all 23 green
 *   the 0.75 spread-move reduction is deleted        -> all 23 green
 *
 * The damage calculator is the most numeric thing the app puts in front of a reader and it had
 * no numeric test at all. Every other suite either checked that a function EXISTS by regex, or
 * checked a table, or checked the DOM contract. None of them ever computed a damage number.
 *
 * This suite computes damage numbers. The expected values below are worked out from the
 * Generation V+ damage formula by hand in the comments, NOT read back out of the app, so a wrong
 * formula cannot validate itself.
 *
 * Scope: this is the LOCAL fallback engine, not @smogon/calc. That distinction matters less than
 * it sounds — index.html is published as a portable single file and calc-engine.js is a separate
 * 480 KB sibling, so a reader who opens index.html alone gets this code and only this code.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const start = lines.findIndex(l => l.startsWith('function calcLocalCritMult('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('async function calcRunLocal('));
if (start < 0 || end < 0) throw new Error('could not locate calcLocalRolls in index.html');
// eff() is the chart lookup calcLocalEffectiveness sits on. Slice the real one rather than
// restating it, so a broken lookup cannot be hidden by a correct copy living in this file.
const effStart = lines.findIndex(l => l.startsWith('function eff('));
if (effStart < 0) throw new Error('could not locate eff() in index.html');
const app = (0, eval)(lines[effStart] + '\n' + lines.slice(start, end).join('\n') +
  '\n;({calcLocalRolls,calcLocalCritMult,calcLocalStab,calcLocalEffectiveness})');
const rollsOf = app.calcLocalRolls, critMult = app.calcLocalCritMult, stabOf = app.calcLocalStab;
const effOf = app.calcLocalEffectiveness;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

// Neutral defaults: every multiplier off. Callers override only what they are testing.
const D = {
  lv: 50, power: 100, atk: 200, def: 200, gen: 9,
  spread: 1, weather: 1, crit: false, stab: 1, eff: 1, burn: 1, screen: 1, item: 1,
};
const roll = o => rollsOf(Object.assign({}, D, o));

// --- the base formula, worked by hand ------------------------------------------------------
// base = floor(floor(floor(2*50/5 + 2) * 100 * 200/200) / 50) + 2
//      = floor(floor(22 * 100 * 1) / 50) + 2 = floor(2200/50) + 2 = 44 + 2 = 46
const base = roll({});
check(base.length === 16, 'sixteen damage rolls, one per 85–100% random factor', base.length);
check(base[15] === 46, 'the 100% roll equals the hand-computed base of 46', base[15]);
// 85% roll: floor(46 * 85/100) = floor(39.1) = 39
check(base[0] === 39, 'the 85% roll is floor(46 * 0.85) = 39', base[0]);
check(base.every((v, i) => i === 0 || v >= base[i - 1]), 'rolls are non-decreasing', base.join(','));

// --- STAB ----------------------------------------------------------------------------------
// This assertion is what the 1.9x mutation defeated.
const stab = roll({ stab: 1.5 });
check(stab[15] === 69, 'STAB multiplies the max roll by exactly 1.5 (46 -> 69)', stab[15]);
check(stab[15] !== base[15], 'and STAB is not silently ignored');

// The value itself, not just its application. The first version of this suite tested only that a
// stab of 1.5 was applied, and a mutation that changed the app's own 1.5 to 1.9 stayed green.
const ty = ns => ns.map(n => ({ type: { name: n } }));
check(stabOf(ty(['water']), 'water') === 1.5, 'a matching single type earns exactly 1.5', stabOf(ty(['water']), 'water'));
check(stabOf(ty(['water', 'flying']), 'flying') === 1.5, 'a match on the second type also earns 1.5');
check(stabOf(ty(['water', 'flying']), 'fire') === 1, 'no match earns exactly 1');
check(stabOf([], 'fire') === 1, 'a typeless attacker earns 1 rather than throwing');
check(stabOf(undefined, 'fire') === 1, 'missing type data earns 1 rather than throwing');

// --- type effectiveness --------------------------------------------------------------------
check(roll({ eff: 2 })[15] === 92, 'super effective doubles the max roll (46 -> 92)');
check(roll({ eff: 0.5 })[15] === 23, 'not very effective halves it (46 -> 23)');
check(roll({ eff: 0.25 })[15] === 11, 'double resistance quarters it, floored (46 -> 11)');
check(roll({ eff: 0 }).every(v => v === 0), 'an immunity deals zero, not the one-damage minimum');
check(roll({ eff: 0.25, power: 1, atk: 1, def: 500 }).every(v => v >= 1),
  'a non-immune hit never deals less than 1, however resisted');

// --- type effectiveness against a DUAL-TYPED defender ----------------------------------------
// An engineering review replaced the multiplication below with Math.max in the shipped file and
// all 27 suites stayed green. test-dual-typing.js does not cover this: despite the name it tests
// filtering the dex by dual type, not computing damage against one. Two types multiply.
const ty2 = ns => ns.map(n => ({ type: { name: n } }));
const CHART = { fighting: { ice: 2, rock: 2, flying: 0.5 }, fire: { water: 0.5, dragon: 0.5 }, normal: { ghost: 0 } };
check(effOf(ty2(['ice', 'rock']), 'fighting', CHART) === 4,
  'Fighting into Ice/Rock is 4x — the two lookups MULTIPLY, they are not maxed',
  effOf(ty2(['ice', 'rock']), 'fighting', CHART));
check(effOf(ty2(['water', 'dragon']), 'fire', CHART) === 0.25,
  'Fire into Water/Dragon is 0.25x, not 0.5x', effOf(ty2(['water', 'dragon']), 'fire', CHART));
check(effOf(ty2(['ice', 'flying']), 'fighting', CHART) === 1,
  'a 2x and a 0.5x cancel to neutral', effOf(ty2(['ice', 'flying']), 'fighting', CHART));
check(effOf(ty2(['ghost', 'ice']), 'normal', CHART) === 0,
  'an immunity on either type makes the whole hit 0', effOf(ty2(['ghost', 'ice']), 'normal', CHART));
check(effOf(ty2(['ice']), 'fighting', CHART) === 2, 'a single type is just its own multiplier');
check(effOf([], 'fighting', CHART) === 1, 'a typeless defender is neutral, not zero');
check(effOf(undefined, 'fighting', CHART) === 1, 'missing type data is neutral rather than throwing');
check(effOf(ty2(['grass']), 'fighting', CHART) === 1, 'a type absent from the chart row is neutral');

// --- spread reduction ----------------------------------------------------------------------
// This assertion is what the deleted-0.75 mutation defeated.
check(roll({ spread: 0.75 })[15] === 34, 'a spread move is reduced to 0.75 (46 -> 34)');
check(roll({ spread: 0.75 })[15] < base[15], 'and a spread move always hits softer than a single target');

// --- critical hits, per generation ----------------------------------------------------------
// This assertion is what the 2.5x mutation defeated. Crit was x2 through Gen V and x1.5 from VI.
check(critMult(9) === 1.5, 'Generation IX critical hits multiply by 1.5', critMult(9));
check(critMult(6) === 1.5, 'Generation VI is where the change happened', critMult(6));
check(critMult(5) === 2, 'Generation V critical hits multiply by 2', critMult(5));
check(critMult(3) === 2, 'Generation III likewise', critMult(3));
check(roll({ crit: true, gen: 9 })[15] === 69, 'a Gen IX crit takes 46 to 69');
check(roll({ crit: true, gen: 5 })[15] === 92, 'the same crit in Gen V takes 46 to 92');
check(roll({ crit: true, gen: 5 })[15] > roll({ crit: true, gen: 9 })[15],
  'an older-generation crit hits harder, which is the whole point of a generation-accurate dex');
check(roll({ crit: false, gen: 5 })[15] === base[15], 'no crit means no multiplier in any generation');

// --- burn, screens, weather, items ------------------------------------------------------------
check(roll({ burn: 0.5 })[15] === 23, 'burn halves physical damage (46 -> 23)');
check(roll({ screen: 0.5 })[15] === 23, 'a screen halves damage (46 -> 23)');
check(roll({ weather: 1.5 })[15] === 69, 'boosting weather multiplies by 1.5 (46 -> 69)');
check(roll({ weather: 0.5 })[15] === 23, 'opposing weather halves (46 -> 23)');
check(roll({ item: 1.3 })[15] === 59, 'an item multiplier applies, floored (46 * 1.3 = 59.8 -> 59)');

// --- the multipliers compose, and each one is actually read ------------------------------------
// If any single multiplier were dropped, this product would change.
const all = roll({ stab: 1.5, eff: 2, weather: 1.5, burn: 0.5, screen: 0.5, spread: 0.75, item: 1.3, crit: true });
check(all[15] > 0, 'a fully-loaded calculation still produces a number', all[15]);
for (const k of ['stab', 'eff', 'weather', 'burn', 'screen', 'spread', 'item']) {
  const without = Object.assign({ stab: 1.5, eff: 2, weather: 1.5, burn: 0.5, screen: 0.5, spread: 0.75, item: 1.3, crit: true }, { [k]: 1 });
  check(roll(without)[15] !== all[15], `dropping "${k}" changes the result, so it is genuinely applied`);
}

// --- level and power scale the right way --------------------------------------------------------
check(roll({ lv: 100 })[15] > roll({ lv: 50 })[15], 'a higher level hits harder');
check(roll({ power: 200 })[15] > roll({ power: 100 })[15], 'a stronger move hits harder');
check(roll({ atk: 400 })[15] > base[15], 'more Attack hits harder');
check(roll({ def: 400 })[15] < base[15], 'more Defence takes less');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
