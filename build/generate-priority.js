#!/usr/bin/env node
/* HoopaDex — the Move Priority table, per generation, from Showdown
 * Run: node build/generate-priority.js          (fetch Showdown, rewrite the block in app/index.html)
 *      node build/generate-priority.js --check  (fetch again, exit 1 if the block is stale)
 *
 * Why this exists. The priority table was typed by hand, with one value per move for every
 * generation. Checked against PokeAPI and Showdown on 2026-09-19, 11 of its 56 moves were wrong in the
 * current generation: King's Shield, Spiky Shield, Baneful Bunker and Max Guard sat at +3 (they are
 * +4); Counter and Mirror Coat at -6 (they are -5, a bracket the table did not have); Magic Room and
 * Wonder Room at -7 (0 since Generation VI); Mat Block at +4 (it is 0 - "first turn only" is a
 * different rule); Zippy Zap was misspelt "Zip Zap" and sat at +1 (it is +2); Grassy Glide was shown
 * as +1 unconditionally (only in Grassy Terrain). And a move whose priority CHANGED between
 * generations - Protect was +3 until Generation V, ExtremeSpeed +1 - showed its modern value in every
 * generation.
 *
 * Source: Showdown's data/moves.ts (the current generation) and data/mods/gen1..gen8/moves.ts, each
 * of which inherits the generation above it and overrides only what differed. A move's priority in
 * generation N is the first override found walking from genN up to the base file. The Champions mod
 * is read too; it overrides no priority today, and this script would carry it if it did.
 *
 * What is derived and what is written here: the values, the moves, their types and categories are
 * all derived. A priority that depends on the battle (Grassy Glide) is detected from its
 * onModifyPriority handler; its one-line explanation is written below in CONDITIONAL, and the script
 * refuses to run if Showdown gains a conditional-priority move that has no explanation yet.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const SD = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/';
const BEGIN = '/*BEGIN-PRIORITY-DERIVED*/', END = '/*END-PRIORITY-DERIVED*/';

const CONDITIONAL = {
  grassyglide: '+1 in Grassy Terrain',
};

/* Where Showdown's per-generation files are missing an override, checked by hand against a named
   source. Each entry says what Showdown gives, what is right, and where that is written down. The
   script fails if Showdown later adds the override itself (the correction would then be redundant)
   or if the move stops existing - so a stale correction cannot linger. */
const CORRECTIONS = {
  endure: { gens: { 3: 3, 4: 3 }, showdown: 4,
    source: 'Bulbapedia, Endure (move): "Endure now has a priority of +3" in Generations III and IV, ' +
            '+4 from Generation V. Showdown overrides Protect and Detect to +3 in its gen4 mod but not ' +
            'Endure, so gens 3-4 fall through to the modern +4. Checked 2026-09-19.' },
};

async function get(url) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return await r.text(); }
    catch (e) { if (t >= 4) throw e; await new Promise(res => setTimeout(res, 600 * t)); }
  }
}

/* Top-level entries of a Showdown moves file: "\tid: {" to "\t},". Only lines indented exactly two
   tabs are the entry's own fields; anything deeper belongs to a nested handler or condition. */
function entries(ts) {
  const out = {};
  const re = /^\t([a-z0-9]+): \{\n([\s\S]*?)^\t\},?$/gm;
  let m;
  while ((m = re.exec(ts))) {
    const body = m[2], own = {};
    body.split('\n').forEach(l => {
      const f = l.match(/^\t\t(\w+): (.*?),?$/);
      if (f) own[f[1]] = f[2];
    });
    own._onModifyPriority = /^\t\tonModifyPriority\(/m.test(body);
    out[m[1]] = own;
  }
  return out;
}
const str = v => v && v.replace(/^"|"$/g, '');
/* Showdown's own rule for the generation a move belongs to, from its number. */
function genOf(num) {
  return num >= 827 ? 9 : num >= 743 ? 8 : num >= 622 ? 7 : num >= 560 ? 6 : num >= 468 ? 5 : num >= 355 ? 4 : num >= 252 ? 3 : num >= 166 ? 2 : 1;
}
const slugOf = name => name.toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function build() {
  const base = entries(await get(SD + 'moves.ts'));
  const mods = {};
  for (let g = 1; g <= 8; g++) mods[g] = entries(await get(SD + 'mods/gen' + g + '/moves.ts'));
  const champ = entries(await get(SD + 'mods/champions/moves.ts'));

  const prioIn = (id, g) => {
    for (let k = g; k <= 8; k++) if (mods[k][id] && mods[k][id].priority !== undefined) return +mods[k][id].priority;
    return +(base[id].priority || 0);
  };
  const rows = [];
  for (const id of Object.keys(base)) {
    const b = base[id];
    const num = +b.num;
    if (!(num > 0)) continue;                                // CAP and other invented moves
    const ns = str(b.isNonstandard);
    if (ns === 'CAP' || ns === 'Custom') continue;
    if (b.isZ || b.isMax === 'true' || /^"/.test(b.isMax || '')) {
      if (!(b.isMax === 'true' && b.priority && +b.priority !== 0)) continue;   // Max Guard is the one with a priority
    }
    const intro = genOf(num);
    const byGen = [];
    for (let g = 1; g <= 9; g++) byGen.push(g < intro ? null : (g === 9 ? +(b.priority || 0) : prioIn(id, g)));
    if (b.isMax === 'true') for (let g = 1; g <= 9; g++) if (g !== 8) byGen[g - 1] = null;   // Dynamax existed in Gen VIII only
    const champVal = champ[id] && champ[id].priority !== undefined ? +champ[id].priority : byGen[8];
    const cond = b._onModifyPriority ? CONDITIONAL[id] : null;
    if (b._onModifyPriority && !cond) throw new Error(id + ' has a conditional priority with no explanation in CONDITIONAL');
    if (byGen.every(v => v === null || v === 0) && champVal === 0 && !cond) continue;
    rows.push({ id, slug: slugOf(str(b.name)), name: str(b.name), type: str(b.type).toLowerCase(),
      cat: str(b.category).toLowerCase(), byGen, champ: champVal, cond });
  }
  for (const [id, c] of Object.entries(CORRECTIONS)) {
    const r = rows.find(x => x.id === id);
    if (!r) throw new Error('correction for ' + id + ' names a move this table no longer has');
    for (const [g, v] of Object.entries(c.gens)) {
      if (r.byGen[g - 1] !== c.showdown) throw new Error(id + ' Gen ' + g + ': Showdown now gives ' + r.byGen[g - 1] + ', not ' + c.showdown + '; re-check the correction');
      r.byGen[g - 1] = v;
    }
  }
  rows.sort((a, b) => a.slug.localeCompare(b.slug));
  return rows;
}

function block(rows) {
  /* [slug, type, category, [priority in Gen I..IX, null = not in that generation], champions, note, name] */
  const data = rows.map(r => [r.slug, r.type, r.cat, r.byGen, r.champ, r.cond || '', r.name]);
  return BEGIN + '\n/* Generated by build/generate-priority.js from Showdown\'s per-generation move data. Do not edit by\n' +
    '   hand. Each row: [move, type, category, [priority in Gen I..IX, null where the move did not exist],\n' +
    '   priority in Champions, note for a priority that depends on the battle, display name]. */\n' +
    'const PRIORITY_MOVES=' + JSON.stringify(data) + ';\n' + END;
}

(async () => {
  const rows = await build();
  if (process.argv.includes('--print')) {   // read-only: one line per move, for checking by eye
    rows.forEach(r => console.log(r.slug.padEnd(22), r.byGen.map(v => v === null ? '.' : (v > 0 ? '+' + v : String(v))).map(s => s.padStart(3)).join(''), ' ch', r.champ, r.cond || ''));
    return;
  }
  const app = fs.readFileSync(APP, 'utf8');
  const a = app.indexOf(BEGIN), b = app.indexOf(END);
  if (a < 0 || b < 0) throw new Error('markers not found in app/index.html');
  const cur = app.slice(a, b + END.length).replace(/\r\n/g, '\n');
  const next = block(rows);
  if (process.argv.includes('--check')) {
    console.log(cur === next ? 'check: priority table matches Showdown (' + rows.length + ' moves)' : 'STALE: priority table differs from Showdown; rerun without --check');
    process.exit(cur === next ? 0 : 1);
  }
  const eol = app.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(APP, app.slice(0, a) + next.replace(/\n/g, eol) + app.slice(b + END.length));
  console.log('wrote the priority table: ' + rows.length + ' moves');
})().catch(e => { console.error(e); process.exit(1); });
