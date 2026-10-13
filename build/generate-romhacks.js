#!/usr/bin/env node
/* HoopaDex — ROM hacks: each hack's own types, base stats and abilities
 * Run: node build/generate-romhacks.js          (fetch every source, write app/hacks/*.json)
 *      node build/generate-romhacks.js --check  (fetch again, exit 1 if any file is stale)
 *
 * Asked for from the live site: "add emerald kaizo and platinum kaizo. omega fire red, sacred gold,
 * renegade platinum (the drayano games) run and bun", then "have those be in its own romhack
 * section", and "some games (like ren) have different patches that do things like add fairy type,
 * lets add that toggle".
 *
 * PokeAPI and Showdown know nothing about ROM hacks, so every hack needs its own source. Where the
 * hack's author publishes data, that is the source; where only community data exists, that is said.
 * Every hack is also compared with a SECOND source, and the comparison is written into its file:
 *
 *   hack                source (primary)                                   checked against
 *   Renegade Platinum   Drayano's "Pokémon Changes" (pastebin, his own)    hzla Dynamic Calc data
 *   Sacred Gold         Drayano's "Pokemon Changes" (archived text copy)   hzla Dynamic Calc data (v1.05)
 *   Platinum Kaizo      the author's Mastersheet (Google Sheets, CSV)      - (single source)
 *   Run & Bun           dekzeh's own data repo (pokeemerald-expansion)     hzla Dynamic Calc data
 *   Emerald Kaizo       Isotarge/emerald-kaizo-db (community, MIT)         hzla Dynamic Calc data
 *   FireRed Omega       hzla Dynamic Calc data (community; no author docs exist)   - (single source)
 *
 * Three sources list only CHANGES (Renegade Platinum, Sacred Gold) or only part of a record
 * (FireRed Omega), so each species starts from its base game - read through the app's own
 * generation tables, sliced out of app/index.html - and the documented changes are applied on top.
 *
 * Variants, from the authors' documentation:
 *   Renegade Platinum   Complete (default) / Classic - Classic drops every change tagged "(Complete)"
 *   Sacred Gold         Complete (default) / Classic - Classic removes all Pokémon data edits
 *                       + Fairy patch (mikelan98's v1.1): retypes the Gen VI Fairy species
 *
 * Phase 1 covers species, not alternate forms; forms keep their base game's data. Learnsets, wild
 * encounters, evolutions and trainers are later phases.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const OUTDIR = path.join(ROOT, 'app', 'hacks');
const DEX = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'dex-index.json'), 'utf8'));
const ABIL = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'abilities-index.json'), 'utf8')).abilities.map(a => a[0]);

const URL = {
  rpChanges: 'https://pastebin.com/raw/uw0pkBWN',
  rpCalc: 'https://raw.githubusercontent.com/hzla/Dynamic-Calc/master/backups/rp.js',
  sgChanges: 'https://raw.githubusercontent.com/zhenga8533-archive/sgss-wiki/main/data/documentation/Pokemon%20Changes.txt',
  sgCalc: 'https://api.npoint.io/03e577af7cc9856a1f42',
  sgFairy: 'https://raw.githubusercontent.com/hzla/Dynamic-Calc/master/backups/sgss.js',
  /* The plain export, NOT the gviz one: gviz blanks every cell whose format does not match its
     column, and this sheet writes changed stats as "92 (+10)" - so gviz silently dropped exactly the
     hack's changes (208 species). The plain export returns the first tab, which is checked below. */
  pkSheet: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv',
  rbStats: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/species/base_stats.h',
  rbSpecies: 'https://raw.githubusercontent.com/dekzeh/runandbundex/master/species/species.h',
  rbCalc: 'https://api.npoint.io/8c3ca30ba346734d5e4f',
  ekDb: 'https://raw.githubusercontent.com/Isotarge/emerald-kaizo-db/main/src/pkmn.json',
  ekCalc: 'https://raw.githubusercontent.com/hzla/Dynamic-Calc/master/backups/ek.js',
  froCalc: 'https://raw.githubusercontent.com/hzla/Dynamic-Calc/master/backups/fro.js',
};

async function get(url) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'hoopadex-build' } });
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return await r.text();
    } catch (e) { if (t >= 4) throw e; await new Promise(res => setTimeout(res, 800 * t)); }
  }
}
const calcObj = txt => (0, eval)('(' + txt.slice(txt.indexOf('{')).replace(/;\s*$/, '') + ')');

// ---- names ------------------------------------------------------------------------------------
const flat = s => String(s).toLowerCase().replace(/♀/g, 'f').replace(/♂/g, 'm').replace(/é/g, 'e').replace(/[^a-z0-9]/g, '');
const SPECIES = DEX.pokemon.filter(r => r[0] <= 1025);
const byFlat = {};
SPECIES.forEach(r => { byFlat[flat(r[1])] = r[0]; });
/* PokeAPI names a few species by their default form (deoxys-normal, giratina-altered). */
function speciesId(name) {
  const f = flat(name);
  if (byFlat[f]) return byFlat[f];
  const pre = SPECIES.find(r => flat(r[1]).indexOf(f) === 0 && r[1].indexOf('-') > 0 && flat(r[1].split('-')[0]) === f);
  return pre ? pre[0] : 0;
}
const TYPES = new Set(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground', 'flying',
  'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']);
function typeName(t) { const x = String(t).trim().toLowerCase().replace(/^type_/, ''); if (!TYPES.has(x)) throw new Error('unknown type ' + t); return x; }
const abilByFlat = {};
ABIL.forEach(a => { abilByFlat[flat(a)] = a; });
/* Misspellings in the sources themselves, each named with where it is. Anything else unrecognised
   stops the build: an unknown name is either a typo to add here or a custom ability to decide on. */
const SOURCE_TYPOS = {
  intimdate: 'intimidate',   // Renegade Platinum "Pokémon Changes", two "Old" ability lines (Ekans line)
};
Object.keys(SOURCE_TYPOS).forEach(k => { abilByFlat[k] = SOURCE_TYPOS[k]; });
const unknownAbilities = new Set();
function abilityName(a) {
  const s = String(a || '').trim().replace(/^ABILITY_/, '');
  if (!s || /^(none|-|---|~)$/i.test(s)) return '';
  const hit = abilByFlat[flat(s)];
  if (!hit) { unknownAbilities.add(s); return flat(s); }
  return hit;
}
const STAT_ORDER = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

// ---- the base game, read through the app's own tables ---------------------------------------------
function appBase() {
  const src = fs.readFileSync(APP, 'utf8');
  const lines = src.split(/\r?\n/);
  /* A top-level `const X=` that may run over several lines: up to the first line ending in `;`. */
  const line = s => {
    const i = lines.findIndex(x => x.startsWith(s));
    if (i < 0) throw new Error('missing ' + s);
    let j = i;
    while (!/;\s*(\/\*.*\*\/)?\s*$/.test(lines[j])) j++;
    return lines.slice(i, j + 1).join('\n');
  };
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('missing ' + a); return src.slice(i, j); };
  const fn = n => cut('function ' + n + '(', '\n}\n') + '\n}\n';
  const code = 'var BASEGEN=9;function getDataGenNum(){return BASEGEN}\n' +
    line('const POKEMON_PAST_TYPES=') + '\n' + line('const PAST_STATS=') + '\n' + line('const GEN1_SPECIAL=') + '\n' +
    line('const PASTABIL=') + '\n' + fn('filterTypesForGen') + fn('getStatsForGen') + fn('pastAbilityOverrides') + fn('applyPastAbilities') +
    ';({setGen(g){BASEGEN=g},filterTypesForGen,getStatsForGen,applyPastAbilities})';
  return (0, eval)(code);
}
const APPF = appBase();
const STAT_NAMES = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
/* A species as its base game had it: [types, [hp, atk, def, spa, spd, spe], [ability 1, ability 2, hidden]]. */
function baseRecord(id, gen, opts) {
  const r = SPECIES.find(x => x[0] === id);
  APPF.setGen(gen);
  const types = APPF.filterTypesForGen(r[2].slice(), gen, id);
  const st = APPF.getStatsForGen({ id, stats: r[3].map((b, i) => ({ base_stat: b, stat: { name: STAT_NAMES[i] } })) });
  const stats = STAT_NAMES.map(n => st.find(s => s.stat.name === n).base_stat);
  const now = (r[8] || ['', '', '']).map((a, i) => a ? { ability: { name: a }, is_hidden: i === 2, slot: i === 2 ? 3 : i + 1 } : null).filter(Boolean);
  const then = APPF.applyPastAbilities(r[1], now, (opts && opts.abilityGen) || gen);
  const ab = ['', '', ''];
  then.forEach(a => { const i = a.is_hidden ? 2 : a.slot - 1; if (i >= 0 && i < 3) ab[i] = a.ability.name; });
  if (((opts && opts.abilityGen) || gen) < 5) ab[2] = '';      // hidden abilities arrived in Generation V
  return [types, stats, ab];
}
const sameTypes = (a, b) => a.join('/') === b.join('/');

// ---- comparisons ------------------------------------------------------------------------------------
/* types / stats list the UNEXPLAINED disagreements. A disagreement is explained when the primary
   source states the value outright and is consistent with itself - for Sacred Gold, the author's
   doc sets that field and its own stated Total agrees - which makes the second source the stale one.
   Those are kept, with the reason, under "explained", so nothing is hidden. */
function compare(label, rec, other, explain) {
  const res = { against: label, compared: 0, types: [], stats: [], explained: [] };
  Object.keys(rec).forEach(id => {
    const o = other[id];
    if (!o) return;
    res.compared++;
    const differ = f => {
      const why = explain ? explain(+id, f, o) : null;
      if (why) res.explained.push({ id: +id, field: f, ours: f === 'types' ? rec[id][0] : rec[id][1], theirs: f === 'types' ? o.types : o.stats, why });
      else res[f].push(+id);
    };
    if (o.types && !sameTypes(rec[id][0], o.types)) differ('types');
    if (o.stats && rec[id][1].join() !== o.stats.join()) differ('stats');
  });
  return res;
}
/* Dynamic Calc's species records -> {id: {types, stats}}. */
function calcSpecies(poks) {
  const out = {};
  Object.keys(poks).forEach(name => {
    const id = speciesId(name);
    if (!id || out[id]) return;
    const p = poks[name];
    const bs = p.bs || {};
    out[id] = {
      types: p.types ? p.types.map(typeName) : null,
      stats: bs.hp !== undefined ? [bs.hp, bs.at, bs.df, bs.sa, bs.sd, bs.sp] : null,
    };
  });
  return out;
}

// ==== Renegade Platinum ===================================================================================
function parseDrayanoRP(txt) {
  const out = {};
  const blocks = txt.split(/\n(?=\d{3} - .+\r?\n=+)/);
  blocks.forEach(b => {
    const h = b.match(/^(\d{3}) - (.+)\r?\n=+/);
    if (!h) return;
    const id = +h[1];
    if (/\(/.test(h[2])) return;   // a form; phase 1 is species only
    const e = out[id] = out[id] || { name: h[2].trim() };
    /* A heading is "Field", then any number of "(qualifier)": a version tag - (Complete) or (Classic)
       - or a form - "(Plant Cloak)", "(Fan Rotom)". The second line should say "New"; two places
       (Volbeat, Illumise) repeat "Old", and the second line is taken as the new value and recorded. */
    const re = /^(Ability|Base Stats|Type)((?: \([^)]*\))*):\r?\nOld\s+(.+)\r?\n(New|Old)\s+(.+)$/gm;
    let m;
    while ((m = re.exec(b))) {
      const quals = (m[2].match(/\(([^)]*)\)/g) || []).map(q => q.slice(1, -1));
      const version = quals.includes('Complete') ? 'complete' : quals.includes('Classic') ? 'classic' : 'both';
      const form = quals.filter(q => q !== 'Complete' && q !== 'Classic')[0] || null;
      if (form && !isDefaultFormQualifier(id, form)) continue;
      if (m[4] === 'Old') (e.errata = e.errata || []).push(m[1] + ': the doc labels the new value "Old"');
      (e.changes = e.changes || []).push({ field: m[1], version, oldV: m[3].trim(), newV: m[5].trim() });
    }
  });
  return out;
}
/* "(Plant Cloak)" is Wormadam's default form, "(Regular Form)" Rotom's: those changes are the
   species'. Any other form waits for the forms phase. */
function isDefaultFormQualifier(id, q) {
  const row = SPECIES.find(x => x[0] === id);
  const suffix = row && row[1].indexOf('-') > 0 ? row[1].split('-').slice(1).join('') : '';
  const fq = flat(q);
  if (suffix && fq.indexOf(flat(suffix)) === 0) return true;
  return /^(regular|normal|ordinary|standard)(form|forme)?$/.test(fq);
}
/* "Levitate / Levitate" in the doc means one ability; the second slot is empty. */
const parseSlashAbilities = s => { const p = s.split('/').map(x => abilityName(x)); return [p[0] || '', p[1] && p[1] !== p[0] ? p[1] : '', '']; };
const parseSlashTypes = s => { const p = s.split('/').map(x => typeName(x)); return p[1] && p[1] !== p[0] ? [p[0], p[1]] : [p[0]]; };
function parseStatLine(s) {
  const v = {};
  s.split('/').forEach(part => { const m = part.trim().match(/^(\d+)\s+(HP|Atk|Def|SAtk|SDef|Spd)$/); if (m) v[m[2]] = +m[1]; });
  const o = [v.HP, v.Atk, v.Def, v.SAtk, v.SDef, v.Spd];
  if (o.some(x => x === undefined)) throw new Error('unreadable stat line: ' + s);
  return o;
}
/* Drayano's general changes name three Pokemon that take their Generation VII abilities. Read the
   sentence rather than trusting a copy of it: if it changes, the build stops. */
const RP_GEN7_ABILITIES = { 278: 'Wingull', 279: 'Pelipper', 324: 'Torkoal' };
/* Where Drayano's "Old" value is itself wrong, checked against the base game and Bulbapedia. */
const RP_DOC_ERRATA = {
  464: 'Rhyperior: the doc gives its old abilities as Lightning Rod / Rock Head; Platinum\'s are Lightning Rod / Solid Rock',
  279: 'Pelipper: the doc gives its old (Gen VII) abilities as Keen Eye / Hydration, which are Wingull\'s; Pelipper\'s are Keen Eye / Drizzle',
};
function buildRP(doc, classic, raw) {
  if (!/Wingull, Pelipper and Torkoal have gained their new abilities from Gen VII\./.test(raw)) throw new Error('Renegade Platinum: the Gen VII ability sentence has changed; re-read the general changes');
  const rec = {}, issues = [];
  for (let id = 1; id <= 493; id++) {
    /* Types and stats updated to Ultra Sun / Ultra Moon (general changes); abilities stay Platinum's
       unless changed, except the three named Pokemon, which take Generation VII's. */
    const usum = baseRecord(id, 7);
    const plat = baseRecord(id, 4, RP_GEN7_ABILITIES[id] ? { abilityGen: 7 } : undefined);
    const ab = plat[2].slice();
    if (RP_GEN7_ABILITIES[id]) ab[2] = '';   // a Gen IV engine has no hidden ability slot
    rec[id] = [usum[0], usum[1], ab];
  }
  let applied = 0, oldMismatch = 0;
  Object.keys(doc).forEach(k => {
    const id = +k, e = doc[k];
    /* A field can have two entries: "Ability (Complete):" for the Complete version and "Ability:" for
       Classic. Complete takes its own entry when there is one; Classic only ever takes untagged ones. */
    const byField = {};
    (e.changes || []).forEach(c => { (byField[c.field] = byField[c.field] || []).push(c); });
    Object.keys(byField).forEach(field => {
      const list = byField[field];
      const mine = classic ? 'classic' : 'complete';
      const c = list.find(x => x.version === mine) || list.find(x => x.version === 'both');
      if (!c) return;
      const r = rec[id];
      const mismatch = msg => { if (RP_DOC_ERRATA[id]) return; oldMismatch++; issues.push(id + ' ' + msg); };
      if (field === 'Ability') {
        const oldA = parseSlashAbilities(c.oldV);
        if (oldA.slice(0, 2).join() !== r[2].slice(0, 2).join()) mismatch('ability: doc says it was ' + c.oldV + ', base game has ' + r[2].slice(0, 2).join(' / '));
        r[2] = parseSlashAbilities(c.newV);
      } else if (field === 'Base Stats') {
        const oldS = parseStatLine(c.oldV);
        if (oldS.join() !== r[1].join()) mismatch('stats: doc says ' + oldS.join() + ', base game has ' + r[1].join());
        r[1] = parseStatLine(c.newV);
      } else if (field === 'Type') {
        const oldT = parseSlashTypes(c.oldV);
        if (!sameTypes(oldT, r[0])) mismatch('type: doc says ' + c.oldV + ', base game has ' + r[0].join(' / '));
        r[0] = parseSlashTypes(c.newV);
      }
      applied++;
    });
  });
  Object.keys(RP_DOC_ERRATA).forEach(id => issues.push(id + ' doc erratum: ' + RP_DOC_ERRATA[id]));
  Object.keys(doc).forEach(id => (doc[id].errata || []).forEach(x => issues.push(id + ' doc erratum: ' + x)));
  return { rec, applied, oldMismatch, issues };
}

// ==== Sacred Gold / Storm Silver ======================================================================
const SG_STAT = { 'HP': 0, 'Attack': 1, 'Defense': 2, 'Special Attack': 3, 'Special Defense': 4, 'Speed': 5 };
/* calcStats: {id: [six stats]} from the calculator data, used only to settle a contradiction INSIDE
   the doc - when an entry's stated Total does not match its listed stats. */
function buildSG(doc, classic, calcStats) {
  const rec = {}, issues = [], abilityNotes = {}, docBacked = new Set();
  for (let id = 1; id <= 493; id++) rec[id] = baseRecord(id, 4);
  if (classic) return { rec, applied: 0, oldMismatch: 0, issues, abilityNotes, docBacked };
  let applied = 0, oldMismatch = 0;
  const blocks = doc.split(/\n(?=#\d{3} )/);
  blocks.forEach(b => {
    const h = b.match(/^#(\d{3}) (.+)/);
    if (!h) return;
    const id = +h[1];
    if (id > 493) return;
    /* Forms are listed under the species number ("#479 Rotom Fan"). Phase 1 is species only, so a
       header counts when it names the species or its default form ("#413 Wormadam Plant"). */
    const row = SPECIES.find(x => x[0] === id);
    const hf = flat(h[2].trim());
    if (hf !== flat(row[1]) && hf !== flat(row[1].split('-')[0])) return;
    const r = rec[id];
    b.split(/\r?\n/).forEach(l => {
      let m;
      if ((m = l.match(/^\+ Type Change: (.+?) >> (.+)$/))) {
        const oldT = parseSlashTypes(m[1]);
        if (!sameTypes(oldT, r[0])) { oldMismatch++; issues.push(id + ' type: doc says ' + m[1] + ', base game has ' + r[0].join(' / ')); }
        r[0] = parseSlashTypes(m[2]); applied++; docBacked.add(id + '|types');
      } else if ((m = l.match(/^\+ Ability: (.+)$/))) {
        /* "{n}" replaces slot n; no braces is an addition, which in a two-slot game means the empty
           slot. When both slots are already full the doc does not say which one the new ability
           replaces, so neither is guessed: the base abilities stay and the doc's line is attached. */
        m[1].split(/,\s*/).forEach(part => {
          const mm = part.match(/^(.+?)\s*(?:\{(\d)\})?\s*$/);
          const a = abilityName(mm[1]);
          if (mm[2]) { r[2][+mm[2] - 1] = a; applied++; }
          else if (!r[2][1] && r[2][0] !== a) { r[2][1] = a; applied++; }
          else if (r[2][0] !== a && r[2][1] !== a) {
            (abilityNotes[id] = abilityNotes[id] || []).push(a);
            issues.push(id + ' ability "' + mm[1] + '" is added, but both slots are full (' + r[2].slice(0, 2).join(' / ') + '); not placed');
          }
        });
      } else if ((m = l.match(/^\+ Stat Change: (.+)$/))) {
        m[1].split(/,\s*/).forEach(part => {
          const mm = part.match(/^(.+?) \((\d+)\)$/);
          if (!mm) { issues.push(id + ' unreadable stat change: ' + part); return; }
          if (mm[1] === 'Total') return;
          if (!(mm[1] in SG_STAT)) { issues.push(id + ' unknown stat ' + mm[1]); return; }
          r[1][SG_STAT[mm[1]]] = +mm[2]; applied++;
        });
        const tot = m[1].match(/Total \((\d+)\)/);
        const sum = r[1].reduce((a, b) => a + b, 0);
        if (!tot || sum === +tot[1]) docBacked.add(id + '|stats');
        if (tot && sum !== +tot[1]) {
          const c = calcStats && calcStats[id];
          const csum = c ? c.reduce((a, b) => a + b, 0) : null;
          if (c && csum === +tot[1]) {
            issues.push(id + ' doc lists stats totalling ' + sum + ' but states ' + tot[1] + '; the calculator data totals ' + tot[1] + ' too, so its stats are used (' + c.join('/') + ')');
            r[1] = c.slice();
          } else {
            issues.push(id + ' doc lists stats totalling ' + sum + ' but states ' + tot[1] + '; unresolved, the listed stats are used');
          }
        }
      }
    });
  });
  return { rec, applied, oldMismatch, issues, abilityNotes, docBacked };
}

// ==== Platinum Kaizo ====================================================================================
function csvRows(txt) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
function buildPK(csv) {
  const rows = csvRows(csv);
  const head = rows[0];
  if (head[0] !== 'ID Number' || head[1] !== 'Name') throw new Error('Platinum Kaizo: the first tab is not the Personal table any more (' + head.slice(0, 3).join(',') + ')');
  const col = n => { const i = head.indexOf(n); if (i < 0) throw new Error('Platinum Kaizo sheet has no column ' + n); return i; };
  const C = { id: col('ID Number'), hp: col('HP'), at: col('Attack'), df: col('Defense'), sa: col('Sp. Atk'), sd: col('Sp. Def'),
    sp: col('Speed'), t1: col('Type 1'), t2: col('Type 2'), a1: col('Ability 1'), a2: col('Ability 2') };
  /* A changed stat reads "92 (+10)". The value is 92; 92 - 10 should be vanilla Platinum's, which is
     checked against the base game for every one - a check on the sheet and on this parse at once. */
  const deltaCheck = { checked: 0, disagree: [] };
  const rec = {};
  rows.slice(1).forEach(r => {
    const id = +r[C.id];
    if (!(id >= 1 && id <= 493)) return;
    const base = baseRecord(id, 4);
    const stats = [C.hp, C.at, C.df, C.sa, C.sd, C.sp].map((ci, k) => {
      const cell = String(r[ci]).trim();
      const m = cell.match(/^(\d+)(?:\s*\(([+-]\d+)\))?$/);
      if (!m) throw new Error('Platinum Kaizo #' + id + ': unreadable stat "' + cell + '"');
      const v = +m[1];
      if (!(v > 0)) throw new Error('Platinum Kaizo #' + id + ': stat ' + v);
      if (m[2]) {
        deltaCheck.checked++;
        if (v - +m[2] !== base[1][k]) deltaCheck.disagree.push(id + ' ' + STAT_ORDER[k] + ': ' + cell + ' implies ' + (v - +m[2]) + ', Platinum has ' + base[1][k]);
      }
      return v;
    });
    const t = [typeName(r[C.t1]), typeName(r[C.t2])];
    const a1 = abilityName(r[C.a1]), a2 = abilityName(r[C.a2]);
    rec[id] = [t[1] === t[0] ? [t[0]] : t, stats, [a1, a2 === a1 ? '' : a2, '']];
  });
  if (Object.keys(rec).length !== 493) throw new Error('Platinum Kaizo: ' + Object.keys(rec).length + ' species, expected 493');
  return { rec, applied: 0, oldMismatch: 0, issues: deltaCheck.disagree, deltaCheck };
}

// ==== Run & Bun ===========================================================================================
/* pokeemerald-expansion: `#if P_UPDATED_TYPES >= GEN_6 ... #else ... #endif`. Run & Bun is a Gen VIII
   hack, so every "updated" branch up to Generation VIII is the live one - which the comparison with the
   calculator data below either confirms or refutes. */
function resolvePre(txt) {
  const out = [], stack = [];
  const live = () => stack.every(s => s.on);
  txt.split(/\r?\n/).forEach(l => {
    const t = l.trim();
    let m;
    if ((m = t.match(/^#if\s+(.+)$/))) {
      const c = m[1];
      let on;
      if ((m = c.match(/^P_UPDATED_\w+\s*>=\s*GEN_(\d)$/))) on = +m[1] <= 8;
      else if ((m = c.match(/^P_GEN_(\d)_POKEMON\s*==\s*TRUE$/))) on = +m[1] <= 8;
      else throw new Error('unhandled #if: ' + c);
      stack.push({ on, done: on });
    } else if (/^#else/.test(t)) { const s = stack[stack.length - 1]; s.on = !s.done; s.done = true; }
    else if (/^#endif/.test(t)) stack.pop();
    else if (/^#elif/.test(t)) throw new Error('unhandled #elif');
    else if (live()) out.push(l);
  });
  return out.join('\n');
}
/* Some species are written as C macros - [SPECIES_PIKACHU] = PIKACHU_BASE_STATS(PERCENT_FEMALE(50), FLIP)
   - and some blocks pull their types from one (PUMKPABOO_MISC_STATS, the file's own spelling). The
   defines are read out, and every use of one is replaced with its body, with arguments substituted. */
function expandMacros(src) {
  const defs = {};
  const kept = [];
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*#define\s+(\w+)(\(([^)]*)\))?\s*(.*)$/);
    if (!m) { kept.push(lines[i]); continue; }
    let body = m[4];
    while (/\\\s*$/.test(body) && i + 1 < lines.length) { body = body.replace(/\\\s*$/, ' ') + lines[++i]; }
    defs[m[1]] = { params: m[2] ? m[3].split(',').map(s => s.trim()).filter(Boolean) : null, body: body.replace(/\\\s*$/, '') };
  }
  let out = kept.join('\n');
  const names = Object.keys(defs).sort((a, b) => b.length - a.length);
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    names.forEach(n => {
      const d = defs[n];
      if (!d.params) {
        const re = new RegExp('\\b' + n + '\\b(?!\\s*\\()', 'g');
        if (re.test(out)) { out = out.replace(re, d.body); changed = true; }
        return;
      }
      let i;
      while ((i = out.search(new RegExp('\\b' + n + '\\s*\\('))) >= 0) {
        const open = out.indexOf('(', i);
        let depth = 0, j = open, args = [], cur = '';
        for (; j < out.length; j++) {
          const c = out[j];
          if (c === '(') { depth++; if (depth === 1) continue; }
          if (c === ')') { depth--; if (depth === 0) break; }
          if (c === ',' && depth === 1) { args.push(cur.trim()); cur = ''; continue; }
          cur += c;
        }
        args.push(cur.trim());
        let body = d.body;
        d.params.forEach((p, k) => { body = body.replace(new RegExp('\\b' + p + '\\b', 'g'), args[k] || ''); });
        out = out.slice(0, i) + body + out.slice(j + 1);
        changed = true;
      }
    });
    if (!changed) break;
  }
  return out;
}
/* The text of `[SPECIES_X] = { ... }`, found by matching braces rather than by layout. */
function speciesBlocks(src) {
  const out = [];
  const re = /\[(SPECIES_\w+)\]\s*=\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 0, j = m.index + m[0].length - 1;
    for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}') { depth--; if (!depth) break; } }
    out.push([m[1], src.slice(m.index + m[0].length, j)]);
  }
  return out;
}
function buildRB(statsH, speciesH) {
  const num = {};
  speciesH.split(/\r?\n/).forEach(l => { const m = l.match(/^#define (SPECIES_\w+)\s+(\d+)\s*$/); if (m) num[m[1]] = +m[2]; });
  const src = expandMacros(resolvePre(statsH));
  const rec = {};
  for (const [name, b] of speciesBlocks(src)) {
    const m = [null, name];
    const id = num[name];
    if (!(id >= 1 && id <= 905)) continue;   // species only; expansion numbers forms above FORMS_START
    const g = k => { const mm = b.match(new RegExp('\\.' + k + '\\s*=\\s*(\\w+)')); if (!mm) throw new Error(m[1] + ' has no ' + k); return mm[1]; };
    const stats = ['baseHP', 'baseAttack', 'baseDefense', 'baseSpAttack', 'baseSpDefense', 'baseSpeed'].map(k => +g(k));
    const t1 = typeName(g('type1')), t2 = typeName(g('type2'));
    const am = b.match(/\.abilities\s*=\s*\{([^}]*)\}/);
    const ab = am ? am[1].split(',').map(x => abilityName(x)) : ['', '', ''];
    while (ab.length < 3) ab.push('');
    rec[id] = [t2 === t1 ? [t1] : [t1, t2], stats, ab.slice(0, 3)];
  }
  return { rec, applied: 0, oldMismatch: 0, issues: [] };
}

// ==== Emerald Kaizo / FireRed Omega =================================================================
function buildEK(db) {
  const rec = {};
  db.forEach(p => {
    const id = +p.dex;
    if (!(id >= 1 && id <= 386)) return;
    const t1 = typeName(p.type1), t2 = typeName(p.type2);
    const a1 = abilityName(p.ability1), a2 = abilityName(p.ability2);
    rec[id] = [t2 === t1 ? [t1] : [t1, t2], [p.hp, p.attack, p.defense, p.specialAttack, p.specialDefense, p.speed], [a1, a2 === a1 ? '' : a2, '']];
  });
  return { rec, applied: 0, oldMismatch: 0, issues: [] };
}
/* The calc data has stats and one ability per species, and no types. Types stay FireRed's; an
   ability is only written when the calc names one the base game did not have. */
function buildFRO(poks) {
  const rec = {}, issues = [];
  for (let id = 1; id <= 386; id++) rec[id] = baseRecord(id, 3);
  let applied = 0;
  Object.keys(poks).forEach(name => {
    const id = speciesId(name);
    if (!(id >= 1 && id <= 386)) return;
    const p = poks[name], r = rec[id];
    if (p.bs) { const s = [p.bs.hp, p.bs.at, p.bs.df, p.bs.sa, p.bs.sd, p.bs.sp]; if (s.join() !== r[1].join()) applied++; r[1] = s; }
    if (p.ab) { const a = abilityName(p.ab); if (a && r[2][0] !== a && r[2][1] !== a) { issues.push(id + ' calc ability ' + p.ab + ' is not in FireRed (' + r[2].slice(0, 2).join(' / ') + '); slot 1 replaced'); r[2][0] = a; applied++; } }
  });
  return { rec, applied, oldMismatch: 0, issues };
}

// ---- write ----------------------------------------------------------------------------------------------
/* Every record is checked before anything is written. Platinum Kaizo's first export came through with
   208 species' changed stats blank, and nothing downstream would have noticed a 0. */
function validate(key, rec) {
  const ABILSET = new Set(ABIL);
  Object.keys(rec).forEach(id => {
    const [t, st, ab] = rec[id];
    if (!Array.isArray(t) || t.length < 1 || t.length > 2 || !t.every(x => TYPES.has(x))) throw new Error(key + ' #' + id + ': bad types ' + JSON.stringify(t));
    if (!Array.isArray(st) || st.length !== 6 || !st.every(v => Number.isInteger(v) && v > 0 && v <= 255)) throw new Error(key + ' #' + id + ': bad stats ' + JSON.stringify(st));
    if (!Array.isArray(ab) || ab.length !== 3 || !ab[0] || !ab.every(a => a === '' || ABILSET.has(a))) throw new Error(key + ' #' + id + ': bad abilities ' + JSON.stringify(ab));
  });
}
function write(key, meta, built, checks, check) {
  validate(key, built.rec);
  const species = {};
  Object.keys(built.rec).sort((a, b) => a - b).forEach(id => { species[id] = built.rec[id]; });
  const doc = Object.assign({ about: 'Generated by build/generate-romhacks.js. Do not edit by hand.', key }, meta,
    { appliedChanges: built.applied, docOldValuesDisagreeing: built.oldMismatch, notes: built.issues, crossCheck: checks,
      abilityNotes: built.abilityNotes && Object.keys(built.abilityNotes).length ? built.abilityNotes : undefined, species });
  const file = path.join(OUTDIR, key + '.json');
  const next = JSON.stringify(doc) + '\n';
  if (check) {
    const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
    const strip = s => s.replace(/"fetched":"[^"]*",/, '');
    return strip(cur) === strip(next);
  }
  fs.writeFileSync(file, next);
  return true;
}

(async () => {
  const check = process.argv.includes('--check');
  if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR);
  const fetched = new Date().toISOString().slice(0, 10);
  const T = {};
  await Promise.all(Object.keys(URL).map(async k => { T[k] = await get(URL[k]); }));
  const summary = [];
  const out = [];

  // Renegade Platinum
  const rpDoc = parseDrayanoRP(T.rpChanges);
  const rpCalc = calcSpecies(calcObj(T.rpCalc).poks);
  for (const classic of [false, true]) {
    const b = buildRP(rpDoc, classic, T.rpChanges);
    const checks = classic ? [] : [compare('hzla Dynamic Calc (rp.js)', b.rec, rpCalc)];
    out.push(['renegade-platinum' + (classic ? '-classic' : ''), { fetched, sources: [URL.rpChanges], checkedAgainst: classic ? [] : [URL.rpCalc] }, b, checks]);
  }
  // Sacred Gold / Storm Silver
  const sgCalc = calcSpecies(JSON.parse(T.sgCalc).poks);
  const sgFairyCalc = calcSpecies(calcObj(T.sgFairy).poks);
  const sgCalcStats = {};
  Object.keys(sgCalc).forEach(id => { if (sgCalc[id].stats) sgCalcStats[id] = sgCalc[id].stats; });
  /* The Fairy patch "retypes the Gen VI Fairy species". Which species those are is canon, and the
     app's type history already records it: every species 1-493 whose Generation VI typing includes
     Fairy and differs from its Generation IV typing. The patch is applied as that canon change - if
     a variant still has the old typing, it takes the new one. A species the hack had ALREADY retyped
     is not guessed at; it is named in the notes. The two calculator datasets were not usable for
     this: they disagree with each other about more than Fairy (Illumise is Bug in one, Bug/Electric
     in the other), so a difference between them is not the patch. */
  const fairy = {};
  for (let id = 1; id <= 493; id++) {
    const g4 = baseRecord(id, 4)[0], g6 = baseRecord(id, 6)[0];
    if (g6.includes('fairy') && !sameTypes(g4, g6)) fairy[id] = { from: g4, to: g6 };
  }
  for (const classic of [false, true]) {
    for (const fp of [false, true]) {
      const b = buildSG(T.sgChanges, classic, sgCalcStats);
      if (fp) Object.keys(fairy).forEach(id => {
        const f = fairy[id], r = b.rec[id];
        if (sameTypes(r[0], f.from)) { r[0] = f.to.slice(); b.applied++; }
        else b.issues.push(id + ' Fairy patch: this variant types it ' + r[0].join(' / ') + ', not the ' + f.from.join(' / ') + ' the patch retypes; left as it is');
      });
      const sgWhy = (id, f) => b.docBacked.has(id + '|' + f) ? 'Drayano\'s doc sets this ' + (f === 'types' ? 'type' : 'stat line') + (f === 'stats' ? ', and it matches the doc\'s own stated total' : '') + '; the calculator data is missing the change' : null;
      const checks = (!classic && !fp) ? [compare('hzla Dynamic Calc (v1.05, npoint)', b.rec, sgCalc, sgWhy)]
        : (!classic && fp) ? [compare('hzla Dynamic Calc (Fairy v1.1, sgss.js)', b.rec, sgFairyCalc, sgWhy)] : [];
      out.push(['sacred-gold' + (classic ? '-classic' : '') + (fp ? '-fairy' : ''),
        { fetched, sources: [URL.sgChanges].concat(fp ? [URL.sgFairy] : []), checkedAgainst: checks.length ? [fp ? URL.sgFairy : URL.sgCalc] : [],
          fairyPatch: fp ? Object.keys(fairy).map(Number) : undefined }, b, checks]);
    }
  }
  // Platinum Kaizo
  const pk = buildPK(T.pkSheet);
  out.push(['platinum-kaizo', { fetched, sources: [URL.pkSheet], checkedAgainst: [],
    statDeltasChecked: pk.deltaCheck.checked, statDeltasDisagreeing: pk.deltaCheck.disagree.length }, pk, []]);
  // Run & Bun
  const rb = buildRB(T.rbStats, T.rbSpecies);
  /* Run & Bun's own file is a full table, so every value in it is the author's. A disagreement is
     explained when the calculator holds the official, unmodified value - the hack changed it and the
     calculator did not follow - or, for Minior, when the calculator's "Minior" is the Core form. */
  const rbWhy = (id, f, o) => {
    if (id === 774) return 'the calculator\'s "Minior" is Core Form; the dex\'s default is Meteor Form, which matches its "Minior-Meteor" entry';
    const row = SPECIES.find(x => x[0] === id);
    if (f === 'stats' && row && o.stats && o.stats.join() === row[3].join()) return 'the calculator has the official, unmodified stats; Run & Bun\'s own file changes them';
    if (f === 'stats' && row && rb.rec[id][1].join() === row[3].join()) return 'Run & Bun\'s own file keeps the official stats; the calculator\'s differ from both';
    return null;
  };
  out.push(['run-and-bun', { fetched, sources: [URL.rbStats, URL.rbSpecies], checkedAgainst: [URL.rbCalc] }, rb,
    [compare('hzla Dynamic Calc (npoint)', rb.rec, calcSpecies(JSON.parse(T.rbCalc).poks), rbWhy)]]);
  // Emerald Kaizo
  const ek = buildEK(JSON.parse(T.ekDb));
  out.push(['emerald-kaizo', { fetched, sources: [URL.ekDb], checkedAgainst: [URL.ekCalc] }, ek,
    [compare('hzla Dynamic Calc (ek.js)', ek.rec, calcSpecies(calcObj(T.ekCalc).poks))]]);
  // FireRed Omega
  out.push(['firered-omega', { fetched, sources: [URL.froCalc], checkedAgainst: [] }, buildFRO(calcObj(T.froCalc).poks), []]);

  if (unknownAbilities.size) throw new Error('abilities not in PokeAPI\'s list: ' + [...unknownAbilities].join(', '));
  let stale = 0;
  out.forEach(([key, meta, b, checks]) => {
    const ok = write(key, meta, b, checks, check);
    if (!ok) stale++;
    const n = Object.keys(b.rec).length;
    const c = checks.map(x => x.against + ': ' + x.compared + ' compared, unexplained: types ' + x.types.length + ', stats ' + x.stats.length + (x.explained.length ? ' (' + x.explained.length + ' explained)' : '')).join('; ');
    summary.push(key.padEnd(30) + String(n).padStart(4) + ' species, ' + String(b.applied).padStart(4) + ' changes applied, ' +
      b.oldMismatch + ' old values disagree, ' + b.issues.length + ' notes' + (c ? ' | ' + c : ''));
  });
  console.log(summary.join('\n'));
  if (check) { console.log(stale ? 'STALE: ' + stale + ' hack files differ' : 'check: every hack file matches its sources'); process.exit(stale ? 1 : 0); }
})().catch(e => { console.error(e); process.exit(1); });
