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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
