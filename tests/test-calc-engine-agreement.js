/* HoopaDex — the two damage engines must agree
 * Run: node tests/test-calc-engine-agreement.js
 *
 * The 2026-08-03 engineering review's largest unverified item, quoted in full:
 *
 *     "@smogon/calc is unaudited. 469 KB of third-party code producing the numbers most users see.
 *      I verified it loads and that the app prefers it; I did not verify a single number it returns."
 *
 * That mattered more than it looked. Champions is the default mode and Champions uses the SMOGON
 * path, so the numbers most readers see come from the bundle, not from the local fallback that has
 * the hand-worked tests. The bundle carries no version string; `data/vendor-pins.json` checksums it
 * so it cannot be swapped silently, but a checksum pins the artefact, not its correctness.
 *
 * This suite closes that by running BOTH engines over the same matrix and requiring the rolls to
 * match exactly — sixteen numbers, not a tolerance. Two independent implementations of one published
 * formula: if they agree everywhere, both gain real evidence; if they diverge, one of them is wrong
 * and the divergence says where to look.
 *
 * WHAT IT FOUND when it was first run, all three in the LOCAL engine:
 *
 *   1. The spread reduction was applied to every move when the "Spread" box was ticked. That box
 *      sets gameType:'Doubles' for the Smogon engine, which reduces only moves that actually hit
 *      more than one target. Body Slam read 208-246 from one engine and 156-184 from the other,
 *      inside the same app, from the same checkbox.
 *   2. Screens were halved in doubles. They are 2732/4096 there — measured at 0.6682 — so the
 *      fallback under-reported damage by a quarter whenever a screen was up in doubles.
 *   3. Chained modifiers used Math.floor where the games use pokeRound, which rounds a half DOWN.
 *      Invisible on halves and doubles, where the two agree exactly; it showed up on the awkward
 *      multipliers as a one-point difference at the low roll — the size of error that never looks
 *      wrong and moves a KO verdict at the boundary.
 *
 * The engine is loaded by evaluating the bundle, which assigns a `var SmogonCalc`. It is a browser
 * build with no CommonJS export, so `require` returns an empty object — that is why this reads the
 * file rather than importing it.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const ENGINE = path.join(ROOT, 'app', 'calc-engine.js');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

if (!fs.existsSync(ENGINE)) {
  console.log('FAIL  app/calc-engine.js is missing — the engine this suite cross-checks is not there');
  process.exit(1);
}
const M = (0, eval)(fs.readFileSync(ENGINE, 'utf8') + '\n;SmogonCalc');
check(typeof M === 'object' && typeof M.calculate === 'function',
  'the vendored engine loads and exposes calculate()');

// --- the local engine, sliced from the shipped file -----------------------------------------------
const pick = sig => { const i = lines.findIndex(l => l.startsWith(sig));
  if (i < 0) throw new Error('could not locate ' + sig); return lines[i]; };
const start = lines.findIndex(l => l.startsWith('function calcLocalCritMult('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('async function calcRunLocal('));
if (start < 0 || end < 0) throw new Error('could not locate the local engine');
const local = (0, eval)(
  pick('const CM=') + '\n' + pick('function eff(') + '\n' +
  lines.slice(start, end).join('\n') +
  '\n;({calcLocalRolls,calcLocalStab,calcLocalEffectiveness,calcLocalModifiers,CM})'
);

/* PokeAPI names a move's target; the engine uses its own vocabulary. The local engine reads the
   PokeAPI name, so the harness translates — and the translation is part of what is under test,
   because getting it wrong is exactly how defect 1 above would come back. */
const TARGET = {
  allAdjacent: 'all-other-pokemon', allAdjacentFoes: 'all-opponents', all: 'all-pokemon',
  any: 'selected-pokemon', normal: 'selected-pokemon', allySide: 'users-field', self: 'user',
};

function compare(o) {
  const gen = M.Generations.get(9);
  const probe = new M.Move(gen, o.mv);
  const isPhys = probe.category === 'Physical';
  /* An inert ability on both sides. A species' real ability can change the damage — Thick Fat,
     Huge Power, Levitate — and this suite is comparing FORMULAS, not ability implementations. */
  const A = new M.Pokemon(gen, o.A, { level: o.lv, nature: 'Hardy', ability: 'Pressure',
    evs: isPhys ? { atk: 0 } : { spa: 0 }, status: o.burn ? 'brn' : '' });
  const D = new M.Pokemon(gen, o.D, { level: o.lv, nature: 'Hardy', ability: 'Pressure' });
  const mv = new M.Move(gen, o.mv, { isCrit: !!o.crit });
  const field = new M.Field({ gameType: o.spread ? 'Doubles' : 'Singles', weather: o.weather,
    defenderSide: { isReflect: !!o.screen && isPhys, isLightScreen: !!o.screen && !isPhys } });
  const smRaw = M.calculate(gen, A, D, mv, field).damage;
  const sm = Array.isArray(smRaw) ? smRaw : [smRaw];

  const type = mv.type.toLowerCase(), cat = isPhys ? 'physical' : 'special';
  const mods = local.calcLocalModifiers({
    weather: o.weather ? o.weather.toLowerCase() : '', type: type, cat: cat, crit: !!o.crit,
    target: TARGET[mv.target] || 'selected-pokemon',
    spread: !!o.spread, burn: !!o.burn, screen: !!o.screen });
  const lo = local.calcLocalRolls({
    lv: o.lv, power: mv.bp, atk: isPhys ? A.stats.atk : A.stats.spa,
    def: isPhys ? D.stats.def : D.stats.spd, gen: 9,
    spread: mods.spread, weather: mods.weather, crit: !!o.crit,
    stab: local.calcLocalStab(A.types.map(t => ({ type: { name: t.toLowerCase() } })), type),
    eff: local.calcLocalEffectiveness(D.types.map(t => ({ type: { name: t.toLowerCase() } })), type, local.CM),
    burn: mods.burn, screen: mods.screen, item: 1 });

  // The engine collapses an immunity to a single 0 rather than sixteen of them.
  if (sm.length !== 16) return { immune: sm.every(v => v === 0) && lo.every(v => v === 0) };
  return { same: lo.every((v, i) => v === sm[i]), sm: sm[0] + '-' + sm[15], lo: lo[0] + '-' + lo[15] };
}

/* Deliberately spread across type matchups (immune, resisted, neutral, super-effective, dual-type),
   both damage categories, both a single-target and a spread move, and every modifier that the local
   engine models. Defects 1 to 3 above were each found by exactly one column of this matrix. */
const PAIRS = [['Snorlax', 'Blissey'], ['Garchomp', 'Skarmory'], ['Alakazam', 'Tyranitar'],
               ['Pikachu', 'Gyarados'], ['Charizard', 'Venusaur'], ['Dragapult', 'Ferrothorn']];
const MOVES = ['Body Slam', 'Earthquake', 'Psychic', 'Thunderbolt', 'Ice Beam', 'Close Combat',
               'Surf', 'Flamethrower', 'Rock Slide', 'Dragon Claw', 'Heat Wave', 'Muddy Water'];
const FLAGS = [{}, { crit: true }, { burn: true }, { screen: true }, { spread: true },
               { spread: true, screen: true }, { weather: 'Sun' }, { weather: 'Rain' },
               { crit: true, screen: true }, { spread: true, burn: true },
               { spread: true, weather: 'Sun' }, { crit: true, spread: true }];

let n = 0, agreed = 0, immune = 0;
const bad = [];
for (const [A, D] of PAIRS) for (const mv of MOVES) for (const lv of [50, 100]) for (const f of FLAGS) {
  let r;
  try { r = compare(Object.assign({ A, D, mv, lv }, f)); }
  catch (e) { bad.push({ A, D, mv, lv, err: e.message.slice(0, 80) }); n++; continue; }
  n++;
  if (r.immune !== undefined) { if (r.immune) { immune++; agreed++; } else bad.push({ A, D, mv, lv, note: 'one engine says immune, the other does not' }); continue; }
  if (r.same) agreed++; else bad.push(Object.assign({ A, D, mv, lv }, f, { smogon: r.sm, local: r.lo }));
}

check(n >= 1500, 'the matrix is large enough to be worth trusting', n + ' comparisons');
check(immune > 0, 'and includes immunities, where the two engines report differently shaped results', immune);
check(bad.length === 0,
  'every comparison agrees exactly — sixteen rolls, not a tolerance',
  bad.length + ' disagreed, e.g. ' + JSON.stringify(bad.slice(0, 3)));

/* The three defects above, pinned individually so a regression names itself rather than showing up
   as "n of 1728 disagree". */
const one = o => compare(Object.assign({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50 }, o));
check(one({ spread: true }).same,
  'a single-target move is NOT reduced by the spread rule, even in doubles');
check(compare({ A: 'Garchomp', D: 'Blissey', mv: 'Earthquake', lv: 50, spread: true }).same,
  'and a genuine spread move is');
check(one({ spread: true, screen: true }).same,
  'a screen in doubles is 2732/4096, not a half');
check(one({ screen: true }).same, 'while in singles it is a half');
check(one({ crit: true, screen: true }).same, 'and a critical hit ignores it in both engines');

console.log('\n' + n + ' comparisons, ' + agreed + ' agreed (' + immune + ' immunities)');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
