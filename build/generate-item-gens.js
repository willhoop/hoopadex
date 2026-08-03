#!/usr/bin/env node
/* HoopaDex — item introduction generation table
 * Run: node build/generate-item-gens.js          (uses the cache)
 *      node build/generate-item-gens.js --refresh (re-fetch every item)
 *
 * Rewrites ITEM_INTRO_GEN in app/index.html from PokéAPI, and writes data/item-intro-gens.json.
 *
 * Why. The hand-written table was audited on 2026-08-03 against two independent sources — Showdown's
 * data/items.ts and PokéAPI's own game_indices — and both said the same thing: 46 of the 253
 * checkable entries were wrong, 18%. Two systematic errors, not scatter:
 *
 *   - 26 Generation II held items were filed under Generation III. Leftovers, King's Rock, Quick
 *     Claw, Focus Band, Scope Lens, Thick Club, Light Ball and the whole type-boosting family
 *     (Charcoal, Magnet, Miracle Seed, Mystic Water, Sharp Beak, Poison Barb, …). Held items are
 *     the headline mechanic Gold/Silver introduced; the table dated all of them a generation late.
 *   - 20 mega stones from Omega Ruby / Alpha Sapphire were filed under Generation VII. ORAS is
 *     Generation VI. Altarianite, Diancite, Metagrossite, Salamencite, Latiasite, and so on.
 *
 * Neither error is visible in the product: an item filed a generation late simply does not appear
 * when you browse that generation, which looks exactly like an item that did not exist yet.
 *
 * The introduction generation is the FIRST entry in PokéAPI's game_indices for the item. That is the
 * same API the application already reads at run time, so the table cannot disagree with its source.
 * Results are cached in data/item-intro-gens.json so a rerun is offline and byte-identical.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const DATA = path.join(ROOT, 'data');
const CACHE = path.join(DATA, 'item-intro-gens.json');
const REFRESH = process.argv.includes('--refresh');
const CONCURRENCY = 8;

const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };

function getJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'accept': 'application/json' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return resolve(getJSON(res.headers.location));
      if (res.statusCode === 404) return resolve(null);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ' ' + url));
      let b = ''; res.setEncoding('utf8');
      res.on('data', c => b += c);
      res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    }).on('error', reject);
  });
}

function readTable() {
  const src = fs.readFileSync(APP, 'utf8');
  const m = src.match(/^const ITEM_INTRO_GEN=(\{.*?\});$/m);
  if (!m) throw new Error('could not locate ITEM_INTRO_GEN in app/index.html');
  return { src, literal: m[1], table: eval('(' + m[1] + ')') };
}

// PokéAPI lists game_indices in release order; the first is where the item first appeared.
function introGenOf(item) {
  const gi = item && item.game_indices;
  if (!gi || !gi.length) return null;
  const gens = gi.map(g => ROMAN[String(g.generation.name).replace('generation-', '')]).filter(Boolean);
  return gens.length ? Math.min(...gens) : null;
}

/* The universe of items the APP ACTUALLY LOADS at runtime.
 *
 * This function exists because of a circularity found on 2026-08-03. The generator used to take its
 * list of items from the ITEM_INTRO_GEN table already in the app — the very table it is supposed to
 * validate. It could therefore only ever re-derive the items it already knew about, and was
 * structurally incapable of discovering a new one. The drift check in test-generation-tables.js
 * compared 325 against 325 and passed, while the app was loading 370 items at runtime: 45 Legends
 * Z-A mega stones that PokéAPI had added since, every one of them falling through
 * `ITEM_INTRO_GEN[name] || 9` and being silently assigned Generation IX.
 *
 * A check that compares two artefacts drawn from the same seed proves consistency, not correctness.
 * The list now comes from the same place the app gets it — the held-item categories in
 * HELD_ITEM_CATEGORIES — so the derivation can see the universe grow.
 */
async function loadedItemSlugs(src) {
  const m = src.match(/^const HELD_ITEM_CATEGORIES=\[([^\]]*)\];/m);
  if (!m) throw new Error('could not locate HELD_ITEM_CATEGORIES in app/index.html');
  const cats = m[1].split(',').map(s => Number(s.trim())).filter(n => Number.isInteger(n));
  const seen = new Set();
  for (const c of cats) {
    const d = await getJSON('https://pokeapi.co/api/v2/item-category/' + c + '/');
    if (d && d.items) d.items.forEach(i => seen.add(i.name));
  }
  return { slugs: seen, categories: cats.length };
}

(async () => {
  const { src, table } = readTable();

  const { slugs: loaded, categories } = await loadedItemSlugs(src);
  const inTableOnly = Object.keys(table).filter(s => !loaded.has(s));
  // Union, not replacement: an item the app no longer loads may still be referenced elsewhere, and
  // dropping entries is not this script's job.
  const slugs = [...new Set([...loaded, ...Object.keys(table)])].sort();

  console.log('items in the app table      : ' + Object.keys(table).length);
  console.log('items the app loads live    : ' + loaded.size + '  (from ' + categories + ' held-item categories)');
  console.log('newly discovered            : ' + [...loaded].filter(s => !(s in table)).length);
  if (inTableOnly.length) console.log('in the table but not loaded : ' + inTableOnly.length + ' (kept)');
  console.log('deriving                    : ' + slugs.length);

  let cache = {};
  if (!REFRESH && fs.existsSync(CACHE)) {
    cache = JSON.parse(fs.readFileSync(CACHE, 'utf8')).gens || {};
    console.log('cached lookups: ' + Object.keys(cache).length + '  (pass --refresh to re-fetch)');
  }

  const todo = slugs.filter(s => !(s in cache));
  if (todo.length) {
    console.log('fetching ' + todo.length + ' items from PokéAPI…');
    let done = 0;
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
      const batch = todo.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async slug => {
        try {
          const d = await getJSON('https://pokeapi.co/api/v2/item/' + slug);
          cache[slug] = d ? introGenOf(d) : null;
        } catch (e) { cache[slug] = null; }
      }));
      done += batch.length;
      if (done % 40 === 0 || done === todo.length) console.log('  ' + done + '/' + todo.length);
    }
  }

  // An item PokéAPI cannot date keeps whatever the table already said, and is reported rather than
  // silently dropped — an unexplained gap here is how a wrong number gets in.
  const unresolved = slugs.filter(s => !cache[s]);
  const next = {}, changed = [];
  slugs.forEach(s => {
    const derived = cache[s];
    next[s] = derived || table[s];
    if (derived && derived !== table[s]) changed.push({ slug: s, was: table[s], now: derived });
  });

  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify({
    source: 'https://pokeapi.co/api/v2/item/{slug} — first entry of game_indices',
    generated: 'by build/generate-item-gens.js — do not edit by hand',
    unresolved,
    gens: cache,
  }, null, 1) + '\n');

  const literal = '{' + slugs.map(s => "'" + s + "':" + next[s]).join(',') + '}';
  fs.writeFileSync(APP, src.replace(/^const ITEM_INTRO_GEN=\{.*?\};$/m, 'const ITEM_INTRO_GEN=' + literal + ';'));

  console.log('\ncorrections applied: ' + changed.length);
  changed.sort((a, b) => a.slug.localeCompare(b.slug))
    .forEach(c => console.log('  ' + c.slug.padEnd(28) + c.was + ' -> ' + c.now));
  if (unresolved.length) {
    console.log('\nPokéAPI could not date these ' + unresolved.length + ' (kept the existing value):');
    console.log('  ' + unresolved.join(', '));
  }
  console.log('\nwrote ' + path.relative(ROOT, CACHE));
  console.log('rewrote ITEM_INTRO_GEN in ' + path.relative(ROOT, APP));
  console.log('Remember: bump the version on line 2 and add a CHANGELOG entry.');
})().catch(e => { console.error(e.message); process.exit(1); });
