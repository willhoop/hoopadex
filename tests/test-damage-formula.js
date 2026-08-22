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
/* calcLocalBattleStats sits on three helpers defined further up the file. They are sliced in rather
   than restated for the same reason eff() is: a correct copy here would hide a broken original. */
const statHelpers = ['function calcStatVal(', 'function calcHPStat(', 'function calcStage(']
  .map(sig => { const i = lines.findIndex(l => l.startsWith(sig));
                if (i < 0) throw new Error('could not locate ' + sig); return lines[i]; })
  .join('\n');
const app = (0, eval)(lines[effStart] + '\n' + statHelpers + '\n' + lines.slice(start, end).join('\n') +
  '\n;({calcLocalRolls,calcLocalCritMult,calcLocalStab,calcLocalEffectiveness,' +
  'calcLocalModifiers,calcLocalCritStages,calcLocalKO,' +
  'calcLocalLevel,calcLocalApplyStage,calcLocalStatNames,calcLocalPercent,calcLocalBarWidth,' +
  'calcLocalBattleStats})');
const rollsOf = app.calcLocalRolls, critMult = app.calcLocalCritMult, stabOf = app.calcLocalStab;
const effOf = app.calcLocalEffectiveness;
const modsOf = app.calcLocalModifiers, stagesOf = app.calcLocalCritStages, koOf = app.calcLocalKO;

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

/* --- the decisions that were still inside the DOM handler ------------------------------------
   Extracted in 5.17. Everything below had no test of any kind: the weather/burn/screen rules, the
   critical-hit stat-stage rule, and the KO verdict — the sentence a reader actually acts on. */

// --- weather, spread, burn, screens -----------------------------------------------------------
const M = o => modsOf(Object.assign({ weather: 'none', type: 'fire', cat: 'physical', crit: false,
  spread: false, burn: false, screen: false }, o));

check(M({}).weather === 1 && M({}).spread === 1 && M({}).burn === 1 && M({}).screen === 1,
  'nothing switched on leaves every modifier at 1');
check(M({ weather: 'sun', type: 'fire' }).weather === 1.5, 'sun boosts Fire');
check(M({ weather: 'sun', type: 'water' }).weather === 0.5, 'sun weakens Water');
check(M({ weather: 'rain', type: 'water' }).weather === 1.5, 'rain boosts Water');
check(M({ weather: 'rain', type: 'fire' }).weather === 0.5, 'rain weakens Fire');
check(M({ weather: 'sun', type: 'grass' }).weather === 1, 'sun does nothing to a Grass move');
// Sand and snow are deliberately unmodelled here; inventing a multiplier would be worse than 1.
check(M({ weather: 'sand', type: 'rock' }).weather === 1, 'sand is not modelled and stays at 1');
check(M({ weather: 'snow', type: 'ice' }).weather === 1, 'snow is not modelled and stays at 1');

check(M({ spread: true }).spread === 0.75, 'a spread move is reduced to 0.75');
check(M({ burn: true, cat: 'physical' }).burn === 0.5, 'burn halves a physical attack');
check(M({ burn: true, cat: 'special' }).burn === 1,
  'burn does NOT touch a special attack — the category test is the whole point');
check(M({ screen: true }).screen === 0.5, 'a screen halves damage');
check(M({ screen: true, crit: true }).screen === 1,
  'a critical hit ignores screens, which is what a critical hit is for');

// --- stat stages under a critical hit ----------------------------------------------------------
check(stagesOf(1.5, 1.5, false).atk === 1.5 && stagesOf(1.5, 1.5, false).def === 1.5,
  'without a crit the stages pass through untouched');
check(stagesOf(0.5, 1.5, true).atk === 1, "a crit ignores the attacker's DROP");
check(stagesOf(2, 1.5, true).atk === 2, "but keeps the attacker's BOOST");
check(stagesOf(1, 2, true).def === 1, "a crit ignores the defender's BOOST");
check(stagesOf(1, 0.5, true).def === 0.5, "but keeps the defender's DROP");

// --- the KO verdict ----------------------------------------------------------------------------
// Rolls are supplied explicitly, so this tests the verdict and not the roll generator.
const flat = v => Array(16).fill(v);
check(koOf(flat(10), 100, 0) === 'Immune — no damage', 'an immunity says so rather than "10–10HKO"');
check(koOf(flat(100), 100, 1) === 'Guaranteed OHKO', 'the weakest roll killing is a guaranteed OHKO');
check(koOf(flat(50), 100, 1) === 'Guaranteed 2HKO', 'half its HP, twice, is a guaranteed 2HKO');
check(koOf(flat(34), 100, 1) === 'Guaranteed 3HKO', 'a third of its HP is a guaranteed 3HKO');
check(koOf(flat(10), 100, 1) === '10–10HKO', 'anything slower is reported as a range');

/* "Possible" needs a SPREAD of rolls: it means the high roll gets there and the low roll does not.
   Flat rolls can only ever be "Guaranteed", and asserting Possible against flat(40) was my mistake
   rather than the code's — flat(40) is correctly a Guaranteed 3HKO. Worth keeping as a case,
   because a reader who sees "Possible" is being told the outcome depends on the roll. */
const spreadTo = (lo, hi) => Array.from({ length: 16 }, (_, i) => lo + Math.round((hi - lo) * i / 15));
check(koOf(spreadTo(45, 55), 100, 1) === 'Possible 2HKO',
  'a high roll that 2HKOs and a low roll that does not is a POSSIBLE 2HKO', koOf(spreadTo(45, 55), 100, 1));
check(koOf(spreadTo(30, 36), 100, 1) === 'Possible 3HKO',
  'the same distinction at three hits', koOf(spreadTo(30, 36), 100, 1));

// The percentage branch: some rolls kill and some do not.
const half = [...Array(8).fill(99), ...Array(8).fill(100)];
check(koOf(half, 100, 1) === '50.0% chance to OHKO',
  'when only some rolls kill, the chance is stated', koOf(half, 100, 1));
check(koOf([...Array(15).fill(99), 100], 100, 1) === '6.3% chance to OHKO',
  'one roll in sixteen is 6.3%', koOf([...Array(15).fill(99), 100], 100, 1));

// A stronger hit must never produce a weaker-sounding verdict.
const ladder = [flat(100), half, flat(50), spreadTo(45, 55), flat(34), spreadTo(30, 36), flat(20)]
  .map(r => koOf(r, 100, 1));
check(new Set(ladder).size === ladder.length,
  'each rung of the ladder gives a distinct verdict — no two thresholds collapse', ladder.join(' | '));

/* ── The last arithmetic to leave the DOM handler ───────────────────────────────────────────────
   The 2026-08-03 engineering review demanded the whole calculation move into pure functions, and
   made a prediction about what would happen until it did: "assume there is a fourth input nobody
   has tested."

   It was right. Three audits had each found one more untested input — the roll arithmetic, then
   STAB, then dual-type effectiveness — and in 5.33 the fourth arrived: `power`, read as the modern
   value and fed into a calculator that is available in every generation. Wing Attack at 60 in
   Generation I, where it is 35.

   These cover what was still inline after that. Every expected value is worked by hand below from
   the published formulas, NOT read back out of the app, so a wrong implementation cannot validate
   itself. */

const battleOf = app.calcLocalBattleStats;

/* Attacker: base 100, 252 EVs, boosting nature, +1 stage, level 50.
     floor(252/4)             = 63
     2*100 + 31 + 63          = 294
     floor(294 * 50/100) + 5  = 147 + 5 = 152
     floor(152 * 1.1)         = 167
     stage +1 is (2+1)/2      = 1.5
     floor(167 * 1.5)         = 250
   Defender: base 100, 0 EVs, neutral nature, no stage.
     2*100 + 31 + 0           = 231
     floor(231 * 50/100) + 5  = 115 + 5 = 120
   Defender HP:
     floor(231 * 50/100) + 50 + 10 = 115 + 60 = 175 */
const BS = {
  level: '50', cat: 'physical', crit: false, atkStage: '1', defStage: '0',
  atkBase: 100, atkEv: 252, atkNat: 1.1,
  defBase: 100, defEv: 0, defNat: 1,
  hpBase: 100, hpEv: 0,
};
const bs = battleOf(BS);
check(bs.lv === 50, 'level 50 reads straight through', bs.lv);
check(bs.atk === 250, 'attacker: 167 at +1 stage is 250', bs.atk);
check(bs.def === 120, 'defender: 120 at no stage', bs.def);
check(bs.hp === 175, 'defender HP is 175', bs.hp);
check(bs.offName === 'attack' && bs.defName === 'defense',
  'a physical move uses Attack against Defence', bs.offName + '/' + bs.defName);
const bsSpec = battleOf(Object.assign({}, BS, { cat: 'special' }));
check(bsSpec.offName === 'special-attack' && bsSpec.defName === 'special-defense',
  'and a special move uses the special pair', bsSpec.offName + '/' + bsSpec.defName);

/* The stage multiplier applies to the FINAL stat and the floor comes after it. The other order is
   at most a one-point difference, which never looks wrong on screen and moves a KO verdict at the
   boundary — so it is asserted on a value where the two orders disagree. */
check(app.calcLocalApplyStage(167, 1.5) === 250, '167 at x1.5 floors to 250', app.calcLocalApplyStage(167, 1.5));
check(Number.isInteger(app.calcLocalApplyStage(167, 1.5)), 'and the result is a whole number');
check(app.calcLocalApplyStage(100, 1) === 100, 'no stage leaves the stat alone');
check(app.calcLocalApplyStage(151, 2 / 3) === 100, 'a negative stage rounds down, not to nearest',
  app.calcLocalApplyStage(151, 2 / 3));

/* A critical hit ignores the attacker's drops and the defender's boosts, and the clamp has to
   happen before the stats are computed rather than after. */
const critBs = battleOf(Object.assign({}, BS, { crit: true, atkStage: '-1', defStage: '2' }));
check(critBs.atkStage === 1, 'a crit ignores the attacker sitting at -1', critBs.atkStage);
check(critBs.defStage === 1, 'and the defender sitting at +2', critBs.defStage);
const plainBs = battleOf(Object.assign({}, BS, { crit: false, atkStage: '-1', defStage: '2' }));
check(plainBs.atkStage < 1 && plainBs.defStage > 1, 'without a crit both stages stand',
  plainBs.atkStage + '/' + plainBs.defStage);
check(critBs.atk > plainBs.atk, 'so the crit produces the larger attacking stat');

// --- the level box ------------------------------------------------------------------------------
check(app.calcLocalLevel('75') === 75, 'a typed level is used');
check(app.calcLocalLevel('') === 50, 'an empty box falls back to 50');
check(app.calcLocalLevel('abc') === 50, 'and so does nonsense');
check(app.calcLocalLevel('150') === 100, 'above 100 clamps to 100');
check(app.calcLocalLevel('-5') === 1, 'below 1 clamps to 1', app.calcLocalLevel('-5'));
/* PINNED, not endorsed. `parseInt(v)||50` treats a typed 0 the same as an empty box, because 0 is
   falsy — so level 0 shows 50 rather than the clamped 1. That is the shipped behaviour; asserting
   it makes it a decision on record rather than an accident, and this is the line to change if it
   should become 1. */
check(app.calcLocalLevel('0') === 50,
  'a typed 0 falls back to 50 — the falsy-zero quirk, pinned deliberately', app.calcLocalLevel('0'));

// --- percentage of HP ----------------------------------------------------------------------------
check(app.calcLocalPercent(50, 200) === 25, '50 damage against 200 HP is 25%');
check(app.calcLocalPercent(200, 200) === 100, 'a full-HP hit is 100%');
/* A defender with no HP is a divide by zero. Unguarded it renders as "Infinity% of 0 HP", which is
   not an error message — it is a damage report. */
check(app.calcLocalPercent(50, 0) === 0, 'and no HP gives 0, not Infinity', app.calcLocalPercent(50, 0));

// --- the bar --------------------------------------------------------------------------------------
check(app.calcLocalBarWidth(42.5) === 42.5, 'a normal percentage passes through');
check(app.calcLocalBarWidth(150) === 100, 'an overkill is clamped to the width of the bar');
check(app.calcLocalBarWidth(-5) === 0, 'and a negative to zero');
check(app.calcLocalBarWidth(undefined) === 0, 'a missing value does not render NaN into the style');

// --- and the handler is now only a handler ----------------------------------------------------------
/* The point of the whole exercise. If arithmetic reappears here, the next untested input will again
   be reachable only through a DOM event — which is how the previous four were missed. */
const hStart = lines.findIndex(l => l.startsWith('async function calcRunLocal('));
const hEnd = lines.findIndex((l, i) => i > hStart && l === '}');
const handlerRaw = lines.slice(hStart, hEnd).join('\n');

/* Checking for `Math.` alone is not enough, and the mutation check proved it: reinstating
   `mn/hp*100` in the handler uses no Math call at all and stayed green. The claim being made is
   "no arithmetic", so the check has to look for operators — which means first removing the places
   a `/` or `*` legitimately appears: comments, string literals, and regex literals like
   `.replace(/-/g, ' ')`. What is left is arithmetic or nothing. */
function stripNonCode(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '/*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; continue; }
    if (two === '//') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') {
      i++;
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; i++; }
      i++; out += '""'; continue;
    }
    if (c === '/') {
      // A regex literal, not a division: divisions follow a value, regexes follow an operator or
      // an opening bracket. Looking back at the last non-space character settles which this is.
      const prev = (out.replace(/\s+$/, '').slice(-1)) || '(';
      if ('(,=:[!&|?{;+'.indexOf(prev) >= 0) {
        i++;
        while (i < src.length && src[i] !== '/') { if (src[i] === '\\') i++; i++; }
        i++;
        while (i < src.length && /[gimsuy]/.test(src[i])) i++;
        out += 'RE'; continue;
      }
    }
    out += c; i++;
  }
  return out;
}
const handler = stripNonCode(handlerRaw);
const leftovers = (handler.match(/Math\.\w+|[*/]/g) || []);
check(leftovers.length === 0,
  'calcRunLocal contains no arithmetic at all — it reads the form and renders',
  leftovers.join(' ') + '  in: ' + (handler.match(/^.*[*/].*$/m) || [''])[0].trim().slice(0, 90));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
