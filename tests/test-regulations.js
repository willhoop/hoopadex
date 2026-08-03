/* HoopaDex — regulation diff tests
 * Run: node tests/test-regulations.js
 *
 * Slices the REAL regulationDiffs() out of app/index.html so the tests cannot drift from shipped
 * code.
 *
 * The point of this feature is that it is DERIVED. "What changed between Regulation M-A and M-B"
 * is a set difference over the roster the Pokédex already filters by, so the page cannot disagree
 * with the dex it describes, and adding a regulation to CHAMPIONS_REGS is the only edit needed —
 * the diff page and the "recently added" sort both fall out of it. An article typed by hand would
 * be wrong the first time the roster changed and nobody would notice.
 */
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html'), 'utf8').split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('function regulationDiffs()'));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function regRosterName'));
if (start < 0 || end < 0) throw new Error('could not locate regulationDiffs in index.html');

let CHAMPIONS_REGS = [];
const app = eval(lines.slice(start, end).join('\n') + '\n;({regulationDiffs})');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

// --- the ordinary case: a regulation that only adds ------------------------------------
CHAMPIONS_REGS = [
  { label: 'Reg B', short: 'b', ids: () => new Set([1, 2, 3, 45, 211]) },
  { label: 'Reg A', short: 'a', ids: () => new Set([1, 2, 3]) },
];
let d = app.regulationDiffs();
check(d.length === 1, 'one transition between two regulations', d.length);
check(d[0].from.label === 'Reg A' && d[0].to.label === 'Reg B', 'the diff runs older → newer', '');
check(JSON.stringify(d[0].added) === '[45,211]', 'additions found and sorted by dex number', d[0].added);
check(d[0].removed.length === 0, 'nothing removed when a regulation only adds', d[0].removed);
check(d[0].prevSize === 3 && d[0].size === 5, 'roster sizes reported from the sets themselves', '');

// --- removals, which a hand-written article is most likely to miss ----------------------
CHAMPIONS_REGS = [
  { label: 'Reg B', short: 'b', ids: () => new Set([1, 3, 99]) },
  { label: 'Reg A', short: 'a', ids: () => new Set([1, 2, 3]) },
];
d = app.regulationDiffs();
check(JSON.stringify(d[0].added) === '[99]', 'additions found alongside removals', d[0].added);
check(JSON.stringify(d[0].removed) === '[2]', 'removals are found, not just additions', d[0].removed);
check(d[0].size - d[0].prevSize === 0, 'a like-for-like swap nets to zero', '');

// --- three regulations produce two transitions, each against its own predecessor ---------
CHAMPIONS_REGS = [
  { label: 'C', short: 'c', ids: () => new Set([1, 2, 3, 4]) },
  { label: 'B', short: 'b', ids: () => new Set([1, 2, 3]) },
  { label: 'A', short: 'a', ids: () => new Set([1]) },
];
d = app.regulationDiffs();
check(d.length === 2, 'three regulations give two transitions', d.length);
check(d[0].from.label === 'B' && d[0].to.label === 'C', 'newest transition comes first', '');
check(JSON.stringify(d[0].added) === '[4]', 'the newest transition diffs against B, not A', d[0].added);
check(JSON.stringify(d[1].added) === '[2,3]', 'the older transition diffs A → B', d[1].added);

// --- degenerate cases -------------------------------------------------------------------
CHAMPIONS_REGS = [{ label: 'Only', short: 'o', ids: () => new Set([1, 2]) }];
check(app.regulationDiffs().length === 0, 'a single regulation has nothing to compare', '');
CHAMPIONS_REGS = [];
check(app.regulationDiffs().length === 0, 'an empty registry does not throw', '');

// An unchanged regulation must report an empty diff rather than being omitted — "nothing changed"
// is itself the answer someone is looking for.
CHAMPIONS_REGS = [
  { label: 'B', short: 'b', ids: () => new Set([1, 2]) },
  { label: 'A', short: 'a', ids: () => new Set([1, 2]) },
];
d = app.regulationDiffs();
check(d.length === 1, 'an unchanged regulation still produces a transition', d.length);
check(d[0].added.length === 0 && d[0].removed.length === 0, 'and reports it as empty on both sides', '');

// --- the shipped registry ----------------------------------------------------------------
// Re-slice with the real registry to confirm the page describes the roster the dex actually uses.
const realSrc = lines.join('\n');
const regStart = lines.findIndex(l => l.startsWith('const CHAMPIONS_IDS_MA='));
const regEnd = lines.findIndex((l, i) => i > regStart && l.startsWith('const LATEST_REG='));
const realRegs = eval(lines.slice(regStart, regEnd).join('\n') + '\n;({CHAMPIONS_REGS,REG_MB_NEW})');
CHAMPIONS_REGS = realRegs.CHAMPIONS_REGS;
d = app.regulationDiffs();
check(d.length >= 1, 'the shipped registry produces at least one transition', d.length);
check(JSON.stringify(d[0].added) === JSON.stringify(realRegs.REG_MB_NEW.slice().sort((a, b) => a - b)),
  'the derived additions equal REG_MB_NEW exactly — the page is computed, not transcribed', d[0].added);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
