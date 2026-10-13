/* HoopaDex — ROM hacks: trainers, by section of the game, with notes and a calculator export
 * Run: node tests/test-romhack-trainers.js
 *
 * Asked for from the live site: "we need the trainer docs, with the ability to add notes on each
 * trainer as i play through", "like a spreadsheet, google docs with tabs for each section of the game",
 * and "the ability to upload the enemy teams to the relevant calculators".
 *
 * The data is written by build/generate-romhack-trainers.js. Expected values were read by hand from the
 * source named above each check, not from the generated files.
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
const load = k => JSON.parse(fs.readFileSync(path.join(HD, k + '.trainers.json'), 'utf8'));
const trainers = d => d.sections.flatMap(s => s.areas.flatMap(a => a.trainers.map(t => ({ s, a, t }))));
const find = (d, area, name) => trainers(d).find(x => x.a.name === area && x.t[1] === name);

// --- every hack has a file -----------------------------------------------------------------------------
const HACKS = (0, eval)('(' + src.match(/const ROM_HACKS=(\[[\s\S]*?\n\]);/)[1] + ')');
check(HACKS.every(h => fs.existsSync(path.join(HD, h.key + '.trainers.json'))), 'every hack has a trainers file');
HACKS.forEach(h => {
  const d = load(h.key);
  const keys = trainers(d).map(x => x.t[0]);
  check(new Set(keys).size === keys.length, h.key + ': every trainer has its own key, so a note cannot land on two trainers');
  check(d.order === 'game' || /does not give the order/.test(d.note), h.key + ': the file says whether its order is the game\'s');
});

// --- Renegade Platinum: Drayano, "Trainer Pokémon" (v1.3.0) -----------------------------------------------
const rp = load('renegade-platinum');
/* Platinum's eight Gyms in order; the document writes Byron once as "Leader Bryon". */
check(rp.sections.slice(0, 8).map(s => s.title).join() === 'Roark,Gardenia,Fantina,Maylene,Wake,Byron,Candice,Volkner',
  'Renegade Platinum\'s sections are the eight Gyms in order, "Bryon" read as Byron', rp.sections.map(s => s.title).join());
/* "Leader Roark" full sets: "Nosepass (Lv. 15) @ Smooth Rock / Modest / Sturdy / Stealth Rock, Sandstorm, Thunder Wave, Shock Wave"
   and "Cranidos (Lv. 16) @ Sitrus Berry / Hasty / Rock Head (!) / ...". */
const roark = find(rp, 'Oreburgh Gym', 'Leader Roark');
check(roark && roark.s.n === 1 && JSON.stringify(roark.t[4][0]) === JSON.stringify([299, 'Nosepass', 15, 'Smooth Rock', 'Sturdy', 'Modest', ['Stealth Rock', 'Sandstorm', 'Thunder Wave', 'Shock Wave']]),
  'Roark ends section 1, and his Nosepass has its item, ability, nature and moves', roark && JSON.stringify(roark.t[4][0]));
check(roark && roark.t[4][5][1] === 'Cranidos' && roark.t[4][5][4] === 'Rock Head', 'a "(!)" after an ability is a marker, not part of the name');
/* Route 202: "Lass Natalie   Sentret Lv. 7, Bidoof Lv. 7". */
const nat = find(rp, 'Route 202', 'Lass Natalie');
check(nat && nat.t[4].map(m => m[1] + ' ' + m[2]).join() === 'Sentret 7,Bidoof 7', 'Route 202 Lass Natalie: Sentret 7, Bidoof 7');
/* "Rematches / Youngster Tristan (3)   Noctowl Lv. 27, Staravia Lv. 27". */
check(trainers(rp).some(x => x.t[1] === 'Youngster Tristan' && x.t[2] === '3' && x.t[3] === 1 && x.t[4][0][1] === 'Noctowl' && x.t[4][0][2] === 27),
  'a rematch is marked as one, with its badge count');

// --- Sacred Gold: "Trainer Pokemon" (v1.05) -------------------------------------------------------------------
const sg = load('sacred-gold');
check(sg.sections.slice(0, 8).map(s => s.title).join() === 'Falkner,Bugsy,Whitney,Morty,Chuck,Jasmine,Pryce,Claire', 'Sacred Gold starts with the eight Johto Gyms in order');
/* "Doduo (Lv. 12) @ None / Early Bird / Aerial Ace, Roost, Quick Attack, Growl" - no Nature column. */
const falk = trainers(sg).find(x => x.t[1] === 'Leader Falkner' && !x.t[3]);
check(falk && JSON.stringify(falk.t[4][0]) === JSON.stringify([84, 'Doduo', 12, '', 'Early Bird', '', ['Aerial Ace', 'Roost', 'Quick Attack', 'Growl']]),
  'Falkner\'s Doduo: no item, Early Bird, and its four moves', falk && JSON.stringify(falk.t[4][0]));

// --- Platinum Kaizo: the Mastersheet's split tabs -----------------------------------------------------------
const pk = load('platinum-kaizo');
check(pk.sections.map(s => s.title).join() === 'Roark,Gardenia,Fantina,Maylene,Wake,Byron,Candice,Volkner,Team Galactic,Elite Four', 'Platinum Kaizo keeps the sheet\'s ten split tabs');
/* Roark split, Route 202, Youngster Tristan: "Lv 5 Zigzagoon ♂ / Hasty, Gluttony / Silk Scarf / Quick Attack, Sand Attack". */
const tri = find(pk, 'Route 202', 'Youngster Tristan');
check(tri && JSON.stringify(tri.t[4][0]) === JSON.stringify([263, 'Zigzagoon', 5, 'Silk Scarf', 'Gluttony', 'Hasty', ['Quick Attack', 'Sand Attack']]),
  'Youngster Tristan\'s Zigzagoon: Hasty, Gluttony, Silk Scarf, Quick Attack and Sand Attack', tri && JSON.stringify(tri.t[4][0]));
check(trainers(pk).every(x => x.t[4].every(m => m[6].length)), 'every Platinum Kaizo trainer has full sets');

// --- Run & Bun, Emerald Kaizo, FireRed Omega ----------------------------------------------------------------
const rb = load('run-and-bun');
check(rb.order === 'game' && rb.sections.some(s => s.title === 'Tate & Liza'), 'Run & Bun is in the game\'s order, and Tate and Liza share one section');
/* Calculator data: Aurorus "Lvl 24 Leader Roxanne": Lum Berry, Hasty, Refrigerate, Body Slam / Power Gem / Discharge / Earth Power. */
const rox = trainers(rb).find(x => x.t[1] === 'Leader Roxanne');
check(rox && rox.t[4].some(m => JSON.stringify(m) === JSON.stringify([699, 'Aurorus', 24, 'Lum Berry', 'Refrigerate', 'Hasty', ['Body Slam', 'Power Gem', 'Discharge', 'Earth Power']])),
  'Roxanne\'s Aurorus is the calculator\'s set');
const ek = load('emerald-kaizo');
check(ek.order === 'level' && ek.sections[0].title === 'Roxanne' && ek.sections.length < 15, 'Emerald Kaizo is sorted by level, said so, and Leader rematches do not open new sections');
const fro = load('firered-omega');
check(fro.sections[0].title === 'Brock' && !trainers(fro).some(x => x.t[4].length === 1 && x.t[4][0][1] === 'Ekans' && x.t[4][0][2] === 5),
  'FireRed Omega leaves out FireRed\'s placeholder trainers (a lone level 5 Ekans)');

// --- the app ------------------------------------------------------------------------------------------------
const rel = src.slice(src.indexOf('const TAB_RELEVANCE='), src.indexOf('function isTabRelevant('));
const tabFn = (0, eval)('var isChampionsMode=false,selectedGenNum=4,isRomHack=false;' + rel +
  src.slice(src.indexOf('function isTabRelevant('), src.indexOf('function applyTabVisibility(')) + ';({set(h){isRomHack=h},isTabRelevant})');
check(!tabFn.isTabRelevant('trainers'), 'the Trainers tab is not offered outside a ROM hack');
tabFn.set(true);
check(tabFn.isTabRelevant('trainers'), 'and is offered inside one');
check(/\['pokedex','types','tms','locations','evs','natures','other','abilities','items','trainers',('ai',)?'team','calc'\]\.includes\(resolvedTab\)/.test(src),
  'a link to the Trainers tab opens it');
const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const showdown = (0, eval)('(' + fnSrc('trainerShowdown') + ')');
const team = ['k', 'Leader Roark', '', 0, [[299, 'Nosepass', 15, 'Smooth Rock', 'Sturdy', 'Modest', ['Stealth Rock', 'Sandstorm']], [74, 'Geodude', 12, '', '', '', ['Tackle']]]];
check(showdown(team) === 'Nosepass @ Smooth Rock\nAbility: Sturdy\nLevel: 15\nModest Nature\n- Stealth Rock\n- Sandstorm\n\nGeodude\nLevel: 12\n- Tackle\n',
  'Copy team writes Showdown\'s import format, leaving out what the source does not say', JSON.stringify(showdown(team)));
/* Saving a note, run against a stand-in for the browser's storage. M195 deleted the line that saves,
   and a check that only searched the page for "localStorage.setItem" stayed green - the import code
   has one too - so the real functions are run. */
globalThis.__trainerStore = {};   // indirect eval runs at global scope, so the stand-in lives there
const notesFns = (0, eval)('var localStorage={getItem:function(k){return __trainerStore[k]===undefined?null:__trainerStore[k]},setItem:function(k,v){__trainerStore[k]=String(v)}};' +
  'function romHack(){return {key:"platinum-kaizo"}}' + src.match(/const TRAINER_NOTES_KEY='[^']*';/)[0] +
  fnSrc('trainerNotesAll') + fnSrc('trainerNotes') + fnSrc('saveTrainerNote') + ';({saveTrainerNote,trainerNotes})');
notesFns.saveTrainerNote('Route 202|Youngster Tristan|1', 'n', 'Zigzagoon has Gluttony');
notesFns.saveTrainerNote('Route 202|Youngster Tristan|1', 'b', 1);
check(JSON.stringify(notesFns.trainerNotes()) === '{"Route 202|Youngster Tristan|1":{"n":"Zigzagoon has Gluttony","b":1}}',
  'a note and a "beaten" tick are saved under the hack and the trainer, and read back', JSON.stringify(notesFns.trainerNotes()));
notesFns.saveTrainerNote('Route 202|Youngster Tristan|1', 'n', '');
notesFns.saveTrainerNote('Route 202|Youngster Tristan|1', 'b', false);
check(JSON.stringify(notesFns.trainerNotes()) === '{}', 'clearing both removes the trainer\'s entry');
check(/function exportTrainerNotes\(/.test(src) && /function importTrainerNotes\(/.test(src), 'notes can be exported and imported');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
