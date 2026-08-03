/* HoopaDex — alternate form resolution tests
 * Run: node tests/test-form-names.js
 *
 * Slices the REAL baseSpeciesId(), formDisplayName() and getFormGenRange() out of app/index.html.
 *
 * PokéAPI gives every alternate form an id above 10000 that carries no relation to its species' dex
 * number. Mega Dragalge is 10299; Dragalge is 691. Every gate the app applies — does this exist in
 * the selected generation, is it legal in this Champions regulation — is a fact about the SPECIES,
 * so a form has to be resolved back to its species before any of them can run. The ability page
 * used to sidestep this by discarding everything above 10000, which is why Mega Dragalge could
 * never appear under Regenerator.
 *
 * The resolution is by name, and the trap is that plenty of base species contain a hyphen: ho-oh,
 * porygon-z, mr-mime, jangmo-o, tapu-koko. Shortening from the full name is what makes
 * "mr-mime-galar" find "mr-mime" instead of "mr".
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/);

const start = lines.findIndex(l => l.startsWith('function baseSpeciesId('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('async function renderDetail'));
if (start < 0 || end < 0) throw new Error('could not locate the form helpers');

// formDisplayName delegates its capitalisation to pokeName, so the real one is sliced too rather
// than stubbed — a stub would mean the label assertions below test the stub, not the app.
const nameStart = lines.findIndex(l => l.startsWith('const HYPHEN_NAMES='));
const nameEnd = lines.findIndex((l, i) => i > nameStart && l.startsWith('const SLC='));
if (nameStart < 0 || nameEnd < 0) throw new Error('could not locate pokeName and its tables');
const nameHelpers = lines.slice(nameStart, nameEnd).join('\n');

const MASTER = [
  { id: 26, name: 'raichu' }, { id: 80, name: 'slowbro' }, { id: 122, name: 'mr-mime' },
  { id: 250, name: 'ho-oh' }, { id: 474, name: 'porygon-z' }, { id: 691, name: 'dragalge' },
  // porygon MUST be here. It is a real species AND a prefix of porygon-z, so it is the case that
  // decides whether the resolver matches longest-first or shortest-first. Without it the two
  // orderings return the same answer for every name and the ordering is untested.
  { id: 137, name: 'porygon' },
  { id: 782, name: 'jangmo-o' }, { id: 785, name: 'tapu-koko' }, { id: 6, name: 'charizard' },
  { id: 19, name: 'rattata' }, { id: 641, name: 'tornadus' },
];

// formAllowed reads isChampionsMode and CHAMPIONS_IDS from module scope, so they are supplied here
// as stubs the assertions can steer through the returned setChampions().
const app = eval(
  'let master=' + JSON.stringify(MASTER) + ';\n' +
  'let isChampionsMode=false;\n' +
  'let CHAMPIONS_IDS=new Set([26,80,691]);\n' +
  nameHelpers + '\n' +
  lines.slice(start, end).join('\n') +
  '\n;({baseSpeciesId,formDisplayName,getFormGenRange,formAllowed,' +
  'setChampions:function(on,ids){isChampionsMode=on;if(ids)CHAMPIONS_IDS=ids}})'
);
const { baseSpeciesId: baseOf, formDisplayName: label, getFormGenRange: range,
        formAllowed: allowed, setChampions } = app;

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

check(typeof baseOf === 'function', 'baseSpeciesId was sliced out of the app', typeof baseOf);
check(typeof label === 'function', 'formDisplayName was sliced out of the app', typeof label);

// --- the case that prompted the work ---------------------------------------------------
check(baseOf('dragalge-mega') === 691, 'Mega Dragalge resolves to Dragalge (691)', baseOf('dragalge-mega'));
check(label('dragalge-mega') === 'Dragalge (Mega)', 'and is labelled "Dragalge (Mega)"', label('dragalge-mega'));

// --- hyphenated base species: the trap in name-based resolution ------------------------
check(baseOf('mr-mime-galar') === 122, 'Galarian Mr. Mime resolves to mr-mime, not "mr"', baseOf('mr-mime-galar'));
check(baseOf('ho-oh') === 250, 'ho-oh resolves to itself rather than being split', baseOf('ho-oh'));
check(baseOf('porygon-z') === 474, 'porygon-z resolves to itself', baseOf('porygon-z'));
check(baseOf('jangmo-o') === 782, 'jangmo-o resolves to itself', baseOf('jangmo-o'));
check(baseOf('tapu-koko') === 785, 'tapu-koko resolves to itself', baseOf('tapu-koko'));

// --- ordinary forms --------------------------------------------------------------------
check(baseOf('slowbro-galar') === 80, 'Galarian Slowbro resolves to Slowbro', baseOf('slowbro-galar'));
check(baseOf('raichu-mega-x') === 26, 'Mega Raichu X resolves to Raichu', baseOf('raichu-mega-x'));
check(baseOf('rattata-alola') === 19, 'Alolan Rattata resolves to Rattata', baseOf('rattata-alola'));
check(baseOf('tornadus-therian') === 641, 'Tornadus-Therian resolves to Tornadus', baseOf('tornadus-therian'));

// --- an unknown species must resolve to nothing, never to a guess ----------------------
check(baseOf('kubfu-supreme') === 0, 'an unknown species returns 0 rather than a wrong id', baseOf('kubfu-supreme'));
check(baseOf('') === 0, 'an empty name returns 0', baseOf(''));

// --- labels ----------------------------------------------------------------------------
check(label('slowbro-galar') === 'Slowbro (Galarian)', 'Galarian label', label('slowbro-galar'));
check(label('rattata-alola') === 'Rattata (Alolan)', 'Alolan label', label('rattata-alola'));
check(label('charizard-mega-x') === 'Charizard (Mega X)', 'Mega X keeps its letter', label('charizard-mega-x'));
check(label('charizard-mega-y') === 'Charizard (Mega Y)', 'Mega Y keeps its letter', label('charizard-mega-y'));
check(label('raichu') === 'Raichu', 'a base species is unchanged', label('raichu'));

// --- form era gating: a form can be far newer than its species -------------------------
// Alolan Rattata is a Gen VII form of a Gen I Pokemon. Gating on the species alone would show it
// in Gen I, which is the generation-accuracy bug this app exists to avoid.
const alola = range('rattata-alola');
check(!!alola && alola.available(7) === true, 'Alolan Rattata exists in Gen VII', alola && alola.label);
check(!!alola && alola.available(1) === false, 'Alolan Rattata does NOT exist in Gen I', alola && alola.label);

const g6mega = range('charizard-mega-x');
check(!!g6mega && g6mega.available(6) === true, 'a Gen VI mega exists in Gen VI');
check(!!g6mega && g6mega.available(5) === false, 'a Gen VI mega does not exist in Gen V');

const zaMega = range('dragalge-mega');
check(!!zaMega && zaMega.available(9) === true, 'a Z-A mega exists in Gen IX', zaMega && zaMega.label);
check(!!zaMega && zaMega.available(6) === false, 'a Z-A mega does not exist in Gen VI — it is not a Gen VI mega',
  zaMega && zaMega.label);

check(range('raichu') === null, 'a base species has no form range, so it is gated on species alone');

/* Totem Raticate is Alolan AND Totem. Both suffixes are in the name, so the ORDER the branches are
   tested in decides the answer: -alola first claims Gen VII+, which put it in Generation VIII where
   no Totem Pokemon has ever existed. Found by listing Thick Fat in Gen VIII and reading the result.
   The narrower window must win, so these two assertions pin the branch order. */
const totem = range('raticate-totem-alola');
check(!!totem && totem.available(7) === true, 'Totem Raticate exists in Gen VII', totem && totem.label);
check(!!totem && totem.available(8) === false,
  'Totem Raticate does NOT exist in Gen VIII — Totem must be tested before Alolan',
  totem && totem.label);
check(!!totem && totem.label === 'Gen VII', 'and it is labelled Gen VII, not Gen VII+', totem && totem.label);
// The plain Alolan form of the same species keeps the wider window.
const plainAlolan = range('raticate-alola');
check(!!plainAlolan && plainAlolan.available(8) === true,
  'non-Totem Alolan Raticate still exists in Gen VIII', plainAlolan && plainAlolan.label);

/* --- formAllowed: the single gate all three surfaces share ---------------------------------
   The ability page, the team builder search and the calculator picker each decided this for
   themselves, and only the ability page ever learned about forms — which is exactly why a Mega
   could not be added to a team or calculated against. One rule now. */
check(typeof allowed === 'function', 'formAllowed was sliced out of the app', typeof allowed);

const GEN_MAX_9 = 1025, GEN_MAX_1 = 151;

// A base species is gated on its dex number and nothing else.
check(allowed('charizard', 6, 9, GEN_MAX_9) === true, 'Charizard is allowed in Gen IX');
check(allowed('charizard', 6, 1, GEN_MAX_1) === true, 'Charizard is allowed in Gen I');
check(allowed('dragalge', 691, 1, GEN_MAX_1) === false, 'a Gen VI species is not allowed in Gen I');

// A form is gated on BOTH its species and its own era. That pair is the whole point.
check(allowed('dragalge-mega', 10299, 9, GEN_MAX_9) === true, 'Mega Dragalge is allowed in Gen IX');
check(allowed('dragalge-mega', 10299, 6, GEN_MAX_9) === false,
  'Mega Dragalge is NOT allowed in Gen VI — it is a Z-A mega');
check(allowed('rattata-alola', 10091, 7, GEN_MAX_9) === true, 'Alolan Rattata is allowed in Gen VII');
check(allowed('rattata-alola', 10091, 1, GEN_MAX_1) === false,
  'Alolan Rattata is NOT allowed in Gen I even though Rattata is — the form is Gen VII');
check(allowed('charizard-mega-x', 10034, 8, GEN_MAX_9) === false, 'no mega exists in Gen VIII');

// An unresolvable form is refused rather than silently allowed.
check(allowed('kubfu-supreme-mega', 10999, 9, GEN_MAX_9) === false,
  'a form whose species cannot be resolved is refused, not guessed');

// Champions: the roster names species, so a form is legal exactly when its base is.
setChampions(true, new Set([691]));
check(allowed('dragalge', 691, 9, GEN_MAX_9) === true, 'Champions: Dragalge is on the roster');
check(allowed('dragalge-mega', 10299, 9, GEN_MAX_9) === true,
  'Champions: Mega Dragalge is legal because Dragalge is');
check(allowed('charizard', 6, 9, GEN_MAX_9) === false, 'Champions: Charizard is not on this roster');
check(allowed('charizard-mega-x', 10034, 9, GEN_MAX_9) === false,
  'Champions: nor is its mega — the form follows the species');
setChampions(false);
check(allowed('charizard', 6, 9, GEN_MAX_9) === true, 'leaving Champions mode restores the species');

/* --- the selected form survives navigation ------------------------------------------------
   showForm renders a form but deliberately does not move `adId`, because a form is a view of the
   species rather than a separate entry. That is also why the choice used to be lost: returning to
   the species re-rendered the default, with nothing to show that a choice had been discarded.
   Asserted against the shipped source — the behaviour itself is DOM-bound and was verified in the
   browser against Rotom, the case the backlog named. */
check(lines.some(l => l.startsWith('const lastFormBySpecies={};')),
  'the selected form is remembered per species');
check(lines.some(l => l.includes('if(adId)lastFormBySpecies[adId]=formId;')),
  'showForm records the chosen form against the species');
check(lines.some(l => l.includes('const remembered=lastFormBySpecies[id];')),
  'showDetail looks the remembered form up again');
check(lines.some(l => l.includes('remembered&&remembered!==id&&dc[remembered]')),
  'and only restores it when it is still loaded, so the panel never blocks on a refetch');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
