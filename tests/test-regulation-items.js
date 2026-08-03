/* HoopaDex — regulation item change tests
 * Run: node tests/test-regulation-items.js
 *
 * The Regulation Changes page used to say item legality was "not tracked", which was true of the
 * app and not of the world. Showdown carries the two Champions regulations as SEPARATE MODS —
 * data/mods/champions (M-B) and data/mods/championsregma (M-A, inheriting from it) — so the M-A
 * mod's items.ts contains only the differences. That file IS the change list.
 *
 * 31 items became legal in M-B and none were removed. That is not a hand-typed number: it is what
 * the derivation produced, and this suite checks the shipped table still matches it.
 *
 * The absent files matter too. championsregma has no moves.ts, abilities.ts or learnsets.ts, which
 * means nothing about moves differs between the regulations — independently confirming the move
 * diff the app derives from its own learnset export by a completely different route.
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

const m = src.match(/^const REG_ITEM_CHANGES=(\{.*?\});$/m);
check(!!m, 'REG_ITEM_CHANGES is embedded in the app');
if (!m) { console.log('\n' + pass + ' passed, ' + (fail + 1) + ' failed'); process.exit(1); }
const TABLE = eval('(' + m[1] + ')');
const diff = TABLE['reg-ma->reg-mb'];

check(!!diff, 'the M-A to M-B transition is recorded', Object.keys(TABLE));
check(diff.added.length === 31, '31 items became legal in Regulation M-B', diff.added.length);
check(diff.removed.length === 0, 'and none were removed', diff.removed);

// --- names, not flattened keys -----------------------------------------------------------
// Showdown's mods inherit the display name, so the mod files carry only "raichunitex". Guessing a
// name back from that produced "Raichunitex"; the base items.ts says "Raichunite X".
check(diff.added.includes('Raichunite X') && diff.added.includes('Raichunite Y'),
  'names come from Showdown, so Raichunite X reads properly rather than "Raichunitex"');
check(diff.added.every(n => !/^[a-z0-9]+$/.test(n)),
  'no entry is a raw flattened key', diff.added.filter(n => /^[a-z0-9]+$/.test(n)));
check(diff.added.every(n => n.trim() === n && n.length > 2), 'every name is presentable', diff.added);

/* --- the substance ------------------------------------------------------------------------
   Two distinct groups, and both are worth pinning because they would be the first thing to break
   if the derivation silently started reading the wrong mod. */
// Held items that were simply not in the format in M-A.
['Life Orb', 'Expert Belt', 'Muscle Band', 'Wise Glasses', 'Wide Lens', 'Zoom Lens',
 'Metronome', 'Big Root', 'Shed Shell', 'Iron Ball', 'Light Clay'].forEach(n =>
  check(diff.added.includes(n), '"' + n + '" became legal in M-B'));
// All four weather rocks arrived together, which is a real format shift rather than a coincidence.
['Damp Rock', 'Heat Rock', 'Icy Rock', 'Smooth Rock'].forEach(n =>
  check(diff.added.includes(n), 'weather rock "' + n + '" became legal in M-B'));
// Mega stones for species M-B added — these should track the roster change.
['Barbaracite', 'Dragalgite', 'Eelektrossite', 'Falinksite', 'Malamarite', 'Pyroarite',
 'Scolipite', 'Scraftinite', 'Staraptite'].forEach(n =>
  check(diff.added.includes(n), 'mega stone "' + n + '" arrived with its species'));

// --- the derivation is committed and still agrees -----------------------------------------
const CACHE = path.join(ROOT, 'data', 'regulation-items.json');
check(fs.existsSync(CACHE), 'the derivation is committed alongside the app');
if (fs.existsSync(CACHE)) {
  const d = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  check(d.added.length === diff.added.length && d.removed.length === diff.removed.length,
    'the embedded table matches the derivation — regenerate rather than editing by hand',
    { derived: d.added.length, embedded: diff.added.length });
  check(d.added.every(a => diff.added.includes(a.name)), 'every derived item made it into the app');
  // Showdown gives two reasons and both mean "not legal here"; they must not be conflated with
  // "removed", which is the opposite direction entirely.
  const reasons = [...new Set(d.added.map(a => a.reason))].sort();
  check(reasons.join(',') === 'Future,Past',
    'both non-legal reasons appear, and only those two', reasons);
  check(d.from === 'reg-ma' && d.to === 'reg-mb', 'the direction is recorded, not assumed',
    { from: d.from, to: d.to });
}

// --- the page actually reports it ----------------------------------------------------------
check(/REG_ITEM_CHANGES\[d\.from\.key\+'->'\+d\.to\.key\]/.test(src),
  'the page looks the diff up by transition rather than hardcoding one');
check(!/Not tracked\. No item legality data/.test(src),
  'the "not tracked" apology is gone, because it is tracked now');
check(!/itemDisplayName/.test(src),
  'and the name-guessing helper is gone — names arrive already resolved');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
