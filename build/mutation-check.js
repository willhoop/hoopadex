#!/usr/bin/env node
/* HoopaDex — mutation check
 * Run: node build/mutation-check.js
 *
 * Breaks the shipped app on purpose, one bug at a time, and asserts that the suite which claims to
 * cover that bug actually goes red. Exits non-zero if any mutation survives.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-03 the app had 23 suites and 778 assertions, all green. An architecture review applied
 * ten deliberate bugs and ran the whole battery against each one. FIVE SURVIVED:
 *
 *   critical hits at 2.5x instead of 1.5x            all 23 green
 *   STAB at 1.9x instead of 1.5x                     all 23 green
 *   the spread-move reduction deleted                all 23 green
 *   Zacian's historical Attack changed               all 23 green
 *   Venusaur deleted from the Reg M-A roster         all 23 green
 *   Mega Barbaracle given the wrong ability          all 23 green
 *
 * A green suite is evidence that the code has not changed. It is not evidence that the code is
 * right. The only way to know a test defends something is to break that thing and watch the test
 * fail — and having done that once by hand, the check belongs in CI, or it rots.
 *
 * This is a fixed, curated set rather than a general mutation engine. A real engine mutates every
 * operator and reports a percentage; that is a much bigger tool and most of its output would be
 * noise on a 645 KB single-file app. Each entry here is a bug shape that has actually occurred or
 * that would put a wrong number in front of a reader.
 *
 * ADDING ONE: pick a real defect, name the suite that should catch it, and check that it does.
 * If no suite catches it, that is the finding — write the test, do not delete the mutation.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const PRISTINE = fs.readFileSync(APP, 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hoopadex-mutation-'));

// [id, description, find, replace, expected match count, suite that must catch it]
const MUTATIONS = [
  ['M1', 'PAST_STATS: wrong Gen IX Attack for an unpinned species (Zacian)',
    '888:{9:{attack:130}}', '888:{9:{attack:170}}', 1, 'test-past-stats.js'],
  ['M2', 'POKEMON_PAST_TYPES: Mawile was Steel in Gen VI, claim Fire',
    "303:{6:['steel']}", "303:{6:['fire']}", 1, 'test-past-types.js'],
  ['M3', 'GEN1_SPECIAL: Ivysaur Special 80 -> 81',
    'const GEN1_SPECIAL={1:65,2:80,', 'const GEN1_SPECIAL={1:65,2:81,', 1, 'test-gen1-special.js'],
  ['M4', 'ITEM_INTRO_GEN: Absolite is Gen VI, claim Gen V',
    "'absolite':6,", "'absolite':5,", 1, 'test-generation-tables.js'],
  ['M5', 'Damage: critical hits multiply by 2.5x instead of 1.5x',
    'function calcLocalCritMult(gen){return gen>=6?1.5:2}',
    'function calcLocalCritMult(gen){return gen>=6?2.5:2}', 1, 'test-damage-formula.js'],
  ['M6', 'Damage: STAB becomes 1.9x instead of 1.5x',
    'return (attackerTypes||[]).some(function(t){return t.type.name===moveType})?1.5:1;',
    'return (attackerTypes||[]).some(function(t){return t.type.name===moveType})?1.9:1;', 1, 'test-damage-formula.js'],
  ['M7', 'Damage: drop the 0.75 spread-move reduction',
    'dm=Math.floor(base*o.spread);', 'dm=Math.floor(base*1);', 1, 'test-damage-formula.js'],
  ['M8', 'Type chart: Normal no longer resists through Steel',
    'const CM={normal:{rock:.5,ghost:0,steel:.5}', 'const CM={normal:{rock:.5,ghost:0}', 1, 'test-coverage.js'],
  ['M9', 'Champions: drop Venusaur from the Regulation M-A roster',
    'const CHAMPIONS_IDS_MA=new Set([3,6,9,', 'const CHAMPIONS_IDS_MA=new Set([6,9,', 1, 'test-champions-roster.js'],
  ['M10', 'CHAMP_MEGA_ABILITIES: Mega Barbaracle given the wrong ability',
    "{pokemon:'Mega Barbaracle',ability:'Tough Claws'}",
    "{pokemon:'Mega Barbaracle',ability:'Levitate'}", 1, 'test-mega-abilities.js'],
  ['M11', 'Version stamp disagrees with the newest CHANGELOG entry',
    '<!-- HOOPADEX VERSION: ', '<!-- HOOPADEX VERSION: 9.9 ', 1, 'test-syntax.js'],
];

function runSuite(suite, srcPath) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tests', suite)],
      { cwd: ROOT, stdio: 'pipe', timeout: 180000, env: Object.assign({}, process.env, { HOOPADEX_SRC: srcPath }) });
    return true;   // green
  } catch { return false; }  // red
}

let survived = 0, skipped = 0, killed = 0;
console.log(`mutation check — ${MUTATIONS.length} mutations\n`);

for (const [id, desc, find, repl, expect, suite] of MUTATIONS) {
  const n = PRISTINE.split(find).length - 1;
  if (n !== expect) {
    // The anchor moved. That is not a pass: the mutation is no longer testing anything.
    console.log(`${id}  SKIP   ${desc}\n       anchor matched ${n} times, expected ${expect} — update the anchor`);
    skipped++;
    continue;
  }
  const mutant = path.join(TMP, `${id}.html`);
  fs.writeFileSync(mutant, PRISTINE.split(find).join(repl));

  if (runSuite(suite, mutant)) {
    console.log(`${id}  SURVIVED  ${desc}\n       ${suite} stayed GREEN on broken code`);
    survived++;
  } else {
    console.log(`${id}  killed by ${suite}  —  ${desc}`);
    killed++;
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${killed} killed, ${survived} survived, ${skipped} skipped`);
if (survived || skipped) {
  console.log('\nA surviving mutation means a suite claims cover it does not have.');
  process.exit(1);
}
process.exit(0);
