/* HoopaDex — calculator nature tests
 * Run: node tests/test-calc-nature.js
 *
 * A nature raises one stat and lowers another, so its effect on a damage calculation depends
 * entirely on WHICH stat the calculation uses — and that follows from the move's damage class.
 *
 * The first version of this (5.1) took only the side and asked whether the nature touched either
 * offensive stat. That gave a Jolly physical attacker 0.9, because Jolly lowers Special Attack —
 * which has nothing whatever to do with Close Combat. It understated that attacker's damage by 10%
 * and looked entirely plausible on screen. Found by pasting a real set in and reading the field.
 *
 * The mirror trap is on the defending side: Careful raises Special Defence, which does nothing
 * against a physical hit.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const start = lines.findIndex(l => l.startsWith('const CALC_NATURE='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function calcRefreshTeamPickers('));
if (start < 0 || end < 0) throw new Error('could not locate the calculator nature helpers');
/* calcNatureMultiplier is the function that actually had the bug, so it is exercised here too with
   the move category under the test's control. calcMoveIsPhysical reads the DOM and the move cache,
   so both are stubbed: true, false, or "not known yet". */
let physical = true;
const app = eval(
  'let getMoveCatForGen=function(){return physical?"physical":"special"};\n' +
  'let normalizeMoveName=function(x){return x};\n' +
  'let moveCache={x:{}};\n' +
  'let document={getElementById:function(){return {value:"x"}}};\n' +
  lines.slice(start, end).join('\n') +
  '\n;({CALC_NATURE,calcNatureMultiplierFor,calcNatureMultiplier,' +
  'setPhysical:function(v){physical=v;moveCache=(v===null)?{}:{x:{}}}})');
const { CALC_NATURE: NAT, calcNatureMultiplierFor: mult,
        calcNatureMultiplier: bySide, setPhysical } = app;

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

check(typeof mult === 'function', 'calcNatureMultiplierFor was sliced out of the app', typeof mult);
check(Object.keys(NAT).length === 20, 'all 20 non-neutral natures are mapped', Object.keys(NAT).length);

// --- the bug, stated directly ------------------------------------------------------------
check(mult('Jolly', 'attack') === 1,
  'Jolly does NOT change Attack — a Jolly physical attacker is neutral, not 0.9');
check(mult('Jolly', 'special-attack') === 0.9, 'Jolly DOES lower Special Attack');
check(mult('Jolly', 'speed') === 1.1, 'and raises Speed');

check(mult('Careful', 'special-defense') === 1.1, 'Careful raises Special Defence');
check(mult('Careful', 'defense') === 1,
  'but does nothing to Defence — a Careful defender is neutral against a physical hit');

check(mult('Adamant', 'attack') === 1.1, 'Adamant raises Attack');
check(mult('Adamant', 'special-attack') === 0.9, 'and lowers Special Attack');
check(mult('Modest', 'special-attack') === 1.1, 'Modest raises Special Attack');
check(mult('Modest', 'attack') === 0.9, 'and lowers Attack');
check(mult('Bold', 'defense') === 1.1, 'Bold raises Defence');
check(mult('Timid', 'attack') === 0.9, 'Timid lowers Attack');
check(mult('Timid', 'defense') === 1, 'and leaves Defence alone');

// --- neutral and nonsense input ----------------------------------------------------------
['Hardy', 'Docile', 'Serious', 'Bashful', 'Quirky'].forEach(n =>
  check(mult(n, 'attack') === 1 && mult(n, 'special-defense') === 1,
    n + ' is neutral in every stat'));
check(mult(undefined, 'attack') === 1, 'a missing nature is neutral');
check(mult('Jolly', undefined) === 1, 'a missing stat is neutral rather than a guess');
check(mult('NotANature', 'attack') === 1, 'an unknown nature is neutral');

// --- every mapping is internally consistent ----------------------------------------------
const STATS = ['attack', 'defense', 'special-attack', 'special-defense', 'speed'];
Object.entries(NAT).forEach(([name, pair]) => {
  check(pair.length === 2 && pair[0] !== pair[1],
    name + ' raises and lowers two different stats', pair);
  check(STATS.includes(pair[0]) && STATS.includes(pair[1]),
    name + ' names real stats', pair);
  const raised = STATS.filter(s => mult(name, s) === 1.1);
  const lowered = STATS.filter(s => mult(name, s) === 0.9);
  check(raised.length === 1 && lowered.length === 1,
    name + ' raises exactly one stat and lowers exactly one', { raised, lowered });
});
// No nature touches HP. This is the same asymmetry the stat formula article exists to state.
Object.keys(NAT).forEach(n => check(mult(n, 'hp') === 1, n + ' does not touch HP'));

// --- the wiring that makes it depend on the move ------------------------------------------
const src = lines.join('\n');
check(/function calcMoveIsPhysical\(\)\{/.test(src),
  'the move damage class is what selects the stat');
check(/if\(!md\)return null;/.test(src),
  'an unknown move returns null rather than guessing a category');
check(/function calcSyncNatures\(\)\{/.test(src),
  'natures are re-derived when the move changes');
check(/calcSyncNatures\(\);calcRun\(\)/.test(src),
  'and that happens before the damage is recalculated');
check(/ensureMoveData\(n\)/.test(src),
  "a pasted set loads its moves' data, or the category would be unknown and the nature would fall back");

/* --- the regression itself, through the function that had it ------------------------------
   5.1 asked only "does this nature touch either offensive stat", which is why a Jolly physical
   attacker came out at 0.9. These eight assertions are the whole bug. */
setPhysical(true);
check(bySide('Jolly', 'atk') === 1,
  'Jolly attacker using a PHYSICAL move is neutral — the 5.1 bug returned 0.9', bySide('Jolly', 'atk'));
check(bySide('Adamant', 'atk') === 1.1, 'Adamant attacker using a physical move is boosted');
check(bySide('Careful', 'def') === 1,
  'Careful defender against a PHYSICAL move is neutral — Special Defence is irrelevant there',
  bySide('Careful', 'def'));
check(bySide('Bold', 'def') === 1.1, 'Bold defender against a physical move is boosted');

setPhysical(false);
check(bySide('Jolly', 'atk') === 0.9, 'Jolly attacker using a SPECIAL move really is 0.9');
check(bySide('Modest', 'atk') === 1.1, 'Modest attacker using a special move is boosted');
check(bySide('Careful', 'def') === 1.1, 'Careful defender against a SPECIAL move is boosted');
check(bySide('Bold', 'def') === 1, 'Bold defender against a special move is neutral');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
