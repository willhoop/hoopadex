/* HoopaDex — ability description de-duplication tests
 * Run: node tests/test-ability-desc.js
 *
 * Slices the REAL isRestatement() and its stopword set out of app/index.html.
 *
 * The ability page showed PokeAPI's short effect text and its long effect text as two blocks at two
 * sizes. For most abilities the long one is the short one reworded, so every page carried the same
 * sentence twice — the guard was `longDesc!==shortDesc`, which only catches character-identical
 * strings and therefore never fired. This is the replacement guard.
 *
 * The failure that matters is the ASYMMETRIC one: calling a genuinely additional paragraph a
 * restatement silently deletes information from the page, which is worse than showing one line too
 * many. The real-wording cases below are the regression floor.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('const RESTATE_STOP='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('async function showAbilityPage'));
if (start < 0 || end < 0) throw new Error('could not locate the restatement guard');

const app = eval(lines.slice(start, end).join('\n') + '\n;({RESTATE_STOP,isRestatement})');
// Named differently from the sliced declaration on purpose — `const isRestatement` here collides
// with the `function isRestatement` the eval brings into this same scope.
const restates = app.isRestatement;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

check(typeof restates === 'function', 'isRestatement was sliced out of the app', typeof isRestatement);
check(app.RESTATE_STOP instanceof Set, 'the stopword set came across', typeof app.RESTATE_STOP);

// --- the case that prompted this: real Aftermath text from PokeAPI ----------------------
const AFTERMATH_SHORT = 'Damages the attacker for 1/4 its max HP when knocked out by a contact move.';
const AFTERMATH_LONG  = "When this Pokémon is knocked out by a move that makes contact, the move's user takes 1/4 its maximum HP in damage.";
check(restates(AFTERMATH_SHORT, AFTERMATH_LONG) === true,
  'Aftermath: the long effect text is caught as a restatement');

// --- more real paraphrase pairs --------------------------------------------------------
// Magma Armor is deliberately asserted the OTHER way: the long text adds "existing freezing is
// also cured", which the short line does not say. Keeping it is correct, and this pins that the
// guard is not simply flagging every pair that shares a topic word.
check(restates('Prevents the Pokémon from being frozen.',
                    'This Pokémon cannot be frozen. Existing freezing is also cured.') === false,
  'Magma Armor: the long text cures an existing freeze, so it is kept');
check(restates('Raises the Pokémon\'s Speed one stage when it is hit by an attack.',
                    'Whenever this Pokémon is hit by an attack, its Speed rises by one stage.') === true,
  'a straightforward reword is caught');

// --- the asymmetric failure: additional detail must SURVIVE ----------------------------
check(restates('Boosts the power of Water-type moves.',
                    'Prevents burns. Doubles Speed in sunshine but halves it in rain, and the holder loses 1/8 max HP each turn while poisoned.') === false,
  'genuinely different text is NOT deleted as a restatement');
check(restates('Prevents paralysis.',
                    'The Pokémon cannot be paralysed. In addition, its accuracy is raised by 30% in a sandstorm and it ignores the effects of Sticky Web, Icy Wind and Electroweb.') === false,
  'a short line followed by substantial extra mechanics is NOT deleted');

// --- degradation: never throw, never guess on missing input ----------------------------
check(restates('', 'anything') === false, 'an empty short description is not a restatement');
check(restates('anything', '') === false, 'an empty long description is not a restatement');
check(restates(undefined, undefined) === false, 'undefined input does not throw');
check(restates('the a of to in is it', 'completely unrelated wording here') === false,
  'a string that is nothing but stopwords is not a restatement');

// --- the prefix stemming the guard depends on -------------------------------------------
check(restates('damages maximum', 'damage max') === true,
  'damages/damage and max/maximum are matched by prefix containment');
check(restates('poison burn freeze', 'poisoned burned frozen') === false,
  'freeze/frozen is not a prefix pair, so partial overlap stays below the bar');

// --- the threshold is a real boundary, not decoration ----------------------------------
check(restates('alpha bravo charlie delta', 'alpha bravo charlie delta') === true,
  'identical significant words are a restatement');
check(restates('alpha bravo charlie delta', 'alpha zulu yankee xray') === false,
  'one word in four is not a restatement');
check(restates('alpha bravo charlie delta', 'alpha bravo charlie xray', 0.7) === true,
  'three words in four clears the default threshold');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
