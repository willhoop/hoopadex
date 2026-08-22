/* HoopaDex — what a move did in the generation you are looking at
 * Run: node tests/test-move-text.js
 *
 * The app described every move with one line from PokeAPI, and that field has no generation
 * dimension — it is written for the current games. For an older generation it is somewhere between
 * incomplete and false.
 *
 * Jump Kick is the case to keep in mind, because it is not a wording difference:
 *
 *     PokeAPI, for every generation ever made:
 *       "If the user misses, it takes half the damage it would have inflicted in recoil."
 *     Gen I    the user takes 1 HP. Flat.
 *     Gen II   an eighth of the damage it would have dealt
 *     Gen III–IV  half of the damage it would have dealt
 *     Gen V+   half of its own MAXIMUM HP — a different quantity entirely
 *
 * ON THE NUMBERS, because the first pass got them wrong and both are worth keeping. 312 of 882
 * moves carry SOME per-generation override in Showdown, and that is the figure this work started
 * from. Most of those override only the long paragraph and leave the one-line summary alone, so
 * counting them overstated the problem by more than double and would have shipped a 437 KB blob of
 * paragraphs where one-line summaries belong. The honest figure is 138 moves.
 *
 * These assertions pin the cutoff arithmetic, because that is the part that fails silently. An
 * off-by-one in it does not throw: it shows Generation II's wording to a Generation III reader, at
 * the same size and confidence as the right answer.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split(/\r?\n/);

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

// --- load the shipped resolver -----------------------------------------------------------------
const mtLine = lines.find(l => l.startsWith('const MOVETEXT='));
const start = lines.findIndex(l => l.startsWith('function moveTextForGen('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function renderMoveMechanics('));
if (!mtLine || start < 0 || end < 0) throw new Error('could not locate moveTextForGen');
const app = (0, eval)(mtLine + '\n' + lines.slice(start, end).join('\n') + '\n;({MOVETEXT,moveTextForGen})');
const { MOVETEXT, moveTextForGen } = app;

// --- the embedded table is the generated one ---------------------------------------------------
const embedPath = path.join(ROOT, 'data', 'move-text.embed.json');
const a = src.indexOf('/*BEGIN-MOVETEXT*/'), b = src.indexOf('/*END-MOVETEXT*/');
check(fs.existsSync(embedPath), 'data/move-text.embed.json exists');
check(src.slice(a + '/*BEGIN-MOVETEXT*/'.length, b) === fs.readFileSync(embedPath, 'utf8').trim(),
  'the table embedded in the app is byte-identical to the generated one',
  'run: node build/generate-move-text.js && node build/embed-move-text.js');

// --- the cutoff arithmetic ----------------------------------------------------------------------
const jk = g => (moveTextForGen('jump-kick', g) || {}).text;
check(/1 HP/.test(jk(1)), 'Gen I Jump Kick costs 1 HP', jk(1));
check(/1\/8/.test(jk(2)), 'Gen II costs an eighth of the damage dealt', jk(2));
check(/1\/2/.test(jk(3)), 'Gen III costs half the damage dealt', jk(3));
check(/1\/2/.test(jk(4)), 'and so does Gen IV — the same cutoff covers both', jk(4));
/* Gen V is where it becomes half of MAX HP, which is the modern wording, so there is nothing to
   correct and the function must say so by returning null rather than echoing the modern line. */
check(moveTextForGen('jump-kick', 5) === null, 'Gen V returns nothing — the modern text is right', jk(5));
check(moveTextForGen('jump-kick', 9) === null, 'and so does Gen IX');
check(jk(1) !== jk(2) && jk(2) !== jk(3),
  'three generations, three different answers — not one flattened one');

/* The cutoff runs UPWARD: a genN entry covers generation N and everything below it, so a generation
   with no entry of its own reads the next one up, not the next one down. Bind's summary changes at
   two points only — gen1 and gen4 — so Generations II and III have no entry of their own and must
   read the gen4 text. Resolving downward instead would hand Generation III the Generation I
   wording, and nothing about that looks wrong on screen.

   (Bind carries `desc` overrides at 8, 7, 5 and 3 as well. Those change only the long paragraph,
   which is exactly the distinction this data is built on, and an earlier version of this assertion
   was written against them and failed.) */
const bind = g => (moveTextForGen('bind', g) || {}).text;
check(bind(2) === bind(4) && bind(3) === bind(4),
  'a generation with no entry of its own reads the one ABOVE it',
  JSON.stringify([bind(2), bind(3), bind(4)]));
check(bind(1) !== bind(2), 'and not the one below it', JSON.stringify([bind(1), bind(2)]));
check(bind(5) === undefined, 'above the last cutoff there is nothing to correct', bind(5));

// --- a move is never described before it existed -------------------------------------------------
/* Aurora Veil is a Generation VII move that carries a gen8 override. Without the introduction gate
   the cutoff search would find that override for Generation I and answer a question that cannot be
   asked — with a real sentence, in the right place, about a move that did not exist. */
const av = MOVETEXT['aurora-veil'];
if (av) {
  check(av.gen >= 7, 'Aurora Veil is recorded as a Gen VII move', av.gen);
  check(moveTextForGen('aurora-veil', 3) === null, 'and says nothing about Generation III');
  check(Object.keys(av.gens).every(n => Number(n) >= av.gen),
    'no override is stored below the move\'s own debut', Object.keys(av.gens).join(','));
}
check(moveTextForGen('tackle', 1) === null || typeof moveTextForGen('tackle', 1).text === 'string',
  'an ordinary move either has a correction or has none, and never half of one');
check(moveTextForGen('not-a-real-move', 3) === null, 'an unknown move returns null');
check(moveTextForGen(undefined, 3) === null, 'and so does a missing name, without throwing');

// --- the modern line is carried, because the correction is a contrast ---------------------------
const g1 = moveTextForGen('jump-kick', 1);
check(g1 && /50% of its max HP/.test(g1.now),
  'the modern wording travels with the correction, so the panel can show the contrast', g1 && g1.now);
check(g1.text !== g1.now, 'and the two are genuinely different sentences');

// --- the table as a whole -------------------------------------------------------------------------
const slugs = Object.keys(MOVETEXT);
check(slugs.length >= 120 && slugs.length <= 200,
  'the table holds roughly the measured 138 moves, not the 312 that overstated it', slugs.length);
check(slugs.every(s => /^[a-z0-9-]+$/.test(s)), 'every key is a PokeAPI slug');
const noGens = slugs.filter(s => !Object.keys(MOVETEXT[s].gens || {}).length);
check(noGens.length === 0, 'no move is stored with nothing to say', noGens.slice(0, 5).join(','));
/* Long paragraphs are the shape this deliberately does not carry: a generation block holding only
   `desc` means the one-line summary did NOT change, and falling back to it put a 232-character
   median paragraph where a short line belongs. */
const longest = Math.max(...slugs.flatMap(s => Object.values(MOVETEXT[s].gens).map(t => t.length)));
check(longest <= 140, 'every correction is a one-line summary, not a paragraph', 'longest is ' + longest);

// --- Champions is not silently claimed ------------------------------------------------------------
/* Champions selects Generation IX, and Generation IX has no corrections, so nothing is asserted
   about Champions either way. That is the intended behaviour: nothing published describes Champions'
   move mechanics separately, so the app inherits Scarlet/Violet wording and says which rules it is
   describing rather than implying it has checked. */
check(moveTextForGen('jump-kick', 9) === null,
  'Generation IX — and therefore Champions — is told nothing this data cannot support');
const renderSrc = src.slice(src.indexOf('function renderMoveMechanics('), src.indexOf('const ENVMOVES='));
check(/isChampionsMode\?'Scarlet\/Violet rules'/.test(renderSrc),
  'and when Champions is selected the panel names the rules it is quoting', renderSrc.slice(0, 200));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
