#!/usr/bin/env node
/* HoopaDex — Champions / Z-A mega ability generator
 * Run: node build/generate-mega-abilities.js
 *
 * Derives the ability of every official Mega Evolution from Pokémon Showdown's `data/pokedex.ts`
 * and rewrites the CHAMP_MEGA_ABILITIES table in app/index.html. Also writes
 * data/mega-abilities.json as the machine-readable record.
 *
 * Why this exists. The table was written by hand and covered 23 of the 41 Z-A megas the app itself
 * declares in MEGAS_ZA. The 18 it missed — Dragalge's Regenerator among them — rendered as an
 * ability that simply had fewer Pokémon, which looks exactly like a correct answer. The 23 that
 * were present turned out to be right, but that is luck, not a process: nothing in the product
 * could have surfaced a wrong one.
 *
 * The hand table also could not express Raichu, which has two distinct megas (Mega Raichu X with
 * Electric Surge, Mega Raichu Y with No Guard). One row per species cannot hold that.
 *
 * PokéAPI does not serve Z-A megas at all, which is why this is a build-time source rather than a
 * runtime fetch — the same arrangement as PAST_STATS and POKEMON_PAST_TYPES.
 *
 * The Showdown extract is cached in data/showdown-mega-extract.json so a rerun works offline and
 * produces byte-identical output. Pass --refresh to re-download.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const DATA_DIR = path.join(ROOT, 'data');
const CACHE = path.join(DATA_DIR, 'showdown-mega-extract.json');
const OUT_JSON = path.join(DATA_DIR, 'mega-abilities.json');
const SOURCE_URL = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts';

const REFRESH = process.argv.includes('--refresh');

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location));
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' for ' + url));
      let b = '';
      res.setEncoding('utf8');
      res.on('data', c => b += c);
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

// --- which megas are official is the APP's decision, not Showdown's ----------------------
// Showdown carries fan-made and unreleased formes; the app already curates two sets and those are
// the registry. Reading them from the shipped file keeps this generator from inventing a third
// opinion about what exists.
function readMegaRegistry() {
  const src = fs.readFileSync(APP, 'utf8');
  const grab = re => {
    const m = src.match(re);
    if (!m) throw new Error('could not locate ' + re + ' in app/index.html');
    return eval('[' + m[1] + ']');
  };
  const gen6 = grab(/const MEGAS_GEN6=new Set\(\[([^\]]*)\]\)/);
  const za = grab(/const MEGAS_ZA=new Set\(\[([^\]]*)\]\)/);
  return { gen6: new Set(gen6), za: new Set(za) };
}

// --- pull every mega forme out of Showdown's pokedex -------------------------------------
function extractMegaFormes(ts) {
  const out = [];
  // Top-level species entries are a single tab in; the closing brace of each is `\t},`.
  const re = /^\t([a-z0-9]+mega[xy]?): \{([\s\S]*?)^\t\},/gm;
  let m;
  while ((m = re.exec(ts))) {
    const body = m[2];
    const name = (body.match(/name: "([^"]+)"/) || [])[1];
    const base = (body.match(/baseSpecies: "([^"]+)"/) || [])[1];
    const forme = (body.match(/forme: "([^"]+)"/) || [])[1];
    if (!name || !base || !forme) continue;                 // not a forme entry
    const abBlock = (body.match(/abilities: \{([^}]*)\}/) || [])[1] || '';
    const abilities = [...abBlock.matchAll(/[0-9H]: "([^"]+)"/g)].map(x => x[1]);
    if (!abilities.length) continue;
    out.push({ key: m[1], name, base: base.toLowerCase(), forme, abilities });
  }
  return out;
}

/* Showdown lists a mega for every cosmetic base forme — Tatsugiri-Curly-Mega,
   Tatsugiri-Droopy-Mega and Tatsugiri-Stretchy-Mega are the same mega with the same abilities, and
   Meowstic-M/-F likewise. Collapse those, because the app lists Pokémon, not battle formes. What
   must NOT collapse is a species with genuinely different megas: Raichu-Mega-X and Raichu-Mega-Y
   have different abilities and are two entries. Keying on the ability set does exactly that. */
function collapse(formes) {
  const seen = new Map();
  for (const f of formes) {
    const key = f.base + '|' + f.abilities.join('/');
    if (!seen.has(key)) seen.set(key, f);
  }
  return [...seen.values()];
}

// "Raichu-Mega-X" -> "Mega Raichu X"; "Dragalge-Mega" -> "Mega Dragalge".
// Matches how the application already labels megas in the Pokédex detail panel.
function label(name) {
  const parts = name.split('-');
  const i = parts.indexOf('Mega');
  if (i < 0) return name;
  const species = parts.slice(0, i).join('-');
  const suffix = parts.slice(i + 1).join(' ');
  return ('Mega ' + species + (suffix ? ' ' + suffix : '')).trim();
}

(async function main() {
  let extract;
  if (!REFRESH && fs.existsSync(CACHE)) {
    extract = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    console.log('using cached Showdown extract (' + extract.formes.length + ' mega formes) — pass --refresh to re-download');
  } else {
    console.log('downloading ' + SOURCE_URL);
    const ts = await get(SOURCE_URL);
    extract = { source: SOURCE_URL, formes: extractMegaFormes(ts) };
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(extract, null, 1) + '\n');
    console.log('cached ' + extract.formes.length + ' mega formes to ' + path.relative(ROOT, CACHE));
  }

  const reg = readMegaRegistry();
  const official = new Set([...reg.gen6, ...reg.za]);

  const kept = collapse(extract.formes.filter(f => official.has(f.base)));
  kept.sort((a, b) => a.name.localeCompare(b.name));

  // Every mega the app claims exists must have been found, or the table is silently short again.
  const found = new Set(kept.map(f => f.base));
  const missing = [...official].filter(b => !found.has(b)).sort();

  // The Z-A set is the one this table is for; Gen VI megas keep their abilities from PokéAPI.
  const zaRows = kept.filter(f => reg.za.has(f.base));
  const rows = zaRows.flatMap(f => f.abilities.map(a => ({ pokemon: label(f.name), ability: a })));

  fs.writeFileSync(OUT_JSON, JSON.stringify({
    source: extract.source,
    generated: 'by build/generate-mega-abilities.js — do not edit by hand',
    zaMegaFormes: zaRows.length,
    rows,
    missingFromShowdown: missing,
  }, null, 1) + '\n');

  // --- rewrite the table in the app ------------------------------------------------------
  const src = fs.readFileSync(APP, 'utf8');
  const startMark = '  const CHAMP_MEGA_ABILITIES=[';
  const s = src.indexOf(startMark);
  if (s < 0) throw new Error('could not locate CHAMP_MEGA_ABILITIES in app/index.html');
  const e = src.indexOf('\n  ];', s);
  if (e < 0) throw new Error('could not locate the end of CHAMP_MEGA_ABILITIES');

  // Two rows per line, to keep the diff readable in a 500 KB single-file app.
  const lines = [];
  for (let i = 0; i < rows.length; i += 2) {
    lines.push('    ' + rows.slice(i, i + 2)
      .map(r => "{pokemon:'" + r.pokemon + "',ability:'" + r.ability + "'}").join(','));
  }
  const block = startMark + '\n' + lines.join(',\n');
  const next = src.slice(0, s) + block + src.slice(e);

  const before = (src.match(/\{pokemon:'Mega [^}]*\}/g) || []).length;
  fs.writeFileSync(APP, next);

  console.log('');
  console.log('Z-A mega formes:      ' + zaRows.length);
  console.log('table rows written:   ' + rows.length + '  (was ' + before + ')');
  if (missing.length) {
    console.log('');
    console.log('WARNING — declared official but absent from Showdown: ' + missing.join(', '));
    console.log('These will have no ability recorded. Investigate before shipping.');
  }
  const multi = zaRows.reduce((m, f) => (m[f.base] = (m[f.base] || 0) + 1, m), {});
  const twoPlus = Object.entries(multi).filter(([, n]) => n > 1);
  if (twoPlus.length) {
    console.log('');
    console.log('species with more than one distinct mega: ' + twoPlus.map(([b, n]) => b + ' (' + n + ')').join(', '));
  }
  console.log('');
  console.log('wrote ' + path.relative(ROOT, OUT_JSON));
  console.log('rewrote CHAMP_MEGA_ABILITIES in ' + path.relative(ROOT, APP));
  console.log('Remember: bump the version on line 2 and add a CHANGELOG entry.');
})().catch(err => { console.error(err.message); process.exit(1); });
