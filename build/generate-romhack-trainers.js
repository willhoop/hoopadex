#!/usr/bin/env node
/* HoopaDex — ROM hacks: every trainer, in the order you meet them, split into sections of the game
 * Run: node build/generate-romhack-trainers.js          (fetch every source, write app/hacks/*.trainers.json)
 *      node build/generate-romhack-trainers.js --check  (fetch again, exit 1 if any file is stale)
 *
 * Asked for from the live site: "we need the trainer docs, with the ability to add notes on each
 * trainer as i play through", "have the trainer docs be like a spreadsheet, google docs with tabs for
 * each section of the game", and "the ability to upload the enemy teams to the relevant calculators".
 *
 * A section is the stretch of the game up to and including a Gym Leader - the way nuzlocke players
 * split a run, and the way Platinum Kaizo's own sheet is already split ("Roark Split" ...). Sources:
 *
 *   hack                order and areas from                       full sets (item, ability, nature, moves)
 *   Renegade Platinum   Drayano's "Trainer Pokémon" (by area)      his document for important trainers;
 *                                                                  the hack's calculator data for the rest
 *   Sacred Gold         the "Trainer Pokemon" list in the docs     the list, for important trainers
 *   Platinum Kaizo      the Mastersheet's ten split tabs           every trainer, from the sheet
 *   Run & Bun           the calculator data's own next/prev chain  every trainer, from the calculator data
 *   Emerald Kaizo       none - sorted by level, and said so        every trainer, from emerald-kaizo-db
 *   FireRed Omega       none - sorted by level, and said so        every trainer, from the calculator data
 *
 * Sacred Gold's calculator data is not used for movesets: it names moves through another hack's move
 * table (see build/generate-romhack-data.js), so its sets would print Ember as "Hp Fire".
 *
 * A trainer is [key, name, tag, rematch, team]; a team member is
 * [species id or 0, species name, level, item, ability, nature, [moves]] with "" where the source says
 * nothing. `key` is stable across rebuilds (area + name + the n-th time that name appears there), so a
 * note the player writes against a trainer stays with that trainer.
 */
const fs = require('fs');
const path = require('path');
const RH = require('./generate-romhacks.js');
const { calcObj, flat, speciesId, csvRows } = RH;

const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, 'app', 'hacks');
const PK = 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=';
const PK_SPLITS = [['Roark', 904958359], ['Gardenia', 2138894915], ['Fantina', 867079846], ['Maylene', 1727680714], ['Wake', 1434695111],
  ['Byron', 536140236], ['Candice', 783972457], ['Volkner', 1234723554], ['Team Galactic', 1656167063], ['Elite Four', 665629702]];
const SRC = {
  rpTrainers: 'https://pastebin.com/raw/zAQNcyLN',
  rpCalc: RH.URL.rpCalc,
  sgTrainers: 'https://raw.githubusercontent.com/zhenga8533-archive/sgss-wiki/main/data/documentation/Trainer%20Pokemon.txt',
  rbCalc: RH.URL.rbCalc,
  ekTrainers: 'https://raw.githubusercontent.com/Isotarge/emerald-kaizo-db/main/src/trainers.json',
  froCalc: RH.URL.froCalc,
};
PK_SPLITS.forEach(([n, g]) => { SRC['pk' + n] = PK + g; });

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

// ---- helpers ------------------------------------------------------------------------------------------
const unresolved = new Set();
/* "Nidoran♀", "Rotom-W", "Mr. Mime", "Deoxys (A)" - the species, as the app numbers it. */
/* Misspellings in the trainer sources, each the only species it can mean. */
const SPECIES_ERRATA = { nakuhita: 'Makuhita', hippowdown: 'Hippowdon' };
function sid(name) {
  let n = String(name).replace(/\s*[♂♀]\s*\/?\s*$/, '').replace(/\s*\(.*\)\s*$/, '').trim();
  n = SPECIES_ERRATA[flat(n)] || n;
  if (/^\?+$/.test(n)) return 0;
  const id = speciesId(n) || speciesId(n.split('-')[0]) || speciesId(n.replace(/-.*$/, ''));
  if (!id) unresolved.add(name);
  return id || 0;
}
/* A source's empty slot ("??????????" at level 0) is not a Pokémon. */
const realMon = m => m[2] >= 1 && !/^\?+$/.test(m[1]);
const monName = name => { const n = String(name).replace(/\s*[♂♀]\s*\/?\s*$/, '').trim(); return SPECIES_ERRATA[flat(n)] || n; };
const mon = (name, lv, item, ability, nature, moves) => [sid(name), monName(name), +lv || 0,
  item && !/^(none|-|\(none\))$/i.test(item) ? item : '', ability || '', nature && nature !== '?' ? nature : '', (moves || []).filter(m => m && m !== '-')];
/* A Gym Leader closes a section; so does the last trainer of a source with no leaders left. */
const isLeader = name => /^(Leader|Gym Leader)\s/i.test(name);
function keyer() {
  const seen = {};
  return (area, name) => { const k = area + '|' + name; seen[k] = (seen[k] || 0) + 1; return k + '|' + seen[k]; };
}
/* [{area, trainers}] in game order -> sections, each ending at a Leader's area. Only a Leader's FIRST
   battle closes a section; a later team of the same Leader (Emerald Kaizo's rematches) is a rematch. */
function sectionsByLeader(areas) {
  const out = [], met = new Set();
  let cur = { title: '', areas: [] };
  areas.forEach(a => {
    cur.areas.push(a);
    const who = t => t[1].replace(/\s*\(\d+\)$|\d+$/, '');   // "Leader Brawly2", "Leader Brawly (2)": a later team
    const boss = a.trainers.find(t => !t[3] && isLeader(t[1]) && !met.has(who(t)));
    a.trainers.forEach(t => { if (isLeader(t[1])) met.add(who(t)); });
    if (boss) {
      const title = boss[1].replace(/^(Gym )?Leader\s+/i, '').replace(/\s*\(.*$/, '');
      /* A double Gym (Run & Bun's Tate, then Liza) is one section, not a section holding one trainer. */
      const prev = out[out.length - 1];
      if (prev && cur.areas.length === 1 && cur.areas[0].trainers.every(t => isLeader(t[1]))) { prev.areas.push(...cur.areas); prev.title += ' & ' + title; }
      else { cur.title = title; out.push(cur); }
      cur = { title: '', areas: [] };
    }
  });
  if (cur.areas.length) { cur.title = out.length ? 'After ' + out[out.length - 1].title : 'All trainers'; out.push(cur); }
  return out.map((s, i) => Object.assign({ n: i + 1 }, s));
}

// ==== Drayano-format documents: Renegade Platinum, Sacred Gold ==================================================
/* An area is a name line followed by a line of "=" or "---". Each trainer line is "Name   Species Lv. n,
   ...". An important trainer's name then appears alone, followed by one line per Pokémon:
   "Species (Lv. n) @ Item / Nature / Ability / Move, Move" - Sacred Gold's list has no Nature column. */
/* Misspellings in a document's trainer names, each the only trainer it can mean. */
const TRAINER_ERRATA = { 'Leader Bryon': 'Leader Byron' };   // Renegade Platinum, Canalave Gym
function parseDrayanoTrainers(txt, hasNature) {
  const lines = txt.replace(/\r/g, '').split('\n');
  const start = lines.findIndex(l => /^Area Changes/.test(l));
  const areas = [];
  let area = null, rematch = false, detailFor = null;
  const key = keyer();
  for (let i = start + 2; i < lines.length; i++) {
    const l = lines[i], next = lines[i + 1] || '';
    if (/^(=+|---)\s*$/.test(next) && l.trim() && !/^=/.test(l)) { area = { name: l.trim(), trainers: [] }; areas.push(area); rematch = false; detailFor = null; i++; continue; }
    if (!area) continue;
    if (/^Rematches\s*$/.test(l.trim())) { rematch = true; detailFor = null; continue; }
    if (!l.trim()) { detailFor = null; continue; }
    const d = l.match(/^(.+?) \(Lv\. (\d+)\) @ (.+)$/);
    if (d && detailFor) {
      const cols = d[3].split(/\s+\/\s+/).map(s => s.trim());
      const [item, nature, ability, moves] = hasNature ? cols : [cols[0], '', cols[1], cols[2]];
      const m = mon(d[1], d[2], item, (ability || '').replace(/\s*\(!\)\s*$/, ''), nature, (moves || '').split(/,\s*/));
      const t = detailFor.t;
      const slot = t[4].findIndex((x, j) => !x.detailed && x[1] === m[1] && x[2] === m[2]);
      if (slot >= 0) { m.detailed = true; t[4][slot] = m; } else { m.detailed = true; t[4].push(m); }
      continue;
    }
    const tl = l.match(/^(\S.*?)\s{2,}(\S.*\bLv\. \d+.*)$/);
    if (tl) {
      const raw = tl[1].trim();
      const tag = (raw.match(/\(([^)]*)\)\s*\*?$/) || [])[1] || '';
      const name0 = raw.replace(/\s*\([^)]*\)\s*\*?$/, '').replace(/\s*\*$/, '');
      const name = TRAINER_ERRATA[name0] || name0;
      const team = tl[2].split(/,\s*(?=\S[^,]*\bLv\. \d+)/).map(s => { const m = s.trim().match(/^(.+?) Lv\. (\d+)/); return m ? mon(m[1], m[2]) : null; }).filter(Boolean);
      area.trainers.push([key(area.name, name + (rematch ? ' ' + tag : '')), name, tag, rematch ? 1 : 0, team]);
      continue;
    }
    // A name alone: the start of an important trainer's full sets, for the latest trainer of that name.
    const nm = l.trim().replace(/\s*\([^)]*\)\s*$/, '');
    const t = [...area.trainers].reverse().find(x => x[1] === nm && !x[3]);
    if (t) detailFor = { t };
  }
  areas.forEach(a => a.trainers.forEach(t => t[4].forEach(m => { delete m.detailed; })));
  return areas.filter(a => a.trainers.length);
}
/* The calculator's sets, by trainer name and species, to fill in what the document leaves out. */
function calcSetIndex(fsets) {
  const idx = {};
  Object.keys(fsets).forEach(sp => Object.keys(fsets[sp]).forEach(k => {
    const name = k.replace(/^Lvl \d+\s+/, '').trim();
    const s = fsets[sp][k];
    (idx[name + '|' + flat(sp) + '|' + s.level] = idx[name + '|' + flat(sp) + '|' + s.level] || []).push(s);
  }));
  return idx;
}
function fillFromCalc(areas, idx) {
  let filled = 0, missing = 0;
  areas.forEach(a => a.trainers.forEach(t => t[4].forEach((m, j) => {
    if (m[6].length) return;
    const hit = (idx[t[1] + '|' + flat(m[1]) + '|' + m[2]] || [])[0];
    if (!hit) { missing++; return; }
    t[4][j] = mon(m[1], m[2], hit.item, hit.ability, hit.nature, hit.moves);
    filled++;
  })));
  return { filled, missing };
}

// ==== Platinum Kaizo: the Mastersheet's split tabs =====================================================
/* The grid: a row with text only in column E is an area or a trainer - a trainer when the next
   non-blank row starts with "Lv n Species". Then four kinds of row, one Pokémon per two columns:
   "Lv n Species ♂" | nature, ability | item | moves (one per row until a blank row). */
function parsePKSplit(csv, splitName, key) {
  const rows = csvRows(csv);
  const areas = [];
  let area = { name: splitName, trainers: [] };
  const text = r => (r || []).map(c => (c || '').trim());
  const nextNonBlank = i => { for (let j = i + 1; j < rows.length; j++) if (text(rows[j]).some(Boolean)) return j; return -1; };
  for (let i = 0; i < rows.length; i++) {
    const r = text(rows[i]);
    if (!r[4] || r.slice(5).some(Boolean) || /SPLIT|AI Flag Key/i.test(r[4])) continue;
    const j = nextNonBlank(i);
    const nr = j >= 0 ? text(rows[j]) : [];
    if (!/^Lv \d+ /.test(nr[4] || '')) { area = { name: r[4], trainers: [] }; areas.push(area); continue; }
    const team = [];
    const nat = text(rows[j + 1]), itm = text(rows[j + 2]);
    for (let c = 4; c < nr.length; c += 2) {
      const m = (nr[c] || '').match(/^Lv (\d+) (.+?)\s*[♂♀]?$/);
      if (!m) continue;
      const moves = [];
      for (let k = j + 3; k < rows.length; k++) { const mv = text(rows[k])[c]; if (!mv) break; moves.push(mv); }
      team.push(mon(m[2], m[1], itm[c] === '(None)' ? '' : itm[c], nat[c + 1], nat[c], moves));
    }
    if (!areas.length) areas.push(area);
    area.trainers.push([key(splitName + '/' + area.name, r[4]), r[4], '', 0, team]);
  }
  return areas.filter(a => a.trainers.length);
}

// ==== the calculator-only hacks ===============================================================================
/* Dynamic Calc keys each set "Lvl <level of that Pokémon> <trainer>", so the trainer is the name after it. */
function calcTrainers(fsets) {
  const by = {};
  Object.keys(fsets).forEach(sp => Object.keys(fsets[sp]).forEach(k => {
    const name = k.replace(/^Lvl \d+\s+/, '').trim();
    const s = fsets[sp][k];
    const m = mon(sp, s.level, s.item, s.ability, s.nature, s.moves);
    if (realMon(m)) (by[name] = by[name] || []).push([s.sub_index === undefined ? 99 : s.sub_index, m, k]);
  }));
  Object.keys(by).forEach(n => by[n].sort((a, b) => a[0] - b[0]));
  return by;
}
/* Run & Bun's sets carry next/prev, a chain through the game's trainers in order. The order is each
   trainer's first appearance along every chain, chains taken longest first. */
function chainOrder(fsets) {
  const byKey = {}, all = [];
  Object.keys(fsets).forEach(sp => Object.keys(fsets[sp]).forEach(k => { const x = { sp, k, s: fsets[sp][k] }; byKey[sp + ' (' + k + ')'] = x; all.push(x); }));
  const heads = all.filter(x => !x.s.prev || !byKey[x.s.prev]);
  const walks = heads.map(h => { const seq = []; let c = h, n = 0; while (c && n++ < 5000) { seq.push(c.k.replace(/^Lvl \d+\s+/, '').trim()); c = byKey[c.s.next]; } return seq; })
    .sort((a, b) => b.length - a.length);
  const order = [];
  walks.forEach(w => w.forEach(n => { if (!order.includes(n)) order.push(n); }));
  return order;
}
function levelSections(trainers, how) {
  /* No game order in the source: each trainer goes to the section of the first Leader whose ace is
     at least as strong, by the trainer's highest level. Said so in the file and on the page. */
  const lv = t => Math.max(0, ...t[4].map(m => m[2]));
  const list = trainers.slice().sort((a, b) => lv(a) - lv(b) || a[1].localeCompare(b[1]));
  return sectionsByLeader(list.map(t => ({ name: '', trainers: [t] }))).map(s => Object.assign(s, { areas: [{ name: how, trainers: s.areas.map(a => a.trainers[0]) }] }));
}

// ---- write ------------------------------------------------------------------------------------------------
function validate(key, doc) {
  let n = 0;
  doc.sections.forEach(s => s.areas.forEach(a => a.trainers.forEach(t => {
    n++;
    if (!t[4].length) throw new Error(key + ': ' + t[1] + ' in ' + a.name + ' has no Pokémon');
    t[4].forEach(m => { if (!(m[2] >= 1 && m[2] <= 100)) throw new Error(key + ': ' + t[1] + ' has ' + m[1] + ' at level ' + m[2]); });
  })));
  const keys = new Set();
  doc.sections.forEach(s => s.areas.forEach(a => a.trainers.forEach(t => { if (keys.has(t[0])) throw new Error(key + ': duplicate trainer key ' + t[0]); keys.add(t[0]); })));
  if (n < 50) throw new Error(key + ': only ' + n + ' trainers read - the source format has probably changed');
  return n;
}
function write(key, doc, check) {
  const n = validate(key, doc);
  doc.trainerCount = n;
  doc.withMoves = 0;
  doc.sections.forEach(s => s.areas.forEach(a => a.trainers.forEach(t => { if (t[4].every(m => m[6].length)) doc.withMoves++; })));
  const file = path.join(OUTDIR, key + '.trainers.json');
  const next = JSON.stringify(Object.assign({ about: 'Generated by build/generate-romhack-trainers.js. Do not edit by hand.', key }, doc)) + '\n';
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
  const out = [];

  // Renegade Platinum
  {
    const areas = parseDrayanoTrainers(T.rpTrainers, true);
    const fill = fillFromCalc(areas, calcSetIndex(calcObj(T.rpCalc).formatted_sets));
    out.push(['renegade-platinum', { fetched, order: 'game', sources: [SRC.rpTrainers, SRC.rpCalc],
      note: 'Order and areas from Drayano\'s Trainer Pokémon document. Full sets: his document for important trainers, the hack\'s calculator data for ' + fill.filled + ' more Pokémon; ' + fill.missing + ' have species and level only.',
      sections: sectionsByLeader(areas) }]);
  }
  // Sacred Gold / Storm Silver
  {
    const areas = parseDrayanoTrainers(T.sgTrainers, false);
    out.push(['sacred-gold', { fetched, order: 'game', sources: [SRC.sgTrainers],
      note: 'Order, areas and important trainers\' full sets from the Trainer Pokemon list shipped with the hack\'s documents (compiled by JD48096761). Other trainers have species and level only.',
      sections: sectionsByLeader(areas) }]);
  }
  // Platinum Kaizo
  {
    const key = keyer();
    const sections = PK_SPLITS.map(([n], i) => ({ n: i + 1, title: n, areas: parsePKSplit(T['pk' + n], n + ' split', key) }));
    out.push(['platinum-kaizo', { fetched, order: 'game', sources: PK_SPLITS.map(([n]) => SRC['pk' + n]),
      note: 'From the Platinum Kaizo Mastersheet\'s split tabs: every trainer, with full sets.', sections }]);
  }
  // Run & Bun
  {
    const fsets = JSON.parse(T.rbCalc).formatted_sets;
    const by = calcTrainers(fsets);
    const order = chainOrder(fsets);
    const rest = Object.keys(by).filter(n => !order.includes(n));
    const key = keyer();
    const list = order.concat(rest).filter(n => by[n]).map(n => [key('', n), n, '', 0, by[n].map(x => x[1])]);
    out.push(['run-and-bun', { fetched, order: 'game', sources: [SRC.rbCalc],
      note: 'From the hack\'s calculator data, in the order its sets are chained (' + order.length + ' trainers); ' + rest.length + ' not on the chain are at the end.',
      sections: sectionsByLeader(list.map(t => ({ name: '', trainers: [t] }))).map(s => Object.assign(s, { areas: [{ name: '', trainers: s.areas.map(a => a.trainers[0]) }] })) }]);
  }
  // Emerald Kaizo
  {
    const key = keyer();
    const list = JSON.parse(T.ekTrainers).filter(t => t.team && t.team.length).map(t => [key('', t.name), t.name.trim(), t.isDoubleBattle ? 'Double' : '', 0,
      t.team.map(m => mon(m.name, m.level, m.item, '', '', m.moves))]);
    out.push(['emerald-kaizo', { fetched, order: 'level', sources: [SRC.ekTrainers],
      note: 'From emerald-kaizo-db. The database does not give the order trainers are met in, so they are sorted by their highest level and grouped up to each Gym Leader.',
      sections: levelSections(list, 'By level') }]);
  }
  // FireRed Omega
  {
    const by = calcTrainers(calcObj(T.froCalc).formatted_sets);
    const key = keyer();
    /* FireRed's ROM keeps unused placeholder trainers - among them the Hoenn Gym Leaders - each with a
       single level 5 Ekans. They cannot be battled, so they are left out and counted. */
    const placeholder = n => by[n].length === 1 && by[n][0][1][1] === 'Ekans' && by[n][0][1][2] === 5;
    const dropped = Object.keys(by).filter(placeholder);
    const list = Object.keys(by).filter(n => !placeholder(n)).map(n => [key('', n), n, '', 0, by[n].map(x => x[1])]);
    out.push(['firered-omega', { fetched, order: 'level', sources: [SRC.froCalc],
      note: 'From the hack\'s calculator data. It does not give the order trainers are met in, so they are sorted by their highest level and grouped up to each Gym Leader. ' + dropped.length + ' unused placeholder trainers (a lone level 5 Ekans) are left out.',
      sections: levelSections(list, 'By level') }]);
  }

  if (unresolved.size) console.log('species names not resolved (shown without a picture): ' + [...unresolved].join(', '));
  let stale = 0;
  out.forEach(([key, d]) => {
    if (!write(key, d, check)) stale++;
    console.log(key.padEnd(20) + String(d.trainerCount).padStart(5) + ' trainers, ' + String(d.withMoves).padStart(5) + ' with full sets, ' +
      d.sections.length + ' sections: ' + d.sections.map(s => s.title).join(', '));
  });
  if (check) { console.log(stale ? 'STALE: ' + stale + ' trainer files differ' : 'check: every trainer file matches its sources'); process.exit(stale ? 1 : 0); }
}
module.exports = { parseDrayanoTrainers, parsePKSplit, sectionsByLeader, chainOrder };
if (require.main === module) main().catch(e => { console.error(e.stack || e); process.exit(1); });
