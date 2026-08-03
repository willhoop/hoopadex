/* HoopaDex — Showdown / Pokepaste parser tests
 * Run: node tests/test-paste-import.js
 *
 * Slices the REAL parseShowdownPaste() and parseStatLine() out of app/index.html rather than
 * copying them, so the tests cannot drift from shipped code.
 *
 * The Showdown export block is the interchange format for the whole ecosystem — it round-trips
 * with the Showdown teambuilder, Pokepaste, and the damage calculators. Every field except the
 * species line is optional, and real pastes are messy: nicknames, genders, trailing spaces,
 * missing EV lines, Tera types, four moves or one. These cases are taken from that reality.
 */
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8').split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('const PASTE_STATKEY='));
const endAt = lines.findIndex((l, i) => i > start && l.startsWith('// Showdown names formes'));
if (start < 0 || endAt < 0) throw new Error('could not locate the paste parser in index.html');
const app = eval(lines.slice(start, endAt).join('\n') + '\n;({parseShowdownPaste,parseStatLine})');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}
const eq = (got, want, label) => check(JSON.stringify(got) === JSON.stringify(want), label, got);

// --- a full, ordinary set --------------------------------------------------------------
const full = `Garchomp @ Life Orb
Ability: Rough Skin
Level: 50
Tera Type: Fire
EVs: 252 Atk / 4 SpD / 252 Spe
Jolly Nature
IVs: 0 SpA
- Earthquake
- Dragon Claw
- Fire Fang
- Swords Dance`;
const [g] = app.parseShowdownPaste(full);
eq(g.species, 'Garchomp', 'species parsed');
eq(g.item, 'Life Orb', 'item parsed');
eq(g.ability, 'Rough Skin', 'ability parsed');
eq(g.level, 50, 'level parsed');
eq(g.tera, 'Fire', 'tera type parsed');
eq(g.nature, 'Jolly', 'nature parsed');
eq(g.moves, ['Earthquake', 'Dragon Claw', 'Fire Fang', 'Swords Dance'], 'all four moves parsed');
eq(g.evs, { attack: 252, 'special-defense': 4, speed: 252 }, 'EVs mapped to PokeAPI stat names');
eq(g.ivs, { 'special-attack': 0 }, 'IVs mapped to PokeAPI stat names');

// --- nickname and gender on the species line --------------------------------------------
const [n] = app.parseShowdownPaste(`Chompy (Garchomp) (M) @ Choice Band\nAbility: Rough Skin\n- Outrage`);
eq(n.nickname, 'Chompy', 'nickname split from species');
eq(n.species, 'Garchomp', 'species read from the parenthesis');
eq(n.gender, 'M', 'gender parsed');
eq(n.item, 'Choice Band', 'item parsed alongside nickname and gender');

// A female nickname-less set, and a nicknamed set with no item.
const [f] = app.parseShowdownPaste(`Tyranitar (F) @ Leftovers\n- Crunch`);
eq(f.species, 'Tyranitar', 'gender without nickname leaves species clean');
eq(f.gender, 'F', 'female gender parsed');
const [ni] = app.parseShowdownPaste(`Sparky (Pikachu)\n- Thunderbolt`);
eq(ni.species, 'Pikachu', 'nickname with no item');
eq(ni.item, '', 'absent item is empty, not undefined');

// --- the minimum viable set --------------------------------------------------------------
const [bare] = app.parseShowdownPaste('Ditto');
eq(bare.species, 'Ditto', 'a bare species line is a valid set');
eq(bare.moves, [], 'no moves is an empty list');
eq(bare.evs, {}, 'no EV line is an empty object');

// --- multiple members, blank-line separated ----------------------------------------------
const team = app.parseShowdownPaste(`Garchomp @ Life Orb\n- Earthquake\n\nRotom-Wash @ Leftovers\nAbility: Levitate\n- Hydro Pump\n\nFerrothorn\n- Leech Seed`);
eq(team.length, 3, 'three members parsed from one paste');
eq(team.map(t => t.species), ['Garchomp', 'Rotom-Wash', 'Ferrothorn'], 'members in order');

// Real pastes carry trailing spaces (Showdown emits them) and blank lines at the ends.
const messy = app.parseShowdownPaste(`\n\nGarchomp @ Life Orb   \n  Ability: Rough Skin  \n- Earthquake  \n\n\n\nDitto\n\n`);
eq(messy.length, 2, 'trailing whitespace and extra blank lines survive');
eq(messy[0].ability, 'Rough Skin', 'trailing spaces trimmed from values');
eq(messy[0].moves, ['Earthquake'], 'trailing spaces trimmed from moves');

// Hyphenated formes must not be mistaken for anything else.
const [urshifu] = app.parseShowdownPaste(`Urshifu-Rapid-Strike @ Choice Scarf\nAbility: Unseen Fist\n- Surging Strikes`);
eq(urshifu.species, 'Urshifu-Rapid-Strike', 'hyphenated forme name kept intact');
eq(urshifu.ability, 'Unseen Fist', 'ability with two words');

// --- stat line parsing on its own ---------------------------------------------------------
eq(app.parseStatLine('252 HP / 252 Def / 4 Spe'),
   { hp: 252, defense: 252, speed: 4 }, 'stat line maps every stat');
eq(app.parseStatLine('0 Atk'), { attack: 0 }, 'a zero IV is kept, not dropped as falsy');
eq(app.parseStatLine('nonsense'), {}, 'an unparseable stat line yields nothing rather than throwing');

// --- the empty case ------------------------------------------------------------------------
eq(app.parseShowdownPaste(''), [], 'empty text yields no sets');
eq(app.parseShowdownPaste('\n\n  \n'), [], 'whitespace-only text yields no sets');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
