/* HoopaDex — Speed Tiers roster
 * Run: node tests/test-speed-tiers.js
 *
 * Why this suite exists. Speed Tiers built its list with
 * `master.filter(p => CHAMPIONS_IDS.has(p.id))`. The Champions roster names SPECIES, not formes,
 * and every alternate form is a separate PokéAPI entry with an id above 10000 — so that filter
 * excluded every Mega and every regional form in the format, silently.
 *
 * For a speed table that is not a cosmetic omission, it is a wrong answer. The table reported
 * Dragapult at 319 as the fastest thing in Regulation M-B. Measured after the fix: Mega Absol,
 * Mega Garchomp and Mega Lucario all reach 334, and 78 Megas were missing from a 208-row table.
 * Anyone using it to decide what outspeeds what was reading a list with the top cut off.
 *
 * The fix reuses `calcRoster()` — the Damage Calc's roster, base species plus every form
 * `formAllowed()` permits — rather than building a second list. These assertions pin that reuse.
 * They are structural: renderSpeedTiers writes DOM and awaits network calls, so a behavioural
 * harness for it is real work and is recorded as open rather than faked here. What they do catch
 * is the regression that actually happened — someone reaching for CHAMPIONS_IDS directly.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

function slice(startsWith, endsWith) {
  const a = lines.findIndex(l => l.startsWith(startsWith));
  const b = lines.findIndex((l, i) => i > a && l.startsWith(endsWith));
  if (a < 0 || b < 0) throw new Error('could not locate ' + startsWith + ' .. ' + endsWith);
  return lines.slice(a, b).join('\n');
}

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

const speed = slice('function renderSpeedTiers()', 'function setSpeedSort(');

// --- the roster comes from the shared, forms-aware source -------------------------------------
check(/const roster=calcRoster\(\);/.test(speed),
  'Speed Tiers takes its roster from calcRoster(), the same one the Damage Calc uses');
check(!/CHAMPIONS_IDS\.has/.test(speed),
  'and does NOT filter CHAMPIONS_IDS directly — that is what dropped every Mega',
  'found a direct CHAMPIONS_IDS.has() call in renderSpeedTiers');

// --- the form data actually gets fetched -------------------------------------------------------
// calcRoster() returning a Mega is useless if nothing loads its stats: dc[] is keyed by id and
// ensureRosterLoaded only knew about CHAMPIONS_IDS, none of which are above 10000.
check(/ensureRosterLoaded\(renderSpeedTiers,roster\.map/.test(speed),
  'the loader is told which ids to fetch, so form stats are actually loaded');

const loader = slice('async function ensureRosterLoaded(', 'function setSpeedSort(');
check(/\(ids\|\|\[\.\.\.CHAMPIONS_IDS\]\)/.test(loader),
  'ensureRosterLoaded accepts an id list and still defaults to the base roster', loader.slice(0, 200));

// --- forms are named the way the rest of the app names them ------------------------------------
check(/formDisplayName\(p\.name\)/.test(speed),
  'a form is labelled with formDisplayName, the one definition of a form\'s on-screen name');
check(/p\.id>10000\?formDisplayName/.test(speed),
  'and base species still go through pokeName');

// --- calcRoster is genuinely forms-aware --------------------------------------------------------
const calcRosterFn = slice('function calcRoster()', 'function renderCalcTab');
check(/master\.filter\(ok\)\.concat\(formsIndex\.filter\(ok\)\)/.test(calcRosterFn),
  'calcRoster is base species PLUS formsIndex, both filtered by formAllowed', calcRosterFn.slice(0, 160));

// --- Megas must survive formAllowed in Champions ------------------------------------------------
// Champions is generation 9. If the mega window ever stops including 9, Speed Tiers silently
// loses 78 rows again and this is the assertion that says so.
const formGen = slice('function getFormGenRange(name)', 'async function renderDetail(');
check(/g>=6&&g<=7\|\|g>=9/.test(formGen),
  'Gen VI megas are available in Generation IX, which is what Champions selects');
check(/return \{available:g=>g>=9, label:'Gen IX \(Z-A\)'\}/.test(formGen),
  'and Z-A-only megas are Generation IX');

// --- the count says what it is showing ----------------------------------------------------------
check(/Mega and alternate forms/.test(speed),
  'the caption reports how many forms were added, rather than quietly changing the total');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
