/* HoopaDex — one pill, solid, with a derived ink
 * Run: node tests/test-pill-system.js
 *
 * Reported from the live site, twice: "we are getting a little loosey goosey with the colors of the
 * pills and whether they are opaque or not please standardize", then "lets standardize the colors
 * for each type and not have the slightly transparent pills, only solid please".
 *
 * Both were fair. There were five treatments in play for the same kind of object:
 *
 *   .type-badge      a 15%-opacity wash of the type colour, type colour as text
 *   .mv-tag          outlined, transparent, neutral grey
 *   .mv-tag-boost    outlined, transparent, blue
 *   .mv-spread       a 22%-opacity purple fill
 *   .mv-spread-ally  a 20%-opacity red fill
 *   .hidden-pill     solid
 *
 * Translucent fills also meant the same pill was a different shade depending on what sat behind it,
 * so "the Fire pill" had no single colour at all.
 *
 * THE RULE, and this suite exists to keep it: a pill is a SOLID fill with an ink that contrasts
 * against that fill. Colour carries meaning; fill-versus-outline and opacity carry nothing.
 *
 * The ink is DERIVED, not chosen. The eighteen type colours run from Electric #F8D030 to Dark
 * #705848 and no single ink works on both, so tcInk() takes the WCAG relative luminance of the fill
 * and picks whichever of white or near-black contrasts better. That is what makes "solid" safe:
 * nobody has to remember to pick a text colour when a colour changes, and nobody can pick a wrong
 * one. Measured over all eighteen types the worst case is 5.62:1, which clears WCAG AA.
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

// --- the real helpers, sliced out ---------------------------------------------------------------
const tcLine = lines.find(l => l.startsWith('const TC='));
const a = lines.findIndex(l => l.startsWith('const TC_INK='));
const b = lines.findIndex(l => l.startsWith('function typeBadge('));
if (!tcLine || a < 0 || b < 0) throw new Error('could not locate the colour helpers');
const app = (0, eval)(tcLine + '\n' + lines.slice(a, b).join('\n') + '\n;({TC,tcInk,tcStyle})');
const { TC, tcInk, tcStyle } = app;

// --- the ink is derived, and it is right ---------------------------------------------------------
function luminance(hex) {
  const h = hex.replace('#', '');
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(parseInt(h.slice(0, 2), 16))
       + 0.7152 * lin(parseInt(h.slice(2, 4), 16))
       + 0.0722 * lin(parseInt(h.slice(4, 6), 16));
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

check(Object.keys(TC).length === 18, 'all eighteen types have a colour', Object.keys(TC).length);

let worst = Infinity, worstType = null;
Object.keys(TC).forEach(t => {
  const style = tcStyle(t);
  const fill = (style.match(/--tc:(#[0-9a-fA-F]{6})/) || [])[1];
  const ink = (style.match(/--tc-ink:(#[0-9a-fA-F]{6})/) || [])[1];
  check(fill === TC[t], t + ' fills with its own type colour', fill + ' vs ' + TC[t]);
  check(!!ink, t + ' is given an ink');
  if (!fill || !ink) return;
  const c = contrast(fill, ink);
  if (c < worst) { worst = c; worstType = t; }
  /* AA for normal text. These are small-caps 9-11px labels, so the large-text 3:1 allowance does
     not apply and 4.5 is the bar that matters. */
  check(c >= 4.5, t + ' clears WCAG AA on its solid fill', t + ' ' + fill + '/' + ink + ' = ' + c.toFixed(2));
  /* The ink must be the BETTER of the two options, not merely an adequate one — otherwise a future
     colour change could keep passing 4.5 while the derivation quietly stopped choosing. */
  const other = ink === '#ffffff' ? '#12121a' : '#ffffff';
  check(c >= contrast(fill, other),
    'and it is the better of white and near-black, not just an acceptable one',
    t + ': ' + ink + ' ' + c.toFixed(2) + ' vs ' + other + ' ' + contrast(fill, other).toFixed(2));
});
console.log('     worst type contrast: ' + worst.toFixed(2) + ':1 (' + worstType + ')');
check(worst >= 4.5, 'every type is legible solid — this is what makes "solid" safe', worst.toFixed(2));

// --- tcStyle takes a name or a colour ------------------------------------------------------------
check(/--tc:#F08030/.test(tcStyle('fire')), 'a type name resolves to its colour', tcStyle('fire'));
check(/--tc:#F08030/.test(tcStyle('#F08030')), 'and a hex is passed through, for the callers that hold one');
check(/--tc:#888888/.test(tcStyle('not-a-type')), 'an unknown type falls back rather than throwing', tcStyle('not-a-type'));
check(/--tc:#888888/.test(tcStyle(null)) && /--tc:#888888/.test(tcStyle(undefined)),
  'and null does not throw');
check(tcInk('#F8D030') === '#12121a', 'Electric, the palest type, takes dark ink');
check(tcInk('#705848') === '#ffffff', 'Dark, the darkest, takes white ink');

// --- NOTHING is translucent -----------------------------------------------------------------------
/* The assertion that answers the actual complaint. A pill rule must not mix its fill with
   `transparent`, because then it has no colour of its own — it has the colour of whatever it
   happens to be sitting on. */
const PILL_RULES = ['.type-badge{', '.mv-tag{', '.mv-tag.mv-tag-boost{', '.mv-tag.mv-tag-block{',
                    '.abil-tag{', '.ap-form-pill{', '.hidden-pill{', '.tc-pill{'];
PILL_RULES.forEach(sel => {
  const i = src.indexOf('\n' + sel);
  check(i >= 0, 'the rule for ' + sel.replace('{', '') + ' is present');
  if (i < 0) return;
  const body = src.slice(i + 1, src.indexOf('}', i));
  const bg = (body.match(/background:([^;}]*)/) || [])[1] || '';
  check(!/transparent/.test(bg) && !/rgba\([^)]*0?\.\d+\)/.test(bg),
    sel.replace('{', '') + ' fills solid, with no transparency', bg.trim() || '(no background)');
});

/* The washes are gone by name, so nobody reintroduces one by copying an old rule. */
check(!/background:color-mix\(in srgb,var\(--tc\) \d+%,transparent\)/.test(src),
  'the type-badge opacity wash is gone');
check(!/\.mv-spread\{/.test(src), 'and the one-off spread pill class is gone — there is one pill now');
check(!/opacity:\.82/.test(src), 'the type-chart pills no longer lean on an opacity trick');

// --- both themes and colourblind mode define the inks ---------------------------------------------
/* A missing token is invisible: the pill renders with an inherited colour that happens to look
   plausible in one theme. All four blocks must carry all three. */
[[':root{', 'dark'], ['body.light{', 'light'], ['body.cvd{', 'colourblind dark'],
 ['body.light.cvd{', 'colourblind light']].forEach(([sel, name]) => {
  const i = src.indexOf(sel);
  check(i >= 0, name + ' palette block exists');
  if (i < 0) return;
  const body = src.slice(i, src.indexOf('}', i));
  check(/--pill-up-ink:/.test(body) && /--pill-dn-ink:/.test(body),
    name + ' defines an ink for both accent fills', body.slice(0, 60));
});
/* Neutral only needs defining once per theme, not per colourblind variant — colourblind mode
   changes the accents, not the neutral surface. */
[':root{', 'body.light{'].forEach(sel => {
  const body = src.slice(src.indexOf(sel), src.indexOf('}', src.indexOf(sel)));
  check(/--pill-neut:/.test(body) && /--pill-neut-ink:/.test(body),
    sel.replace('{', '') + ' defines the neutral pill surface and its ink');
});

// --- the fills reuse the chart tokens, so colourblind mode is free --------------------------------
check(/\.mv-tag\.mv-tag-boost\{background:var\(--eff-up-solid\)/.test(src),
  'the boost pill reuses the type chart\'s solid token, so CVD recolours it for free');
check(/\.mv-tag\.mv-tag-block\{background:var\(--eff-dn-solid\)/.test(src),
  'and so does the block pill');

// --- every type pill goes through tcStyle ---------------------------------------------------------
/* One writer for --tc and --tc-ink. If a call site sets the fill by hand it will not set the ink,
   and the pill inherits an ink chosen for a different colour — which is exactly the bug that made
   Electric render white-on-yellow. */
const handWritten = (src.match(/--tc:'\+/g) || []).length;
check(handWritten === 1, 'only tcStyle writes --tc — every call site goes through it',
  handWritten + ' sites (1 expected: the body of tcStyle itself)');
check(!/class="tc-pill" style="background:/.test(src),
  'the type-chart pills take their colour through tcStyle too');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
