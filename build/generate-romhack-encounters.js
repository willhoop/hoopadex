#!/usr/bin/env node
/* HoopaDex — ROM hacks: wild encounters, area by area
 * Run: node build/generate-romhack-encounters.js          (fetch every source, write app/hacks/*.encounters.json)
 *      node build/generate-romhack-encounters.js --check  (fetch again, exit 1 if any file is stale)
 *
 * Asked for from the live site: "we need trainer docs and encounter docs as well".
 *
 *   hack                source                                              order of areas
 *   Renegade Platinum   Drayano's "Wild Pokémon" (pastebin, his own)         the document's
 *   Sacred Gold         Drayano's "Pokemon Locations" (archived copy)        "in order of accessibility" (the doc)
 *   Platinum Kaizo      the Mastersheet's "Encounters" tab                   the sheet's columns
 *   Run & Bun           dekzeh's wild_encounters.json (the game's own data)  the game's map table
 *   Emerald Kaizo       emerald-kaizo-db encounters.json                     the database's
 *   FireRed Omega       none published - the file says so
 *
 * An area is {name, levels, methods: [{m, rows: [[species id, name, rate %, levels]]}]}. A rate the
 * source does not give (Sacred Gold's Meridian and Pastoral Sounds) is null. A species that fills
 * several slots in the game's table (Run & Bun) is one row with the slots' rates added.
 */
const fs = require('fs');
const path = require('path');
const RH = require('./generate-romhacks.js');
const { flat, speciesId, csvRows } = RH;

const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, 'app', 'hacks');
const SRC = {
  rpWild: 'https://pastebin.com/raw/BATgGpHa',
  sgWild: 'https://raw.githubusercontent.com/zhenga8533-archive/sgss-wiki/main/data/documentation/Pokemon%20Locations.txt',
  pkEnc: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=2081860737',
  rbWild: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/locations/wild_encounters.json',
  ekEnc: 'https://raw.githubusercontent.com/Isotarge/emerald-kaizo-db/main/src/encounters.json',
  rrData: RH.URL.rrData,
};
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

const unresolved = new Set();
const SPECIES_ERRATA = {};
/* "Nidoran♀" IS the species; a symbol after a space ("Zigzagoon ♂") is only that Pokémon's gender. */
function sid(name) {
  const n = String(name).replace(/\s+[♂♀]\s*$/, '').trim();
  /* A form ("Zigzagoon Galarian", "Vivillon Fancy") is drawn as its species for now; the name keeps the form. */
  const id = speciesId(SPECIES_ERRATA[flat(n)] || n) || speciesId(n.split('-')[0]) || speciesId(n.split(' ')[0]);
  if (!id) unresolved.add(name);
  return id || 0;
}
const title = s => String(s).toLowerCase().replace(/(^|[\s(-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
/* "Starly (30%), Bidoof (30%)" or "Furret, Raticate" -> rows. */
/* A tag after a name is kept on the row and left out of the lookup: "Illumise [SG]" is Sacred Gold
   only, "Relicanth (Fish)" is caught by fishing. "(See near bottom for Bell Tower)." is a note. */
const VERSION_TAG = { SG: 'Sacred Gold', SS: 'Storm Silver', 'SG/SS': 'both versions' };
function listRows(txt, lv) {
  return txt.split(/,\s*(?![^()\[]*[)\]])/).map(x => x.trim()).filter(x => x && !/^\(.*\)\.?$/.test(x) && !/^(-+|None|#REF!)$/i.test(x)).map(x => {
    const m = x.match(/^(.+?)\s*\((\d+)%\)$/);
    let name = (m ? m[1] : x).trim();
    const tag = name.match(/\s*[\[(]([^\])]+)[\])]$/);
    const base = tag ? name.slice(0, tag.index).trim() : name;
    if (tag) name = base + ' (' + (VERSION_TAG[tag[1]] || tag[1]) + ')';
    return [sid(base), name, m ? +m[2] : null, lv || ''];
  });
}
/* Rows for the same species within one method are added together. */
function mergeRows(rows) {
  const by = new Map();
  rows.forEach(r => {
    const k = r[1];
    if (!by.has(k)) { by.set(k, r.slice()); return; }
    const x = by.get(k);
    if (x[2] !== null && r[2] !== null) x[2] += r[2];
    const lv = new Set(String(x[3]).split(/,\s*/).concat(String(r[3]).split(/,\s*/)).filter(Boolean));
    x[3] = [...lv].join(', ');
  });
  return [...by.values()].sort((a, b) => (b[2] || 0) - (a[2] || 0));
}
/* Fishing levels Drayano states once for the whole hack ("Old Rod is Lv. 10 ..."). */
function rodLevels(txt) {
  const out = {};
  txt.replace(/(Old|Good|Super) Rod is Lv\. (\d+)/g, (a, r, l) => { out[r + ' Rod'] = l; return a; });
  return out;
}

// ==== Renegade Platinum ==========================================================================================
function parseRP(txt) {
  const lines = txt.replace(/\r/g, '').split('\n');
  const rods = rodLevels(txt);
  const start = lines.findIndex(l => /^Area Changes/.test(l));
  const areas = [];
  for (let i = start + 2; i < lines.length; i++) {
    const l = lines[i];
    if (!/^Levels:/.test(lines[i + 1] || '') || !l.trim()) continue;
    const area = { name: l.trim(), levels: lines[i + 1].replace(/^Levels:\s*/, '').trim(), methods: [] };
    const walk = (area.levels.match(/(\d+\s*-\s*\d+)\s*\(Walking\)/) || [])[1] || '';
    const surf = (area.levels.match(/(\d+\s*-\s*\d+)\s*\(Surfing\)/) || [])[1] || '';
    i += 3;
    for (; i < lines.length && lines[i].trim(); i++) {
      const m = lines[i].match(/^(\S.*?)\s{2,}(\S.*)$/);
      if (!m) continue;
      const meth = m[1].trim();
      const lv = rods[meth] || (meth === 'Surf' ? surf : /Rock Smash|Honey|Headbutt/.test(meth) ? '' : walk);
      area.methods.push({ m: meth, rows: listRows(m[2], lv) });
    }
    if (area.methods.length) areas.push(area);
  }
  return areas;
}

// ==== Sacred Gold / Storm Silver ===================================================================================
function parseSG(txt) {
  const lines = txt.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(l => /^Encounters\s*$/.test(l));
  const areas = [];
  let area = null, meth = null, buf = '';
  /* A heading with nothing under it (Route 47 has "Grass, Morning / Day*:" then "Day*:") is not kept. */
  const flush = () => { if (area && meth && buf.trim()) area.methods.push({ m: meth, rows: listRows(buf, /Rod|Rock Smash/.test(meth) ? '' : area.walk) }); meth = null; buf = ''; };
  for (let i = start + 2; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^((Sacred Gold|Storm Silver) )?Wild Levels:/.test(lines[i + 1] || '') && l && !/:$/.test(l)) {
      flush();
      area = { name: l, levels: '', methods: [], walk: '' };
      areas.push(area);
      continue;
    }
    if (/^((Sacred Gold|Storm Silver) )?Wild Levels:/.test(l)) {
      const v = l.replace(/^.*Wild Levels:\s*/, '').replace(/\s*–\s*/g, ' - ');
      area.levels = (area.levels ? area.levels + '; ' : '') + l.replace(/Wild Levels:\s*/, '').replace(/\s*–\s*/g, ' - ');
      if (!area.walk && /\d/.test(v)) area.walk = v;
      continue;
    }
    if (!area) continue;
    if (/^\*/.test(l)) { area.levels += (area.levels ? ' · ' : '') + l.replace(/^\*\s*/, ''); continue; }   // "* Not accessible without Waterfall."
    if (/:$/.test(l)) {
      const next = l.replace(/:$/, '').replace(/\s*\/\s*/g, ' / ');
      /* Route 47 repeats the end of a heading on the next line ("Grass, Morning / Day*:", "Day*:"):
         the list belongs to the first, fuller heading. */
      if (meth && !buf.trim() && meth.endsWith(next)) continue;
      flush(); meth = next; continue;
    }
    /* A stray first word of the next heading ("Super" before "Super Rod:"; "Meridian" before
       "Meridian Sound:") is a typing slip in the document, not a Pokémon. */
    const nx = (lines[i + 1] || '').trim();
    if (/:$/.test(nx) && /^[A-Z][a-z]+$/.test(l) && nx.startsWith(l + ' ')) continue;
    if (!l) { flush(); continue; }
    if (meth) buf += (buf && !/[,(]$/.test(buf.trim()) ? ' ' : '') + l;
  }
  flush();
  areas.forEach(a => { delete a.walk; });
  return areas.filter(a => a.methods.length);
}

// ==== Platinum Kaizo: the Encounters grid ============================================================================
/* Row 2 names each area, two columns per area (species, level). A row with text only in column A
   starts a method (Grass, Day, Night, Surf, Old Rod ...); each row under it is "rate%, species, level"
   for every area. Day and Night replace two Grass slots, as in Platinum. */
function parsePK(csv) {
  const rows = csvRows(csv).map(r => r.map(c => (c || '').trim()));
  const names = rows[1];
  const cols = [];
  for (let c = 1; c < names.length; c += 2) if (names[c]) cols.push(c);
  const areas = cols.map(c => ({ name: names[c], levels: '', methods: [], c }));
  let meth = null;
  for (let i = 2; i < rows.length; i++) {
    const r = rows[i];
    if (r[0] && !/%$/.test(r[0]) && r.slice(1).every(x => !x)) { meth = r[0]; continue; }
    if (!meth || !/%$/.test(r[0])) continue;
    const rate = parseInt(r[0], 10);
    areas.forEach(a => {
      const sp = r[a.c], lv = r[a.c + 1];
      if (!sp || /^-+$/.test(sp) || /#REF!/.test(sp + lv)) return;   // "#REF!": a broken formula in the sheet itself
      let mm = a.methods.find(x => x.m === meth);
      if (!mm) { mm = { m: meth, rows: [] }; a.methods.push(mm); }
      mm.rows.push([sid(sp), sp.replace(/�/g, '\''), rate, lv]);
    });
  }
  areas.forEach(a => { delete a.c; a.methods.forEach(m => { m.rows = mergeRows(m.rows); }); });
  return areas.filter(a => a.methods.length);
}

// ==== Run & Bun: the game's wild_encounters.json =========================================================================
const RB_METHOD = { land_mons: 'Grass', water_mons: 'Surf', rock_smash_mons: 'Rock Smash', fishing_mons: 'Fishing' };
function parseRB(json) {
  const g = JSON.parse(json).wild_encounter_groups[0];
  const rates = {}, groups = {};
  g.fields.forEach(f => { rates[f.type] = f.encounter_rates; groups[f.type] = f.groups || null; });
  const byMap = new Map();
  g.encounters.forEach(e => {
    // MAP_ROUTE101 -> Route 101; MAP_GRANITE_CAVE_B1F -> Granite Cave B1F
    const name = title(e.map.replace(/^MAP_/, '').replace(/_/g, ' ').replace(/ROUTE(\d)/, 'ROUTE $1')).replace(/\b(B?\d+[FR])\b/gi, m => m.toUpperCase());
    const area = byMap.get(name) || { name, levels: '', methods: [] };
    byMap.set(name, area);
    Object.keys(RB_METHOD).forEach(t => {
      if (!e[t]) return;
      const mons = e[t].mons;
      const parts = groups[t] ? Object.entries(groups[t]).map(([k, idx]) => [title(k.replace(/_/g, ' ')), idx]) : [[RB_METHOD[t], mons.map((_, i) => i)]];
      parts.forEach(([label, idx]) => {
        const rows = idx.map(i => { const x = mons[i]; if (!x) return null; const sp = title(x.species.replace(/^SPECIES_/, '').replace(/_/g, ' ')); return [sid(sp), sp, rates[t][i], x.min_level === x.max_level ? String(x.min_level) : x.min_level + '-' + x.max_level]; }).filter(Boolean);
        const sum = idx.reduce((a, i) => a + rates[t][i], 0);
        rows.forEach(r => { r[2] = Math.round(r[2] * 100 / sum); });   // a group's slots are its own 100%
        area.methods.push({ m: label, rows: mergeRows(rows) });
      });
    });
  });
  return [...byMap.values()].filter(a => a.methods.length);
}

// ==== Emerald Kaizo ========================================================================================================
const EK_METHOD = { grass: 'Grass', surf: 'Surf', oldRod: 'Old Rod', goodRod: 'Good Rod', superRod: 'Super Rod' };
function parseEK(json) {
  return JSON.parse(json).map(l => {
    const area = { name: l.name, levels: '', methods: [] };
    l.rooms.forEach(room => Object.keys(EK_METHOD).forEach(k => {
      if (!room[k] || !room[k].length) return;
      const label = EK_METHOD[k] + (room.name && room.name !== 'main' ? ' (' + room.name + ')' : '');
      area.methods.push({ m: label, rows: mergeRows(room[k].map(x => [sid(x.name), x.name, x.encounterChance, String(x.level)])) });
    }));
    return area;
  }).filter(a => a.methods.length);
}

// ==== Radical Red ==============================================================================================================
/* Each list is keyed by the level cap from which it applies ("0" = from the start). Wild lists are
   slots: [species, min level, max level], one per slot, in FireRed's slot order. */
function parseRR(text) {
  const RRS = require('./rr-source.js');
  const RR = RRS.parse(text);
  const capName = {}; Object.keys(RR.o.caps).forEach(n => { capName[RR.o.caps[n].ID] = n.replace(/-(\d+)$/, ' $1').replace(/-/g, ' '); });
  const nm = id => { const s = RR.species[id]; return s ? RR.displayName(s) : null; };
  const row = (id, rate, lv) => { const n = nm(id); if (!n) return null; const s = RR.species[id]; return [s.dexID >= 1 && s.dexID <= 1025 ? s.dexID : 0, n, rate, lv]; };
  const SLOTS = { 'wild-day': ['Grass (day)', 'land'], 'wild-night': ['Grass (night)', 'land'], 'wild-surf': ['Surf', 'water'], 'wild-smash': ['Rock Smash', 'smash'],
    'wild-oldRod': ['Old Rod', 'oldRod'], 'wild-goodRod': ['Good Rod', 'goodRod'], 'wild-superRod': ['Super Rod', 'superRod'] };
  const FIXED = { 'fixed-gift': 'Gift', 'fixed-trade': 'Trade', 'fixed-overworld': 'Static', 'fixed-roaming': 'Roaming',
    raid1: 'Raid 1★', raid2: 'Raid 2★', raid3: 'Raid 3★', raid4: 'Raid 4★', raid5: 'Raid 5★', raid6: 'Raid 6★' };
  const after = c => (+c ? ' (after ' + capName[+c] + ')' : '');
  return RR.V(RR.o.areas).map(a => {
    const area = { name: a.name.trim(), levels: '', methods: [] };
    Object.keys(SLOTS).forEach(k => {
      if (!a[k]) return;
      const [label, kind] = SLOTS[k], rates = RRS.SLOT_RATES[kind];
      Object.keys(a[k]).forEach(c => {
        const rows = a[k][c].map((s, i) => row(s[0], rates[i] === undefined ? null : rates[i], s[1] === s[2] ? String(s[1]) : s[1] + '-' + s[2])).filter(Boolean);
        if (rows.length) area.methods.push({ m: label + after(c), rows: mergeRows(rows) });
      });
    });
    Object.keys(FIXED).forEach(k => {
      if (!a[k]) return;
      Object.keys(a[k]).forEach(c => {
        const ids = a[k][c].map(x => (Array.isArray(x) ? x[0] : x));
        const rows = [...new Set(ids)].map(id => row(id, null, '')).filter(Boolean);
        if (rows.length) area.methods.push({ m: FIXED[k] + after(c), rows });
      });
    });
    return area;
  }).filter(a => a.methods.length);
}

// ---- write ------------------------------------------------------------------------------------------------------------------
function validate(key, doc) {
  if (doc.areas.length < 20) throw new Error(key + ': only ' + doc.areas.length + ' areas read - the source format has probably changed');
  /* A method the source lists as "None" (Renegade Platinum's Route 221 Poké Radar) is left out. */
  doc.areas.forEach(a => { a.methods = a.methods.filter(m => m.rows.length); });
  doc.areas = doc.areas.filter(a => a.methods.length);
  doc.areas.forEach(a => a.methods.forEach(m => {
    const total = m.rows.reduce((s, r) => s + (r[2] || 0), 0);
    /* Under 100% is normal (Platinum Kaizo's Day and Night rows are two of Grass's slots; the Poké
       Radar is one); over 100% is not possible and means a parse went wrong. */
    if (total > 105) doc.rateNotes.push(a.name + ' / ' + m.m + ': rates add to ' + total + '%');
  }));
}
function write(key, doc, check) {
  doc.rateNotes = [];
  validate(key, doc);
  const file = path.join(OUTDIR, key + '.encounters.json');
  const next = JSON.stringify(Object.assign({ about: 'Generated by build/generate-romhack-encounters.js. Do not edit by hand.', key }, doc)) + '\n';
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
  const out = [
    ['renegade-platinum', { fetched, sources: [SRC.rpWild], note: 'From Drayano\'s Wild Pokémon document, in its order. Fishing levels are the ones he states for the whole game.', areas: parseRP(T.rpWild) }],
    ['sacred-gold', { fetched, sources: [SRC.sgWild], note: 'From Drayano\'s Pokemon Locations document, which lists areas "in order of accessibility". The Meridian and Pastoral Sounds have no rates in it.', areas: parseSG(T.sgWild) }],
    ['platinum-kaizo', { fetched, sources: [SRC.pkEnc], note: 'From the Platinum Kaizo Mastersheet\'s Encounters tab. Gifts, trades and static encounters are on the sheet\'s Non-Wild Encounters tab, not here yet.', areas: parsePK(T.pkEnc) }],
    ['run-and-bun', { fetched, sources: [SRC.rbWild], note: 'From the game\'s own encounter table (dekzeh\'s data), in the game\'s map order, which is not always the order you reach areas in.', areas: parseRB(T.rbWild) }],
    ['emerald-kaizo', { fetched, sources: [SRC.ekEnc], note: 'From emerald-kaizo-db, read from the game by its author.', areas: parseEK(T.ekEnc) }],
    ['radical-red', { fetched, sources: [SRC.rrData, 'https://raw.githubusercontent.com/pret/pokefirered/master/src/data/wild_encounters.json'],
      note: 'From the Radical Red Dex data (single source), in its map order. The data lists slots; each slot\'s chance is FireRed\'s, which Radical Red\'s engine keeps. Gifts, trades, static, roaming and raid Pokémon are listed without chances.', areas: parseRR(T.rrData) }],
  ];
  if (unresolved.size) console.log('species names not resolved (shown without a picture): ' + [...unresolved].join(', '));
  let stale = 0;
  out.forEach(([key, d]) => {
    if (!write(key, d, check)) stale++;
    const n = d.areas.reduce((s, a) => s + a.methods.reduce((t, m) => t + m.rows.length, 0), 0);
    console.log(key.padEnd(20) + String(d.areas.length).padStart(4) + ' areas, ' + String(n).padStart(5) + ' rows, ' + d.rateNotes.length + ' rate notes');
  });
  if (check) { console.log(stale ? 'STALE: ' + stale + ' encounter files differ' : 'check: every encounter file matches its sources'); process.exit(stale ? 1 : 0); }
}
module.exports = { parseRP, parseSG, parsePK, parseRB, parseEK, listRows, mergeRows };
if (require.main === module) main().catch(e => { console.error(e.stack || e); process.exit(1); });
