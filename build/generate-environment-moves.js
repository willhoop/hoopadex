#!/usr/bin/env node
/* HoopaDex — what Nature Power (and friends) actually become
 * Run: node build/generate-environment-moves.js
 *
 * Writes data/environment-moves.json and data/environment-moves.embed.json.
 * Does NOT modify app/index.html — build/embed-environment-moves.js does that.
 *
 * Why this exists. Nature Power's entire description in the app was "Uses a move which depends upon
 * the terrain", which tells a reader that an answer exists and then declines to give it. There was
 * no list of what the terrain can be, no move it becomes, no indication that the mapping is
 * different in every single generation, and no note that the move cannot be used at all in
 * Generation IX.
 *
 * WHY NOT SHOWDOWN, WHEN NEARLY EVERYTHING ELSE HERE COMES FROM SHOWDOWN
 * ----------------------------------------------------------------------
 * Because Showdown does not have this data and could not. It is a battle simulator with no
 * overworld, so there is no cave or tall grass for it to be standing in. Its per-generation mods
 * collapse the whole table to one hardcoded call:
 *
 *     gen3: this.actions.useMove('swift', target)        // one row of a nine-row table
 *     gen4: this.actions.useMove('triattack', pokemon)
 *     gen5: this.actions.useMove('earthquake', pokemon)
 *
 * Each is a correct answer to "what does Nature Power do in a Showdown battle" and a wrong answer
 * to "what does Nature Power do in Ruby". Deriving from Showdown here would have produced a
 * confident, precise, single-row falsehood — this project's defining failure mode, reached through
 * the source it otherwise trusts most.
 *
 * From Generation VI the terrain MOVES (Electric/Grassy/Misty/Psychic Terrain) do override the
 * environment, and that part Showdown models properly. It is used below as an independent CHECK
 * rather than as the source: the rows parsed out of Bulbapedia for those four terrains are compared
 * against Showdown's `onTryHit`, and a disagreement fails the build. Two sources agreeing is the
 * standard the rest of this data holds itself to.
 *
 * SOURCE: Bulbapedia wikitext through the MediaWiki API — not scraped HTML. The wikitext is the
 * artefact the site itself renders from, and its table rows are regular enough to parse without
 * guessing at layout. Spin-off tables (Colosseum/XD, Battle Revolution, Mystery Dungeon, Rumble)
 * sit under `====` sub-headings and are deliberately not read: different games, different mappings,
 * and merging them would produce a table that is true of nothing.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'environment-moves.json');
const EMBED = path.join(ROOT, 'data', 'environment-moves.embed.json');
const API = 'https://bulbapedia.bulbagarden.net/w/api.php';
const SHOWDOWN = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/moves.ts';

/* The three core-series moves whose result is chosen by where the battle is happening. Secret Power
   and Camouflage are the same mechanic aimed at a different output — an added effect and a type
   rather than a whole move — and their pages share the structure, so they share the parser. */
const PAGES = [
  { slug: 'nature-power', page: 'Nature_Power_(move)', gives: 'a move' },
  { slug: 'secret-power', page: 'Secret_Power_(move)', gives: 'an added effect' },
  { slug: 'camouflage', page: 'Camouflage_(move)', gives: 'a type' },
];

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'user-agent': 'HoopaDex-build (github.com/willhoop/hoopadex)' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode !== 200) return rej(new Error(url + ' -> HTTP ' + r.statusCode));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

/* Split a wikitext cell on the pipe separating its style attribute from its content, ignoring pipes
   inside templates and links. `| style="..." | {{color2|000|Cave}}` holds three pipes and only the
   second is a separator; a plain split on "|" returns "000" and calls that the answer. */
function cellText(line) {
  const s = line.replace(/^\|+\s*/, '');
  let depth = 0, cut = -1;
  for (let i = 0; i < s.length; i++) {
    if (s.startsWith('{{', i) || s.startsWith('[[', i)) { depth++; i++; continue; }
    if (s.startsWith('}}', i) || s.startsWith(']]', i)) { depth--; i++; continue; }
    if (s[i] === '|' && depth === 0) cut = i;
  }
  return clean(cut >= 0 ? s.slice(cut + 1) : s);
}

/* Resolve templates INNERMOST FIRST, repeatedly, until none are left.
   Bulbapedia nests them — {{color|{{locationcolor/text|volcano}}|Volcano}} is a colour helper used
   as the colour argument of another colour helper — and a single non-nesting regex cannot read
   that. The first version of this function used one, matched the inner template as though it were
   the outer one, and produced "volcano|Volcano}}" as the name of a place, in eleven rows across
   all three moves. Resolving from the inside out is the only thing that reads nesting correctly.

   Which parameter is the visible text depends on the template: {{mcolor|Swift|000}} shows the move
   name first, {{color2|FFF|Tall grass#Long grass|Long grass}} shows the label last, and pure colour
   lookups like {{locationcolor/med|cave}} show nothing at all. */
function templateText(inner) {
  const parts = inner.split('|');
  const name = parts[0].trim().toLowerCase().split('/')[0];
  const args = parts.slice(1);
  if (!args.length) return '';
  if (name === 'mcolor' || name === 'typecolor' || name === 'tt') return args[0].trim();
  if (name === 'color' || name === 'color2') return args[args.length - 1].trim();
  return '';   // locationcolor, roundy*, sup, and the rest are presentation with no visible text
}

function clean(t) {
  let s = String(t).trim();
  for (let guard = 0; guard < 12 && /\{\{/.test(s); guard++) {
    const next = s.replace(/\{\{([^{}]*)\}\}/g, (_, inner) => templateText(inner));
    if (next === s) break;
    s = next;
  }
  s = s.replace(/\{\{|\}\}/g, '');
  s = s.replace(/\[\[(?:[^\]|]*\|)?([^\]|]+)\]\]/g, '$1');
  s = s.replace(/'{2,}/g, '');
  s = s.replace(/&mdash;|&ndash;/g, '—').replace(/&nbsp;/g, ' ');
  s = s.replace(/<[^>]*>/g, ' ');
  // A section link in a piped label — "Tall grass#Long grass" — keeps the label, not the anchor.
  s = s.replace(/([A-Za-z])#[A-Za-z][^|]*/g, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

/* Which generations a heading is about.
   The three pages do not agree on how to write this, and each variant below is one that actually
   appears: Nature Power uses "Generation III", Secret Power adds "Generation VIII onwards", and
   its outside-of-battle section uses "Generations IV and V". A parser that only knew the first form
   would silently return an empty table for two of the three moves — which is exactly what the first
   run did. */
function headingGens(title) {
  const t = clean(title);
  let m = t.match(/^Generations?\s+([IVX]+)\s+and\s+([IVX]+)$/i);
  if (m) return [ROMAN[m[1].toUpperCase()], ROMAN[m[2].toUpperCase()]].filter(Boolean);
  m = t.match(/^Generations?\s+([IVX]+)\s+onwards?$/i);
  if (m) { const g = ROMAN[m[1].toUpperCase()]; return g ? Array.from({ length: 10 - g }, (_, k) => g + k) : []; }
  m = t.match(/^Generations?\s+([IVX]+)$/i);
  if (m && ROMAN[m[1].toUpperCase()]) return [ROMAN[m[1].toUpperCase()]];
  return [];
}

/* Core-series tables only, and only from the Effect section.
   Two rules do the excluding. The scan stops at the first level-2 heading after ==Effect==, which
   drops Learnset, Mystery Dungeon, Rumble and the per-terrain galleries further down the page. And
   the first table found for a generation wins, which keeps Secret Power's "In battle" table and
   discards the "Outside of battle" one that repeats the same headings lower down — those describe
   cutting a tree, not a battle. */
function sectionTables(wikitext) {
  const lines = wikitext.split('\n');
  const out = {};
  let started = false;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (h) {
      if (h[1].length === 2) { if (started) break; if (/^Effect$/i.test(clean(h[2]))) started = true; continue; }
    }
    if (!started || !h) continue;
    const gens = headingGens(h[2]);
    if (!gens.length) continue;

    let j = i + 1, start = -1;
    for (; j < lines.length; j++) {
      if (/^={2,6}\s*[^=]/.test(lines[j])) break;      // any deeper heading ends this section
      if (/^\{\|/.test(lines[j])) { start = j; break; }
    }
    let value;
    if (start < 0) {
      value = { rows: [], prose: clean(lines.slice(i + 1, j).join(' ')) };
    } else {
      let end = start;
      while (end < lines.length && !/^\|\}/.test(lines[end])) end++;
      value = { rows: parseRows(lines.slice(start + 1, end)), prose: '' };
    }
    for (const g of gens) if (!out[g]) out[g] = value;
  }
  return out;
}

function parseRows(body) {
  const rows = [];
  let cur = null;
  for (const line of body) {
    if (/^\|-/.test(line)) { if (cur && cur.length) rows.push(cur); cur = []; continue; }
    if (/^!/.test(line)) continue;
    if (/^\|/.test(line)) { if (!cur) cur = []; cur.push(cellText(line)); }
  }
  if (cur && cur.length) rows.push(cur);
  return rows.filter(r => r.length >= 2 && r[0] && r[1]);
}

(async () => {
  const showdown = await get(SHOWDOWN);
  const npBody = (showdown.match(/\n\tnaturepower: \{[\s\S]*?\n\t\},/) || [''])[0];
  const sdTerrain = {};
  let dm;
  const re = /isTerrain\('(\w+)'\)\)\s*\{\s*move = '(\w+)'/g;
  while ((dm = re.exec(npBody))) sdTerrain[dm[1]] = dm[2];
  const sdDefault = (npBody.match(/let move = '(\w+)'/) || [])[1];

  const result = {};
  for (const p of PAGES) {
    const url = API + '?action=parse&page=' + encodeURIComponent(p.page) +
      '&prop=wikitext&format=json&formatversion=2';
    const j = JSON.parse(await get(url));
    if (!j.parse || !j.parse.wikitext) throw new Error('no wikitext for ' + p.page);
    const gens = sectionTables(j.parse.wikitext);
    const byGen = {};
    for (const g of Object.keys(gens)) {
      const t = gens[g];
      /* Columns are Terrain, Result, Type, [Category,] Power, Accuracy. Only the first three are
         carried. Power and accuracy belong to the move it becomes, and the app already knows those
         from PokeAPI — restating them here would be a second copy, free to go stale. */
      const rows = t.rows.map(r => ({ where: r[0], gives: r[1], type: r[2] || '' }))
        .filter(r => r.where && r.gives);
      byGen[g] = rows.length ? { rows } : { note: t.prose };
    }
    result[p.slug] = { gives: p.gives, gens: byGen };
  }

  /* The cross-check. From Generation VI a terrain move overrides the environment, and that is the
     one part of this table Showdown also holds. If the two disagree, one is wrong and this script
     cannot know which — so it stops rather than picking. */
  const TERRAIN_LABEL = {
    electricterrain: 'Electric Terrain', grassyterrain: 'Grassy Terrain',
    mistyterrain: 'Misty Terrain', psychicterrain: 'Psychic Terrain',
  };
  const flat = s => String(s).toLowerCase().replace(/[^a-z]/g, '');
  const np = result['nature-power'].gens;
  const latest = np[8] || np[7] || np[6];
  const disagreements = [];
  for (const key of Object.keys(sdTerrain)) {
    const row = (latest.rows || []).find(r => new RegExp(TERRAIN_LABEL[key], 'i').test(r.where));
    if (!row) { disagreements.push(TERRAIN_LABEL[key] + ': no row found in the parsed table'); continue; }
    if (flat(row.gives) !== flat(sdTerrain[key])) {
      disagreements.push(TERRAIN_LABEL[key] + ': Bulbapedia says "' + row.gives +
        '", Showdown says "' + sdTerrain[key] + '"');
    }
  }
  if (disagreements.length) {
    console.error('\nFAIL: the two sources disagree about what Nature Power becomes:');
    disagreements.forEach(d => console.error('  ' + d));
    console.error('  Neither is automatically right. Read both before changing anything here.');
    process.exit(1);
  }

  const payload = {
    source: 'Bulbapedia wikitext via ' + API + ' (core-series tables only)',
    crosscheck: 'Terrain-move rows verified against Showdown naturepower onTryHit: ' +
      JSON.stringify(sdTerrain) + ', default ' + sdDefault,
    generated: 'by build/generate-environment-moves.js — do not edit by hand',
    moves: result,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
  fs.writeFileSync(EMBED, JSON.stringify(result));

  console.log('wrote ' + path.relative(ROOT, OUT));
  console.log('wrote ' + path.relative(ROOT, EMBED) + '  (' +
    Math.round(fs.statSync(EMBED).size / 1024) + ' KB)');
  console.log('\n  cross-check vs Showdown: ' + Object.keys(sdTerrain).length +
    ' terrain rows agree, default ' + sdDefault);
  for (const slug of Object.keys(result)) {
    const g = result[slug].gens;
    console.log('  ' + slug.padEnd(14) + Object.keys(g).map(n =>
      'g' + n + ':' + ((g[n].rows || []).length || 'note')).join(' '));
  }
  console.log('\n  Nature Power, Generation III:');
  ((np[3] || {}).rows || []).forEach(r =>
    console.log('    ' + r.where.padEnd(44) + r.gives + '  (' + r.type + ')'));
})();
