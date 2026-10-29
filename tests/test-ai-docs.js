/* HoopaDex — the trainer AI page
 * Run: node tests/test-ai-docs.js
 *
 * Asked for from the live site: "build a very important tab, switch logic for the ai, and relevant ai
 * flags, etc. this is for each game and rom hack if possible", and "what if some games have custom
 * trainer ai". app/ai-docs.json is written by build/generate-ai-docs.js from pret's decompilations.
 * Expected values were read by hand from those files (named beside each check), not from the output.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');
const d = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'ai-docs.json'), 'utf8'));

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}

// --- the engines, from the code ------------------------------------------------------------------------
/* pokeemerald include/constants/battle_ai.h: AI_SCRIPT_CHECK_BAD_MOVE (1 << 0) ... AI_SCRIPT_TRY_SUNNY_DAY_START (1 << 9);
   bits 29-31 are Roaming, Safari and First Battle, which no trainer uses. */
const g3 = d.engines.gen3.flags.map(f => f.bit + ':' + f.code).join();
check(g3 === '0:CHECK_BAD_MOVE,1:TRY_TO_FAINT,2:CHECK_VIABILITY,3:SETUP_FIRST_TURN,4:RISKY,5:PREFER_POWER_EXTREMES,6:PREFER_BATON_PASS,7:DOUBLE_BATTLE,8:HP_AWARE,9:TRY_SUNNY_DAY_START',
  'Generation III has ten trainer flags, bits 0-9', g3);
/* pokeplatinum generated/ai_flags.txt: NONE, then BASIC ... HARRASSMENT, then UNUSED_11-28, ROAMING_POKEMON, SAFARI, CATCH_TUTORIAL. */
const g4 = d.engines.gen4.flags.map(f => f.bit + ':' + f.code).join();
check(g4 === '0:BASIC,1:EVAL_ATTACK,2:EXPERT,3:SETUP_FIRST_TURN,4:RISKY,5:PRIORITIZE_EXTREMES,6:BATON_PASS,7:TAG_STRATEGY,8:CHECK_HP,9:WEATHER,10:HARRASSMENT',
  'Generation IV has eleven trainer flags, bits 0-10', g4);
/* pokeemerald src/battle_ai_switch_items.c, ShouldSwitch: PerishSong, WonderGuard, absorbs, NaturalCure,
   then "has a super-effective move" and "stats raised" keep it in, then FindMonWithFlagsAndSuperEffective. */
check(d.engines.gen3.switchRules.map(r => r.fn).join() === 'ShouldSwitchIfPerishSong,ShouldSwitchIfWonderGuard,FindMonThatAbsorbsOpponentsMove,ShouldSwitchIfNaturalCure,HasSuperEffectiveMoveAgainstOpponents,AreStatsRaised,FindMonWithFlagsAndSuperEffective',
  'Generation III switch checks, in the order ShouldSwitch runs them');
/* pokeplatinum src/battle/trainer_ai/trainer_ai.c, TrainerAI_ShouldSwitch: AI_OnlyIneffectiveMoves runs third. */
check(d.engines.gen4.switchRules.map(r => r.fn).join() === 'AI_PerishSongKO,AI_CannotDamageWonderGuard,AI_OnlyIneffectiveMoves,AI_HasAbsorbAbilityInParty,AI_IsAsleepWithNaturalCure,AI_HasSuperEffectiveMove,AI_IsHeavilyStatBoosted,AI_HasPartyMemberWithSuperEffectiveMove',
  'Generation IV switch checks, in order, with the "nothing works" check new in IV');
check(d.facts.length >= 11, 'the build checks ' + d.facts.length + ' statements in the text against the code');
check(/65 instead of 320/.test(d.engines.gen4.replacement.join(' ')), 'the replacement text carries pokeplatinum\'s documented scoring overflow');

// --- the hacks ------------------------------------------------------------------------------------------
check(d.hacks['platinum-kaizo'].engine === 'gen4' && /Dry Skin AI Bug fixed/.test(d.hacks['platinum-kaizo'].changes), 'Platinum Kaizo: its own "AI Changes" list, starting with the Dry Skin fix');
check(d.hacks['run-and-bun'].engine === null && /pokeemerald-expansion/.test(d.hacks['run-and-bun'].changesNote), 'Run & Bun: says it runs on the expansion\'s AI and does not guess its flags');
check(/not decompiled/.test(d.hacks['sacred-gold'].changesNote), 'Sacred Gold: says HG/SS\'s AI is not decompiled and Platinum\'s is shown');
/* Dynamic Calc data, "Lvl 14 Leader_M Falkner": "ai":7 - Basic, Evaluate attack, Expert. */
const sg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'hacks', 'sacred-gold.trainers.json'), 'utf8'));
const falk = sg.sections[0].areas.flatMap(a => a.trainers).find(t => t[1] === 'Leader Falkner' && !t[3]);
check(falk && falk[5] === 7, 'Falkner\'s AI flags are 7: Basic, Evaluate attack and Expert', falk && falk[5]);

// --- the app ------------------------------------------------------------------------------------------------
const rel = src.slice(src.indexOf('const TAB_RELEVANCE='), src.indexOf('function isTabRelevant('));
const tabFn = (0, eval)('var isChampionsMode=false,selectedGenNum=4,isRomHack=false;' + rel +
  src.slice(src.indexOf('function isTabRelevant('), src.indexOf('function applyTabVisibility(')) +
  ';({set(o){isChampionsMode=!!o.c;selectedGenNum=o.g;isRomHack=!!o.h},isTabRelevant})');
const at = o => { tabFn.set(o); return tabFn.isTabRelevant('ai'); };
check(at({ g: 3 }) && at({ g: 4 }), 'the AI tab is offered in Generations III and IV');
check(!at({ g: 5 }) && !at({ g: 9 }) && !at({ g: 2 }), 'and not in generations with no decompiled AI');
check(!at({ g: 9, c: true }), 'nor in Champions');
check(at({ g: 8, h: true }), 'and in every ROM hack, Run & Bun included');
check(/const ALL_TABS=\[[^\]]*'ai'[^\]]*\];/.test(src) && /if\(ALL_TABS\.includes\(resolvedTab\)\)/.test(src), 'a link to the AI tab opens it');
const fnSrc = n => { const i = src.indexOf('function ' + n + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
const names = (0, eval)('(' + fnSrc('aiFlagNames') + ')');
check(names(7, d.engines.gen4) === 'Avoid bad moves, Go for the knockout, Expert', 'flags 7 read as Basic, Evaluate attack and Expert', names(7, d.engines.gen4));
check(names(519, d.engines.gen4) === 'Avoid bad moves, Go for the knockout, Expert, Weather on turn one', 'flags 519 add Weather (bit 9)', names(519, d.engines.gen4));

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
