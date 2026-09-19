/* HoopaDex — the Move Priority table
 * Run: node tests/test-priority.js
 *
 * Reported from the live site: "some of the text overlaps here, make the moves clickable or a
 * hoverable description". Fixing that meant checking every move on the page against PokeAPI, and 11
 * of the 56 were in the wrong bracket for the current generation (see build/generate-priority.js for
 * the list). The table was hand-typed with one value per move for all nine generations.
 *
 * It is now PRIORITY_MOVES, generated from Showdown's per-generation move files. Every current-
 * generation value was also checked against PokeAPI when it was generated: 59 of 59 agreed. This
 * suite renders the real table with the app's own function and checks what a player would read.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}

const P = JSON.parse((src.match(/const PRIORITY_MOVES=(\[.*\]);/) || [])[1] || '[]');
const row = slug => P.find(r => r[0] === slug);
const at = (slug, gen) => { const r = row(slug); return r ? r[3][gen - 1] : undefined; };
check(P.length >= 55, 'the table is generated and present (' + P.length + ' moves)', P.length);
check(/\/\*BEGIN-PRIORITY-DERIVED\*\/[\s\S]*\/\*END-PRIORITY-DERIVED\*\//.test(src) && !/const PRIORITY_DATA=/.test(src),
  'between generator markers, and the hand-typed table is gone');

// --- the eleven that were wrong ----------------------------------------------------------------
['kings-shield', 'spiky-shield', 'baneful-bunker'].forEach(m => check(at(m, 9) === 4, m + ' is +4, not +3'));
check(at('max-guard', 8) === 4 && at('max-guard', 9) === null, 'Max Guard is +4, and only in Generation VIII');
check(at('counter', 9) === -5 && at('mirror-coat', 9) === -5, 'Counter and Mirror Coat are -5, not -6');
check(at('magic-room', 5) === -7 && at('magic-room', 6) === 0 && at('wonder-room', 6) === 0,
  'Magic Room and Wonder Room were -7 in Generation V only');
check(at('trick-room', 9) === -7, 'Trick Room is still -7');
check(!row('mat-block'), 'Mat Block is gone: its priority is 0; "first turn only" is a different rule');
check(at('zippy-zap', 9) === 2 && !P.some(r => r[0] === 'zip-zap'), 'Zippy Zap, spelt correctly, is +2');
check(at('grassy-glide', 9) === 0 && row('grassy-glide')[5] === '+1 in Grassy Terrain', 'Grassy Glide is 0, +1 in Grassy Terrain');

// --- priority that changed between generations -------------------------------------------------
check(at('protect', 4) === 3 && at('protect', 5) === 4, 'Protect was +3 until Generation V');
check(at('extreme-speed', 4) === 1 && at('extreme-speed', 5) === 2, 'ExtremeSpeed was +1 until Generation V');
check(at('fake-out', 4) === 1 && at('fake-out', 5) === 3, 'Fake Out was +1 until Generation V');
check(at('follow-me', 5) === 3 && at('follow-me', 6) === 2, 'Follow Me was +3 until Generation VI');
check(at('teleport', 7) === 0 && at('teleport', 8) === -6, 'Teleport became -6 in Generation VIII');
/* The one place Showdown is overridden, with its source in build/generate-priority.js. */
check(at('endure', 3) === 3 && at('endure', 4) === 3 && at('endure', 5) === 4,
  'Endure is +3 in Generations III-IV (Bulbapedia; Showdown lacks the override) and +4 after');
/* Once a move exists it stays in every later generation's list, except Max Guard (Dynamax). */
check(P.filter(r => r[0] !== 'max-guard').every(r => { const f = r[3].findIndex(v => v !== null); return f >= 0 && r[3].slice(f).every(v => v !== null); })
  && at('trick-room', 3) === null && at('trick-room', 4) === -7,
  'a move is absent before the generation it arrived in, and present from then on');

// --- the rendered page ---------------------------------------------------------------------------
const a = src.indexOf('let priorityRendered=false;'), b = src.indexOf('// Filter in the DOM rather than re-rendering');
function render(gen, champ, champMoves) {
  const el = { innerHTML: '' };
  const document = { getElementById: () => el };
  const getDataGenNum = () => gen, isChampionsMode = champ;
  const CHAMPIONS_MOVES = new Set(champMoves || []);
  const TC = new Proxy({}, { get: () => '#888888' });
  const PRIORITY_MOVES = P;
  eval(src.slice(a, b) + '\nrenderPriorityTab();');
  return el.innerHTML;
}
const rowsOf = html => {
  const out = {};
  html.split('<tr class="pri-row">').slice(1).forEach(tr => {
    const n = (tr.match(/<td class="pri-num[^"]*">([+-]?\d+)<\/td>/) || [])[1];
    out[n] = [...tr.matchAll(/data-name="([^"]+)"/g)].map(m => m[1]);
  });
  return out;
};
const g9html = render(9, false);
const g9 = rowsOf(g9html);
check(g9['-5'] && g9['-5'].includes('counter') && g9['-5'].includes('mirror coat'), 'Generation IX shows a -5 row with Counter and Mirror Coat');
check(g9['+4'].includes('kings shield') && !(g9['+3'] || []).includes('kings shield'), 'and King\'s Shield under +4');
check(!Object.values(g9).flat().includes('max guard'), 'and no Max Guard outside Generation VIII');
check(g9['+1'].includes('grassy glide'), 'Grassy Glide sits in the +1 row, where it acts');
check(/Grassy Glide<span class="pri-cond">in Grassy Terrain<\/span>/.test(g9html), 'with its condition beside it');
check(/pri-move pri-wide" data-name="grassy glide"/.test(g9html), 'given two columns, so the note does not fold the name onto two lines');
/* Names come from Showdown, not from the slug: "King's Shield", not "Kings Shield". */
check(/<\/i>King's Shield</.test(g9html) && /<\/i>Baby-Doll Eyes</.test(g9html), 'moves are shown by their proper names');
const g4 = rowsOf(render(4, false));
check(g4['+3'].includes('protect') && g4['+1'].includes('extreme speed'), 'Generation IV shows Protect at +3 and ExtremeSpeed at +1');
check(Object.values(g4).flat().includes('trick room') && !Object.values(g4).flat().includes('baneful bunker'),
  'and only moves that existed in Generation IV');
const order = [...g9html.matchAll(/<td class="pri-num[^"]*">([+-]?\d+)<\/td>/g)].map(m => +m[1]);
check(order.length > 8 && order.every((v, i) => i === 0 || order[i - 1] > v), 'rows run from highest priority to lowest', order);

// Champions: only moves legal in the regulation.
const champ = rowsOf(render(9, true, ['protect', 'fakeout', 'trickroom', 'grassyglide']));
const champAll = Object.values(champ).flat();
check(champAll.includes('protect') && champAll.includes('fake out') && champAll.includes('trick room'), 'Champions shows the priority moves the regulation allows');
check(!champAll.includes('kings shield') && !champAll.includes('helping hand'), 'and none it does not');

// --- the reported defect and the request ---------------------------------------------------------
check(!/pri-desc/.test(g9html) && !/\.pri-desc\{/.test(src), 'no description column is left to run under the moves');
const spans = [...g9html.matchAll(/<span class="pri-move" data-name="[^"]+"([^>]*)>/g)].map(m => m[1]);
check(spans.length > 30 && spans.every(s => /onmouseenter="showMoveTip\(event,'[a-z0-9-]+'\)"/.test(s) && /goToMove\('[a-z0-9-]+'\)/.test(s)),
  'every move shows its description on hover and opens its page on click');
check(/\.pri-move\{[^}]*cursor:pointer/.test(src), 'and looks clickable');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
