#!/usr/bin/env node
/* HoopaDex — every move's record, in one file
 * Run: node build/generate-move-index.js          (fetch PokeAPI, write app/moves-index.json)
 *      node build/generate-move-index.js --check  (fetch again, exit 1 if the file is stale)
 *
 * Why this exists. A Pokemon's page lists every move it learns, and to draw that list the app
 * downloaded each move's full PokeAPI record, fifteen at a time: 76 requests for Charizard, 3.6 seconds
 * on a fast connection. The Team Builder, the team editor and the coverage panel did the same.
 *
 * What the app keeps from a move record is exactly what makeMoveRecord() reads: name, type, category,
 * power, accuracy, PP, priority, effect chance, generation, the English short effect, the English
 * game text per version group, and past values. This file holds those fields and nothing else.
 *
 * THE GUARANTEE. The app builds a record from this file with the same makeMoveRecord() it uses on a
 * live response. Before writing, this script slices makeMoveRecord out of app/index.html, builds every
 * move both ways - from the full PokeAPI record and from the compact row expanded as the app expands
 * it - and refuses to write if any record differs. The one field allowed to differ is flavorEntries,
 * which keeps only English entries; its only reader, genFlavorText(), discards the rest first.
 *
 * Row: [name, type, category, power, accuracy, pp, priority, effectChance, generation,
 *       shortEffect, [text, ...], [[versionGroup, textIndex], ...], [[versionGroup, power, accuracy, pp, type], ...]]
 * Game text is stored once per distinct sentence and referenced by index, in PokeAPI's order.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'app', 'moves-index.json');
const APP = path.join(ROOT, 'app', 'index.html');
const API = 'https://pokeapi.co/api/v2/';

async function getJson(url, tries = 5) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return await r.json(); }
    catch (e) { if (t >= tries) throw e; await new Promise(res => setTimeout(res, 700 * t)); }
  }
}

function compact(d) {
  const en = (d.effect_entries || []).find(x => x.language.name === 'en');
  const texts = [], refs = [];
  (d.flavor_text_entries || []).forEach(f => {
    if (f.language.name !== 'en') return;
    let i = texts.indexOf(f.flavor_text);
    if (i < 0) { i = texts.length; texts.push(f.flavor_text); }
    refs.push([f.version_group ? f.version_group.name : null, i]);
  });
  const past = (d.past_values || []).map(pv => [pv.version_group ? pv.version_group.name : null,
    pv.power, pv.accuracy, pv.pp, pv.type ? pv.type.name : null]);
  return [d.name, d.type ? d.type.name : null, d.damage_class ? d.damage_class.name : null, d.power, d.accuracy, d.pp,
    d.priority, d.effect_chance, d.generation ? d.generation.name : null, en ? en.short_effect : null, texts, refs, past];
}

/* The app's expansion, read out of index.html so the check below tests what ships. */
function appPieces() {
  const src = fs.readFileSync(APP, 'utf8');
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('not found: ' + a); return src.slice(i, j); };
  const VG = src.match(/const VG_GEN=\{[^;]*\};/);
  if (!VG) throw new Error('VG_GEN not found');
  const code = VG[0] + '\n' + cut('function movePastValues(', '\nfunction makeMoveRecord(') + '\n' +
    cut('function makeMoveRecord(', '\n}\n') + '\n}\n' + cut('function expandMoveRow(', '\n}\n') + '\n}\n' +
    ';({makeMoveRecord,expandMoveRow})';
  return (0, eval)(code);
}

(async () => {
  const check = process.argv.includes('--check');
  const list = (await getJson(API + 'move?limit=1000')).results;
  const full = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (next < list.length) { const i = next++; full[i] = await getJson(list[i].url); }
  }));
  const rows = full.map(compact);

  const { makeMoveRecord, expandMoveRow } = appPieces();
  const bad = [];
  full.forEach((d, i) => {
    const a = makeMoveRecord(d), b = makeMoveRecord(expandMoveRow(rows[i]));
    const aEn = a.flavorEntries.filter(e => e.language.name === 'en');
    a.flavorEntries = null; b.flavorEntries = b.flavorEntries.length === aEn.length &&
      b.flavorEntries.every((e, k) => e.flavor_text === aEn[k].flavor_text && (e.version_group && e.version_group.name) === (aEn[k].version_group && aEn[k].version_group.name)) ? null : 'DIFFERS';
    if (JSON.stringify(a) !== JSON.stringify(b)) bad.push(d.name);
  });
  if (bad.length) { console.error('REFUSING: ' + bad.length + ' moves build differently from the snapshot: ' + bad.slice(0, 10).join(', ')); process.exit(1); }

  if (check) {
    const cur = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const same = JSON.stringify(cur.moves) === JSON.stringify(rows);
    console.log(same ? 'check: app/moves-index.json matches PokeAPI (' + rows.length + ' moves, taken ' + cur.fetched + ')'
                     : 'STALE: app/moves-index.json differs from PokeAPI; rerun without --check');
    process.exit(same ? 0 : 1);
  }
  const doc = { about: 'Generated by build/generate-move-index.js from PokeAPI. Do not edit by hand.',
    fetched: new Date().toISOString().slice(0, 10), count: rows.length, moves: rows };
  fs.writeFileSync(OUT, JSON.stringify(doc) + '\n');
  console.log('verified ' + rows.length + ' of ' + rows.length + ' records identical through makeMoveRecord; wrote app/moves-index.json, ' +
    (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
})().catch(e => { console.error(e); process.exit(1); });
