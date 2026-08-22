/* HoopaDex — spread moves, and what hitting two targets costs
 * Run: node tests/test-spread-moves.js
 *
 * Champions is a doubles format. Whether a move hits one Pokémon or both is among the first things
 * that matters about it, and the dex said nothing about it anywhere — not on the move tooltip, not
 * in a learnset, not on the tag row. The damage calculator has a spread toggle, so the *number* was
 * available to anyone who went looking for it; nothing told a reader there was anything to look for.
 *
 * There are two separate facts here and conflating them loses the interesting one:
 *
 *   allAdjacentFoes   both opponents                          61 moves
 *   allAdjacent       both opponents AND YOUR OWN PARTNER     20 moves
 *
 * Earthquake, Surf, Discharge, Bulldoze and Self-Destruct are in the second group. In doubles that
 * is not a footnote, it is a different move — you cannot bring Earthquake to a team that stands
 * next to it. Both groups are "spread"; only one of them hits your own side.
 *
 * WHERE THE NUMBERS COME FROM. The target is read from the bundled @smogon/calc engine, the same
 * engine the damage calculator runs on, so the label cannot disagree with the number the calculator
 * produces. The multiplier was MEASURED against that engine rather than recalled — Singles versus
 * Doubles, same attacker, same defender, same move:
 *
 *     Gen III    Rock Slide 66 -> 34,  Surf 20 -> 10      0.5x
 *     Gen IV     Rock Slide 66 -> 49,  Surf 20 -> 15      0.75x
 *     Gen V-IX   Rock Slide 43 -> 32                      0.75x
 *
 * Double battles did not exist before Generation III, so below that there is no reduction to state.
 * That is why spreadMultForGen returns null rather than 1: "no reduction" and "this format does not
 * exist" are different answers, and a badge that said "×1 damage" in Generation I would be stating
 * a rule about a battle you cannot have.
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
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}

// --- slice the real functions out of the app ----------------------------------------------------
const start = lines.findIndex(l => l.startsWith('const SPREAD_TARGETS='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('// Bordered text tokens'));
check(start >= 0 && end > start, 'the spread helpers were located', start + '..' + end);

/* A stand-in for the engine's move map, shaped the way @smogon/calc shapes it: `target` is present
   ONLY on spread moves, which is why the absence of one is read as single-target. */
const MOVES = {
  rockslide:     { target: 'allAdjacentFoes', category: 'Physical' },
  dazzlinggleam: { target: 'allAdjacentFoes', category: 'Special' },
  earthquake:    { target: 'allAdjacent', category: 'Physical' },
  surf:          { target: 'allAdjacent', category: 'Special' },
  growl:         { target: 'allAdjacentFoes', category: 'Status' },
  flamethrower:  { category: 'Special' },
  protect:       { category: 'Status' },
  perishsong:    { target: 'all', category: 'Status' },
};
let GEN = 9;
const app = (0, eval)(
  'var GEN=9; function getDataGenNum(){return GEN}\n' +
  'var SmogonCalc={}; function calcEnsureMaps(){}\n' +
  'var CalcMaps={gen:{moves:{get:function(id){return (' + JSON.stringify(MOVES) + ')[id]}}}};\n' +
  lines.slice(start, end).join('\n') +
  '\n;({moveSpreadTarget,spreadMultForGen,renderSpreadTag,SPREAD_TARGETS,setGen:function(g){GEN=g}})'
);
const { moveSpreadTarget, spreadMultForGen, renderSpreadTag, setGen } = app;

// --- who a move hits -----------------------------------------------------------------------------
check(moveSpreadTarget('rock-slide').hits === 'both opponents',
  'Rock Slide hits both opponents', JSON.stringify(moveSpreadTarget('rock-slide')));
check(moveSpreadTarget('earthquake').hits === 'both opponents and your partner',
  'and Earthquake hits your own partner too — the fact worth knowing before you bring it',
  JSON.stringify(moveSpreadTarget('earthquake')));
check(moveSpreadTarget('flamethrower') === null,
  'a move with no recorded target is single-target, not unknown');
check(moveSpreadTarget('protect') === null, 'and so is Protect');
/* `all` is Perish Song's target: it reaches everything, but it is not one of the two spread targets
   the damage reduction applies to, and treating it as one would put a ×0.75 on a move with no
   damage. Unknown targets are excluded rather than guessed at. */
check(moveSpreadTarget('perish-song') === null,
  'a target that is not one of the two spread targets is not invented into one',
  JSON.stringify(moveSpreadTarget('perish-song')));
check(moveSpreadTarget('not-a-move') === null, 'an unknown move does not throw');

// --- what it costs -------------------------------------------------------------------------------
check(spreadMultForGen(1) === null && spreadMultForGen(2) === null,
  'there is no reduction before Gen III, because double battles did not exist',
  spreadMultForGen(1) + '/' + spreadMultForGen(2));
check(spreadMultForGen(3) === 0.5, 'Gen III halves a spread move', spreadMultForGen(3));
check(spreadMultForGen(4) === 0.75, 'and Gen IV onward takes three quarters', spreadMultForGen(4));
[5, 6, 7, 8, 9].forEach(g =>
  check(spreadMultForGen(g) === 0.75, 'Gen ' + g + ' is 0.75 as well', spreadMultForGen(g)));

/* A status move hits both opponents and has no damage to reduce. Printing "×0.75 damage" on Growl
   would be a number that does not exist. */
check(moveSpreadTarget('growl').mult === null,
  'a status spread move states who it hits and no multiplier', JSON.stringify(moveSpreadTarget('growl')));
check(moveSpreadTarget('rock-slide').mult === 0.75, 'a damaging one states both');

// --- the multiplier follows the selected generation ----------------------------------------------
setGen(3);
check(moveSpreadTarget('rock-slide').mult === 0.5,
  'the badge re-reads the generation on screen rather than caching Gen IX',
  moveSpreadTarget('rock-slide').mult);
check(/×0\.5 damage/.test(renderSpreadTag('rock-slide')), 'and the hover text says 0.5 in Gen III',
  renderSpreadTag('rock-slide'));
setGen(1);
check(!/damage/.test(renderSpreadTag('rock-slide')),
  'in Gen I it says who the move hits and claims no reduction', renderSpreadTag('rock-slide'));
check(/Spread/.test(renderSpreadTag('rock-slide')), 'but it is still marked as a spread move');
setGen(9);

// --- the badge -----------------------------------------------------------------------------------
const rs = renderSpreadTag('rock-slide'), eq = renderSpreadTag('earthquake');
check(/class="mv-spread"/.test(rs), 'a foes-only spread move gets the plain badge', rs);
check(/mv-spread-ally/.test(eq), 'one that also hits your partner is marked differently', eq);
check(/hits ally/.test(eq), 'and says so in words, not only in colour', eq);
check(/×0\.75 damage when it hits more than one/.test(rs),
  'the hover text states the reduction and the condition on it', rs);
/* "×0.75 damage" without "when it hits more than one" would be wrong: a spread move that happens to
   have only one legal target takes no reduction at all. */
check(/when it hits more than one/.test(eq), 'the condition is on both variants');
check(renderSpreadTag('flamethrower') === '', 'a single-target move renders no badge');

// --- the compact form, for the learnset table ----------------------------------------------------
const eqC = renderSpreadTag('earthquake', true);
check(/mv-spread-ally/.test(eqC), 'the compact badge keeps the ally colour', eqC);
check(!/hits ally/.test(eqC), 'but drops the words, because a table row is already full', eqC);
check(/hits ally|your partner/.test((eqC.match(/title="([^"]*)"/) || [])[1] || ''),
  'the warning survives in the hover text', eqC);

// --- and it is actually rendered where a reader would look ---------------------------------------
/* Three surfaces describe a move. All three must carry this or the fix is decorative. */
check(/renderSpreadTag\(name\)\+/.test(src), 'the move tooltip shows it, next to power and priority');
check((src.match(/renderSpreadTag\(m\.name,true\)/g) || []).length === 2,
  'both learnset row builders show it — the normal rows and the "missed from pre-evolution" rows',
  (src.match(/renderSpreadTag\(m\.name,true\)/g) || []).length);
check(/const spread=renderSpreadTag\(moveName\);/.test(src), 'and the move tag row shows it');
/* Dazzling Gleam has no contact, sound or punch tag at all. If the badge only rode along with an
   existing tag row it would be invisible on exactly the moves that are purely defined by being
   spread. */
check(/if\(!flags\.length\)return spread\?/.test(src),
  'a move with no other tags still shows the spread badge on its own');
/* It must not be pushed through moveDescriptors: that returns Showdown flag keys, is asserted as
   such by tests/test-move-tags.js, and "spread" is a target, not a flag. */
check(!/MOVE_TAG_NOTE\[['"]spread['"]\]/.test(src) && !/spread:\{/.test(src),
  'and it is not smuggled into the derived flag table, where it does not belong');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
