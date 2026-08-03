#!/usr/bin/env node
/* HoopaDex — Generation I Special stat
 * Run: node build/generate-gen1-special.js [--refresh]
 *
 * Writes GEN1_SPECIAL into app/index.html and data/gen1-special.json.
 *
 * Generation I had ONE Special stat, used for both special attack and special defence. Gen II split
 * it in two. The app has always shown the modern pair for Gen I, which is not what that game had.
 *
 * The obvious shortcut — "show the modern Special Attack" — is wrong for **46 of the 152** Gen I
 * species. When the stat was split, Game Freak frequently kept the old Special as the new Special
 * DEFENCE and raised Special Attack: Charizard's Gen I Special was 85, its modern SpA is 109 and
 * its modern SpD is 85. Chansey's was 105 against a modern SpA of 35. Neither modern stat is
 * reliably the Gen I value, so it has to come from Gen I data.
 *
 * Source: Showdown's `data/mods/gen1/pokedex.ts`, where every entry carries spa === spd — that
 * equality IS the single Special stat, and this script asserts it rather than assuming it.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const DATA = path.join(ROOT, 'data');
const CACHE = path.join(DATA, 'gen1-special.json');
const REFRESH = process.argv.includes('--refresh');

const G1 = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/mods/gen1/pokedex.ts';
const CUR = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/pokedex.ts';

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode + ' ' + url));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

function parse(ts) {
  const out = {};
  const re = /^\t(\w+): \{([\s\S]*?)^\t\},/gm;
  let m;
  while ((m = re.exec(ts))) {
    const body = m[2];
    const num = (body.match(/num: (-?\d+)/) || [])[1];
    const bs = body.match(/baseStats: \{([^}]*)\}/);
    const st = {};
    if (bs) [...bs[1].matchAll(/(\w+): (\d+)/g)].forEach(x => st[x[1]] = +x[2]);
    out[m[1]] = { num: num === undefined ? null : +num, stats: st };
  }
  return out;
}

(async () => {
  let cached = null;
  if (!REFRESH && fs.existsSync(CACHE)) {
    cached = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
    console.log('using cached derivation (' + Object.keys(cached.special).length + ' species)');
  }

  let special = cached && cached.special;
  let mismatch = cached && cached.differsFromModernSpA;

  if (!special) {
    console.log('downloading Showdown Gen I and current pokedex…');
    const [g1ts, curts] = await Promise.all([get(G1), get(CUR)]);
    const g1 = parse(g1ts), cur = parse(curts);

    special = {}; mismatch = [];
    for (const [key, e] of Object.entries(g1)) {
      const st = e.stats;
      if (st.spa === undefined) continue;
      // The equality is the whole premise. If Showdown ever stops encoding Gen I this way, stop.
      if (st.spa !== st.spd) throw new Error('gen1 ' + key + ' has spa ' + st.spa + ' != spd ' + st.spd +
        ' — Showdown no longer encodes the single Special stat as spa===spd; this script needs revisiting');
      const num = (cur[key] && cur[key].num) != null ? cur[key].num : e.num;
      if (num == null || num < 1 || num > 151) continue;   // Gen I dex only
      special[num] = st.spa;
      if (cur[key] && cur[key].stats.spa !== st.spa) {
        mismatch.push({ num, name: key, gen1: st.spa, modernSpA: cur[key].stats.spa, modernSpD: cur[key].stats.spd });
      }
    }
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify({
      source: G1,
      generated: 'by build/generate-gen1-special.js — do not edit by hand',
      note: 'Generation I had one Special stat. Showdown encodes it as spa === spd in the gen1 mod.',
      speciesCovered: Object.keys(special).length,
      differsFromModernSpA: mismatch,
      special,
    }, null, 1) + '\n');
  }

  const nums = Object.keys(special).map(Number).sort((a, b) => a - b);
  if (nums.length !== 151) {
    console.log('WARNING: covered ' + nums.length + ' of 151 Gen I species. Missing: ' +
      Array.from({ length: 151 }, (_, i) => i + 1).filter(n => !(n in special)).join(', '));
  }

  const literal = '{' + nums.map(n => n + ':' + special[n]).join(',') + '}';
  const src = fs.readFileSync(APP, 'utf8');
  let next;
  if (/^const GEN1_SPECIAL=\{.*?\};$/m.test(src)) {
    next = src.replace(/^const GEN1_SPECIAL=\{.*?\};$/m, 'const GEN1_SPECIAL=' + literal + ';');
  } else {
    const anchor = 'const PAST_STATS=';
    const at = src.indexOf(anchor);
    if (at < 0) throw new Error('could not find an anchor to insert GEN1_SPECIAL before');
    const banner =
      '/* Generation I had ONE Special stat, used for both special attack and special defence; Gen II\n' +
      '   split it. Showing the modern pair for Gen I is simply a different game\'s stat line.\n' +
      '   Keyed by dex number, generated by build/generate-gen1-special.js from Showdown\'s gen1 mod.\n' +
      '   Not derivable from the modern stats: 46 of the 151 differ from modern Special Attack, because\n' +
      '   the split often kept the old Special as the new Special DEFENCE and raised Special Attack -\n' +
      '   Charizard was 85, its modern SpA is 109. Do not edit by hand; rerun the generator. */\n' +
      'const GEN1_SPECIAL=' + literal + ';\n';
    next = src.slice(0, at) + banner + src.slice(at);
  }
  fs.writeFileSync(APP, next);

  console.log('');
  console.log('species covered:                 ' + nums.length + ' / 151');
  console.log('differ from modern Special Atk:  ' + mismatch.length);
  mismatch.slice(0, 8).forEach(m => console.log('   #' + String(m.num).padStart(3) + ' ' + m.name.padEnd(12) +
    'Gen I ' + String(m.gen1).padEnd(5) + 'modern SpA ' + String(m.modernSpA).padEnd(5) + 'SpD ' + m.modernSpD));
  if (mismatch.length > 8) console.log('   … and ' + (mismatch.length - 8) + ' more (full list in ' + path.relative(ROOT, CACHE) + ')');
  console.log('');
  console.log('wrote ' + path.relative(ROOT, CACHE));
  console.log('embedded GEN1_SPECIAL in ' + path.relative(ROOT, APP));
  console.log('Remember: bump the version on line 2 and add a CHANGELOG entry.');
})().catch(e => { console.error(e.message); process.exit(1); });
