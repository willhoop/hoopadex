/* HoopaDex — Regulation M-C, and Champions' own move data
 * Run: node tests/test-champions-mc.js
 *
 * Regulation M-C started on 2026-09-10. Everything it changed was derived from Showdown, which carries
 * each Champions regulation as its own mod — `champions` is now M-C, `championsregmb` holds only what
 * M-B did differently — by build/generate-champions.js. See that file's header for the full story.
 *
 * What M-C changed, as derived:
 *
 *   roster    208 -> 231 species, 23 added, none removed; six new Megas
 *   items     148 -> 166, including Salamencite, Golisopite, Baxcalibrite and three Z-A stones
 *   moves     Strength Sap and Wish, 10 PP -> 5; Archaludon gains Slash, loses Metal Burst and Mirror Coat
 *
 * WHY THE DERIVATION IS TRUSTED: it reproduced the hand-typed M-B exactly before it was allowed to
 * write M-C — 208 of 208 species, 148 of 148 items. The generator re-checks that on every run and
 * refuses to write if it stops holding.
 *
 * THE LARGER FINDING. Champions changes 63 moves against Scarlet/Violet, not two, and the dex showed
 * the Scarlet/Violet value for all of them in Champions mode — including in the damage calculator.
 * Protect at 10 PP (it is 5). Snipe Shot at 80 power (85). Snap Trap as Grass (Steel). Dragon Claw
 * without the slicing flag, so a Sharpness attacker was calculated at 98 where Champions gives 146.
 * Those were wrong in M-A and M-B too; M-C is simply when they were found.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);
const REC = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'champions-regulations.json'), 'utf8'));
const EX = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'champions-learnsets.json'), 'utf8'));

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}
const lineOf = prefix => lines.find(l => l.startsWith(prefix));
const valueOf = name => { const l = lineOf('const ' + name + '='); return l ? eval('(' + l.slice(('const ' + name + '=').length).replace(/;\s*(\/\/.*)?$/, '') + ')') : undefined; };

// --- the generated data is what the generator produces ----------------------------------------------
/* Skipped under mutation testing, because the mutant is a temp copy the generator does not read. */
if (!process.env.HOOPADEX_SRC) {
  let out = '', ok = true;
  try { out = execFileSync(process.execPath, [path.join(ROOT, 'build', 'generate-champions.js'), '--check'], { encoding: 'utf8' }); }
  catch (e) { ok = false; out = String(e.stderr || e.message); }
  check(ok, 'the generated block, learnset export and record all still follow from the Showdown snapshot', out.trim());
}
check(REC.verification.rosterMB.identical && REC.verification.rosterMB.derived === 208,
  'the derivation reproduced the hand-typed M-B roster exactly (208 of 208) before writing M-C', JSON.stringify(REC.verification.rosterMB));
check(REC.verification.itemsMB.identical && REC.verification.itemsMB.derived === 148,
  'and the hand-typed M-B items exactly (148 of 148)', JSON.stringify(REC.verification.itemsMB));

// --- the registry --------------------------------------------------------------------------------------
const regStart = lines.findIndex(l => l.startsWith('const CHAMPIONS_IDS_MA='));
const regEnd = lines.findIndex((l, i) => i > regStart && l.startsWith('function regByKey('));
const R = eval(lines.slice(regStart, regEnd).join('\n') + '\n;({CHAMPIONS_REGS,LATEST_REG,CHAMPIONS_IDS_MA,CHAMPIONS_IDS_MB,CHAMPIONS_IDS_MC,REG_MC_NEW,CHAMPIONS_ITEMS_BY_REG,CHAMPIONS_MOVES_BY_REG})');
check(R.CHAMPIONS_REGS.map(r => r.key).join(',') === 'reg-mc,reg-mb,reg-ma', 'the regulations are M-C, M-B, M-A, newest first',
  R.CHAMPIONS_REGS.map(r => r.key).join(','));
check(R.LATEST_REG.key === 'reg-mc', 'so the app opens on M-C', R.LATEST_REG.key);
check(R.CHAMPIONS_IDS_MC.size === 231, 'M-C has 231 species', R.CHAMPIONS_IDS_MC.size);
check(R.REG_MC_NEW.length === 23, 'twenty-three of them new', R.REG_MC_NEW.length);
check([...R.CHAMPIONS_IDS_MB].every(n => R.CHAMPIONS_IDS_MC.has(n)), 'and nobody from M-B was removed');
[[815, 'Cinderace'], [812, 'Rillaboom'], [818, 'Inteleon'], [373, 'Salamence'], [998, 'Baxcalibur'], [768, 'Golisopod'], [865, "Sirfetch'd"]]
  .forEach(([n, nm]) => check(R.CHAMPIONS_IDS_MC.has(n) && !R.CHAMPIONS_IDS_MB.has(n), nm + ' is new in M-C'));
check(R.CHAMPIONS_IDS_MB.size === 208 && R.CHAMPIONS_IDS_MA.size === 186,
  'adding M-C did not touch M-B (208) or M-A (186)', R.CHAMPIONS_IDS_MB.size + '/' + R.CHAMPIONS_IDS_MA.size);

// --- items, per regulation ------------------------------------------------------------------------------
/* One set for all three regulations is what there used to be — a Serebii snapshot of M-B — so picking
   M-A showed M-B's 31 extra items as legal, and a single set now would put M-C's stones into M-B. */
const items = k => new Set(R.CHAMPIONS_ITEMS_BY_REG[k].split(','));
check(items('reg-mc').size === 166 && items('reg-mb').size === 148 && items('reg-ma').size === 117,
  'items are per regulation: 166 in M-C, 148 in M-B, 117 in M-A',
  items('reg-mc').size + '/' + items('reg-mb').size + '/' + items('reg-ma').size);
['salamencite', 'golisopite', 'baxcalibrite', 'absolitez', 'garchompitez', 'lucarionitez'].forEach(k =>
  check(items('reg-mc').has(k) && !items('reg-mb').has(k), k + ' is legal in M-C and not in M-B'));
check(items('reg-mb').has('lifeorb') && !items('reg-ma').has('lifeorb'),
  'and Life Orb is still M-B but not M-A — an older regulation keeps its own answer');
check(/function setChampReg\(r\)\{[\s\S]{0,400}CHAMPIONS_ITEMS=new Set\(CHAMPIONS_ITEMS_BY_REG\[r\.key\]/.test(src) &&
      /function setChampReg\(r\)\{[\s\S]{0,400}CHAMPIONS_MOVES=new Set\(CHAMPIONS_MOVES_BY_REG\[r\.key\]/.test(src),
  'changing regulation swaps the item and move sets along with the roster');
check(!/if\(isChampionsMode\)\{CHAMPIONS_IDS=regByShort/.test(src),
  'and no path changes the roster on its own any more — they all go through setChampReg');

// --- move values: Champions, not Scarlet/Violet ----------------------------------------------------------
const OV = valueOf('CHAMP_MOVE_OVERRIDES');
const gStart = lines.findIndex(l => l.startsWith('function movePastValues('));
const gEnd = lines.findIndex((l, i) => i > gStart && l.startsWith('const PASTABIL='));
const typeStart = lines.findIndex(l => l.startsWith('function getMoveTypeForGen('));
const typeEnd = lines.findIndex((l, i) => i > typeStart && l === '}');
let MODE = { champ: true, reg: 'reg-mc', gen: 9 };
const G = eval(lineOf('const VG_GEN=') + '\n' +
  'var CHAMP_MOVE_OVERRIDES=' + JSON.stringify(OV) + ';\n' +
  'function getDataGenNum(){return MODE.gen} function champRegKey(){return MODE.reg}\n' +
  'Object.defineProperty(globalThis,"isChampionsMode",{get(){return MODE.champ},configurable:true});\n' +
  lines.slice(gStart, gEnd).join('\n') + '\n' + lines.slice(typeStart, typeEnd + 1).join('\n') +
  '\n;({getMovePowerForGen,getMoveAccForGen,getMovePPForGen,getMoveTypeForGen,champMoveOverride})');
const mv = (name, extra) => Object.assign({ name, past: {}, pastTypes: {} }, extra || {});
const SV = { protect: { pp: 10 }, 'strength-sap': { pp: 10 }, wish: { pp: 10 }, 'snipe-shot': { power: 80 },
  'make-it-rain': { accuracy: 100 }, 'snap-trap': { type: 'grass' }, 'flamethrower': { power: 90, pp: 15 } };
const m = n => mv(n, SV[n]);

/* 5.51: PP is now the number the GAME shows. Champions defines Protect with 5 PP and converts it to
   (5 / 5 + 1) x 4 = 8 (Showdown's champions/scripts.ts; tests/test-champion-moves.js checks the rule against
   Serebii). These four assertions used to pin the defined value, which no player ever sees. */
check(G.getMovePPForGen(m('protect')) === 8, 'Protect has 8 PP in Champions (defined as 5; 10 in Scarlet/Violet)', G.getMovePPForGen(m('protect')));
check(G.getMovePowerForGen(m('snipe-shot')) === 85, 'Snipe Shot has 85 power', G.getMovePowerForGen(m('snipe-shot')));
check(G.getMoveAccForGen(m('make-it-rain')) === 95, 'Make It Rain is 95% accurate', G.getMoveAccForGen(m('make-it-rain')));
check(G.getMoveTypeForGen(m('snap-trap')) === 'steel', 'Snap Trap is Steel-type', G.getMoveTypeForGen(m('snap-trap')));
check(G.getMovePowerForGen(m('flamethrower')) === 90, 'a move Champions did not change is untouched', G.getMovePowerForGen(m('flamethrower')));

check(G.getMovePPForGen(m('strength-sap')) === 8 && G.getMovePPForGen(m('wish')) === 8,
  'M-C cut Strength Sap and Wish to 8 PP (defined 5)', G.getMovePPForGen(m('strength-sap')) + '/' + G.getMovePPForGen(m('wish')));
MODE.reg = 'reg-mb';
check(G.getMovePPForGen(m('strength-sap')) === 12 && G.getMovePPForGen(m('wish')) === 12,
  'and in M-B they are still 12 (defined 10)', G.getMovePPForGen(m('strength-sap')) + '/' + G.getMovePPForGen(m('wish')));
check(G.getMovePPForGen(m('protect')) === 8, 'while Protect is 8 in M-B too — that one is Champions-wide, not new');
MODE.reg = 'reg-mc';

/* Outside Champions nothing may change. These are the same getters the Gen III dex uses. */
MODE.champ = false;
check(G.getMovePPForGen(m('protect')) === 10 && G.getMoveTypeForGen(m('snap-trap')) === 'grass' &&
      G.getMovePowerForGen(m('snipe-shot')) === 80,
  'outside Champions every move is exactly Scarlet/Violet again',
  G.getMovePPForGen(m('protect')) + '/' + G.getMoveTypeForGen(m('snap-trap')) + '/' + G.getMovePowerForGen(m('snipe-shot')));
MODE.champ = true;
check(G.getMovePPForGen(m('protect'), 3) === 10,
  'and asking about another generation explicitly, from inside Champions, is not asking about Champions');

// --- the page reports what M-C changed, and only that --------------------------------------------------
const RMC = valueOf('REG_MOVE_CHANGES')['reg-mb->reg-mc'];
check(RMC.length === 2 && RMC.every(c => c.field === 'pp' && c.from === 10 && c.to === 5) &&
      RMC.map(c => c.move).sort().join() === 'Strength Sap,Wish',
  'the only move values M-C changed are Strength Sap and Wish, 10 PP to 5', JSON.stringify(RMC));
check(valueOf('REG_MOVE_CHANGES')['reg-ma->reg-mb'].length === 0, 'and M-B changed none');
check(/Strength Sap and Wish drop from 10 PP to 5|verb\+' from '\+c\.from\+u\+' to '/.test(src),
  'the Regulation Changes page has a sentence for move values, which it never had');

const decl = REC['reg-mc'].declaredLearnsetChanges;
check(decl.length === 1 && decl[0].species === 'Archaludon' && decl[0].gained.join() === 'slash' &&
      decl[0].lost.sort().join() === 'metalburst,mirrorcoat',
  'the only learnset change M-C declared: Archaludon gains Slash, loses Metal Burst and Mirror Coat', JSON.stringify(decl));
/* The two sources disagree on Slash and on Politoed's Pound. Neither is something M-C did, and the
   page must never say it is. */
const SRCDIFF = new Set(valueOf('REG_LEARNSET_SOURCE_DIFFS')['reg-mb->reg-mc']);
check(SRCDIFF.has('186|pound') && SRCDIFF.has('6|slash'),
  'the source disagreements are listed by the generator — Politoed\'s Pound, Charizard\'s Slash', [...SRCDIFF].slice(0, 5));
check(!SRCDIFF.has('1018|slash'), 'and Archaludon\'s declared Slash is NOT in that list — it is a real change');
check(/!srcDiff\.has\(k\)\)gained\.push/.test(src) && /!srcDiff\.has\(k\)\)lost\.push/.test(src),
  'and the page\'s move diff skips them on both sides');
const S = REC['reg-mc'].sourceDifferencesNotRuleChanges;
check(Object.keys(S.onlyInShowdown).join() === 'slash' && Object.keys(S.onlyInOldList).join() === 'pound',
  'the only source disagreements are Slash and Pound — anything new here needs looking at',
  Object.keys(S.onlyInShowdown).join() + ' / ' + Object.keys(S.onlyInOldList).join());

// --- the learnset export: what CHOMP checks legality against --------------------------------------------
const learns = (move, sid, reg) => !!(EX[move] && EX[move].learnedBy.some(e => e.sid === sid && e.legalIn.includes(reg)));
check(learns('metalburst', 'archaludon', 'reg-mb') && !learns('metalburst', 'archaludon', 'reg-mc'),
  'Archaludon has Metal Burst in M-B and not in M-C');
check(!learns('slash', 'archaludon', 'reg-mb') && learns('slash', 'archaludon', 'reg-mc'), 'and Slash the other way round');
check(learns('pyroball', 'cinderace', 'reg-mc') && learns('glaiverush', 'baxcalibur', 'reg-mc'),
  'the new species arrive with their signature moves');
check(learns('lightofruin', 'floette-eternal', 'reg-mc'),
  'Floette-Eternal keeps Light of Ruin — Showdown has no movepool for it, so M-B\'s is carried forward');
check(learns('acidspray', 'vileplume', 'reg-mb') && !learns('acidspray', 'vileplume', 'reg-ma'),
  'the M-A and M-B rows are untouched by adding M-C');
let unexplained = [];
for (const [move, rec] of Object.entries(EX)) for (const e of rec.learnedBy) {
  if (!e.legalIn.includes('reg-mb') || e.legalIn.includes('reg-mc')) continue;
  const key = e.num + '|' + move;
  const declaredLoss = e.sid === 'archaludon' && ['metalburst', 'mirrorcoat'].includes(move);
  if (!declaredLoss && !SRCDIFF.has(key)) unexplained.push(e.sid + ':' + move);
}
check(unexplained.length === 0,
  'every M-B learner is still an M-C learner, except the declared change and the named source differences',
  unexplained.slice(0, 8).join(', '));

// --- the calculator and the tags use Champions' moves too ------------------------------------------------
const cStart = lines.findIndex(l => l.startsWith('function champCalcOverrides('));
const cEnd = lines.findIndex((l, i) => i > cStart && l === '}');
const calcOv = eval('var isChampionsMode=true; var CHAMP_MOVE_OVERRIDES=' + JSON.stringify(OV) + ';' +
  'function champRegKey(){return "reg-mc"} function champFlat(n){return String(n).toLowerCase().replace(/[^a-z0-9]/g,"")}\n' +
  lines.slice(cStart, cEnd + 1).join('\n') + '\n;champCalcOverrides');
const fakeGen = { moves: { get: id => ({ dragonclaw: { flags: { contact: 1 } }, snipeshot: { flags: {} } })[id] } };
const dc = calcOv(fakeGen, 'Dragon Claw');
check(dc && dc.flags && dc.flags.slicing === 1, 'the calculator is told Dragon Claw slices in Champions — Sharpness applies',
  JSON.stringify(dc));
/* The engine's `overrides` REPLACES the flags object. Handing over only {slicing:1} would strip
   contact, and with it every Tough Claws boost and Rocky Helmet chip on the move. */
check(dc && dc.flags.contact === 1, 'and still makes contact — the flags are merged, not replaced', JSON.stringify(dc));
check((calcOv(fakeGen, 'Snipe Shot') || {}).basePower === 85, 'Snipe Shot reaches the calculator at 85 power');
check(calcOv(fakeGen, 'Flamethrower') === undefined, 'a move Champions did not change gets no override at all');
check(src.includes("new M.Move(gen,mvName,Object.assign({isCrit:document.getElementById('calc-crit').checked},champOv?{overrides:champOv}:{}))"),
  'and the calculator\'s Move is built with them');
check(src.includes('const probe=new M.Move(gen,mvName,champOv?{overrides:champOv}:{});'),
  'including the probe that decides physical or special, so Snap Trap is read as Steel before the calc runs');

const tStart = lines.findIndex(l => l.startsWith('function moveDescriptors(moveName){'));
const tEnd = lines.findIndex((l, i) => i > tStart && l === '}');
const desc = eval('var MOVE_TAG_NOTE={contact:1,slicing:1,punch:1,sound:1};' +
  'function moveDescriptorsBase(n){return ({dragonclaw:["contact"],doubleshock:["contact"],dragoncheer:[],howl:[]})[String(n).replace(/-/g,"")]||[]}' +
  'var isChampionsMode=true; var CHAMP_MOVE_OVERRIDES=' + JSON.stringify(OV) + '; function champRegKey(){return "reg-mc"}' +
  'function getDataGenNum(){return 9}\n' +
  lines.slice(lines.findIndex(l => l.startsWith('function champMoveOverride(')), lines.findIndex(l => l.startsWith('function champFor('))).join('\n') + '\n' +
  lines.slice(tStart, tEnd + 1).join('\n') + '\n;moveDescriptors');
check(desc('dragon-claw').join() === 'contact,slicing', 'Dragon Claw is tagged Slicing in Champions', desc('dragon-claw').join());
check(desc('double-shock').join() === 'contact,punch', 'Double Shock is tagged Punch — Iron Fist boosts it', desc('double-shock').join());
check(desc('dragon-cheer').join() === 'sound', 'Dragon Cheer is tagged Sound in Champions — Soundproof blocks it',
  desc('dragon-cheer').join());
/* Howl is in Champions' flag changes, but it was ALREADY a sound move; Champions only adds
   bypass-Substitute. An earlier draft of this release claimed Howl "becomes" sound, from reading the
   flag list as a change list. The override holds only differences from Scarlet/Violet, so a move that
   was already tagged is left exactly as it was. */
check(desc('howl').join() === '', 'Howl gains no tag it did not already have — its sound flag is not a Champions change',
  desc('howl').join());

// --- Speed Tiers and Bulk read six numbers, not seventy megabytes (5.49) -----------------------
/* Reported from the live site: "this takes forever to load the speed tiers". It fetched each
   Pokemon's full PokeAPI record — 100 to 360 KB — for 351 entries, to read base Speed. Measured cold:
   14 seconds. Now CHAMP_BASE_STATS carries the six numbers (12 KB) and a cold open drew all rows in
   37 ms with no downloads.

   Before the fetch was replaced, the table was checked against PokeAPI entry by entry in a browser,
   with every record loaded: 327 identical, 0 different. The other 24 did not resolve, and that is what
   exposed the illegal forms below. These pins are the parts of that check that can run offline. */
const BS = valueOf('CHAMP_BASE_STATS');
check(Object.keys(BS).length >= 340, 'CHAMP_BASE_STATS covers every legal Champions entry', Object.keys(BS).length);
[['garchomp', '108,130,95,80,85,102'], ['charizardmegay', '78,104,78,159,115,100'],
 ['floetteeternal', '74,65,67,125,128,92'], ['taurospaldeaaqua', '75,110,105,30,70,100'],
 ['meowsticmmega', '74,48,76,143,101,124']].forEach(([k, v]) =>
  check(BS[k] && BS[k].join() === v, k + ' has the base stats PokeAPI gives it', BS[k] && BS[k].join()));

const bsStart = lines.findIndex(l => l.startsWith('function rosterCounts('));
const bsEnd = lines.findIndex((l, i) => i > bsStart && l.startsWith('async function ensureRosterLoaded('));
let dcStub = {};
const RS = (0, eval)('var isChampionsMode=true; var CHAMP_BASE_STATS=' + JSON.stringify(BS) + ';' +
  'var CHAMPIONS_ILLEGAL_FORMS_BY_REG=' + JSON.stringify(valueOf('CHAMPIONS_ILLEGAL_FORMS_BY_REG')) + ';' +
  'function champRegKey(){return "reg-mc"} function getStatsForGen(d){return d.stats}' +
  'function baseSpeciesId(n){return ({"floette-eternal":670,"charizard-mega-y":6,"tauros-paldea-aqua-breed":128})[n]||0}\n' +
  lines.slice(bsStart, bsEnd).join('\n') +
  '\n;({champSdId,champBaseStats,rosterStatList,champFormIllegal,rosterCounts,setDc:function(o){dc=o}})'.replace('({', 'var dc={};({'));
const spd = p => { const l = RS.rosterStatList(p); return l ? l.find(x => x.stat.name === 'speed').base_stat : null; };
check(spd({ id: 445, name: 'garchomp' }) === 102, 'Garchomp reads 102 Speed without fetching anything');
check(spd({ id: 10252, name: 'tauros-paldea-aqua-breed' }) === 100,
  'a PokeAPI name Showdown spells differently still resolves — the Paldean Tauros are "breeds" in one and not the other');
check(spd({ id: 10314, name: 'meowstic-male-mega' }) === 124, 'and so does "meowstic-male-mega" against "meowsticmmega"');
check(spd({ id: 668, name: 'pyroar-male' }) === 106, 'a species PokeAPI names by its default form falls back to the species');
check(spd({ id: 10999, name: 'made-up-form' }) === null,
  'but a FORM that does not resolve is not guessed from its species — it falls back to fetching');
RS.setDc({ 445: { stats: [{ stat: { name: 'speed' }, base_stat: 999 }] } });
check(spd({ id: 445, name: 'garchomp' }) === 999,
  'a record the dex has already fetched wins, so the two sources can never sit side by side disagreeing');
RS.setDc({});
check(/ensureRosterLoaded\(renderSpeedTiers,roster\.filter\(function\(p\)\{return !rosterStatList\(p\)\}\)/.test(src),
  'Speed Tiers only fetches what the table cannot place');
check(/ensureRosterLoaded\(renderBulk,roster\.filter\(function\(m\)\{return !rosterStatList\(m\)\}\)/.test(src),
  'and so does Bulk');

// --- forms of a legal species that are not legal (5.49) ------------------------------------------
/* Found by the stat check above: twenty entries Speed Tiers, Bulk and the damage calculator offered
   in M-C are forms Showdown rules illegal. The roster names species, so every form of a legal
   species used to pass. Only explicit rulings are blocked; an unmentioned form is left alone. */
[['floette', true, 'base Floette (only Floette-Eternal is legal)'], ['floette-eternal', false, 'Floette-Eternal'],
 ['pikachu-world-cap', true, "Pikachu in a cap"], ['pikachu-rock-star', true, 'Cosplay Pikachu'], ['pikachu', false, 'Pikachu'],
 ['greninja-battle-bond', true, 'Battle Bond Greninja'], ['farfetchd-galar', true, "Galarian Farfetch'd"], ['farfetchd', false, "Farfetch'd"],
 ['mr-mime-galar', true, 'Galarian Mr. Mime'], ['qwilfish-hisui', true, 'Hisuian Qwilfish'],
 ['tauros-paldea-aqua-breed', false, 'Paldean Tauros (Aqua)'], ['charizard-mega-y', false, 'Mega Charizard Y'],
 ['venusaur-gmax', true, 'Gigantamax Venusaur']]
  .forEach(([n, illegal, label]) => check(RS.champFormIllegal(n) === illegal, label + (illegal ? ' is ruled out' : ' is still allowed')));
check(/if\(isChampionsMode&&typeof champFormIllegal==='function'&&champFormIllegal\(name\)\)return false;/.test(src),
  'formAllowed applies it — the one gate the calculator, speed tiers, bulk, team search and ability pages share');
/* With base Floette gone, counting base entries gave "230 Pokemon" beside a Regulation Changes page
   saying 231. Floette is legal as Floette-Eternal, so it is a species with only a form entry. */
const cnt = RS.rosterCounts([{ id: 445, name: 'garchomp' }, { id: 10061, name: 'floette-eternal' }, { id: 10034, name: 'charizard-mega-y' }, { id: 6, name: 'charizard' }]);
check(cnt.species === 3 && cnt.extra === 1,
  'a species present only as a form still counts as a species — Garchomp, Floette, Charizard is three', JSON.stringify(cnt));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
