/* HoopaDex — the damage engine
 * Run: node tests/test-calc-engine.js
 *
 * There is now ONE damage engine: the vendored @smogon/calc bundle. This suite is what stands
 * behind it.
 *
 * WHY THE SECOND ENGINE IS GONE
 * -----------------------------
 * The app used to carry a local implementation of the damage formula as a fallback for when the
 * 480 KB bundle had not loaded. v5.36 cross-checked the two over 1,728 cases and they agreed
 * exactly — in Generations VI to IX. Extending the same check downward:
 *
 *     Gen 3   18/45 agreed        Gen 6   65/65
 *     Gen 4   40/65 agreed        Gen 7   65/65
 *     Gen 5   59/65 agreed        Gen 8   65/65
 *                                 Gen 9   65/65
 *
 * The damage formula's rounding and operation order changed before Generation VI, and the fallback
 * only implemented the modern one. So which number a reader got depended on whether a sibling file
 * had loaded — and in Generation III the fallback was wrong more often than it was right.
 *
 * Maintaining a second implementation of a formula that differs by generation is a standing
 * commitment, and the alternative is not "no calculator": it is a calculator that says it cannot
 * run. This project's own stated principle is that a reference which is silently wrong is worse
 * than one which declines to answer. The fallback was deleted rather than fixed.
 *
 * WHAT REPLACES IT
 * ----------------
 * Three kinds of assertion, and only the first is an oracle:
 *
 *   1. A damage figure worked by HAND from the published formula. This is the one that could catch
 *      an engine that was wrong from the start; everything else can only catch an engine that
 *      CHANGED.
 *   2. The mechanics the deleted engine got wrong, checked per generation. These are the evidence
 *      for the decision above: the bundle handles them, ours did not.
 *   3. Golden values across a matrix, so a swapped or corrupted bundle fails loudly. The bundle
 *      carries no version string and `data/vendor-pins.json` checksums it; this is the behavioural
 *      half of the same idea.
 *
 * The bundle is a browser build with no CommonJS export — `require` returns an empty object — so it
 * is loaded by evaluating the file and taking the `SmogonCalc` global.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ENGINE = path.join(ROOT, 'app', 'calc-engine.js');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

if (!fs.existsSync(ENGINE)) {
  console.log('FAIL  app/calc-engine.js is missing — there is no damage engine to test');
  process.exit(1);
}
const M = (0, eval)(fs.readFileSync(ENGINE, 'utf8') + '\n;SmogonCalc');
check(typeof M === 'object' && typeof M.calculate === 'function',
  'the vendored engine loads and exposes calculate()');
check(typeof M.Generations === 'object' && typeof M.Pokemon === 'function',
  'and the constructors the app uses');

/* An inert ability on both sides. A species' real ability changes damage — Thick Fat, Huge Power,
   Levitate — and these cases are about the FORMULA. Abilities and items are a gap, stated in
   docs/BACKLOG.md rather than papered over. */
function roll(o) {
  const gen = M.Generations.get(o.gen || 9);
  const probe = new M.Move(gen, o.mv);
  const isPhys = probe.category === 'Physical';
  const A = new M.Pokemon(gen, o.A, { level: o.lv || 50, nature: 'Hardy', ability: 'Pressure',
    evs: isPhys ? { atk: o.ev || 0 } : { spa: o.ev || 0 }, status: o.burn ? 'brn' : '' });
  const D = new M.Pokemon(gen, o.D, { level: o.lv || 50, nature: 'Hardy', ability: 'Pressure' });
  const mv = new M.Move(gen, o.mv, { isCrit: !!o.crit });
  const field = new M.Field({ gameType: o.spread ? 'Doubles' : 'Singles', weather: o.weather,
    defenderSide: { isReflect: !!o.screen && isPhys, isLightScreen: !!o.screen && !isPhys } });
  const d = M.calculate(gen, A, D, mv, field).damage;
  return Array.isArray(d) ? d : [d];
}
const span = o => { const r = roll(o); return r[0] + '-' + r[r.length - 1]; };

/* ── 1. THE ORACLE ──────────────────────────────────────────────────────────────────────────────
   Snorlax Body Slam vs Blissey, level 50, no EVs, neutral nature, no item, no ability, singles.
   Worked from the published Generation V+ formula, not read out of the engine:

     Snorlax Attack   2*110 + 31 = 251 ; floor(251 * 50/100) + 5 = 125 + 5   = 130
     Blissey Defence  2*10  + 31 = 51  ; floor(51  * 50/100) + 5 = 25  + 5   = 30
     Body Slam is 85 BP, Normal. Snorlax is Normal, so STAB applies. Blissey is Normal: neutral.

     base = floor(floor(floor(2*50/5 + 2) * 85 * 130 / 30) / 50) + 2
          = floor(floor(22 * 85 * 130 / 30) / 50) + 2
          = floor(floor(243100 / 30) / 50) + 2
          = floor(8103 / 50) + 2  =  162 + 2  =  164

     low roll  floor(164 * 85/100) = 139 ; STAB pokeRound(139 * 1.5) = pokeRound(208.5) = 208
     high roll floor(164)          = 164 ; STAB pokeRound(164 * 1.5) = 246

   The low roll is the interesting one: 208.5 rounds DOWN. An engine that rounded a half up would
   report 209 and be wrong by one at exactly the boundary a KO verdict turns on. */
const oracle = roll({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50 });
check(oracle.length === 16, 'sixteen rolls, one per random factor', oracle.length);
check(oracle[0] === 208, 'the low roll is 208, computed by hand — and 208.5 rounds DOWN', oracle[0]);
check(oracle[15] === 246, 'the high roll is 246', oracle[15]);
check(oracle.every((v, i) => i === 0 || v >= oracle[i - 1]), 'and the rolls never decrease');

/* ── 2. WHAT THE DELETED ENGINE GOT WRONG, PER GENERATION ───────────────────────────────────────
   These are the evidence for removing the fallback rather than repairing it. Each is a rule the
   bundle applies correctly in every generation and the local engine applied in one. */

// Spread belongs to the MOVE. Body Slam hits one target and is never reduced; Earthquake is.
for (const g of [4, 6, 9]) {
  const single = roll({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: g });
  const singleD = roll({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: g, spread: true });
  check(single[15] === singleD[15],
    'Gen ' + g + ': a single-target move is unaffected by doubles', single[15] + ' vs ' + singleD[15]);
  const multi = roll({ A: 'Garchomp', D: 'Blissey', mv: 'Earthquake', lv: 50, gen: g });
  const multiD = roll({ A: 'Garchomp', D: 'Blissey', mv: 'Earthquake', lv: 50, gen: g, spread: true });
  check(multiD[15] < multi[15],
    'Gen ' + g + ': and a spread move IS reduced', multi[15] + ' -> ' + multiD[15]);
}

/* Screens are a half in singles and roughly two thirds in doubles. The local engine used a half
   everywhere, so it under-reported damage by a quarter whenever a screen was up in doubles. */
const noScr = roll({ A: 'Garchomp', D: 'Blissey', mv: 'Earthquake', lv: 50 })[0];
const scrS = roll({ A: 'Garchomp', D: 'Blissey', mv: 'Earthquake', lv: 50, screen: true })[0];
const noScrD = roll({ A: 'Garchomp', D: 'Blissey', mv: 'Earthquake', lv: 50, spread: true })[0];
const scrD = roll({ A: 'Garchomp', D: 'Blissey', mv: 'Earthquake', lv: 50, spread: true, screen: true })[0];
check(Math.abs(scrS / noScr - 0.5) < 0.01, 'a screen halves damage in singles', (scrS / noScr).toFixed(4));
check(Math.abs(scrD / noScrD - 2732 / 4096) < 0.01,
  'and reduces it to about two thirds in doubles', (scrD / noScrD).toFixed(4));
check(roll({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, crit: true, screen: true })[15]
   === roll({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, crit: true })[15],
  'a critical hit ignores screens');

/* A critical hit was x2 through Generation V and became x1.5 in Generation VI. Getting this wrong
   made every pre-VI critical read 25% low, which is what an audit found in the deleted engine. */
for (const [g, mult] of [[5, 2], [6, 1.5], [9, 1.5]]) {
  const plain = roll({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: g })[15];
  const crit = roll({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: g, crit: true })[15];
  check(Math.abs(crit / plain - mult) < 0.03,
    'Gen ' + g + ': a critical hit is x' + mult, (crit / plain).toFixed(3));
}

/* ── 3. GOLDEN VALUES ───────────────────────────────────────────────────────────────────────────
   These catch a swapped or corrupted bundle. They are a PIN, not a proof: they were produced by
   this engine, verified against a hand-worked second implementation across 1,728 cases in
   Generations VI-IX before that implementation was deleted (see CHANGELOG 5.36). A change here
   means the engine changed, and somebody has to say why.

   Every figure below is RECORDED OUTPUT, not a guess. The first draft of this list was written
   from memory and four of the seven were wrong — including one that expected damage where the
   matchup is an immunity. A golden value invented rather than measured is worse than no golden
   value: it fails on correct code and trains the reader to edit the expectation. */
const GOLDEN = [
  ['Snorlax/Blissey Body Slam g9', { A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50 }, '208-246'],
  ['Garchomp/Skarmory Earthquake g9 (immune)', { A: 'Garchomp', D: 'Skarmory', mv: 'Earthquake', lv: 50 }, '0-0'],
  // Psychic into Rock/Dark is an immunity, not a small number — worth pinning as a zero.
  ['Alakazam/Tyranitar Psychic g9 (immune)', { A: 'Alakazam', D: 'Tyranitar', mv: 'Psychic', lv: 50 }, '0-0'],
  ['Charizard/Venusaur Flamethrower g9', { A: 'Charizard', D: 'Venusaur', mv: 'Flamethrower', lv: 50 }, '110-132'],
  /* The same attack in Generation III reads 209, not 208 — the low roll differs by one because the
     formula's rounding changed before Generation VI. That single point is the whole reason the
     local fallback was deleted rather than repaired: it implemented one formula and the games have
     had two. */
  ['Snorlax/Blissey Body Slam g3', { A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: 3 }, '209-246'],
  ['Snorlax/Blissey Body Slam g5 crit', { A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: 5, crit: true }, '417-492'],
  ['Pikachu/Gyarados Thunderbolt g9', { A: 'Pikachu', D: 'Gyarados', mv: 'Thunderbolt', lv: 50 }, '124-148'],
];
const drift = [];
for (const [label, o, expected] of GOLDEN) {
  const got = span(o);
  if (got !== expected) drift.push(label + ': expected ' + expected + ', got ' + got);
}
check(drift.length === 0, 'every golden value still holds', drift.join(' | '));

/* ── 4. THE APP HAS NO SECOND ENGINE ────────────────────────────────────────────────────────────
   If a local implementation reappears, the divergence above comes back with it. */
const app = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html'), 'utf8');
check(!/calcRunLocal|calcLocalRolls|calcLocalModifiers/.test(app),
  'the deleted local engine has not come back',
  (app.match(/calcLocal\w*/g) || []).slice(0, 3).join(', '));
check(/if\(typeof SmogonCalc==='undefined'\)\{calcShowEngineMissing\(\);return null\}/.test(app),
  'and a missing engine is reported rather than guessed around');
check(/function calcShowEngineMissing/.test(app), 'with a message that names the missing file');

/* ── 5. THE ENGINE RUNS IN THE GENERATION THE READER SELECTED ───────────────────────────────────
   `calcEnsureMaps` built its lookup against a hardcoded `Generations.get(9)` and cached the result,
   so the damage calculator ran in Generation IX whatever the selector said — in an application
   whose entire premise is that the generation is an input to every lookup.

   It survived because the DELETED local engine was generation-aware: the two engines disagreed
   about which generation they were even in, and the fallback is the one that got audited. Removing
   the fallback is what surfaced it. */
const ensure = app.slice(app.indexOf('function calcEnsureMaps()'), app.indexOf('function calcPopulateItemList'));
check(/SmogonCalc\.Generations\.get\(want\)/.test(ensure),
  'the engine is built for the selected generation, not a hardcoded one', ensure.slice(0, 200));
check(!/Generations\.get\(9\)/.test(ensure), 'the hardcoded Generation IX is gone');
check(/CalcMapsGen===want/.test(ensure),
  'and the cache is keyed by generation, so changing it rebuilds rather than reusing');

/* The engine really is generation-aware, which is what makes the above worth doing. Wing Attack was
   35 base power in Generation I and 60 from Generation II — the app was reporting 60 everywhere
   until 5.33, and the calculator was computing with the modern value until 5.37. */
const bpOf = (mv, g) => new M.Move(M.Generations.get(g), mv).bp;
check(bpOf('Wing Attack', 1) === 35, 'Wing Attack is 35 BP in Gen I', bpOf('Wing Attack', 1));
check(bpOf('Wing Attack', 2) === 60, 'and 60 from Gen II', bpOf('Wing Attack', 2));
/* Jump Kick is 70 through Generation III, 85 in Generation IV, and 100 from Generation V. The first
   draft of this assertion said 70 and 85 for Generations IV and V — the same off-by-one that was in
   the app's own past_values handling, written from the same misreading of PokeAPI's convention.
   The engine is what corrected both. */
check(bpOf('Jump Kick', 3) === 70, 'Jump Kick is 70 BP in Gen III', bpOf('Jump Kick', 3));
check(bpOf('Jump Kick', 4) === 85, 'and 85 in Gen IV', bpOf('Jump Kick', 4));
check(bpOf('Jump Kick', 5) === 100, 'and 100 from Gen V', bpOf('Jump Kick', 5));
/* And the same attack really does produce different damage per generation, which is the whole
   claim: if these ever collapse to one number the generation is not reaching the engine. */
const g3 = span({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: 3 });
const g9 = span({ A: 'Snorlax', D: 'Blissey', mv: 'Body Slam', lv: 50, gen: 9 });
check(g3 !== g9, 'the same attack differs between Gen III and Gen IX', g3 + ' vs ' + g9);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
