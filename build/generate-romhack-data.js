#!/usr/bin/env node
/* HoopaDex — ROM hacks, phase 2: each hack's own moves, learnsets and evolutions
 * Run: node build/generate-romhack-data.js          (fetch every source, write app/hacks/*.data.json)
 *      node build/generate-romhack-data.js --check  (fetch again, exit 1 if any file is stale)
 *
 * Asked for from the live site: "other rom hacks might have different stats/abilities/moves etc than
 * base game", "we need learn sets and evolution", and "we need the other tabs like items, moves,
 * abilities, even if lots of them are the same as base there will be some changes".
 *
 * Phase 1 (build/generate-romhacks.js) wrote each hack's types, stats and abilities. This file writes,
 * for every hack and variant, one more file the app loads when the hack is chosen:
 *   moves     every move in the hack, with the hack's type, category, power, accuracy, PP and priority,
 *             and whether the hack changed it from its base game
 *   machines  the hack's TM/HM list, where the hack has one
 *   learn     each species' level-up moves and TM/tutor moves
 *   evo       each species' evolutions, and how - in the app's own wording ("Lv 16", "Fire Stone")
 *
 * Sources. The author's own data wherever it exists; where the author lists only CHANGES, the base game
 * is read from PokeAPI's own CSV tables and the documented changes are applied on top:
 *
 *   hack                moves                          learnsets                            evolutions
 *   Renegade Platinum   USUM values + Move Changes     Pokémon Changes (every species) +    Platinum +
 *                       doc (Drayano)                  TM rule from Item Changes            Evolution Changes doc
 *   Sacred Gold         Black/White values + doc       HG/SS + Pokemon Changes doc          HG/SS + Evolution
 *                       lines (Drayano)                (Classic: HG/SS unchanged)           Changes doc
 *   Platinum Kaizo      Mastersheet "Moves" tab        Mastersheet learnset tabs            Mastersheet "Evolutions"
 *   Run & Bun           battle_moves.h (dekzeh)        level_up / teachable learnsets .h    evolution.h
 *   Emerald Kaizo       emerald-kaizo-db moves.json    emerald-kaizo-db pkmn.json           Emerald (none documented)
 *   FireRed Omega       FR/LG + calc data (type, BP)   calc data learnset_info              FR/LG (none documented)
 *
 * Every file carries its cross-checks: the move table against the hack's calculator data, and where
 * the author lists changes, that each listed change really is a change. A learnset source with no
 * second source says so in the file; it is not quietly called checked.
 */
const fs = require('fs');
const path = require('path');
const RH = require('./generate-romhacks.js');
const { calcObj, flat, speciesId, SPECIES, typeName, csvRows } = RH;
/* RH_CACHE=<dir> keeps each download on disk between runs while a parser is being written. Never set
   in CI or by publish.sh: the drift check must read the sources as they are now. */
async function get(url) {
  const dir = process.env.RH_CACHE;
  if (!dir) return RH.get(url);
  const f = path.join(dir, require('crypto').createHash('sha1').update(url).digest('hex'));
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const t = await RH.get(url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, t);
  return t;
}
/* "???" is Curse's type in Generations II-IV. The app writes it "unknown", as PokeAPI does. */
const moveType = t => (/^\?{3,4}$/.test(String(t).trim()) ? 'unknown' : typeName(t));   // FireRed Omega's data writes it "????"

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const OUTDIR = path.join(ROOT, 'app', 'hacks');
const PA = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';
const SRC = {
  rpChanges: RH.URL.rpChanges,
  rpMoves: 'https://pastebin.com/raw/Ur87jDbq',
  rpItems: 'https://pastebin.com/raw/JNtXXuwC',
  /* Drayano's Evolution Changes document is not on his pastebin account; this is the copy shipped
     with the hack's documentation folder, archived with the Renegade Platinum wiki (MIT). */
  rpEvo: 'https://raw.githubusercontent.com/zhenga8533-archive/renegade-platinum-wiki/main/data/documentation/Evolution%20Changes.txt',
  rpCalc: RH.URL.rpCalc,
  sgChanges: RH.URL.sgChanges,
  sgEvo: 'https://raw.githubusercontent.com/zhenga8533-archive/sgss-wiki/main/data/documentation/Evolution%20Changes.txt',
  sgItems: 'https://raw.githubusercontent.com/zhenga8533-archive/sgss-wiki/main/data/documentation/Item%20Locations.txt',
  sgCalc: RH.URL.sgCalc,
  sgFairy: RH.URL.sgFairy,
  pkMoves: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=1144076770',
  pkMoveChanges: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=605673371',
  pkLevel: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=694053409',
  pkTM: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=1644203504',
  pkEvo: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=1172055843',
  rbMoves: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/moves/battle_moves.h',
  rbLevel: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/species/level_up_learnsets.h',
  rbLevelPtr: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/species/level_up_learnset_pointers.h',
  rbTeach: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/species/teachable_learnsets.h',
  rbTeachPtr: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/species/teachable_learnset_pointers.h',
  rbEvo: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/species/evolution.h',
  rbSpecies: RH.URL.rbSpecies,
  rbCalc: RH.URL.rbCalc,
  ekDb: RH.URL.ekDb,
  ekMoves: 'https://raw.githubusercontent.com/Isotarge/emerald-kaizo-db/main/src/moves.json',
  ekState: 'https://raw.githubusercontent.com/Isotarge/emerald-kaizo-db/main/src/state.js',
  ekCalc: RH.URL.ekCalc,
  froCalc: RH.URL.froCalc,
  paPokemonMoves: PA + 'pokemon_moves.csv',
  paMachines: PA + 'machines.csv',
  paMoves: PA + 'moves.csv',
  paEvolution: PA + 'pokemon_evolution.csv',
  paSpecies: PA + 'pokemon_species.csv',
  paItemNames: PA + 'item_names.csv',
  paItems: PA + 'items.csv',
  paLocations: PA + 'locations.csv',
};
const VG = { emerald: 6, 'firered-leafgreen': 7, platinum: 9, 'heartgold-soulsilver': 10, 'black-white': 11, 'ultra-sun-ultra-moon': 18, 'sword-shield': 20 };

// ---- CSV ------------------------------------------------------------------------------------------
function csvObjs(txt) {
  const rows = csvRows(txt);
  const h = rows[0].map(s => s.trim());
  return rows.slice(1).filter(r => r.length > 1).map(r => { const o = {}; h.forEach((k, i) => { o[k] = r[i] === undefined ? '' : r[i]; }); return o; });
}
/* pokemon_moves.csv is 10 MB; it is read line by line, keeping only the version groups used here. */
function pokemonMovesByVg(txt, vgs) {
  const want = new Set(vgs.map(String));
  const out = {};
  vgs.forEach(v => { out[v] = { lv: {}, machine: {}, tutor: {} }; });
  const lines = txt.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i].split(',');
    if (c.length < 5 || !want.has(c[1])) continue;
    const pid = +c[0];
    if (pid > 1025) continue;                                  // species only; forms are a later phase
    const t = out[c[1]], mid = +c[2], meth = c[3];
    if (meth === '1') (t.lv[pid] = t.lv[pid] || []).push([+c[4], mid, +c[5] || 0]);
    else if (meth === '4') (t.machine[pid] = t.machine[pid] || new Set()).add(mid);
    else if (meth === '3') (t.tutor[pid] = t.tutor[pid] || new Set()).add(mid);
  }
  return out;
}

// ---- moves: names ----------------------------------------------------------------------------------
const MIDX = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'moves-index.json'), 'utf8')).moves;
const MROW = {};
const moveByFlat = {};
MIDX.forEach(r => { MROW[r[0]] = r; moveByFlat[flat(r[0])] = r[0]; });
/* Spellings the games used before a move was renamed, or that a source abbreviates. Each one is the
   same move under PokeAPI's current name; nothing here maps one move onto a different one. */
const MOVE_ALIASES = {
  hijumpkick: 'high-jump-kick', faintattack: 'feint-attack', visegrip: 'vice-grip', smellingsalt: 'smelling-salts',
  selfdestruct: 'self-destruct', softboiled: 'soft-boiled', doubleslap: 'double-slap', thunderpunch: 'thunder-punch',
  solarbeam: 'solar-beam', ancientpower: 'ancient-power', dynamicpunch: 'dynamic-punch', extremespeed: 'extreme-speed',
  thundershock: 'thunder-shock', poisonpowder: 'poison-powder', sandattack: 'sand-attack', bubblebeam: 'bubble-beam',
  dragonbreath: 'dragon-breath', featherdance: 'feather-dance', grasswhistle: 'grass-whistle', conversion2: 'conversion-2',
  smokescreen: 'smokescreen', willowisp: 'will-o-wisp', lockon: 'lock-on', mudslap: 'mud-slap', xscissor: 'x-scissor',
  uturn: 'u-turn', vcreate: 'v-create', kingsshield: 'kings-shield', forestscurse: 'forests-curse',
  hiddenpower: 'hidden-power', highhorsepower: 'high-horsepower',
  // Misspellings in a source, each the only move it can mean:
  twinneedle: 'twineedle',       // Renegade Platinum's Pokémon Changes, Beedrill line
  xscissors: 'x-scissor',        // emerald-kaizo-db moves.json and pkmn.json
};
Object.entries(MOVE_ALIASES).forEach(([k, v]) => { if (!MROW[v]) throw new Error('MOVE_ALIASES: ' + k + ' -> ' + v + ' is not a PokeAPI move'); });
/* Z-Moves are in Run & Bun's move table but no Pokémon learns one; PokeAPI files the generic ones
   as "<name>--physical" / "--special", which is how they are recognised and left out. */
const isZMove = name => !!moveByFlat[flat(String(name).replace(/^MOVE_/, '')) + 'physical'];
const unresolvedMoves = {};
/* A move name from a source -> PokeAPI slug. A hack's own new moves (Platinum Kaizo has some) come in
   through `custom`; anything else unknown is collected and stops the build, never dropped. */
function moveSlug(name, custom, where) {
  if (name === undefined || name === null) return null;
  const s = String(name).trim();
  if (!s || s === '-' || /^none$/i.test(s)) return null;
  const f = flat(s.replace(/^MOVE_/, ''));
  if (custom && custom[f]) return custom[f];
  const hit = moveByFlat[f] || MOVE_ALIASES[f];
  if (hit) return hit;
  if (/^hiddenpower/.test(f)) return 'hidden-power';
  (unresolvedMoves[where] = unresolvedMoves[where] || new Set()).add(s);
  return null;
}
const titleWords = s => String(s).toLowerCase().replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());

// ---- moves: values for a base generation, read through the app's own functions -----------------------
function appMoves() {
  const src = fs.readFileSync(APP, 'utf8');
  const lines = src.split(/\r?\n/);
  const line = s => { const i = lines.findIndex(x => x.startsWith(s)); if (i < 0) throw new Error('missing ' + s); return lines[i]; };
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('missing ' + a); return src.slice(i, j); };
  const fn = n => cut('function ' + n + '(', '\n}\n') + '\n}\n';
  const code = 'var BASEGEN=9;function getDataGenNum(){return BASEGEN}function champFor(){return undefined}function champMoveOverride(){return undefined}function hackMove(){return null}\n' +
    line('const VG_GEN=') + '\n' + line('const MOVE_GEN_FIX=') + '\n' + line('const MOVE_GAME_FIX=') + '\n' + line('const CHAMP_PP=') + '\n' +
    line('const PHYSICAL_TYPES=') + '\n' + line('const PRIORITY_MOVES=') + '\n' +
    fn('movePastValues') + fn('makeMoveRecord') + fn('expandMoveRow') + fn('pastValueForGen') + fn('movePastField') + fn('moveValueFix') +
    fn('champInGamePP') + fn('getMovePowerForGen') + fn('getMoveAccForGen') + fn('getMovePPForGen') + fn('getMoveTypeForGen') + fn('getMoveCatForGen') +
    ';({setGen(g){BASEGEN=g},makeMoveRecord,expandMoveRow,getMovePowerForGen,getMoveAccForGen,getMovePPForGen,getMoveTypeForGen,getMoveCatForGen,PRIORITY_MOVES})';
  return (0, eval)(code);
}
const AM = appMoves();
/* Priority by generation: PokeAPI has only today's (Protect +4, Teleport -6). The app's Move Priority
   table (build/generate-priority.js, from Showdown's per-generation files) has every move whose
   priority was ever not 0, per generation; a move it does not list was 0 throughout. Without this,
   Platinum Kaizo's sheet - which gives Platinum's +3 for Protect - read as a change. */
const PRIO = {}; AM.PRIORITY_MOVES.forEach(r => { PRIO[r[0]] = r[3]; });
const priorityIn = (slug, g) => { const p = PRIO[slug]; return p && p[g - 1] !== null && p[g - 1] !== undefined ? p[g - 1] : 0; };
/* [type, category, power, accuracy, pp, priority] for a move as the app shows it in generation g. */
function baseMove(slug, g) {
  const r = MROW[slug];
  if (!r) throw new Error('no move ' + slug);
  AM.setGen(g);
  const md = AM.makeMoveRecord(AM.expandMoveRow(r));
  return [AM.getMoveTypeForGen(md), AM.getMoveCatForGen(md), setInBattle(AM.getMovePowerForGen(md, g) || 0), AM.getMoveAccForGen(md, g) || 0, AM.getMovePPForGen(md, g) || 0, priorityIn(slug, g)];
}
const introGen = slug => { const g = MROW[slug] && MROW[slug][8]; const m = g && g.match(/generation-(\w+)/); return m ? { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 }[m[1]] : 99; };
/* The moves a main-series game of generation g had: Colosseum and XD's Shadow moves are filed under
   Generation III in PokeAPI and were never in a main-series game. */
const genMoveList = g => MIDX.filter(r => r[1] !== 'shadow' && introGen(r[0]) <= g).map(r => r[0]);
/* A ROM stores power 1 for a move whose power the battle code works out (Low Kick, Seismic Toss);
   the app writes that as 0, as PokeAPI does. */
const setInBattle = p => (p === 1 ? 0 : p);
const physicalByType = t => ['normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel'].includes(t) ? 'physical' : 'special';
const MOVE_FIELDS = ['type', 'category', 'power', 'accuracy', 'pp', 'priority'];
/* A hack's move record: the six values, then [changed fields], then the hack's own effect text or null,
   then the base game's six values when anything changed (null for an unchanged move, and for a move
   the base game did not have). Platinum Kaizo's Rollout is Rock-type, 40 power, +1 priority - it is
   Accelerock in all but name - and the base values are what let the app say what it was before. */
function moveRec(vals, base, note) {
  const changed = base ? MOVE_FIELDS.filter((f, i) => vals[i] !== base[i]) : MOVE_FIELDS.slice();
  return vals.concat([changed, note || null, base && changed.length ? base.slice() : null]);
}

// ---- evolutions ----------------------------------------------------------------------------------------
let EVO_DATA = null;
function loadEvoData(T) {
  const sp = {}; csvObjs(T.paSpecies).forEach(r => { sp[r.id] = { from: +r.evolves_from_species_id || 0, gen: +r.generation_id }; });
  const itemName = {}; csvObjs(T.paItemNames).forEach(r => { if (r.local_language_id === '9') itemName[r.item_id] = r.name; });
  const itemId = {}; csvObjs(T.paItems).forEach(r => { itemId[r.id] = r.identifier; });
  const loc = {}; csvObjs(T.paLocations).forEach(r => { loc[r.id] = r.identifier; });
  const moveName = {}; csvObjs(T.paMoves).forEach(r => { moveName[r.id] = r.identifier; });
  EVO_DATA = { sp, itemName, itemId, loc, moveName, rows: csvObjs(T.paEvolution) };
}
const ITEM_INTRO_GEN = { 'ice-stone': 7, 'sweet-apple': 8, 'tart-apple': 8, 'cracked-pot': 8, 'chipped-pot': 8, 'galarica-cuff': 8, 'galarica-wreath': 8,
  'razor-claw': 4, 'razor-fang': 4, 'oval-stone': 4, 'dusk-stone': 4, 'dawn-stone': 4, 'shiny-stone': 4, 'protector': 4, 'electirizer': 4, 'magmarizer': 4,
  'dubious-disc': 4, 'reaper-cloth': 4, 'prism-scale': 5 };
const TYPE_NAMES = { 1: 'normal', 2: 'fighting', 3: 'flying', 4: 'poison', 5: 'ground', 6: 'rock', 7: 'bug', 8: 'ghost', 9: 'steel', 10: 'fire', 11: 'water', 12: 'grass', 13: 'electric', 14: 'psychic', 15: 'ice', 16: 'dragon', 17: 'dark', 18: 'fairy' };
const pokeTitle = id => { const r = SPECIES.find(x => x[0] === id); return r ? titleWords(r[1].replace(/-/g, ' ')) : '#' + id; };
/* One PokeAPI evolution row -> the app's wording (parseChain() in app/index.html writes the same). */
function evoText(r) {
  const D = EVO_DATA, parts = [];
  const item = id => (D.itemName[id] || titleWords((D.itemId[id] || '').replace(/-/g, ' '))).replace(/’/g, '\'');   // King's Rock, as the docs write it
  const trig = r.evolution_trigger_id;
  if (trig === '1') {
    if (r.minimum_level) parts.push('Lv ' + r.minimum_level);
    else if (r.minimum_happiness && r.time_of_day) parts.push('Happiness\n(' + titleWords(r.time_of_day) + ')');
    else if (r.minimum_happiness) parts.push('Happiness');
    else if (r.known_move_id) parts.push('Know ' + titleWords(D.moveName[r.known_move_id].replace(/-/g, ' ')));
    else if (r.known_move_type_id) parts.push(titleWords(TYPE_NAMES[r.known_move_type_id]) + ' Move\n+ Friendship');
    else if (r.location_id) {
      const l = D.loc[r.location_id] || '';
      if (/eterna|pinwheel|route-20/.test(l)) parts.push('Moss Rock');
      else if (/route-217|twist|frost/.test(l)) parts.push('Ice Rock');
      else parts.push('At ' + titleWords(l.replace(/-/g, ' ')));
    } else if (r.minimum_beauty) parts.push('Beauty ' + r.minimum_beauty);
    else if (r.party_species_id) parts.push('With ' + pokeTitle(+r.party_species_id) + ' in party');
    else parts.push('Level Up');
    if (r.relative_physical_stats !== '') parts.push(r.relative_physical_stats === '1' ? '(Atk > Def)' : r.relative_physical_stats === '-1' ? '(Atk < Def)' : '(Atk = Def)');
  } else if (trig === '2') {
    parts.push('Trade');
    if (r.trade_species_id) parts.push('for ' + pokeTitle(+r.trade_species_id));
  } else if (trig === '3') parts.push(item(r.trigger_item_id));
  else if (trig === '4') parts.push('Shedinja');
  else parts.push('Special');
  if (r.held_item_id) parts.push('Hold ' + item(r.held_item_id));
  if (r.gender_id === '1') parts.push('(♀)');
  if (r.gender_id === '2') parts.push('(♂)');
  if (r.time_of_day && !r.minimum_happiness) parts.push('(' + titleWords(r.time_of_day) + ')');
  return parts.join('\n');
}
/* {fromId: [[toId, [method, ...]], ...]} for a base game: species up to `maxId`, version group `vg`.
   PokeAPI files a location- or game-specific method under the version group it belongs to; the newest
   one at or before the base game is the one that game had. Regional forms are later phases. */
function baseEvos(vg, gen, maxId) {
  const D = EVO_DATA, out = {};
  const byTarget = {};
  D.rows.forEach(r => {
    const to = +r.evolved_species_id;
    /* A form id equal to the species id is the default form (Eevee's stone rows name form 133); any
       other is a regional or alternate form, which is a later phase. */
    const from0 = D.sp[to] && D.sp[to].from;
    if (to > maxId || r.region_id) return;
    if (r.evolved_pokemon_form_id && +r.evolved_pokemon_form_id !== to) return;
    if (r.required_pokemon_form_id && +r.required_pokemon_form_id !== from0) return;
    if (r.trigger_item_id && (ITEM_INTRO_GEN[D.itemId[r.trigger_item_id]] || 1) > gen) return;
    if (r.held_item_id && (ITEM_INTRO_GEN[D.itemId[r.held_item_id]] || 1) > gen) return;
    if (+r.evolution_trigger_id > 4) return;
    (byTarget[to] = byTarget[to] || []).push(r);
  });
  Object.keys(byTarget).forEach(to => {
    const rows = byTarget[to];
    const from = D.sp[to] && D.sp[to].from;
    if (!from || from > maxId) return;
    const general = rows.filter(r => !r.version_group_id);
    const specific = rows.filter(r => r.version_group_id && +r.version_group_id <= vg);
    const newest = specific.length ? Math.max(...specific.map(r => +r.version_group_id)) : 0;
    const use = general.concat(specific.filter(r => +r.version_group_id === newest));
    const methods = [...new Set(use.map(evoText))];
    if (!methods.length) return;
    (out[from] = out[from] || []).push([+to, methods]);
  });
  Object.keys(out).forEach(k => out[k].sort((a, b) => a[0] - b[0]));
  return out;
}
const evoEdge = (evo, from, to) => (evo[from] || []).find(e => e[0] === to);
function setEvo(evo, from, to, methods, add) {
  let e = evoEdge(evo, from, to);
  if (!e) { e = [to, []]; (evo[from] = evo[from] || []).push(e); evo[from].sort((a, b) => a[0] - b[0]); }
  e[1] = add ? [...new Set(e[1].concat(methods))] : methods.slice();
}

// ---- learnsets -----------------------------------------------------------------------------------------
/* learn[id] = [[level, slug, level, slug, ...], [slug, ...]] - level-up moves in order, then TM/tutor moves. */
function baseLearn(PM, vg, maxId, mv, withTutor) {
  const t = PM[vg], out = {};
  for (let id = 1; id <= maxId; id++) {
    const lv = (t.lv[id] || []).slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]).flatMap(x => [x[0], mv[x[1]]]);
    const tm = [...(t.machine[id] || [])].concat(withTutor ? [...(t.tutor[id] || [])] : []).map(m => mv[m]);
    out[id] = [lv, [...new Set(tm)].sort()];
  }
  return out;
}
const lvPairs = a => { const o = []; for (let i = 0; i < a.length; i += 2) o.push([a[i], a[i + 1]]); return o; };
const lvFlat = p => p.slice().sort((a, b) => a[0] - b[0]).flatMap(x => x);
function machinesFor(T, vg) {
  const mv = {}; csvObjs(T.paMoves).forEach(r => { mv[r.id] = r.identifier; });
  return csvObjs(T.paMachines).filter(r => r.version_group_id === String(vg)).map(r => [+r.machine_number, mv[r.move_id]])
    .sort((a, b) => a[0] - b[0]).map(([n, m]) => [n > 100 ? 'HM' + String(n - 100).padStart(2, '0') : 'TM' + String(n).padStart(2, '0'), m]);
}

// ==== Renegade Platinum ========================================================================================
function rpBlocks(doc) {
  const out = {};
  const re = /={5,}\r?\n(\d{3}) - ([^\r\n]+)\r?\n={5,}\r?\n([\s\S]*?)(?=\r?\n={5,}\r?\n\d{3} - |$)/g;
  let m;
  while ((m = re.exec(doc))) {
    const id = +m[1];
    if (out[id]) continue;          // a form's block repeats the number; the species' own block comes first
    out[id] = { name: m[2].trim(), body: m[3] };
  }
  return out;
}
function rpMoves(T) {
  const doc = T.rpMoves.replace(/\r/g, '');
  const repl = {};
  const rt = doc.split(/Old Move\s+New Move/)[1].split(/={5,}/)[0];
  rt.split('\n').forEach(l => { const m = l.match(/^(\S.*?)\s{2,}(\S.*?)\s*$/); if (m && !/^-+$/.test(m[1])) repl[moveSlug(m[1], null, 'rp replacements')] = moveSlug(m[2], null, 'rp replacements'); });
  const mods = {};
  const body = doc.split(/Move Modifications\n=+\n/)[1];
  body.split(/\n\s*\n/).forEach(b => {
    const ls = b.trim().split('\n').map(s => s.trim()).filter(Boolean);
    if (ls.length < 2 || /^Some moves|^There are/.test(ls[0])) return;
    const slug = moveSlug(ls[0].replace(/:$/, ''), null, 'rp move modifications');
    if (!slug) return;
    const f = {};
    ls.slice(1).forEach(l => { const m = l.match(/^(\w+):\s*(.*?)\s*>>?\s*(.*)$/); if (m) f[m[1].toLowerCase()] = [m[2], m[3]]; });
    mods[slug] = f;
  });
  return { repl, mods };
}
function buildRPMoves(T, calcMoves) {
  const { repl, mods } = rpMoves(T);
  const removed = new Set(Object.keys(repl)), added = new Set(Object.values(repl));
  const list = genMoveList(4).filter(s => !removed.has(s)).concat([...added]);
  const moves = {}, issues = [];
  list.forEach(slug => {
    const base4 = introGen(slug) <= 4 ? baseMove(slug, 4) : null;
    const v = baseMove(slug, 7);       // "The numbers of all moves ... are updated to match Ultra Sun and Ultra Moon"
    let note = null;
    const m = mods[slug];
    if (m) {
      const num = s => parseInt(String(s).replace(/%/, ''), 10);
      if (m.power) { if (num(m.power[0]) !== v[2]) issues.push(slug + ': doc says old power ' + m.power[0] + ', USUM has ' + v[2]); v[2] = num(m.power[1]); }
      if (m.accuracy) v[3] = num(m.accuracy[1]);
      if (m.pp) v[4] = num(m.pp[1]);
      if (m.type) v[0] = typeName(m.type[1]);
      const eff = [m.effect && m.effect[1], m.recovery && ('Recovery ' + m.recovery[1])].filter(Boolean);
      if (eff.length) note = eff.join('. ');
    }
    if (v[0] !== baseMove(slug, 7)[0]) v[1] = v[1];   // category is per move from Gen IV on; a retype does not move it
    moves[slug] = moveRec(v, base4, note);
  });
  return { moves, repl, mods, issues, check: calcMoveCheck(moves, calcMoves) };
}
/* The hack's calculator data names each move with its type, base power and (Gen IV on) category.
   Every disagreement is listed; none is silently resolved. */
function calcMoveCheck(moves, calcMoves) {
  /* The calculators write 1 as the power of a move whose power the battle code sets (Low Kick,
     Return, Seismic Toss); the app writes 0. Those are the same statement and are counted, not listed. */
  const res = { compared: 0, type: [], power: [], category: [], missingFromCalc: 0, powerSetInBattle: 0 };
  const byFlat = {}; Object.keys(calcMoves).forEach(k => { byFlat[flat(k)] = calcMoves[k]; });
  Object.keys(moves).forEach(slug => {
    const c = byFlat[flat(slug)] || byFlat[flat(slug.replace(/-/g, ' '))];
    if (!c) { res.missingFromCalc++; return; }
    res.compared++;
    const v = moves[slug];
    if (c.type && moveType(c.type) !== v[0]) res.type.push(slug + ' (' + v[0] + ' vs ' + c.type.toLowerCase() + ')');
    /* ...and for Return and Frustration they write the power at full friendship (102). A move PokeAPI
       gives no fixed power, that we also show as 0, is counted the same way. */
    if (v[2] === 0 && v[1] !== 'status' && (+c.basePower === 1 || (MROW[slug] && !MROW[slug][3]))) res.powerSetInBattle++;
    else if (c.basePower !== undefined && +c.basePower !== v[2]) res.power.push(slug + ' (' + v[2] + ' vs ' + c.basePower + ')');
    if (c.category && c.category.toLowerCase() !== v[1]) res.category.push(slug + ' (' + v[1] + ' vs ' + c.category.toLowerCase() + ')');
  });
  return res;
}
function buildRPLearn(T, PM, mv, machines) {
  const blocks = rpBlocks(T.rpChanges.replace(/\r/g, ''));
  const learn = {}, issues = [];
  const usumTM = PM[VG['ultra-sun-ultra-moon']].machine, usumTutor = PM[VG['ultra-sun-ultra-moon']].tutor, ptTM = PM[VG.platinum].machine;
  const usumTMmoves = new Set(); Object.values(usumTM).forEach(s => s.forEach(m => usumTMmoves.add(mv[m])));
  const tmMoves = machines.map(x => x[1]);
  const extras = {}, extraNotes = [];
  for (let id = 1; id <= 493; id++) {
    const b = blocks[id];
    if (!b) { issues.push(id + ': no block in Pokémon Changes'); continue; }
    /* "Level Up:" - or, for a species whose forms differ, "Level Up (Normal Forme):" and so on; the
       species is its default form (Deoxys Normal, Wormadam Plant, Shaymin Land, Giratina Altered). */
    const heads = [...('\n' + b.body).matchAll(/\nLevel Up(?: \(([^)]*)\))?:?\n([\s\S]*?)(?=\n\s*\n|$)/g)];   // Poliwag's heading has no colon
    const pick = heads.find(h => !h[1]) || heads.find(h => /^(Normal Forme|Plant Cloak|Land Forme|Altered Forme)$/.test(h[1]));
    const lvBlock = pick ? pick[2] : '';
    const lv = [];
    lvBlock.split('\n').forEach(l => { const m = l.match(/^\s*(\d+)\s*-\s*(.+?)\s*$/); if (m) { const s = moveSlug(m[2], null, 'rp level-up'); if (s) lv.push([+m[1], s]); } });
    if (!lv.length) issues.push(id + ': no level-up moves found');
    /* TM compatibility: Item Changes says it "matches Ultra Sun and Ultra Moon plus extras as listed in
       Pokémon Changes". USUM is asked for each TM move it also has as a TM; a TM move that is not a
       TM in USUM keeps Platinum's list. The extras are then added - and each extra is checked: an
       extra this rule ALREADY gives would mean the rule is wrong, so they are counted. */
    const learnable = new Set();
    const usum = new Set([...(usumTM[id] || [])].map(m => mv[m]));
    const pt = new Set([...(ptTM[id] || [])].map(m => mv[m]));
    tmMoves.forEach(m => { if (usumTMmoves.has(m) ? usum.has(m) : pt.has(m)) learnable.add(m); });
    const ex = [];
    b.body.replace(/Now compatible with (?:TM|HM)(\d+), ([^.\n]+)\./g, (all, n, name) => { const s = moveSlug(name, null, 'rp tm'); if (s) ex.push(s); return all; });
    ex.forEach(s => { if (learnable.has(s)) extraNotes.push(id + ' ' + s); learnable.add(s); });
    extras[id] = ex;
    learn[id] = [lvFlat(lv), [...learnable].sort()];
  }
  return { learn, issues, extrasListed: Object.values(extras).reduce((a, x) => a + x.length, 0), extrasAlreadyGiven: extraNotes };
}
function rpMachines(T, base) {
  const doc = T.rpItems.replace(/\r/g, '');
  const ms = base.map(x => x.slice());
  doc.replace(/-\s*(TM|HM)(\d+):\s*(.+?)\s*>>\s*(.+)/g, (all, k, n, a, b) => {
    const lab = k + n.padStart(2, '0');
    const row = ms.find(x => x[0] === lab);
    const old = moveSlug(a, null, 'rp machines'), nw = moveSlug(b, null, 'rp machines');
    if (!row || row[1] !== old) throw new Error('RP Item Changes: ' + lab + ' was not ' + a + ' in Platinum');
    row[1] = nw;
    return all;
  });
  return ms;
}
function rpEvo(T, evo) {
  const doc = T.rpEvo.replace(/\r/g, '');
  let applied = 0;
  const notes = [];
  const sid = n => speciesId(n.trim());
  doc.split('\n').forEach(l => {
    let m;
    if ((m = l.match(/^- (.+?): Now able to evolve into (.+?) by using an? (.+?)\.\s*$/))) { setEvo(evo, sid(m[1]), sid(m[2]), [m[3]], true); applied++; }
    else if ((m = l.match(/^- (.+?): Now able to evolve into (.+?) at Level (\d+)\.\s*$/))) { setEvo(evo, sid(m[1]), sid(m[2]), ['Lv ' + m[3]], true); applied++; }
    else if ((m = l.match(/^- (.+?): Now evolves into (.+?) at Level (\d+)\.\s*$/))) {
      const e = evoEdge(evo, sid(m[1]), sid(m[2]));
      if (!e || !e[1].some(x => /^Lv \d+/.test(x))) throw new Error('RP evo: ' + m[1] + ' has no level evolution to change');
      e[1] = e[1].map(x => x.replace(/^Lv \d+/, 'Lv ' + m[3])); applied++;
    } else if ((m = l.match(/^- (.+?): Now only evolves into (.+?) with the (.+?)\.\s*$/))) { setEvo(evo, sid(m[1]), sid(m[2]), [m[3]], false); applied++; }
    else if ((m = l.match(/^- (.+?): Now evolves into (.+?) when happy regardless of the time\.\s*$/))) { setEvo(evo, sid(m[1]), sid(m[2]), ['Happiness'], false); applied++; }
    else if (/^- /.test(l)) notes.push('unread line: ' + l);
  });
  if (notes.length) throw new Error('RP Evolution Changes: ' + notes.join('; '));
  return applied;
}

// ==== Sacred Gold / Storm Silver ===================================================================================
function sgBlocks(doc) {
  const out = {};
  doc.replace(/\r/g, '').split(/\n(?=#\d{3} )/).forEach(b => {
    const h = b.match(/^#(\d{3}) (.+)/);
    if (!h) return;
    const id = +h[1];
    const row = SPECIES.find(x => x[0] === id);
    const hf = flat(h[2].trim());
    if (!row || (hf !== flat(row[1]) && hf !== flat(row[1].split('-')[0]))) return;   // a form's entry; later phase
    if (!out[id]) out[id] = b;
  });
  return out;
}
/* "Notation is the following: () = New, {} = Replaces Original, [] = Shifts from Original Position".
   ( ): added at that level.  { }: replaces the move the original learnset had at that level.
   [ ]: a move the original already learns, moved to that level. */
function applySGLevel(base, line, id, issues) {
  const lv = lvPairs(base);
  const items = line.split(/,\s*(?![^(\[{]*[)\]}])/);
  items.forEach(it => {
    const m = it.trim().match(/^(.+?)\s*([(\[{])(\d+)[)\]}]$/);
    if (!m) { issues.push(id + ': unread level-up item "' + it.trim() + '"'); return; }
    const slug = moveSlug(m[1], null, 'sg level-up');
    if (!slug) return;
    const L = +m[3];
    if (m[2] === '(') lv.push([L, slug]);
    else if (m[2] === '{') {
      const i = lv.findIndex(x => x[0] === L);
      if (i < 0) { issues.push(id + ': {' + L + '} ' + slug + ' replaces nothing at that level; added'); lv.push([L, slug]); }
      else lv[i] = [L, slug];
    } else {
      const i = lv.findIndex(x => x[1] === slug);
      if (i < 0) { issues.push(id + ': [' + L + '] ' + slug + ' is not in the original learnset; added'); lv.push([L, slug]); }
      else lv[i] = [L, slug];
    }
  });
  return lvFlat(lv);
}
function buildSGLearn(T, PM, mv, machines, classic) {
  const base = baseLearn(PM, VG['heartgold-soulsilver'], 493, mv, false);
  if (classic) return { learn: base, issues: [], applied: 0 };
  const blocks = sgBlocks(T.sgChanges);
  const issues = [];
  let applied = 0;
  Object.keys(blocks).forEach(id => {
    const b = blocks[id];
    const lm = b.match(/\+ Level Up Moves: (.+)/);
    if (lm) { base[id][0] = applySGLevel(base[id][0], lm[1].trim(), +id, issues); applied++; }
    const tm = b.match(/\+ TM: (.+)/);
    if (tm) {
      tm[1].replace(/(TM|HM)(\d+) \(([^)]+)\)/g, (all, k, n, name) => {
        const lab = k + n.padStart(2, '0');
        const row = machines.find(x => x[0] === lab);
        const slug = moveSlug(name, null, 'sg tm');
        if (!row || row[1] !== slug) issues.push(id + ': ' + lab + ' is ' + (row && row[1]) + ' in HG/SS, doc says ' + name);
        if (slug && !base[id][1].includes(slug)) base[id][1] = base[id][1].concat([slug]).sort();
        return all;
      });
      applied++;
    }
  });
  return { learn: base, issues, applied };
}
function buildSGMoves(fairy, calcMoves) {
  const list = genMoveList(4);
  const moves = {};
  /* "All moves that were given some sort of change in Black & White have had the same change applied
     to them ... where possible, as well as some additional edits to make Cut, Strength and Rock Smash
     more useful". The Fairy patch "affects any moves that were changed to Fairy-type in Gen 6". */
  const own = {
    cut: { v: { 0: 'grass', 2: 60 }, note: null },
    strength: { v: { 0: 'rock', 2: 60 }, note: '10% chance to lower the target\'s Attack by 1.' },
    'rock-smash': { v: { 2: 60 }, note: '30% chance to lower the target\'s Defense by 1.' },
  };
  list.forEach(slug => {
    const b4 = baseMove(slug, 4);
    const v = baseMove(slug, 5);
    v[0] = b4[0];                       // Black & White did not retype Gen IV moves; Curse stays ???-less Normal here
    let note = null;
    if (own[slug]) { Object.entries(own[slug].v).forEach(([i, x]) => { v[+i] = x; }); note = own[slug].note; }
    if (fairy && baseMove(slug, 6)[0] === 'fairy' && v[0] !== 'fairy') v[0] = 'fairy';
    moves[slug] = moveRec(v, b4, note);
  });
  return { moves, check: calcMoveCheck(moves, calcMoves) };
}
/* The calculator's learnsets name moves through another hack's move table (see calcLearnCheck). Once
   that is found, what is left still includes moves at levels HG/SS and Drayano's doc both disagree
   with, so the calculator is recorded as a comparison, NOT counted as confirming the learnsets. */
function sgLearnCheck(L, poks) {
  const c = calcLearnCheck(L.learn, poks);
  return Object.assign({ against: SRC.sgCalc, docEntriesApplied: L.applied,
    usedAsCheck: false, why: Object.keys(c.mislabels).length + ' of the calculator\'s move names are other moves (' +
      Object.entries(c.mislabels).slice(0, 4).map(([k, v]) => k + ' = ' + v).join(', ') + ' ...), names no Generation IV game has; its learnsets are not v1.05\'s as written' }, c);
}
function sgEvo(T, evo) {
  const doc = T.sgEvo.replace(/\r/g, '');
  let applied = 0;
  const lists = doc.split(/\n(?=Instead of )/).slice(1);
  lists.forEach(p => {
    const names = (p.split(/Pokémon:\s*\n/)[1] || '').split('\n')[0].split(',').map(s => s.trim()).filter(Boolean);
    const item = (p.match(/called the "([^"]+)"/) || [])[1];
    names.forEach(n => {
      const from = speciesId(n);
      (evo[from] || []).forEach(e => {
        e[1] = e[1].map(x => {
          if (!/^Trade|^At |^Moss Rock|^Ice Rock/.test(x)) return x;
          applied++;
          if (item) return item;                                  // Covenant Orb / Voltaic Ore
          const held = x.match(/Hold (.+)/);
          if (!held) throw new Error('SG evo: ' + n + ' trade has no held item to "Use"');
          return held[1];
        });
      });
    });
  });
  doc.replace(/- (\w+) - Get an? "([^"]+)"/g, (all, to, item) => { setEvo(evo, 133, speciesId(to), [item], false); applied++; return all; });
  return applied;
}

// ==== Platinum Kaizo ===================================================================================================
/* Platinum Kaizo replaces 25 moves outright ("Taunt -> HP Dark") and the Moves tab is the ROM's
   table, so a move is identified by its row there, not by its name alone: row 130 "Solar-Beam" is a
   one-turn Grass move that replaced Skull Bash, and is NOT row 76 "SolarBeam". A row whose name is a
   real move, and the first row with that name, takes PokeAPI's slug; every other row is the hack's
   own move ("pk-..."). The TM tab still labels a replaced TM by its old move ("Taunt"); the
   replacement list from the Move Changes tab maps it to the move the TM now teaches. */
function pkMoveResolver(T) {
  const rows = csvObjs(T.pkMoves).filter(r => +r['ID Number'] >= 1 && (r.Name || '').trim() && r.Name.trim() !== '-' && !/^\d+$/.test(r.Name.trim()));   // rows 468-470 are unnamed placeholders
  const byExact = {}, used = new Set(), customNames = {};
  rows.forEach(r => {
    const name = r.Name.trim();
    const canon = moveByFlat[flat(name)] || MOVE_ALIASES[flat(name)];
    let slug;
    if (canon && !used.has(canon)) slug = canon;
    else { slug = 'pk-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); customNames[slug] = name; }
    if (used.has(slug)) throw new Error('Platinum Kaizo: two rows resolve to ' + slug);
    used.add(slug);
    byExact[name.toLowerCase()] = slug;
    r.slug = slug;
  });
  const repl = {}, changed = new Set();
  csvRows(T.pkMoveChanges).forEach(r => {
    const c = (r[1] || '').trim();
    const m = c.match(/^(.+?)(?:\s*->\s*([^(:]+?))?\s*(?:\([^)]*\))?:\s/);
    if (!m) return;
    if (m[2]) repl[m[1].trim().toLowerCase()] = m[2].trim().toLowerCase();
    changed.add((m[2] || m[1]).trim().toLowerCase());
  });
  const resolve = (name, where) => {
    const n = String(name || '').trim().toLowerCase();
    if (!n || n === '-') return null;
    if (byExact[n]) return byExact[n];
    if (repl[n] && byExact[repl[n]]) return byExact[repl[n]];
    const s = moveSlug(name, null, where);
    if (s && !used.has(s)) { (unresolvedMoves[where + ' (a real move, not in the hack\'s table)'] = unresolvedMoves[where + ' (a real move, not in the hack\'s table)'] || new Set()).add(name); return null; }
    return s;
  };
  return { rows, byExact, customNames, repl, changed, resolve };
}
function buildPKMoves(R) {
  const moves = {};
  R.rows.forEach(r => {
    const slug = r.slug;
    const v = [moveType(r.Type), r.Category.toLowerCase(), +r.Power || 0, +r.Accuracy || 0, +r.PP || 0, +r.Priority || 0];
    const b = MROW[slug] ? baseMove(slug, 4) : null;
    const eff = r['Additional Effect'] && r['Additional Effect'] !== 'None' ? r['Additional Effect'] + (+r['Additional Effect Chance (%)'] ? ' (' + r['Additional Effect Chance (%)'] + '%)' : '') : null;
    moves[slug] = moveRec(v, b, !b || R.changed.has(r.Name.trim().toLowerCase()) ? eff : null);
  });
  return { moves, customNames: R.customNames, changedListed: R.changed.size, replaced: Object.keys(R.repl).length };
}
function buildPKLearn(T, R) {
  const learn = {}, issues = [];
  csvRows(T.pkLevel).slice(1).forEach(r => {
    const id = +r[0];
    if (!(id >= 1 && id <= 493)) return;
    if (flat(r[1]) !== flat(SPECIES.find(x => x[0] === id)[1].split('-')[0]) && flat(r[1]) !== flat(SPECIES.find(x => x[0] === id)[1])) issues.push(id + ': sheet row is ' + r[1]);
    const lv = [];
    for (let i = 2; i + 1 < r.length; i += 2) { if (!r[i]) continue; const s = R.resolve(r[i], 'pk level-up'); if (s) lv.push([+r[i + 1] || 1, s]); }
    learn[id] = [lvFlat(lv), []];
  });
  const tm = csvRows(T.pkTM);
  const labels = tm[0].slice(2), names = tm[1].slice(2).map(n => R.resolve(n, 'pk tm'));
  const machines = labels.map((l, i) => [l.trim(), names[i]]).filter(x => x[0]);
  tm.slice(2).forEach(r => {
    const id = +r[0];
    if (!(id >= 1 && id <= 493) || !learn[id]) return;
    learn[id][1] = [...new Set(names.filter((n, i) => n && String(r[i + 2]).trim().toUpperCase() === 'TRUE'))].sort();
  });
  return { learn, machines, issues };
}
const PK_EVO = {
  'Level Up': req => 'Lv ' + req,
  'Use Item': req => req,
  'Use Item (Day)': req => req + '\n(Day)',
  'Use Item (Female)': req => req + '\n(♀)',
  'Happiness': () => 'Happiness',
  'Held Item (Day)': req => 'Level Up\nHold ' + req + '\n(Day)',
  'Held Item (Night)': req => 'Level Up\nHold ' + req + '\n(Night)',
  'Level (1 of 2)': req => 'Lv ' + req + '\n(random)',
  'Level (2 of 2)': req => 'Lv ' + req + '\n(random)',
  'Level (PID < 5)': req => 'Lv ' + req + '\n(random)',
  'Level (PID > 5)': req => 'Lv ' + req + '\n(random)',
  'Level (Attack < Defense)': req => 'Lv ' + req + '\n(Atk < Def)',
  'Level (Attack = Defense)': req => 'Lv ' + req + '\n(Atk = Def)',
  'Level (Attack > Defense)': req => 'Lv ' + req + '\n(Atk > Def)',
  'Level (Eterna Forest)': () => 'Moss Rock',
  'Level (Route 217)': () => 'Ice Rock',
  'Level (Mt. Coronet)': () => 'At Mt Coronet',
  'Level (Female)': req => 'Lv ' + req + '\n(♀)',
  'Level (Male)': req => 'Lv ' + req + '\n(♂)',
  'Attack Known': req => 'Know ' + req,
  'Pokemon in Party': req => 'With ' + titleWords(req) + ' in party',
  'Max Beauty': () => 'Beauty',
  'Trade': () => 'Trade',
  'Trade (Held Item)': req => 'Trade\nHold ' + req,
};
function buildPKEvo(T) {
  const evo = {}, issues = [];
  csvRows(T.pkEvo).slice(1).forEach(r => {
    const from = +r[0];
    if (!(from >= 1 && from <= 493)) return;
    for (let i = 2; i + 2 < r.length; i += 3) {
      const meth = (r[i] || '').trim(), req = (r[i + 1] || '').trim(), res = (r[i + 2] || '').trim();
      if (!meth || meth === 'None') continue;
      const to = speciesId(res);
      if (!to || to > 493) { issues.push(from + ': result "' + res + '" is not a species'); continue; }
      const f = PK_EVO[meth];
      if (!f) throw new Error('Platinum Kaizo evolution method not mapped: ' + meth);
      // The sheet writes species in capitals (MACHOKE) and items as the game does (TwistedSpoon).
      setEvo(evo, from, to, [f(/^[A-Z0-9 .'-]+$/.test(req) ? titleWords(req) : req)], true);
    }
  });
  return { evo, issues };
}

// ==== Run & Bun ===========================================================================================================
/* battle_moves.h branches on B_UPDATED_MOVE_DATA and three other B_ settings. Each is the expansion's default for this
   version, GEN_8 - the same choice phase 1 made for species, and the calculator check below says
   whether it was right. */
const RB_CONFIG = { B_UPDATED_MOVE_DATA: 8, B_UPDATED_MOVE_TYPES: 8, B_GROWTH_STAT_RAISE: 8, B_HIDDEN_POWER_DMG: 8, GEN_LATEST: 8 };
function resolveConfigPre(txt) {
  const out = [], stack = [];
  const evalc = c => {
    let e = c.replace(/defined\s*\(\s*(\w+)\s*\)/g, (a, n) => (n in RB_CONFIG ? '1' : '0'));
    e = e.replace(/GEN_(\d)/g, '$1').replace(/\b[A-Z_][A-Z0-9_]*\b/g, n => { if (!(n in RB_CONFIG)) throw new Error('unknown #if symbol ' + n); return String(RB_CONFIG[n]); });
    if (!/^[\d\s=!<>&|()]+$/.test(e)) throw new Error('unsafe #if: ' + c);
    return !!(0, eval)(e);
  };
  txt.split(/\r?\n/).forEach(l => {
    const t = l.trim();
    let m;
    const live = () => stack.every(s => s.on);
    if ((m = t.match(/^#if\s+(.+)$/))) { const on = evalc(m[1]); stack.push({ on, done: on }); }
    else if ((m = t.match(/^#elif\s+(.+)$/))) { const s = stack[stack.length - 1]; if (s.done) s.on = false; else { s.on = evalc(m[1]); s.done = s.on; } }
    else if (/^#else/.test(t)) { const s = stack[stack.length - 1]; s.on = !s.done; s.done = true; }
    else if (/^#endif/.test(t)) stack.pop();
    else if (live()) out.push(l);
  });
  return out.join('\n');
}
function cBlocks(src, re) {
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    let depth = 0, j = m.index + m[0].length - 1;
    for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
    out.push([m[1], src.slice(m.index + m[0].length, j)]);
  }
  return out;
}
function buildRBMoves(T, calcMoves) {
  const src = resolveConfigPre(T.rbMoves);
  const moves = {}, issues = [];
  for (const [name, b] of cBlocks(src, /\[(MOVE_\w+)\]\s*=\s*\{/g)) {
    if (name === 'MOVE_NONE' || isZMove(name)) continue;
    const slug = moveSlug(name, null, 'rb moves');
    if (!slug) continue;
    const g = (k, d) => { const m = b.match(new RegExp('\\.' + k + '\\s*=\\s*([^,\\n]+)')); return m ? m[1].trim() : d; };
    const split = g('split', 'SPLIT_PHYSICAL').replace('SPLIT_', '').toLowerCase();
    const v = [moveType(g('type').replace(/^TYPE_MYSTERY$/, '???')), split, setInBattle(+g('power', 0) || 0), +g('accuracy', 0) || 0, +g('pp', 0) || 0, +g('priority', 0) || 0];
    const b8 = introGen(slug) <= 8 ? baseMove(slug, 8) : null;
    moves[slug] = moveRec(v, b8, null);
  }
  return { moves, issues, check: calcMoveCheck(moves, calcMoves) };
}
function rbNums(T) {
  const num = {};
  T.rbSpecies.split(/\r?\n/).forEach(l => { const m = l.match(/^#define (SPECIES_\w+)\s+(\d+)\s*$/); if (m) num[m[1]] = +m[2]; });
  return num;
}
function buildRBLearn(T) {
  const num = rbNums(T);
  const arrays = (src, re) => { const o = {}; let m; while ((m = re.exec(src))) o[m[1]] = m[2]; return o; };
  const lvArr = arrays(T.rbLevel, /static const struct LevelUpMove (\w+)\[\] = \{([\s\S]*?)\};/g);
  const tArr = arrays(T.rbTeach, /static const u16 (\w+)\[\] = \{([\s\S]*?)\};/g);
  const ptr = src => { const o = {}; src.replace(/\[(SPECIES_\w+)\]\s*=\s*(\w+)/g, (a, s, n) => { o[s] = n; return a; }); return o; };
  const lp = ptr(T.rbLevelPtr), tp = ptr(T.rbTeachPtr);
  const learn = {}, issues = [];
  Object.keys(num).forEach(sp => {
    const id = num[sp];
    if (!(id >= 1 && id <= 905) || learn[id]) return;
    const la = lvArr[lp[sp]], ta = tArr[tp[sp]];
    if (!la) { issues.push(id + ' ' + sp + ': no level-up learnset'); return; }
    const lv = [];
    la.replace(/LEVEL_UP_MOVE\(\s*(\d+),\s*(MOVE_\w+)\)/g, (a, L, mname) => { const s = mname === 'MOVE_NONE' ? null : moveSlug(mname, null, 'rb level-up'); if (s) lv.push([+L, s]); return a; });
    const tm = [];
    (ta || '').replace(/(MOVE_\w+)/g, (a, mname) => { if (mname !== 'MOVE_UNAVAILABLE') { const s = moveSlug(mname, null, 'rb teachable'); if (s) tm.push(s); } return a; });
    learn[id] = [lvFlat(lv), [...new Set(tm)].sort()];
  });
  return { learn, issues };
}
const RB_EVO = {
  EVO_LEVEL: p => 'Lv ' + p, EVO_ITEM: p => p, EVO_FRIENDSHIP: () => 'Happiness', EVO_FRIENDSHIP_DAY: () => 'Happiness\n(Day)',
  EVO_FRIENDSHIP_NIGHT: () => 'Happiness\n(Night)', EVO_TRADE: () => 'Trade', EVO_LEVEL_FEMALE: p => 'Lv ' + p + '\n(♀)', EVO_LEVEL_MALE: p => 'Lv ' + p + '\n(♂)',
  EVO_LEVEL_DAY: p => 'Lv ' + p + '\n(Day)', EVO_LEVEL_NIGHT: p => 'Lv ' + p + '\n(Night)', EVO_LEVEL_DUSK: p => 'Lv ' + p + '\n(Dusk)',
  EVO_LEVEL_RAIN: p => 'Lv ' + p + '\n(Rain)', EVO_LEVEL_ATK_GT_DEF: p => 'Lv ' + p + '\n(Atk > Def)', EVO_LEVEL_ATK_LT_DEF: p => 'Lv ' + p + '\n(Atk < Def)',
  EVO_LEVEL_ATK_EQ_DEF: p => 'Lv ' + p + '\n(Atk = Def)', EVO_LEVEL_SILCOON: p => 'Lv ' + p + '\n(random)', EVO_LEVEL_CASCOON: p => 'Lv ' + p + '\n(random)',
  EVO_LEVEL_NINJASK: p => 'Lv ' + p, EVO_LEVEL_SHEDINJA: () => 'Shedinja', EVO_MAPSEC: p => 'At ' + p, EVO_SPECIFIC_MAP: p => 'At ' + p,
  EVO_MOVE: p => 'Know ' + p, EVO_MOVE_TYPE: p => p + ' Move\n+ Friendship', EVO_SPECIFIC_MON_IN_PARTY: p => 'With ' + p + ' in party',
  EVO_LEVEL_NATURE_AMPED: p => 'Lv ' + p + '\n(Amped nature)', EVO_LEVEL_NATURE_LOW_KEY: p => 'Lv ' + p + '\n(Low Key nature)',
  EVO_SCRIPT_TRIGGER_DMG: () => 'Take 49+ Damage',
};
function buildRBEvo(T) {
  const num = rbNums(T);
  const evo = {}, issues = [];
  const constName = c => titleWords(c.replace(/^(ITEM|MAPSEC|MAP|MOVE|TYPE|SPECIES)_/, '').replace(/_/g, ' '));
  T.rbEvo.replace(/\[(SPECIES_\w+)\]\s*=\s*\{([\s\S]*?)\}\},?\s*\n/g, (all, sp, body) => {
    const from = num[sp];
    if (!(from >= 1 && from <= 905)) return all;
    (body + '}').replace(/\{(EVO_\w+),\s*([^,]+),\s*(SPECIES_\w+)\}/g, (a, kind, p, toName) => {
      if (/MEGA|PRIMAL/.test(kind)) return a;
      const to = num[toName];
      if (!(to >= 1 && to <= 905)) { issues.push(from + ' -> ' + toName + ': a form, not shown in this phase'); return a; }
      const f = RB_EVO[kind];
      if (!f) throw new Error('Run & Bun evolution kind not mapped: ' + kind);
      const param = /^\d+$/.test(p.trim()) ? p.trim() : (kind === 'EVO_MOVE' ? constName(p.trim()).replace(/-/g, ' ') : constName(p.trim()));
      setEvo(evo, from, to, [f(param)], true);
      return a;
    });
    return all;
  });
  return { evo, issues };
}

// ==== Emerald Kaizo / FireRed Omega ======================================================================================
/* moves.json is the ROM's move table in slot order: row i is move number i + 1. Emerald Kaizo writes
   new moves OVER old slots, as Platinum Kaizo does: slot 4 (Comet Punch) is a 100-power Water move,
   slot 11 (Vise Grip) a 100-power Fire move - and the game names both "Weather Ball", like the real
   Weather Ball in slot 311. Fifteen slots are fixed-type Hidden Powers; Horn Drill's slot is Drill Run.
   So a move is its SLOT. A slot whose name is the move PokeAPI has at that number, or a real move
   the table has nowhere else (Drill Run), takes PokeAPI's slug; every other slot is the hack's own
   ("ek-..."), named so the three Weather Balls can be told apart. */
function ekMoveTable(T, mvById) {
  const rows = JSON.parse(T.ekMoves);
  const slots = rows.map((r, i) => ({ r, id: i + 1, name: r.name.trim() }));
  const used = new Set(), customNames = {}, byName = {};
  const canonAt = sl => { const c = moveByFlat[flat(sl.name)] || MOVE_ALIASES[flat(sl.name)]; return c && c === mvById[sl.id] ? c : null; };
  slots.forEach(sl => { const c = canonAt(sl); if (c) { sl.slug = c; used.add(c); } });
  slots.forEach(sl => {
    if (sl.slug) return;
    const c = moveByFlat[flat(sl.name)] || MOVE_ALIASES[flat(sl.name)];
    if (c && !used.has(c) && !/^Hidden Power \(/.test(sl.name)) { sl.slug = c; used.add(c); return; }
    const t = moveType(sl.r.type);
    const label = /^Hidden Power \(/.test(sl.name) ? sl.name : sl.name + ' (' + titleWords(t) + ')';
    sl.slug = 'ek-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (used.has(sl.slug)) throw new Error('Emerald Kaizo: two slots resolve to ' + sl.slug);
    used.add(sl.slug);
    customNames[sl.slug] = label;
  });
  /* A learnset or TM names a move, not a slot. A name that only one slot carries is that slot; a name
     several slots carry ("Weather Ball") is taken as the slot PokeAPI agrees with, and every such
     entry is listed in the file's notes, because the database cannot say which was meant. */
  slots.forEach(sl => { const k = sl.name.toLowerCase(); (byName[k] = byName[k] || []).push(sl); });
  const ambiguous = [];
  const resolve = (name, where) => {
    const list = byName[String(name).trim().toLowerCase()];
    if (list && list.length === 1) return list[0].slug;
    if (list) { ambiguous.push(where + ': "' + name + '"'); const real = list.find(x => canonAt(x)); return (real || list[0]).slug; }
    /* A name for a move whose slot the hack renamed ("Hidden Power", now "Hidden Power (Bug)") is
       that slot: the TM still teaches slot 237. */
    const sl = moveSlug(name, null, where);
    if (sl && used.has(sl)) return sl;
    const at = sl && slots.find(x => mvById[x.id] === sl);
    return at ? at.slug : null;
  };
  return { slots, customNames, resolve, ambiguous, mvById };
}
function buildEKMoves(E, calcMoves) {
  const moves = {};
  E.slots.forEach(sl => {
    const r = sl.r;
    const t = moveType(r.type);
    const cat = r.power ? physicalByType(t) : 'status';
    const v = [t, cat, setInBattle(r.power || 0), r.accuracy || 0, r.pp || 0, r.priority > 127 ? r.priority - 256 : r.priority || 0];
    const base = MROW[sl.slug] ? baseMove(sl.slug, 3) : null;
    /* The ROM keeps the replaced move's description, so a new move's text says what it replaced. */
    moves[sl.slug] = moveRec(v, base, E.customNames[sl.slug] ? 'Takes the place of ' + titleWords(String(E.mvById[sl.id]).replace(/-/g, ' ')) + ' (move ' + sl.id + ').' : null);
  });
  return { moves, check: calcMoveCheck(moves, calcMoves) };
}
function buildEKLearn(T, E) {
  const db = JSON.parse(T.ekDb);
  const lookup = (T.ekState.match(/TMHMBitfieldLookup = \[([\s\S]*?)\];/) || [])[1];
  if (!lookup) throw new Error('emerald-kaizo-db: TM/HM lookup not found in state.js');
  const tmList = [...lookup.matchAll(/"([^"]+)",\s*\/\/\s*(TM|HM)(\d+)/g)].map(m => [m[2] + m[3], E.resolve(m[1], 'ek tm list')]);
  const learn = {};
  db.forEach(p => {
    const id = +p.dex;
    if (!(id >= 1 && id <= 386)) return;
    const lv = (p.learnset || []).map(x => [x.level, E.resolve(x.move, 'ek level-up, ' + p.name + ' Lv ' + x.level)]).filter(x => x[1]);
    const bytes = (p.TMHM || '').match(/../g) || [];
    const tm = [];
    bytes.forEach((h, byte) => { const v = parseInt(h, 16); for (let bit = 0; bit < 8; bit++) if (v & (1 << bit)) { const t = tmList[byte * 8 + bit]; if (t && t[1]) tm.push(t[1]); } });
    learn[id] = [lvFlat(lv), [...new Set(tm)].sort()];
  });
  return { learn, machines: tmList };
}
function buildFROMoves(calcMoves) {
  const moves = {};
  const byFlat = {}; Object.keys(calcMoves).forEach(k => { byFlat[flat(k)] = calcMoves[k]; });
  genMoveList(3).forEach(slug => {
    const b = baseMove(slug, 3);
    const v = b.slice();
    const c = byFlat[flat(slug)];
    if (c) {
      if (c.type) v[0] = moveType(c.type);
      if (c.basePower !== undefined) v[2] = +c.basePower;
      v[1] = v[2] ? physicalByType(v[0]) : 'status';
    }
    moves[slug] = moveRec(v, b, null);
  });
  return { moves };
}
function buildFROLearn(poks) {
  const learn = {};
  Object.keys(poks).forEach(name => {
    const id = speciesId(name);
    if (!(id >= 1 && id <= 386) || learn[id]) return;
    const li = poks[name].learnset_info;
    if (!li) return;
    const lv = (li.learnset || []).map(x => [x[0], moveSlug(x[1], null, 'fro level-up')]).filter(x => x[1]);
    const tm = (li.tms || []).map(n => moveSlug(n, null, 'fro tm')).filter(Boolean);
    learn[id] = [lvFlat(lv), [...new Set(tm)].sort()];
  });
  return { learn };
}

// ---- items -------------------------------------------------------------------------------------------------------
/* What each hack documents about items, in the author's words, as sections the Items tab shows:
   { title, cols, rows } for a table, { title, notes } for prose. Nothing is inferred; a hack whose
   author documents no item changes gets only the TM changes, which are worked out from its TM list. */
function rpItems(T) {
  const doc = T.rpItems.replace(/\r/g, '');
  const parts = {};
  const re = /\n=+\n([A-Z][^\n]*)\n=+\n([\s\S]*?)(?=\n=+\n[A-Z][^\n]*\n=+\n|$)/g;
  let m;
  while ((m = re.exec('\n' + doc))) parts[m[1].trim()] = m[2];
  /* Replaced Items is underlined with = only once, so it is cut out separately. */
  const ri = doc.match(/\nReplaced Items\n=+\n([\s\S]*?)(?=\n\n\*|$)/);
  if (ri) parts['Replaced Items'] = ri[1];
  const cells = l => l.trim().split(/\s{2,}/);
  const tableRows = txt => (txt || '').split('\n').map(l => l.trim()).filter(l => l && !/^(---|A \*|Item\s|TM\s|Old Item|The following|\*)/.test(l)).map(cells);
  const out = [];
  const mod = (parts['Modified Items'] || '').trim();
  if (mod) out.push({ title: 'Changed items', notes: mod.split(/\n\s*\n/).map(x => x.trim()) });
  const rep = tableRows(parts['Replaced Items']).filter(c => c.length >= 2);
  if (rep.length) out.push({ title: 'Replaced items', cols: ['Old item', 'New item'], rows: rep.map(c => [c[0], c[1].replace(/\s*\*+$/, '')]) });
  const loc = tableRows(parts['Item Locations']).filter(c => c.length >= 2);
  if (loc.length) out.push({ title: 'Where to find items', cols: ['Item', 'Where'], rows: loc.map(c => [c[0], c.slice(1).join(' ')]) });
  const tm = tableRows(parts['TM Locations']).filter(c => c.length >= 3);
  if (tm.length) out.push({ title: 'Where to find TMs', cols: ['TM', 'Where', 'How'], rows: tm.map(c => [c[0], c[1], c[2] + (c[3] === '*' ? ' (moved)' : '')]) });
  const key = tableRows(parts['Key Items']).filter(c => c.length >= 3);
  if (key.length) out.push({ title: 'Key items', cols: ['Item', 'Where', 'How'], rows: key.map(c => [c[0], c[1], c[2] + (c[3] === '*' ? ' (moved)' : c[3] === '**' ? ' (new)' : '')]) });
  return out;
}
function sgItems(T) {
  const doc = T.sgItems.replace(/\r/g, '');
  const out = [];
  const titles = { 'Technical Machine Locations': 'Where to find TMs', 'Evolutionary Item Locations': 'Where to find evolution items',
    'Key Item Locations': 'Key items', 'Fossil Locations': 'Fossils', 'Other Item Locations': 'Other items' };
  ('\n' + doc).split(/\n(?=[A-Z][^\n]*\n---\n)/).forEach(chunk => {
    const m = chunk.match(/^([A-Z][^\n]*)\n---\n([\s\S]*)$/);
    if (!m || /General Notes/.test(m[1])) return;
    const rows = [], notes = [];
    m[2].split('\n').forEach(l => {
      const t = l.trim();
      if (!t) return;
      const r = t.match(/^((?:TM|HM)\d+ [^:]+|[A-Z][\w'\u2019.\- ]+?): (.+)$/);
      if (r && !/^- /.test(t)) rows.push([r[1], r[2]]); else notes.push(t.replace(/^- /, ''));
    });
    const title = titles[m[1].trim()] || m[1].trim();
    if (rows.length) out.push({ title, cols: ['Item', 'Where'], rows });
    if (notes.length) out.push({ title: rows.length ? title + ': notes' : title, notes });
  });
  return out;
}
/* The hack's TM list against its base game's: a TM that teaches a different move. */
function tmChanges(machines, baseMachines) {
  if (!machines) return [];
  const base = {}; baseMachines.forEach(([l, mv]) => { base[l] = mv; });
  return machines.filter(([l, mv]) => base[l] && base[l] !== mv).map(([l, mv]) => [l, base[l], mv]);
}
/* Species whose types, stats or abilities differ from the base game, with the base game's values,
   so a page can say what changed: {id: [types, stats, abilities]} as the base game had them. */
function baseDiffs(key, gen, maxId) {
  const sp = JSON.parse(fs.readFileSync(path.join(OUTDIR, key + '.json'), 'utf8')).species;
  const out = {};
  Object.keys(sp).forEach(id => {
    if (+id > maxId) return;
    const b = RH.baseRecord(+id, gen);
    if (JSON.stringify(b) !== JSON.stringify(sp[id])) out[id] = b;
  });
  return out;
}

// ---- learnset cross-check against calculator data -----------------------------------------------------------------
/* Calculator learnsets are compared as sets of (level, move).
   Sacred Gold's calculator data names some moves through ANOTHER hack's move table: Ember appears as
   "Hp Fire", Slam as "Night Daze", Rollout as "Accelerock" - moves that do not exist in a Generation IV
   game. The mapping is not typed in; it is read off the data. A calculator name is a mislabel of one of
   our moves when it never once matches that name's own move, and stands at the same species and level
   as that one move at least three times and every time it stands alone. The mapping found is written
   into the file, and the comparison is then made through it - so a mislabel cannot hide a real
   difference, and a real difference cannot be taken for a mislabel. */
function calcLearnCheck(learn, poks) {
  const res = { compared: 0, mislabels: {}, levelDiffer: [], tmDiffer: [] };
  const key = n => moveSlug(n, null, 'calc learnset (check only)') || 'calc:' + n;
  const rows = [];
  Object.keys(poks).forEach(name => {
    const id = speciesId(name);
    const li = poks[name].learnset_info;
    if (!id || !learn[id] || !li || rows.some(r => r.id === id)) return;
    rows.push({ id, ours: lvPairs(learn[id][0]), theirs: (li.learnset || []).map(x => [x[0], key(x[1])]), tms: li.tms });
  });
  const exact = {}, pairs = {}, alone = {};
  rows.forEach(r => {
    const o = new Set(r.ours.map(x => x[0] + ' ' + x[1])), t = new Set(r.theirs.map(x => x[0] + ' ' + x[1]));
    r.theirs.forEach(x => { if (o.has(x[0] + ' ' + x[1])) exact[x[1]] = (exact[x[1]] || 0) + 1; });
    const levels = new Set(r.ours.map(x => x[0]).concat(r.theirs.map(x => x[0])));
    levels.forEach(L => {
      const mo = r.ours.filter(x => x[0] === L && !t.has(L + ' ' + x[1])).map(x => x[1]);
      const mt = r.theirs.filter(x => x[0] === L && !o.has(L + ' ' + x[1])).map(x => x[1]);
      mt.forEach(k => { alone[k] = (alone[k] || 0) + 1; });
      if (mo.length === 1 && mt.length === 1) { const p = mt[0] + '>' + mo[0]; pairs[p] = (pairs[p] || 0) + 1; }
    });
  });
  const map = {};
  Object.keys(pairs).forEach(p => {
    const [k, s] = p.split('>');
    if (!exact[k] && pairs[p] >= 3 && pairs[p] === alone[k] && !Object.keys(pairs).some(q => q !== p && q.startsWith(k + '>'))) map[k] = s;
  });
  Object.keys(map).sort().forEach(k => { res.mislabels[k.replace(/^calc:/, '')] = map[k]; });
  rows.forEach(r => {
    res.compared++;
    const o = new Set(r.ours.map(x => x[0] + ' ' + x[1]));
    const t = new Set(r.theirs.map(x => x[0] + ' ' + (map[x[1]] || x[1])));
    const d = [...o].filter(x => !t.has(x)).concat([...t].filter(x => !o.has(x)).map(x => '+' + x));
    if (d.length) res.levelDiffer.push(r.id + ': ' + d.join(', '));
    if (r.tms) {
      const t1 = new Set(learn[r.id][1]), t2 = new Set(r.tms.map(n => moveSlug(n, null, 'calc tms (check only)')));
      const dt = [...t1].filter(x => !t2.has(x)).concat([...t2].filter(x => !t1.has(x)).map(x => '+' + x));
      if (dt.length) res.tmDiffer.push(r.id + ': ' + dt.join(', '));
    }
  });
  return res;
}

// ---- validate and write ----------------------------------------------------------------------------------------------
function validate(key, d) {
  const known = new Set(Object.keys(d.moves));
  Object.keys(d.learn).forEach(id => {
    const [lv, tm] = d.learn[id];
    for (let i = 0; i < lv.length; i += 2) {
      if (!Number.isInteger(lv[i]) || lv[i] < 0 || lv[i] > 100) throw new Error(key + ' #' + id + ': bad level ' + lv[i]);
      if (!known.has(lv[i + 1])) throw new Error(key + ' #' + id + ': level-up move ' + lv[i + 1] + ' is not in the hack\'s move table');
    }
    tm.forEach(m => { if (!known.has(m)) throw new Error(key + ' #' + id + ': TM move ' + m + ' is not in the hack\'s move table'); });
  });
  Object.keys(d.moves).forEach(s => {
    const v = d.moves[s];
    if (!(RH.TYPES.has(v[0]) || v[0] === 'unknown') || !['physical', 'special', 'status'].includes(v[1])) throw new Error(key + ' ' + s + ': bad move ' + JSON.stringify(v));
  });
  Object.keys(d.evo).forEach(f => d.evo[f].forEach(e => { if (!e[1].length || e[1].some(x => !x)) throw new Error(key + ' #' + f + ': empty evolution method'); }));
}
function write(key, doc, check) {
  validate(key, doc);
  const file = path.join(OUTDIR, key + '.data.json');
  const next = JSON.stringify(Object.assign({ about: 'Generated by build/generate-romhack-data.js. Do not edit by hand.', key }, doc)) + '\n';
  if (check) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    const strip = s => s.replace(/"fetched":"[^"]*",/, '');
    return strip(cur) === strip(next);
  }
  fs.writeFileSync(file, next);
  return true;
}

async function main() {
  const check = process.argv.includes('--check');
  const fetched = new Date().toISOString().slice(0, 10);
  const T = {};
  await Promise.all(Object.keys(SRC).map(async k => { T[k] = await get(SRC[k]); }));
  loadEvoData(T);
  const mvById = {}; csvObjs(T.paMoves).forEach(r => { mvById[r.id] = r.identifier; });
  const PM = pokemonMovesByVg(T.paPokemonMoves, Object.values(VG));
  const out = [];
  const src = (...k) => k.map(x => SRC[x]);

  // Renegade Platinum - one moves/learnset/evolution set for both versions: the Move Changes and
  // Pokémon Changes docs say movepool changes are "present in both the Complete and Classic versions".
  {
    const calc = calcObj(T.rpCalc).moves;
    const M = buildRPMoves(T, calc);
    const machines = rpMachines(T, machinesFor(T, VG.platinum));
    const L = buildRPLearn(T, PM, mvById, machines);
    const evo = baseEvos(VG.platinum, 4, 493);
    const evoApplied = rpEvo(T, evo);
    const doc = { fetched, sources: src('rpMoves', 'rpChanges', 'rpItems', 'rpEvo', 'paPokemonMoves', 'paEvolution'),
      checks: { moves: Object.assign({ against: SRC.rpCalc }, M.check), learnsets: 'single source (Drayano\'s Pokémon Changes lists every species\' level-up moves in full)',
        tmRule: { extrasListed: L.extrasListed, extrasTheRuleAlreadyGave: L.extrasAlreadyGiven.length, which: L.extrasAlreadyGiven },
        evolutionChangesApplied: evoApplied },
      notes: M.issues.concat(L.issues), moves: M.moves, machines, learn: L.learn, evo };
    doc.items = { sections: rpItems(T), tmChanges: tmChanges(machines, machinesFor(T, VG.platinum)) };
    for (const k of ['renegade-platinum', 'renegade-platinum-classic']) out.push([k, Object.assign({}, doc, { base: baseDiffs(k, 4, 493) })]);
  }
  // Sacred Gold / Storm Silver
  {
    const machines = machinesFor(T, VG['heartgold-soulsilver']);
    const sg105 = JSON.parse(T.sgCalc);
    const sgF = calcObj(T.sgFairy);
    for (const classic of [false, true]) for (const fp of [false, true]) {
      const M = buildSGMoves(fp, (fp ? sgF : sg105).moves);
      const L = buildSGLearn(T, PM, mvById, machines, classic);
      const evo = baseEvos(VG['heartgold-soulsilver'], 4, 493);
      const evoApplied = sgEvo(T, evo);
      const key = 'sacred-gold' + (classic ? '-classic' : '') + (fp ? '-fairy' : '');
      out.push([key, { fetched, sources: src('sgChanges', 'sgEvo', 'paPokemonMoves', 'paEvolution'),
        checks: { moves: Object.assign({ against: fp ? SRC.sgFairy : SRC.sgCalc }, M.check),
          learnsets: classic ? 'HG/SS learnsets: the Classic version "excludes any changes made directly to Pokémon (stats, types, TM compatibility, level up move changes etc)"'
            : sgLearnCheck(L, sg105.poks),
          evolutionChangesApplied: evoApplied },
        notes: L.issues, moves: M.moves, machines, learn: L.learn, evo,
        items: { sections: sgItems(T), tmChanges: [] }, base: baseDiffs(key, 4, 493) }]);
    }
  }
  // Platinum Kaizo
  {
    const R = pkMoveResolver(T);
    const M = buildPKMoves(R);
    const L = buildPKLearn(T, R);
    const E = buildPKEvo(T);
    out.push(['platinum-kaizo', { fetched, sources: src('pkMoves', 'pkMoveChanges', 'pkLevel', 'pkTM', 'pkEvo'),
      checks: { moves: 'single source (the Mastersheet\'s Moves tab, a full table)', movesListedAsChanged: M.changedListed, movesReplaced: M.replaced,
        learnsets: 'single source (the Mastersheet\'s learnset tabs, full tables)' },
      notes: L.issues.concat(E.issues), customMoves: M.customNames, moves: M.moves, machines: L.machines, learn: L.learn, evo: E.evo,
      items: { sections: [], tmChanges: tmChanges(L.machines, machinesFor(T, VG.platinum)) }, base: baseDiffs('platinum-kaizo', 4, 493) }]);
  }
  // Run & Bun
  {
    const M = buildRBMoves(T, JSON.parse(T.rbCalc).moves);
    const L = buildRBLearn(T);
    const E = buildRBEvo(T);
    out.push(['run-and-bun', { fetched, sources: src('rbMoves', 'rbLevel', 'rbLevelPtr', 'rbTeach', 'rbTeachPtr', 'rbEvo', 'rbSpecies'),
      checks: { moves: Object.assign({ against: SRC.rbCalc }, M.check), learnsets: 'single source (dekzeh\'s own data files)' },
      notes: M.issues.concat(L.issues, E.issues), moves: M.moves, machines: null, learn: L.learn, evo: E.evo,
      items: { sections: [], tmChanges: [] }, base: baseDiffs('run-and-bun', 8, 905) }]);
  }
  // Emerald Kaizo
  {
    const E = ekMoveTable(T, mvById);
    const M = buildEKMoves(E, calcObj(T.ekCalc).moves);
    const L = buildEKLearn(T, E);
    out.push(['emerald-kaizo', { fetched, sources: src('ekMoves', 'ekDb', 'ekState', 'paEvolution'),
      checks: { moves: Object.assign({ against: SRC.ekCalc }, M.check), learnsets: 'single source (emerald-kaizo-db, read from the ROM by its author)',
        evolutions: 'Emerald\'s: no Emerald Kaizo source documents evolution changes' },
      notes: E.ambiguous.map(a => a + " names more than one move; shown as the one PokeAPI agrees with"), customMoves: E.customNames, moves: M.moves, machines: L.machines, learn: L.learn, evo: baseEvos(VG.emerald, 3, 386),
      items: { sections: [], tmChanges: tmChanges(L.machines, machinesFor(T, VG.emerald)) }, base: baseDiffs('emerald-kaizo', 3, 386) }]);
  }
  // FireRed Omega
  {
    const fro = calcObj(T.froCalc);
    const M = buildFROMoves(fro.moves);
    const L = buildFROLearn(fro.poks);
    out.push(['firered-omega', { fetched, sources: src('froCalc', 'paPokemonMoves', 'paEvolution'),
      checks: { moves: 'FireRed/LeafGreen values, with the calculator data\'s type and base power where it has the move', learnsets: 'single source (hzla Dynamic Calc data)',
        evolutions: 'FireRed/LeafGreen\'s: no FireRed Omega source documents evolution changes' },
      notes: [], moves: M.moves, machines: machinesFor(T, VG['firered-leafgreen']), learn: L.learn, evo: baseEvos(VG['firered-leafgreen'], 3, 386),
      items: { sections: [], tmChanges: [] }, base: baseDiffs('firered-omega', 3, 386) }]);
  }

  const bad = Object.keys(unresolvedMoves).filter(k => !/check only/.test(k));
  if (bad.length) throw new Error('move names not resolved:\n' + bad.map(k => '  ' + k + ': ' + [...unresolvedMoves[k]].join(', ')).join('\n'));
  let stale = 0;
  out.forEach(([key, d]) => {
    if (!write(key, d, check)) stale++;
    const mc = d.checks.moves && typeof d.checks.moves === 'object' ? ' | moves vs calc: ' + d.checks.moves.compared + ' compared, type ' + d.checks.moves.type.length + ', power ' + d.checks.moves.power.length + ', category ' + d.checks.moves.category.length : '';
    const lc = d.checks.learnsets && typeof d.checks.learnsets === 'object' ? ' | learnsets vs calc: ' + d.checks.learnsets.compared + ' compared, level-up differ ' + d.checks.learnsets.levelDiffer.length + ', TM differ ' + d.checks.learnsets.tmDiffer.length : '';
    console.log(key.padEnd(30) + String(Object.keys(d.moves).length).padStart(4) + ' moves, ' + String(Object.keys(d.learn).length).padStart(4) + ' learnsets, ' +
      String(Object.keys(d.evo).length).padStart(4) + ' evolving species, ' + d.notes.length + ' notes' + mc + lc);
  });
  if (Object.keys(unresolvedMoves).length) console.log('check-only names not resolved: ' + Object.keys(unresolvedMoves).map(k => k + ': ' + [...unresolvedMoves[k]].slice(0, 12).join(', ')).join(' | '));
  if (check) { console.log(stale ? 'STALE: ' + stale + ' hack data files differ' : 'check: every hack data file matches its sources'); process.exit(stale ? 1 : 0); }
}
module.exports = { moveSlug, MOVE_ALIASES, resolveConfigPre, applySGLevel, evoText, calcLearnCheck };
if (require.main === module) main().catch(e => { console.error(e.stack || e); process.exit(1); });
