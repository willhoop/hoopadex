/* HoopaDex — the Team Builder's offensive coverage table
 * Run: node tests/test-team-coverage.js
 *
 * Reported from the live site with a six-member team (24 moves): "the offensive coverage (like close
 * combat on kommo) isn't reflected against normal types. and thunderclap for water types", "coverage
 * table isn't doing the last 3 mons", and "we need to make sure we are counting offensive moves only,
 * no status ... use the existing database of moves to determine".
 *
 * The cause: the lookup read only the first 12 moves it had not seen, so on a 24-move team the last
 * members' moves were never read and their columns were empty. This suite runs the real
 * loadOffensiveCoverage, sliced from the page, on a 24-move team whose LAST member carries the move
 * that must count, with the move data supplied as the app's move database would.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const MOVES = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'moves-index.json'), 'utf8')).moves;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}
const fnSrc = n => { const i = src.indexOf('async function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const listSrc = src.match(/const NO_TYPE_DAMAGE_MOVES=new Set\(\[[\s\S]*?\]\);/)[0];

/* A move's type and category, exactly as moves-index.json (the app's move database) holds them. */
const ROW = {}; MOVES.forEach(r => { ROW[r[0]] = r; });
const rec = slug => ROW[slug] ? { name: slug, type: ROW[slug][1], damage_class: ROW[slug][2], desc: '' } : null;
/* Effectiveness for the few matchups this team needs (Generation VI+ chart). */
const SE = { fighting: ['normal', 'ice', 'rock', 'dark', 'steel'], electric: ['water', 'flying'], water: ['fire', 'ground', 'rock'],
  ice: ['grass', 'ground', 'flying', 'dragon'], steel: ['ice', 'rock', 'fairy'], dragon: ['dragon'], flying: ['grass', 'fighting', 'bug'] };

function run(team) {
  const out = {};
  const sandbox = 'var moveCache={},_html="";' +
    'var document={getElementById:function(){return {set innerHTML(v){_html=v},get innerHTML(){return _html}}}};' +
    'function loadMoveIndex(){return Promise.resolve(true)}' +
    'function ensureMoveData(s){var r=__rec(s);moveCache[s]=r||{name:s,desc:"Could not load."};return Promise.resolve()}' +
    'function normalizeMoveName(s){return s}function getHPType(){return null}' +
    'function getMoveCatForGen(md){return md.damage_class}function getMoveTypeForGen(md){return md.type}' +
    'function getTypeEffect(a,d){return (__SE[a]||[]).indexOf(d)>=0?2:1}' +
    'function capName(s){return s}function tcStyle(){return ""}var TYPE_ABBR={};function spriteFor(){return ""}function pokeName(s){return s}function hackEsc(s){return String(s)}' +
    listSrc + fnSrc('loadOffensiveCoverage') + ';({run:function(f,t){return loadOffensiveCoverage(f,t,9).then(function(){return _html})}})';
  global.__rec = rec; global.__SE = SE;
  return (0, eval)(sandbox).run(team, ['normal', 'water', 'ground', 'grass', 'fighting']);
}
const mon = (name, moves) => ({ name, id: 1, types: [], smogonSet: { moves } });
/* Six members, four moves each: 24 moves, all different - twice the 12 the old lookup read. */
const team = [
  mon('a', ['Bullet Punch', 'Sucker Punch', 'Bitter Blade', 'Swords Dance']),
  mon('b', ['Bleakwind Storm', 'Bug Buzz', 'Earth Power', 'Nasty Plot']),
  mon('c', ['Behemoth Blade', 'Brave Bird', 'Iron Defense', 'Roost']),
  mon('d', ['Thunderclap', 'Bouncy Bubble', 'Ice Beam', 'Stockpile']),
  mon('e', ['Outrage', 'Seismic Toss', 'Clanging Scales', 'Dragon Dance']),
  mon('f', ['Fake Out', 'Close Combat', 'Nuzzle', 'Volt Switch']),
];
/* A row is labelled with the type's first three letters (TYPE_ABBR is empty here). */
const row = (html, type) => { const m = html.split('<tr').find(r => r.indexOf(type) >= 0 && r.indexOf('tc-pill') >= 0); return m ? (m.match(/<td class="cell[^"]*"/g) || []).map(c => /eff-2/.test(c) ? 'Y' : '.').join('') : ''; };

run(team).then(html => {
  /* Close Combat (fighting, the LAST member's move) is super-effective on Normal. */
  check(row(html, '>nor<') === '.....Y', 'the last member\'s Close Combat covers Normal', row(html, '>nor<'));
  /* Thunderclap (member 4) and Volt Switch / Nuzzle (member 6) are Electric: super-effective on Water. */
  check(row(html, '>wat<') === '...Y.Y', 'Thunderclap and the last member\'s Electric moves cover Water', row(html, '>wat<'));
  /* Member 5 has only Seismic Toss as a Fighting-type attack; it is fixed damage and covers nothing. */
  check(row(html, '>nor<')[4] === '.', 'Seismic Toss does not count: a weakness does not change fixed damage');
  /* Status moves (Swords Dance, Nasty Plot, Iron Defense, Roost, Stockpile, Dragon Dance) cover nothing:
     Grass is covered by Bleakwind Storm (2, Flying), Brave Bird (3) and Ice Beam (4) only. */
  check(row(html, '>gra<') === '.YYY..', 'only damaging moves count; status moves cover nothing', row(html, '>gra<'));
  check(!/Could not read/.test(html), 'every move was read from the move database');

  /* A name the database does not have is named under the table, not silently dropped. */
  return run([mon('x', ['Not A Real Move', 'Close Combat'])]).then(h2 => {
    check(/Could not read:<\/b> Not A Real Move/.test(h2), 'a move that cannot be read is named, not dropped');
    /* A member whose only move is Roost (a Flying-type STATUS move) covers nothing - not Grass. In the
       team above Brave Bird also covers Grass, so a status move counted there changed nothing; mutation
       M206 survived that test, and this one is why it no longer does. */
    return run([mon('y', ['Roost'])]);
  }).then(h3 => {
    check(row(h3, '>gra<') === '.', 'a status move alone covers nothing (Roost does not hit Grass)', row(h3, '>gra<'));
  });
}).then(() => {
  check(!/Math\.min\(uniqueUncached\.length,12\)/.test(src), 'no cap on how many moves are read');
  const listed = (listSrc.match(/'([a-z-]+)'/g) || []).map(x => x.slice(1, -1));
  check(listed.every(m => ROW[m]), 'every fixed-damage move named is a real move in the database', listed.filter(m => !ROW[m]).join(','));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
}).catch(e => { console.log('FAIL  the coverage function threw: ' + e.stack); process.exit(1); });
