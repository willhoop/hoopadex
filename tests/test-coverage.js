/* HoopaDex — attacking coverage tests
 * Run: node tests/test-coverage.js
 *
 * The Attacking Type Calculator scores each defending type by the BEST of the chosen attacking
 * types, because in a battle you use the move that works — coverage is a maximum, not a total.
 * Summing or averaging would make four bad moves look like one good one.
 *
 * The type charts themselves are verified against Showdown in test-generation-tables.js; this suite
 * checks the coverage logic sitting on top of them, using the app's own charts so the two cannot
 * disagree.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

const grab = name => {
  const m = src.match(new RegExp('^const ' + name + '=(\\{.*?\\});$', 'm'));
  if (!m) throw new Error('could not locate ' + name);
  return eval('(' + m[1] + ')');
};
const CM = grab('CM'), C1 = grab('C1');
const T18 = ['normal','fire','water','electric','grass','ice','fighting','poison','ground',
             'flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

// The same rule the app applies: best of the picked types against each defender.
const eff = (chart, a, d) => (chart[a] || {})[d] === undefined ? 1 : (chart[a] || {})[d];
function coverage(chart, types, picks) {
  const best = {};
  types.forEach(def => {
    let b = 0;
    picks.forEach(atk => { const m = eff(chart, atk, def); if (m > b) b = m; });
    best[def] = b;
  });
  const g = { se: [], neutral: [], resist: [], immune: [] };
  types.forEach(def => {
    const m = best[def];
    g[m >= 2 ? 'se' : (m === 1 ? 'neutral' : (m === 0 ? 'immune' : 'resist'))].push(def);
  });
  return g;
}

// --- the shape of the answer -------------------------------------------------------------
const fourMove = coverage(CM, T18, ['fighting', 'fire', 'rock', 'ground']);
check(fourMove.se.length + fourMove.neutral.length + fourMove.resist.length + fourMove.immune.length === 18,
  'every type lands in exactly one bucket');
check(fourMove.se.length === 11, 'Fighting/Fire/Rock/Ground is super effective on 11 of 18',
  fourMove.se.length);
check(fourMove.se.includes('steel') && fourMove.se.includes('ice'),
  'including Steel and Ice, which that spread is chosen for');
check(!fourMove.se.includes('fairy') && !fourMove.se.includes('dragon'),
  'and not Fairy or Dragon, which is the well-known hole in it', fourMove.se);

// --- best-of, not sum: the property that makes the tool honest ---------------------------
// Adding a move that hits nothing new must not improve the picture.
const before = coverage(CM, T18, ['fire']).se.length;
const after = coverage(CM, T18, ['fire', 'fire']).se.length;
check(before === after, 'repeating a type changes nothing — the score is a maximum, not a total',
  { before, after });
// Adding any move can only ever help, never hurt.
const one = coverage(CM, T18, ['water']).se;
const two = coverage(CM, T18, ['water', 'electric']).se;
check(one.every(t => two.includes(t)), 'adding a move never removes coverage you already had',
  { one, two });
check(two.length > one.length, 'and a genuinely new type adds some', { one: one.length, two: two.length });

// --- immunities are real zeroes, not just resistances ------------------------------------
const normalOnly = coverage(CM, T18, ['normal']);
check(normalOnly.immune.length === 1 && normalOnly.immune[0] === 'ghost',
  'Normal alone is walled by Ghost, and that is an immunity not a resistance', normalOnly.immune);
check(normalOnly.se.length === 0, 'Normal is super effective against nothing', normalOnly.se);
check(normalOnly.resist.sort().join(',') === 'rock,steel', 'and resisted by Rock and Steel',
  normalOnly.resist);

// A type that is immune to one pick but hit by another must NOT be reported as immune.
const withFighting = coverage(CM, T18, ['normal', 'fighting']);
check(!withFighting.immune.includes('ghost'),
  'Ghost stops being immune once a move that touches it is added');
check(withFighting.immune.length === 0, 'nothing else is immune to that pair', withFighting.immune);

// --- an empty pick answers nothing rather than everything --------------------------------
const none = coverage(CM, T18, []);
check(none.se.length === 0 && none.immune.length === 18,
  'no moves means no coverage at all — every type scores zero', {
    se: none.se.length, immune: none.immune.length });

// --- the generation matters ---------------------------------------------------------------
const T15 = T18.filter(t => t !== 'dark' && t !== 'steel' && t !== 'fairy');
const gen1Psychic = coverage(C1, T15, ['psychic']);
check(!gen1Psychic.immune.includes('ghost'),
  'in Gen I, Psychic is not walled by Ghost — the tool uses the chart for the selected generation',
  gen1Psychic.immune);
const modernPsychic = coverage(CM, T18, ['psychic']);
check(modernPsychic.immune.includes('dark'),
  'while in the modern chart Psychic cannot touch Dark');

// --- the wiring -----------------------------------------------------------------------------
check(/const COVERAGE_SLOTS=4;/.test(src), 'there are four move slots, matching a real set');
check(/function runCoverage\(\)\{/.test(src), 'runCoverage exists');
check(/if\(m>b\)b=m/.test(src), 'the app takes the maximum, as this suite assumes');
check(/getChartForGen\(genNum\)/.test(src), 'and reads the chart for the selected generation');
check(/is':'are'/.test(src), 'the verdict agrees in number rather than saying "1 types are"');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
