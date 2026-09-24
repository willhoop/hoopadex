/* HoopaDex — moves whose type is decided when they are used
 * Run: node tests/test-type-changing-moves.js
 *
 * Asked from the live site, about Genesect: "do we have all the gensect forms? do they matter".
 * PokeAPI has no separate entry for Douse, Shock, Burn or Chill Genesect - they are appearance
 * variants of one Pokemon - and a Drive changes nothing about Genesect itself. What it changes is
 * Techno Blast, which the app showed as a plain Normal move with nothing connecting it to the four
 * Drives sitting in its own Items tab.
 *
 * VARIABLE_MOVE_INFO already explained ~70 moves whose POWER varies, four of them type-changing too
 * (Weather Ball, Hidden Power, Natural Gift, Terrain Pulse). The other nine are generated from
 * Showdown by build/generate-type-changing-moves.js. This suite checks the mappings themselves, and
 * that the panel shows them.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}

const T = JSON.parse((src.match(/const TYPE_CHANGING_MOVES=(\{.*\});/) || [])[1] || '{}');
const typeOf = (move, cond) => { const r = (T[move] && T[move].pairs || []).find(p => p[0] === cond); return r && r[1]; };
const TYPES = new Set(['normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy']);

check(Object.keys(T).length === 9, 'nine type-changing moves are generated', Object.keys(T).join(', '));
check(Object.values(T).every(v => v.label && (v.pairs || v.note)), 'each says what its type follows, and how');
const badType = [];
Object.entries(T).forEach(([m, v]) => (v.pairs || []).forEach(p => { if (!TYPES.has(p[1])) badType.push(m + ':' + p[1]); }));
check(badType.length === 0, 'every mapping produces a real type', badType.join(', '));

// --- the answer to the question that prompted this ------------------------------------------------
check(typeOf('techno-blast', 'Douse Drive') === 'water' && typeOf('techno-blast', 'Shock Drive') === 'electric' &&
      typeOf('techno-blast', 'Burn Drive') === 'fire' && typeOf('techno-blast', 'Chill Drive') === 'ice',
  'Techno Blast: Douse Water, Shock Electric, Burn Fire, Chill Ice - the four Genesect Drives');
check((T['techno-blast'].pairs || []).length === 4, 'and only those four', (T['techno-blast'].pairs || []).length);

// --- the two that matter in Champions --------------------------------------------------------------
check(typeOf('ivy-cudgel', 'Ogerpon') === 'grass' && typeOf('ivy-cudgel', 'Ogerpon-Wellspring') === 'water' &&
      typeOf('ivy-cudgel', 'Ogerpon-Hearthflame') === 'fire' && typeOf('ivy-cudgel', 'Ogerpon-Cornerstone') === 'rock',
  'Ivy Cudgel follows Ogerpon\'s mask, with the plain form Grass');
check(!(T['ivy-cudgel'].pairs || []).some(p => /-Tera$/.test(p[0])),
  'and the -Tera formes are not listed twice - they match their base forme');
check(/Tera type/.test(T['tera-blast'].note) && /physical/.test(T['tera-blast'].note),
  'Tera Blast follows the Tera type, and can turn physical');

// --- the rest ---------------------------------------------------------------------------------------
check(typeOf('raging-bull', 'Tauros') === 'normal' && typeOf('raging-bull', 'Tauros-Paldea-Combat') === 'fighting' &&
      typeOf('raging-bull', 'Tauros-Paldea-Blaze') === 'fire' && typeOf('raging-bull', 'Tauros-Paldea-Aqua') === 'water',
  'Raging Bull: plain Tauros Normal, Combat Fighting, Blaze Fire, Aqua Water');
check(typeOf('aura-wheel', 'Morpeko') === 'electric' && typeOf('aura-wheel', 'Morpeko-Hangry') === 'dark',
  'Aura Wheel: Electric, or Dark when Morpeko is Hangry');
check((T['judgment'].pairs || []).length === 17 && typeOf('judgment', 'Flame Plate') === 'fire' && typeOf('judgment', 'Splash Plate') === 'water',
  'Judgment: one Plate per type, all 17', (T['judgment'].pairs || []).length);
check(!(T['judgment'].pairs || []).some(p => /ium Z|iumz/i.test(p[0])),
  'and no Z-crystals, which carry the same field but which the move ignores');
check((T['multi-attack'].pairs || []).length === 17 && typeOf('multi-attack', 'Bug Memory') === 'bug', 'Multi-Attack: 17 Memories');
check(/own type/.test(T['revelation-dance'].note), 'Revelation Dance follows the user\'s own type');
check(/Stellar/.test(T['tera-starstorm'].note), 'Tera Starstorm becomes Stellar for Terapagos-Stellar');

// --- and the app shows them ---------------------------------------------------------------------
check(/const info=VARIABLE_MOVE_INFO\[moveName\]\|\|\(typeof TYPE_CHANGING_MOVES!=='undefined'\?TYPE_CHANGING_MOVES\[moveName\]:null\)/.test(src),
  'the move-detail panel reads the generated table when the hand-written one has nothing');
check(/if\(info\.pairs\)\{[\s\S]{0,400}typeBadge\(p\[1\],true\)/.test(src),
  'and draws each condition with the type it produces, as a type pill');
/* Both surfaces that show move detail already route through renderVariableMoveInfo, so this reaches
   the move page and the Pokemon page's move list together. */
check((src.match(/renderVariableMoveInfo\(/g) || []).length >= 3, 'which both move surfaces already call');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
