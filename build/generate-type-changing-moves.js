#!/usr/bin/env node
/* HoopaDex — moves whose TYPE depends on something
 * Run: node build/generate-type-changing-moves.js          (fetch Showdown, rewrite the block)
 *      node build/generate-type-changing-moves.js --check  (fetch again, exit 1 if the block is stale)
 *
 * Why this exists. Asked from the live site, about Genesect's Drive forms: "do we have all the gensect
 * forms? do they matter". The forms themselves do not - PokeAPI has no separate entry for them, and a
 * Drive changes nothing about Genesect - but they change what Techno Blast IS. The app showed Techno
 * Blast as a plain Normal move, and the same for eight others, while VARIABLE_MOVE_INFO already
 * explained ~70 moves whose POWER varies.
 *
 * Showdown marks a move whose type is decided at use time with an onModifyType handler. There are 13.
 * Four were already covered by hand in VARIABLE_MOVE_INFO (Weather Ball, Hidden Power, Natural Gift,
 * Terrain Pulse); this writes the other nine, and fails if Showdown ever adds a fourteenth that
 * nothing here describes - so the list cannot quietly fall behind.
 *
 * What is derived: which moves change type, and every mapping that is data rather than code.
 *   Techno Blast   items with onDrive   (4)
 *   Judgment       items with onPlate, excluding the Z-crystals the move itself excludes  (17)
 *   Multi-Attack   items with onMemory  (17)
 *   Ivy Cudgel, Raging Bull, Aura Wheel   the `case 'Species-Name': move.type = 'X'` lines
 * What is written here: one line for the three whose type comes from the battle rather than a table
 * (Revelation Dance, Tera Blast, Tera Star Storm), in NOTES below.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const SD = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/data/';
const BEGIN = '/*BEGIN-TYPECHANGE-DERIVED*/', END = '/*END-TYPECHANGE-DERIVED*/';

/* Already explained by hand in VARIABLE_MOVE_INFO, with their own tables. */
const ALREADY = ['weatherball', 'hiddenpower', 'naturalgift', 'terrainpulse'];
/* The ones whose type is not a lookup table. One line each, checked against Showdown's code below. */
const NOTES = {
  revelationdance: { label: 'Type follows the user', note: 'Becomes the user’s own type - its first type, or its second if the first is typeless.' },
  terablast: { label: 'Type follows Terastallization', note: 'Normal until the user Terastallizes, then its Tera type. It also becomes physical if the user’s Attack is higher than its Sp. Atk.' },
  terastarstorm: { label: 'Type follows the form', note: 'Normal, or Stellar for Terapagos-Stellar - which also makes it hit both opponents, and physical if its Attack is higher than its Sp. Atk.' },
};
const LABEL = {
  technoblast: 'Type follows the Drive the user holds',
  judgment: 'Type follows the Plate the user holds',
  multiattack: 'Type follows the Memory the user holds',
  ivycudgel: 'Type follows Ogerpon’s mask',
  ragingbull: 'Type follows the Tauros form',
  aurawheel: 'Type follows Morpeko’s form',
};

async function get(url) {
  for (let t = 1; ; t++) {
    try { const r = await fetch(url); if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url); return await r.text(); }
    catch (e) { if (t >= 4) throw e; await new Promise(res => setTimeout(res, 600 * t)); }
  }
}
function entries(ts) {
  const out = {}; const re = /^\t([a-z0-9]+): \{\n([\s\S]*?)^\t\},?$/gm; let m;
  while ((m = re.exec(ts))) out[m[1]] = m[2];
  return out;
}
const title = s => s.replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
/* An item id back to its printed name, from Showdown's own `name:` field. */
const nameOf = (items, id) => (items[id].match(/^\t\tname: "([^"]+)"/m) || [, id])[1];

async function build() {
  const moves = entries(await get(SD + 'moves.ts'));
  const items = entries(await get(SD + 'items.ts'));
  const changing = Object.keys(moves).filter(id => /^\t\tonModifyType\(/m.test(moves[id])).sort();
  const slug = id => (moves[id].match(/^\t\tname: "([^"]+)"/m) || [, id])[1].toLowerCase().replace(/['’.]/g, '').replace(/[^a-z0-9]+/g, '-');

  const itemsWith = (field, exclude) => Object.keys(items)
    .filter(id => new RegExp('^\\t\\t' + field + ": '([A-Za-z]+)'", 'm').test(items[id]) && !(exclude && exclude(id, items[id])))
    .map(id => [nameOf(items, id), items[id].match(new RegExp('^\\t\\t' + field + ": '([A-Za-z]+)'", 'm'))[1].toLowerCase()])
    .sort((a, b) => a[1].localeCompare(b[1]));
  /* Judgment ignores Z-crystals, which also carry onPlate; its own code says `&& !item.zMove`. */
  const zCrystal = (id, body) => /^\t\tzMove/m.test(body);
  const formPairs = id => {
    const body = moves[id];
    const out = [];
    const re = /case '([^']+)':(?:\s*case '[^']+':)*\s*\n?\s*move\.type = '([A-Za-z]+)';/g;
    let m;
    while ((m = re.exec(body))) out.push([m[1], m[2].toLowerCase()]);
    /* Aura Wheel is an if/else over one form rather than a switch. */
    const iff = /species\.name === '([^']+)'\) \{\s*move\.type = '([A-Za-z]+)';/.exec(body);
    if (iff) out.push([iff[1], iff[2].toLowerCase()]);
    return out;
  };
  /* The form that keeps the move's own type, which Showdown's switch never mentions. */
  const BASE_FORM = { ivycudgel: 'Ogerpon', ragingbull: 'Tauros', aurawheel: 'Morpeko' };

  const rows = {};
  for (const id of changing) {
    if (ALREADY.includes(id)) continue;
    if (NOTES[id]) { rows[slug(id)] = { label: NOTES[id].label, note: NOTES[id].note }; continue; }
    if (!LABEL[id]) throw new Error(id + ' changes type and nothing here describes it; add it to LABEL (with a derived mapping) or NOTES');
    let pairs;
    if (id === 'technoblast') pairs = itemsWith('onDrive');
    else if (id === 'judgment') pairs = itemsWith('onPlate', zCrystal);
    else if (id === 'multiattack') pairs = itemsWith('onMemory');
    else {
      pairs = formPairs(id);
      const base = (moves[id].match(/^\t\ttype: "([A-Za-z]+)"/m) || [, 'Normal'])[1].toLowerCase();
      if (!BASE_FORM[id]) throw new Error('no base form recorded for ' + id);
      if (pairs.some(p => p[0] === BASE_FORM[id])) throw new Error(BASE_FORM[id] + ' is named in Showdown\'s own mapping; the base row would hide it');
      pairs = [[BASE_FORM[id], base]].concat(pairs);
      /* Ogerpon's -Tera formes share their base forme's type, so the switch names each twice. */
      pairs = pairs.filter(p => !/-Tera$/.test(p[0])).filter((p, i, a) => a.findIndex(q => q[0] === p[0]) === i);
    }
    if (!pairs.length) throw new Error(id + ': no mapping could be read from Showdown');
    rows[slug(id)] = { label: LABEL[id], pairs };
  }
  const missing = changing.filter(id => !ALREADY.includes(id) && !rows[slug(id)]);
  if (missing.length) throw new Error('not described: ' + missing.join(', '));
  /* Every key has to be a move the app can look up, or the panel silently never appears. */
  const known = new Set(JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'moves-index.json'), 'utf8')).moves.map(r => r[0]));
  const unknown = Object.keys(rows).filter(k => !known.has(k));
  if (unknown.length) throw new Error('not PokeAPI move names: ' + unknown.join(', '));
  return { rows, changing };
}

function block(b) {
  return BEGIN + '\n/* Generated by build/generate-type-changing-moves.js from Showdown. Do not edit by hand.\n' +
    '   Moves whose type is decided when they are used. Four more (Weather Ball, Hidden Power, Natural\n' +
    '   Gift, Terrain Pulse) have their own entries in VARIABLE_MOVE_INFO. */\n' +
    'const TYPE_CHANGING_MOVES=' + JSON.stringify(b.rows) + ';\n' + END;
}

(async () => {
  const b = await build();
  if (process.argv.includes('--print')) { console.log(JSON.stringify(b.rows, null, 1)); return; }
  const src = fs.readFileSync(APP, 'utf8');
  const a = src.indexOf(BEGIN), e = src.indexOf(END);
  if (a < 0 || e < 0) throw new Error('markers not found in app/index.html');
  const cur = src.slice(a, e + END.length).replace(/\r\n/g, '\n'), next = block(b);
  if (process.argv.includes('--check')) {
    console.log(cur === next ? 'check: type-changing moves match Showdown (' + Object.keys(b.rows).length + ' moves)' : 'STALE: type-changing moves differ from Showdown; rerun without --check');
    process.exit(cur === next ? 0 : 1);
  }
  const eol = src.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(APP, src.slice(0, a) + next.replace(/\n/g, eol) + src.slice(e + END.length));
  console.log('wrote ' + Object.keys(b.rows).length + ' type-changing moves (' + b.changing.length + ' in Showdown, 4 already in VARIABLE_MOVE_INFO)');
})().catch(e => { console.error(e); process.exit(1); });
