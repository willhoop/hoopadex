/* HoopaDex — the evolution chain has to hold two different shapes
 * Run: node tests/test-evo-layout.js
 *
 * Reported from the live site: the chain "just seems randomly placed and doesn't use the space
 * under the stats well", and then the hard case — "its tricky because look at eevee".
 *
 * It is tricky, because one box has to hold two shapes that are not alike:
 *
 *   Charizard   a linear chain: three cards in a row
 *   Eevee       one card and EIGHT branches
 *
 * Measured on the live build before the fix, in the half-width column beside Defensive Matchups:
 *
 *   Eevee       branch column 242px wide x 1,115px TALL, with the entire left half of the page
 *               empty beside it
 *   Tyrogue     397px tall for three branches
 *   Charizard   the row wrapped onto two lines, because a fixed 112px arrow plus three 104px cards
 *               did not fit 545px
 *
 * After: Eevee 397px (a 3x3 grid), Tyrogue 128px (three across, one row), Charizard 128px and one
 * row. The column takes the full width only when it has three or more branches to justify it.
 *
 * WHY THIS SUITE IS STRUCTURAL. Layout is not testable in node — section 5.3 of the white paper
 * says so plainly and that has not changed. What IS testable is the set of rules that made the
 * difference, and every one of them is a thing that looks harmless to remove:
 *
 *   - an inline `flex:1` on the column beats `flex-basis:100%` in the stylesheet, so the widening
 *     class silently does nothing. This happened; the class was applied and the column did not move.
 *   - the branch wrapper must FILL the column, or the grid inside sizes to one column of content
 *     and auto-fill has nothing to fill. This also happened: the column widened to 1,106px and
 *     Eevee still rendered as a single 1,068px stack.
 *   - the arrow is fixed-width inside a branch grid (so sprites line up across rows) and NOT fixed
 *     in a linear row (where forcing it wrapped Charizard).
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

function rule(selector) {
  const i = src.indexOf('\n' + selector + '{');
  if (i < 0) return null;
  return src.slice(i + selector.length + 2, src.indexOf('}', i));
}

// --- the column widens, and can actually widen -------------------------------------------------
check(/class="dx-evo-col"/.test(src), 'the evolution column is addressable by class');
/* The bug that cost a round trip: an inline flex shorthand sets flex-basis:0 and outranks any
   stylesheet rule, so evo-wide applied and nothing moved. The column must carry no inline flex. */
const colMarkup = (src.match(/<div class="dx-evo-col"[^>]*>/) || [''])[0];
check(!/style="[^"]*flex:/.test(colMarkup),
  'and carries no inline flex, which would outrank the widening class', colMarkup);
check(/\.dx-evo-col\{[^}]*flex:/.test(src), 'its flex lives in the stylesheet instead');
check(/\.dx-evo-col\.evo-wide\{[^}]*flex-basis:100%/.test(src),
  'evo-wide gives it the full row');
check(/classList\.toggle\('evo-wide'/.test(src), 'and something actually toggles that class');
check(/querySelectorAll\('\.evo-branch-row'\)\.length>=3/.test(src),
  'on three or more branches — two still fit the narrow column', 'threshold missing');

// --- the branches are a grid, and the grid can fill --------------------------------------------
const branch = rule('.evo-branch');
check(!!branch && /display:grid/.test(branch), 'the branches are a grid, not a single stack', branch);
check(!!branch && /repeat\(auto-fill,minmax\(/.test(branch),
  'sized by auto-fill, so one rule serves the narrow column and the full-width row', branch);
/* Eevee's stack survived the column widening because this wrapper sized to its content. A grid
   whose parent hugs its content has nothing to expand into. */
const wrap = rule('.evo-branch-wrap');
check(!!wrap && /width:100%/.test(wrap),
  'the branch wrapper fills the column, or auto-fill has nothing to fill', wrap);
check(/class="evo-branch-wrap"/.test(src), 'and the renderer emits that class', 'wrapper class missing');
check(!/let html='<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">'/.test(src),
  'the old inline-styled wrapper is gone, not left beside the class');

// --- the arrow is fixed-width ONLY where a column has to line up --------------------------------
const arrow = rule('.evo-arrow');
check(!!arrow && !/^[^}]*[^-]width:\d+px/.test(arrow),
  'a linear-chain arrow is not forced to a fixed width — that wrapped Charizard onto two rows', arrow);
check(/\.evo-branch-row \.evo-arrow\{[^}]*width:112px/.test(src),
  'but inside a branch grid it is fixed, so every sprite in a column lines up');
check(!!arrow && /padding-top:/.test(arrow),
  'and the label grows downward from a common top edge rather than shoving the arrow around', arrow);

// --- nothing is allowed to break the page width ------------------------------------------------
/* Ralts nests a branch inside a branch, so one row is card-arrow-card-arrow-card and there is a
   width no phone will fit. It has to scroll inside its own box rather than widen the document. */
check(/#evo-container\{[^}]*overflow-x:auto/.test(src),
  'a chain too wide to fit scrolls in its own container instead of stretching the page');
check(/@media \(max-width:640px\)\{[\s\S]{0,400}?\.evo-branch\{grid-template-columns:1fr\}/.test(src),
  'narrow screens drop to one branch per row');
check(/@media \(max-width:640px\)\{[\s\S]{0,600}?\.evo-branch-row \.evo-arrow\{width:72px/.test(src),
  'with a shorter arrow, because a 112px one does not fit 322px of phone');

// --- and the chain still renders both shapes ----------------------------------------------------
check(/function renderEvoChain\(/.test(src), 'the chain renderer is present');
check(/if\(!hasBranch\(tree\)\)\{/.test(src), 'a linear chain still takes the simple horizontal path');
check(/function renderBranchFrom\(/.test(src), 'and a branching one still recurses');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
