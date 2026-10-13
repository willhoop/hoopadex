/* HoopaDex — ROM hacks: wild encounters
 * Run: node tests/test-romhack-encounters.js
 *
 * Asked for from the live site: "we need trainer docs and encounter docs as well".
 * The data is written by build/generate-romhack-encounters.js. Expected values were read by hand from
 * the source named above each check, not from the generated files.
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
const load = k => JSON.parse(fs.readFileSync(path.join(HD, k + '.encounters.json'), 'utf8'));
const method = (d, area, m) => { const a = d.areas.find(x => x.name === area); return a && a.methods.find(x => x.m === m); };
const row = (mm, name) => mm && mm.rows.find(r => r[1] === name);

// --- Renegade Platinum: Drayano, "Wild Pokémon" (v1.3.0) -------------------------------------------------
const rp = load('renegade-platinum');
/* "Route 201 / Levels: 4 - 5 (Walking) / Morning  Starly (30%), Bidoof (30%), Pidgey (10%), Kricketot (10%), Nidoran♂ (10%), Nidoran♀ (10%)". */
const m201 = method(rp, 'Route 201', 'Morning');
check(m201 && JSON.stringify(row(m201, 'Starly')) === '[396,"Starly",30,"4 - 5"]', 'Route 201, morning: Starly 30% at 4-5', JSON.stringify(row(m201, 'Starly')));
check(row(m201, 'Nidoran♂') && row(m201, 'Nidoran♂')[0] === 32 && row(m201, 'Nidoran♀')[0] === 29, 'Nidoran♂ and Nidoran♀ stay two species');
/* "Fishing rod encounters have fixed levels. The Old Rod is Lv. 10"; Twinleaf "Old Rod  Magikarp (65%), Poliwag (35%)". */
check(JSON.stringify(row(method(rp, 'Twinleaf Town', 'Old Rod'), 'Magikarp')) === '[129,"Magikarp",65,"10"]', 'Old Rod encounters take the Old Rod\'s stated level, 10');

// --- Sacred Gold: Drayano, "Pokemon Locations" (v1.05) ---------------------------------------------------
const sg = load('sacred-gold');
/* "Route 29 / Wild Levels: 3 – 5 / Grass, Morning / Day: Pidgey (20%), ... Bidoof\n(10%), Hoppip (5%), Wurmple (5%)" - Bidoof's rate wraps onto the next line. */
const g29 = method(sg, 'Route 29', 'Grass, Morning / Day');
check(g29 && g29.rows.map(r => r[1] + ' ' + r[2]).join() === 'Pidgey 20,Sentret 20,Starly 15,Rattata 15,Zigzagoon 10,Bidoof 10,Hoppip 5,Wurmple 5',
  'Route 29 by day: all eight, including Bidoof, whose rate wraps onto the next line', g29 && g29.rows.map(r => r[1] + ' ' + r[2]).join());
/* "Meridian Sound: Furret, Raticate" - no rates in the document. */
check(JSON.stringify(method(sg, 'Route 29', 'Meridian Sound').rows.map(r => [r[1], r[2]])) === '[["Furret",null],["Raticate",null]]', 'a list with no rates keeps no rates');
/* "Swarm: Illumise [SG], Volbeat [SS]". */
check(sg.areas.some(a => a.methods.some(m => m.rows.some(r => r[0] === 314 && r[1] === 'Illumise (Sacred Gold)'))), 'a version-only encounter says which version');
/* Route 47: "Grass, Morning / Day*:" then a stray "Day*:"; Route 45's "Super" before "Super Rod:". */
check(method(sg, 'Route 47', 'Grass, Morning / Day*') && row(method(sg, 'Route 47', 'Grass, Morning / Day*'), 'Ditto'), 'Route 47\'s repeated heading keeps its list under the full heading');
check(!sg.areas.some(a => a.methods.some(m => m.rows.some(r => r[1] === 'Super' || r[1] === 'Meridian'))), 'a stray word before a heading is not read as a Pokémon');

// --- Platinum Kaizo: the Mastersheet's Encounters tab ------------------------------------------------------
const pk = load('platinum-kaizo');
/* Route 202 column: Grass 20% Sentret 5, 20% Burmy 5; Day 10% Weedle 5. */
check(JSON.stringify(row(method(pk, 'Route 202', 'Grass'), 'Sentret')) === '[161,"Sentret",20,"5"]' && row(method(pk, 'Route 202', 'Day'), 'Weedle'), 'Route 202: Sentret 20% at 5 in grass, Weedle by day');
check(!pk.areas.some(a => a.methods.some(m => m.rows.some(r => /#REF!/.test(r[1] + r[3])))), 'the sheet\'s broken "#REF!" cells are not shown as Pokémon');

// --- Run & Bun: the game's wild_encounters.json --------------------------------------------------------------
const rb = load('run-and-bun');
/* MAP_ROUTE102 land_mons: STARLY, STARLY, PIDGEY, PIDGEY, ROOKIDEE, ROOKIDEE, FLETCHLING, FLETCHLING, NATU, NATU, ABRA, RALTS
   against the slot rates 20,10,10,10,10,10,10,5,5,5,4,1. */
check(method(rb, 'Route 102', 'Grass').rows.map(r => r[1] + ' ' + r[2]).join() === 'Starly 30,Pidgey 20,Rookidee 20,Fletchling 15,Natu 10,Abra 4,Ralts 1',
  'Route 102: each species\' slots are added up (Starly 20% + 10% = 30%)', method(rb, 'Route 102', 'Grass').rows.map(r => r[1] + ' ' + r[2]).join());
check(rb.areas.some(a => a.name === 'Granite Cave B1F'), 'map names read as places ("Granite Cave B1F")');

// --- Emerald Kaizo; FireRed Omega ----------------------------------------------------------------------------
const ek = load('emerald-kaizo');
/* encounters.json, Littleroot Town: surf Squirtle 60% Lv 44; oldRod Luvdisc 70% Lv 4. */
check(JSON.stringify(row(method(ek, 'Littleroot Town', 'Surf'), 'Squirtle')) === '[7,"Squirtle",60,"44"]' && row(method(ek, 'Littleroot Town', 'Old Rod'), 'Luvdisc')[2] === 70,
  'Emerald Kaizo Littleroot Town: Squirtle surfing at 44, Luvdisc on the Old Rod');
check(!fs.existsSync(path.join(HD, 'firered-omega.encounters.json')), 'FireRed Omega has no encounter file, because no source publishes its encounters');

// --- the app -------------------------------------------------------------------------------------------------
const rel = src.slice(src.indexOf('const TAB_RELEVANCE='), src.indexOf('function isTabRelevant('));
const tabFn = (0, eval)('var isChampionsMode=false,selectedGenNum=4,isRomHack=true;' + rel +
  src.slice(src.indexOf('function isTabRelevant('), src.indexOf('function applyTabVisibility(')) + ';({isTabRelevant})');
check(tabFn.isTabRelevant('locations'), 'the Locations tab is shown in hack mode');
check(/if\(isRomHack\)renderHackWhere\(p\.id\);else loadDetailEncounters\(p\.id\);/.test(src), 'a Pokémon\'s page lists where to find it in the hack, not in the base game');
check(/if\(tab==='locations'&&!isRomHack\)initLocations\(\);/.test(src), 'the base game\'s location view is not drawn in hack mode');
const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const encRow = (0, eval)('var hackEsc=function(x){return String(x)};function spriteFor(){return ""}function getDataGenNum(){return 4};(' + fnSrc('encRowHtml') + ')');
const html = encRow([396, 'Starly', 30, '4 - 5']);
check(/Starly <small>30% · Lv 4 - 5<\/small>/.test(html), 'an encounter shows its rate and levels', html);

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
