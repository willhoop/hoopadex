/* HoopaDex — generation-aware table audit tests
 * Run: node tests/test-generation-tables.js
 *
 * Backlog item 16 named four tables behind the generation-accuracy claim that had never been
 * checked: the C2 and CM type charts, ITEM_INTRO_GEN, EVO_OVERRIDES and REGIONAL. Three earlier
 * tables had each been found wrong the moment someone looked — PAST_STATS was 10 of 43 correct.
 *
 * Audited 2026-08-03:
 *   - CM, C2 and C1 type charts: 838 cells, all three match Showdown exactly. Nothing to fix.
 *   - ITEM_INTRO_GEN: 67 of 325 entries wrong, 20.6%, confirmed against two independent sources
 *     (Showdown's data/items.ts and PokéAPI's game_indices). Now generated.
 *   - EVO_OVERRIDES and REGIONAL: display labels, not generation data. No wrongness risk.
 *
 * This suite pins the results that a future edit could quietly undo. It does not re-download
 * anything; the charts are checked against the invariants the audit established, and the item table
 * against the cached derivation in data/item-intro-gens.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

const grab = name => {
  const m = src.match(new RegExp('^const ' + name + '=(\\{.*?\\});$', 'm'));
  if (!m) throw new Error('could not locate ' + name);
  return eval('(' + m[1] + ')');
};
const CM = grab('CM'), C2 = grab('C2'), C1 = grab('C1');
const ITEMS = grab('ITEM_INTRO_GEN');

// ---- type charts ------------------------------------------------------------------------
// Spot-checks chosen to be the cells that DEFINE each era, so a wholesale replacement of a chart
// cannot pass by accident.
const eff = (c, a, d) => (c[a] || {})[d] === undefined ? 1 : (c[a] || {})[d];

check(eff(CM, 'dragon', 'fairy') === 0, 'CM: Dragon cannot touch Fairy', eff(CM, 'dragon', 'fairy'));
check(eff(CM, 'fighting', 'fairy') === 0.5, 'CM: Fighting is resisted by Fairy');
check(eff(CM, 'steel', 'ghost') === 1, 'CM: Steel no longer resists Ghost (changed in Gen VI)');
check(eff(CM, 'steel', 'dark') === 1, 'CM: Steel no longer resists Dark (changed in Gen VI)');
check(eff(CM, 'ghost', 'steel') === 1, 'CM: Ghost is neutral into Steel (changed in Gen VI)');

// Written attacker-first, like the table itself. The pre-Gen VI fact is that a STEEL DEFENDER
// resisted Ghost and Dark attacks — so it is ghost->steel and dark->steel, not the reverse. Getting
// this backwards is the easiest mistake to make about this chart, which is why it is spelled out.
check(eff(C2, 'ghost', 'steel') === 0.5, 'C2: Ghost was resisted by a Steel defender before Gen VI');
check(eff(C2, 'dark', 'steel') === 0.5, 'C2: Dark was resisted by a Steel defender before Gen VI');
check(eff(CM, 'dark', 'steel') === 1, 'CM: Steel stopped resisting Dark in Gen VI');
check(C2.fairy === undefined, 'C2: Fairy does not exist as an attacking type');
Object.keys(C2).forEach(a => check(C2[a].fairy === undefined,
  'C2: nothing has a Fairy matchup — ' + a, C2[a]));

check(eff(C1, 'psychic', 'ghost') === 1, 'C1: Psychic is neutral into Ghost — the Gen I quirk');
check(eff(C1, 'ghost', 'psychic') === 0, 'C1: Ghost cannot touch Psychic in Gen I');
check(eff(C1, 'bug', 'poison') === 2, 'C1: Bug is super effective on Poison in Gen I');
check(eff(C1, 'poison', 'bug') === 2, 'C1: Poison is super effective on Bug in Gen I');
// Same trap: the Gen I quirk is that a FIRE DEFENDER did not resist Ice attacks.
check(eff(C1, 'ice', 'fire') === 1, 'C1: a Fire defender does not resist Ice in Gen I');
check(eff(C2, 'ice', 'fire') === 0.5, 'C2: from Gen II onward a Fire defender does resist Ice');
check(C1.dark === undefined && C1.steel === undefined, 'C1: neither Dark nor Steel exists');

// ---- ITEM_INTRO_GEN ---------------------------------------------------------------------
const CACHE = path.join(ROOT, 'data', 'item-intro-gens.json');
check(fs.existsSync(CACHE), 'the derived item generations are committed alongside the app');
if (fs.existsSync(CACHE)) {
  const derived = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  check(derived.unresolved.length === 0,
    'every item in the table could be dated from PokéAPI', derived.unresolved);
  const mismatched = Object.keys(ITEMS).filter(k => derived.gens[k] && derived.gens[k] !== ITEMS[k]);
  check(mismatched.length === 0,
    'ITEM_INTRO_GEN still matches the derivation — regenerate rather than editing by hand',
    mismatched.map(k => k + ': table=' + ITEMS[k] + ' derived=' + derived.gens[k]));
  check(Object.keys(derived.gens).length === Object.keys(ITEMS).length,
    'the derivation covers every entry in the table',
    { derived: Object.keys(derived.gens).length, table: Object.keys(ITEMS).length });
}

/* The two systematic errors the audit found, asserted individually. These are the ones that would
   come back if anyone re-typed the table from memory, because both are intuitive mistakes: held
   items feel like a Gen III thing, and ORAS feels newer than it is. */
const GEN2_HELD = ['leftovers', 'kings-rock', 'quick-claw', 'focus-band', 'scope-lens', 'thick-club',
  'light-ball', 'metal-powder', 'lucky-punch', 'stick', 'charcoal', 'magnet', 'miracle-seed',
  'mystic-water', 'sharp-beak', 'poison-barb', 'soft-sand', 'spell-tag', 'twisted-spoon',
  'never-melt-ice', 'black-belt', 'black-glasses', 'dragon-fang', 'hard-stone', 'silver-powder',
  'bright-powder', 'metal-coat', 'smoke-ball', 'silk-scarf'];
GEN2_HELD.forEach(i => check(ITEMS[i] === 2,
  'held item "' + i + '" is Generation II, not III — Gold/Silver introduced held items', ITEMS[i]));

const ORAS_STONES = ['altarianite', 'audinite', 'beedrillite', 'cameruptite', 'diancite',
  'galladite', 'glalitite', 'latiasite', 'latiosite', 'lopunnite', 'metagrossite', 'pidgeotite',
  'sablenite', 'salamencite', 'sceptilite', 'sharpedonite', 'slowbronite', 'steelixite',
  'swampertite'];
ORAS_STONES.forEach(i => check(ITEMS[i] === 6,
  'mega stone "' + i + '" is Generation VI — ORAS is Gen VI, not VII', ITEMS[i]));

const GEN1_ITEMS = ['x-attack', 'x-defense', 'x-speed', 'x-accuracy', 'x-sp-atk', 'dire-hit', 'guard-spec'];
GEN1_ITEMS.forEach(i => check(ITEMS[i] === 1,
  'battle item "' + i + '" is Generation I', ITEMS[i]));

// Sanity: nothing predates Generation I or postdates Generation IX.
const outOfRange = Object.entries(ITEMS).filter(([, g]) => !(g >= 1 && g <= 9));
check(outOfRange.length === 0, 'every item generation is between I and IX', outOfRange);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
