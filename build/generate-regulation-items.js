#!/usr/bin/env node
/* HoopaDex — item legality per Champions regulation
 * Run: node build/generate-regulation-items.js [--refresh]
 *
 * Writes data/regulation-items.json and embeds REG_ITEM_CHANGES in app/index.html.
 *
 * The Regulation Changes page could only report the roster, and said outright that item legality
 * was "not tracked" because nothing in the app recorded it. It is recorded — by Showdown, which
 * carries the two regulations as SEPARATE MODS:
 *
 *   data/mods/champions/          Regulation M-B (the current one)
 *   data/mods/championsregma/     Regulation M-A, inheriting from it
 *
 * Because M-A inherits from M-B, its items.ts contains only the DIFFERENCES — every item it marks
 * `isNonstandard` is an item that is legal in M-B and was not legal in M-A. That file IS the change
 * list, which is why this needs no hand-maintained table.
 *
 * The two reasons Showdown gives are both "not legal here", differing only in why: "Future" for the
 * mega stones of species that did not exist yet, "Past" for items simply not in the format at that
 * point. Both are reported the same way, since the effect on legality is identical.
 *
 * Note also what is ABSENT: championsregma has no moves.ts, abilities.ts or learnsets.ts. Nothing
 * about moves differs between the two regulations - which independently confirms the move diff the
 * app already derives from its own learnset export, by a completely separate route.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(DATA, 'regulation-items.json');
const REFRESH = process.argv.includes('--refresh');

const BASE = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/';
const MODS = { 'reg-mb': 'champions', 'reg-ma': 'championsregma' };

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode === 404) return res(null);
      if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode + ' ' + url));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

function parseItems(ts) {
  const out = {};
  const re = /^\t(\w+): \{([\s\S]*?)^\t\},/gm;
  let m;
  while ((m = re.exec(ts))) {
    const ns = (m[2].match(/isNonstandard: ("?\w+"?)/) || [])[1];
    out[m[1]] = ns === undefined ? 'ABSENT' : ns.replace(/"/g, '');
  }
  return out;
}
const legal = v => v === undefined || v === 'null' || v === 'ABSENT';

// PokéAPI slugs, so the generated rows link to items the app already knows.
function slugOf(key, names) { return names[key] || key; }

(async () => {
  if (!REFRESH && fs.existsSync(OUT)) {
    const d = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    console.log('using cached derivation (' + d.added.length + ' added, ' + d.removed.length + ' removed)');
    embed(d);
    return;
  }

  console.log('downloading the two Champions mods…');
  const mbTs = await get(BASE + MODS['reg-mb'] + '/items.ts');
  const maTs = await get(BASE + MODS['reg-ma'] + '/items.ts');
  if (!mbTs || !maTs) throw new Error('could not fetch both regulation mods — Showdown may have restructured them');
  /* Display names come from the base items.ts. The mods carry only overrides and inherit the name,
     so the flattened key is all they have - and "raichunitex" on screen is not a name. Guessing it
     back from a slug produced "Raichunitex"; the base file simply says "Raichunite X". */
  const baseTs = await get('https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/items.ts');
  const NAMES = {};
  if (baseTs) {
    const re = /^	(\w+): \{([\s\S]*?)^	\},/gm;
    let m;
    while ((m = re.exec(baseTs))) {
      const nm = (m[2].match(/name: "([^"]+)"/) || [])[1];
      if (nm) NAMES[m[1]] = nm;
    }
  }

  const mb = parseItems(mbTs), maOverrides = parseItems(maTs);

  // M-A inherits M-B, so anything it does not override has M-B's legality.
  const maLegality = key => (key in maOverrides) ? maOverrides[key] : mb[key];

  const keys = [...new Set([...Object.keys(mb), ...Object.keys(maOverrides)])];
  const added = [], removed = [];
  keys.forEach(k => {
    const inMA = legal(maLegality(k)), inMB = legal(mb[k]);
    if (inMB && !inMA) added.push({ key: k, name: NAMES[k] || k, reason: maOverrides[k] || 'unknown' });
    if (inMA && !inMB) removed.push({ key: k, name: NAMES[k] || k });
  });
  added.sort((a, b) => a.key.localeCompare(b.key));
  removed.sort((a, b) => a.key.localeCompare(b.key));

  // Showdown keys are flattened; the app displays PokéAPI slugs elsewhere, so map by best effort
  // and record anything that does not resolve rather than silently dropping it.
  const record = {
    source: BASE + MODS['reg-ma'] + '/items.ts (overrides on ' + MODS['reg-mb'] + ')',
    generated: 'by build/generate-regulation-items.js — do not edit by hand',
    note: 'championsregma has no moves.ts/abilities.ts/learnsets.ts, so nothing but items differs.',
    from: 'reg-ma', to: 'reg-mb',
    added, removed,
  };
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(record, null, 1) + '\n');
  embed(record);
})().catch(e => { console.error(e.message); process.exit(1); });

function embed(rec) {
  // JSON.stringify, not hand-rolled quoting: an item with an apostrophe (King's Rock) would
  // otherwise emit a broken string literal into a 500 KB file and fail only at parse time.
  const q = t => JSON.stringify(String(t));
  const literal = '{"reg-ma->reg-mb":{added:[' + rec.added.map(a => q(a.name)).join(',') +
    '],removed:[' + rec.removed.map(r => q(r.name)).join(',') + ']}}';
  const src = fs.readFileSync(APP, 'utf8');
  let next;
  if (/^const REG_ITEM_CHANGES=\{.*?\};$/m.test(src)) {
    next = src.replace(/^const REG_ITEM_CHANGES=\{.*?\};$/m, 'const REG_ITEM_CHANGES=' + literal + ';');
  } else {
    const anchor = 'const CHAMPIONS_REGS=[';
    const at = src.indexOf(anchor);
    if (at < 0) throw new Error('could not find CHAMPIONS_REGS to insert before');
    const banner =
      '/* Item legality per regulation, keyed "from->to". Generated by\n' +
      '   build/generate-regulation-items.js from Showdown, which carries the two regulations as\n' +
      '   separate mods - championsregma inherits from champions, so its items.ts IS the change list.\n' +
      '   Do not edit by hand; rerun the generator. */\n' +
      'const REG_ITEM_CHANGES=' + literal + ';\n';
    next = src.slice(0, at) + banner + src.slice(at);
  }
  fs.writeFileSync(APP, next);

  console.log('');
  console.log('items added in Regulation M-B:   ' + rec.added.length);
  rec.added.forEach(a => console.log('   + ' + a.name.padEnd(18) + '(' + a.reason + ')'));
  const unnamed = rec.added.filter(a => a.name === a.key);
  if (unnamed.length) console.log('   WARNING: no display name found for ' + unnamed.map(u => u.key).join(', '));
  console.log('items removed in Regulation M-B: ' + rec.removed.length);
  console.log('');
  console.log('wrote ' + path.relative(ROOT, OUT));
  console.log('embedded REG_ITEM_CHANGES in ' + path.relative(ROOT, APP));
  console.log('Remember: bump the version on line 2 and add a CHANGELOG entry.');
}
