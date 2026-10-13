/* HoopaDex — Radical Red
 * Run: node tests/test-radical-red.js
 *
 * Asked for from the live site: "put radical red and the storm/sacred pair in".
 * Every Radical Red file is built from one community source, the data behind the Radical Red Dex
 * (build/rr-source.js). Expected values were read by hand from that data.js, as quoted beside each
 * check - not from the generated files.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const HD = path.join(ROOT, 'app', 'hacks');
const load = f => JSON.parse(fs.readFileSync(path.join(HD, f), 'utf8'));

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}

// --- species ------------------------------------------------------------------------------------------
const sp = load('radical-red.json');
check(Object.keys(sp.species).length === 1025, 'Radical Red has all 1,025 species');
/* species[3] Venusaur 'stats':[80,82,83,80,100,100] - Gen III order HP/Atk/Def/Spe/SpA/SpD - abilities [[34],[65],[0]]
   (34 Chlorophyll, 65 Overgrow). In HoopaDex order HP/Atk/Def/SpA/SpD/Spe: 80/82/83/100/100/80. */
check(JSON.stringify(sp.species[3]) === JSON.stringify([['grass', 'poison'], [80, 82, 83, 100, 100, 80], ['chlorophyll', 'overgrow', '']]),
  'Venusaur: the Gen III stat order is turned into HoopaDex\'s; Chlorophyll / Overgrow', JSON.stringify(sp.species[3]));
/* abilities: {'names':['Feline Prowess'],'description':'Doubles Special Attack stat.'} */
check(sp.customAbilities && JSON.stringify(sp.customAbilities['rr-feline-prowess']) === '["Feline Prowess","Doubles Special Attack stat."]', 'Radical Red\'s own abilities keep the game\'s name and description');
check(!Object.keys(sp.customAbilities).some(k => /neutraliz|electrom/.test(k)), 'the cut names "Neutralize Gas" and "Electromrphosis" are the official abilities, not new ones');
check(JSON.stringify(load('radical-red-hardcore.json').species) === JSON.stringify(sp.species), 'Hardcore has the same Pokémon as Normal');

// --- moves, learnsets, evolutions --------------------------------------------------------------------
const d = load('radical-red.data.json');
/* moves: Cut {'power':75,'type':8 (Steel),'accuracy':100,'pp':25,'split':0}. */
check(JSON.stringify(d.moves.cut.slice(0, 5)) === '["steel","physical",75,100,25]', 'Cut is a 75-power Steel move', JSON.stringify(d.moves.cut));
/* Bulbasaur 'levelupMoves':[[33,1],[45,3],[73,7], ...]: Tackle at 1, Growl at 3, Leech Seed at 7. */
check(d.learn[1][0].slice(0, 6).join() === '1,tackle,3,growl,7,leech-seed', 'Bulbasaur learns Tackle at 1, Growl at 3 and Leech Seed at 7', d.learn[1][0].slice(0, 6).join());
check(d.moves['draining-kiss'] && d.moves['prismatic-laser'] && !d.customMoves['rr-drain-kiss'], 'cut names ("Drain Kiss", "Prism Laser") are the official moves');
check(d.customMoves['rr-soupercell-slam'] === 'Soupercell Slam' && Object.keys(d.customMoves).length === 9, 'nine moves are Radical Red\'s own, Soupercell Slam among them', Object.keys(d.customMoves).length);
check(!Object.keys(d.moves).some(k => /placeholder|z-move/.test(k)), 'empty and Z-Move slots are not shown as moves');
/* Eevee 'evolutions': [7,95,136,0] Fire Stone -> Flareon ... [17,23,808,0] Fairy-type move -> Sylveon. */
const eevee = (d.evo[133] || []).map(e => e[0] + ':' + e[1].join('/')).join(',');
check(/136:Fire Stone/.test(eevee) && /700:Fairy Move/.test(eevee), 'Eevee evolves by Fire Stone into Flareon, and into Sylveon knowing a Fairy move', eevee);
/* tmMoves: index 120 is Cut (HM01); indices 106, 117 and 127 (TM107, TM118, HM08) are 0 - empty in the source. */
check(JSON.stringify(d.machines.find(m => m[0] === 'HM01')) === '["HM01","cut"]' && !d.machines.some(m => m[0] === 'TM118'), 'TMs 1-120 come first, then the HMs: HM01 is Cut; an empty slot is left out');

// --- trainers ---------------------------------------------------------------------------------------------
/* trainers[414] 'Leader Brock', cap 0, normal[0]: species 1031 (key 'Geodude-Alola'), nature 3 (Adamant),
   ability 2 -> abilities[2] = 5 (Sturdy), level 13, item 464 (Custap Berry), moves Bulldoze, Rock Tomb, Spark, Self-Destruct. */
const tn = load('radical-red.trainers.json'), th = load('radical-red-hardcore.trainers.json');
const brock = tn.sections[0].areas.flatMap(a => a.trainers).find(t => t[1] === 'Leader Brock');
check(tn.sections[0].title === 'Brock' && brock && JSON.stringify(brock[4][0]) === JSON.stringify([74, 'Geodude (Alola)', 13, 'Custap Berry', 'Sturdy', 'Adamant', ['Bulldoze', 'Rock Tomb', 'Spark', 'Self-Destruct']]),
  'Brock\'s lead on Normal is Alolan Geodude, Lv 13, Custap Berry, Sturdy, Adamant', brock && JSON.stringify(brock[4][0]));
/* caps 'Brock': {'cap':[15,16]}; scaledLevels {'103':0}: Brock's rematch (cap 9 = [68,68]) is level 103 -> 68. */
const re = tn.sections.flatMap(s => s.areas.flatMap(a => a.trainers)).filter(t => t[1] === 'Leader Brock').map(t => t[4][0][2]);
check(re.includes(68), 'a level of 103 is "at the level cap": Brock\'s rematch is level 68', re.join());
check(tn.trainerCount === 463 && th.trainerCount === 463, 'Normal and Hardcore each have 463 trainers');
check(JSON.stringify(th) !== JSON.stringify(tn), 'Hardcore\'s teams are its own');

// --- encounters --------------------------------------------------------------------------------------------
/* areas 'Route 1' 'wild-day' slots: [452 Bidoof, 288 Zigzagoon, ...] against FireRed's land rates 20, 20, ... */
const enc = load('radical-red.encounters.json');
const r1 = enc.areas.find(a => a.name === 'Route 1').methods.find(m => m.m === 'Grass (day)');
check(r1 && r1.rows[0][1] === 'Bidoof' && r1.rows[0][2] === 20 && r1.rows.reduce((s, r) => s + r[2], 0) === 100, 'Route 1 by day: Bidoof in the first 20% slot; the slots add to 100%');

// --- the app ---------------------------------------------------------------------------------------------
const HACKS = (0, eval)('(' + src.match(/const ROM_HACKS=(\[[\s\S]*?\n\]);/)[1] + ')');
const rr = HACKS.find(h => h.key === 'radical-red');
check(rr && rr.variants.map(v => v.label).join() === 'Normal,Hardcore' && rr.fairy === 'always', 'Radical Red is a hack with Normal and Hardcore');
check(/trainerData\[tf\]=\(tf!==h\.key\?await get\(tf\):null\)\|\|await get\(h\.key\);/.test(src), 'Hardcore loads its own trainers');
const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const showdown = (0, eval)('(' + fnSrc('trainerShowdown') + ')');
check(/^Geodude-Alola @ Custap Berry\n/.test(showdown(brock)), 'Copy team writes the form the way Showdown does: Geodude-Alola', showdown(brock).split('\n')[0]);

const label = (0, eval)('var isRomHack=true,HACK={customAbilities:' + JSON.stringify(sp.customAbilities) + '};' + fnSrc('hackCustomAbility') + fnSrc('hackAbilityLabel') + ';hackAbilityLabel');
check(label('rr-feline-prowess') === 'Feline Prowess' && label('solar-power') === 'solar power', 'a hack\'s own ability shows its own name, not "rr feline prowess"');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
