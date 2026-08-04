#!/usr/bin/env node
/* HoopaDex — which alternate formes are actually usable
 * Run: node build/generate-form-gating.js
 *
 * Writes data/form-gating.json. Does NOT modify app/index.html.
 *
 * Why this exists. `formAllowed()` let through every Mega of every species on the Champions roster,
 * because the only tests it applied were "is the base species legal" and "is this generation inside
 * the forme's window". Both pass for things that are not in the game. The Speed Tiers table
 * therefore opened with Mega Absol, Mega Garchomp and Mega Lucario in their **Legends: Z-A** forms
 * at 151 base Speed — none of which exists in Pokémon Champions — and also listed Ash-Greninja,
 * which is not a Mega at all and cannot be chosen when building a team.
 *
 * The rule that actually decides it is already in the app, in the form of CHAMPIONS_ITEMS:
 *
 *     A Mega is usable exactly when its Mega Stone is legal in the regulation.
 *
 * Absolite is a legal Champions item; Absolite Z is not. That is the whole difference between the
 * Mega Absol that exists and the one that does not, and it is derivable rather than a judgement
 * call. Showdown's pokedex records the link directly as `requiredItem`.
 *
 * Two other flags are worth carrying for the same reason:
 *   battleOnly    - a forme you transform into mid-battle (Ash-Greninja, Zacian-Crowned). You
 *                   cannot pick it when building, so it does not belong in a roster table.
 *   isNonstandard - Showdown's own marker for something not in standard play (CAP, Past).
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'form-gating.json');
const SOURCE = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts';

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode !== 200) return rej(new Error(url + ' -> HTTP ' + r.statusCode));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

// Brace-matched top-level species blocks, so a nested object cannot end one early.
function blocks(src) {
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

const flat = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

(async () => {
  process.stderr.write('fetching Showdown pokedex…\n');
  const all = blocks(await get(SOURCE));

  const requiredItem = {};   // showdown forme key -> flattened stone name
  const battleOnly = [];
  const nonstandard = {};

  for (const [key, blk] of Object.entries(all)) {
    const ri = blk.match(/requiredItem:\s*"([^"]+)"/);
    if (ri) requiredItem[key] = flat(ri[1]);
    if (/battleOnly:/.test(blk)) battleOnly.push(key);
    const ns = blk.match(/isNonstandard:\s*"([^"]+)"/);
    if (ns) nonstandard[key] = ns[1];
  }

  const payload = {
    source: SOURCE,
    generated: 'by build/generate-form-gating.js — do not edit by hand',
    rule: 'In Champions, a forme with a requiredItem is legal only if that item is in CHAMPIONS_ITEMS. A battleOnly forme is never selectable when building.',
    counts: {
      formesWithRequiredItem: Object.keys(requiredItem).length,
      battleOnly: battleOnly.length,
      nonstandard: Object.keys(nonstandard).length,
    },
    requiredItem,
    battleOnly: battleOnly.sort(),
    nonstandard,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
  console.log(`wrote ${path.relative(ROOT, OUT)}`);
  console.log('  formes needing an item :', payload.counts.formesWithRequiredItem);
  console.log('  battle-only formes     :', payload.counts.battleOnly);
  console.log('  marked non-standard    :', payload.counts.nonstandard);
  console.log('\n  spot checks:');
  for (const k of ['absolmega', 'absolmegaz', 'garchompmega', 'garchompmegaz', 'greninjamega', 'sceptilemega'])
    console.log('   ', (k + '            ').slice(0, 16), requiredItem[k] || '(no requiredItem)');
  console.log('   greninjaash battleOnly:', battleOnly.includes('greninjaash'));
})();
