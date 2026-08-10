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

/* ── The "Pokemon with this ability" card ───────────────────────────────────────────────────────
   Reported from the live site on the Cud Chew page: the Hidden pill sat outside its card, on top of
   the next one's sprite.

   It was four siblings on one flex row — sprite, a bare text node for the name, the form pill, the
   Hidden pill — inside a grid cell of minmax(160px,1fr). The sprite and the form pill had
   flex-shrink:0, the Hidden pill had margin-left:auto pushing it hard right, and a bare text node
   has no min-width to give. Nothing in the row could yield, so with a name like "Tauros Combat
   Breed (Paldean)" the row simply ran past the card: measured in the browser at 227px of content in
   a 158px card, with the pills 13px clear of the right border.

   Two halves to the fix, and BOTH are needed:
     - markup: the name and the pills become a column that is allowed to narrow
     - CSS:    min-width:0 on that column, because a flex item's default min-width is auto, which
               means "never smaller than my content" — without it the restructure changes nothing

   The second half is why the CSS assertions below exist even though asserting on a stylesheet is
   normally a change-detector. There is no layout engine in node, so the alternative is no test at
   all, and this is a defect that renders perfectly: one card overlapping another reads as a design
   choice until someone squints. Measured before and after in a real browser at 160/140/120px card
   widths; the numbers quoted above come from that instrument, not from this file. */
const cardStart = lines.findIndex(l => l.startsWith('function apMonCard('));
const cardEnd = lines.findIndex((l, i) => i > cardStart && l.startsWith('function getGenMaxId('));
if (cardStart < 0 || cardEnd < 0) throw new Error('could not locate apMonCard');
const cardApp = (0, eval)(lines.slice(cardStart, cardEnd).join('\n') + '\n;({apMonCard})');
const card = cardApp.apMonCard;

const full = card(10250, 'x.png', 'Tauros Combat Breed (Paldean)',
  '<span class="ap-form-pill">Gen IX+</span>', '<span class="hidden-pill">Hidden</span>');

check(/<span class="ap-mon-body">/.test(full), 'the name and pills live in a body wrapper', full);
check(/<span class="ap-mon-name">Tauros Combat Breed \(Paldean\)<\/span>/.test(full),
  'the name is an element, not a bare text node — a text node has no min-width to give', full);
check(/<span class="ap-mon-pills"><span class="ap-form-pill">/.test(full),
  'the pills are wrapped in their own row rather than being siblings of the name', full);
check(full.indexOf('ap-mon-pills') > full.indexOf('ap-mon-name'),
  'and that row comes after the name, so it wraps beneath it');
check(/<img [^>]*>\s*<span class="ap-mon-body">/.test(full),
  'the sprite stays outside the body, so it keeps its size while the text column shrinks', full);

// A card with nothing to put in the pill row must not grow an empty one.
const bare = card(1, 'x.png', 'Farigiraf', '', '');
check(!/ap-mon-pills/.test(bare), 'a card with no pills has no pill row at all', bare);
check(/<span class="ap-mon-name">Farigiraf<\/span>/.test(bare), 'but still names itself properly', bare);
// Either pill alone is enough to justify the row.
check(/ap-mon-pills/.test(card(1, 'x.png', 'X', '<span class="ap-form-pill">F</span>', '')),
  'a form pill alone gets a row');
check(/ap-mon-pills/.test(card(1, 'x.png', 'X', '', '<span class="hidden-pill">Hidden</span>')),
  'and so does a Hidden pill alone');

const css = fs.readFileSync(SRC, 'utf8');
const rule = sel => (css.match(new RegExp('\\' + sel + '\\{([^}]*)\\}')) || [])[1] || '';
check(/min-width:0/.test(rule('.ap-mon-body')),
  'the text column may shrink below its content — this one declaration is what makes the fix work',
  rule('.ap-mon-body'));
check(/flex-direction:column/.test(rule('.ap-mon-body')), 'and stacks the name above the pills');
check(/flex-wrap:wrap/.test(rule('.ap-mon-pills')),
  'two pills wrap onto a second line rather than widening the card', rule('.ap-mon-pills'));
check(!/margin-left:auto/.test(rule('.hidden-pill')),
  'the Hidden pill no longer shoves itself to the right edge — that is what put it outside the card',
  rule('.hidden-pill'));
check(!/margin-left:/.test(rule('.ap-form-pill')),
  'and the form pill is spaced by the row gap rather than its own margin', rule('.ap-form-pill'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
