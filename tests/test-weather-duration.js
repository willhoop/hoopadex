/* HoopaDex — weather ability duration tests
 * Run: node tests/test-weather-duration.js
 *
 * PokéAPI's text for the four weather abilities is Generation V wording and has never been updated:
 * "Summons a sandstorm that lasts indefinitely upon entering battle." True through Gen V. From
 * Gen VI ability weather runs 5 turns, or 8 with the matching rock. Snow Warning carries a second
 * staleness — it has summoned Snow rather than Hail since Gen IX.
 *
 * So the app asserted a duration that had been wrong for three generations, in Champions and every
 * modern generation. Reported by Will, who plays the game.
 *
 * This is the one hand-maintained table added deliberately, so it gets a suite of its own. Neither
 * source can supply the fact: PokéAPI has one description with no generation dimension, and
 * Showdown's text is duration-neutral, so there is nothing to diff against. Four entries about one
 * documented mechanic change.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const start = lines.findIndex(l => l.startsWith('const WEATHER_ABILITY_TEXT='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('/* One rule for whether a Pokemon'));
if (start < 0 || end < 0) throw new Error('could not locate the weather text helpers');
const app = eval('let getDataGenNum=()=>9;\n' + lines.slice(start, end).join('\n') +
  '\n;({WEATHER_ABILITY_TEXT,abilityDescForGen})');
const { WEATHER_ABILITY_TEXT: TABLE, abilityDescForGen: desc } = app;

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

const STALE = 'Summons a sandstorm that lasts indefinitely upon entering battle.';

check(typeof desc === 'function', 'abilityDescForGen was sliced out of the app', typeof desc);
check(Object.keys(TABLE).length === 4, 'exactly the four classic weather abilities are overridden',
  Object.keys(TABLE));

// --- the reported bug -------------------------------------------------------------------
const modern = desc('sand-stream', STALE, 9);
check(!/indefinitely/i.test(modern), 'Sand Stream is no longer described as indefinite in Gen IX', modern);
check(/5 turns/.test(modern), 'it states the real duration', modern);
check(/Smooth Rock/.test(modern), 'and names the item that extends it', modern);
check(/8/.test(modern), 'including the extended length', modern);

// --- but it WAS indefinite, and the app must still say so for those generations ----------
const old = desc('sand-stream', STALE, 5);
check(/until it is replaced/.test(old), 'in Gen V it is correctly described as lasting until replaced', old);
check(!/5 turns/.test(old), 'and does not claim the modern duration', old);
check(/until it is replaced/.test(desc('drought', '', 3)), 'Gen III Drought is likewise open-ended');
check(/5 turns/.test(desc('drought', '', 6)), 'Gen VI is where it changes', desc('drought', '', 6));

// --- each ability names its own weather and its own rock ---------------------------------
const EXPECT = [
  ['sand-stream', 'sandstorm', 'Smooth Rock'],
  ['drought', 'sunlight', 'Heat Rock'],
  ['drizzle', 'rain', 'Damp Rock'],
  ['snow-warning', null, 'Icy Rock'],
];
EXPECT.forEach(([n, weather, rock]) => {
  const t = desc(n, '', 8);
  if (weather) check(t.includes(weather), n + ' names the right weather', t);
  check(t.includes(rock), n + ' names the right rock', t);
});

// --- Snow Warning changed what it summons, not just how long -----------------------------
check(/hail/i.test(desc('snow-warning', '', 8)), 'Snow Warning summons Hail through Gen VIII',
  desc('snow-warning', '', 8));
check(/snow/i.test(desc('snow-warning', '', 9)) && !/hail/i.test(desc('snow-warning', '', 9)),
  'and Snow from Gen IX', desc('snow-warning', '', 9));

// --- everything else must pass through untouched -----------------------------------------
check(desc('levitate', 'Immune to Ground moves.', 9) === 'Immune to Ground moves.',
  'an unrelated ability is returned unchanged');
check(desc('primordial-sea', 'Creates heavy rain, which cannot be replaced.', 9)
  === 'Creates heavy rain, which cannot be replaced.',
  'Primordial Sea is NOT overridden — it really is indefinite and PokéAPI already says so');
check(desc('desolate-land', 'x', 9) === 'x', 'nor is Desolate Land');
check(desc('delta-stream', 'x', 9) === 'x', 'nor is Delta Stream');
check(desc(undefined, 'x', 9) === 'x', 'a missing name does not throw');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
