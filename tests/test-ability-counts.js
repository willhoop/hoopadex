/* HoopaDex — the ability card and the ability page must give the same number
 * Run: node tests/test-ability-counts.js
 *
 * Reported from the live site, 5.40: the abilities list showed
 *
 *     Aura Break  [MEGA]   Gen VI · 1 Pokémon
 *
 * and clicking it showed "POKÉMON WITH THIS ABILITY (0)". One question, two screens, two answers.
 *
 * The detail page was right. The list counted with `id<=genMax` and nothing else — no Champions
 * roster, no form era, no hidden-ability rule, and no past-ability resolution — so it counted
 * Zygarde, which is not in the Champions roster. Measured on the live build before the fix:
 *
 *     Champions Reg M-B   97 rows advertised holders and had none, 170 more had a wrong count
 *     Generation III      74 phantom rows, 43 wrong counts
 *     Generation IX        0 phantom rows, 131 wrong counts — all UNDERcounts, because the cheap
 *                          filter cannot see the forms and past holders abilityHoldersForGen adds
 *
 * 267 of 373 rows were wrong in Champions. Aura Break was simply the one that got clicked.
 *
 * The shape of this defect is the one this project keeps meeting: two pieces of code answering one
 * question, where the cheap copy renders a plausible number and nothing compares them. So the
 * assertions below are mostly structural — they are about there being ONE resolver, because a test
 * that merely checked today's counts would pass again the moment someone reintroduced a shortcut.
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

// --- there is one resolver, and both screens call it ------------------------------------------
check(/function abilityHoldersFiltered\(abilityName,apiList,genNum,genMax\)/.test(src),
  'abilityHoldersFiltered is the one answer to "who has this ability here"');

/* It must apply all four gates. Dropping any one of them silently reinstates a variant of the
   original bug — the roster gate alone is what Aura Break turned on. */
const fnStart = src.indexOf('function abilityHoldersFiltered(');
const body = src.slice(fnStart, src.indexOf('\n}', fnStart));
check(/abilityHoldersForGen\(abilityName,apiList,genNum\)/.test(body),
  'it resolves the generation\'s holders first — who HAD it then, not who has it now');
check(/formAllowed\(p\.pokemon\.name,id,genNum,genMax\)/.test(body),
  'it applies formAllowed, which carries the Champions roster and the form-era rules');
check(/p\.is_hidden&&genNum<5/.test(body),
  'it drops hidden-only holders before Gen V, when hidden abilities did not exist');
check(/id<=0/.test(body), 'and an unresolvable id is not counted');

const listStart = src.indexOf('function renderAbilityList(');
const listEnd = src.indexOf('\nfunction ', listStart + 10);
const listFn = src.slice(listStart, listEnd);
check(listStart >= 0 && listEnd > listStart, 'renderAbilityList was located', listEnd - listStart);

const callsInList = (listFn.match(/abilityHoldersFiltered\(/g) || []).length;
check(callsInList >= 1, 'the list resolves holders through the shared function', callsInList);

/* THE ASSERTION THAT MATTERS. The old count was an inline filter on the URL id, and it is exactly
   the kind of thing that gets written again by someone who wants a quick number and does not know
   what formAllowed is for. If this pattern reappears anywhere in the list renderer, the card and
   the page can disagree again. */
const cheapCount = listFn.match(/a\.pokemon\.(filter|some)\(p=>\{const m=p\.pokemon\.url\.match/g) || [];
check(cheapCount.length === 0,
  'the list no longer counts holders with a bare id<=genMax filter',
  cheapCount.length + ' shortcut(s) remain');

check(/const genCount=holderCount\.get\(a\.name\)\|\|0/.test(listFn),
  'the number on the card is the resolved count, not a second computation');
/* Resolved once per ability rather than once for the filter and again for the card: 373 abilities
   against the full holder resolution is not free, and two calls would double it. */
check((listFn.match(/holderCount\.set\(/g) || []).length === 1,
  'and it is resolved once per ability, not once per place it is displayed');

// --- the detail page uses it too ---------------------------------------------------------------
check(/const pokemonList=abilityHoldersFiltered\(abilityName,d\.pokemon,genNum,genMax\)/.test(src),
  'the ability detail page draws its list from the same function');

// --- the MEGA badge is gated on the roster -----------------------------------------------------
/* CHAMP_MEGA_ABILITIES is generated from MEGAS_ZA — the Legends: Z-A mega set — and the badge was
   drawn for every row of it whenever Champions mode was on. Those are different games. Eight of the
   42 Z-A megas are species the Champions roster does not contain, so the app was announcing an
   ability as available on a Mega in a game where nothing can have it. */
const megaSet = src.slice(src.indexOf('const CHAMP_MEGA_SET='),
                          src.indexOf('const CHAMP_MEGA_SET=') + 900);
check(/CHAMPIONS_IDS\.has\(id\)/.test(megaSet),
  'the mega badge is filtered by the Champions roster, not shown for every Z-A mega');
check(/return false;\s*\/\/ unresolved is not a licence to claim it exists/.test(megaSet),
  'and a species it cannot resolve is excluded rather than assumed legal');

// --- speciesIdBySlug, behaviourally -------------------------------------------------------------
/* `master` names a few species by their DEFAULT FORM, which is why the roster gate needed this at
   all: baseSpeciesId walks prefixes downward and cannot turn "zygarde" into zygarde-50. That miss
   is silent — an unresolved species reads as "not in this game" — so it gets its own check. */
const sidSrc = src.slice(src.indexOf('function speciesIdBySlug('),
                         src.indexOf('\n}', src.indexOf('function speciesIdBySlug(')) + 2);
const speciesIdBySlug = (0, eval)(
  'var master=[{id:26,name:"raichu"},{id:718,name:"zygarde-50"},{id:668,name:"pyroar-male"},' +
  '{id:678,name:"meowstic-male"},{id:250,name:"ho-oh"},{id:978,name:"tatsugiri-curly"}];\n' +
  sidSrc + '\n;speciesIdBySlug');

check(speciesIdBySlug('raichu') === 26, 'an exact name resolves', speciesIdBySlug('raichu'));
check(speciesIdBySlug('zygarde') === 718,
  'and a species master stores under its default form still resolves — this is the whole point',
  speciesIdBySlug('zygarde'));
check(speciesIdBySlug('pyroar') === 668, 'pyroar → pyroar-male', speciesIdBySlug('pyroar'));
check(speciesIdBySlug('meowstic') === 678, 'meowstic → meowstic-male', speciesIdBySlug('meowstic'));
check(speciesIdBySlug('tatsugiri') === 978, 'tatsugiri → tatsugiri-curly', speciesIdBySlug('tatsugiri'));
/* Exact must win over prefix. If it did not, a species whose name is a prefix of another's form
   could resolve to the wrong Pokemon, which is a wrong answer rather than a missing one. */
check(speciesIdBySlug('ho-oh') === 250, 'a hyphenated species name is not mistaken for a form');
check(speciesIdBySlug('notapokemon') === 0, 'and an unknown slug resolves to 0, not undefined');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
