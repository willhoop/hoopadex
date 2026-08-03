#!/usr/bin/env node
/* HoopaDex — Champions roster audit
 * Run: node build/audit-champions-roster.js
 *
 * CHAMPIONS_IDS is the last table in this app that is neither derived from a published source nor
 * checked against one. Everything else generation-aware now is: base stats and typing come from
 * Showdown's mod data, the regulation diff is a set difference, move flags come from the bundled
 * calc engine. This roster is ~200 hand-typed National Dex numbers, and a wrong one is invisible —
 * the dex still renders, the filter still filters, the article still generates.
 *
 * This does not invent a roster. It checks the one that is there for the things that can be
 * verified mechanically against PokéAPI:
 *
 *   - duplicates and out-of-range ids
 *   - whether each regulation is a superset of the one before it
 *   - which entries are NOT fully evolved (the babies / NFE question)
 *   - which entries are the baby stage of a line
 *
 * Evolution data is cached in data/evolution-cache.json so reruns are offline and free.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CACHE = path.join(ROOT, 'data', 'evolution-cache.json');

function readRegs() {
  const lines = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8').split(/\r?\n/);
  const a = lines.findIndex(l => l.startsWith('const CHAMPIONS_IDS_MA='));
  const b = lines.findIndex((l, i) => i > a && l.startsWith('const LATEST_REG='));
  const src = lines.slice(a, b).join('\n');
  const regs = eval(src + '\n;({CHAMPIONS_REGS})').CHAMPIONS_REGS;
  return { regs, src };
}

async function evolutionFacts(ids) {
  let cache = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const missing = ids.filter(id => !cache[id]);
  if (missing.length) {
    if (typeof fetch !== 'function') throw new Error('need fetch (node 18+) to populate the cache');
    process.stderr.write(`fetching evolution data for ${missing.length} species\n`);
    const chains = {};
    for (const id of missing) {
      const r = await fetch('https://pokeapi.co/api/v2/pokemon-species/' + id);
      if (!r.ok) { cache[id] = { name: '#' + id, unknown: true }; continue; }
      const sp = await r.json();
      const chainUrl = sp.evolution_chain && sp.evolution_chain.url;
      let chain = chains[chainUrl];
      if (chainUrl && !chain) {
        const cr = await fetch(chainUrl);
        chain = chains[chainUrl] = cr.ok ? await cr.json() : null;
      }
      // Walk the chain and record, for this species, whether anything evolves FROM it.
      let evolvesTo = [], isBaby = false, stage = 0;
      if (chain && chain.chain) {
        const walk = (node, depth) => {
          if (node.species.name === sp.name) {
            evolvesTo = node.evolves_to.map(e => e.species.name);
            isBaby = !!node.is_baby;
            stage = depth;
          }
          node.evolves_to.forEach(n => walk(n, depth + 1));
        };
        walk(chain.chain, 0);
      }
      cache[id] = { name: sp.name, fullyEvolved: evolvesTo.length === 0, evolvesTo, isBaby, stage };
    }
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(cache, null, 1) + '\n');
  }
  return cache;
}

(async () => {
  const { regs, src } = readRegs();
  console.log('=== Champions roster audit ===\n');

  // --- mechanical checks that need no network ------------------------------------------
  let problems = 0;
  for (const r of regs) {
    const ids = [...r.ids()];
    const dupes = ids.filter((v, i) => ids.indexOf(v) !== i);
    const bad = ids.filter(v => !Number.isInteger(v) || v < 1 || v > 1025);
    console.log(`${r.label}: ${ids.length} entries`);
    if (dupes.length) { console.log(`  DUPLICATE ids: ${[...new Set(dupes)].join(', ')}`); problems++; }
    if (bad.length) { console.log(`  OUT OF RANGE: ${bad.join(', ')}`); problems++; }
  }
  // A later regulation should contain everything the earlier one did, unless something was cut.
  for (let i = 0; i < regs.length - 1; i++) {
    const newer = regs[i].ids(), older = regs[i + 1].ids();
    const dropped = [...older].filter(id => !newer.has(id));
    console.log(`${regs[i + 1].label} -> ${regs[i].label}: ${dropped.length ? dropped.length + ' dropped (' + dropped.join(', ') + ')' : 'superset, nothing dropped'}`);
  }

  // The raw source is a literal; a duplicate there is silently collapsed by the Set, so the count
  // above would look right while the roster is short. Check the text too.
  const literal = (src.match(/CHAMPIONS_IDS_MA=new Set\(\[([^\]]*)\]/) || [])[1] || '';
  const rawIds = literal.split(',').map(s => s.trim()).filter(Boolean).map(Number);
  const rawDupes = rawIds.filter((v, i) => rawIds.indexOf(v) !== i);
  console.log(`\nM-A literal: ${rawIds.length} numbers written, ${new Set(rawIds).size} unique`);
  if (rawDupes.length) { console.log(`  DUPLICATES IN SOURCE: ${[...new Set(rawDupes)].join(', ')}`); problems++; }

  // --- the babies / NFE question --------------------------------------------------------
  const all = [...new Set(regs.flatMap(r => [...r.ids()]))].sort((a, b) => a - b);
  const facts = await evolutionFacts(all);
  const nfe = all.filter(id => facts[id] && facts[id].fullyEvolved === false);
  const babies = all.filter(id => facts[id] && facts[id].isBaby);

  console.log(`\n--- Not fully evolved (${nfe.length} of ${all.length}) ---`);
  if (!nfe.length) console.log('  none — every entry is a final stage');
  nfe.forEach(id => console.log(`  #${String(id).padStart(4, '0')} ${facts[id].name} -> evolves into ${facts[id].evolvesTo.join(', ')}`));
  console.log(`\n--- Baby Pokémon (${babies.length}) ---`);
  if (!babies.length) console.log('  none');
  babies.forEach(id => console.log(`  #${String(id).padStart(4, '0')} ${facts[id].name}`));

  console.log(`\n${problems ? problems + ' structural problem(s)' : 'no structural problems'}; ${nfe.length} non-final-stage entries to review.`);
})().catch(e => { console.error(e.message); process.exit(1); });
