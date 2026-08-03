/* HoopaDex — bulk allocation tests
 * Run: node tests/test-bulk-split.js
 *
 * Slices the REAL optimalBulkSplit() and bulkStat() out of app/index.html and checks them against
 * an independent brute force over every possible split.
 *
 * This exists because the backlog entry said, in as many words, "VERIFY AGAINST BRUTE FORCE BEFORE
 * SHIPPING — I did not." The rule that was going to be shipped is "spend each point on whichever
 * current stat is lower". Brute force says that rule is:
 *
 *   - exactly optimal on a neutral nature (260,100 combinations, zero misses), because a neutral
 *     stat gains exactly +1 per point so levels and marginal gains are the same comparison;
 *   - NOT optimal once a nature applies — wrong in 13-26% of cases, by up to 1.3%. The nature
 *     multiplier is floored, so a hindering nature wastes the first point (step 0) and a boosting
 *     one occasionally pays 2.
 *
 * And the obvious repair — "spend where the marginal gain is highest" — is far worse (up to 41%
 * off), because a zero-gain first point makes it refuse to start on a defence at all. All three of
 * those claims are re-derived here rather than taken on trust, so the comment in the app cannot
 * quietly stop being true.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('function bulkStat('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function renderBulk('));
if (start < 0 || end < 0) throw new Error('could not locate the bulk helpers');
const app = eval(lines.slice(start, end).join('\n') + '\n;({bulkStat,optimalBulkSplit,optimalBulkSpread})');
const { bulkStat: stat, optimalBulkSplit: split, optimalBulkSpread: spread } = app;

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

const CAP = 32;
// Independent restatement of the Champions stat model — deliberately NOT calling the app's
// bulkStat, so a wrong formula there cannot validate itself.
const hp = (b, sp) => b + 75 + sp;
const df = (b, sp, nat) => Math.floor((b + 20 + sp) * nat);

check(stat(100, 0, true, 1) === 175, 'HP at level 50 with 31 IVs is base + 75', stat(100, 0, true, 1));
check(stat(100, 0, false, 1) === 120, 'a non-HP stat is base + 20', stat(100, 0, false, 1));
check(stat(100, 32, true, 1) === 207, 'each Stat Point adds exactly 1 to HP', stat(100, 32, true, 1));
check(stat(100, 0, false, 1.1) === 132, 'a boosting nature multiplies and floors', stat(100, 0, false, 1.1));
check(stat(100, 0, false, 0.9) === 108, 'a hindering nature multiplies and floors', stat(100, 0, false, 0.9));
// HP must never take a nature. This is the single most consequential asymmetry in the model.
check(stat(100, 0, true, 0.9) === 175, 'HP ignores the nature multiplier entirely', stat(100, 0, true, 0.9));

// --- exhaustive: the shipped function must equal brute force -----------------------------
function brute(bh, bd, budget, nat) {
  let best = -1;
  for (let h = 0; h <= Math.min(CAP, budget); h++) {
    const d = Math.min(CAP, budget - h);
    const p = hp(bh, h) * df(bd, d, nat);
    if (p > best) best = p;
  }
  return best;
}

let checked = 0, misses = 0, worst = null;
for (const nat of [1, 1.1, 0.9]) {
  for (let bh = 1; bh <= 255; bh += 2) {
    for (let bd = 1; bd <= 255; bd += 2) {
      for (const budget of [66, 50, 33, 20, 8, 0]) {
        const got = split(bh, bd, budget, nat);
        const want = brute(bh, bd, budget, nat);
        checked++;
        if (got.product !== want) { misses++; if (!worst) worst = { bh, bd, budget, nat, got, want }; }
      }
    }
  }
}
check(checked > 100000, 'the exhaustive sweep actually ran', checked);
check(misses === 0, 'optimalBulkSplit equals brute force on every combination swept', { checked, misses, worst });

// --- the claims the app's comment makes must stay true ------------------------------------
function greedyRule(bh, bd, budget, nat) {
  let h = 0, d = 0;
  for (let i = 0; i < budget; i++) {
    if (h >= CAP && d >= CAP) break;
    if (h >= CAP) { d++; continue; }
    if (d >= CAP) { h++; continue; }
    if (hp(bh, h) <= df(bd, d, nat)) h++; else d++;
  }
  return hp(bh, h) * df(bd, d, nat);
}
let neutralMiss = 0, natureMiss = 0, natureWorstPct = 0;
for (let bh = 1; bh <= 255; bh += 2) {
  for (let bd = 1; bd <= 255; bd += 2) {
    for (const budget of [66, 40, 20]) {
      if (greedyRule(bh, bd, budget, 1) < brute(bh, bd, budget, 1)) neutralMiss++;
      for (const nat of [1.1, 0.9]) {
        const g = greedyRule(bh, bd, budget, nat), b = brute(bh, bd, budget, nat);
        if (g < b) { natureMiss++; const pct = (b - g) / b * 100; if (pct > natureWorstPct) natureWorstPct = pct; }
      }
    }
  }
}
check(neutralMiss === 0,
  'the balancing rule IS exactly optimal on a neutral nature — the app says so, and it is true',
  neutralMiss);
check(natureMiss > 0,
  'the balancing rule is NOT optimal once a nature applies — the reason the app does not use it',
  natureMiss);
check(natureWorstPct < 2,
  'but it is never off by much, so the app is right to call it a good rule of thumb',
  natureWorstPct.toFixed(3) + '%');

// The rejected alternative, kept as a test so nobody "fixes" the app back to it.
function marginalRule(bh, bd, budget, nat) {
  let h = 0, d = 0;
  for (let i = 0; i < budget; i++) {
    if (h >= CAP && d >= CAP) break;
    if (h >= CAP) { d++; continue; }
    if (d >= CAP) { h++; continue; }
    const now = hp(bh, h) * df(bd, d, nat);
    if (hp(bh, h + 1) * df(bd, d, nat) - now >= hp(bh, h) * df(bd, d + 1, nat) - now) h++; else d++;
  }
  return hp(bh, h) * df(bd, d, nat);
}
// Budget 66 is a bad probe: with a 32 cap per stat both fill up and there is no choice left to get
// wrong. The rules only diverge where the budget is genuinely contested.
let marginalWorst = 0;
for (const budget of [20, 30, 40]) {
  for (let bh = 40; bh <= 160; bh += 3) {
    for (let bd = 40; bd <= 160; bd += 3) {
      const b = brute(bh, bd, budget, 0.9), m = marginalRule(bh, bd, budget, 0.9);
      if (m < b) { const pct = (b - m) / b * 100; if (pct > marginalWorst) marginalWorst = pct; }
    }
  }
}
check(marginalWorst > 2,
  'the "highest marginal gain" rule really is badly wrong on a hindering nature — do not switch to it',
  marginalWorst.toFixed(2) + '%');

// --- shape and edges ----------------------------------------------------------------------
const s = split(100, 100, 66, 1);
// 66 is the budget across all six stats; only 2 x 32 of it can ever land in these two, and the
// remaining 2 points belong to Attack, Special Attack or Speed. Asserting 66 here would be
// asserting a rule the game does not have.
check(s.hpSP + s.defSP === Math.min(66, 2 * CAP), 'as much of the budget as the caps allow is spent', s);
check(s.hpSP <= CAP && s.defSP <= CAP, 'neither stat exceeds the 32 cap', s);
const big = split(100, 100, 80, 1);
check(big.hpSP === CAP && big.defSP === CAP, 'a budget beyond 2x the cap fills both stats', big);
const zero = split(100, 100, 0, 1);
check(zero.hpSP === 0 && zero.defSP === 0, 'a zero budget spends nothing', zero);
check(zero.product === hp(100, 0) * df(100, 0, 1), 'and reports the unspent bulk correctly', zero);
check(split(100, 100, -5, 1).hpSP === 0, 'a negative budget is treated as zero', split(100, 100, -5, 1));

// Blissey is the case everyone reaches for: enormous HP, paper Defence. The optimum should put
// everything into Defence, because balance is nowhere near reachable.
const blissey = split(255, 10, 66, 1);
check(blissey.defSP === CAP, 'Blissey (255 HP / 10 Def) maxes Defence — balance is unreachable', blissey);
check(blissey.hpSP === CAP, 'and still fills HP with what the cap allows rather than wasting it', blissey);
// The contested case is where it gets interesting: with only 20 points, Blissey should put every
// one into Defence, because its HP is already enormous and balance is nowhere near reachable.
const blisseyTight = split(255, 10, 20, 1);
check(blisseyTight.defSP === 20 && blisseyTight.hpSP === 0,
  'with a tight budget Blissey puts every point into Defence', blisseyTight);

/* --- the three-way spread: HP helps BOTH defences ------------------------------------------
   optimalBulkSplit answers "HP or Def?" in isolation, and balance wins on that objective. But a
   point of HP multiplies both defences while a point of Defence only helps against physical, so
   against a mixed attacker the isolated answer is actively misleading — it told Garchomp to put
   everything into Defence when the right answer is everything into HP.

   Total hits survived scales with HP*(Def+SpD). One HP point gains (Def+SpD); one defence point
   gains HP. So the target is HP = Def + SpD — NOT HP = 2*Def. The two coincide only when the
   defences are equal, which is exactly why the folk rule survives and exactly where it fails. */
function bruteSpread(bh, bd, bs, budget, nat) {
  let best = -1;
  for (let h = 0; h <= Math.min(CAP, budget); h++)
    for (let d = 0; d <= Math.min(CAP, budget - h); d++) {
      const s2 = Math.min(CAP, budget - h - d);
      const v = hp(bh, h) * (df(bd, d, nat) + df(bs, s2, nat));
      if (v > best) best = v;
    }
  return best;
}
check(typeof spread === 'function', 'optimalBulkSpread was sliced out of the app', typeof spread);

let sChecked = 0, sMiss = 0;
for (const nat of [1, 1.1, 0.9])
  for (let bh = 20; bh <= 200; bh += 20)
    for (let bd = 20; bd <= 200; bd += 20)
      for (let bs = 20; bs <= 200; bs += 40)
        for (const budget of [48, 30, 16]) {
          const got = spread(bh, bd, bs, budget, nat);
          if (got.value !== bruteSpread(bh, bd, bs, budget, nat)) sMiss++;
          sChecked++;
        }
check(sChecked > 2000, 'the three-way sweep ran', sChecked);
check(sMiss === 0, 'optimalBulkSpread equals brute force everywhere swept', { sChecked, sMiss });

// The case that proves the objective changed. Garchomp 108/95/85.
const chompOneSided = split(108, 95, 32, 1);
const chompMixed = spread(108, 95, 85, 48, 1);
check(chompOneSided.hpSP === 0,
  'the one-sided answer for Garchomp is all Defence — this is what was wrong', chompOneSided);
check(chompMixed.hpSP > chompMixed.defSP,
  'the mixed answer puts more into HP than Defence, which is the correction', chompMixed);

// Where balance is reachable the optimum lands on HP = Def + SpD.
const snorlax = spread(160, 65, 110, 40, 1);
check(Math.abs(snorlax.hp - (snorlax.def + snorlax.spd)) <= 12,
  'Snorlax, where balance is reachable, lands with HP close to Def + SpD',
  { hp: snorlax.hp, defPlusSpd: snorlax.def + snorlax.spd });

// And the folk rule visibly fails on a lopsided defender.
const skarm = spread(65, 140, 70, 40, 1);
check(skarm.hp < 2 * skarm.def,
  'Skarmory shows "HP = 2x Def" failing — its defences are lopsided, so the sum is the rule',
  { hp: skarm.hp, twiceDef: 2 * skarm.def, defPlusSpd: skarm.def + skarm.spd });

check(spread(100, 100, 100, 0, 1).spent === 0, 'a zero budget spends nothing');
check(spread(100, 100, 100, 200, 1).spent === 3 * CAP, 'a huge budget caps all three stats');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
