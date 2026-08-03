/* HoopaDex — historical base stat tests
 * Run: node tests/test-past-stats.js
 *
 * Like the routing suite, these slice the REAL PAST_STATS table and the REAL
 * getStatsForGen() out of app/index.html rather than copying them, so the tests
 * cannot drift away from the shipped code.
 *
 * They pin the behaviour fixed on 2026-08-02. Three defects were live:
 *
 *   1. Krookodile was absent from the table, so Gen V served the current
 *      Defense of 80 instead of the 70 it had in Black/White.
 *   2. Ten species had their Generation VII revision filed under a Generation VI
 *      cutoff, so the Gen VI view showed Sun/Moon values (Dugtrio is the
 *      representative case), and several of those entries carried a second,
 *      simply invented stat alongside (Dugtrio's Speed has always been 120).
 *   3. The table declared ids 25 and 26 twice. A duplicate key in a JavaScript
 *      object literal silently replaces the earlier entry, so the Gen VI values
 *      for Pikachu and Raichu never existed at runtime.
 *
 * Expected values are cross-checked against Serebii's per-generation dex and
 * Bulbapedia; the table itself is generated from Pokemon Showdown's mod data.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const file = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(file, 'utf8');
const lines = src.split(/\r?\n/);

const start = lines.findIndex(l => l.startsWith('const PAST_STATS='));
const retAt = lines.findIndex((l, i) => i > start && l.trim() === 'return stats;');
const end = lines.findIndex((l, i) => i > retAt && l.trim() === '}');
if (start < 0 || end < 0) throw new Error('could not locate PAST_STATS / getStatsForGen in index.html');
const block = lines.slice(start, end + 1).join('\n');

let selectedGenNum = 9;
function getDataGenNum() { return selectedGenNum; }
// Direct eval, so the sliced code can see getDataGenNum() above. Its function declaration
// leaks into this scope, so the bindings are read back off an object rather than destructured.
const app = eval(block + '\n;({PAST_STATS,getStatsForGen})');
const PAST_STATS = app.PAST_STATS;

const ORDER = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
// Present-day base stats, as PokeAPI serves them.
const NOW = {
  25:  { name: 'Pikachu',    s: [35, 55, 40, 50, 50, 90] },
  26:  { name: 'Raichu',     s: [60, 90, 55, 90, 80, 110] },
  49:  { name: 'Venomoth',   s: [70, 65, 60, 90, 75, 90] },
  51:  { name: 'Dugtrio',    s: [35, 100, 50, 50, 70, 120] },
  85:  { name: 'Dodrio',     s: [60, 110, 70, 60, 60, 110] },
  553: { name: 'Krookodile', s: [95, 117, 80, 65, 70, 92] },
  681: { name: 'Aegislash',  s: [60, 50, 140, 50, 140, 60] },
  488: { name: 'Cresselia',  s: [120, 70, 110, 75, 120, 85] },
};

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + detail); }
}

function statAt(id, gen, stat) {
  selectedGenNum = gen;
  const out = app.getStatsForGen({ id, stats: ORDER.map((n, i) => ({ stat: { name: n }, base_stat: NOW[id].s[i] })) });
  return out.find(x => x.stat.name === stat).base_stat;
}
function bstAt(id, gen) {
  selectedGenNum = gen;
  return app.getStatsForGen({ id, stats: ORDER.map((n, i) => ({ stat: { name: n }, base_stat: NOW[id].s[i] })) })
    .reduce((a, x) => a + x.base_stat, 0);
}
function t(id, gen, stat, want) {
  const got = statAt(id, gen, stat);
  check(got === want, `${NOW[id].name} gen ${gen} ${stat} = ${want}`, `got ${got}`);
}

// --- 1. the reported bug: Krookodile debuted at 70 Defense, raised to 80 in Gen VI ---
t(553, 5, 'defense', 70);
t(553, 6, 'defense', 80);
t(553, 9, 'defense', 80);
check(bstAt(553, 5) === 509, 'Krookodile gen 5 BST = 509', `got ${bstAt(553, 5)}`);
check(bstAt(553, 6) === 519, 'Krookodile gen 6 BST = 519', `got ${bstAt(553, 6)}`);

// --- 2. Gen VII revisions must not leak into the Gen VI view -------------------------
t(51, 5, 'attack', 80);
t(51, 6, 'attack', 80);   // was showing 100: the Sun/Moon value, one generation early
t(51, 7, 'attack', 100);
t(51, 5, 'speed', 120);   // the old table asserted 100, which was never a real value
t(85, 6, 'speed', 100);
t(85, 7, 'speed', 110);
t(49, 5, 'special-attack', 90); // the old table asserted 65, also never a real value

// --- 3. the duplicate-key regression ------------------------------------------------
t(25, 5, 'defense', 30);
t(25, 5, 'special-defense', 40);
t(25, 6, 'defense', 40);
t(25, 6, 'special-defense', 50);
t(26, 5, 'speed', 100);
t(26, 6, 'speed', 110);

// A duplicate key is invisible once the literal is parsed, so assert on the source text.
const literal = block.slice(0, block.indexOf('};') + 1);
const seen = new Map();
for (const m of literal.matchAll(/(?:^|[,{\s])(\d+):\s*\{/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
check(dupes.length === 0, 'no duplicate ids in the PAST_STATS literal', `duplicated: ${dupes.join(', ')}`);

// --- 4. later generations ------------------------------------------------------------
t(681, 7, 'defense', 150);
t(681, 8, 'defense', 140);
t(488, 8, 'special-defense', 130);
t(488, 9, 'special-defense', 120);

// --- 5. structural invariants --------------------------------------------------------
// Base stats were stable from Gen II through Gen V, so no cutoff below 6 is meaningful.
const cutoffs = [...new Set(Object.values(PAST_STATS).flatMap(v => Object.keys(v).map(Number)))];
check(cutoffs.every(c => c >= 6 && c <= 9), 'every cutoff is in 6..9', `saw ${cutoffs.sort().join(', ')}`);
check(Object.values(PAST_STATS).every(v => Object.values(v).every(d =>
  Object.keys(d).every(k => ORDER.includes(k)))), 'every stat name is a PokeAPI stat name', '');

// Revisions must layer newest-first so the era closest to the selected generation wins.
// No shipping species has two revisions yet, so prove the mechanism on a synthetic one.
PAST_STATS[999999] = { 7: { attack: 80 }, 6: { attack: 50, defense: 20 } };
NOW[999999] = { name: 'synthetic', s: [10, 100, 10, 10, 10, 10] };
check(statAt(999999, 6, 'attack') === 80, 'twice-revised species: gen 6 takes the Gen 7 cutoff', `got ${statAt(999999, 6, 'attack')}`);
check(statAt(999999, 5, 'attack') === 50, 'twice-revised species: gen 5 takes the Gen 6 cutoff', `got ${statAt(999999, 5, 'attack')}`);
check(statAt(999999, 5, 'defense') === 20, 'twice-revised species: gen 5 keeps a stat only the older cutoff sets', `got ${statAt(999999, 5, 'defense')}`);
check(statAt(999999, 7, 'attack') === 100, 'twice-revised species: gen 7 is unmodified', `got ${statAt(999999, 7, 'attack')}`);
delete PAST_STATS[999999];

// --- 6. the whole table against its derivation ---------------------------------------
// Everything above pins 8 species out of 58. An architecture review on 2026-08-03 changed
// Zacian's Generation IX Attack from 130 to 170 — an unpinned species — and all 23 suites stayed
// green. Sampling 8 entries cannot defend a 58-entry table, and this is the table that was
// measured at 10 of 43 correct before 1.96.
//
// data/past-stats.json is derived from Showdown's genN/pokedex.ts mods by
// build/generate-past-stats.js. Those mods record only what differs from the current game, so a
// baseStats line in the gen5 mod IS the Generation V value. On the run that introduced this check
// the derivation reproduced all 58 species with zero disagreements. Regenerate, never hand-edit.
const DERIVED = path.join(ROOT, 'data', 'past-stats.json');
if (!fs.existsSync(DERIVED)) {
  check(false, 'data/past-stats.json exists — run node build/generate-past-stats.js', DERIVED);
} else {
  const d = JSON.parse(fs.readFileSync(DERIVED, 'utf8'));
  const D = d.stats;
  const appIds = Object.keys(PAST_STATS).map(Number).sort((a, b) => a - b);
  const derIds = Object.keys(D).map(Number).sort((a, b) => a - b);

  check(appIds.length === derIds.length,
    'the app ships exactly as many species as the derivation found',
    `app ${appIds.length}, derived ${derIds.length}`);

  const extra = appIds.filter(i => !D[i]);
  const missing = derIds.filter(i => !PAST_STATS[i]);
  check(extra.length === 0, 'no species in the app is absent from the derivation', extra.join(' '));
  check(missing.length === 0, 'no derived species was dropped on the way into the app', missing.join(' '));

  // Value-by-value. A count check would survive a swapped number, which is the whole failure mode.
  const drift = [];
  for (const id of appIds) {
    if (!D[id]) continue;
    const a = PAST_STATS[id], b = D[id];
    for (const gen of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const av = a[gen] || {}, bv = b[gen] || {};
      for (const st of new Set([...Object.keys(av), ...Object.keys(bv)]))
        if (av[st] !== bv[st]) drift.push(`${id} gen<${gen} ${st}: app=${av[st]} derived=${bv[st]}`);
    }
  }
  check(drift.length === 0,
    'every historical stat matches Showdown — regenerate, do not edit',
    drift.slice(0, 8).join(' | '));

  check(/generate-past-stats\.js/.test(d.generated || ''),
    'the derivation says which generator produced it', d.generated);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
