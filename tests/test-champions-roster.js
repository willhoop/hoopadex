/* HoopaDex — Champions roster integrity tests
 * Run: node tests/test-champions-roster.js
 *
 * CHAMPIONS_IDS is the last table in this app that is neither generated from a published source nor
 * validated against one. Base stats and typing come from Showdown's mod data, the regulation diff is
 * a set difference, move descriptors come from the bundled calc engine — this roster is ~200
 * hand-typed National Dex numbers.
 *
 * A wrong number here is invisible. The dex still renders, the filter still filters, the regulation
 * article still generates, and every one of them is quietly wrong about which Pokémon are legal.
 * These are the properties that CAN be checked without a network call, so they are checked on every
 * run. The evolution-stage question (babies and non-fully-evolved) needs PokéAPI and lives in
 * `build/audit-champions-roster.js`; its result at the time of writing is recorded below.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const a = lines.findIndex(l => l.startsWith('const CHAMPIONS_IDS_MA='));
const b = lines.findIndex((l, i) => i > a && l.startsWith('const LATEST_REG='));
if (a < 0 || b < 0) throw new Error('could not locate the Champions registry');
const src = lines.slice(a, b).join('\n');
const { CHAMPIONS_REGS, CHAMPIONS_IDS_MA, CHAMPIONS_IDS_MB, REG_MB_NEW } =
  eval(src + '\n;({CHAMPIONS_REGS,CHAMPIONS_IDS_MA,CHAMPIONS_IDS_MB,REG_MB_NEW})');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

// --- every id must be a real National Dex number --------------------------------------
for (const reg of CHAMPIONS_REGS) {
  const ids = [...reg.ids()];
  check(ids.length > 0, `${reg.label} is not empty`, ids.length);
  const bad = ids.filter(v => !Number.isInteger(v) || v < 1 || v > 1025);
  check(bad.length === 0, `${reg.label}: every id is a valid dex number`, bad);
}

// --- duplicates: the Set hides them, so check the SOURCE TEXT --------------------------
// A number written twice inside `new Set([...])` is silently collapsed. The roster would be one
// Pokémon short and every count in the app would still look self-consistent.
for (const [name, re] of [['M-A', /CHAMPIONS_IDS_MA=new Set\(\[([^\]]*)\]/],
                          ['REG_MB_NEW', /REG_MB_NEW=\[([^\]]*)\]/]]) {
  const m = src.match(re);
  check(!!m, `${name} literal is readable`, '');
  if (m) {
    const nums = m[1].split(',').map(s => s.trim()).filter(Boolean).map(Number);
    const dupes = [...new Set(nums.filter((v, i) => nums.indexOf(v) !== i))];
    check(dupes.length === 0, `${name} has no duplicate ids in the source literal`, dupes);
    check(nums.every(n => Number.isInteger(n)), `${name} contains only integers`, '');
  }
}

// --- regulations relate to each other correctly ----------------------------------------
check(CHAMPIONS_REGS.length >= 2, 'at least two regulations are on record', CHAMPIONS_REGS.length);
for (let i = 0; i < CHAMPIONS_REGS.length - 1; i++) {
  const newer = CHAMPIONS_REGS[i].ids(), older = CHAMPIONS_REGS[i + 1].ids();
  check(newer.size >= older.size,
    `${CHAMPIONS_REGS[i].label} is at least as large as ${CHAMPIONS_REGS[i + 1].label}`,
    [newer.size, older.size]);
}
// M-B is built as M-A plus REG_MB_NEW, so this must hold by construction. If it ever does not,
// someone edited one of the two without the other.
check(CHAMPIONS_IDS_MB.size === CHAMPIONS_IDS_MA.size + REG_MB_NEW.length,
  'M-B size equals M-A plus the additions', [CHAMPIONS_IDS_MB.size, CHAMPIONS_IDS_MA.size, REG_MB_NEW.length]);
check(REG_MB_NEW.every(id => !CHAMPIONS_IDS_MA.has(id)),
  'nothing in REG_MB_NEW was already in M-A', REG_MB_NEW.filter(id => CHAMPIONS_IDS_MA.has(id)));
check([...CHAMPIONS_IDS_MA].every(id => CHAMPIONS_IDS_MB.has(id)),
  'M-B contains every M-A entry — nothing was dropped', '');

// --- an anchor outside the app ------------------------------------------------------------
// Every check above this line is RELATIONAL: it compares the rosters to each other. An audit on
// 2026-08-03 deleted Venusaur from CHAMPIONS_IDS_MA and all 23 suites stayed green, because M-B is
// built from M-A — both sides shrank together and `M-B == M-A + additions` still held. Relational
// checks cannot detect a roster that is uniformly wrong.
//
// data/regulations.json is generated FROM this registry, so it is not an independent source of
// truth and cannot tell us the roster is CORRECT. What it can do is refuse to let the roster change
// without the committed artefact changing in the same pass. Regenerate with
// `node build/generate-regulations.js` when a roster legitimately changes.
const REGDATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'regulations.json'), 'utf8'));
const sizeOf = {};
REGDATA.regulations.forEach(r => { sizeOf[r.label] = r.size; });
for (const reg of CHAMPIONS_REGS) {
  const recorded = sizeOf[reg.label];
  check(recorded !== undefined, `${reg.label} appears in data/regulations.json`, Object.keys(sizeOf).join(', '));
  if (recorded !== undefined)
    check(reg.ids().size === recorded,
      `${reg.label} still has the ${recorded} entries the derivation recorded — regenerate if this changed on purpose`,
      `app ${reg.ids().size}, data/regulations.json ${recorded}`);
}
check(REGDATA.regulations.length === CHAMPIONS_REGS.length,
  'the app ships exactly the regulations the derivation knows about',
  `app ${CHAMPIONS_REGS.length}, derived ${REGDATA.regulations.length}`);

// --- registry shape ----------------------------------------------------------------------
check(CHAMPIONS_REGS.every(r => r.key && r.short && r.label && typeof r.ids === 'function'),
  'every registry row has key, short, label and ids()', '');
const keys = CHAMPIONS_REGS.map(r => r.key);
check(new Set(keys).size === keys.length, 'regulation keys are unique', keys);
const shorts = CHAMPIONS_REGS.map(r => r.short);
check(new Set(shorts).size === shorts.length, 'regulation short names are unique', shorts);

// --- evolution stages: recorded, not re-fetched -------------------------------------------
// From build/audit-champions-roster.js on 2026-08-03: no baby Pokémon, and exactly three entries
// that are not a final stage. All three are deliberate — Qwilfish only evolves as its Hisuian form,
// and Floette is present as its Mega (Eternal Flower), which cannot evolve. Pinning them means a
// FOURTH one arriving is a test failure that has to be justified, rather than a silent addition.
const KNOWN_NON_FINAL = [25, 211, 670];
check(KNOWN_NON_FINAL.every(id => CHAMPIONS_IDS_MB.has(id)),
  'the three known non-final-stage entries are still in the roster', '');
console.log('      note: run `node build/audit-champions-roster.js` to re-check evolution stages');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
