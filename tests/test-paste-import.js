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

// --- export, and the round trip ---------------------------------------------------------
// The exporter is the importer's inverse. A team that survives import → export unchanged can be
// handed to Showdown's teambuilder, Pokepaste or their calculator without loss, which is the whole
// point of speaking their format rather than inventing one.
const expStart = lines.findIndex(l => l.startsWith('const showdownName='));
const expEnd = lines.findIndex((l, i) => i > expStart && l.startsWith('async function copyTeamPaste'));
if (expStart < 0 || expEnd < 0) throw new Error('could not locate the exporter in index.html');
const exp = eval(lines.slice(expStart, expEnd).join('\n') + '\n;({toShowdownPaste,showdownName,statLineOut})');

eq(exp.showdownName('garchomp'), 'Garchomp', 'a plain species name title-cases');
eq(exp.showdownName('urshifu-rapid-strike'), 'Urshifu-Rapid-Strike', 'every forme segment title-cases');
eq(exp.showdownName('ho-oh'), 'Ho-Oh', 'a hyphenated real name title-cases');

// EVs omit zeroes; IVs omit 31s. Emitting "0 HP" or "31 Atk" is legal but noisy, and Showdown
// itself omits them, so a round trip against a Showdown-authored paste would otherwise differ.
eq(exp.statLineOut({ attack: 252, hp: 0, speed: 252 }, 0), '252 Atk / 252 Spe', 'zero EVs are omitted');
eq(exp.statLineOut({ 'special-attack': 0, attack: 31 }, 31), '0 SpA', '31 IVs are omitted, 0 is kept');
eq(exp.statLineOut(null, 0), '', 'a missing stat block yields nothing');
eq(exp.statLineOut({}, 0), '', 'an empty stat block yields nothing');

const exportTeam = [{ name: 'garchomp', smogonSet: { item: 'Life Orb', ability: 'Rough Skin', level: 50,
  tera: 'Fire', evs: { attack: 252, 'special-defense': 4, speed: 252 }, ivs: { 'special-attack': 0 },
  nature: 'Jolly', moves: ['Earthquake', 'Dragon Claw', 'Fire Fang', 'Swords Dance'] } }];
const out = exp.toShowdownPaste(exportTeam);
check(out.split('\n')[0] === 'Garchomp @ Life Orb', 'the species line carries the item', out.split('\n')[0]);
check(/^Ability: Rough Skin$/m.test(out), 'ability line emitted', '');
check(/^Tera Type: Fire$/m.test(out), 'tera line emitted', '');
check(/^Jolly Nature$/m.test(out), 'nature line emitted', '');
check(/^EVs: 252 Atk \/ 4 SpD \/ 252 Spe$/m.test(out), 'EV line in canonical stat order', out);
check(/^IVs: 0 SpA$/m.test(out), 'IV line emitted', '');
check((out.match(/^- /gm) || []).length === 4, 'all four moves emitted', '');

// Level 100 is the default and Showdown omits it; emitting it would break round-tripping.
const lvl100 = exp.toShowdownPaste([{ name: 'ditto', smogonSet: { level: 100, moves: [] } }]);
check(!/Level:/.test(lvl100), 'level 100 is omitted as the default', lvl100);

// The actual round trip: parse what we emit and get the same thing back.
const reparsed = app.parseShowdownPaste(out)[0];
eq(reparsed.species, 'Garchomp', 'round trip preserves species');
eq(reparsed.item, 'Life Orb', 'round trip preserves item');
eq(reparsed.tera, 'Fire', 'round trip preserves tera type');
eq(reparsed.nature, 'Jolly', 'round trip preserves nature');
eq(reparsed.evs, { attack: 252, 'special-defense': 4, speed: 252 }, 'round trip preserves EVs');
eq(reparsed.ivs, { 'special-attack': 0 }, 'round trip preserves IVs');
eq(reparsed.moves, ['Earthquake', 'Dragon Claw', 'Fire Fang', 'Swords Dance'], 'round trip preserves moves');

// Multi-member teams keep their blank-line separator.
const two = exp.toShowdownPaste([{ name: 'ditto', smogonSet: { moves: ['Transform'] } },
                                 { name: 'garchomp', smogonSet: { moves: ['Earthquake'] } }]);
eq(app.parseShowdownPaste(two).length, 2, 'a two-member export re-parses as two members');
eq(exp.toShowdownPaste([]), '', 'an empty team exports as nothing');
eq(exp.toShowdownPaste([null, null]), '', 'a team of empty slots exports as nothing');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
