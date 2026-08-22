#!/usr/bin/env node
/* HoopaDex — mutation check
 * Run: node build/mutation-check.js
 *
 * Breaks the shipped app on purpose, one bug at a time, and asserts that the suite which claims to
 * cover that bug actually goes red. Exits non-zero if any mutation survives.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-08-03 the app had 23 suites and 778 assertions, all green. An architecture review applied
 * ten deliberate bugs and ran the whole battery against each one. FIVE SURVIVED:
 *
 *   critical hits at 2.5x instead of 1.5x            all 23 green
 *   STAB at 1.9x instead of 1.5x                     all 23 green
 *   the spread-move reduction deleted                all 23 green
 *   Zacian's historical Attack changed               all 23 green
 *   Venusaur deleted from the Reg M-A roster         all 23 green
 *   Mega Barbaracle given the wrong ability          all 23 green
 *
 * A green suite is evidence that the code has not changed. It is not evidence that the code is
 * right. The only way to know a test defends something is to break that thing and watch the test
 * fail — and having done that once by hand, the check belongs in CI, or it rots.
 *
 * This is a fixed, curated set rather than a general mutation engine. A real engine mutates every
 * operator and reports a percentage; that is a much bigger tool and most of its output would be
 * noise on a 645 KB single-file app. Each entry here is a bug shape that has actually occurred or
 * that would put a wrong number in front of a reader.
 *
 * ADDING ONE: pick a real defect, name the suite that should catch it, and check that it does.
 * If no suite catches it, that is the finding — write the test, do not delete the mutation.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const PRISTINE = fs.readFileSync(APP, 'utf8');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hoopadex-mutation-'));

// [id, description, find, replace, expected match count, suite that must catch it]
const MUTATIONS = [
  ['M1', 'PAST_STATS: wrong Gen IX Attack for an unpinned species (Zacian)',
    '888:{9:{attack:130}}', '888:{9:{attack:170}}', 1, 'test-past-stats.js'],
  ['M2', 'POKEMON_PAST_TYPES: Mawile was Steel in Gen VI, claim Fire',
    "303:{6:['steel']}", "303:{6:['fire']}", 1, 'test-past-types.js'],
  ['M3', 'GEN1_SPECIAL: Ivysaur Special 80 -> 81',
    'const GEN1_SPECIAL={1:65,2:80,', 'const GEN1_SPECIAL={1:65,2:81,', 1, 'test-gen1-special.js'],
  ['M4', 'ITEM_INTRO_GEN: Absolite is Gen VI, claim Gen V',
    "'absolite':6,", "'absolite':5,", 1, 'test-generation-tables.js'],
  ['M8', 'Type chart: Normal no longer resists through Steel',
    'const CM={normal:{rock:.5,ghost:0,steel:.5}', 'const CM={normal:{rock:.5,ghost:0}', 1, 'test-coverage.js'],
  ['M9', 'Champions: drop Venusaur from the Regulation M-A roster',
    'const CHAMPIONS_IDS_MA=new Set([3,6,9,', 'const CHAMPIONS_IDS_MA=new Set([6,9,', 1, 'test-champions-roster.js'],
  ['M10', 'CHAMP_MEGA_ABILITIES: Mega Barbaracle given the wrong ability',
    "{pokemon:'Mega Barbaracle',ability:'Tough Claws'}",
    "{pokemon:'Mega Barbaracle',ability:'Levitate'}", 1, 'test-mega-abilities.js'],
  ['M11', 'Version stamp disagrees with the newest CHANGELOG entry',
    '<!-- HOOPADEX VERSION: ', '<!-- HOOPADEX VERSION: 9.9 ', 1, 'test-syntax.js'],

  /* Added 2026-08-03 by the engineering review. The eleven above covered 9 of the 27 suites;
     the other 18 had never been proven to fail. Mutating them one at a time found two real
     holes (M12 and M13 below) and confirmed the rest. */
  ['M13', "Routing: restoreHash goes back to its own copy of the '#' strip",
    '  const h=hashPath();', "  const h=(location.hash||'').replace(/^#/,'');", 1, 'test-hash-routing.js'],
  ['M14', 'Bulk: the HP constant changes from 75 to 70',
    'return isHP ? base+75+sp', 'return isHP ? base+70+sp', 1, 'test-bulk-split.js'],
  ['M15', 'Natures: Adamant raises Defence instead of Attack',
    "Adamant:['attack','special-attack']", "Adamant:['defense','special-attack']", 1, 'test-calc-nature.js'],
  ['M16', 'Team editor: EVs typed into Sp. Atk land on Sp. Def',
    "const EDIT_STAT_KEY={hp:'hp',atk:'attack',def:'defense',spa:'special-attack'",
    "const EDIT_STAT_KEY={hp:'hp',atk:'attack',def:'defense',spa:'special-defense'", 1, 'test-team-edit-stats.js'],
  ['M17', 'Paste import: an imported Sp. Def EV lands on Sp. Atk',
    "const PASTE_STATKEY={hp:'hp',atk:'attack',def:'defense',spa:'special-attack',spd:'special-defense'",
    "const PASTE_STATKEY={hp:'hp',atk:'attack',def:'defense',spa:'special-attack',spd:'special-attack'",
    1, 'test-paste-import.js'],
  ['M18', 'Weather: Sand Stream names the wrong extending item',
    "'sand-stream':  {weather:'a sandstorm', rock:'Smooth Rock'}",
    "'sand-stream':  {weather:'a sandstorm', rock:'Icy Rock'}", 1, 'test-weather-duration.js'],
  ['M19', 'Search: DEX_TYPES loses a type',
    "const DEX_TYPES=['normal','fire',", "const DEX_TYPES=['fire',", 1, 'test-dex-search.js'],
  ['M20', 'Forms: baseSpeciesId stops splitting on hyphens',
    "const parts=String(formName).toLowerCase().split('-');",
    'const parts=[String(formName).toLowerCase()];', 1, 'test-form-names.js'],
  ['M21', 'Regulation items: an item is dropped from the M-A to M-B diff',
    '{added:["Barbaracite","Big Root",', '{added:["Big Root",', 1, 'test-regulation-items.js'],
  ['M22', 'Ability text: the restatement threshold drops from 0.7 to 0.3',
    'return hit.length/short.length>=(threshold===undefined?0.7:threshold);',
    'return hit.length/short.length>=(threshold===undefined?0.3:threshold);', 1, 'test-ability-desc.js'],
  ['M23', 'Palette: colourblind mode loses its distinct up colour',
    '--eff-up-solid:#3987e5', '--eff-up-solid:#ff0000', 1, 'test-viz-palette.js'],
  ['M24', 'Speed tiers: the neutral-nature Scarf column is computed from the boosting figure',
    "{key:'scarfn', label:'Neutral 32 + Scarf', hint:'neutral nature, 32 SP, Choice Scarf', f:b=>Math.floor((b+20+32)*1.5)}",
    "{key:'scarfn', label:'Neutral 32 + Scarf', hint:'neutral nature, 32 SP, Choice Scarf', f:b=>Math.floor(Math.floor((b+20+32)*1.1)*1.5)}",
    1, 'test-stat-formula-doc.js'],
  ['M25', 'Speed tiers: the roster goes back to species only, dropping every Mega and form',
    '  const roster=calcRoster();\n  const _spForms',
    '  const roster=master.filter(function(p){return CHAMPIONS_IDS.has(p.id)});\n  const _spForms',
    1, 'test-speed-tiers.js'],
  ['M26', 'Bulk: the roster goes back to species only, dropping every Mega and form',
    '  const roster=calcRoster();\n  const _bkForms',
    '  const roster=master.filter(function(m){return CHAMPIONS_IDS.has(m.id)});\n  const _bkForms',
    1, 'test-speed-tiers.js'],
  ['M27', 'Forms: the Legends Z-A mega suffix loses its case, so two Pokémon share one name',
    ":name.includes('-mega-z')?' Z-A'", ":name.includes('-mega-zzz')?' Z-A'", 1, 'test-form-names.js'],
  ['M28', 'Forms: a Mega no longer has to have a legal Mega Stone, so Z-A megas return',
    'if(need&&isChampionsMode&&!CHAMPIONS_ITEMS.has(need))return false;',
    'if(false)return false;', 1, 'test-form-names.js'],
  ['M29', 'Forms: battle-only formes become selectable, so Ash-Greninja returns',
    'if(FORM_BATTLE_ONLY.has(flat))return false;', 'if(false)return false;', 1, 'test-form-names.js'],
  ['M30', 'Typing list: formes are dropped at the source again, so Fire/Dragon answers nothing',
    'const set=new Set(list.filter(n=>n>0));', 'const set=new Set(list.filter(n=>n>0&&n<=10000));',
    1, 'test-dual-typing.js'],
  ['M31', 'Typing list: genMax is re-applied to the forme id, which rejects every forme',
    '      return _tcRoster.has(id);', '      return id<=genMax&&_tcRoster.has(id);',
    1, 'test-dual-typing.js'],
  ['M36', 'Learnsets: a failed load is cached again, so Champions legality can never recover',
    '      _champLSLoading=null;   // let the next call try again instead of replaying the failure',
    '      /* cache the failure */', 1, 'test-champions-roster.js'],

  /* Interactions. These are the bug shapes that would put a WRONG statement about a mechanic in
     front of a reader while every page still rendered and every other suite stayed green — which
     is the whole reason this table exists rather than a regex that checks the functions are
     present. */
  ['M37', 'Ability text: the generation filter is dropped, so every generation gets the newest wording',
    '  const within=en.filter(function(e){return VG_GEN[e.version_group.name]<=genNum});',
    '  const within=en;', 1, 'test-interactions.js'],
  ['M38', 'Ability text: the newest matching wording is replaced by the oldest',
    'pool.forEach(function(e){if(VG_GEN[e.version_group.name]>=VG_GEN[best.version_group.name])best=e});',
    'pool.forEach(function(e){if(VG_GEN[e.version_group.name]<=VG_GEN[best.version_group.name])best=e});',
    1, 'test-interactions.js'],
  ['M39', 'Flag members stop being cut to the generation — Mega Launcher boosts Terrain Pulse in Gen VI',
    '  return (IX.flagMoves[flag]||[]).filter(function(x){return x[1]<=genNum});',
    '  return (IX.flagMoves[flag]||[]);', 1, 'test-interactions.js'],
  ['M40', 'Mega Launcher boosts pulse moves by 1.2 instead of 1.5',
    '"mega-launcher":{"rules":[{"flag":"pulse","kind":"boost","mult":1.5}]',
    '"mega-launcher":{"rules":[{"flag":"pulse","kind":"boost","mult":1.2}]', 1, 'test-interactions.js'],
  ['M41', 'Intimidate immunity loses its start generation, so Gen VII is told Scrappy resists it',
    'if(rec.intimidate===\'blocks\'&&(!rec.intimidateFrom||genNum>=rec.intimidateFrom)){',
    'if(rec.intimidate===\'blocks\'){', 1, 'test-interactions.js'],
  ['M42', 'A resist is printed as its raw factor, so Punk Rock "takes 50% MORE damage"',
    "case 'resist':  return 'Takes '+(r.mult?Math.round((1-r.mult)*100)+'% less':'less')+' damage from '+f.noun;",
    "case 'resist':  return 'Takes '+(r.mult?Math.round(r.mult*100)+'% less':'less')+' damage from '+f.noun;",
    1, 'test-interactions.js'],
  ['M43', 'The stale-multiplier guard inverts, so PokeAPI\'s 1.33x sits next to the derived 1.3',
    '    return !mults.some(function(m){return Math.abs(m-n)<0.02});',
    '    return mults.some(function(m){return Math.abs(m-n)<0.02});', 1, 'test-interactions.js'],
  ['M44', 'A move reports its holder-side rules as things that happen TO it',
    "        if(r.kind==='removes'||r.kind==='strips')return;",
    '        if(false)return;', 1, 'test-interactions.js'],
  ['M45', 'The embedded interaction table goes stale against the generated one',
    '"mega-launcher":{"rules"', '"mega-launcher-x":{"rules"', 1, 'test-interactions.js'],
  ['M46', 'Move tags stop being cut to the generation, so Gen V is told Mega Launcher boosts pulses',
    '      if(rec.gen&&rec.gen>genNum)return;\n      (rec.rules||[]).forEach(function(r){\n        if(r.flag!==flag)return;',
    '      (rec.rules||[]).forEach(function(r){\n        if(r.flag!==flag)return;', 1, 'test-move-tags.js'],
  ['M47', 'A move opened before the calc engine loads claims no flags again',
    "  return String(IX.moveFlags[slug]||'').split(' ').filter(function(f){return f&&MOVE_TAG_NOTE[f]});",
    '  return [];', 1, 'test-move-tags.js'],
  /* ASCII-only anchor on purpose. index.html stores non-ASCII as \uXXXX escapes, so an anchor
     containing a literal "·" matches zero times and the mutation silently stops testing anything —
     which the runner reports as a SKIP and a failed run, correctly, but is still an hour wasted. */
  ['M48', 'The tag tooltip stops escaping quotes and can break out of the title attribute',
    ".replace(/\"/g,'&quot;')+'\">'+i.label",
    "+'\">'+i.label", 1, 'test-move-tags.js'],
  /* M49 tested the ranking that hoisted boosts above the tooltip's cap. Both the cap and the
     ranking were deleted in 5.42 along with the twenty trigger rows that made them necessary, so
     the mutation has nothing left to break. Replaced rather than removed: the invariant it was
     really protecting — that the useful entries are not crowded out by the generic ones — still
     exists, and is now enforced at the filter instead of at the cap. */
  ['M49', 'The tag tooltip stops filtering triggers, so contact fills with Gooey and nineteen others',
    'const cons=ixFlagConsequences(f,genNum).filter(function(c){return !c.trigger});',
    'const cons=ixFlagConsequences(f,genNum);', 1, 'test-move-tags.js'],
  ['M94', 'A move lists every ability it merely sets off again, burying the three that matter',
    "const hits=moveInteractions(moveSlug,genNum).filter(function(x){return x.rule.kind!=='affects'});",
    'const hits=moveInteractions(moveSlug,genNum);', 1, 'test-interactions.js'],
  ['M50', 'The ability card loses min-width:0, so a long name pushes the Hidden pill out of the card',
    '.ap-mon-body{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}',
    '.ap-mon-body{display:flex;flex-direction:column;gap:4px;flex:1}', 1, 'test-ability-desc.js'],
  ['M51', 'The card name goes back to being a bare text node with no min-width to give',
    "+'<span class=\"ap-mon-body\"><span class=\"ap-mon-name\">'+label+'</span>'",
    "+'<span class=\"ap-mon-body\">'+label", 1, 'test-ability-desc.js'],
  ['M52', 'The Hidden pill shoves itself back to the right edge of the card',
    '.hidden-pill{display:inline-block;flex-shrink:0;',
    '.hidden-pill{display:inline-block;margin-left:auto;flex-shrink:0;', 1, 'test-ability-desc.js'],

  /* Search generation-gating, and the environment tables. Both of these ship WRONG ANSWERS rather
     than broken pages, which is the only kind of defect this table is for. */
  ['M53', 'The fuzzy search branch stops applying the generation rule to abilities',
    '        fa.sort((a,b)=>b._fs-a._fs).slice(0,2).forEach(a=>fuzzyPlace(a,getAbilityIntroGen(a.name)));',
    '        fa.sort((a,b)=>b._fs-a._fs).slice(0,2).forEach(a=>items.push(a));', 1, 'test-dex-search.js'],
  ['M54', 'The fuzzy search branch stops applying it to moves, so Gen III offers Bullet Punch',
    '        fm.sort((a,b)=>b._fs-a._fs).slice(0,2).forEach(m=>fuzzyPlace(m,getMoveIntroGen(m.name)));',
    '        fm.sort((a,b)=>b._fs-a._fs).slice(0,2).forEach(m=>items.push(m));', 1, 'test-dex-search.js'],
  ['M55', 'Fuzzy dedup goes back to checking only the in-generation bucket',
    "      const placedMove=new Set(items.concat(otherGenItems,champNotItems).filter(i=>i.type==='move').map(i=>i.name));",
    "      const placedMove=new Set(items.filter(i=>i.type==='move').map(i=>i.name));", 1, 'test-dex-search.js'],
  ['M56', 'An ability with no loaded data is assumed to be Gen IX and vanishes from every search',
    '  return g||0;\n}', '  return g||9;\n}', 1, 'test-dex-search.js'],
  ['M57', 'Nature Power shows one generation’s environment table to every generation',
    '  const g=rec.gens&&rec.gens[genNum];', '  const g=rec.gens&&rec.gens[3];', 1, 'test-environment-moves.js'],
  ['M58', 'A generation with no table renders nothing instead of saying the move cannot be used',
    "  if(g.note){\n    return '<div class=\"env-block\">", "  if(false){\n    return '<div class=\"env-block\">", 1, 'test-environment-moves.js'],
  ['M59', 'The embedded environment table goes stale against the generated one',
    '"nature-power":{"gives"', '"nature-power-x":{"gives"', 1, 'test-environment-moves.js'],

  /* Per-generation move text. The cutoff arithmetic is the part that fails silently — an
     off-by-one shows Generation II's wording to a Generation III reader with no visible symptom. */
  /* The anchor carries the line above it on purpose. Three functions now resolve a generation
     cutoff with an identically-shaped line, and two of them use the same local name, so the bare
     line matched twice and the runner reported SKIP — correctly refusing to mutate an ambiguous
     target rather than silently picking one. */
  ['M60', 'The move-text cutoff resolves DOWNWARD, handing a generation the older wording',
    '  if(rec.gen&&genNum<rec.gen)return null;      // the move did not exist yet\n' +
    '  const keys=Object.keys(rec.gens).map(Number).filter(function(n){return n>=genNum}).sort(function(a,b){return a-b});',
    '  if(rec.gen&&genNum<rec.gen)return null;      // the move did not exist yet\n' +
    '  const keys=Object.keys(rec.gens).map(Number).filter(function(n){return n<=genNum}).sort(function(a,b){return b-a});',
    1, 'test-move-text.js'],
  ['M61', 'A move is described in generations before it existed',
    '  if(rec.gen&&genNum<rec.gen)return null;      // the move did not exist yet',
    '  // gate removed', 1, 'test-move-text.js'],
  ['M62', 'Jump Kick loses its Generation I entry and Gen I is told the Gen II rule',
    '"jump-kick":{"cur":"User is hurt by 50% of its max HP if it misses.","gen":1,"gens":{"1":',
    '"jump-kick":{"cur":"User is hurt by 50% of its max HP if it misses.","gen":1,"gens":{"0":',
    1, 'test-move-text.js'],
  ['M63', 'The embedded move-text table goes stale against the generated one',
    '"jump-kick":{"cur"', '"jump-kick-x":{"cur"', 1, 'test-move-text.js'],
  ['M64', 'Champions stops naming which rules its move text is quoting',
    "const label=isChampionsMode?'Scarlet/Violet rules':'Gen '+ixRoman(g);",
    "const label='Gen '+ixRoman(g);", 1, 'test-move-text.js'],

  /* Per-generation move NUMBERS, past abilities, and tabs for mechanics an era did not have.
     The first two put a wrong number and a wrong immunity on screen, which is the severest class
     here: the ability one is not even displayed where it does its damage — it feeds the type
     matchup, so the wrong answer surfaces on a different page from the stale field. */
  ['M65', 'Move power stops resolving per generation, so Gen I is shown Gen IX numbers',
    "  const v=movePastField(md,'power',g);\n  return v===undefined?(md&&md.power):v;",
    '  return md&&md.power;', 1, 'test-move-stats.js'],
  /* Re-anchored in 5.37: the cutoff moved into the shared pastValueForGen. The mutation now takes
     the LARGEST matching entry rather than the smallest, which is exactly what the old
     getMoveTypeForGen did — its loop kept overwriting and ended on the highest match, so a move
     with two recorded type changes resolved to the wrong one of them. */
  ['M66', 'The past-value cutoff takes the highest matching entry instead of the lowest',
    '.filter(function(n){return n>genNum}).sort(function(a,b){return a-b});',
    '.filter(function(n){return n>genNum}).sort(function(a,b){return b-a});',
    1, 'test-move-stats.js'],
  ['M67', 'A null past value is written through and blanks a real accuracy',
    '    if(pv.accuracy!==null&&pv.accuracy!==undefined)rec.accuracy=pv.accuracy;',
    '    rec.accuracy=pv.accuracy;', 1, 'test-move-stats.js'],
  ['M69', 'Gengar loses Levitate, so Gen IV is told Earthquake hits it',
    '"gengar":{"id":94,"gens":{"6":[{"slot":1,"hidden":false,"ability":"levitate"}]}}',
    '"gengar":{"id":94,"gens":{}}', 1, 'test-past-abilities.js'],
  ['M70', 'A slot that did not exist yet is shown anyway',
    '    if(!r.ability)return;                       // the slot was empty in this generation',
    '    if(!r.ability){out.push(a);return}', 1, 'test-past-abilities.js'],
  ['M71', 'Removing an absent slot renumbers the ones that survive',
    'out.push({ability:{name:r.ability,url:\'\'},is_hidden:r.hidden,slot:a.slot});',
    'out.push({ability:{name:r.ability,url:\'\'},is_hidden:r.hidden,slot:out.length+1});',
    1, 'test-past-abilities.js'],
  ['M72', 'Generation I is offered a Natures tab for a mechanic that did not exist',
    '  natures:{minGen:3},', '  natures:{},', 1, 'test-generation-tables.js'],

  /* The reverse ability join, and the reload. Both are about a list being COMPLETE rather than
     merely present — a short list still looks like an answer. */
  ['M73', 'The ability page stops adding species that had the ability then (Levitate loses Gengar)',
    '      if(r.ability!==abilityName||seen[species])return;',
    '      if(true)return;', 1, 'test-past-abilities.js'],
  ['M74', 'and stops removing the ones that did not (Cursed Body keeps Gengar in Gen VI)',
    '      if(row&&row.ability!==abilityName)return;',
    '      if(false)return;', 1, 'test-past-abilities.js'],
  ['M75', 'A produced entry carries an id the sprite lookup cannot parse',
    "out.push({pokemon:{name:species,url:'/pokemon/'+PASTABIL[species].id+'/'},is_hidden:!!r.hidden,slot:r.slot});",
    "out.push({pokemon:{name:species,url:''},is_hidden:!!r.hidden,slot:r.slot});",
    1, 'test-past-abilities.js'],
  ['M76', 'Changing generation goes back to hand-clearing caches instead of reloading',
    '  swapTeamForScope();\n  resetToHomeAndReload();',
    '  swapTeamForScope();\n  triggerDataRefresh();', 1, 'test-generation-tables.js'],
  ['M77', 'The reload keeps the previous generation\'s game in the address',
    "  if(typeof locVersion!=='undefined')locVersion='';", '  // kept', 1, 'test-generation-tables.js'],

  /* The damage engine, after the local fallback was deleted in 5.37. Every mutation that used to
     break our own implementation of the formula went with it; what is left guards the ONE engine
     and the plumbing around it. */
  ['M78', 'The engine is built for a hardcoded generation, so the calculator ignores the selector',
    'const gen=SmogonCalc.Generations.get(want);', 'const gen=SmogonCalc.Generations.get(9);',
    1, 'test-calc-engine.js'],
  ['M79', 'The engine cache stops being keyed by generation, so it never rebuilds',
    '  if(CalcMaps&&CalcMapsGen===want)return;', '  if(CalcMaps)return;', 1, 'test-calc-engine.js'],
  ['M80', 'A missing engine is guessed around instead of reported',
    "  if(typeof SmogonCalc==='undefined'){calcShowEngineMissing();return null}", '  // no guard',
    1, 'test-calc-engine.js'],
  /* The past_values convention is the opposite of every other table here, and getting it wrong is
     invisible: it shifts a move's whole history by exactly one generation. */
  /* The search switching itself off. Reported as "it's not really showing the search results, that
     was the best feature on the whole site" — and it was not a rendering problem, it was a flag
     that disabled the handler and was released on a chain that could fail. */
  ['M82', 'The search-suppression failsafe is removed, so one bad navigation kills the search',
    '  _suppressTimer=setTimeout(releaseSearchSuppression,800);', '  // no failsafe',
    1, 'test-dex-search.js'],
  ['M83', 'The flag goes back to being released on a later timer, swallowing what is typed meanwhile',
    '      releaseSearchSuppression();\n      if(typedDuring)onSmartSearch();',
    '      setTimeout(releaseSearchSuppression,300);', 1, 'test-dex-search.js'],
  ['M84', 'Text typed while navigating is overwritten by the restored query',
    '      if(_pendingSearchVal!==null&&!typedDuring){', '      if(_pendingSearchVal!==null){',
    1, 'test-dex-search.js'],
  /* The scoping bug that killed the search. It threw on every keystroke that matched a cached
     ability, which starts the moment you open any Pokemon. */
  ['M85', 'parseRomanGen stops being reachable from getAbilityIntroGen, as it was before 5.39',
    'function parseRomanGen(r){', 'function NOT_parseRomanGen(r){', 1, 'test-dex-search.js'],

  /* 5.41 — the ability card and the ability page disagreeing on screen. Each of these reinstates
     one gate the list used to be missing, which is how the two views drifted apart. */
  ['M87', 'The ability page stops using the shared resolver, so it can drift from the card again',
    'const pokemonList=abilityHoldersFiltered(abilityName,d.pokemon,genNum,genMax)',
    'const pokemonList=abilityHoldersForGen(abilityName,d.pokemon,genNum)', 1, 'test-ability-counts.js'],
  ['M88', 'The shared resolver drops formAllowed, so the Champions roster stops being applied',
    'if(!formAllowed(p.pokemon.name,id,genNum,genMax))return false;\n    // Hidden abilities',
    'if(false)return false;\n    // Hidden abilities', 1, 'test-ability-counts.js'],
  ['M89', 'Hidden-only holders are counted before Gen V, when hidden abilities did not exist',
    'if(p.is_hidden&&genNum<5)return false;\n    return true;\n  });\n}',
    'if(false)return false;\n    return true;\n  });\n}', 1, 'test-ability-counts.js'],
  ['M90', 'The card goes back to counting holders itself instead of reading the resolved count',
    'const genCount=holderCount.get(a.name)||0;',
    "const genCount=a.pokemon.filter(p=>{const m=p.pokemon.url.match(/\\/(\\d+)\\//);return m&&parseInt(m[1])<=genMax}).length;",
    1, 'test-ability-counts.js'],
  ['M91', 'The MEGA badge stops checking the roster, so Z-A megas are advertised in Champions',
    'if(id)return !isChampionsMode||CHAMPIONS_IDS.has(id);', 'if(id)return true;',
    1, 'test-ability-counts.js'],
  ['M92', 'speciesIdBySlug loses its default-form fallback, so zygarde and pyroar stop resolving',
    "const pre=master.find(p=>p.name.indexOf(t+'-')===0);\n  return pre?pre.id:0;",
    'return 0;', 1, 'test-ability-counts.js'],
  ['M93', 'An unresolved mega species is assumed legal rather than excluded',
    'return false;   // unresolved is not a licence to claim it exists',
    'return true;   // unresolved is not a licence to claim it exists', 1, 'test-ability-counts.js'],
  /* M86 was here and has been removed rather than made to pass. It deleted an explicit number
     branch from parseRomanGen, and it survived — correctly, because String(4) falls through the
     Roman table and out of the parseInt below with the same answer. The branch was doing nothing.
     A mutation that cannot be killed because the code it breaks has no effect is a finding about
     the code, not a gap in the tests. */
  ['M81', 'past_values resolves as "this generation and below", shifting every move by one',
    '  const keys=Object.keys(byGen).map(Number).filter(function(n){return n>genNum}).sort(function(a,b){return a-b});',
    '  const keys=Object.keys(byGen).map(Number).filter(function(n){return n>=genNum}).sort(function(a,b){return a-b});',
    1, 'test-move-stats.js'],
];

function runSuite(suite, srcPath) {
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tests', suite)],
      { cwd: ROOT, stdio: 'pipe', timeout: 180000, env: Object.assign({}, process.env, { HOOPADEX_SRC: srcPath }) });
    return true;   // green
  } catch { return false; }  // red
}

let survived = 0, skipped = 0, killed = 0;
console.log(`mutation check — ${MUTATIONS.length} mutations\n`);

for (const [id, desc, find, repl, expect, suite] of MUTATIONS) {
  const n = PRISTINE.split(find).length - 1;
  if (n !== expect) {
    // The anchor moved. That is not a pass: the mutation is no longer testing anything.
    console.log(`${id}  SKIP   ${desc}\n       anchor matched ${n} times, expected ${expect} — update the anchor`);
    skipped++;
    continue;
  }
  const mutant = path.join(TMP, `${id}.html`);
  fs.writeFileSync(mutant, PRISTINE.split(find).join(repl));

  if (runSuite(suite, mutant)) {
    console.log(`${id}  SURVIVED  ${desc}\n       ${suite} stayed GREEN on broken code`);
    survived++;
  } else {
    console.log(`${id}  killed by ${suite}  —  ${desc}`);
    killed++;
  }
}

fs.rmSync(TMP, { recursive: true, force: true });
console.log(`\n${killed} killed, ${survived} survived, ${skipped} skipped`);
if (survived || skipped) {
  console.log('\nA surviving mutation means a suite claims cover it does not have.');
  process.exit(1);
}
process.exit(0);
