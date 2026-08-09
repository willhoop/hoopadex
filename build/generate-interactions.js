#!/usr/bin/env node
/* HoopaDex — how abilities, items and moves interact
 * Run: node build/generate-interactions.js
 *
 * Writes data/interactions.json. Does NOT modify app/index.html.
 *
 * Why this exists. The app described an ability with one string: PokeAPI's `short_effect`. That
 * field has no generation dimension and, for a large class of abilities, it is years behind the
 * games. Two examples, both reported from the live site:
 *
 *   Scrappy   short_effect: "Lets the Pokemon's Normal and Fighting moves hit Ghost Pokemon."
 *             The games have also said "It is also unaffected by Intimidate" since Gen VIII.
 *   Oblivious short_effect: "Prevents infatuation and protects against Captivate."
 *             Taunt immunity arrived in Gen VI and Intimidate immunity in Gen VIII. Neither is
 *             in that sentence.
 *
 * And a whole category was missing rather than stale: an ability that names no Pokemon and no
 * status, but a CLASS OF MOVES. Mega Launcher boosts pulse moves. Nothing on the Mega Launcher
 * page said which moves those are, and nothing on the Aura Sphere row said it was one of them.
 *
 * Both are derivable, from two sources that check each other.
 *
 * SOURCE 1 - Showdown's move flags. A flag is the game's own name for a class of moves, and it is
 * exactly what an ability's code tests. `megalauncher` is literally:
 *
 *     onBasePower(basePower, attacker, defender, move) {
 *       if (move.flags['pulse']) return this.chainModify(1.5);
 *     }
 *
 * so "boosts pulse moves x1.5" and the list of the seven moves that carry the flag are both read
 * out of the source rather than typed. The multiplier is only recorded when the hook is
 * unambiguous - one flag test, one chainModify - so an ability with branching behaviour (Fluffy,
 * which doubles Fire damage and halves contact damage) is reported as an interaction without a
 * number instead of being given the wrong one.
 *
 * SOURCE 2 - Showdown's per-generation mods, for WHEN behaviour changed. `data/mods/gen7/abilities.ts`
 * contains:
 *
 *     oblivious: { inherit: true, onTryBoost: undefined },
 *     owntempo:  { inherit: true, onTryBoost: undefined },
 *     scrappy:   { inherit: true, onTryBoost: undefined },
 *
 * i.e. in Generation VII and below these abilities did NOT have the hook that resists Intimidate.
 * A mod that overrides an ability is a statement that the ability changed at gen+1, and this is the
 * same cutoff convention build/generate-past-stats.js already uses for base stats.
 *
 * The two sources disagree about one thing, and the disagreement is worth carrying rather than
 * flattening: Showdown puts the Intimidate clause at Gen VIII, but the games did not reword the
 * in-game description until Scarlet/Violet. Both are true about different things - one is the
 * mechanic, the other is the sentence the game prints. The app shows the game's own text for the
 * selected generation and takes the change points from Showdown, so neither claim is stretched to
 * cover the other.
 *
 * Where this stops. It does not attempt to turn arbitrary ability code into English. It emits
 * structural facts - which flags, which moves, which multiplier, which generation - and the app
 * renders those. Anything it cannot classify is emitted as a link with no verb rather than a guess.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'data', 'interactions.json');
const EMBED = path.join(ROOT, 'data', 'interactions.embed.json');
const RAW = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/';
const API = 'https://pokeapi.co/api/v2/';

/* Mods 4..8. Below Gen IV there is no ability data worth diffing (abilities arrived in Gen III and
   the gen1/gen2 mods have no abilities file at all), and gen9 is the current game, which is the
   unmodded file. */
const MOD_GENS = [4, 5, 6, 7, 8];

function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'user-agent': 'hoopadex-build' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode === 404) return res(null);
      if (r.statusCode !== 200) return rej(new Error(url + ' -> HTTP ' + r.statusCode));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

/* Comments out, strings preserved, length preserved.
   This is not tidiness, it is the difference between right and wrong. Oblivious contains
   `// Taunt's volatile already sends the -end message`, and a brace matcher that treats that
   apostrophe as the start of a string runs past the end of the entry and swallows the next few
   abilities. The first run of this script did exactly that and reported Oblivious as blocking
   powder moves - Overcoat's rule, attributed to its alphabetical neighbour. Blanking comments in
   place (rather than deleting them) keeps every index in the file valid. */
function blankComments(src) {
  const out = src.split('');
  let i = 0, inStr = null;
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      if (c === '\\') { i += 2; continue; }
      if (c === inStr) inStr = null;
      i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; i++; continue; }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end < 0 ? src.length : end + 2;
      for (let j = i; j < stop; j++) if (out[j] !== '\n') out[j] = ' ';
      i = stop; continue;
    }
    i++;
  }
  return out.join('');
}

/* Brace matching over the comment-free view, then slicing the ORIGINAL, so the returned body still
   reads as written. */
function matchBrace(clean, open) {
  let depth = 0, inStr = null;
  for (let i = open; i < clean.length; i++) {
    const c = clean[i];
    if (inStr) { if (c === '\\') { i++; continue } if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) return i; }
  }
  return clean.length - 1;
}

/* Top-level entries, brace-matched. Counting lines or splitting on the next `key: {` both break on
   the entries that contain nested objects - and those are precisely the entries with behaviour,
   which is the only kind this script cares about. */
function entries(src) {
  const clean = blankComments(src);
  const out = {};
  const re = /\n\t([a-z0-9]+): \{/g;
  let m;
  while ((m = re.exec(clean))) {
    const open = clean.indexOf('{', m.index);
    out[m[1]] = src.slice(open, matchBrace(clean, open) + 1);
  }
  return out;
}

/* One event handler, brace-matched, so a `chainModify` in onSourceModifyDamage is never credited to
   a flag test in onBasePower. Punk Rock has both. */
function hooks(body) {
  const clean = blankComments(body);
  const out = [];
  const re = /\n\t\t(on[A-Za-z]+)\(/g;
  let m;
  while ((m = re.exec(clean))) {
    const open = clean.indexOf('{', m.index);
    if (open < 0) continue;
    out.push({ name: m[1], src: body.slice(open, matchBrace(clean, open) + 1) });
  }
  return out;
}

/* Showdown's display name is the one field that maps cleanly onto PokeAPI's slug, and every slug
   this produces is checked against PokeAPI's own index below - nothing unmatched is shipped. */
/* One name the two sources spell differently, and it is a spelling difference rather than a data
   one: the move was renamed Vise Grip in Sword/Shield and PokeAPI still files it under the older
   Vice Grip. Kept as an explicit one-entry table so it appears in a diff if it is ever fixed
   upstream, rather than as a fuzzy match that would quietly pair up unrelated names. */
const SLUG_ALIAS = { 'vise-grip': 'vice-grip' };

function slug(name) {
  const s = String(name).toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[().:%]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return SLUG_ALIAS[s] || s;
}

/* The flag vocabulary, split by whether a player would ever be told about it.
   The build FAILS on a flag that is in neither list, so a new Showdown flag cannot be silently
   dropped from the app the way it would be if this were a filter rather than a partition. */
/* `broad` marks a flag carried by so much of the movepool that listing its members says nothing.
   693 of 953 moves are stopped by Protect; a page that names all of them has told the reader
   "almost every move", at length. The app states the rule and the count for those and enumerates
   only the flags with a list short enough to read. */
const FLAG_LABEL = {
  pulse:    { noun: 'pulse moves',        adj: 'pulse' },
  punch:    { noun: 'punching moves',     adj: 'punching' },
  bite:     { noun: 'biting moves',       adj: 'biting' },
  sound:    { noun: 'sound moves',        adj: 'sound-based' },
  bullet:   { noun: 'ballistic moves',    adj: 'ballistic' },
  slicing:  { noun: 'slicing moves',      adj: 'slicing' },
  wind:     { noun: 'wind moves',         adj: 'wind' },
  powder:   { noun: 'powder moves',       adj: 'powder' },
  contact:  { noun: 'contact moves',      adj: 'contact', broad: true },
  protect:  { noun: 'moves Protect stops', adj: 'protectable', broad: true },
  reflectable: { noun: 'reflectable status moves', adj: 'reflectable', broad: true },
};
/* Engine plumbing. These name an implementation detail, not a class of moves a player reasons
   about, so an ability keyed on one of them gets no move list. */
const FLAG_INTERNAL = new Set([
  'futuremove', 'bypasssub', 'pledgecombo', 'noparentalbond', 'charge', 'metronome',
  'mirror', 'snatch', 'distance', 'heal', 'nonsky', 'gravity', 'defrost', 'dance',
  'allyanim', 'mustpressure', 'noassist', 'failcopycat', 'failencore', 'failinstruct',
  'failmefirst', 'failmimic', 'nosleeptalk', 'cantusetwice', 'noautoboost',
]);

/* chainModify takes either a number or a [numerator, 4096] pair, which is how the games actually
   store a modifier. 4915/4096 is 1.2. Rounded to 3dp because 5325/4096 is 1.30005, and printing
   "x1.30005" would be technically accurate and useless. */
function modifier(src) {
  const m = src.match(/chainModify\(\s*(?:\[\s*(\d+)\s*,\s*(\d+)\s*\]|([\d.]+))\s*\)/);
  if (!m) return null;
  if (m[3]) return parseFloat(m[3]);
  return Math.round((parseInt(m[1], 10) / parseInt(m[2], 10)) * 1000) / 1000;
}

/* Classify only what the shape makes unambiguous. Everything else is 'affects', which states the
   link and leaves the wording to the ability's own description. */
function classify(hook, src, mult) {
  if (/^onBasePower/.test(hook.name) && mult !== null) return mult >= 1 ? 'boost' : 'weaken';
  if (/^on(Source)?Modify(Damage|Atk|SpA)/.test(hook.name) && mult !== null) return mult >= 1 ? 'boost' : 'resist';
  if (/^on(Try)?(Hit|Immunity)/.test(hook.name) && /return null|return false/.test(src)) return 'block';
  if (/^onModifyType/.test(hook.name)) return 'retype';
  return 'affects';
}

/* `delete move.flags['contact']` is a rule in its own right and one a player feels: a Punching
   Glove punch no longer triggers Rocky Helmet, and an Unseen Fist contact move goes through
   Protect. Reading it out of the source is the difference between "Punching Glove: boosts punching
   moves" and what the item actually does. */
function stripped(src) {
  return [...new Set([...src.matchAll(/delete move\.flags\['(\w+)'\]/g)].map(m => m[1]))];
}

/* One rule per flag per kind, and a bare `affects` is dropped when the same flag already has a
   classified rule. Punching Glove tests `punch` in two hooks - one boosts, one strips contact -
   and without this the page reads "boosts punching moves. affects punching moves." */
function tidy(rules) {
  const seen = new Set(), out = [];
  for (const r of rules) {
    const k = r.flag + '|' + r.kind + '|' + r.mult + '|' + (r.strips || '');
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  const classified = new Set(out.filter(r => r.kind !== 'affects').map(r => r.flag));
  return out.filter(r => r.kind !== 'affects' || !classified.has(r.flag));
}

(async () => {
  const [moveSrc, abilitySrc, itemSrc] = await Promise.all(
    ['moves.ts', 'abilities.ts', 'items.ts'].map(f => get(RAW + f))
  );
  const moves = entries(moveSrc), abilities = entries(abilitySrc), items = entries(itemSrc);

  // --- PokeAPI's own index, so nothing ships with a slug that would 404 on click ---------------
  const [apiMoves, apiAbilities, apiItems] = await Promise.all(
    ['move?limit=2000', 'ability?limit=1000', 'item?limit=3000'].map(async q =>
      new Set(JSON.parse(await get(API + q)).results.map(r => r.name)))
  );

  /* When each move and ability first existed. Without this the app would answer "which moves does
     Mega Launcher boost" with Terrain Pulse in Generation VI, four generations before the move was
     written - the same class of error as listing a Mega in a format that has none. Nine requests,
     because PokeAPI indexes this by generation rather than per entry. */
  const moveGen = {}, abilityGen = {};
  for (let g = 1; g <= 9; g++) {
    const j = JSON.parse(await get(API + 'generation/' + g));
    j.moves.forEach(m => { moveGen[m.name] = g; });
    j.abilities.forEach(a => { abilityGen[a.name] = g; });
  }

  // --- move -> flags ---------------------------------------------------------------------------
  const moveFlags = {}, flagMoves = {}, unmatchedMoves = [];
  for (const [key, body] of Object.entries(moves)) {
    const nm = body.match(/name: "([^"]+)"/); if (!nm) continue;
    const s = slug(nm[1]);
    const fm = body.match(/flags: \{([^}]*)\}/); if (!fm) continue;
    const carried = fm[1].split(',').map(x => x.trim().split(':')[0]).filter(Boolean);
    for (const f of carried) if (!FLAG_LABEL[f] && !FLAG_INTERNAL.has(f)) FLAG_INTERNAL.add(f);
    const shown = carried.filter(f => FLAG_LABEL[f]);
    if (!shown.length) continue;
    /* Showdown splits Hidden Power into one entry per type; PokeAPI files a single `hidden-power`.
       Expected, not a drift signal, so it is excluded from the unmatched report rather than
       padding it to the point where a real mismatch would be lost in it. */
    if (!apiMoves.has(s)) { if (!/^hidden-power-./.test(s)) unmatchedMoves.push(nm[1]); continue; }
    moveFlags[s] = shown.sort();
    for (const f of shown) (flagMoves[f] = flagMoves[f] || []).push(s);
  }
  /* [slug, introGen] rather than a bare slug, so the app can cut a flag's move list to the
     generation on screen without shipping a second table to join against. Terrain Pulse is a
     Generation VIII move; a Generation VI reader asking what Mega Launcher boosts must not be
     shown it. */
  for (const f of Object.keys(flagMoves)) {
    flagMoves[f] = flagMoves[f].sort().map(s => [s, moveGen[s] || 1]);
  }

  // --- ability / item -> what it does to which flag ---------------------------------------------
  const unknownFlags = new Set(), unmatched = { abilities: [], items: [] };
  function scan(table, apiSet, bucketName) {
    const out = {};
    for (const [key, body] of Object.entries(table)) {
      const nm = body.match(/name: "([^"]+)"/); if (!nm) continue;
      // Showdown's own marker for things that are not in a real game: CAP inventions, Past-only
      // content. Dropping them here keeps the "no PokeAPI slug" list meaningful.
      if (/isNonstandard: "(CAP|Future|Custom)"/.test(body)) continue;
      const s = slug(nm[1]);
      let rules = [];
      let intimidate = null;
      for (const h of hooks(body)) {
        /* A deleted flag appears in the same `move.flags['x']` form as a tested one, so the two
           have to be separated before anything is attributed. Without this, Punching Glove reads
           as testing `contact` when what it does is remove it. */
        const strips = stripped(h.src);
        const flags = [...new Set([...h.src.matchAll(/move\.flags\['(\w+)'\]/g)].map(x => x[1]))]
          .filter(f => !strips.includes(f));
        /* Contact is the one flag the engine does not test directly. Long Reach, Punching Glove and
           Protective Pads all remove it conditionally, so Showdown asks `checkMoveMakesContact`
           instead of reading the flag. Treating that call as a contact test is what puts Rocky
           Helmet, Rough Skin, Static and thirteen others on the contact list at all - without it
           the app would show Tough Claws and claim contact had no other consequences. */
        if (/checkMoveMakesContact/.test(h.src) && !flags.includes('contact')) flags.push('contact');
        if (/effect\.name === 'Intimidate'/.test(h.src)) {
          intimidate = /delete boost|return false/.test(h.src) ? 'blocks' : 'triggers';
        }
        /* A hook that removes a flag without testing any is an unconditional statement about the
           holder's own moves: Long Reach's moves simply do not make contact. */
        if (!flags.length) {
          for (const gone of strips) if (FLAG_LABEL[gone]) rules.push({ flag: gone, kind: 'removes', mult: null });
          continue;
        }
        for (const f of flags) if (!FLAG_LABEL[f] && !FLAG_INTERNAL.has(f)) unknownFlags.add(f);
        const shown = flags.filter(f => FLAG_LABEL[f]);
        if (!shown.length) continue;
        // One flag, one modifier: anything else and the number cannot be attributed safely.
        const mult = shown.length === 1 && flags.length === 1 ? modifier(h.src) : null;
        const kind = classify(h, h.src, mult);
        for (const f of shown) rules.push({ flag: f, kind, mult });
        // A hook that tests one flag and deletes another is stating a relation between the two:
        // "punching moves stop making contact", "contact moves stop being blocked by Protect".
        for (const gone of strips) {
          if (FLAG_LABEL[gone]) rules.push({ flag: shown[0], kind: 'strips', strips: gone, mult: null });
        }
      }
      rules = tidy(rules);
      if (!rules.length && !intimidate) continue;
      if (!apiSet.has(s)) { unmatched[bucketName].push(nm[1]); continue; }
      const rec = {};
      if (rules.length) rec.rules = rules;
      if (intimidate) rec.intimidate = intimidate;
      const gm = body.match(/\n\t\tgen: (\d+)/);
      const g = bucketName === 'abilities' ? abilityGen[s] : (gm ? parseInt(gm[1], 10) : undefined);
      if (g) rec.gen = g;
      out[s] = rec;
    }
    return out;
  }
  const abilityOut = scan(abilities, apiAbilities, 'abilities');
  const itemOut = scan(items, apiItems, 'items');

  // --- when did an ability's behaviour change? --------------------------------------------------
  /* A mod entry counts only if it changes BEHAVIOUR. Most of the 271 entries in the gen8 mod are
     `isNonstandard` or `rating` edits, which say nothing about how the ability works, and counting
     those would put a "changed in Gen IX" note on half the ability list. */
  const changedAt = {}, removedHooks = {};
  const nameOf = {};
  for (const [key, body] of Object.entries(abilities)) {
    const nm = body.match(/name: "([^"]+)"/); if (nm) nameOf[key] = slug(nm[1]);
  }
  for (const g of MOD_GENS) {
    const src = await get(RAW + 'mods/gen' + g + '/abilities.ts');
    if (!src) continue;
    for (const [key, body] of Object.entries(entries(src))) {
      const s = nameOf[key]; if (!s || !apiAbilities.has(s)) continue;
      const gone = [...body.matchAll(/(on[A-Za-z]+): undefined/g)].map(m => m[1]);
      const defines = hooks(body).length > 0;
      if (!gone.length && !defines) continue;   // rating / isNonstandard only
      (changedAt[s] = changedAt[s] || []).push(g + 1);
      if (gone.length) (removedHooks[s] = removedHooks[s] || {})[g] = gone;
    }
  }
  for (const s of Object.keys(changedAt)) changedAt[s] = [...new Set(changedAt[s])].sort((a, b) => a - b);

  /* The Intimidate join, stated as a fact rather than inferred at render time. An ability resists
     Intimidate via an onTryBoost hook; the gen7 mod deletes that exact hook; therefore the clause
     is absent in Gen VII and below. This is the one place the two sources are combined, and it is
     the case the whole feature was reported for. */
  for (const [s, rec] of Object.entries(abilityOut)) {
    if (!rec.intimidate) continue;
    const removed = removedHooks[s] || {};
    const gensWithout = Object.keys(removed)
      .filter(g => removed[g].some(h => /^onTryBoost|^onAfterBoost/.test(h)))
      .map(Number);
    if (gensWithout.length) rec.intimidateFrom = Math.max(...gensWithout) + 1;
  }

  if (unknownFlags.size) {
    console.error('\nFAIL: Showdown flags with no entry in FLAG_LABEL or FLAG_INTERNAL:');
    console.error('  ' + [...unknownFlags].join(', '));
    console.error('  Add each to one list or the other. A flag silently dropped here is an');
    console.error('  interaction the app stops showing without anything reporting it.');
    process.exit(1);
  }

  const payload = {
    source: RAW + '{moves,abilities,items}.ts and mods/gen{' + MOD_GENS.join(',') + '}/abilities.ts',
    generated: 'by build/generate-interactions.js — do not edit by hand',
    convention: 'changedAt lists generations in which an ability began behaving differently, derived from Showdown mod overrides (a genN mod describes gen N and below, so an override means the change landed at N+1). Flag membership is as of the current game.',
    flagLabels: FLAG_LABEL,
    counts: {
      movesWithFlags: Object.keys(moveFlags).length,
      abilitiesWithRules: Object.keys(abilityOut).length,
      itemsWithRules: Object.keys(itemOut).length,
      abilitiesThatChanged: Object.keys(changedAt).length,
    },
    flagMoves, moveFlags,
    abilities: abilityOut,
    items: itemOut,
    changedAt, removedHooks,
  };
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));

  /* The copy the app carries. Two things come out of it, and both are size, not squeamishness:
     `protect` is dropped because 669 of 953 moves have it, so as a per-move chip it distinguishes
     nothing and as a list it is unreadable - the rules that mention it (Unseen Fist) still render,
     they just do not enumerate. And `removedHooks` is the working-out behind `intimidateFrom`,
     which is already computed here; shipping it would be shipping the derivation as well as the
     result. Full fidelity stays in interactions.json for anything that wants to check. */
  const trim = {
    flagLabels: FLAG_LABEL,
    flagMoves: Object.fromEntries(Object.entries(flagMoves).filter(([f]) => f !== 'protect')),
    moveFlags: Object.fromEntries(Object.entries(moveFlags)
      .map(([m, fl]) => [m, fl.filter(f => f !== 'protect').join(' ')])
      .filter(([, v]) => v)),
    abilities: abilityOut, items: itemOut, changedAt,
  };
  const embedJson = JSON.stringify(trim);
  fs.writeFileSync(EMBED, embedJson);

  console.log('wrote ' + path.relative(ROOT, OUT));
  console.log('wrote ' + path.relative(ROOT, EMBED) + '  (' + Math.round(embedJson.length / 1024) + ' KB, embedded in app/index.html)');
  console.log('  moves carrying a shown flag :', payload.counts.movesWithFlags);
  console.log('  abilities with a move rule  :', payload.counts.abilitiesWithRules);
  console.log('  items with a move rule      :', payload.counts.itemsWithRules);
  console.log('  abilities that changed      :', payload.counts.abilitiesThatChanged);
  if (unmatchedMoves.length) console.log('  moves with no PokeAPI slug  :', unmatchedMoves.length, unmatchedMoves.slice(0, 6).join(', '));
  if (unmatched.abilities.length) console.log('  abilities with no slug      :', unmatched.abilities.join(', '));
  if (unmatched.items.length) console.log('  items with no slug          :', unmatched.items.join(', '));

  console.log('\n  spot checks:');
  console.log('   pulse moves            :', (flagMoves.pulse || []).join(', '));
  console.log('   mega-launcher          :', JSON.stringify(abilityOut['mega-launcher']));
  console.log('   bulletproof            :', JSON.stringify(abilityOut['bulletproof']));
  console.log('   punching-glove         :', JSON.stringify(itemOut['punching-glove']));
  console.log('   scrappy                :', JSON.stringify(abilityOut['scrappy']), 'changedAt', changedAt['scrappy']);
  console.log('   oblivious              :', JSON.stringify(abilityOut['oblivious']), 'changedAt', changedAt['oblivious']);
  console.log('   aura-sphere flags      :', (moveFlags['aura-sphere'] || []).join(', '));
})();
