/* HoopaDex — generation-aware table audit tests
 * Run: node tests/test-generation-tables.js
 *
 * Backlog item 16 named four tables behind the generation-accuracy claim that had never been
 * checked: the C2 and CM type charts, ITEM_INTRO_GEN, EVO_OVERRIDES and REGIONAL. Three earlier
 * tables had each been found wrong the moment someone looked — PAST_STATS was 10 of 43 correct.
 *
 * Audited 2026-08-03:
 *   - CM, C2 and C1 type charts: 838 cells, all three match Showdown exactly. Nothing to fix.
 *   - ITEM_INTRO_GEN: 67 of 325 entries wrong, 20.6%, confirmed against two independent sources
 *     (Showdown's data/items.ts and PokéAPI's game_indices). Now generated.
 *   - EVO_OVERRIDES and REGIONAL: display labels, not generation data. No wrongness risk.
 *
 * This suite pins the results that a future edit could quietly undo. It does not re-download
 * anything; the charts are checked against the invariants the audit established, and the item table
 * against the cached derivation in data/item-intro-gens.json.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : JSON.stringify(d))); }
}

const grab = name => {
  const m = src.match(new RegExp('^const ' + name + '=(\\{.*?\\});$', 'm'));
  if (!m) throw new Error('could not locate ' + name);
  return eval('(' + m[1] + ')');
};
const CM = grab('CM'), C2 = grab('C2'), C1 = grab('C1');
const ITEMS = grab('ITEM_INTRO_GEN');

// ---- type charts ------------------------------------------------------------------------
// Spot-checks chosen to be the cells that DEFINE each era, so a wholesale replacement of a chart
// cannot pass by accident.
const eff = (c, a, d) => (c[a] || {})[d] === undefined ? 1 : (c[a] || {})[d];

check(eff(CM, 'dragon', 'fairy') === 0, 'CM: Dragon cannot touch Fairy', eff(CM, 'dragon', 'fairy'));
check(eff(CM, 'fighting', 'fairy') === 0.5, 'CM: Fighting is resisted by Fairy');
check(eff(CM, 'steel', 'ghost') === 1, 'CM: Steel no longer resists Ghost (changed in Gen VI)');
check(eff(CM, 'steel', 'dark') === 1, 'CM: Steel no longer resists Dark (changed in Gen VI)');
check(eff(CM, 'ghost', 'steel') === 1, 'CM: Ghost is neutral into Steel (changed in Gen VI)');

// Written attacker-first, like the table itself. The pre-Gen VI fact is that a STEEL DEFENDER
// resisted Ghost and Dark attacks — so it is ghost->steel and dark->steel, not the reverse. Getting
// this backwards is the easiest mistake to make about this chart, which is why it is spelled out.
check(eff(C2, 'ghost', 'steel') === 0.5, 'C2: Ghost was resisted by a Steel defender before Gen VI');
check(eff(C2, 'dark', 'steel') === 0.5, 'C2: Dark was resisted by a Steel defender before Gen VI');
check(eff(CM, 'dark', 'steel') === 1, 'CM: Steel stopped resisting Dark in Gen VI');
check(C2.fairy === undefined, 'C2: Fairy does not exist as an attacking type');
Object.keys(C2).forEach(a => check(C2[a].fairy === undefined,
  'C2: nothing has a Fairy matchup — ' + a, C2[a]));

check(eff(C1, 'psychic', 'ghost') === 1, 'C1: Psychic is neutral into Ghost — the Gen I quirk');
check(eff(C1, 'ghost', 'psychic') === 0, 'C1: Ghost cannot touch Psychic in Gen I');
check(eff(C1, 'bug', 'poison') === 2, 'C1: Bug is super effective on Poison in Gen I');
check(eff(C1, 'poison', 'bug') === 2, 'C1: Poison is super effective on Bug in Gen I');
// Same trap: the Gen I quirk is that a FIRE DEFENDER did not resist Ice attacks.
check(eff(C1, 'ice', 'fire') === 1, 'C1: a Fire defender does not resist Ice in Gen I');
check(eff(C2, 'ice', 'fire') === 0.5, 'C2: from Gen II onward a Fire defender does resist Ice');
check(C1.dark === undefined && C1.steel === undefined, 'C1: neither Dark nor Steel exists');

// ---- ITEM_INTRO_GEN ---------------------------------------------------------------------
const CACHE = path.join(ROOT, 'data', 'item-intro-gens.json');
check(fs.existsSync(CACHE), 'the derived item generations are committed alongside the app');
if (fs.existsSync(CACHE)) {
  const derived = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  const mismatched = Object.keys(ITEMS).filter(k => derived.gens[k] && derived.gens[k] !== ITEMS[k]);
  check(mismatched.length === 0,
    'ITEM_INTRO_GEN still matches the derivation — regenerate rather than editing by hand',
    mismatched.map(k => k + ': table=' + ITEMS[k] + ' derived=' + derived.gens[k]));

  /* Until 2026-08-03 the two assertions here were `unresolved.length === 0` and
     `derived.gens.length === ITEMS.length`. Both passed, at 325 === 325, while the app was loading
     370 items at runtime. The generator took its list of items FROM the table it was validating, so
     it could only ever re-derive what it already knew; the 45 Legends Z-A mega stones PokéAPI had
     added since were invisible to both sides of the comparison. Two artefacts drawn from the same
     seed can only prove consistency, never correctness.

     The generator now enumerates from HELD_ITEM_CATEGORIES — the same source the app uses at
     runtime — so it sees the universe grow. PokéAPI has no game_indices for those 45, so they
     genuinely cannot be dated and are recorded in `unresolved` rather than guessed at. Writing them
     into the app as `undefined` was tried and reverted: it is worse than absence.

     What matters is not that `unresolved` is empty. It is that every unresolved item is one the
     CATEGORY filter already confines to the right generations, so `ITEM_INTRO_GEN[name] || 9`
     cannot put it in the wrong era. Every one is currently a mega stone, and ITEM_CAT_GENS pins
     category 44 to [6,7,9]. An unresolved item in any OTHER category would be a real defect — it
     would default to Generation IX and vanish from every earlier generation — and that is what
     this now fails on. */
  const catGensSrc = src.match(/const ITEM_CAT_GENS=\{[\s\S]*?\n\};/);
  check(!!catGensSrc, 'ITEM_CAT_GENS is present to bound the undatable items');
  const MEGA_STONE_CAT = 44;
  const megaRange = catGensSrc && eval('(' + catGensSrc[0].replace('const ITEM_CAT_GENS=', '').replace(/;$/, '') + ')')[MEGA_STONE_CAT];
  check(Array.isArray(megaRange) && megaRange.length > 2,
    'mega stones are pinned to explicit generations, not an open range', JSON.stringify(megaRange));

  const unresolved = derived.unresolved || [];
  const notAMegaStone = unresolved.filter(n => !/ite$|ite-[xyz]$|nite$/i.test(n));
  check(notAMegaStone.length === 0,
    'every item PokéAPI cannot date is a mega stone, whose generations the category filter already pins — anything else would silently become Gen IX',
    notAMegaStone.join(', '));
  console.log(`      note: ${unresolved.length} items have no PokéAPI game_indices; all are mega stones, bounded by ITEM_CAT_GENS[44]=${JSON.stringify(megaRange)}`);

  // The app must still ship every item the derivation COULD date. This is the assertion that the
  // old count check was reaching for, expressed as containment rather than equality.
  const datable = Object.keys(derived.gens).filter(k => derived.gens[k] != null);
  const absent = datable.filter(k => !(k in ITEMS));
  check(absent.length === 0,
    'every item the derivation could date is in the app table',
    absent.slice(0, 10).join(', '));
}

/* The two systematic errors the audit found, asserted individually. These are the ones that would
   come back if anyone re-typed the table from memory, because both are intuitive mistakes: held
   items feel like a Gen III thing, and ORAS feels newer than it is. */
const GEN2_HELD = ['leftovers', 'kings-rock', 'quick-claw', 'focus-band', 'scope-lens', 'thick-club',
  'light-ball', 'metal-powder', 'lucky-punch', 'stick', 'charcoal', 'magnet', 'miracle-seed',
  'mystic-water', 'sharp-beak', 'poison-barb', 'soft-sand', 'spell-tag', 'twisted-spoon',
  'never-melt-ice', 'black-belt', 'black-glasses', 'dragon-fang', 'hard-stone', 'silver-powder',
  'bright-powder', 'metal-coat', 'smoke-ball', 'silk-scarf'];
GEN2_HELD.forEach(i => check(ITEMS[i] === 2,
  'held item "' + i + '" is Generation II, not III — Gold/Silver introduced held items', ITEMS[i]));

const ORAS_STONES = ['altarianite', 'audinite', 'beedrillite', 'cameruptite', 'diancite',
  'galladite', 'glalitite', 'latiasite', 'latiosite', 'lopunnite', 'metagrossite', 'pidgeotite',
  'sablenite', 'salamencite', 'sceptilite', 'sharpedonite', 'slowbronite', 'steelixite',
  'swampertite'];
ORAS_STONES.forEach(i => check(ITEMS[i] === 6,
  'mega stone "' + i + '" is Generation VI — ORAS is Gen VI, not VII', ITEMS[i]));

const GEN1_ITEMS = ['x-attack', 'x-defense', 'x-speed', 'x-accuracy', 'x-sp-atk', 'dire-hit', 'guard-spec'];
GEN1_ITEMS.forEach(i => check(ITEMS[i] === 1,
  'battle item "' + i + '" is Generation I', ITEMS[i]));

// Sanity: nothing predates Generation I or postdates Generation IX.
const outOfRange = Object.entries(ITEMS).filter(([, g]) => !(g >= 1 && g <= 9));
check(outOfRange.length === 0, 'every item generation is between I and IX', outOfRange);

/* ---- period-accurate sprites -------------------------------------------------------------
   Selecting Generation I and being handed the modern artwork is the same class of wrongness as
   showing modern base stats there. Generations I-VII get their own sprites; VIII and IX do not,
   deliberately - both are large 3D renders that look broken beside pixel sprites, and for IX the
   default sprite already IS the Scarlet/Violet one, so nothing is lost.

   5.53: a generation can have SEVERAL sets, and the chosen game decides which. Reported from the
   live site, on FireRed/LeafGreen: "lets have things that have several sprites for each gen like
   gen 3 does make sure the game uses the correct sprites". GEN_SPRITE_SET is the fallback when no
   one game is selected; SPRITE_SET_FOR_GAME is the per-game answer. */
const dirs = src.match(/^const GEN_SPRITE_SET=\{([\s\S]*?)\};$/m);
check(!!dirs, 'GEN_SPRITE_SET is present');
if (dirs) {
  const map = eval('({' + dirs[1] + '})');
  check(Object.keys(map).map(Number).sort((a, b) => a - b).join(',') === '1,2,3,4,5,6,7',
    'exactly Generations I-VII have period sprites by default', Object.keys(map));
  // The icons/ sets are 68x56 menu icons, not box sprites. Using one would look like a bug.
  const icons = Object.entries(map).filter(([, v]) => /icons/.test(v));
  check(icons.length === 0, 'no generation points at an icons/ directory', icons);
  check(map[7] === 'generation-vii/ultra-sun-ultra-moon',
    'Gen VII uses the real sprites rather than its icons set', map[7]);
  check(!(8 in map) && !(9 in map),
    'Gen VIII and IX fall through to the official artwork on purpose');
}

/* Every game in the picker resolves to a set, and every set it names is one the snapshot has. */
const games = eval('(' + src.match(/^const GEN_GAMES=(\{[\s\S]*?\n\});$/m)[1] + ')');
const perGame = eval('(' + src.match(/^const SPRITE_SET_FOR_GAME=\{([\s\S]*?)^\};$/m)[1].replace(/^/, '{') + '})');
const byVersion = eval('(' + src.match(/^const SPRITE_SET_FOR_VERSION=(\{[^\n]*?\});$/m)[1] + ')');
const SETS = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'dex-index.json'), 'utf8')).spriteSets.map(x => x[0]));
const vgs = [...new Set(Object.values(games).flat().map(g => g.vg))];
const unmapped = vgs.filter(vg => !Object.prototype.hasOwnProperty.call(perGame, vg));
check(unmapped.length === 0, 'every game in the picker says which sprites it uses', unmapped.join(', '));
const bogus = Object.entries(perGame).concat(Object.entries(byVersion)).filter(([, v]) => v && !SETS.has(v));
check(bogus.length === 0, 'and names a set PokeAPI actually ships', bogus.map(x => x.join('=')).join(', '));
check(Object.values(byVersion).join() === 'generation-ii/gold,generation-ii/silver',
  'Gold and Silver are chosen by version, because they have a set each', Object.values(byVersion));
/* The report: three Generation III games, three different sets. */
check(perGame['firered-leafgreen'] === 'generation-iii/firered-leafgreen' &&
      perGame['ruby-sapphire'] === 'generation-iii/ruby-sapphire' &&
      perGame['emerald'] === 'generation-iii/emerald',
  'Ruby/Sapphire, Emerald and FireRed/LeafGreen each use their own sprites');
check(perGame['diamond-pearl'] === 'generation-iv/diamond-pearl' && perGame['heartgold-soulsilver'] === 'generation-iv/heartgold-soulsilver',
  'and Diamond/Pearl and HeartGold/SoulSilver are not shown as Platinum');
check(perGame['sun-moon'] === perGame['ultra-sun-ultra-moon'],
  'Sun/Moon has no set of its own, so it borrows Ultra Sun/Ultra Moon\'s');
check(perGame['sword-shield'] === null && perGame['scarlet-violet'] === null,
  'Gen VIII and IX games keep the artwork, the same decision as above');

/* The file type is read from PokeAPI per set, not assumed: Gen VII is .gif, Gen VIII .webp. Before
   5.53 every URL was built as .png, so Generation VII period sprites 404'd on every card. */
const EXT = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'dex-index.json'), 'utf8')).spriteSets);
check(EXT['generation-vii/ultra-sun-ultra-moon'] === 'gif' && EXT['generation-i/red-blue'] === 'png',
  'the snapshot records each set\'s file type', EXT['generation-vii/ultra-sun-ultra-moon']);
check(/'\.'\+\(SPRITE_EXT\[set\]\|\|'png'\)/.test(src), 'and the URL is built with it');
check(/function haveSprite\(id,set\)\{/.test(src) && /function periodSprite\(id,g\)\{/.test(src),
  'a sprite is only drawn when the snapshot says that game has one of that Pokemon');

/* Behaviour, with the app's own functions and the real snapshot: the reported case is a game whose
   sprites differ from its generation's default. */
const SPR = (() => {
  const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i + 1); if (i < 0 || j < 0) throw new Error('not found ' + a); return src.slice(i, j); };
  const fn = n => cut('function ' + n + '(', '\n}\n') + '\n}\n';
  const dex = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'app', 'dex-index.json'), 'utf8'));
  const code = 'var isChampionsMode=false,specificGame=false,dataGen="",selectedVersion="";\n' +
    'function getDataGenNum(){return SPRENV.gen}\n' +
    src.split(/\r?\n/).find(l => l.startsWith('const VG_GEN=')) + '\n' +
    src.split(/\r?\n/).find(l => l.startsWith("const SPRITE_ROOT=")) + '\n' +
    cut('const GEN_SPRITE_SET=', 'function periodArt(') +
    fn('periodSprite') + fn('spriteFor') +
    ';({set(o){isChampionsMode=!!o.champ;specificGame=!!o.game;dataGen=o.game||"";selectedVersion=o.ver||"";' +
    'SPRITE_SETS=dexSets;SPRITE_EXT=dexExt;spriteBits=dexBits},periodSprite,spriteFor,spriteSetFor})';
  global.SPRENV = { gen: 9 };
  global.dexSets = dex.spriteSets.map(x => x[0]);
  global.dexExt = Object.fromEntries(dex.spriteSets);
  global.dexBits = {};
  dex.pokemon.forEach(r => { if (r[7]) global.dexBits[r[0]] = r[7]; });
  return (0, eval)(code);
})();
const at = (gen, game, ver) => { SPRENV.gen = gen; SPR.set({ game, ver }); };
const shortOf = u => (u || '').split('/sprites/pokemon/')[1] || '(artwork)';

at(3, 'firered-leafgreen', 'leafgreen');
check(shortOf(SPR.periodSprite(1, 3)) === 'versions/generation-iii/firered-leafgreen/1.png',
  'LeafGreen draws the FireRed/LeafGreen Bulbasaur — the reported case', shortOf(SPR.periodSprite(1, 3)));
at(3, 'emerald', 'emerald');
check(shortOf(SPR.periodSprite(1, 3)) === 'versions/generation-iii/emerald/1.png', 'Emerald draws Emerald\'s');
at(3, 'ruby-sapphire', 'ruby');
check(shortOf(SPR.periodSprite(1, 3)) === 'versions/generation-iii/ruby-sapphire/1.png', 'Ruby draws Ruby/Sapphire\'s');
at(3, '', '');
check(shortOf(SPR.periodSprite(1, 3)) === 'versions/generation-iii/emerald/1.png',
  'and with no single game chosen, the generation\'s own set');
at(2, 'gold-silver', 'gold');
check(shortOf(SPR.periodSprite(25, 2)) === 'versions/generation-ii/gold/25.png', 'Gold draws Gold\'s Pikachu');
at(2, 'gold-silver', 'silver');
check(shortOf(SPR.periodSprite(25, 2)) === 'versions/generation-ii/silver/25.png', 'and Silver draws Silver\'s');
at(7, 'ultra-sun-ultra-moon', 'ultra-sun');
check(shortOf(SPR.periodSprite(25, 7)) === 'versions/generation-vii/ultra-sun-ultra-moon/25.gif',
  'Generation VII asks for .gif, which is what PokeAPI has — it asked for .png before 5.53 and got nothing',
  shortOf(SPR.periodSprite(25, 7)));
at(3, 'firered-leafgreen', 'leafgreen');
check(SPR.periodSprite(445, 3) === '', 'a Generation IV species has no Generation III sprite, and none is claimed');
check(shortOf(SPR.spriteFor(445, 3)) === '445.png', 'it falls back to the modern sprite instead of a broken image');
at(8, 'sword-shield', 'sword');
check(SPR.periodSprite(25, 8) === '', 'Generation VIII keeps the official artwork, as decided above');
/* 5.54: Champions draws its own set, which PokeAPI ships for 230 of the 231 Regulation M-C species. */
SPR.set({ champ: true }); SPRENV.gen = 9;
check(shortOf(SPR.periodSprite(25, 9)) === 'versions/generation-ix/champions/25.png', 'Champions draws its own Pikachu');
check(SPR.periodSprite(670, 9) === '', 'base Floette has no Champions sprite (it is not legal), so it keeps the artwork');
SPR.set({}); SPRENV.gen = 9;
check(SPR.periodSprite(25, 9) === '', 'and a Scarlet/Violet view does not borrow the Champions set');

check(/function spriteFor\(id,genNum\)\{/.test(src), 'spriteFor builds the per-generation URL');
check(/function periodArt\(p\)\{/.test(src),
  'periodArt overrides the official artwork where a period sprite exists');
check(/img\.dataset\.spriteFallback/.test(src),
  'a missing period sprite falls back to the modern one rather than breaking');
check(/indexOf\('\/versions\/'\)</.test(src),
  'and the fallback only fires for a versioned sprite, so it cannot loop');

/* -- tabs that describe mechanics the selected generation does not have -----------------------
   TAB_RELEVANCE already supported a `minGen` rule and did not use it, so Generations I and II were
   offered a Natures tab and an Abilities tab. Both mechanics arrived in Generation III. The tabs
   rendered a full modern list, which is not a smaller answer than the truth — it is a confident
   answer to a question those games cannot be asked. */
const appSrc = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const relBlock = appSrc.slice(appSrc.indexOf('const TAB_RELEVANCE='), appSrc.indexOf('function isTabRelevant('));
check(/natures:\{minGen:3\}/.test(relBlock), 'Natures is gated to Generation III and above', relBlock);
check(/abilities:\{minGen:3[,}]/.test(relBlock), 'and so is Abilities');

const relStart = appSrc.indexOf('function isTabRelevant(');
const relEnd = appSrc.indexOf('function applyTabVisibility(');
const rel = (0, eval)(
  'var isChampionsMode=false, selectedGenNum=1;\n' +
  relBlock + appSrc.slice(relStart, relEnd) +
  '\n;({isTabRelevant,setMode:function(c,g){isChampionsMode=c;selectedGenNum=g}})'
);
rel.setMode(false, 1);
check(rel.isTabRelevant('natures') === false, 'Generation I is not offered Natures');
check(rel.isTabRelevant('abilities') === false, 'nor Abilities');
check(rel.isTabRelevant('pokedex') === true, 'but the Pokedex still applies');
rel.setMode(false, 3);
check(rel.isTabRelevant('natures') === true, 'Generation III gets both back');
check(rel.isTabRelevant('abilities') === true, 'as the generation they were introduced in');
/* Champions is Generation IX under the hood, so a minGen rule must not accidentally hide a tab
   there — the mode flag and the generation number are separate questions. */
rel.setMode(true, 9);
check(rel.isTabRelevant('natures') === true && rel.isTabRelevant('abilities') === true,
  'and Champions keeps them, because it is Generation IX');
check(rel.isTabRelevant('locations') === false, 'while the rules that are about Champions still fire');

/* -- changing generation or game reloads the app ------------------------------------------------
   Reported as "sometimes it still shows old data", and that is what was happening. The app holds a
   dozen caches scoped to the selected generation, and triggerDataRefresh cleared the ones somebody
   had remembered to add to it. Every cache added since had to be remembered again, and the failure
   when one was missed is not an error — it is last generation's answer, rendered with confidence.

   A reload is the only clear-down that cannot be incomplete. These assertions are structural
   because a page reload cannot be exercised in node; what they pin is that both entry points go
   through it and that the state written into the address first is not itself stale. */
const appSrc2 = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const reset = appSrc2.slice(appSrc2.indexOf('function resetToHomeAndReload()'),
                            appSrc2.indexOf('function onGenNumChange()'));
check(/location\.reload\(\)/.test(reset), 'the reset performs a real page reload', reset.slice(0, 120));
check(/saveHash\(\)/.test(reset) && reset.indexOf('saveHash()') < reset.indexOf('location.reload()'),
  'and writes the new selection into the address BEFORE reloading, so it comes back where asked');
check(/currentTab='pokedex'/.test(reset), 'landing on the Pokedex');
/* The location version belongs to the generation being left. Carrying it produced
   #pokedex/g2/lv:diamond — a Generation IV game named in a Generation II address. */
check(/locVersion=''/.test(reset), 'and clears the game-specific location version', reset);

const genChange = appSrc2.slice(appSrc2.indexOf('function onGenNumChange()'),
                                appSrc2.indexOf('function swapTeamForScope()'));
check(/resetToHomeAndReload\(\)/.test(genChange), 'a generation change reloads');
check(!/triggerDataRefresh\(\)/.test(genChange),
  'and no longer relies on clearing caches by hand', genChange.slice(-200));
const gameChange = appSrc2.slice(appSrc2.indexOf('function onGameChange()'),
                                 appSrc2.indexOf('function onGameChange()') + 1400);
check((gameChange.match(/resetToHomeAndReload\(\)/g) || []).length === 3,
  'a game change reloads on all THREE paths — the classic game selector, the Champions regulation one, and the ROM hack one (5.55)',
  (gameChange.match(/resetToHomeAndReload\(\)/g) || []).length + ' call sites');
check(!/  triggerDataRefresh\(\);/.test(gameChange),
  'and neither path still hand-clears', gameChange.slice(0, 200));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
