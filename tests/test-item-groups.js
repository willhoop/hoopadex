/* HoopaDex — the Items tab's held-item groups say true things
 * Run: node tests/test-item-groups.js
 *
 * Reported from the live site: "lets do a little better with the sorting of held items, like maybe the
 * seeds get their own, the weather extenders, the consumables". PokeAPI's "held-items" category is one
 * bucket of 72 — Life Orb beside Heat Rock beside Electric Seed — and it filed Fairy Feather there too,
 * which is a type booster and belongs with Charcoal.
 *
 * HELD_ITEM_GROUP in the app splits it into eight groups, and moves four items out to Type Enhancement
 * and Species-Specific. The NAMES are presentation and are written by
 * hand. What each group CLAIMS is checked here against facts read off Showdown's item code by
 * build/generate-champions.js (data/showdown-champions-extract.json, `itemTraits`):
 *
 *   Terrain Seeds   exactly the items that react to a terrain change
 *   Extenders       exactly the items a weather, terrain, screen or trap checks in its durationCallback
 *   Single-Use      every item the engine consumes — and every consumed item is here or a Seed
 *   (moved out)     every non-consumed type booster is in Type Enhancement, not a held group
 *
 * "Exactly" runs both ways on purpose. A group that lets in an item that does not belong reads as
 * plausible; a group that is missing one reads as complete. Either way the heading would be a small lie.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const TRAITS = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'showdown-champions-extract.json'), 'utf8')).itemTraits;
const HELD = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'pokeapi-held-items.json'), 'utf8')).items;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}

const a = src.indexOf('const HELD_ITEM_GROUP=');
const b = src.indexOf('})();', a) + 5;
check(a >= 0, 'HELD_ITEM_GROUP is in the app');
const G = (0, eval)(src.slice(a, b) + ';HELD_ITEM_GROUP');
const inGroup = g => Object.keys(G).filter(i => G[i] === g).sort();
const has = (item, trait) => !!(TRAITS[item.replace(/-/g, '')] && TRAITS[item.replace(/-/g, '')][trait]);

// --- nothing falls through --------------------------------------------------------------------
/* An item PokeAPI adds to "held-items" that nobody has placed would still render, under the old
   catch-all heading. That is safe but it is the thing this change exists to end, so it fails here. */
const unmapped = HELD.filter(i => !G[i]);
check(HELD.length === 72, 'the PokeAPI snapshot holds the 72 held items it was taken with', HELD.length);
check(unmapped.length === 0, 'every PokeAPI held item is placed in a group', unmapped.join(', '));
/* An item listed under TWO groups resolves silently to whichever comes later in the table. Mutation
   M134 found this: it added Binding Band to Extenders, the later "Other Held Items" entry won, nothing
   changed on screen, and every assertion stayed green. So the raw lists are checked for repeats. */
const rawG = (0, eval)('(' + src.slice(src.indexOf('const g={', a) + 'const g='.length, src.indexOf('};', src.indexOf('const g={', a)) + 1) + ')');
const seen = {}, dupes = [];
Object.keys(rawG).forEach(grp => rawG[grp].forEach(i => { if (seen[i]) dupes.push(i + ' in ' + seen[i] + ' and ' + grp); seen[i] = grp; }));
check(dupes.length === 0, 'no item is listed in two groups — the later one would win without a word', dupes.join('; '));
const stale = Object.keys(G).filter(i => !HELD.includes(i));
check(stale.length === 0, 'and no group names an item PokeAPI does not file as held', stale.join(', '));

// --- Terrain Seeds ----------------------------------------------------------------------------
const seeds = inGroup('Terrain Seeds');
check(seeds.join() === 'electric-seed,grassy-seed,misty-seed,psychic-seed', 'Terrain Seeds are the four Seeds', seeds.join());
check(seeds.every(i => has(i, 'terrainSeed')), 'each of them reacts to a terrain change in its own code');
check(HELD.filter(i => has(i, 'terrainSeed')).every(i => G[i] === 'Terrain Seeds'),
  'and nothing else that reacts to terrain is filed elsewhere');

// --- Extenders --------------------------------------------------------------------------------
/* Heat Rock's own code is nothing but a fling entry; what it does lives in Sunny Day's
   durationCallback. That is where the generator looks, and why this group is checkable at all. */
const ext = inGroup('Extenders');
check(ext.every(i => has(i, 'extends')), 'every Extender is named in a durationCallback', ext.filter(i => !has(i, 'extends')));
check(HELD.filter(i => has(i, 'extends')).every(i => G[i] === 'Extenders'),
  'and every item a durationCallback names is an Extender', HELD.filter(i => has(i, 'extends') && G[i] !== 'Extenders'));
['damp-rock', 'heat-rock', 'icy-rock', 'smooth-rock', 'light-clay', 'terrain-extender'].forEach(i =>
  check(G[i] === 'Extenders', i + ' is an Extender'));
/* Binding Band is in partiallytrapped's code, but in onStart, not durationCallback: it makes trapping
   hurt more, it does not make it last longer. An earlier version of the generator's pattern overran
   the end of the callback and reported it as an extender. Grip Claw is the one that extends trapping. */
check(G['binding-band'] !== 'Extenders' && !has('binding-band', 'extends'),
  'Binding Band is NOT an Extender — it strengthens trapping, Grip Claw lengthens it');
check(G['grip-claw'] === 'Extenders', 'Grip Claw is');

// --- Single-Use -------------------------------------------------------------------------------
/* Two single-use items are consumed OUTSIDE their own code, so the item-code signal cannot see them.
   Each is named here with where the consumption actually happens, checked on 2026-09-19. */
const CONSUMED_ELSEWHERE = {
  'air-balloon': "pops by clearing the item directly (target.item = '') rather than useItem()",
  'blunder-policy': 'consumed by sim/battle-actions.ts on a miss, not by its item entry',
};
const single = inGroup('Single-Use');
const unexplained = single.filter(i => !has(i, 'usesUp') && !CONSUMED_ELSEWHERE[i]);
check(unexplained.length === 0, 'every Single-Use item is consumed — by its own code or at a named place', unexplained.join(', '));
check(Object.keys(CONSUMED_ELSEWHERE).every(i => G[i] === 'Single-Use'),
  'and the two consumed elsewhere are still in the group');
const loose = HELD.filter(i => has(i, 'usesUp') && !['Single-Use', 'Terrain Seeds'].includes(G[i]));
check(loose.length === 0, 'every item the engine consumes is Single-Use (or a Seed, which is also consumed)', loose.join(', '));
['focus-sash', 'white-herb', 'mental-herb', 'red-card', 'eject-button', 'weakness-policy'].forEach(i =>
  check(G[i] === 'Single-Use', i + ' is Single-Use'));

// --- things that were never general held items ------------------------------------------------
/* PokeAPI files Fairy Feather under held-items. It raises Fairy moves by 20%, exactly as Charcoal does
   Fire moves, and Charcoal is under Type Enhancement. */
const boosters = HELD.filter(i => has(i, 'typeBoost') && !has(i, 'usesUp'));
check(boosters.every(i => ['Type Enhancement', 'Species-Specific'].includes(G[i])),
  'every type booster in the held-items list is moved to Type Enhancement', boosters.filter(i => G[i] !== 'Type Enhancement'));
check(G['fairy-feather'] === 'Type Enhancement', 'Fairy Feather sits with the other type boosters');
check(['wellspring-mask', 'hearthflame-mask', 'cornerstone-mask'].every(i => G[i] === 'Species-Specific'),
  "Ogerpon's masks are Species-Specific — only Ogerpon can use them");

// --- the tab uses it --------------------------------------------------------------------------
check(/const cat=\(catId===12&&HELD_ITEM_GROUP\[item\.name\]\)\|\|catName;/.test(src),
  'the Items tab files each held item under its group');
const order = (src.match(/const categoryOrder=\[([\s\S]*?)\];/) || [])[1] || '';
const groups = [...new Set(Object.values(G))];
check(groups.every(g => order.includes("'" + g + "'")), 'every group has a place in the display order',
  groups.filter(g => !order.includes("'" + g + "'")));
/* The Champions view the report came from: Regulation M-C's 35 held items, which used to be one list. */
const itemsMC = new Set(((src.match(/const CHAMPIONS_ITEMS_BY_REG=(\{[^\n]*\});/) || [])[1] ? JSON.parse(src.match(/const CHAMPIONS_ITEMS_BY_REG=(\{[^\n]*\});/)[1])['reg-mc'] : '').split(','));
const heldMC = HELD.filter(i => itemsMC.has(i.replace(/-/g, '')));
const used = new Set(heldMC.map(i => G[i]));
check(heldMC.length === 35, 'Regulation M-C has 35 items from the old "held items" bucket', heldMC.length);
check(used.size >= 8, 'and they now fall into ' + used.size + ' groups instead of one', [...used].join(', '));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
