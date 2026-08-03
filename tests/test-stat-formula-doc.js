/* HoopaDex — stat formula article tests
 * Run: node tests/test-stat-formula-doc.js
 *
 * docs/STAT-FORMULA.md is generated from the app's own bulkStat() and SPEED_COLS. A generated
 * document is only worth anything if something notices when it stops matching its source — otherwise
 * it is a hand-written document with extra steps, and it goes stale exactly like the tables this
 * project already had to replace.
 *
 * So this suite recomputes the article's headline numbers from the shipped functions and asserts the
 * document still says them. Change the model without rerunning the generator and this goes red.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const DOC = path.join(ROOT, 'docs', 'STAT-FORMULA.md');

const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
function slice(a0, b0, what) {
  const a = lines.findIndex(l => l.startsWith(a0));
  const b = lines.findIndex((l, i) => i > a && l.startsWith(b0));
  if (a < 0 || b < 0) throw new Error('could not locate ' + what);
  return lines.slice(a, b).join('\n');
}
const stat = eval(slice('function bulkStat(', 'function optimalBulkSplit(', 'bulkStat') + '\n;(bulkStat)');
const { SPEED_COLS } = eval(slice('const SPEED_COLS=[', 'let speedSortCol=', 'SPEED_COLS') + '\n;({SPEED_COLS})');

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

check(fs.existsSync(DOC), 'docs/STAT-FORMULA.md exists');
if (!fs.existsSync(DOC)) { console.log('\n0 passed, 1 failed'); process.exit(1); }
const doc = fs.readFileSync(DOC, 'utf8');

check(/Do not edit by hand/i.test(doc), 'the article says it is generated');

// --- the two constants, recovered from the shipped function -----------------------------
const HP_CONST = stat(0, 0, true, 1);
const OTHER = stat(0, 0, false, 1);
check(HP_CONST !== OTHER, 'HP and non-HP constants genuinely differ — the article has a point',
  { HP_CONST, OTHER });
check(doc.includes('base + ' + HP_CONST + ' + SP'), 'the article states the current HP formula', HP_CONST);
check(doc.includes('base + ' + OTHER + ' + SP'), 'the article states the current non-HP formula', OTHER);
check(doc.includes((HP_CONST - OTHER) + '-point head start'),
  'the article states the current gap between them', HP_CONST - OTHER);

// The warning is the reason the document exists; it must survive any rewrite.
check(/never touches HP|do not apply/i.test(doc), 'the article says natures do not apply to HP');
check(/HP uses a different constant/i.test(doc), 'the article leads with the HP difference');

// --- worked numbers must match what the app computes -------------------------------------
check(doc.includes(stat(100, 0, true, 1) + ' HP and ' + stat(100, 0, false, 1)),
  'the base-100 worked example matches the app', [stat(100, 0, true, 1), stat(100, 0, false, 1)]);
check(doc.includes('**' + stat(255, 0, true, 1) + '**'),
  'the Blissey HP figure matches the app', stat(255, 0, true, 1));

// --- the nature step table: the reason a Stat Point is not always worth 1 ----------------
const hindering = [0, 1, 2, 3, 4].map(sp => stat(100, sp, false, 0.9));
check(hindering[0] === hindering[1],
  'a hindering nature really does waste the first Stat Point — the claim the article makes',
  hindering);
[0, 1, 2, 3, 4].forEach(sp => {
  const row = '| ' + sp + ' | ' + stat(100, sp, false, 1) + ' | ' + stat(100, sp, false, 1.1) + ' | ' + stat(100, sp, false, 0.9) + ' |';
  check(doc.includes(row), 'the step table row for ' + sp + ' SP matches the app', row);
});

// --- speed tiers -------------------------------------------------------------------------
check(SPEED_COLS.length >= 5, 'the speed columns were sliced', SPEED_COLS.length);
SPEED_COLS.forEach(c => {
  const row = '| ' + c.label + ' | ' + c.hint + ' | ' + c.f(100) + ' | ' + c.f(130) + ' |';
  check(doc.includes(row), 'the speed row for "' + c.label + '" matches the app', row);
});
// Jolteon is the row the model was originally checked against; keep that check alive.
check(SPEED_COLS.map(c => c.f(130)).join('/') === '300/200/182/150/130/135',
  'Jolteon (base 130) still gives 300/200/182/150/130/135',
  SPEED_COLS.map(c => c.f(130)).join('/'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
