/* HoopaDex — visualisation palette guard
 * Run: node tests/test-viz-palette.js
 *
 * The type chart and the natures table both encoded their two states as saturated green vs
 * saturated red. Measured with the data-viz palette validator against this app's own surfaces,
 * that pair scored a colour-vision-deficiency separation of ΔE 4.2 (deuteranopia) against a
 * ≥8 target — a FAIL. Roughly 1 in 12 men could not tell "super effective" from "not very
 * effective", or "+10%" from "−10%".
 *
 * They were replaced in 1.99 by the validated diverging pair:
 *   dark   #3987e5 / #e66767  on #151528 → CVD ΔE 19.2, normal 29.0, contrast ≥3:1  ALL PASS
 *   light  #2a78d6 / #e34948  on #f0f0f5 → CVD ΔE 21.6, normal 32.3, contrast ≥3:1  ALL PASS
 *
 * This suite is a guard, not a rendering test: it fails if the retired hexes reappear in those
 * components, if the theme variables go missing from either mode, or if the glyph/arrow fallback
 * that keeps meaning alive without colour is removed.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail || '')); }
}

// --- the retired pair must not come back ---------------------------------------------
// Scoped to the two components that encode a DIVERGING pair. The same greens and reds appear
// elsewhere as single-state indicators (encounter rarity, EV totals, TM status, the Fighting
// type colour, the Physical category label) where there is no pair to confuse, so a
// whole-file ban would be wrong and would fail on legitimate code.
const componentRules = src.split('\n').filter(l =>
  /\.type-table|\.natures-table|\.tc-pill/.test(l)).join('\n');
const RETIRED = ['#2d8a2d', '#b82020', '#2a8a20', '#c03028', '#78C850', '#F85888', '#45456a', '#5a5a7a'];
for (const hex of RETIRED) {
  const hits = [...componentRules.matchAll(new RegExp(hex, 'gi'))].length;
  check(hits === 0, `retired colour ${hex} is gone from the chart/natures rules`, `${hits} occurrence(s) remain`);
}
// The rules that ENCODE effectiveness or stat direction must come from variables. Chrome in the
// same components (hover outline, header background, the corner label) may stay literal — it
// carries no meaning, so it cannot mislead.
const encodingRules = componentRules.split('\n').filter(l => /\.eff-|\.stat-up|\.stat-down/.test(l));
const hardCoded = encodingRules.filter(l => /:\s*#[0-9a-f]{3,6}/i.test(l));
check(encodingRules.length >= 5, 'found the encoding rules to check', `${encodingRules.length} found`);
check(hardCoded.length === 0, 'every encoding colour comes from a theme variable',
  hardCoded.slice(0, 3).join(' | '));

// --- the validated variables exist in BOTH themes -------------------------------------
const rootBlock  = src.slice(src.indexOf(':root{'), src.indexOf(':root{') + 400);
const lightBlock = src.slice(src.indexOf('body.light{'), src.indexOf('body.light{') + 400);
for (const [name, block, want] of [['dark', rootBlock, '#3987e5'], ['light', lightBlock, '#2a78d6']]) {
  check(block.includes('--eff-up:' + want), `${name} theme defines --eff-up as ${want}`, block.slice(0, 80));
  check(/--eff-dn:#[0-9a-f]{6}/i.test(block), `${name} theme defines --eff-dn`, '');
  check(/--eff-zero:#[0-9a-f]{6}/i.test(block), `${name} theme defines --eff-zero`, '');
}

// --- colour must never be the only encoding -------------------------------------------
// Type chart: every non-neutral state carries a glyph.
check(/cls='eff-2';tx='×2'/.test(src), 'type chart labels ×2 super effective', '');
check(/cls='eff-half';tx='×½'/.test(src), 'type chart labels ×½ not very effective', '');
check(/cls='eff-0';tx='×0'/.test(src), 'type chart labels ×0 immune', '');
// Natures: direction arrows survive greyscale and CVD.
check(/class="dir">&#x25B2;/.test(src), 'natures raise carries an up arrow', '');
check(/class="dir">&#x25BC;/.test(src), 'natures lower carries a down arrow', '');

// --- the components consume the variables rather than literals -------------------------
check(/\.type-table td\.cell\.eff-2\{background:color-mix\(in srgb,var\(--eff-up\)/.test(src),
  'type chart ×2 cell is built from --eff-up', '');
check(/\.type-table td\.cell\.eff-half\{background:color-mix\(in srgb,var\(--eff-dn\)/.test(src),
  'type chart ×½ cell is built from --eff-dn', '');
check(/\.natures-table \.stat-up\{color:var\(--eff-up\)/.test(src), 'natures raise is built from --eff-up', '');
check(/\.natures-table \.stat-down\{color:var\(--eff-dn\)/.test(src), 'natures lower is built from --eff-dn', '');

// --- neutral cells must stay recessive -------------------------------------------------
check(/\.type-table td\.cell\{[^}]*background:transparent/.test(src),
  'neutral (×1) type chart cells carry no fill', '');

// --- the crosshair exists --------------------------------------------------------------
check(/function tcCross\(/.test(src), 'type chart has a row/column crosshair', '');
check(/tcCross\(this\)/.test(src), 'cells are wired to the crosshair', '');

// --- PokéAPI encounter-data block list: one declaration, and Sword/Shield not on it ----
// This list existed twice — in loadLocations() and in renderEVSpots() — and the copies drifted:
// the Locations tab got fixed in 1.99 while EV Training carried on hiding Galar. Assert there is
// exactly one declaration and that both readers share it.
const decls = [...src.matchAll(/const\s+NO_ENCOUNTER_DATA\s*=/g)].length;
check(decls === 1, 'the no-encounter-data list is declared exactly once', `${decls} declaration(s)`);
check(!/UNSUPPORTED_VERSIONS/.test(src), 'the old duplicated constant is gone', '');
const listMatch = src.match(/const NO_ENCOUNTER_DATA=\[([^\]]*)\]/);
check(!!listMatch, 'the list is readable', '');
if (listMatch) {
  const list = listMatch[1];
  check(!/'sword'/.test(list), 'Sword is not blocked — PokéAPI serves Galar encounters', list);
  check(!/'shield'/.test(list), 'Shield is not blocked — PokéAPI serves Galar encounters', list);
  for (const g of ['scarlet', 'violet', 'legends-arceus']) {
    check(list.includes(`'${g}'`), `${g} is still blocked — PokéAPI genuinely has no data`, list);
  }
}
const users = [...src.matchAll(/NO_ENCOUNTER_DATA\.includes/g)].length;
check(users === 2, 'both the Locations tab and the EV spots read the same list', `${users} use(s)`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
