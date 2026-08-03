/* HoopaDex — move table sort/filter contract tests
 * Run: node tests/test-move-table-contract.js
 *
 * Asserts on the REAL source of renderMovesSection() and sortMovesTable().
 *
 * The moves table sort shipped in 3.2 and did nothing at all until 4.1. sortMovesTable() reads every
 * value through `r.querySelector('td[data-'+key+']')`, and renderMovesSection() emitted no data-*
 * attributes whatsoever. Every comparison read '' against '', every row tied, and because the sort
 * is stable the order never changed — while the header still toggled its ascending/descending arrow,
 * so the control looked like it worked.
 *
 * That is a contract between two functions that no behavioural test would naturally cover, because
 * each half is individually sensible. This suite derives BOTH sides from the source and checks they
 * still agree: every sort key the header offers must be a key the renderer emits. Add a column to
 * the header without emitting its attribute and this goes red.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

function region(startsWith, endsWith, what) {
  const a = lines.findIndex(l => l.startsWith(startsWith));
  const b = lines.findIndex((l, i) => i > a && l.startsWith(endsWith));
  if (a < 0 || b < 0) throw new Error('could not locate ' + what);
  return lines.slice(a, b).join('\n');
}

const renderer = region('function renderMovesSection(', 'function toggleMissed(', 'renderMovesSection');
const sorter = region('function sortMovesTable(', 'document.addEventListener(', 'sortMovesTable');

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

// --- what the sorter reads --------------------------------------------------------------
check(/querySelector\('td\[data-'\+key\+'\]'\)/.test(sorter),
  'the sorter still addresses cells by a data- attribute built from the column key',
  sorter.match(/querySelector\([^)]*\)/g));

// --- what the header offers as sort keys -------------------------------------------------
const headerKeys = [...new Set([...renderer.matchAll(/<th class="ms" data-k="(\w+)"/g)].map(m => m[1]))];
check(headerKeys.length >= 5, 'found the sortable column keys in the header', headerKeys);
['name', 'cat', 'type', 'pow', 'acc', 'lv'].forEach(k =>
  check(headerKeys.includes(k), 'the header offers a "' + k + '" sort', headerKeys));

// --- what the renderer actually emits ----------------------------------------------------
const emitted = [...new Set([...renderer.matchAll(/<td data-(\w+)=/g)].map(m => m[1]))];
check(emitted.length > 0, 'the renderer emits data- attributes on its cells at all', emitted);

// THE assertion. This is the one that was false for eight versions.
const orphans = headerKeys.filter(k => !emitted.includes(k));
check(orphans.length === 0,
  'every sortable column emits the attribute the sorter reads — no silent no-op sort',
  { headerKeys, emitted, missing: orphans });

// --- both row emitters must carry them, or sorting reorders only half the table ----------
// The missed-moves rows sit in the same tbody as the normal rows.
const missedRow = renderer.split('\n').find(l => l.includes('missed-move-row'));
check(!!missedRow, 'found the missed-moves row emitter');
if (missedRow) {
  ['data-name=', 'data-cat=', 'data-type=', 'data-pow=', 'data-acc='].forEach(a =>
    check(missedRow.includes(a), 'the missed-moves row also emits ' + a));
}

// --- the type filter reads the row, not the rendered badge -------------------------------
const filter = region('function filterMovesByType(', 'function switchMovesTab(', 'filterMovesByType');
check(/getAttribute\('data-mtype'\)/.test(filter),
  'the type filter matches on data-mtype rather than parsing the rendered type badge');
check(/data-mtype="/.test(renderer), 'the renderer emits data-mtype on its rows');
const mtypeRows = (renderer.match(/<tr[^>]*data-mtype="/g) || []).length;
check(mtypeRows >= 2, 'both the normal and the missed row carry data-mtype', mtypeRows);

// Switching tab must recompute the count, which is per-tab.
const switcher = region('function switchMovesTab(', 'function getFormGenRange(', 'switchMovesTab');
check(/filterMovesByType\(\)/.test(switcher),
  'switching tab reapplies the filter so the per-tab count is not stale');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
