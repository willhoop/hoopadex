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

  /* Added 2026-08-03 by the engineering review. The eleven above covered 9 of the 27 suites;
     the other 18 had never been proven to fail. Mutating them one at a time found two real
     holes (M12 and M13 below) and confirmed the rest. */
  ['M12', 'Damage: dual-type effectiveness takes the MAX instead of the product',
    '(defenderTypes||[]).forEach(function(t){m*=eff(moveType,t.type.name,chart)});',
    '(defenderTypes||[]).forEach(function(t){m=Math.max(m,eff(moveType,t.type.name,chart))});',
    1, 'test-damage-formula.js'],
  ['M13', "Routing: restoreHash goes back to its own copy of the '#' strip",
    '  const h=hashPath();', "  const h=(location.hash||'').replace(/^#/,'');", 1, 'test-hash-routing.js'],
  ['M14', 'Bulk: the HP constant changes from 75 to 70',
    'return isHP ? base+75+sp', 'return isHP ? base+70+sp', 1, 'test-bulk-split.js'],
  ['M15', 'Natures: Adamant raises Defence instead of Attack',
    "Adamant:['attack','special-attack']", "Adamant:['defense','special-attack']", 1, 'test-calc-nature.js'],
  ['M16', 'Team editor: EVs typed into Sp. Atk land on Sp. Def',
    "const EDIT_STAT_KEY={hp:'hp',atk:'attack',def:'defense',spa:'special-attack'",
    "const EDIT_STAT_KEY={hp:'hp',atk:'attack',def:'defense',spa:'special-defense'", 1, 'test-team-edit-stats.js'],
  ['M17', 'Paste import: an imported Sp. Def EV lands on Sp. Atk',
    "const PASTE_STATKEY={hp:'hp',atk:'attack',def:'defense',spa:'special-attack',spd:'special-defense'",
    "const PASTE_STATKEY={hp:'hp',atk:'attack',def:'defense',spa:'special-attack',spd:'special-attack'",
    1, 'test-paste-import.js'],
  ['M18', 'Weather: Sand Stream names the wrong extending item',
    "'sand-stream':  {weather:'a sandstorm', rock:'Smooth Rock'}",
    "'sand-stream':  {weather:'a sandstorm', rock:'Icy Rock'}", 1, 'test-weather-duration.js'],
  ['M19', 'Search: DEX_TYPES loses a type',
    "const DEX_TYPES=['normal','fire',", "const DEX_TYPES=['fire',", 1, 'test-dex-search.js'],
  ['M20', 'Forms: baseSpeciesId stops splitting on hyphens',
    "const parts=String(formName).toLowerCase().split('-');",
    'const parts=[String(formName).toLowerCase()];', 1, 'test-form-names.js'],
  ['M21', 'Regulation items: an item is dropped from the M-A to M-B diff',
    '{added:["Barbaracite","Big Root",', '{added:["Big Root",', 1, 'test-regulation-items.js'],
  ['M22', 'Ability text: the restatement threshold drops from 0.7 to 0.3',
    'return hit.length/short.length>=(threshold===undefined?0.7:threshold);',
    'return hit.length/short.length>=(threshold===undefined?0.3:threshold);', 1, 'test-ability-desc.js'],
  ['M23', 'Palette: colourblind mode loses its distinct up colour',
    '--eff-up-solid:#3987e5', '--eff-up-solid:#ff0000', 1, 'test-viz-palette.js'],
  ['M24', 'Speed tiers: the neutral-nature Scarf column is computed from the boosting figure',
    "{key:'scarfn', label:'Neutral 32 + Scarf', hint:'neutral nature, 32 SP, Choice Scarf', f:b=>Math.floor((b+20+32)*1.5)}",
    "{key:'scarfn', label:'Neutral 32 + Scarf', hint:'neutral nature, 32 SP, Choice Scarf', f:b=>Math.floor(Math.floor((b+20+32)*1.1)*1.5)}",
    1, 'test-stat-formula-doc.js'],
  ['M25', 'Speed tiers: the roster goes back to species only, dropping every Mega and form',
    '  const roster=calcRoster();\n  const _spForms',
    '  const roster=master.filter(function(p){return CHAMPIONS_IDS.has(p.id)});\n  const _spForms',
    1, 'test-speed-tiers.js'],
  ['M26', 'Bulk: the roster goes back to species only, dropping every Mega and form',
    '  const roster=calcRoster();\n  const _bkForms',
    '  const roster=master.filter(function(m){return CHAMPIONS_IDS.has(m.id)});\n  const _bkForms',
    1, 'test-speed-tiers.js'],
  ['M27', 'Forms: the Legends Z-A mega suffix loses its case, so two Pokémon share one name',
    ":name.includes('-mega-z')?' Z-A'", ":name.includes('-mega-zzz')?' Z-A'", 1, 'test-form-names.js'],
  ['M28', 'Forms: a Mega no longer has to have a legal Mega Stone, so Z-A megas return',
    'if(need&&isChampionsMode&&!CHAMPIONS_ITEMS.has(need))return false;',
    'if(false)return false;', 1, 'test-form-names.js'],
  ['M29', 'Forms: battle-only formes become selectable, so Ash-Greninja returns',
    'if(FORM_BATTLE_ONLY.has(flat))return false;', 'if(false)return false;', 1, 'test-form-names.js'],
  ['M30', 'Typing list: formes are dropped at the source again, so Fire/Dragon answers nothing',
    'const set=new Set(list.filter(n=>n>0));', 'const set=new Set(list.filter(n=>n>0&&n<=10000));',
    1, 'test-dual-typing.js'],
  ['M31', 'Typing list: genMax is re-applied to the forme id, which rejects every forme',
    '      return _tcRoster.has(id);', '      return id<=genMax&&_tcRoster.has(id);',
    1, 'test-dual-typing.js'],
  ['M32', 'Damage: burn halves special attacks too',
    "burn:(o.burn&&o.cat==='physical')?0.5:1,", 'burn:o.burn?0.5:1,', 1, 'test-damage-formula.js'],
  ['M33', 'Damage: a critical hit stops ignoring screens',
    'screen:(o.screen&&!o.crit)?0.5:1', 'screen:o.screen?0.5:1', 1, 'test-damage-formula.js'],
  ['M34', "Damage: a crit clamps the wrong side of the defender's stage",
    'return{atk:aStage<1?1:aStage, def:dStage>1?1:dStage};',
    'return{atk:aStage<1?1:aStage, def:dStage<1?1:dStage};', 1, 'test-damage-formula.js'],
  ['M35', 'Damage: the KO verdict reports a guaranteed 2HKO from the HIGH roll',
    'if(mn*2>=hp)return\'Guaranteed 2HKO\';', 'if(mx*2>=hp)return\'Guaranteed 2HKO\';',
    1, 'test-damage-formula.js'],
  ['M36', 'Learnsets: a failed load is cached again, so Champions legality can never recover',
    '      _champLSLoading=null;   // let the next call try again instead of replaying the failure',
    '      /* cache the failure */', 1, 'test-champions-roster.js'],
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
