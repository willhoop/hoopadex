#!/usr/bin/env node
/* HoopaDex — a move's PP and power in every generation, every game, and Champions
 * Run: node build/generate-move-values.js          (fetch Showdown, rewrite the block in app/index.html)
 *      node build/generate-move-values.js --check  (fetch again, exit 1 if the block is stale)
 *      node build/generate-move-values.js --print  (list every correction, write nothing)
 *
 * Why this exists. The app reads a move's PP and power from PokeAPI: today's value, plus past_values
 * for older generations. Compared with Showdown's per-generation data on 2026-09-19 (4,784 move-and-
 * generation pairs), PokeAPI was wrong in three ways:
 *
 *   1. A change with no past value. Scarlet/Violet cut Recover, Soft-Boiled, Rest, Milk Drink, Slack
 *      Off, Roost and Shore Up to 5 PP. PokeAPI records no older value, so the app said 5 PP in every
 *      generation - Recover was 20 in Gens I-III and 10 in IV-VIII (Bulbapedia). Luster Purge (70
 *      until Scarlet/Violet), Glacial Lance (130 in Sword/Shield), Grassy Glide (70) and Wicked Blow
 *      (80, Bulbapedia) are the same fault in power.
 *   2. A wrong value. Mind Reader has always had 5 PP (Bulbapedia); PokeAPI says 40 for Gens II-IV.
 *      Take Heart has 15 PP (Bulbapedia, Showdown); PokeAPI's 10 is its Legends: Arceus value.
 *   3. One game's value applied to its whole generation. Let's Go Pikachu/Eevee changed Absorb, Mega
 *      Drain, Solar Beam and Sky Attack; PokeAPI files those as Generation VII values, so Sun/Moon and
 *      Ultra Sun/Ultra Moon showed Let's Go's numbers (Bulbapedia: Solar Beam 200 in Let's Go, 120 in
 *      Sun/Moon).
 *
 * What this writes:
 *   MOVE_GEN_FIX   {move: {gen: {pp, power}}} - Showdown's value wherever the app's PokeAPI-derived
 *                  value differs from it.
 *   MOVE_GAME_FIX  {versionGroup: {move: {pp, power}}} - the Let's Go values, kept for that game only.
 *                  A Gen VII difference is attributed to Let's Go only if it is in KNOWN_LETSGO below
 *                  AND agrees with Showdown's gen7letsgo mod wherever that mod states the field; the
 *                  script refuses to run otherwise, so a new Gen VII difference gets looked at.
 *   CHAMP_PP       Champions' PP rule, read from Showdown's champions/scripts.ts: a move's PP is capped
 *                  at 20, then becomes (PP / 5 + 1) x 4 - 5 -> 8, 10 -> 12, 15 -> 16, 20 -> 20 - except
 *                  moves marked noPPBoosts. The script refuses to run if that code has changed. This
 *                  reproduces every PP on Serebii's Champions "Updated Attacks" page.
 *
 * Not covered: Legends: Arceus. Showdown has no move data for it (its gen8legends mod has no
 * moves.ts), and its moves work differently anyway. Accuracy is not corrected here either: the
 * Gen I-III differences are mostly the two sources recording "cannot miss" differently, and need a
 * person to read them (BACKLOG).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const MOVES = path.join(ROOT, 'app', 'moves-index.json');
const SD = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/';
const BEGIN = '/*BEGIN-MOVE-VALUES-DERIVED*/', END = '/*END-MOVE-VALUES-DERIVED*/';
const LETSGO = 'lets-go-pikachu-lets-go-eevee';
const KNOWN_LETSGO = ['absorb', 'mega-drain', 'solar-beam', 'sky-attack'];
const CHAMP_PP_CODE = [
  'if (this.data.Moves[i].pp > 20) {',
  'this.modData(\'Moves\', i).pp = 20;',
  'return move.noPPBoosts ? move.pp : (move.pp / 5 + 1) * 4;',
];

async function get(url) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return await r.text(); }
    catch (e) { if (t >= 4) throw e; await new Promise(res => setTimeout(res, 600 * t)); }
  }
}
function entries(ts) {
  const out = {};
  const re = /^\t([a-z0-9]+): \{\n([\s\S]*?)^\t\},?$/gm;
  let m;
  while ((m = re.exec(ts))) {
    const own = {};
    m[2].split('\n').forEach(l => { const f = l.match(/^\t\t(\w+): (.*?),?$/); if (f) own[f[1]] = f[2]; });
    out[m[1]] = own;
  }
  return out;
}
const genOf = n => n >= 827 ? 9 : n >= 743 ? 8 : n >= 622 ? 7 : n >= 560 ? 6 : n >= 468 ? 5 : n >= 355 ? 4 : n >= 252 ? 3 : n >= 166 ? 2 : 1;

/* The app's own reading of a PokeAPI move, sliced from index.html, so the comparison is against what
   the app would show without this table. */
function appPieces(src) {
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('not found: ' + a); return src.slice(i, j); };
  const fn = n => cut('function ' + n + '(', '\n}\n') + '\n}\n';
  return (0, eval)(src.match(/const VG_GEN=\{[^;]*\};/)[0] + '\n' + cut('function movePastValues(', '\nfunction makeMoveRecord(') + '\n' +
    fn('makeMoveRecord') + fn('expandMoveRow') + fn('pastValueForGen') + fn('movePastField') +
    ';({makeMoveRecord,expandMoveRow,movePastField})');
}

async function build(src) {
  const base = entries(await get(SD + 'moves.ts'));
  const mods = {};
  for (let g = 1; g <= 8; g++) mods[g] = entries(await get(SD + 'mods/gen' + g + '/moves.ts'));
  const letsgo = entries(await get(SD + 'mods/gen7letsgo/moves.ts'));
  const chScripts = await get(SD + 'mods/champions/scripts.ts');
  CHAMP_PP_CODE.forEach(line => { if (!chScripts.includes(line)) throw new Error('Champions PP code changed; re-read mods/champions/scripts.ts. Missing: ' + line); });
  const noBoosts = Object.keys(base).filter(id => base[id].noPPBoosts === 'true').sort();

  const SDF = { pp: 'pp', power: 'basePower' };
  const sdVal = (id, g, f) => {
    if (g < 9) for (let k = g; k <= 8; k++) if (mods[k][id] && mods[k][id][SDF[f]] !== undefined) return +mods[k][id][SDF[f]];
    return +base[id][SDF[f]];
  };
  const A = appPieces(src);
  const rows = JSON.parse(fs.readFileSync(MOVES, 'utf8')).moves;
  const genFix = {}, gameFix = {}, appAt = {};
  let compared = 0;
  rows.forEach(r => {
    const slug = r[0], id = slug.replace(/-/g, ''), b = base[id];
    if (!b || !(+b.num > 0)) return;
    const rec = A.makeMoveRecord(A.expandMoveRow(r));
    for (let g = Math.max(genOf(+b.num), rec.introGen); g <= 9; g++) {
      for (const f of ['pp', 'power']) {
        const pv = A.movePastField(rec, f, g);
        const app = pv === undefined ? rec[f] : pv;
        const sd = sdVal(id, g, f);
        compared++;
        if (f === 'power' && (sd === 0 || !(app > 1))) continue;   // variable or no power: 0, 1 and null are notation
        if (app === sd) continue;
        (genFix[slug] = genFix[slug] || {})[g] = Object.assign((genFix[slug] || {})[g] || {}, { [f]: sd });
        appAt[slug + '|' + g + '|' + f] = app;
      }
    }
  });
  /* A Gen VII difference is a Let's Go value only when Gen VII is the ONLY generation that differs for
     that field. Recover also differs in Gen VII, but so does every generation from IV to VIII - that is
     the Scarlet/Violet cut leaking backwards, not Let's Go. */
  Object.keys(genFix).forEach(slug => ['pp', 'power'].forEach(f => {
    const d = g => genFix[slug][g] && genFix[slug][g][f] !== undefined;
    if (!d(7) || d(6) || d(8)) return;
    if (!KNOWN_LETSGO.includes(slug)) throw new Error(slug + ' differs in Gen VII only (' + f + '); decide whether it is a Let\'s Go value and add it to KNOWN_LETSGO');
    const app = appAt[slug + '|7|' + f], id = slug.replace(/-/g, '');
    const lg = letsgo[id] && letsgo[id][SDF[f]];
    if (lg !== undefined && +lg !== app) throw new Error(slug + ' ' + f + ': PokeAPI ' + app + ' but Showdown gen7letsgo ' + lg);
    ((gameFix[LETSGO] = gameFix[LETSGO] || {})[slug] = gameFix[LETSGO][slug] || {})[f] = app;
  }));
  KNOWN_LETSGO.forEach(m => { if (!gameFix[LETSGO] || !gameFix[LETSGO][m]) throw new Error(m + ' is in KNOWN_LETSGO but no longer differs; remove it'); });
  return { genFix, gameFix, noBoosts, compared };
}

function block(b) {
  const sortObj = o => Object.keys(o).sort().reduce((a, k) => (a[k] = o[k], a), {});
  return BEGIN + '\n/* Generated by build/generate-move-values.js from Showdown. Do not edit by hand. See that file for\n' +
    '   what each table corrects and why. */\n' +
    'const MOVE_GEN_FIX=' + JSON.stringify(sortObj(b.genFix)) + ';\n' +
    'const MOVE_GAME_FIX=' + JSON.stringify(b.gameFix) + ';\n' +
    'const CHAMP_PP={cap:20,noBoosts:' + JSON.stringify(b.noBoosts) + '};\n' + END;
}

(async () => {
  const src = fs.readFileSync(APP, 'utf8');
  const b = await build(src);
  if (process.argv.includes('--print')) {
    Object.entries(b.genFix).forEach(([m, g]) => console.log(m.padEnd(18), JSON.stringify(g)));
    console.log('Let\'s Go:', JSON.stringify(b.gameFix), '\nnoPPBoosts:', b.noBoosts.join(', '), '\ncompared', b.compared);
    return;
  }
  const a = src.indexOf(BEGIN), e = src.indexOf(END);
  if (a < 0 || e < 0) throw new Error('markers not found in app/index.html');
  const cur = src.slice(a, e + END.length).replace(/\r\n/g, '\n'), next = block(b);
  if (process.argv.includes('--check')) {
    console.log(cur === next ? 'check: move values match Showdown (' + Object.keys(b.genFix).length + ' moves corrected)' : 'STALE: move values differ from Showdown; rerun without --check');
    process.exit(cur === next ? 0 : 1);
  }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(APP, src.slice(0, a) + next.replace(/\n/g, eol) + src.slice(e + END.length));
  console.log('wrote move values: ' + Object.keys(b.genFix).length + ' moves corrected across ' + b.compared + ' comparisons');
})().catch(e => { console.error(e); process.exit(1); });
