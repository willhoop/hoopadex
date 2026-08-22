#!/usr/bin/env node
/* HoopaDex — abilities a species had in an earlier generation
 * Run: node build/generate-past-abilities.js
 *
 * Writes data/past-abilities.json and data/past-abilities.embed.json.
 * Does NOT modify app/index.html — build/embed-past-abilities.js does that.
 *
 * Why this exists. Gengar's ability is Cursed Body. It was LEVITATE from Generation III through
 * Generation VI, which is a full immunity to Ground-type moves. The app showed Cursed Body in every
 * generation, so a reader on Generation IV was told that Earthquake hits Gengar. It does not.
 *
 * That is worse than a wrong label. The ability feeds the type-matchup answer, so one stale field
 * produces a confidently wrong answer to a different question — the exact failure this project
 * exists to remove.
 *
 * SOURCE: PokeAPI's `pokemonabilitypast` table, via its GraphQL endpoint. One request instead of
 * 1,025, and the field is not exposed on the REST /pokemon endpoint the app already calls, which is
 * why it needs a build step rather than a runtime read.
 *
 * SCALE, and why the number is small. There are 569 rows in that table and only 29 species matter:
 *
 *   428 rows say a HIDDEN slot did not exist yet. Hidden abilities arrived in Generation V, the app
 *       already gates on that, and re-stating it here would be a second rule to keep in step.
 *     8 rows are a normal ability that was genuinely different (Gengar, Basculin, Shiftry, ...).
 *    21 rows are a hidden ability that was genuinely different.
 *
 * So this ships 29 species. A table that small is exactly the kind that gets hand-typed and then
 * silently rots; generating it costs one script and removes that possibility.
 *
 * THE CUTOFF CONVENTION matches every other generated table here: a row recorded against
 * generation N describes generation N AND EVERY GENERATION BELOW IT, until a lower row takes over.
 * Gengar's Levitate row is generation 6, so Generations III to VI show Levitate and VII onward show
 * Cursed Body.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'past-abilities.json');
const EMBED = path.join(ROOT, 'data', 'past-abilities.embed.json');
const GQL = 'https://beta.pokeapi.co/graphql/v1beta';

const QUERY = `{
  pokemon_v2_pokemonabilitypast {
    is_hidden slot generation_id
    pokemon_v2_ability { name }
    pokemon_v2_pokemon { name id }
  }
}`;

function post(url, body) {
  return new Promise((res, rej) => {
    const u = new URL(url);
    const data = JSON.stringify({ query: body });
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'user-agent': 'hoopadex-build' },
    }, r => {
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c);
      r.on('end', () => r.statusCode === 200 ? res(b) : rej(new Error('HTTP ' + r.statusCode + ': ' + b.slice(0, 200))));
    });
    req.on('error', rej); req.write(data); req.end();
  });
}

(async () => {
  const j = JSON.parse(await post(GQL, QUERY));
  if (j.errors) throw new Error(JSON.stringify(j.errors).slice(0, 300));
  const rows = j.data.pokemon_v2_pokemonabilitypast;

  const species = {};
  let hiddenAbsent = 0, changed = 0;
  for (const r of rows) {
    /* A row with no ability is "this slot was empty then". For a hidden slot that is the Generation
       V rule the app already applies, and duplicating it would create two places to keep in step.
       For a NORMAL slot it would be a real fact, so it is counted rather than assumed away — if one
       ever appears, the count below stops matching and someone has to look. */
    if (!r.pokemon_v2_ability) { if (r.is_hidden) { hiddenAbsent++; continue; } }
    const name = r.pokemon_v2_pokemon.name;
    const rec = species[name] || (species[name] = { id: r.pokemon_v2_pokemon.id, gens: {} });
    const g = rec.gens[r.generation_id] || (rec.gens[r.generation_id] = []);
    g.push({
      slot: r.slot,
      hidden: !!r.is_hidden,
      ability: r.pokemon_v2_ability ? r.pokemon_v2_ability.name : null,
    });
    changed++;
  }
  for (const k of Object.keys(species)) {
    for (const g of Object.keys(species[k].gens)) species[k].gens[g].sort((a, b) => a.slot - b.slot);
  }

  const payload = {
    source: GQL + ' (pokemon_v2_pokemonabilitypast)',
    generated: 'by build/generate-past-abilities.js — do not edit by hand',
    convention: 'A row recorded against generation N describes generation N and every generation below it, until a lower row takes over. Rows saying a HIDDEN slot did not exist are excluded: the app already gates hidden abilities on Generation V.',
    counts: { rowsTotal: rows.length, hiddenSlotAbsentSkipped: hiddenAbsent, rowsKept: changed, species: Object.keys(species).length },
    species,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
  fs.writeFileSync(EMBED, JSON.stringify(species));

  console.log('wrote ' + path.relative(ROOT, OUT));
  console.log('wrote ' + path.relative(ROOT, EMBED) + '  (' + Math.round(fs.statSync(EMBED).size / 1024) + ' KB)');
  console.log('  rows in PokeAPI              :', rows.length);
  console.log('  hidden-slot-absent (skipped) :', hiddenAbsent);
  console.log('  species with a real change   :', Object.keys(species).length);
  console.log('\n  spot check — gengar:', JSON.stringify(species['gengar']));
  console.log('  (Levitate through Gen VI means Ground moves do not hit it in Gens III-VI.)');
  const sample = Object.keys(species).slice(0, 12);
  console.log('\n  species:', sample.join(', ') + (Object.keys(species).length > 12 ? ', …' : ''));
})();
