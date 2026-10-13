/* HoopaDex — ROM hacks: each hack's own species data, and the app using it
 * Run: node tests/test-romhacks.js
 *
 * Asked for from the live site: "add emerald kaizo and platinum kaizo. omega fire red, sacred gold,
 * renegade platinum (the drayano games) run and bun", in "its own romhack section", with a toggle for
 * patches "that do things like add fairy type". Then: "platinum kaizo should have way different stats
 * than base platinum" - which it does, and which a bad export had hidden (see below).
 *
 * The data is written by build/generate-romhacks.js. Expected values here are taken by hand from the
 * hack authors' own documents, not from the generated files, so this suite checks the generator rather
 * than repeating it. Sources: Drayano's Renegade Platinum "Pokémon Changes" (v1.3.0); Drayano's Sacred
 * Gold "Pokemon Changes" (v1.05); the Platinum Kaizo Mastersheet; dekzeh's runandbundex base_stats.h;
 * Isotarge/emerald-kaizo-db.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const HD = path.join(ROOT, 'app', 'hacks');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}
const load = k => JSON.parse(fs.readFileSync(path.join(HD, k + '.json'), 'utf8'));
const sp = (k, id) => load(k).species[id];

// --- the registry and its files -----------------------------------------------------------------------
const HACKS = (0, eval)('(' + src.match(/const ROM_HACKS=(\[[\s\S]*?\n\]);/)[1] + ')');
check(HACKS.map(h => h.key).sort().join() === 'emerald-kaizo,firered-omega,platinum-kaizo,renegade-platinum,run-and-bun,sacred-gold',
  'the six requested hacks are in the ROM Hacks section', HACKS.map(h => h.key));
const files = [];
HACKS.forEach(h => (h.variants || [{ key: '' }]).forEach(v => [false, true].forEach(f => {
  if (f && h.fairy !== 'patch') return;
  files.push(h.key + (v.key ? '-' + v.key : '') + (f ? '-fairy' : ''));
})));
check(files.every(f => fs.existsSync(path.join(HD, f + '.json'))), 'every hack, variant and patch has its data file', files.filter(f => !fs.existsSync(path.join(HD, f + '.json'))));
check(HACKS.every(h => /^https:\/\//.test(h.calc.url)), 'every hack links to an established damage calculator');
check(HACKS.find(h => h.key === 'sacred-gold').calc.fairyUrl.includes('fairy=1'), 'and Sacred Gold\'s Fairy patch opens the calculator\'s Fairy version');

/* Nothing the second source disagrees with is left unexplained. */
files.forEach(f => (load(f).crossCheck || []).forEach(c => check(c.types.length === 0 && c.stats.length === 0,
  f + ': no unexplained disagreement with ' + c.against + ' (' + c.compared + ' compared)', JSON.stringify({ types: c.types, stats: c.stats }))));

// --- Renegade Platinum: Complete and Classic --------------------------------------------------------
/* Doc, 038 - Ninetales: Ability New "Drought / Flash Fire" (both versions); Base Stats (Complete)
   New 73/67/75/81/100/109; Type (Complete) New "Fire / Fairy". Classic keeps USUM's 73/76/75/81/100/100. */
check(JSON.stringify(sp('renegade-platinum', 38)) === JSON.stringify([['fire', 'fairy'], [73, 67, 75, 81, 100, 109], ['drought', 'flash-fire', '']]),
  'Ninetales, Complete: Fire/Fairy, 73/67/75/81/100/109, Drought/Flash Fire', JSON.stringify(sp('renegade-platinum', 38)));
check(JSON.stringify(sp('renegade-platinum-classic', 38)) === JSON.stringify([['fire'], [73, 76, 75, 81, 100, 100], ['drought', 'flash-fire', '']]),
  'Ninetales, Classic: Fire, Ultra Sun/Ultra Moon stats, the same abilities', JSON.stringify(sp('renegade-platinum-classic', 38)));
/* Doc, 155 - Cyndaquil: "Ability (Complete)" New Adaptability / Blaze, "Ability:" New Flash Fire / Blaze.
   Each version takes its own - the bug the first parse had was applying both, so Complete got Classic's. */
check(sp('renegade-platinum', 155)[2].join() === 'adaptability,blaze,' && sp('renegade-platinum-classic', 155)[2].join() === 'flash-fire,blaze,',
  'Cyndaquil: Adaptability in Complete, Flash Fire in Classic - each version takes its own entry');
/* Doc, 313 - Volbeat: the new stat line is mislabelled "Old"; it is still the new value. */
check(sp('renegade-platinum', 313)[1].join() === '65,33,75,107,85,100', 'Volbeat takes its new stats even though the doc labels them "Old"');
check(load('renegade-platinum').notes.some(n => /^313 doc erratum/.test(n)), 'and the erratum is recorded');
check(Object.values(load('renegade-platinum').species).filter(r => r[0].includes('fairy')).length === 32,
  'Complete has 32 Fairy-type Pokémon: the 20 official ones and 12 of Drayano\'s');
check(Object.values(load('renegade-platinum-classic').species).filter(r => r[0].includes('fairy')).length === 20,
  'Classic keeps the Fairy type itself but only the 20 official Fairy Pokémon');
check(Object.values(load('renegade-platinum').species).every(r => r[2][2] === ''), 'no hidden abilities: Platinum\'s engine has none');

// --- Sacred Gold / Storm Silver ----------------------------------------------------------------------
/* Doc, #049 Venomoth: Type Change Bug / Poison >> Bug / Psychic; Ability Poison Heal {1}; Special Attack (115). */
const veno = sp('sacred-gold', 49);
check(veno[0].join() === 'bug,psychic' && veno[1][3] === 115 && veno[2][0] === 'poison-heal', 'Venomoth: Bug/Psychic, 115 Sp. Atk, Poison Heal in slot 1');
check(sp('sacred-gold-classic', 49)[0].join() === 'bug,poison', 'Classic removes the Pokémon edits: Venomoth is Bug/Poison again');
/* Doc, #327 Spinda: lists five stats at 80 with Total (480), so HP is 80 too - the calculator data agrees. */
check(sp('sacred-gold', 327)[1].join() === '80,80,80,80,80,80', 'Spinda is 80 across the board: the doc\'s own total settles the stat it left out');
check(sp('sacred-gold-fairy', 35)[0].join() === 'fairy' && sp('sacred-gold', 35)[0].join() === 'normal', 'the Fairy patch makes Clefairy Fairy; the base hack does not');
check(sp('sacred-gold-fairy', 282)[0].join() === 'psychic,fairy', 'and Gardevoir Psychic/Fairy');
check(load('sacred-gold-fairy').fairyPatch.length === 20, 'the patch retypes the 20 official Fairy Pokémon of Generations I-IV');
check(JSON.stringify(load('sacred-gold').abilityNotes[362]) === '["levitate"]', 'Glalie\'s added Levitate is kept as a note, not placed in a slot the doc does not name');

// --- Platinum Kaizo ----------------------------------------------------------------------------------
/* Mastersheet, Personal: GARDEVOIR 68,65,65,"135 (+10)",115,80 ... Magic Guard, Trace. */
check(JSON.stringify(sp('platinum-kaizo', 282)) === JSON.stringify([['psychic'], [68, 65, 65, 135, 115, 80], ['magic-guard', 'trace', '']]),
  'Gardevoir: 135 Sp. Atk (+10), Magic Guard / Trace', JSON.stringify(sp('platinum-kaizo', 282)));
check(sp('platinum-kaizo', 132)[1].join() === '100,100,100,100,100,100', 'Ditto is 100 in every stat (48 in Platinum)');
/* The first build read the sheet through Google's gviz export, which blanks cells that do not match
   their column's format - every "92 (+10)". 208 species lost their changed stats. */
const pk = load('platinum-kaizo');
check(pk.statDeltasChecked >= 400 && pk.statDeltasDisagreeing === 0,
  'every "(+n)" in the sheet implies exactly Platinum\'s original stat (' + pk.statDeltasChecked + ' checked)');
check(/\/export\?format=csv'/.test(fs.readFileSync(path.join(ROOT, 'build', 'generate-romhacks.js'), 'utf8')),
  'the sheet is read through the plain CSV export, not gviz');
const vanilla = load('sacred-gold-classic').species;   // Generation IV as it shipped
const pkChanged = Object.keys(pk.species).filter(id => pk.species[id][1].join() !== vanilla[id][1].join()).length;
check(pkChanged >= 200, 'Platinum Kaizo changes the stats of ' + pkChanged + ' Pokémon from Platinum\'s', pkChanged);

// --- Run & Bun, Emerald Kaizo, FireRed Omega ---------------------------------------------------------
check(Object.keys(load('run-and-bun').species).length === 903, 'Run & Bun: 903 species, Generations I-VIII');
check(sp('run-and-bun', 282)[0].join() === 'psychic,fairy' && sp('run-and-bun', 282)[2].join() === 'synchronize,trace,telepathy',
  'Run & Bun Gardevoir: Psychic/Fairy with a hidden ability - Gen VIII rules');
/* runandbundex base_stats.h, [SPECIES_MARILL]: HP 70, Attack 35, Defense 50, Speed 40, Sp. Atk 35,
   Sp. Def 50 (official Attack and Sp. Atk: 20). In HoopaDex order, HP/Atk/Def/SpA/SpD/Spe. */
check(sp('run-and-bun', 183)[1].join() === '70,35,50,35,50,40',
  'Run & Bun Marill: the author\'s 35 Attack and 35 Sp. Atk, not the official 20', sp('run-and-bun', 183)[1].join());
check(sp('emerald-kaizo', 282)[1].join() === '70,65,75,125,115,90' && sp('emerald-kaizo', 282)[0].join() === 'psychic',
  'Emerald Kaizo Gardevoir: 70/65/75/125/115/90, Psychic (no Fairy in Generation III)');
check(Object.keys(load('emerald-kaizo').species).length === 386 && Object.keys(load('firered-omega').species).length === 386, 'Emerald Kaizo and FireRed Omega: all 386');

// --- the app ----------------------------------------------------------------------------------------
check(/<option value="romhacks">ROM Hacks<\/option>/.test(src), 'ROM Hacks is its own section in the game picker');
check(/const hr=typeof hackRec==='function'\?hackRec\(id\):null;\s*if\(hr&&genNum===getDataGenNum\(\)\)return hr\[0\]\.slice\(\);/.test(src),
  'a hack\'s types replace the base game\'s wherever types are read');
check(/const hr=typeof hackRec==='function'&&pokemon\?hackRec\(pokemon\.id\):null;\s*if\(hr\)return/.test(src),
  'and its stats wherever stats are read');
check(/if\(typeof isRomHack!=='undefined'&&isRomHack&&genNum===getDataGenNum\(\)&&romHackHasFairy\(\)\)genNum=6;/.test(src),
  'a hack with the Fairy type uses the Generation VI type chart');
check(/if\(isRomHack&&HACK\)f=f\.filter\(p=>!!HACK\.species\[p\.id\]\);/.test(src), 'the Pokédex lists the hack\'s species and no others');
const rel = src.slice(src.indexOf('const TAB_RELEVANCE='), src.indexOf('function isTabRelevant('));
['team', 'other'].forEach(t =>
  check(new RegExp(t + ':\\{[^}]*hack:false').test(rel), 'the ' + t + ' tab is held back in hack mode until its data is loaded'));
/* 5.56: Moves, Abilities and Items have each hack's own data (tests/test-romhack-data.js); 5.58:
   Locations has its wild encounters (tests/test-romhack-encounters.js). */
['tms', 'items', 'abilities', 'locations'].forEach(t =>
  check(!new RegExp(t + ':\\{[^}]*hack:false').test(rel), 'the ' + t + ' tab is shown in hack mode, with the hack\'s own data'));
/* The table saying hack:false is not enough; the rule has to be applied. Mutation M177 removed the line
   that applies it and the table checks above stayed green - so the real function is run here. */
const tabFn = (0, eval)('var isChampionsMode=false,selectedGenNum=4,isRomHack=false;' + rel +
  src.slice(src.indexOf('function isTabRelevant('), src.indexOf('function applyTabVisibility(')) +
  ';({set(h){isRomHack=h},isTabRelevant})');
tabFn.set(true);
check(tabFn.isTabRelevant('tms') && tabFn.isTabRelevant('locations') && !tabFn.isTabRelevant('team') && tabFn.isTabRelevant('pokedex') && tabFn.isTabRelevant('types'),
  'in hack mode Team Builder is hidden; the Pokédex, Moves, Locations and Type Chart are not');
tabFn.set(false);
check(tabFn.isTabRelevant('tms') && tabFn.isTabRelevant('locations'), 'and outside hack mode they come back');
check(/if\(isRomHack\)\{document\.getElementById\('calc-tab'\)\.innerHTML=hackCalcPanel\(\);return\}/.test(src), 'the Dmg Calc tab links to the hack\'s calculator');
check(/Where to find it in '\+romHack\(\)\.label/.test(src), 'a species page shows where to find it in the hack, in place of the base game\'s encounters');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
