#!/usr/bin/env node
/* HoopaDex — what a move did in the generation you are looking at
 * Run: node build/generate-move-text.js
 *
 * Writes data/move-text.json and data/move-text.embed.json.
 * Does NOT modify app/index.html — build/embed-move-text.js does that.
 *
 * Why this exists. The app described every move with one line from PokeAPI, and that field has no
 * generation dimension. It is written for the current games, so for any older generation it is
 * somewhere between incomplete and false.
 *
 * On the scale of it — and the first number this script produced was wrong, so both are recorded.
 * 312 of 882 moves carry SOME per-generation override in Showdown, but most of those change only
 * the long paragraph, not the one-line summary, and counting them overstated the problem by more
 * than double. The honest figure for "the one-line summary is not true of the generation on screen"
 * is 138 moves, and per generation: 73 in Gen I, 62 in II, 58 in III, 56 in IV, 27 in V, 15 in VI,
 * 12 in VII, 7 in VIII, and 0 in Gen IX, which is the generation PokeAPI's text is written for.
 *
 * Jump Kick is the clearest case. PokeAPI says, for every generation ever made:
 *
 *     "If the user misses, it takes half the damage it would have inflicted in recoil."
 *
 * What actually happened:
 *     Gen I     the user takes 1 HP. Flat.
 *     Gen II    1/8 of the damage it would have dealt
 *     Gen III-IV  1/2 of the damage it would have dealt
 *     Gen V+    50% of its own MAXIMUM HP — a different basis entirely
 *
 * Four mechanics, one sentence, and in Generation I it is not a rounding difference but a different
 * move. Whirlwind in Generation I is worse: Showdown's note for it is "No competitive use", while
 * the app said it forces trainers to switch.
 *
 * SOURCE: Showdown's `data/text/moves.ts`, which carries a shortDesc and desc per move plus
 * per-generation overrides — the exact shape this needs and the one PokeAPI does not have.
 *
 * THE CUTOFF CONVENTION is Showdown's own, and the same one build/generate-past-stats.js uses for
 * base stats: a `genN` block describes generation N AND EVERY GENERATION BELOW IT, until a lower
 * override takes over. So resolving a generation means taking the override with the SMALLEST N that
 * is >= the generation asked for, and falling back to the current text when none is. Bind carries
 * overrides for 8, 7, 5, 4, 3 and 1, which means Generation VI reads the gen7 block — Gen VI and
 * VII behaved the same and only VII is written down.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not replace the game's own flavour text, which the app
 * already shows per version group. That is the sentence the game prints; this is the mechanic. They
 * answer different questions and the app shows the mechanical line only when it adds something the
 * flavour text did not already say.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'move-text.json');
const EMBED = path.join(ROOT, 'data', 'move-text.embed.json');
const SOURCE = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/text/moves.ts';
const API = 'https://pokeapi.co/api/v2/move?limit=2000';
const GEN_API = 'https://pokeapi.co/api/v2/generation/';

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'user-agent': 'hoopadex-build' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode !== 200) return rej(new Error(url + ' -> HTTP ' + r.statusCode));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

/* Same slug rule as the other generators. Every slug produced here is checked against PokeAPI's own
   index below; nothing unmatched ships. */
const SLUG_ALIAS = { 'vise-grip': 'vice-grip' };
function slug(name) {
  const s = String(name).toLowerCase()
    .replace(/[’']/g, '').replace(/[().:%]/g, '')
    .replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return SLUG_ALIAS[s] || s;
}

/* Showdown writes these strings with escapes, and they are shown to a reader, so they have to be
   unescaped rather than passed through with a stray backslash in the middle of a sentence. */
function unquote(s) {
  return String(s).replace(/\\(["'\\])/g, '$1').replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
}

/* Brace-matched top-level entries. The per-generation blocks are nested objects, so anything that
   splits on the next `key: {` ends an entry early and loses exactly the overrides this is for. */
function entries(src) {
  const out = {};
  const re = /\n\t([a-z0-9]+): \{/g;
  let m;
  while ((m = re.exec(src))) {
    const open = src.indexOf('{', m.index);
    let depth = 0, i = open, inStr = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (inStr) { if (c === '\\') { i++; continue } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') { depth--; if (!depth) break; }
    }
    out[m[1]] = src.slice(open, i + 1);
  }
  return out;
}

// A field at the top level of an entry (two tabs) rather than inside a nested generation block.
function topField(body, field) {
  const m = body.match(new RegExp('\\n\\t\\t' + field + ': "((?:[^"\\\\]|\\\\.)*)"'));
  return m ? unquote(m[1]) : '';
}

/* shortDesc ONLY, and the absence of one is meaningful rather than a gap to fill.
   Showdown's blocks carry `desc` (a full paragraph) and `shortDesc` (a line). A generation block
   holding only `desc` is saying "the long explanation differs here, the one-line summary does not"
   — so there is nothing for a one-line summary to report, and falling back to `desc` answers a
   different question at ten times the length.

   The first version did fall back, and it was wrong twice over: it put a 232-character median
   paragraph where a short line belongs, and it claimed a difference for moves whose summary had not
   changed at all. Acupressure is the example — its gen4 block is a paragraph about substitutes and
   stat stages, while its one-line summary is identical in every generation. */
function genBlocks(body) {
  const out = {};
  const re = /\n\t\t(gen[1-9]): \{([\s\S]*?)\n\t\t\},/g;
  let m;
  while ((m = re.exec(body))) {
    const sd = m[2].match(/shortDesc: "((?:[^"\\]|\\.)*)"/);
    if (!sd) continue;
    const text = unquote(sd[1]);
    if (text) out[parseInt(m[1].slice(3), 10)] = text;
  }
  return out;
}

(async () => {
  const [src, apiRaw] = await Promise.all([get(SOURCE), get(API)]);
  const apiMoves = new Set(JSON.parse(apiRaw).results.map(r => r.name));
  const all = entries(src);

  /* When each move first existed. Without it the cutoff resolution answers questions nobody can
     ask: Aurora Veil carries a gen8 override, so "what did Aurora Veil do in Generation III" would
     resolve to that text rather than to nothing, and the count of affected moves per generation
     would be inflated by moves that did not exist yet. */
  const moveGen = {};
  for (let g = 1; g <= 9; g++) {
    const j = JSON.parse(await get(GEN_API + g));
    j.moves.forEach(mv => { moveGen[mv.name] = g; });
  }

  const moves = {};
  let matched = 0, unmatched = [], withOverrides = 0;
  for (const [key, body] of Object.entries(all)) {
    const name = topField(body, 'name');
    if (!name) continue;
    const s = slug(name);
    if (!apiMoves.has(s)) { if (!/^hidden-power-./.test(s)) unmatched.push(name); continue; }
    matched++;
    const cur = topField(body, 'shortDesc') || topField(body, 'desc');
    const gens = genBlocks(body);
    if (!Object.keys(gens).length) continue;   // nothing generation-dependent to say
    withOverrides++;

    /* Keep Showdown's compact form — one entry per CUTOFF, not one per generation.
       The first version expanded this to all nine generations per move and produced a 437 KB blob
       for a 750 KB app. Most of that was duplication: Jump Kick behaved identically in Generations
       III and IV, so the same sentence was stored twice, and Bind stored the same paragraph three
       times. Collapsing runs of identical text upward to their highest generation puts it back to
       the shape Showdown already uses, which the app resolves with one comparison at render time.

       An override that merely restates the modern wording is dropped: that is a Showdown editorial
       detail, not something a reader needs to be told. */
    const ordered = Object.keys(gens).map(Number).sort((a, b) => a - b);
    const byGen = {};
    let prev = null;
    for (const n of ordered) {
      const text = gens[n];
      if (text === cur) { prev = text; continue; }
      // Same text as the cutoff below it: extend that run upward rather than storing it twice.
      if (prev !== null && text === prev) {
        const last = Object.keys(byGen).map(Number).sort((a, b) => b - a)[0];
        if (last !== undefined) { delete byGen[last]; }
      }
      byGen[n] = text;
      prev = text;
    }
    /* Nothing below the move's own debut. An override for a generation the move did not exist in
       is not a fact about that generation. */
    const born = moveGen[s] || 1;
    Object.keys(byGen).map(Number).forEach(n => { if (n < born) delete byGen[n]; });
    if (Object.keys(byGen).length) moves[s] = { cur, gen: born, gens: byGen };
  }

  const payload = {
    source: SOURCE,
    generated: 'by build/generate-move-text.js — do not edit by hand',
    convention: 'A genN block in Showdown describes generation N and every generation below it, ' +
      'until a lower override takes over; `gens` here is that already resolved, and lists only the ' +
      'generations whose wording differs from `cur`.',
    counts: { matchedToPokeApi: matched, withGenerationOverrides: withOverrides, shipped: Object.keys(moves).length },
    moves,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
  fs.writeFileSync(EMBED, JSON.stringify(moves));

  console.log('wrote ' + path.relative(ROOT, OUT));
  console.log('wrote ' + path.relative(ROOT, EMBED) + '  (' + Math.round(fs.statSync(EMBED).size / 1024) + ' KB)');
  console.log('  moves matched to PokeAPI       :', matched);
  console.log('  with generation overrides      :', withOverrides);
  console.log('  shipped (text actually differs):', Object.keys(moves).length);
  if (unmatched.length) console.log('  no PokeAPI slug                :', unmatched.length, unmatched.slice(0, 5).join(', '));

  /* Counted the way a reader experiences it: for each generation, how many moves that EXISTED then
     were being described with the modern wording. */
  const perGen = {};
  Object.values(moves).forEach(m => {
    for (let g = m.gen; g <= 9; g++) {
      const keys = Object.keys(m.gens).map(Number).filter(n => n >= g).sort((a, b) => a - b);
      if (keys.length) perGen[g] = (perGen[g] || 0) + 1;
    }
  });
  console.log('\n  moves whose wording differs from the modern line, by generation:');
  for (let g = 1; g <= 9; g++) console.log('    Gen ' + String(g).padStart(2) + ': ' + (perGen[g] || 0));

  console.log('\n  spot check — jump-kick:');
  const jk = moves['jump-kick'];
  console.log('    current : ' + (jk ? jk.cur : '(missing)'));
  if (jk) for (let g = 1; g <= 9; g++) if (jk.gens[g]) console.log('    gen ' + g + '   : ' + jk.gens[g]);
})();
