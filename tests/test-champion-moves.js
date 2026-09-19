/* HoopaDex — a move's PP and power in every generation and game, and what it does in Champions
 * Run: node tests/test-champion-moves.js
 *
 * Asked from the live site: "champions did lower the pp of a lot of moves so lets make sure each game
 * and generation has its correct pp. champions also changed effects like make it rains accuracy and
 * lowers sp attack by 2 stages instead of one".
 *
 * Three findings, each checked here:
 *   1. Champions converts every move's PP: capped at 20, then (PP / 5 + 1) x 4 (Showdown's
 *      champions/scripts.ts). The app showed the unconverted number, so Protect read 5 where the game
 *      shows 8. The rule is checked against every PP on Serebii's Champions "Updated Attacks" page.
 *   2. PokeAPI's PP and power were wrong for 18 moves in some generation or game; Showdown's value now
 *      wins (build/generate-move-values.js), and Let's Go keeps its own four.
 *   3. Thirteen moves behave differently in Champions and showed Scarlet/Violet's description.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const MOV = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'moves-index.json'), 'utf8')).moves;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('not found: ' + a); return src.slice(i, j); };
const fn = n => cut('function ' + n + '(', '\n}\n') + '\n}\n';
const line = start => { const l = src.split(/\r?\n/).find(x => x.startsWith(start)); if (!l) throw new Error('no line ' + start); return l + '\n'; };

// --- the app's real functions, with the few globals they read supplied here ----------------------
const env = { champ: false, gen: 9, specific: false, dataGen: '', reg: 'reg-mc' };
const code =
  'var isChampionsMode, specificGame, dataGen;\n' +
  'function getDataGenNum(){return ENV.gen}\nfunction champRegKey(){return ENV.reg}\n' +
  line('const VG_GEN=') + line('const CHAMP_MOVE_OVERRIDES=') +
  cut('/*BEGIN-MOVE-VALUES-DERIVED*/', '/*END-MOVE-VALUES-DERIVED*/') + '\n' +
  cut('function movePastValues(', '\nfunction makeMoveRecord(') + '\n' +
  fn('makeMoveRecord') + fn('expandMoveRow') + fn('pastValueForGen') + fn('movePastField') +
  fn('champMoveOverride') + cut('const CHAMP_MOVE_TEXT={', '\n/* Only for the generation') + '\n' +
  fn('champFor') + fn('moveValueFix') + fn('champInGamePP') + fn('getMovePowerForGen') + fn('getMovePPForGen') +
  ';({sync(){isChampionsMode=ENV.champ;specificGame=ENV.specific;dataGen=ENV.dataGen},makeMoveRecord,expandMoveRow,getMovePPForGen,getMovePowerForGen,champMoveDesc,champInGamePP,CHAMP_MOVE_TEXT,CHAMP_MOVE_TEXT_EXTRA,CHAMP_MOVE_OVERRIDES,CHAMP_PP})';
globalThis.ENV = env;   // the sliced code runs in global scope, so its settings live there
const A = (0, eval)(code);
const rec = slug => { const r = MOV.find(x => x[0] === slug); if (!r) throw new Error('no move ' + slug); return A.makeMoveRecord(A.expandMoveRow(r)); };
function at(o) { Object.assign(env, { champ: false, gen: 9, specific: false, dataGen: '', reg: 'reg-mc' }, o); A.sync(); }
const pp = (slug, o) => { at(o); return A.getMovePPForGen(rec(slug)); };
const power = (slug, o) => { at(o); return A.getMovePowerForGen(rec(slug)); };

// --- 1. Champions PP -------------------------------------------------------------------------------
/* Every PP on Serebii's "Updated Attacks" page for Champions (checked 2026-09-19). */
const SEREBII = { 'crabhammer': 12, 'slash': 20, 'bone-rush': 12, 'iron-head': 16, 'night-daze': 12, 'moonblast': 16,
  'first-impression': 12, 'spirit-shackle': 12, 'fire-lash': 16, 'trop-kick': 16, 'beak-blast': 8, 'snipe-shot': 16,
  'snap-trap': 16, 'apple-acid': 12, 'grav-apple': 12, 'meteor-assault': 8, 'dire-claw': 16, 'psyshield-bash': 12,
  'mountain-gale': 12, 'infernal-parade': 16, 'make-it-rain': 8, 'double-shock': 8, 'syrup-bomb': 12 };
const wrong = Object.keys(SEREBII).filter(m => pp(m, { champ: true }) !== SEREBII[m]);
check(wrong.length === 0, 'Champions PP matches all 23 on Serebii\'s list', wrong.map(m => m + ' ' + pp(m, { champ: true }) + ' vs ' + SEREBII[m]).join('; '));
check(pp('protect', { champ: true }) === 8, 'Protect has 8 PP in Champions, not the 5 it is defined with');
check(pp('wish', { champ: true, reg: 'reg-mc' }) === 8 && pp('wish', { champ: true, reg: 'reg-mb' }) === 12,
  'Wish: 12 PP in M-B, 8 in M-C - the M-C change, as the player sees it');
check(pp('hydro-pump', { champ: true }) === 8 && pp('tackle', { champ: true }) === 20 && pp('swords-dance', { champ: true }) === 20,
  'Hydro Pump 5 -> 8; Tackle 35 and Swords Dance 20 cap at 20');
check(A.CHAMP_PP.noBoosts.includes('sketch') && pp('sketch', { champ: true }) === 1, 'Sketch keeps its 1 PP: Showdown marks it as never boosted');
check(pp('protect', { champ: false, gen: 9 }) === 10 && pp('protect', { champ: true, gen: 9 }) === 8, 'and the conversion is Champions only');

// --- 2. every generation, and the one game that differs from its generation ------------------------
check(pp('recover', { gen: 3 }) === 20 && pp('recover', { gen: 4 }) === 10 && pp('recover', { gen: 8 }) === 10 && pp('recover', { gen: 9 }) === 5,
  'Recover: 20 PP in Gens I-III, 10 in IV-VIII, 5 in Scarlet/Violet (Bulbapedia) - it said 5 everywhere since Gen IV');
['soft-boiled', 'rest', 'milk-drink', 'slack-off', 'roost', 'shore-up'].forEach(m =>
  check(pp(m, { gen: 8 }) === 10 && pp(m, { gen: 9 }) === 5, m + ': 10 PP until Scarlet/Violet cut it to 5'));
check(pp('mind-reader', { gen: 3 }) === 5, 'Mind Reader has always had 5 PP; PokeAPI said 40 in Gens II-IV');
check(pp('take-heart', { gen: 9 }) === 15, 'Take Heart has 15 PP; 10 is its Legends: Arceus value');
check(power('luster-purge', { gen: 8 }) === 70 && power('luster-purge', { gen: 9 }) === 95, 'Luster Purge was 70 power until Scarlet/Violet');
check(power('glacial-lance', { gen: 8 }) === 130 && power('wicked-blow', { gen: 8 }) === 80 && power('grassy-glide', { gen: 8 }) === 70,
  'Sword/Shield\'s Glacial Lance 130, Wicked Blow 80, Grassy Glide 70 - not their Scarlet/Violet nerfs');
/* Let's Go: its values are right for Let's Go and wrong for every other Generation VII game. */
const LG = 'lets-go-pikachu-lets-go-eevee';
check(power('solar-beam', { gen: 7 }) === 120 && power('solar-beam', { gen: 7, specific: true, dataGen: 'ultra-sun-ultra-moon' }) === 120,
  'Solar Beam is 120 in Sun/Moon and Ultra Sun/Ultra Moon');
check(power('solar-beam', { gen: 7, specific: true, dataGen: LG }) === 200, 'and 200 in Let\'s Go (Bulbapedia)');
check(pp('absorb', { gen: 7 }) === 25 && power('absorb', { gen: 7 }) === 20 && pp('absorb', { gen: 7, specific: true, dataGen: LG }) === 15 && power('absorb', { gen: 7, specific: true, dataGen: LG }) === 40,
  'Absorb: 20 power / 25 PP in Gen VII, 40 / 15 in Let\'s Go');
check(power('sky-attack', { gen: 7 }) === 140 && power('mega-drain', { gen: 7, specific: true, dataGen: LG }) === 75, 'Sky Attack 140, and Let\'s Go\'s Mega Drain 75');
check(power('solar-beam', { gen: 8, specific: true, dataGen: LG }) === 120, 'a game\'s value never leaks into another generation');
check(pp('tackle', { gen: 1 }) === 35 && power('tackle', { gen: 1 }) === 35 && power('tackle', { gen: 9 }) === 40,
  'moves PokeAPI already had right are untouched (Tackle 35 power in Gen I, 40 now)');

// --- 3. what Champions changed about what a move does ----------------------------------------------
const flagged = new Set();
Object.values(A.CHAMP_MOVE_OVERRIDES).forEach(reg => Object.keys(reg).forEach(id => { if (reg[id].behaviour) flagged.add(id); }));
const texted = new Set(Object.keys(A.CHAMP_MOVE_TEXT));
check([...flagged].every(id => texted.has(id)), 'every move Champions changes the behaviour of has a Champions description',
  [...flagged].filter(id => !texted.has(id)).join(', '));
check([...texted].every(id => flagged.has(id)), 'and nothing has one that Champions did not change', [...texted].filter(id => !flagged.has(id)).join(', '));
at({ champ: true });
check(/Sp\. Atk by 2/.test(A.champMoveDesc('make-it-rain')), 'Make It Rain lowers the user\'s Sp. Atk by 2 in Champions');
check(A.getMovePowerForGen(rec('make-it-rain')) === 120 && A.CHAMP_MOVE_OVERRIDES['reg-mc'].makeitrain.acc === 95, 'with 95% accuracy');
check(/20%/.test(A.champMoveDesc('iron-head')) && /10%/.test(A.champMoveDesc('moonblast')) && /30%/.test(A.champMoveDesc('dire-claw')),
  'Iron Head 20% flinch, Moonblast 10%, Dire Claw 30% (Serebii agrees on all three)');
check(/Speed by 2/.test(A.champMoveDesc('toxic-thread')) && /1\/16/.test(A.champMoveDesc('salt-cure')) && /ally/.test(A.champMoveDesc('milk-drink')),
  'Toxic Thread -2 Speed, Salt Cure 1/16, Milk Drink can heal an ally');
check(/resets when the user switches out/.test(A.champMoveDesc('rage-fist')), 'Rage Fist\'s count resets on switching out (in Showdown\'s battle code, not its move entry)');
at({ champ: false });
check(A.champMoveDesc('make-it-rain') === null, 'outside Champions the Scarlet/Violet description stands');

/* Every place a move's description is shown asks for the Champions one first. */
check(/champMoveDesc\(m\)\|\|genFlavorText\(m\.flavorEntries/.test(src), 'the hover tooltip');
check(/const desc=champMoveDesc\(md\)\|\|md\?\.desc/.test(src) && /const missedDesc=champMoveDesc\(md\)\|\|md\?\.desc/.test(src), 'a Pokemon\'s move list');
check(/\(champMoveDesc\(md\)\|\|md\.desc\)/.test(src), 'the Moves tab');
check(/const ch=champMoveDesc\(slugName\);/.test(src) && /Changed in Champions<span class="mt-gen">/.test(src), 'and the move page, beside the Scarlet/Violet rule it replaces');
check(/const shown=function\(v\)\{return c\.field==='pp'\?champInGamePP\(c\.move,v\):v\};/.test(src),
  'the Regulation Changes page states PP as the game shows it');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
