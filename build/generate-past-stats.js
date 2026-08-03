#!/usr/bin/env node
/* HoopaDex — historical base stats, derived
 * Run: node build/generate-past-stats.js
 *
 * Writes data/past-stats.json. It does NOT write app/index.html.
 *
 * Why this exists. PAST_STATS was the last big table in the app that was neither generated from a
 * published source nor validated against one. An architecture review on 2026-08-03 changed Zacian's
 * Generation IX Attack from 130 to 170 and ran all 23 suites: every one stayed green. Only 8 of the
 * 58 species in the table were pinned by any test, and there was nothing to compare the other 50
 * against. This is the same table that was measured at 10 of 43 entries correct before 1.96.
 *
 * Source: Pokemon Showdown's per-generation mods, `data/mods/genN/pokedex.ts`. Each mod records
 * only what DIFFERS from the current game, so a `baseStats` line in the gen6 mod is literally "this
 * is what the stat was in Generation VI".
 *
 * The cutoff convention. app/index.html stores `{id: {N: {stat: value}}}` where N is the generation
 * in which the stat CHANGED and the value is what it was BEFORE the change — getStatsForGen picks
 * the entry with the smallest N greater than the selected generation. So a value Showdown records
 * in its genN mod is stored here under key N+1. This script asserts that mapping rather than
 * assuming it: a round-trip check at the bottom re-derives the app's own view and compares.
 *
 * This script deliberately does not rewrite the app. A derivation that disagrees with 58 shipped
 * species is a finding to be read, not a patch to be applied unseen.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const OUT = path.join(ROOT, 'data', 'past-stats.json');

const BASE = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/';
/* Mods 5 through 8. The app records cutoffs 6..9 only, because base stats were stable from
   Generation II through V, and a value Showdown records in its genN mod is stored under key N+1 —
   so gen5 is the mod that supplies the key-6 entries. Leaving gen5 out on the first run made 29 of
   the app's 58 species look unsourced when in fact they are changes that happened AT Generation VI:
   Krookodile's 70 Defence is in the gen5 mod, not the gen6 one. Gens 1-4 are not fetched: the gen1
   and gen2 files predate the Special split and would report every species as "changed". */
const MODS = [5, 6, 7, 8];
const STAT = { hp: 'hp', atk: 'attack', def: 'defense', spa: 'special-attack', spd: 'special-defense', spe: 'speed' };

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode !== 200) return rej(new Error(url + ' -> HTTP ' + r.statusCode));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

// Showdown's pokedex files are TypeScript object literals. Pull each top-level species block by
// brace matching rather than by regex, so a nested object cannot end a block early.
function speciesBlocks(src) {
  const out = {};
  const re = /^\t([a-z0-9]+):\s*\{$/gm;
  let m;
  while ((m = re.exec(src))) {
    let i = src.indexOf('{', m.index), depth = 0, j = i;
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') { depth--; if (depth === 0) break; }
    }
    out[m[1]] = src.slice(i, j + 1);
  }
  return out;
}

const baseStatsOf = block => {
  const m = block.match(/baseStats:\s*\{([^}]*)\}/);
  if (!m) return null;
  const o = {};
  for (const p of m[1].split(',')) {
    const kv = p.split(':').map(s => s.trim());
    if (kv.length === 2 && STAT[kv[0]]) o[STAT[kv[0]]] = Number(kv[1]);
  }
  return Object.keys(o).length ? o : null;
};

(async () => {
  process.stderr.write('fetching Showdown pokedex + mods');
  const current = speciesBlocks(await get(BASE + 'pokedex.ts'));
  process.stderr.write('.');

  // National Dex number and the current stats, for every species key.
  const num = {}, now = {};
  for (const [k, blk] of Object.entries(current)) {
    const n = blk.match(/num:\s*(-?\d+)/);
    if (n) num[k] = Number(n[1]);
    const bs = baseStatsOf(blk);
    if (bs) now[k] = bs;
  }

  const table = {};      // id -> cutoffGen -> stat -> value
  const perGen = {};
  for (const g of MODS) {
    const blocks = speciesBlocks(await get(BASE + `mods/gen${g}/pokedex.ts`));
    process.stderr.write('.');
    let kept = 0;
    for (const [k, blk] of Object.entries(blocks)) {
      const bs = baseStatsOf(blk);
      if (!bs) continue;
      const id = num[k];
      // Skip anything with no National Dex number, and skip alternate formes: the app keys
      // PAST_STATS by dex id, so a mega and its base species would collide.
      if (!id || id < 1) continue;
      if (k !== Object.keys(num).find(x => num[x] === id)) continue;
      const changed = {};
      for (const [s, v] of Object.entries(bs)) if (!now[k] || now[k][s] !== v) changed[s] = v;
      if (!Object.keys(changed).length) continue;
      (table[id] = table[id] || {})[g + 1] = changed;
      kept++;
    }
    perGen[`gen${g}`] = kept;
  }
  process.stderr.write('\n');

  const payload = {
    source: BASE + 'mods/gen{6,7,8}/pokedex.ts',
    generated: 'by build/generate-past-stats.js — do not edit by hand',
    convention: 'key N holds the value used in generations below N (the generation the stat changed in)',
    speciesCount: Object.keys(table).length,
    revisionsPerMod: perGen,
    stats: table,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
  console.log(`wrote ${path.relative(ROOT, OUT)}: ${payload.speciesCount} species, ${JSON.stringify(perGen)}`);

  // --- compare against what the app currently ships -------------------------------------------
  const lines = fs.readFileSync(APP, 'utf8').split(/\r?\n/);
  const s = lines.findIndex(l => l.startsWith('const PAST_STATS='));
  const r = lines.findIndex((l, i) => i > s && l.trim() === 'return stats;');
  const e = lines.findIndex((l, i) => i > r && l.trim() === '}');
  const APPTBL = (0, eval)(lines.slice(s, e + 1).join('\n') + '\n;(PAST_STATS)');

  const only = { app: [], derived: [], disagree: [] };
  const ids = new Set([...Object.keys(APPTBL), ...Object.keys(table)].map(Number));
  for (const id of [...ids].sort((a, b) => a - b)) {
    const a = APPTBL[id], d = table[id];
    if (a && !d) { only.app.push(id); continue; }
    if (d && !a) { only.derived.push(id); continue; }
    for (const gen of new Set([...Object.keys(a), ...Object.keys(d)])) {
      const av = (a[gen] || {}), dv = (d[gen] || {});
      for (const st of new Set([...Object.keys(av), ...Object.keys(dv)]))
        if (av[st] !== dv[st]) only.disagree.push(`${id} gen<${gen} ${st}: app=${av[st]} derived=${dv[st]}`);
    }
  }
  console.log(`\napp species: ${Object.keys(APPTBL).length}   derived species: ${Object.keys(table).length}`);
  console.log(`in app only    : ${only.app.length}${only.app.length ? '  ' + only.app.join(' ') : ''}`);
  console.log(`in derived only: ${only.derived.length}${only.derived.length ? '  ' + only.derived.join(' ') : ''}`);
  console.log(`disagreements  : ${only.disagree.length}`);
  only.disagree.slice(0, 40).forEach(x => console.log('   ' + x));
})();
