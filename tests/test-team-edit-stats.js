/* HoopaDex — team editor stat round-trip tests
 * Run: node tests/test-team-edit-stats.js
 *
 * Slices the REAL EDIT_STAT_KEY map and readStatObj() out of app/index.html, and asserts on the
 * REAL source text of the editor's stat-input read.
 *
 * This bug has now shipped twice. The team editor addresses its inputs by short names
 * (hp/atk/def/spa/spd/spe); a stored spread uses PokeAPI keys
 * (hp/attack/defense/special-attack/special-defense/speed). `hp` is the ONLY key the two spellings
 * share. Look a short name up in a canonical-keyed object and every stat except HP comes back
 * undefined, loads as 0, and is then dropped by saveTeamEdit's `if(v>0)`. Opening a slot and
 * pressing Done — or clicking the backdrop, which also saves — turned a 66-point Champions spread
 * into "2 HP".
 *
 * v3.4 fixed the WRITE side (saveTeamEdit stores through EDIT_STAT_KEY) and left the READ side, so
 * the bug returned unchanged. A round-trip test is the only thing that catches that, because each
 * half is individually reasonable-looking.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

const start = lines.findIndex(l => l.startsWith('const EDIT_STAT_KEY='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('// Search results showed a bare name'));
if (start < 0 || end < 0) throw new Error('could not locate the stat key map');
const app = eval(lines.slice(start, end).join('\n') + '\n;({EDIT_STAT_KEY,readStatObj})');
const { EDIT_STAT_KEY: KEY, readStatObj: norm } = app;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

check(typeof norm === 'function', 'readStatObj was sliced out of the app', typeof norm);
check(KEY && KEY.atk === 'attack' && KEY.spe === 'speed', 'EDIT_STAT_KEY maps short names to PokeAPI keys', KEY);

// --- the trap that makes this bug possible ---------------------------------------------
const SHORT = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const shared = SHORT.filter(s => KEY[s] === s);
check(shared.length === 1 && shared[0] === 'hp',
  'hp is the only key the two spellings share — which is why HP alone survived', shared);

// --- structural: the editor must not read the stored spread by short name ---------------
// This is the assertion that actually catches a revert, because the defect is in one expression.
const evReadLine = lines.find(l => /const val=/.test(l) && /EDIT_STAT_KEY|evsIn|readStatObj/.test(l));
check(!!evReadLine, 'the editor stat-input read goes through the canonical key map',
  lines.filter(l => /const val=/.test(l)).slice(0, 3));
check(!lines.some(l => /const val=s\.evs\?\.\[stat\]/.test(l)),
  'the editor no longer indexes s.evs by the short input name',
  lines.filter(l => /const val=s\.evs/.test(l)));

// --- behavioural: the full open-then-save round trip ------------------------------------
// The read is taken from the SHIPPED SOURCE, not re-implemented here. A test that models the code
// instead of running it would pass against the broken version — which is the whole reason this
// defect survived a release. `evsIn` is bound the way the app binds it, so an expression that
// ignores it (the pre-fix `s.evs?.[stat]`) yields 0 and the assertions below go red.
const forEachAt = lines.findIndex(l => /statNames\.forEach\(\(stat,i\)=>\{/.test(l));
if (forEachAt < 0) throw new Error('could not locate the editor stat-input loop');
const readSrc = (lines[forEachAt + 1].match(/const val=(.*);\s*$/) || [])[1];
if (!readSrc) throw new Error('could not extract the stat-input read expression');
console.log('note  exercising the shipped read expression: ' + readSrc);

const readField = new Function('s', 'stat', 'evsIn', 'EDIT_STAT_KEY', 'readStatObj',
  'return (' + readSrc + ');');

function openEditor(stored) {
  const s = { evs: stored };
  const evsIn = norm(stored);              // exactly what the app computes before the loop
  const fields = {};
  SHORT.forEach(k => { fields[k] = readField(s, k, evsIn, KEY, norm); });
  return fields;
}
function pressDone(fields) {
  const out = {};
  SHORT.forEach(s => { const v = parseInt(fields[s]) || 0; if (v > 0) out[KEY[s]] = v; });
  return out;
}
const roundTrip = stored => pressDone(openEditor(stored));

// Blaziken as imported: the exact shape from the comment in the source.
const BLAZIKEN = { hp: 2, attack: 32, speed: 32 };
check(JSON.stringify(roundTrip(BLAZIKEN)) === JSON.stringify(BLAZIKEN),
  'a 2 HP / 32 Atk / 32 Spe spread survives opening and saving the editor', roundTrip(BLAZIKEN));

// A full 66-point Champions spread across five stats.
const FULL = { hp: 15, attack: 32, defense: 1, speed: 18 };
check(JSON.stringify(roundTrip(FULL)) === JSON.stringify(FULL),
  'a full 66-point spread survives the round trip', roundTrip(FULL));
check(Object.values(roundTrip(FULL)).reduce((a, b) => a + b, 0) === 66,
  'the Champions budget still totals 66 after a round trip', roundTrip(FULL));

// Special-attack / special-defense are the longest key mismatch and worth naming separately.
const SPECIAL = { hp: 9, 'special-attack': 28, speed: 29 };
check(JSON.stringify(roundTrip(SPECIAL)) === JSON.stringify(SPECIAL),
  'special-attack survives — its short name (spa) shares no characters with its key', roundTrip(SPECIAL));

// Repeated opens must be stable, not lossy each time.
check(JSON.stringify(roundTrip(roundTrip(roundTrip(FULL)))) === JSON.stringify(FULL),
  'three consecutive opens do not erode the spread', roundTrip(roundTrip(roundTrip(FULL))));

// A spread already stored in the short spelling (older saved team) must still load.
check(JSON.stringify(roundTrip({ hp: 4, atk: 32, spe: 30 })) === JSON.stringify({ hp: 4, attack: 32, speed: 30 }),
  'an older team saved with short keys is normalised rather than dropped',
  roundTrip({ hp: 4, atk: 32, spe: 30 }));

// Degradation.
check(JSON.stringify(roundTrip({})) === '{}', 'an empty spread stays empty');
check(JSON.stringify(roundTrip(undefined)) === '{}', 'a missing spread does not throw');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
