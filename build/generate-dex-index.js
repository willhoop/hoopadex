#!/usr/bin/env node
/* HoopaDex — what a Pokedex card needs, for every Pokemon, in one file
 * Run: node build/generate-dex-index.js          (fetch PokeAPI, write app/dex-index.json)
 *      node build/generate-dex-index.js --check  (fetch again, exit 1 if the file is stale)
 *
 * Why this exists. A Pokedex card shows a name, a picture, types and, when the grid is sorted by one,
 * a stat. To draw each card the app downloaded that Pokemon's full PokeAPI record, 100 to 360 KB of
 * moves and game versions, so the first page alone was about 60 requests and several megabytes. A type
 * filter or a stat sort needed every record in range: up to 1,025 downloads. Until those arrived, a
 * stat sort silently ordered only the cards that had loaded.
 *
 * This file holds just those fields for all 1,351 entries (1,025 species and 326 forms): about 90 KB.
 * It also carries the two name lists the app fetched before it could draw anything (species, then
 * forms), so first paint no longer waits on PokeAPI at all.
 *
 * Source: the REST records the app itself reads, one per Pokemon. PokeAPI's GraphQL endpoint would be
 * one request, but on 2026-09-19 it held 1,302 entries against REST's 1,351; it lags, so it is not
 * used. Every field is copied, not re-derived: the file is the app's own input, written down.
 * A detail page still loads the full record; this file only replaces the list views' downloads.
 *
 * Format: pokemon: [[id, name, [type, type?], [hp, atk, def, spa, spd, spe], art, front, evYield, spriteSets], ...]
 *   art / front: 1 = PokeAPI has the image at its standard URL, 0 = it has none,
 *                or the URL itself if it is anywhere else (none are, today; the check keeps it honest).
 *   evYield:     six digits, the EV yield in the same stat order ("000300"), for the EV Training table.
 *   spriteSets:  hex bits over the file's `spriteSets` list: which games have a sprite of this Pokemon.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'app', 'dex-index.json');
const API = 'https://pokeapi.co/api/v2/';
const SPRITE_ROOT = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
const STATS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

async function getJson(url, tries = 5) {
  for (let t = 1; ; t++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return await r.json();
    } catch (e) {
      if (t >= tries) throw e;
      await new Promise(res => setTimeout(res, 700 * t));
    }
  }
}
const idOf = url => +url.split('/').filter(Boolean).pop();
const img = (url, std) => url == null ? 0 : (url === std ? 1 : url);

/* Which per-game sprite set has a picture of this Pokemon (5.53). PokeAPI ships one set per game
   group - Ruby/Sapphire, Emerald, FireRed/LeafGreen and so on - and the app used ONE set per
   generation, so FireRed showed Emerald's sprites. Coverage differs per Pokemon (no Gen IV species
   has a Gen III sprite) and the file type differs per set (.png, .gif for Generation VII, .webp for
   Generation VIII), which is why both are read here rather than assumed.
   `icons` and `red-green-japan` are skipped: menu icons, and a Japanese release the app does not list. */
const SKIP_SET = /(^|\/)icons$|red-green-japan/;
const spriteSets = {};   // "generation-iii/emerald" -> { ext, count }
function spriteBits(p) {
  const v = (p.sprites && p.sprites.versions) || {};
  const have = new Set();
  for (const gen of Object.keys(v)) {
    for (const set of Object.keys(v[gen])) {
      const key = gen + '/' + set;
      if (SKIP_SET.test(key)) continue;
      const url = v[gen][set] && v[gen][set].front_default;
      const rec = spriteSets[key] || (spriteSets[key] = { ext: null, count: 0 });
      if (!url) continue;
      const expect = SPRITE_ROOT + 'versions/' + key + '/' + p.id + '.';
      if (url.indexOf(expect) !== 0) throw new Error(p.name + ': ' + key + ' sits at an unexpected URL: ' + url);
      const ext = url.slice(expect.length);
      if (rec.ext && rec.ext !== ext) throw new Error(key + ' mixes file types: ' + rec.ext + ' and ' + ext);
      rec.ext = ext; rec.count++;
      have.add(key);
    }
  }
  return have;
}
/* One bit per set, in the order the sets are written to the file, as hex. */
function bitsToHex(have, order) {
  let out = '';
  for (let i = 0; i < order.length; i += 4) {
    let nib = 0;
    for (let b = 0; b < 4; b++) if (have.has(order[i + b])) nib |= 1 << b;
    out += nib.toString(16);
  }
  return out.replace(/0+$/, '');
}

function reduce(p) {
  const types = p.types.slice().sort((a, b) => a.slot - b.slot).map(t => t.type.name);
  const st = STATS.map(n => { const s = p.stats.find(x => x.stat.name === n); if (!s) throw new Error(p.name + ' has no ' + n); return s; });
  const stats = st.map(s => s.base_stat);
  const effort = st.map(s => s.effort).join('');   // EV yields are 0-3, so six digits hold them
  const art = p.sprites && p.sprites.other && p.sprites.other['official-artwork'] ? p.sprites.other['official-artwork'].front_default : null;
  return [p.id, p.name, types, stats,
    img(art, SPRITE_ROOT + 'other/official-artwork/' + p.id + '.png'),
    img(p.sprites ? p.sprites.front_default : null, SPRITE_ROOT + p.id + '.png'), effort, spriteBits(p)];
}

async function build() {
  /* The two list requests the app makes at startup, verbatim, so the snapshot's lists are the same
     lists: master is the first 1,025 in order, forms are the next page filtered to ids above 10000. */
  const sp = (await getJson(API + 'pokemon?limit=1025&offset=0')).results;
  /* The app numbers the species list by position (id = index + 1). If PokeAPI ever returned it out
     of order that would be wrong everywhere, so it is checked here rather than copied on trust. */
  sp.forEach((p, i) => { if (idOf(p.url) !== i + 1) throw new Error('species list out of order at ' + i + ': ' + p.url); });
  const species = sp.map((p, i) => ({ id: i + 1, name: p.name }));
  const forms = (await getJson(API + 'pokemon?limit=500&offset=1025')).results.map(p => ({ id: idOf(p.url), name: p.name })).filter(p => p.id > 10000);
  const all = species.concat(forms);
  const out = new Array(all.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (next < all.length) {
      const i = next++;
      const rec = reduce(await getJson(API + 'pokemon/' + all[i].id));
      if (rec[1] !== all[i].name) throw new Error('record ' + all[i].id + ' is ' + rec[1] + ', the list says ' + all[i].name);
      out[i] = rec;
      if (++done % 200 === 0) process.stderr.write('  ' + done + '/' + all.length + '\n');
    }
  }));
  /* The sets, in a fixed order, with the file type each one uses. The rows' bit strings are written
     against this order, so it is part of the file. */
  const order = Object.keys(spriteSets).filter(k => spriteSets[k].count > 0).sort();
  out.forEach(r => { r[7] = bitsToHex(r[7], order); });
  return { speciesCount: species.length, formsCount: forms.length, pokemon: out,
    spriteSets: order.map(k => [k, spriteSets[k].ext]) };
}

(async () => {
  const check = process.argv.includes('--check');
  const b = await build();
  if (check) {
    const cur = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const same = JSON.stringify(cur.pokemon) === JSON.stringify(b.pokemon) && JSON.stringify(cur.spriteSets) === JSON.stringify(b.spriteSets);
    console.log(same
      ? 'check: app/dex-index.json matches PokeAPI (' + b.pokemon.length + ' entries, taken ' + cur.fetched + ')'
      : 'STALE: app/dex-index.json differs from PokeAPI; rerun without --check');
    process.exit(same ? 0 : 1);
  }
  const doc = {
    about: 'Generated by build/generate-dex-index.js from PokeAPI. Do not edit by hand.',
    fetched: new Date().toISOString().slice(0, 10),
    species: b.speciesCount, forms: b.formsCount,
    spriteSets: b.spriteSets,
    pokemon: b.pokemon,
  };
  fs.writeFileSync(OUT, JSON.stringify(doc) + '\n');
  const odd = b.pokemon.filter(p => typeof p[4] === 'string' || typeof p[5] === 'string').length;
  console.log('wrote app/dex-index.json: ' + b.speciesCount + ' species + ' + b.formsCount + ' forms, ' +
    (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB; ' + odd + ' with a non-standard image URL, ' +
    b.pokemon.filter(p => p[4] === 0).length + ' with no artwork');
})().catch(e => { console.error(e); process.exit(1); });
