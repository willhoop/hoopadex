/* HoopaDex — multi-criteria Pokédex search tests
 * Run: node tests/test-dex-search.js
 *
 * Slices the REAL classifier, comparator and regulation-rank helper out of app/index.html so the
 * tests cannot drift from shipped code.
 *
 * The feature answers queries like "a Dark type with Prankster that gets Rain Dance" by resolving
 * each criterion to a SET of dex numbers with one request apiece — /type, /ability and /move each
 * return their own member list — then intersecting. The alternative, loading all 1025 Pokémon to
 * filter locally, is what makes this kind of search feel impossible in a client-only app.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const lines = src.split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('const DEX_TYPES='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function onDexSortChange'));
if (start < 0 || end < 0) throw new Error('could not locate the search engine in index.html');

// Stubs for the app globals the sliced code closes over.
let isChampionsMode = true, championsReg = 'm-b', dexSort = 'dex';
const dc = {};
const TC = { dark: '#705848' };
let tmMoveIndex = ['rain-dance', 'surf', 'sucker-punch'];
global.window = { _abilityIndex: ['prankster', 'sharpness', 'intimidate'] };
const CHAMPIONS_REGS = [
  { short: 'm-b', ids: () => new Set([1, 2, 3, 45, 211]) },
  { short: 'm-a', ids: () => new Set([1, 2, 3]) },
];
const regByShort = s => CHAMPIONS_REGS.find(r => r.short === s);
function getStatsForGen(d) { return d.stats; }
function applyFilters() {}
function renderDexFilters() {}
const document = { getElementById: () => null };

// `let dexSort` inside the sliced code is scoped to the eval, so assigning the outer stub does
// nothing — an earlier draft of this file "passed" its sort assertions without ever changing the
// sort. Export a setter that closes over the real binding instead.
const app = eval(lines.slice(start, end).join('\n')
  + '\n;({classifyDexTerm,dexSortComparator,newestRegRank,DEX_TYPES,setSort:v=>{dexSort=v}})');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

// --- the classifier decides what a typed term means ---------------------------------
const c = t => app.classifyDexTerm(t);
check(c('dark')?.kind === 'type', 'a type name classifies as a type', c('dark'));
check(c('Dark')?.kind === 'type', 'classification is case-insensitive', c('Dark'));
check(c('prankster')?.kind === 'ability', 'a known ability classifies as an ability', c('prankster'));
check(c('rain dance')?.kind === 'move', 'a known move classifies as a move', c('rain dance'));
check(c('rain dance')?.name === 'rain-dance', 'spaces become hyphens for the API slug', c('rain dance'));
check(c('rain dance')?.label === 'rain dance', 'the label stays readable', c('rain dance'));
// An unknown term must return null rather than guessing — a wrong guess silently changes results.
check(c('notathing') === null, 'an unknown term is not guessed at', c('notathing'));
check(c('') === null, 'an empty term is rejected', c(''));
check(app.DEX_TYPES.length === 18, 'all eighteen types are known', app.DEX_TYPES.length);

// A term that is BOTH a type and something else must resolve as the type — types are the smaller,
// closed set, so they win by design rather than by index-load order.
check(c('fairy')?.kind === 'type', 'type wins over other kinds for ambiguous terms', c('fairy'));

// --- "recently added" is derived from the regulation registry ------------------------
// Rank 0 = added in the current regulation, 1 = present in the one before it.
check(app.newestRegRank(45) === 0, 'a Pokémon new this regulation ranks first', app.newestRegRank(45));
check(app.newestRegRank(211) === 0, 'another new one also ranks first', app.newestRegRank(211));
check(app.newestRegRank(1) === 1, 'a Pokémon carried over ranks after', app.newestRegRank(1));
isChampionsMode = false;
check(app.newestRegRank(45) === 1, 'outside Champions there is no "recently added"', app.newestRegRank(45));
isChampionsMode = true;

// --- sort comparators -----------------------------------------------------------------
const mk = (id, name, stats) => ({ id, name });
dc[1] = { stats: [{ stat: { name: 'speed' }, base_stat: 45 }] };
dc[2] = { stats: [{ stat: { name: 'speed' }, base_stat: 100 }] };
dc[3] = { stats: [{ stat: { name: 'speed' }, base_stat: 80 }] };
const mons = [mk(1, 'bulbasaur'), mk(2, 'fast'), mk(3, 'mid')];

app.setSort('dex');
check(JSON.stringify(mons.slice().sort(app.dexSortComparator()).map(p => p.id)) === '[1,2,3]',
  'default sort is dex number', mons.slice().sort(app.dexSortComparator()).map(p => p.id));
app.setSort('speed');
check(JSON.stringify(mons.slice().sort(app.dexSortComparator()).map(p => p.id)) === '[2,3,1]',
  'speed sorts descending', mons.slice().sort(app.dexSortComparator()).map(p => p.id));
app.setSort('name');
check(mons.slice().sort(app.dexSortComparator())[0].name === 'bulbasaur',
  'name sorts alphabetically', '');
// A real assertion, not a tautology: 45 is new this regulation, 1 and 2 are carried over, so 45
// must come first regardless of its dex number being the highest.
app.setSort('new');
const byNew = [mk(1,'a'), mk(2,'b'), mk(45,'new')].sort(app.dexSortComparator()).map(p => p.id);
check(byNew[0] === 45, 'recently-added sorts this regulation first', byNew);

// An uncached Pokémon must sort last rather than crashing or being treated as zero.
app.setSort('speed');
const withMissing = [mk(1, 'a'), mk(999, 'uncached'), mk(2, 'fast')];
const sorted = withMissing.slice().sort(app.dexSortComparator()).map(p => p.id);
check(sorted[sorted.length - 1] === 999, 'an uncached Pokémon sorts last, not first', sorted);

/* -- The universal search box, and the generation it is supposed to respect --------------------
   Reported from the live site: "im getting conflicting answers on bullet punch". Searching
   "bullet punch" with the selector on Generation III returned Bullet Punch under MOVES and, four
   rows lower, Bullet Punch under NOT IN GEN III. The app contradicted itself inside one dropdown.

   Two causes, both in the fuzzy pass that runs after the exact-match pass:

   1. It deduplicated against `items` only. The exact pass routes anything from a later generation
      into `otherGenItems` instead, so Bullet Punch was absent from `items`, looked new, and got
      added a second time.
   2. It applied no generation rule at all. The exact pass has one; the fuzzy pass beside it did
      not, so Generation III also offered Bulletproof (Gen VI) and Ball Fetch (Gen VIII) as ordinary
      results with nothing marking them.

   The second was the more damaging and produced no visible contradiction - a wrong answer with
   nothing to notice, rather than two answers side by side. It survived because an ability's
   introduction generation was computed INLINE inside the exact branch and existed nowhere else, so
   the branch beside it had no way to ask the question. It is now getAbilityIntroGen and both
   branches call it. */
const gaigStart = lines.findIndex(l => l.startsWith('function getAbilityIntroGen('));
const gaigEnd = lines.findIndex((l, i) => i > gaigStart && /^\}/.test(l));
if (gaigStart < 0 || gaigEnd < 0) throw new Error('could not locate getAbilityIntroGen');

/* Built with one source populated at a time. Each of the three is the only one that will have
   loaded in some state of the app, and the search has to get the same answer whichever it is. */
function introGenWith(cache, data, map) {
  return (0, eval)(
    'var abilityCache=' + JSON.stringify(cache) + ';\n' +
    'var abilitiesData=' + JSON.stringify(data) + ';\n' +
    'var window={_abilityGenMap:' + JSON.stringify(map) + '};\n' +
    'function parseRomanGen(s){const m={i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8,ix:9};' +
    'const k=String(s).toLowerCase().replace(/^generation-/,"");return m[k]||(+s||0)}\n' +
    lines.slice(gaigStart, gaigEnd + 1).join('\n') + '\n;getAbilityIntroGen'
  );
}

const fromCache = introGenWith({ bulletproof: { introGen: 6 } }, [], {});
check(fromCache('bulletproof') === 6, 'the ability cache supplies an introduction generation', fromCache('bulletproof'));

const fromData = introGenWith({}, [{ name: 'ball-fetch', gen: 'generation-viii' }], {});
check(fromData('ball-fetch') === 8, 'the bulk ability list supplies one too', fromData('ball-fetch'));

const fromMap = introGenWith({}, [], { 'mega-launcher': 6 });
check(fromMap('mega-launcher') === 6, 'and so does the fallback gen map', fromMap('mega-launcher'));

/* Unknown must be 0, not 9. The caller compares against the selected generation, so a confident 9
   would hide every ability whose data has not arrived - turning a slow network into an empty
   search box. Unknown means "do not exclude it", the safe direction for a search. */
check(fromMap('never-heard-of-it') === 0,
  'an ability nothing knows about returns 0, so the search does not hide it',
  fromMap('never-heard-of-it'));

// Both branches must go through the one helper. The bug was that only one could.
const searchSrc = src.slice(src.indexOf('const otherGenItems=[]'), src.indexOf('// Search locations'));
check(/getAbilityIntroGen\(/.test(searchSrc),
  'the exact branch asks the shared helper rather than resolving the generation inline');
check(!/introGenStr/.test(searchSrc),
  'and the inline copy it used to keep is gone', 'introGenStr is still present in the search');

const fuzzySrc = src.slice(src.indexOf('const fuzzyPokemon=[]'), src.indexOf("let h='';"));
check(/fuzzyPlace\(a,getAbilityIntroGen/.test(fuzzySrc),
  'the fuzzy ability branch applies the generation rule too');
check(/fuzzyPlace\(m,getMoveIntroGen/.test(fuzzySrc),
  'and so does the fuzzy move branch');
/* Assert how the sets are BUILT, not merely that they are used. Checking for the names alone
   passed against a mutant that reverted the definition to `items` only and kept the names - the
   dedup was back to the in-generation bucket, Bullet Punch was listed twice again, and the suite
   stayed green. `items` is not the set of things already handled; `otherGenItems` holds everything
   the exact pass moved aside for being from a later generation, and that is precisely the set the
   fuzzy pass must not re-add. */
['placedAbility', 'placedMove'].forEach(name => {
  const def = (fuzzySrc.match(new RegExp('const ' + name + '=[^;]+;')) || [''])[0];
  check(/items\.concat\(/.test(def) && /otherGenItems/.test(def),
    name + ' is built from items AND the out-of-generation bucket', def || '(no definition found)');
});
check(!/exactMoveNames|exactAbilityNames/.test(fuzzySrc),
  'and the items-only sets that let Bullet Punch through twice are gone', fuzzySrc.slice(0, 160));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
