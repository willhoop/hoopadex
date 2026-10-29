/* HoopaDex — Platinum Kaizo: AI flags, the guide, the Run tracker, gifts and items (5.64)
 * Run: node tests/test-platinum-kaizo.js
 *
 * Asked for: "i want to start playing platinum kaizo so please update hoopadex to include all the docs
 * and a guide on the game, especially a switch ai guide", "trainer docs, encounter docs", "items, move
 * changes, ability changes, pokemon stat changes, everything", and "a nuzlocke tracker as well".
 *
 * The parsers are run on small inputs written here by hand, laid out the way the sheets are; the
 * shipped files are checked against values read by hand off the sheets. Nothing expected below was
 * copied from a generated file.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const HD = path.join(ROOT, 'app', 'hacks');
const json = f => JSON.parse(fs.readFileSync(path.join(HD, f), 'utf8'));
const TR = require('../build/generate-romhack-trainers.js');
const EN = require('../build/generate-romhack-encounters.js');
const DA = require('../build/generate-romhack-data.js');
const GU = require('../build/generate-romhack-guides.js');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}
function throws(fn) { try { fn(); return false; } catch (e) { return true; } }

// ---- the split tabs: three layouts the reader missed before 5.64 --------------------------------------------
{
  const row = cells => { const r = new Array(17).fill(''); Object.keys(cells).forEach(k => { r[k] = cells[k]; }); return r.map(c => /[",\n]/.test(c) ? '"' + c + '"' : c).join(','); };
  const csv = [
    row({ 4: 'PLATINUM KAIZO - GALACTIC SPLIT' }),
    row({ 4: 'Lake Valor' }),
    row({ 4: 'Commander Mars (MULTI BATTLE with Galactic Terra)' }), row({}),
    row({ 4: 'LV 65 Hippowdon', 6: 'Lv 64 Garchomp', 16: 'Pokémon' }),
    row({ 4: 'Serious', 5: 'Sand Stream', 6: 'Bashful', 7: 'Rough Skin' }),
    row({ 1: 'AI Flags:', 4: 'White Herb', 6: 'Yache Berry' }),
    row({ 4: 'Stealth Rock', 6: 'Earthquake' }), row({}),
    row({ 4: 'GalacticF Cordelia (Cut Split)' }), row({}),
    row({ 4: 'Lv 92 Dusknoir' }),
    row({ 4: 'Modest', 5: 'Levitate' }),
    row({ 1: 'AI Flags:', 4: 'Leftovers' }),
    row({ 4: 'Gravity' }), row({}),
    row({ 4: 'CYRUS (SHADOW TAG)*' }), row({}),
    row({ 8: 'Lv 100 GIRATINA-ORIGIN' }),
    row({ 8: 'Hasty', 9: 'Levitate' }),
    row({ 1: 'AI Flags:', 8: 'Griseous Orb' }),
    row({ 8: 'Shadow Force' }),
  ].join('\n');
  let n = 0;
  const areas = TR.parsePKSplit(csv, 'Team Galactic split', (a, b) => a + '/' + b + '/' + (n++));
  const all = [];
  areas.forEach(a => a.trainers.forEach(t => all.push([a.name, t])));
  check(areas.length === 1 && areas[0].name === 'Lake Valor', 'the tab title is skipped and Lake Valor is the one area', areas.map(a => a.name).join(' | '));
  const mars = all.find(x => /Commander Mars/.test(x[1][1]));
  check(mars && mars[1][4].length === 2 && mars[1][4][0][1] === 'Hippowdon' && mars[1][4][0][2] === 65,
    'a team written "LV 65" is a trainer\'s team, not an area name (Commander Mars)', mars && JSON.stringify(mars[1][4][0]));
  check(all.some(x => x[1][1] === 'GalacticF Cordelia (Cut Split)'), 'a trainer named "(Cut Split)" is read, not skipped as a tab title');
  const cyrus = all.find(x => /CYRUS/.test(x[1][1]));
  check(cyrus && cyrus[1][4].length === 1 && cyrus[1][4][0][2] === 100 && JSON.stringify(cyrus[1][4][0][6]) === '["Shadow Force"]',
    'a one-Pokémon team centred in column I is read (Cyrus\'s Giratina)', cyrus && JSON.stringify(cyrus[1][4]));
}

// ---- AI flags from the split tab's icons --------------------------------------------------------------------
{
  const img = (id, size) => '<div><img src="https://docs.google.com/sheets-images-rt/' + id + '=' + size + '"/></div>';
  const lh = (id, size) => '<div><img src="https://lh3.googleusercontent.com/docsubipk/' + id + '=' + size + '"/></div>';
  const td = (inner, cls, span) => '<td class="' + (cls || 's1') + '"' + (span ? ' colspan="' + span + '"' : '') + '>' + inner + '</td>';
  const tr = cells => '<tr><th></th>' + cells.join('') + '</tr>';
  /* Key: icon A = Basic, B = Eval Att, C = Expert, W = Weather (the other host, with an "s81-" size), L = Left Side AI. */
  const html = '<style>.s1{background-color:#1f1f1f;}</style><table>' +
    tr([td('AI Flag Key:'), td(img('A', 'w81-h33')), td(img('B', 'w81-h33')), td(img('C', 'w82-h33')), td(lh('W', 's81-w81-h33')), td(img('L', 'w100-h33'))]) +
    tr([td('Basic'), td('Eval Att'), td('Expert'), td('Weather'), td('Left Side AI')]) +
    /* Trainer 1: Basic + Expert. */
    tr([td(''), td(img('T1', 'w38-h20')), td(''), td(''), td('Lass Natalie')]) +
    tr([td(''), td('AI Flags:', 's1', 3), td('Oran Berry')]) +
    /* Its first icon row has no icon; the second has both (School Kid Harrison's layout). A blank row ends the block. */
    tr([td(''), td(''), td(''), td(''), td('Toxic')]) +
    tr([td(''), td(img('A', 'w38-h20')), td(''), td(img('C', 'w38-h20')), td('Bite')]) +
    tr([td('')]) +
    /* Trainer 2: Eval Att + Weather (other host, smaller size) + Left Side AI. */
    tr([td(''), td(img('T2', 'w38-h20')), td(''), td(''), td('Galactic Io (DOUBLE)')]) +
    tr([td(''), td('AI Flags:', 's1', 3), td('Leftovers')]) +
    tr([td(''), td(img('B', 'w34-h20')), td(lh('W', 's38-w38-h20')), td(img('L', 'w38-h20')), td('Hail')]) +
    tr([td('')]) +
    '</table>';
  const flags = TR.parsePKFlags(html, 'test');
  /* Bits by hand: Basic 1 + Expert 4 = 5; Eval Att 2 + Weather 512 = 514. */
  check(flags.length === 2 && flags[0].name === 'Lass Natalie' && flags[0].bits === 5 && !flags[0].left, 'Basic and Expert icons read as flags 1 + 4 = 5', JSON.stringify(flags[0]));
  check(flags[1].bits === 514 && flags[1].left === true, 'an icon at another size is the same icon; Left Side AI is a tag, not a bit', JSON.stringify(flags[1]));
  const areas = [{ name: 'X', trainers: [[1, 'Lass Natalie', '', 0, []], [2, 'Maid Yoki', '', 0, []], [3, 'Galactic Io (DOUBLE)', '', 0, []]] }];
  const hidden = [];
  check(TR.addPKFlags(areas, flags, 'test', hidden) === 2 && areas[0].trainers[0][5] === 5 && areas[0].trainers[1][5] === undefined && areas[0].trainers[2][2] === 'Left Side AI',
    'a trainer on a row the sheet hides gets no flags; the rest line up by name', JSON.stringify(areas[0].trainers));
  check(hidden.length === 1 && /Maid Yoki/.test(hidden[0]), 'and the hidden trainer is reported', hidden.join());
  check(throws(() => TR.addPKFlags([{ name: 'X', trainers: [[1, 'Someone Else', '', 0, []]] }], flags, 'test', [])), 'an HTML trainer that matches nobody stops the build');
  const bad = html.replace('Basic</td>', 'Bassic</td>');
  check(throws(() => TR.parsePKFlags(bad, 'test')), 'an unknown flag name in the key stops the build');
}

// ---- the shipped trainers ------------------------------------------------------------------------------------
{
  const d = json('platinum-kaizo.trainers.json');
  const all = [];
  d.sections.forEach(s => s.areas.forEach(a => a.trainers.forEach(t => all.push(t))));
  const by = n => all.find(t => t[1] === n);
  /* Read off the Roark split: Youngster Tristan carries the Basic, Eval Att and Expert icons; Lass
     Natalie carries Basic and Expert. */
  check(by('Youngster Tristan') && by('Youngster Tristan')[5] === 7, 'Youngster Tristan: Basic, Eval Att, Expert (7)', by('Youngster Tristan') && by('Youngster Tristan')[5]);
  check(by('Lass Natalie') && by('Lass Natalie')[5] === 5, 'Lass Natalie: Basic, Expert (5)', by('Lass Natalie') && by('Lass Natalie')[5]);
  check(by('GalacticF Cordelia (Cut Split)') !== undefined, 'GalacticF Cordelia is in the data (dropped before 5.64)');
  const mars = all.filter(t => t[1] === 'Commander Mars (MULTI BATTLE with Galactic Terra)');
  check(mars.length === 1 && mars[0][4].length === 6 && mars[0][4][0][1] === 'Hippowdon', 'Commander Mars at Lake Valor has his six Pokémon, Hippowdon first', mars.length && mars[0][4].length);
  check(!d.sections.some(s => s.areas.some(a => /^Commander Mars|^Galactic Ganymede|^Galactic Proteus|^Barry \(TAG/.test(a.name))), 'no trainer is filed as an area name any more');
  check(all.filter(t => t[5] !== undefined).length === all.length - 1, 'every trainer but one has its flags', all.filter(t => t[5] === undefined).map(t => t[1]).join());
  /* Gardenia split: Floaroma Meadow holds Galactic Mercury, GalacticfTerra and Maid Yoki; Aroma Lady
     Taylor's moves end right above that area's name. */
  const area = (sec, name) => (d.sections.find(s => s.title === sec).areas.find(a => a.name === name) || { trainers: [] }).trainers.map(t => t[1]);
  check(area('Gardenia', 'Floaroma Meadow').join() === 'Galactic Mercury (B2B With Galactic Terra),GalacticfTerra (B2B With Galactic Mercury),Maid Yoki',
    'Floaroma Meadow keeps its three trainers', area('Gardenia', 'Floaroma Meadow').join());
  check(all.every(t => t[4].every(m => m[6].length <= 4)), 'no Pokémon has more than four moves (an area name is not a move)',
    all.filter(t => t[4].some(m => m[6].length > 4)).map(t => t[1]).join());
}

// ---- gifts, trades, statics, honey trees, the Great Marsh -------------------------------------------------------
{
  const e = json('platinum-kaizo.encounters.json');
  const area = n => e.areas.find(a => a.name === n);
  ['Trades', 'Gifts', 'Eggs', 'Veilstone Game Corner', 'Contest Hall rewards', 'Static encounters', 'Honey trees', 'Veilstone Dept. Store', 'Great Marsh: daily Pokémon']
    .forEach(n => check(area(n) !== undefined, 'Locations has "' + n + '"'));
  /* Non-Wild Encounters tab: Hearthome City gives an Eevee at Lv 20. */
  const hh = area('Gifts').methods.find(m => m.m === 'Hearthome City');
  check(hh && JSON.stringify(hh.rows[0]) === '[133,"Eevee",null,"20"]', 'Hearthome City gift: Eevee, Lv 20', hh && JSON.stringify(hh.rows));
  /* The Great Marsh picture: 7/32 + 3 x 3/32 + 6 x 2/32 + 4 x 1/32 = 32/32. Rates are rounded to 0.1. */
  const gm = area('Great Marsh: daily Pokémon').methods[0].rows;
  const total = gm.reduce((s, r) => s + r[2], 0);
  check(gm.length === 14 && Math.abs(total - 100) < 0.5, 'the Great Marsh\'s fourteen daily Pokémon add to 100%', gm.length + ' / ' + total);
  check(gm[0][1] === 'Carnivine' && gm[0][2] === 21.9, 'Carnivine is 7 in 32 (21.9%)');
  check(EN.pkNonWild().every(a => a.methods.every(m => m.rows.every(r => r[0] > 0))), 'every non-wild Pokémon resolves to a species');
  /* The guard: a name typed here that is no longer on its tab stops the build. */
  check(throws(() => EN.pkNonWildCheck({ pkNonWild: 'nothing here', pkUniversal: 'nor here' })), 'a transcribed name missing from its tab stops the build');
}

// ---- items ----------------------------------------------------------------------------------------------------
{
  const head = 'Item,,Location,Requirements,Obtained?\n';
  let body = 'Twinleaf Town,,,,\n,Rare Candy x20,Under Barry\'s bed,,FALSE\n,Odd Keystone,Between trees,Surf,FALSE\nRoute 201,,,,\n,Super Potion,Talk to mart employee,,FALSE\n';
  check(throws(() => DA.pkItemLocations(head + body)), 'an Item Sheet with too few items stops the build (the sheet has changed)');
  for (let i = 0; i < 300; i++) body += ',Potion,Somewhere ' + i + ',,FALSE\n';
  const L = DA.pkItemLocations(head + body);
  check(JSON.stringify(L.rows[1]) === '["Twinleaf Town","Odd Keystone","Between trees","Surf"]' && L.rows[2][0] === 'Route 201', 'an item row takes the area above it, and what it needs', JSON.stringify(L.rows.slice(0, 3)));
  let tut = 'Shard Tutors Price List\nRed,,,,,,,Green\n';
  for (let i = 0; i < 12; i++) tut += ',RedMove' + i + ',15,0,0,0,,,GreenMove' + i + ',0,15,0,0\n';
  const T = DA.pkShardTutors(tut);
  check(T.rows.length === 24 && JSON.stringify(T.rows[0]) === '["RedMove0","Red","15","0","0","0"]' && JSON.stringify(T.rows[12]) === '["GreenMove0","Green","0","15","0","0"]',
    'shard tutors: each price list is read seven columns apart', JSON.stringify(T.rows[12]));
  const d = json('platinum-kaizo.data.json');
  const sec = t => d.items.sections.find(s => s.title === t);
  /* Item Changes tab: Damp Rock goes from 3 to 7 extra turns; BrightPowder to ×0.89. */
  check(sec('Changed items') && sec('Changed items').rows.some(r => r[0] === 'Damp Rock' && /7 extra turns/.test(r[2])), 'Damp Rock: rain lasts 7 extra turns');
  check(sec('Changed items').rows.some(r => r[0] === 'BrightPowder' && /0\.89/.test(r[2])), 'BrightPowder: ×0.89');
  /* Item Sheet: Twinleaf Town, "Rare Candy x20", "Under Barry's bed". */
  check(sec('Where to find items') && sec('Where to find items').rows.some(r => r[0] === 'Twinleaf Town' && r[1] === 'Rare Candy x20' && /Barry's bed/.test(r[2])), 'Where to find items: 20 Rare Candies under Barry\'s bed');
  check(sec('Shard tutors') && sec('Shard tutors').rows.some(r => r[0] === 'Blast Burn' && r[2] === '15'), 'Shard tutors: Blast Burn for 15 red shards');
}

// ---- the guide ------------------------------------------------------------------------------------------------
{
  const faq = 'How do I play?\nWhat kind of quality-of-life features can I expect in Platinum Kaizo?\nPlatinum Kaizo implements the following quality-of-life features for players:\n' +
    Array.from({ length: 9 }, (_, i) => '* Feature ' + i + (i === 0 ? ' with the ‘R’\nButton in the summary screen.' : '')).join('\n') +
    '\nAre HMs required?\nYes, HMs are required.\nAre all 500+ enemies in Platinum Kaizo mandatory to defeat in order to progress?\nNo.\n' +
    'However, some Pokémon will be inaccessible. These include:\n' + Array.from({ length: 31 }, (_, i) => '* Mon' + i).join('\n') +
    '\nDoes the game have a mobile/pocket PC?\nNo pocket PC.\nWhat are the level caps for a Platinum Kaizo hardcore nuzlocke?\nThe level caps are as follows:\n' +
    '* Roark: 16\n* Gardenia: 28\n* Fantina: 38\n* Barry #3: 42\n* Maylene: 47\n* Wake: 54\n* Barry #5: 63\n* Byron: 65\n* Candice: 74\n* Volkner: 84\n* Elite Four / Mt. Coronet: 100\nSoft caps.\n' +
    'Will you be providing documentation on release?\nYes.\nCan I save state pre-starter selection for my Nuzlocke?\nNo save states.\nHow does the Piplup Waterfall mechanic work? Will I be able to use Waterfall as soon as I can reach a waterfall with Surf?\nPiplup gets Waterfall.\n' +
    'Do I have to stream my run to get into the Hall of Fame?\nStream it.\nHow do I pre-status in PlatKaizoHeX?\nLike this.';
  const F = GU.pkFromFaq(faq);
  check(JSON.stringify(F.caps[0]) === '["Roark",16]' && F.caps.length === 11 && F.caps[10][0] === 'Elite Four / Mt. Coronet', 'FAQ: eleven level caps, Roark 16 first', JSON.stringify(F.caps.slice(0, 2)));
  check(F.qol[0] === 'Feature 0 with the ‘R’ Button in the summary screen.', 'FAQ: a bullet that wraps onto the next line is one bullet', F.qol[0]);
  check(F.missing.length === 31 && F.capNotes.join() === 'Soft caps.', 'FAQ: the Pokémon you cannot get, and the note under the caps');
  check(throws(() => GU.pkFromFaq(faq.replace('What are the level caps', 'Level caps?'))), 'a FAQ that no longer asks about level caps stops the build');
  const g = json('platinum-kaizo.guide.json');
  const caps = g.sections.find(s => s.id === 'caps');
  /* The authors' FAQ, read by hand: 16, 28, 38, 42, 47, 54, 63, 65, 74, 84, 100. */
  check(caps && caps.table.rows.map(r => r[1]).join() === '16,28,38,42,47,54,63,65,74,84,100', 'the guide\'s level caps are the FAQ\'s', caps && caps.table.rows.map(r => r[1]).join());
  const rules = g.sections.find(s => s.id === 'rules');
  check(rules && rules.groups.some(x => x.h === 'Encounter Rules') && rules.groups.some(x => x.h === 'Battle Rules'), 'the guide carries the Hall of Fame rules');
  check(rules && /generative AI/.test(rules.paras.join(' ')), 'and shows the rule on AI planning tools above the rest');
  const setup = g.sections.find(s => s.id === 'setup');
  check(setup && setup.list.some(x => /0862ec35b24de5c7e2dcb88c9eea0873110d755c/.test(x)), 'setup names the ROM\'s SHA-1 from the FAQ');
}

// ---- the Run tracker ------------------------------------------------------------------------------------------
{
  const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
  const consts = src.match(/const RUN_ALIVE=[^\n]*\n/)[0] + src.match(/const RUN_OWNED=[^\n]*\n/)[0];
  /* Starly 396 > Staravia 397 > Staraptor 398; Burmy 412 > Wormadam 413 or Mothim 414. */
  const R = (0, eval)('var HD={evo:{396:[[397,["Lv 14"]]],397:[[398,["Lv 34"]]],412:[[413,["Lv 20"]],[414,["Lv 20"]]]}};function hackData(){return HD}' +
    'var master=[{id:122,name:"mr-mime"},{id:403,name:"shinx"},{id:29,name:"nidoran-f"}];' + consts +
    fnSrc('runFamily') + fnSrc('runAreaRows') + fnSrc('runSpeciesId') + fnSrc('runDupeOf') + ';({runFamily,runSpeciesId,runDupeOf})');
  check(R.runFamily(398) === 396 && R.runFamily(396) === 396, 'Staraptor\'s family is Starly\'s');
  check(R.runFamily(413) === 412 && R.runFamily(414) === 412, 'Wormadam and Mothim are one family (the rules\' own example)');
  const run = { enc: { 'Route 201': { id: 396, s: 'caught' }, 'Route 202': { id: 413, s: 'dead' }, 'Route 203': { id: 403, s: 'missed' } } };
  check(R.runDupeOf(run, 'Route 204', 398) === 'Route 201', 'a Staraptor is a duplicate of the Starly caught on Route 201');
  check(R.runDupeOf(run, 'Route 204', 414) === 'Route 202', 'a dead Pokémon still counts for the duplicate clause');
  check(R.runDupeOf(run, 'Route 204', 403) === '', 'a missed encounter does not');
  check(R.runDupeOf(run, 'Route 201', 396) === '', 'an area is not a duplicate of itself');
  const area = { methods: [{ rows: [[396, 'Starly', 30, '3']] }] };
  check(R.runSpeciesId('starly', area) === 396 && R.runSpeciesId('Mr. Mime', null) === 122 && R.runSpeciesId('', area) === 0, 'a typed name finds its species: from the area first, then the whole dex');
}

// ---- the AI page ----------------------------------------------------------------------------------------------
{
  const ai = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'ai-docs.json'), 'utf8'));
  const g4 = ai.engines.gen4;
  const rule = fn => g4.switchRules.find(r => r.fn === fn);
  /* pokeplatinum AI_OnlyIneffectiveMoves: a second pass, "effectiveness == 0 && ... % 2 == 0". */
  check(/neutral/.test(rule('AI_OnlyIneffectiveMoves').text) && /1 in 2/.test(rule('AI_OnlyIneffectiveMoves').text), 'nothing-works: the second, neutral-move pass (1 in 2) is described');
  /* AI_IsAsleepWithNaturalCure calls the partner check with rand 1: "% 1 == 0" is always true. */
  check(/ALWAYS/.test(rule('AI_IsAsleepWithNaturalCure').text), 'Natural Cure: the partner switch is certain, not half the time');
  check(Array.isArray(g4.items) && g4.items.some(x => /Full Restore: below 1\/4 HP/.test(x)), 'the item AI is described');
  check(Array.isArray(g4.playbook) && g4.playbook.length >= 5, 'and a playbook turns the rules into what to do');
  check(/Left Side/.test(ai.hacks['platinum-kaizo'].changesNote) && /icons/.test(ai.hacks['platinum-kaizo'].flagSource), 'Platinum Kaizo: the pinned Left Side AI note, and where the flags come from');
}

// ---- the changes, made obvious (5.65) -------------------------------------------------------------------------
/* "make the changes more obvious and clear", from Magcargo's page. Platinum Kaizo, Mastersheet Personal
   tab: Magcargo 70/80/120/109/100/30, Drought / Solid Rock; Platinum: 50/50/120/80/80/30, Magma Armor /
   Flame Body. Expected values worked out by hand from those two lines. */
{
  const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
  const line = re => src.match(re)[0] + '\n';
  const H = (0, eval)('var isRomHack=true;var HD={base:{219:[["fire","rock"],[50,50,120,80,80,30],["magma-armor","flame-body",""]]}};' +
    'var REC={219:[["fire","rock"],[70,80,120,109,100,30],["drought","solid-rock",""]],1:[["grass","poison"],[45,49,49,65,65,45],["overgrow",""]]};' +
    'function hackData(){return HD}function hackRec(i){return REC[i]||null}function hackBaseLabel(){return "Platinum"}function romHack(){return {label:"Platinum Kaizo"}}' +
    'function capName(s){return s.replace(/-/g," ").replace(/\\b\\w/g,function(c){return c.toUpperCase()})}function hackCustomAbility(){return null}function hackAbilityLabel(x){return x}' +
    'var hackEsc=function(x){return String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;")};' +
    line(/const HACK_STAT_LABEL=[^\n]*/) + line(/const HACK_STAT_KEYS=[^\n]*/) +
    ['hackStatBase', 'hackDelta', 'hackAbilityNames', 'hackAbilitiesWas', 'hackChangesHtml'].map(fnSrc).join('') +
    ';({hackStatBase,hackDelta,hackAbilitiesWas,hackChangesHtml})');
  check(JSON.stringify(H.hackStatBase(219)) === '[50,50,120,80,80,30]', 'the stat bars get Platinum\'s values to mark');
  check(H.hackStatBase(1) === null, 'a species the hack did not change gets no marks');
  check(/class="hk-delta up">\+20</.test(H.hackDelta(20)) && /class="hk-delta down">−18</.test(H.hackDelta(-18)) && H.hackDelta(0) === '', 'a rise is green and +, a fall red and −, no change shows nothing');
  check(/Was Magma Armor \/ Flame Body in Platinum/.test(H.hackAbilitiesWas(219)), 'the old abilities are named under the new ones', H.hackAbilitiesWas(219));
  const box = H.hackChangesHtml(219);
  /* Total: 50+50+120+80+80+30 = 410 before, 70+80+120+109+100+30 = 509 after, +99. */
  check(/>HP<\/td><td class="hk-old">50<\/td>.*?<td class="hk-new">70<\/td><td><span class="hk-delta up">\+20</.test(box), 'the box has a row per change: HP 50 → 70, +20');
  check(/>Total<\/td><td class="hk-old">410<\/td>.*?>509<\/td><td><span class="hk-delta up">\+99</.test(box), 'and the total: 410 → 509, +99');
  check(!/>Defense</.test(box) && !/>Speed</.test(box), 'an unchanged stat is not listed');
}

// ---- the PChal calculator's Pokédex, as a model (5.65) -----------------------------------------------------------
/* "take inspiration from this page that pchal references constantly": anastarawneh's Platinum Kaizo
   calculator, Pokédex tab, on stream. Lucario: "Gender: 87.5% Male, 12.5% Female", "Experience Group:
   Medium Slow", "Catch Rate: 59", "Evolves from Riolu at level 36", ExtremeSpeed 8 PP. Magcargo:
   "Gender: 50% Male, 50% Female", "Medium Fast", "Catch Rate: 46". */
{
  const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
  const sp = json('platinum-kaizo.json');
  check(sp.facts && sp.facts[448][0] === 59 && sp.facts[448][2] === 31 && sp.facts[448][3] === 'Medium Slow', 'Lucario: catch rate 59, gender byte 31, Medium Slow', sp.facts && JSON.stringify(sp.facts[448]));
  check(sp.facts[219][0] === 46 && sp.facts[219][2] === 127 && sp.facts[219][3] === 'Medium Fast', 'Magcargo: catch rate 46, half and half, Medium Fast', JSON.stringify(sp.facts[219]));
  const F = (0, eval)('var isRomHack=true;var HACK={species:{447:1,448:1},facts:{448:[59,204,31,"Medium Slow",["",""],["Field","Human-Like"]],113:[30,255,254,"Fast",["Lucky Egg","Lucky Egg"],["Fairy"]]}};' +
    'var HD={evo:{447:[[448,["Lv 36"]]]}};function hackData(){return HD}function dexRec(i){return {name:{447:"riolu",448:"lucario"}[i]}}function pokeName(s){return s}' +
    'var hackEsc=function(x){return String(x)};' + ['hackGenderText', 'hackFactsHtml', 'hackEvoText'].map(fnSrc).join('') + ';({hackGenderText,hackFactsHtml,hackEvoText})');
  /* The game stores 31 for 1 female in 8: (31 + 1) / 256 = 12.5%. */
  check(F.hackGenderText(31) === '87.5% male, 12.5% female' && F.hackGenderText(127) === '50% male, 50% female', 'gender reads as the calculator writes it');
  check(F.hackGenderText(255) === 'Genderless' && F.hackGenderText(254) === 'Always female' && F.hackGenderText(0) === 'Always male', 'and the three fixed cases');
  check(/Catch rate<\/span>59/.test(F.hackFactsHtml(448)) && /Field, Human-Like/.test(F.hackFactsHtml(448)) && !/Wild item/.test(F.hackFactsHtml(448)), 'the facts block, with no wild item when it has none');
  check(/Wild item<\/span>Lucky Egg \(always\)/.test(F.hackFactsHtml(113)), 'the same item in both slots is always held');
  check(F.hackEvoText(448) === '<div class="hk-evo">Evolves from Riolu at level 36</div>', 'evolution in words: from Riolu at level 36', F.hackEvoText(448));
  check(/Evolves into Lucario at level 36/.test(F.hackEvoText(447)), 'and the other way round');
  check(/if\(isRomHack\)\{const r=getFormGenRange\(f\.name\);if\(r&&!r\.available\(genNum\)\)return false\}/.test(src), 'a forme the hack\'s game does not have (a Mega in a Gen IV hack) is left out');
  check(/data-k="pp"[^>]*>PP<\/th>/.test(src) && /data-pp="'\+\(getMovePPForGen\(md\)\|\|''\)\+'"/.test(src), 'the move list has a PP column');
}

// ---- an opened trainer (5.66) ----------------------------------------------------------------------------------
/* "i dont like how the trainer looks when you click in", "no @ silk scarf just list the item", "make
   everything easier to read, more color, sprites", "less lines text". Youngster Tristan's Zigzagoon, from
   the Roark split: Lv 5, Silk Scarf, Gluttony, Hasty, Quick Attack and Sand Attack. */
{
  const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
  const T = (0, eval)('var TC={normal:"#A8A878",ground:"#E0C068"};function spriteFor(i){return "s"+i+".png"}function getDataGenNum(){return 4}' +
    'function hackRec(i){return i===263?[["normal"],[],[]]:null}function hackMove(s){return {"quick-attack":["normal","physical",40],"sand-attack":["ground","status",0]}[s]||null}' +
    'function typeBadge(t){return "<i>"+t+"</i>"}var hackEsc=function(x){return String(x)};' +
    src.match(/const AI_CHIP=[\s\S]*?\};\n/)[0] + 'var aiDocs={engines:{gen4:{flags:[{bit:0,key:"basic",name:"Avoid bad moves"},{bit:1,key:"evalAttack",name:"Go for the knockout"},{bit:2,key:"expert",name:"Expert"}]}}};' +
    fnSrc('aiFlagNames') + fnSrc('trainerAIChips') + fnSrc('trainerSetHtml') + ';({trainerAIChips,trainerSetHtml})');
  const card = T.trainerSetHtml([263, 'Zigzagoon', 5, 'Silk Scarf', 'Gluttony', 'Hasty', ['Quick Attack', 'Sand Attack']]);
  check(!/@/.test(card) && /class="tr-pill it" title="Item">Silk Scarf</.test(card), 'the item is its own pill, with no "@"');
  check(/title="Ability">Gluttony</.test(card) && /title="Nature">Hasty</.test(card), 'ability and nature are pills on the same row');
  check(/<img src="s263\.png"/.test(card) && /<i>normal<\/i>/.test(card), 'the card has the sprite and the hack\'s types');
  check(/background:#A8A87822[^>]*>[\s\S]*?Quick Attack<\/span><small>40</.test(card) && /Sand Attack<\/span><small>Status</.test(card), 'each move is coloured by its type and shows its power, or Status');
  /* Tristan's flags are 7: Basic, KO and Expert. */
  const chips = T.trainerAIChips(7);
  check((chips.match(/class="tr-aic"/g) || []).length === 3 && />KO</.test(chips) && /title="Go for the knockout"/.test(chips), 'AI flags are three short chips, the full name on hover');
  check(/No AI/.test(T.trainerAIChips(0)) && T.trainerAIChips(undefined) === '', 'no flags says so; unknown flags show nothing');
  check(!/<textarea class="tr-note" style="display:block;margin:4px 0 8px"/.test(src) && /class="tr-note tr-show-sm"/.test(src), 'the opened trainer no longer repeats the notes box (except on a phone)');
}

// ---- every tab's look (5.67) ----------------------------------------------------------------------------------
/* "yes do all the tabs": item pictures, coloured encounter methods, chips tinted by type. */
{
  const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
  const L = (0, eval)('var TC={grass:"#8BC34A",normal:"#A8A878"};function hackRec(i){return i===1?[["grass","poison"],[],[]]:null}function dexRec(i){return i===16?{types:[{type:{name:"normal"}}]}:null}' +
    ['monTint', 'itemSprite', 'encMethodColor'].map(fnSrc).join('') + ';({monTint,itemSprite,encMethodColor})');
  const slug = h => (h.match(/items\/([^".]+)\.png/) || [])[1];
  /* PokéAPI's item pictures are named in lower case with hyphens: rare-candy, poke-ball, ragecandybar. */
  check(slug(L.itemSprite('Rare Candy x20')) === 'rare-candy', 'an item\'s count is not part of its picture name');
  check(slug(L.itemSprite('Poké Ball x20')) === 'poke-ball' && slug(L.itemSprite('Shoal Shell → RageCandyBar')) === 'ragecandybar', 'accents go, and a renamed item shows its new self');
  check(L.itemSprite('TM10 - Hidden Power') === '' && L.itemSprite('$100,000') === '', 'TMs and money get no picture');
  check(L.encMethodColor('Surf') === '#6890F0' && L.encMethodColor('Night') === '#705898' && L.encMethodColor('Super Rod') === '#3FA7B8' && L.encMethodColor('Grass') === '#78C850', 'each method has its colour');
  check(/#8BC34A/.test(L.monTint(1)) && /#A8A878/.test(L.monTint(16)) && L.monTint(0) === '', 'a chip is tinted by the hack\'s first type, else the game\'s');
  check(/const byArea=sec\.cols\[0\]==='Area';/.test(src), 'an item table by area draws each area once, as a header');
}

// ---- the tabs -------------------------------------------------------------------------------------------------
{
  const all = JSON.parse(src.match(/const ALL_TABS=(\[[^\]]*\]);/)[1].replace(/'/g, '"'));
  check(all.includes('guide') && all.includes('run'), 'Guide and Run are tabs');
  check(/guide:\{hackOnly:true\}/.test(src) && /run:\{hackOnly:true\}/.test(src), 'both only in a ROM hack');
  check(!/\['pokedex','types','abilities','items','tms','trainers','ai','locations','evs','natures','other','team','calc'\]/.test(src), 'no copy of the old tab list is left');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
