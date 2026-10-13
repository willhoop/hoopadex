/* HoopaDex — ROM hacks, phase 2: each hack's own moves, learnsets, evolutions and items
 * Run: node tests/test-romhack-data.js
 *
 * Asked for from the live site: "other rom hacks might have different stats/abilities/moves etc than
 * base game", "we need learn sets and evolution", "we need the other tabs like items, moves, abilities",
 * and "some moves get really changed or invented, like accelerock as rock type quick attack in
 * platinum kaizo".
 *
 * The data is written by build/generate-romhack-data.js. Every expected value below was read by hand
 * from the hack author's own document, named on the line above it - not from the generated files - so
 * this suite checks the generator rather than repeating it.
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
const load = k => JSON.parse(fs.readFileSync(path.join(HD, k + '.data.json'), 'utf8'));
const lv = (d, id) => { const a = d.learn[id][0], o = []; for (let i = 0; i < a.length; i += 2) o.push(a[i] + ' ' + a[i + 1]); return o; };
const evo = (d, from, to) => ((d.evo[from] || []).find(e => e[0] === to) || [0, []])[1];

// --- every hack, variant and patch has its file, and the file holds together ---------------------------
const HACKS = (0, eval)('(' + src.match(/const ROM_HACKS=(\[[\s\S]*?\n\]);/)[1] + ')');
const files = [];
HACKS.forEach(h => (h.variants || [{ key: '' }]).forEach(v => [false, true].forEach(f => {
  if (f && h.fairy !== 'patch') return;
  files.push(h.key + (v.key ? '-' + v.key : '') + (f ? '-fairy' : ''));
})));
check(files.every(f => fs.existsSync(path.join(HD, f + '.data.json'))), 'every hack, variant and patch has a moves/learnsets/evolutions file (' + files.length + ')',
  files.filter(f => !fs.existsSync(path.join(HD, f + '.data.json'))));
check(HACKS.every(h => h.baseLabel), 'every hack names the base game its changes are measured against');
files.forEach(f => {
  const d = load(f);
  const known = new Set(Object.keys(d.moves));
  const bad = [];
  Object.keys(d.learn).forEach(id => { const [l, t] = d.learn[id]; for (let i = 1; i < l.length; i += 2) if (!known.has(l[i])) bad.push(id + ' ' + l[i]); t.forEach(m => { if (!known.has(m)) bad.push(id + ' ' + m); }); });
  check(bad.length === 0, f + ': every learnable move is in the hack\'s own move table', bad.slice(0, 5));
});

// --- Renegade Platinum (Drayano, v1.3.0) ------------------------------------------------------------------
const rp = load('renegade-platinum');
/* Pokémon Changes, 001 - Bulbasaur, "Level Up:" - the whole list. */
check(lv(rp, 1).join() === ['1 tackle', '1 growl', '5 vine-whip', '8 leech-seed', '11 razor-leaf', '14 poison-powder', '14 sleep-powder', '17 sludge', '20 take-down',
  '23 sweet-scent', '26 sludge-bomb', '29 growth', '32 worry-seed', '35 double-edge', '38 synthesis', '41 seed-bomb', '44 leaf-storm'].join(),
  'Renegade Platinum Bulbasaur learns exactly the 17 moves Drayano lists', lv(rp, 1).join());
/* 060 - Poliwag's heading is "Level Up" with no colon; it still has a learnset, ending 39 - Hydro Pump. */
check(lv(rp, 60).slice(-1)[0] === '39 hydro-pump', 'Poliwag\'s learnset is read although its heading has no colon', lv(rp, 60).slice(-1)[0]);
/* Move Changes, "Cut": Power 50 >> 60, Accuracy 95% >> 100%, PP 30 >> 25, Type Normal >> Grass. */
check(JSON.stringify(rp.moves.cut.slice(0, 5)) === '["grass","physical",60,100,25]', 'Cut is a 60-power, 100% Grass move with 25 PP', JSON.stringify(rp.moves.cut));
/* "Rock Climb": Power 90 >> 80, Accuracy 85% >> 95%, PP 20 >> 10, Type Normal >> Rock. */
check(JSON.stringify(rp.moves['rock-climb'].slice(0, 5)) === '["rock","physical",80,95,10]', 'Rock Climb is Rock, 80 power, 95%, 10 PP');
/* Move Replacements: Barrage -> Draining Kiss ("Old Move ... now unavailable"); Draining Kiss Power 50 >> 75. */
check(!rp.moves.barrage && rp.moves['draining-kiss'] && rp.moves['draining-kiss'][2] === 75, 'Barrage is gone; Draining Kiss replaces it at 75 power');
/* Item Changes, Modified TMs: TM55: Brine >> Scald. */
check(JSON.stringify(rp.machines.find(m => m[0] === 'TM55')) === '["TM55","scald"]', 'TM55 teaches Scald');
check(JSON.stringify(rp.items.tmChanges.find(c => c[0] === 'TM55')) === '["TM55","brine","scald"]', 'and the Items tab lists it as changed from Brine');
/* Evolution Changes: "Ponyta: Now evolves into Rapidash at Level 35." */
check(JSON.stringify(evo(rp, 77, 78)) === '["Lv 35"]', 'Ponyta evolves at 35', JSON.stringify(evo(rp, 77, 78)));
/* "Kadabra: Now able to evolve into Alakazam at Level 36." - able to: the trade still works. */
check(evo(rp, 64, 65).includes('Lv 36') && evo(rp, 64, 65).includes('Trade'), 'Kadabra can evolve at 36, and still by trade', JSON.stringify(evo(rp, 64, 65)));
/* "Eevee: Now only evolves into Espeon with the Sun Stone." */
check(JSON.stringify(evo(rp, 133, 196)) === '["Sun Stone"]', 'Eevee evolves into Espeon only with a Sun Stone');
/* "Budew: Now evolves into Roselia when happy regardless of the time." */
check(JSON.stringify(evo(rp, 406, 315)) === '["Happiness"]', 'Budew evolves by happiness at any time');
/* Replaced Items: Contest Pass -> Ice Stone. */
const rpRep = rp.items.sections.find(s => s.title === 'Replaced items');
check(rpRep && rpRep.rows.some(r => r[0] === 'Contest Pass' && r[1] === 'Ice Stone'), 'the Items tab has Drayano\'s replaced items: Contest Pass became the Ice Stone');
/* Ninetales: Platinum's Fire, Flash Fire; Renegade Platinum's Fire/Fairy, Drought / Flash Fire. */
check(rp.base[38] && rp.base[38][0].join() === 'fire', 'a changed species records what it was in Platinum (Ninetales: Fire)');

// --- Sacred Gold / Storm Silver (Drayano, v1.05) ---------------------------------------------------------
const sg = load('sacred-gold'), sgc = load('sacred-gold-classic'), sgf = load('sacred-gold-fairy');
/* Pokemon Changes, #004 Charmander: "+ Level Up Moves: Metal Claw (13)". */
check(lv(sg, 4).includes('13 metal-claw') && !lv(sgc, 4).includes('13 metal-claw'), 'Charmander learns Metal Claw at 13 in Complete, not in Classic');
/* "Cut is a 60-power Grass move. Strength is a 60-power Rock move." - in every version. */
check(sg.moves.cut[0] === 'grass' && sg.moves.cut[2] === 60 && sgc.moves.strength[0] === 'rock' && sgc.moves.strength[2] === 60, 'Cut is 60 Grass and Strength 60 Rock, Classic included');
/* Forum post: the Fairy patch "affects any moves that were changed to Fairy-type in Gen 6". */
check(sgf.moves.charm[0] === 'fairy' && sg.moves.charm[0] === 'normal', 'the Fairy patch makes Charm Fairy-type; the base hack does not');
/* Evolution Changes: Kadabra "obtain an item called the Covenant Orb"; Magneton the "Voltaic Ore";
   Onix in the "simply Use it" list. */
check(JSON.stringify(evo(sg, 64, 65)) === '["Covenant Orb"]', 'Kadabra evolves with the Covenant Orb', JSON.stringify(evo(sg, 64, 65)));
check(JSON.stringify(evo(sg, 82, 462)) === '["Voltaic Ore"]', 'Magneton evolves with the Voltaic Ore', JSON.stringify(evo(sg, 82, 462)));
check(JSON.stringify(evo(sg, 95, 208)) === '["Metal Coat"]', 'Onix evolves by using a Metal Coat instead of trading it', JSON.stringify(evo(sg, 95, 208)));
check(sg.checks.learnsets.usedAsCheck === false && /other moves/.test(sg.checks.learnsets.why),
  'the calculator\'s learnsets are recorded as NOT confirming Sacred Gold\'s, with the reason');

// --- Platinum Kaizo (Mastersheet) ------------------------------------------------------------------------
const pk = load('platinum-kaizo');
/* Move Changes: "Rollout (No Effect): 30 bp -> 40 bp, 90 acc -> 100 acc, 20 pp -> 5 pp, +1 priority".
   Rock-type, +1 priority: Accelerock in all but name. */
check(JSON.stringify(pk.moves.rollout.slice(0, 6)) === '["rock","physical",40,100,5,1]', 'Rollout is Rock, 40 power, 100%, 5 PP, +1 priority', JSON.stringify(pk.moves.rollout));
check(JSON.stringify(pk.moves.rollout[8]) === '["rock","physical",30,90,20,0]', 'and it keeps Platinum\'s values so the app can say what it was');
/* "Taunt -> HP Dark (No Effect, Special): 0 bp -> 70 bp, 20 pp -> 15 pp"; the TM tab still says TM12 Taunt. */
check(pk.customMoves['pk-hp-dark'] === 'HP Dark' && JSON.stringify(pk.moves['pk-hp-dark'].slice(0, 5)) === '["dark","special",70,100,15]', 'HP Dark is the hack\'s own move: Dark, special, 70 power, 15 PP');
check(JSON.stringify(pk.machines.find(m => m[0] === 'TM12')) === '["TM12","pk-hp-dark"]', 'TM12 teaches HP Dark, not Taunt');
/* Moves tab: row 76 "SolarBeam" and row 130 "Solar-Beam" (Skull Bash's replacement, 15 PP) are two moves. */
check(pk.moves['solar-beam'][4] === 10 && pk.moves['pk-solar-beam'] && pk.moves['pk-solar-beam'][4] === 15, 'SolarBeam and Solar-Beam stay two different moves');
/* Evolutions: KADABRA, Held Item (Day), TwistedSpoon, ALAKAZAM; GRAVELER, Pokemon in Party, MACHOKE, GOLEM. */
check(JSON.stringify(evo(pk, 64, 65)) === '["Level Up\\nHold TwistedSpoon\\n(Day)"]', 'Kadabra evolves holding TwistedSpoon by day', JSON.stringify(evo(pk, 64, 65)));
check(JSON.stringify(evo(pk, 75, 76)) === '["With Machoke in party"]', 'Graveler evolves with Machoke in the party');
check(JSON.stringify(evo(pk, 133, 196)) === '["Dawn Stone"]', 'Eevee evolves into Espeon with a Dawn Stone');

// --- Run & Bun, Emerald Kaizo ---------------------------------------------------------------------------------
const rb = load('run-and-bun');
/* level_up_learnsets.h, sBulbasaurLevelUpLearnset. */
check(lv(rb, 1).join() === ['1 tackle', '1 growl', '5 vine-whip', '10 poison-powder', '14 stun-spore', '14 sleep-powder', '17 take-down', '20 razor-leaf',
  '24 sweet-scent', '28 toxic', '32 sludge-bomb', '36 double-edge', '40 synthesis', '44 seed-bomb'].join(), 'Run & Bun Bulbasaur learns what dekzeh\'s file lists', lv(rb, 1).join());
/* evolution.h: [SPECIES_PIKACHU] = {EVO_ITEM, ITEM_THUNDER_STONE, SPECIES_RAICHU}. */
check(JSON.stringify(evo(rb, 25, 26)) === '["Thunder Stone"]', 'Pikachu evolves with a Thunder Stone');
check(!Object.values(rb.moves).some(v => v[2] === 1), 'no move shows the ROM\'s placeholder power of 1');
const ek = load('emerald-kaizo');
/* state.js TMHMBitfieldLookup: "Seismic Toss", // TM08; "Draco Meteor", // TM32. */
check(JSON.stringify(ek.items.tmChanges) === '[["TM08","bulk-up","seismic-toss"],["TM32","double-team","draco-meteor"]]', 'Emerald Kaizo: TM08 is Seismic Toss and TM32 Draco Meteor', JSON.stringify(ek.items.tmChanges));
/* pkmn.json, Aipom: {"level":4,"move":"Brick Break"}. */
check(lv(ek, 190).includes('4 brick-break'), 'Emerald Kaizo Aipom learns Brick Break at 4');

// --- the app ------------------------------------------------------------------------------------------------
/* The phase 2 block, run with a hack loaded. */
const block = src.slice(src.indexOf('/* ── ROM hacks, phase 2 (5.56)'), src.indexOf('function hackMonChip('));
const capName = (0, eval)('(' + src.match(/function capName\(s\)\{[^\n]*\}/)[0] + ')');
const pkSpecies = JSON.parse(fs.readFileSync(path.join(HD, 'platinum-kaizo.json'), 'utf8')).species;
const app = (0, eval)('var isRomHack=true,HACK={species:' + JSON.stringify(pkSpecies) + ',data:' + JSON.stringify(pk) + '};' +
  'function romHack(){return {label:"Platinum Kaizo",baseLabel:"Platinum"}}function dexRec(i){return {name:"mon"+i}}function hackRec(id){return HACK.species[id]}var capName=' + capName.toString() + ';' +
  block + ';({hackMoveWas,hackMoveLabel,hackMovesFor,hackEvoTree,hackChangesHtml,movePriority})');
check(app.hackMoveWas('rollout') === 'was 30 power · 90% accuracy · 20 PP · 0 priority', 'a changed move says what it was', app.hackMoveWas('rollout'));
check(app.movePriority({ name: 'rollout' }) === 1, 'and a move\'s priority is the hack\'s');
check(app.hackMoveLabel('pk-hp-dark') === 'HP Dark', 'a move made for the hack shows its own name');
const kad = app.hackMovesFor(64);
check(kad.levelup.length === pk.learn[64][0].length / 2 && kad.tm.length === pk.learn[64][1].length, 'a Pokémon\'s page lists the hack\'s learnset');
const tree = app.hackEvoTree(65);
check(tree && tree.id === 63 && tree.children[0].id === 64 && tree.children[0].children[0].id === 65 && /TwistedSpoon/.test(tree.children[0].children[0].method),
  'the evolution chart is the hack\'s: Abra, Kadabra, then Alakazam holding TwistedSpoon');
check(/Ditto|Stats/.test(app.hackChangesHtml(132)) && /48 → 100/.test(app.hackChangesHtml(132)), 'Ditto\'s page says its stats went from 48 to 100', app.hackChangesHtml(132));
check(/const hk=typeof hackMove==="function"\?hackMove\(md\):null;if\(hk&&\(genNum===undefined\|\|genNum===getDataGenNum\(\)\)\)return hk\[2\]\|\|null;/.test(src),
  'move power is read from the hack first');
check(/function getMovesForGen\(p\)\{\s*if\(isRomHack\)return hackMovesFor\(p&&p\.id\);/.test(src), 'learnsets are read from the hack first');
check(/async function getEvoChain\(pokemonId\)\{\s*if\(isRomHack\)return hackEvoTree\(pokemonId\);/.test(src), 'evolutions are read from the hack first');
check(/\(isRomHack\?hackChangesHtml\(p\.id\):''\)/.test(src), 'a Pokémon\'s page says what the hack changed');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
