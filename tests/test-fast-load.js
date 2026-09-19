/* HoopaDex — the list views load from snapshots, and the snapshots say true things
 * Run: node tests/test-fast-load.js
 *
 * Reported from the live site: "abilities takes forever to load", then "make the whole site flow
 * faster please". Measured before 5.50:
 *
 *   Abilities tab   375 requests, ~5 MB, to show four fields per ability
 *   Pokedex         ~60 full records (100-360 KB each) for the first page of cards, and up to 1,025
 *                   for a type filter or a stat sort - which, until they arrived, ordered only the
 *                   cards already loaded
 *   Startup         two PokeAPI list requests, one after the other, before anything was drawn
 *   Items tab       an unused 2,200-item list, then 18 category requests one after another
 *
 * Now the Pokedex, filters, sorts, evolution thumbnails and EV tables read app/dex-index.json (1,351
 * entries, 24 KB compressed) and the Abilities tab reads app/abilities-index.json (374 abilities,
 * 30 KB compressed). Both are written by build scripts from the same PokeAPI records the app read,
 * and both have a --check mode against the live API.
 *
 * This suite checks what can be checked offline: that the files are whole, that they agree with an
 * INDEPENDENT source (Showdown's Pokedex in data/showdown-champions-extract.json, and each other), and
 * that the app uses them without letting a partial record pass for a full one.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);
const DEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'dex-index.json'), 'utf8'));
const ABIL = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'abilities-index.json'), 'utf8'));
const SD = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'showdown-champions-extract.json'), 'utf8')).dex;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}
const fnSrc = (start, end) => {
  const a = src.indexOf(start), b = src.indexOf(end, a + 1);
  if (a < 0 || b < 0) throw new Error('could not locate ' + start);
  return src.slice(a, b);
};

// === app/dex-index.json ============================================================================
const rows = DEX.pokemon;
const TYPES = new Set(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']);
const species = rows.filter(r => r[0] <= 1025), forms = rows.filter(r => r[0] > 10000);
check(species.length === 1025 && species.every((r, i) => r[0] === i + 1),
  'the snapshot holds all 1,025 species, in number order, because the app numbers the list by position');
check(forms.length === DEX.forms && forms.length >= 300, 'and every alternate form (' + forms.length + ')', forms.length);
check(rows.length === species.length + forms.length, 'and nothing else');
const malformed = rows.filter(r => !(typeof r[1] === 'string' && Array.isArray(r[2]) && r[2].length >= 1 && r[2].length <= 2 &&
  r[2].every(t => TYPES.has(t)) && Array.isArray(r[3]) && r[3].length === 6 && r[3].every(v => Number.isInteger(v) && v > 0) &&
  /^[0-3]{6}$/.test(r[6])));
check(malformed.length === 0, 'every row has a name, one or two real types, six positive base stats and an EV yield', malformed.slice(0, 3).map(r => r[1]));

/* Independent check: Showdown's Pokedex, a different project with its own data entry. */
const sdByNum = {};
Object.values(SD).forEach(v => { if (!v.forme && v.num > 0) sdByNum[v.num] = v; });
/* PokeAPI's default Minior is the Meteor Form (it is named minior-red-meteor); Showdown's base
   "Minior" is the Core. Both are right about what they name. */
const NAMED_DIFFERENTLY = { 'minior-red-meteor': 'Showdown\'s base Minior is Core Form; PokeAPI\'s default is Meteor Form' };
const spBad = species.filter(r => sdByNum[r[0]] && !NAMED_DIFFERENTLY[r[1]] && sdByNum[r[0]].bs.join() !== r[3].join());
check(species.filter(r => sdByNum[r[0]]).length === 1025, 'Showdown has a base entry for every species');
check(spBad.length === 0, 'every species\' base stats match Showdown\'s', spBad.slice(0, 5).map(r => r[1] + ' ' + r[3] + ' vs ' + sdByNum[r[0]].bs));
check(sdByNum[774].bs.join() === '60,100,60,100,60,120' && rows.find(r => r[0] === 774)[3].join() === '60,60,100,60,100,60',
  'the one named difference is still exactly Minior\'s two forms, not a new disagreement hiding under it');
const fMatched = forms.filter(r => SD[r[1].replace(/-/g, '')]);
const fBad = fMatched.filter(r => SD[r[1].replace(/-/g, '')].bs.join() !== r[3].join());
check(fMatched.length >= 250, 'Showdown names ' + fMatched.length + ' of the forms the same way', fMatched.length);
check(fBad.length === 0, 'and every one of those forms\' stats match', fBad.slice(0, 5).map(r => r[1]));

// --- the app's reading of it ----------------------------------------------------------------------
const SPRITE_ROOT = (src.match(/const SPRITE_ROOT='([^']+)'/) || [])[1];
const liteSrc = fnSrc('function liteRecord(', '\n/* Resolves true');
const liteRecord = eval('(' + liteSrc.replace(/^function liteRecord/, 'function') + ')');
const zard = liteRecord(rows.find(r => r[0] === 6));
check(zard.types.map(t => t.type.name).join() === 'fire,flying' && zard.types[0].slot === 1,
  'a snapshot row becomes the record shape the list views already read');
check(zard.stats.find(s => s.stat.name === 'special-attack').base_stat === 109 && zard.stats.find(s => s.stat.name === 'special-attack').effort === 3,
  'stats and EV yields land under PokeAPI\'s stat names');
check(zard.sprites.other['official-artwork'].front_default === SPRITE_ROOT + 'other/official-artwork/6.png',
  'the artwork URL is rebuilt exactly as PokeAPI gives it');
const noArt = rows.find(r => r[4] === 0);
check(!noArt || liteRecord(noArt).sprites.other['official-artwork'].front_default === null,
  'and an entry PokeAPI has no artwork for gets none, so the card falls back rather than showing a broken image');
check(zard._lite === true, 'a snapshot record is marked as partial');

/* `dc` means "the full record is here" to the detail page, team builder and calculator. */
const loader = fnSrc('async function loadDexIndex(', '\n}\n');
check(!/\bdc\[/.test(loader), 'the snapshot never writes into dc, so it cannot pass for a full record');
check(/fetch\('dex-index\.json'\)/.test(loader), 'the snapshot is one same-origin request');
const init = fnSrc('async function init(', '\n}\n');
check(/const _haveIndex=await loadDexIndex\(\);\s*if\(!_haveIndex\)\{/.test(init),
  'at startup the snapshot replaces the two PokeAPI list requests, and they still run if it fails to load');
check(init.indexOf("fetch('https://pokeapi.co/api/v2/pokemon?limit=1025") > init.indexOf('if(!_haveIndex){'),
  'the PokeAPI species list is only requested when the snapshot did not load');

const LIST_READERS = [
  ['function cardHTML(', 'const d=dexRec(e.id);', 'a card'],
  ['function cardSortValue(', 'const d=dexRec(id);', 'the stat shown on a sorted card'],
  ['function dexSortComparator(', 'const d=dexRec(p.id);', 'the stat sort'],
  ['function applyFilters(', 'const d=dexRec(p.id);return d?d.types', 'the type filter'],
  ['function onFilterChange(', 'filter(p=>!dexRec(p.id))', 'the type filter\'s download list'],
  ['function renderList(', 'filter(p=>!dexRec(p.id))', 'the grid\'s download list'],
  ['function loadMoreVisible(', 'filter(p=>!dexRec(p.id))', '"load more"'],
  ['function renderEvoStage(', 'const cached=dexRec(node.id);', 'an evolution thumbnail'],
  ['function renderEVTable(', 'const d=dexRec(p.id);', 'the EV yield table'],
];
LIST_READERS.forEach(([fn, needle, what]) => {
  const body = fnSrc(fn, '\nfunction ');
  check(body.includes(needle), what + ' reads the snapshot when the full record is not loaded');
});
check(/function collectIds\(node\)\{if\(!dexRec\(node\.id\)\)allIds\.push/.test(src),
  'the evolution box no longer downloads each family member\'s full record just to show its picture');

// === app/abilities-index.json ======================================================================
const ab = ABIL.abilities;
check(ab.length === ABIL.count && ab.length >= 370, 'the ability snapshot holds ' + ab.length + ' abilities', ab.length);
check(new Set(ab.map(a => a[0])).size === ab.length, 'each once');
const GENS = new Set(['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']);
check(ab.every(a => GENS.has(a[1])), 'each with the generation it arrived in, written as the list expects', ab.filter(a => !GENS.has(a[1])).map(a => a[0]));
/* The two snapshots were taken separately from separate endpoints. Every holder an ability names must
   be a Pokemon the dex snapshot has, under the same name. */
const byId = {};
rows.forEach(r => { byId[r[0]] = r[1]; });
const orphan = [];
ab.forEach(a => a[3].forEach(h => { if (byId[h[1]] !== h[0]) orphan.push(a[0] + ': ' + h[0] + '#' + h[1]); }));
check(orphan.length === 0, 'every ability holder is in the dex snapshot under the same id and name', orphan.slice(0, 5));
const intim = ab.find(a => a[0] === 'intimidate');
check(intim && intim[1] === 'III' && intim[3].some(h => h[0] === 'gyarados' && h[2] === 0) && intim[3].some(h => h[0] === 'incineroar' && h[2] === 1),
  'Intimidate: Generation III, Gyarados as a normal ability, Incineroar as its hidden one');

const tab = fnSrc('async function renderAbilitiesTab(', '\nfunction renderAbilityList(');
check(/fetch\('abilities-index\.json'\)/.test(tab), 'the Abilities tab asks for the snapshot first');
check(tab.indexOf("fetch('abilities-index.json')") < tab.indexOf("fetch('https://pokeapi.co/api/v2/ability?limit=400')"),
  'and keeps the per-ability downloads as the fallback, not the first choice');
check(/url:'https:\/\/pokeapi\.co\/api\/v2\/pokemon\/'\+h\[1\]\+'\/'/.test(tab),
  'holders get back the URL shape the holder filters parse');
const idFromUrlSrc = lines.find(l => l.startsWith('const idFromUrl='));
const idFromUrl = (0, eval)(idFromUrlSrc.replace(/^const idFromUrl=/, '').replace(/;$/, ''));
check(idFromUrl('https://pokeapi.co/api/v2/pokemon/10034/') === 10034, 'and that URL parses back to the right id');

// === app/moves-index.json ==========================================================================
/* A Pokemon's page downloaded each learnable move's full record: 76 requests, 3.6 s for Charizard. */
const MOV = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'moves-index.json'), 'utf8')).moves;
check(MOV.length >= 900 && MOV.every(r => r.length === 13 && typeof r[0] === 'string'), 'the move snapshot holds ' + MOV.length + ' complete rows', MOV.length);
/* Independent check against Showdown. Six values differ, named so a new disagreement cannot hide
   among them. Five are PokeAPI notation: 1 as a "varies" marker for power, and 0 instead of its usual
   null for "never misses", which every accuracy display treats the same. The sixth is a real PokeAPI
   error: Take Heart is 15 PP in the main games (Bulbapedia), and 10 only in Legends: Arceus. See
   BACKLOG #33. */
const SDM = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'showdown-champions-extract.json'), 'utf8')).moves;
const KNOWN_MOVE_DIFFS = ['ruination:bp', 'comeuppance:bp', 'burning-bulwark:acc', 'tachyon-cutter:acc', 'dragon-cheer:acc', 'take-heart:pp'];
const mdiff = [];
let mShared = 0;
MOV.forEach(r => {
  const s = SDM[r[0].replace(/-/g, '')]; if (!s) return; mShared++;
  if (s.type.toLowerCase() !== r[1]) mdiff.push(r[0] + ':type');
  if (s.category.toLowerCase() !== r[2]) mdiff.push(r[0] + ':cat');
  if ((s.basePower || null) !== (r[3] || null)) mdiff.push(r[0] + ':bp');
  if ((s.accuracy === true ? null : s.accuracy) !== r[4]) mdiff.push(r[0] + ':acc');
  if (s.pp !== r[5]) mdiff.push(r[0] + ':pp');
});
check(mShared >= 700, 'Showdown shares ' + mShared + ' of the moves', mShared);
check(mdiff.filter(d => !KNOWN_MOVE_DIFFS.includes(d)).length === 0, 'type, category, power, accuracy and PP agree with Showdown apart from six named PokeAPI quirks',
  mdiff.filter(d => !KNOWN_MOVE_DIFFS.includes(d)).slice(0, 8));

/* The app turns a row back into a PokeAPI-shaped response and builds the record with the same
   makeMoveRecord it uses on a live one. Sliced from the app, not restated. */
const VGG = (src.match(/const VG_GEN=\{[^;]*\};/) || [])[0];
const mv = (0, eval)(VGG + '\n' + fnSrc('function movePastValues(', '\nfunction makeMoveRecord(') + '\n' +
  fnSrc('function makeMoveRecord(', '\n}\n') + '\n}\n' + fnSrc('function expandMoveRow(', '\n}\n') + '\n}\n;({makeMoveRecord,expandMoveRow})');
const recOf = n => mv.makeMoveRecord(mv.expandMoveRow(MOV.find(r => r[0] === n)));
const jk = recOf('jump-kick');
check(jk.power === 100 && Object.values(jk.past).some(p => p.power === 70) && Object.values(jk.past).some(p => p.power === 85),
  'Jump Kick keeps its history: 100 now, 85 and 70 in older generations');
check(mv.expandMoveRow(MOV.find(r => r[0] === 'flamethrower')).effect_chance === 10, "Flamethrower keeps its 10% effect chance, which a description can quote");
check(recOf('kings-shield').priority === 4 && recOf('kings-shield').type === 'steel', "King's Shield: Steel, +4");
check(recOf('bite').pastTypes && Object.values(recOf('bite').pastTypes).includes('normal'), 'Bite remembers it was Normal-type before Generation II');
check(recOf('surf').flavorEntries.length > 5 && recOf('surf').flavorEntries.every(e => e.language.name === 'en' && e.version_group),
  'game text keeps an English entry per version group, for the generation-correct description');

const raw = fnSrc('async function moveRaw(', '\n}\n');
check(/if\(idx&&idx\[name\]\)return expandMoveRow\(idx\[name\]\);/.test(raw), 'a move is read from the snapshot when it is there');
check(/_moveLive\[name\]/.test(raw), 'otherwise one live request, shared by everyone who asks for the same move at once');
check((src.match(/const d=await moveRaw\(/g) || []).length === 5, 'the five places that build a move record all go through it',
  (src.match(/const d=await moveRaw\(/g) || []).length);
check(/async function fetchTMMoveDetail[\s\S]{0,300}fetch\('https:\/\/pokeapi\.co\/api\/v2\/move\/'\+moveName\)/.test(src),
  'the TM lookup stays live, because it reads machines and learners the snapshot does not hold');
check(/speciesCache\[specId\]=await fetchJsonShared\(url\)/.test(src) && /const chain=await fetchJsonShared\(chainUrl\)/.test(src),
  "a Pokemon's species record and evolution chain are requested once, not once per part of the page");

// === Items =========================================================================================
const items = fnSrc('function loadAllItems(', '\nlet itemDetailCache');
check(!/item\?limit=2200/.test(items), 'the 2,200-item list that was fetched and never read is gone');
check(/Promise\.all\(HELD_ITEM_CATEGORIES\.map/.test(items), 'the item categories are requested together');
check(/HELD_ITEM_CATEGORIES\.forEach\(function\(catId,ci\)\{\s*const d=cats\[ci\];/.test(items),
  'and processed in the listed order, because an item in two categories is filed under the first');
check(/if\(!_itemsLoading\)_itemsLoading=/.test(items), 'the startup preload and the tab share one load instead of racing two');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
