#!/usr/bin/env node
/* HoopaDex — how the trainer AI works, per engine and per ROM hack
 * Run: node build/generate-ai-docs.js          (fetch the decompilations, write app/ai-docs.json)
 *      node build/generate-ai-docs.js --check  (fetch again, exit 1 if the file is stale)
 *
 * Asked for from the live site: "build a very important tab, switch logic for the ai, and relevant ai
 * flags, etc. this is for each game and rom hack if possible", and "what if some games have custom
 * trainer ai".
 *
 * The source is the games' own code, as decompiled by pret: pokeemerald and pokefirered for
 * Generation III, pokeplatinum for Generation IV. HeartGold/SoulSilver's trainer AI is still assembly
 * in pokeheartgold, so Sacred Gold is shown with Platinum's code and the page says so. Generations V
 * and later have no decompiled AI, and get no AI page rather than a guessed one.
 *
 * What is derived and what is written: the flag names and bit numbers, and the ORDER in which the
 * switch checks run, are read from the code every build. The plain-English line for each flag and
 * each check is written here, from reading that code; the build fails if the code gains a flag or a
 * check that has no line, or loses one that has. Every probability below was read from the code
 * (`Random() % 3 < 2` is 2 in 3), not from a guide.
 */
const fs = require('fs');
const path = require('path');
const RH = require('./generate-romhacks.js');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'app', 'ai-docs.json');
const R = 'https://raw.githubusercontent.com/pret/';
const SRC = {
  emFlags: R + 'pokeemerald/master/include/constants/battle_ai.h',
  emSwitch: R + 'pokeemerald/master/src/battle_ai_switch_items.c',
  emCmds: R + 'pokeemerald/master/src/battle_ai_script_commands.c',
  frSwitch: R + 'pokefirered/master/src/battle_ai_switch_items.c',
  ptFlags: R + 'pokeplatinum/main/generated/ai_flags.txt',
  ptAI: R + 'pokeplatinum/main/src/battle/trainer_ai/trainer_ai.c',
  ptScript: R + 'pokeplatinum/main/src/battle/trainer_ai/script.s',
  ptLib: R + 'pokeplatinum/main/src/battle/battle_lib.c',
  ptBugs: R + 'pokeplatinum/main/docs/bugs_and_glitches.md',
  pkAI: 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/export?format=csv&gid=1725998549',
};
async function get(url) {
  const dir = process.env.RH_CACHE;
  if (!dir) return RH.get(url);
  const f = path.join(dir, require('crypto').createHash('sha1').update(url).digest('hex'));
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const t = await RH.get(url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, t);
  return t;
}

/* ---- the plain-English lines ------------------------------------------------------------------------
   Keyed by the name in the code. Gen III and Gen IV run the same ten routines under different names
   (Gen IV is a port); the shared text is written once. */
const FLAG_TEXT = {
  basic: ['Avoid bad moves', 'Takes points off a move that would fail or do nothing: a move your Pokémon is immune to, a status it already has, a stat already at its limit, and so on.'],
  evalAttack: ['Go for the knockout', 'A move that can knock your Pokémon out is favoured. Otherwise a move that is not its most damaging loses 1 point, and a 4× super-effective move gains 2 about 69% of the time.'],
  expert: ['Expert', 'The largest routine: a judgement for most move effects, such as healing when its HP is low or setting up when it is safe.'],
  setup: ['Set up on the first turn', 'On its first turn, a move that raises its stats gains 2 points about 69% of the time.'],
  risky: ['Take risks', 'Risky moves (one-hit KO moves, Explosion and the like) gain 2 points half the time.'],
  extremes: ['Prefer extreme power', 'Moves with variable power, fixed damage, very high power, or no power at all (status moves) gain points.'],
  batonPass: ['Baton Pass chains', 'Status moves only, and only with a party member left; if it does not know Baton Pass the routine runs about 7 times in 10. Swords Dance, Dragon Dance, Calm Mind and Nasty Plot get +5 on the battle\'s first turn, -10 below 60% HP, +1 otherwise; Protect +2 unless it just protected; Baton Pass -2 on turn one, then +1 to +3 for its Attack or Sp. Atk boosts; other status moves +3 most of the time.'],
  doubles: ['Double battle', 'Double-battle judgement: spread moves, not hurting its partner, and moves that help its partner.'],
  checkHP: ['Mind the HP', 'Which moves it likes depends on its own HP (above 70%, 31-70%, 30% or less) and then on your Pokémon\'s; for example, it avoids setting up when low.'],
  weather: ['Weather on turn one', 'On the battle\'s first turn, a weather move gains 5 points, unless that weather is already up.'],
  sunnyDay: ['Sunny Day on turn one', 'Meant to give Sunny Day 5 points on its first turn. A bug in the check (pokeemerald\'s own comment calls it "nonsense") makes it unreliable.'],
  harassment: ['Harassment', 'Moves the routine counts as harassing (status and annoyance moves) gain 2 points half the time.'],
};
const GEN3_FLAGS = { CHECK_BAD_MOVE: 'basic', TRY_TO_FAINT: 'evalAttack', CHECK_VIABILITY: 'expert', SETUP_FIRST_TURN: 'setup', RISKY: 'risky',
  PREFER_POWER_EXTREMES: 'extremes', PREFER_BATON_PASS: 'batonPass', DOUBLE_BATTLE: 'doubles', HP_AWARE: 'checkHP', TRY_SUNNY_DAY_START: 'sunnyDay' };
const GEN4_FLAGS = { BASIC: 'basic', EVAL_ATTACK: 'evalAttack', EXPERT: 'expert', SETUP_FIRST_TURN: 'setup', RISKY: 'risky',
  PRIORITIZE_EXTREMES: 'extremes', BATON_PASS: 'batonPass', TAG_STRATEGY: 'doubles', CHECK_HP: 'checkHP', WEATHER: 'weather', HARRASSMENT: 'harassment' };
const NOT_TRAINER = /^(NONE|ALL|UNUSED_\d+|ROAMING|ROAMING_POKEMON|SAFARI|FIRST_BATTLE|CATCH_TUTORIAL)$/;

/* The switch checks, in the order the code runs them. Each value: what it means for the player. */
const SWITCH_TEXT = {
  // Generation III (pokeemerald / pokefirered, ShouldSwitch)
  ShouldSwitchIfPerishSong: ['Perish Song', 'Its Perish Song count has reached 0: it always switches out.'],
  ShouldSwitchIfWonderGuard: ['Wonder Guard', 'Singles only. Your Pokémon has Wonder Guard and none of its moves are super-effective: it switches to a party member with a super-effective move (2 in 3 chance for each such move it finds).'],
  FindMonThatAbsorbsOpponentsMove: ['Absorbing ability', 'The last move that hit it was a damaging Fire, Water or Electric move, and it lacks the matching ability: it switches to a party member with Flash Fire, Water Absorb or Volt Absorb, half the time. If it already has a super-effective move, it skips this check 2 times in 3.'],
  ShouldSwitchIfNaturalCure: ['Natural Cure', 'It is asleep, has Natural Cure and at least half its HP: it switches out half the time (before it has been hit, or after a status move); otherwise to a party member immune to or resisting the last move that also has a super-effective move; otherwise still half the time.'],
  HasSuperEffectiveMoveAgainstOpponents: ['Stays: has a super-effective move', 'From here on it STAYS IN if any of its moves is super-effective on your Pokémon (9 in 10 for each such move).'],
  AreStatsRaised: ['Stays: boosted', 'It STAYS IN if its stat boosts add up to 4 stages or more.'],
  FindMonWithFlagsAndSuperEffective: ['Immune or resisting partner', 'Last: it switches to a party member that is immune to the last damaging move that hit it and has a super-effective move against your Pokémon (1 in 2 for each such move), or failing that one that resists it (1 in 3).'],
  // Generation IV (pokeplatinum, TrainerAI_ShouldSwitch)
  AI_PerishSongKO: ['Perish Song', 'Its Perish Song count has reached 0: it always switches out.'],
  AI_CannotDamageWonderGuard: ['Wonder Guard', 'Singles only. Your Pokémon has Wonder Guard and none of its moves can hurt it: it switches to a party member that can, 2 times in 3.'],
  AI_OnlyIneffectiveMoves: ['Nothing works (new in Gen IV)', 'Every damaging move it has does nothing to your Pokémon, and it has at least two: it switches to a party member with a super-effective move, 2 times in 3.'],
  AI_HasAbsorbAbilityInParty: ['Absorbing ability', 'The last move that hit it was a damaging Fire, Water or Electric move, and it lacks the matching ability: it switches to a party member with Flash Fire, Water Absorb or Volt Absorb, half the time. If it already has a super-effective move, it skips this check 2 times in 3.'],
  AI_IsAsleepWithNaturalCure: ['Natural Cure', 'It is asleep, has Natural Cure and at least half its HP: it switches out half the time (before it has been hit, or after a status move); otherwise to a party member immune to or resisting the last move that also has a super-effective move; otherwise still half the time.'],
  AI_HasSuperEffectiveMove: ['Stays: has a super-effective move', 'From here on it STAYS IN if any of its moves is super-effective on your Pokémon (9 in 10 for each such move).'],
  AI_IsHeavilyStatBoosted: ['Stays: boosted', 'It STAYS IN if its stat boosts add up to 4 stages or more.'],
  AI_HasPartyMemberWithSuperEffectiveMove: ['Immune or resisting partner', 'Last: it switches to a party member that is immune to the last damaging move that hit it and has a super-effective move against your Pokémon (1 in 2 for each such move), or failing that one that resists it (1 in 3).'],
};
const NEVER_SWITCH = 'It never switches while trapped (Wrap, Mean Look, Ingrain), against Shadow Tag or Arena Trap (even when it is Flying-type or has Levitate, which should let it), as a Steel-type against Magnet Pull, or when it has nobody left to switch to.';
const REPLACEMENT = {
  gen3: ['It picks one of your Pokémon and looks for a replacement in two stages.',
    'First, it ranks its party by how hard YOUR Pokémon\'s types hit them, most damage first, and sends in the first one that has a super-effective move against you. pokeemerald\'s own comment notes this is the opposite of what a careful player would do.',
    'If none qualifies, it sends in the one whose moves would do the most damage, worked out as if the Pokémon that just fainted were using them.'],
  gen4: ['It picks one of your Pokémon (at random in doubles) and looks for a replacement in two stages.',
    'First, it ranks its party by how hard THEIR types hit yours, and sends in the first one that has a super-effective move against you. The score is stored in a single byte, so a strong matchup overflows: a 4× matchup counts as 65 instead of 320, and the wrong Pokémon can come in (pokeplatinum\'s documented "Post-KO Switch-In AI Scoring Overflow").',
    'If none qualifies, it sends in the one whose best move would do the most damage (highest roll, no critical hit), worked out as if the Pokémon that just fainted were using it.'],
};
const HOW_IT_CHOOSES = 'Each of its four moves starts at 100 points. Each AI flag the trainer has runs a routine that adds or takes away points. It uses the move with the most points; a tie is broken at random.';

// ---- read the code ------------------------------------------------------------------------------------------
function gen3Flags(h) {
  return [...h.matchAll(/#define AI_SCRIPT_(\w+)\s+\(1 << (\d+)\)/g)].map(m => ({ code: m[1], bit: +m[2] })).filter(f => !NOT_TRAINER.test(f.code));
}
function gen4Flags(txt) {
  return txt.trim().split(/\r?\n/).map((l, i) => ({ code: l.trim().replace(/^AI_FLAG_/, ''), bit: i - 1 })).filter(f => f.bit >= 0 && !NOT_TRAINER.test(f.code));
}
function callOrder(src, fnHead, names) {
  const i = src.lastIndexOf(fnHead);   // the definition, not the forward declaration above it
  if (i < 0) throw new Error('not found: ' + fnHead);
  const body = src.slice(i, src.indexOf('\n}\n', i));
  const re = new RegExp('\\b(' + names.join('|') + ')\\(', 'g');
  const out = [];
  let m;
  while ((m = re.exec(body))) if (!out.includes(m[1]) || m[1] === 'FindMonWithFlagsAndSuperEffective' || m[1] === 'AI_HasPartyMemberWithSuperEffectiveMove') out.push(m[1]);
  return out.filter((x, k) => out.indexOf(x) === k);
}
function flagRows(list, map) {
  return list.map(f => {
    const key = map[f.code];
    if (!key) throw new Error('AI flag ' + f.code + ' has no plain-English line - read its routine and add one');
    return { bit: f.bit, code: f.code, key, name: FLAG_TEXT[key][0], text: FLAG_TEXT[key][1] };
  });
}
function rules(order) {
  return order.map(fn => { if (!SWITCH_TEXT[fn]) throw new Error('switch check ' + fn + ' has no plain-English line'); return { fn, name: SWITCH_TEXT[fn][0], text: SWITCH_TEXT[fn][1] }; });
}
function hackFlagCounts(key) {
  const f = path.join(ROOT, 'app', 'hacks', key + '.trainers.json');
  if (!fs.existsSync(f)) return null;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const counts = {};
  let n = 0;
  d.sections.forEach(s => s.areas.forEach(a => a.trainers.forEach(t => { if (t[5] === undefined) return; n++; counts[t[5]] = (counts[t[5]] || 0) + 1; })));
  return n ? { trainers: n, byFlags: counts } : null;
}

async function main() {
  const check = process.argv.includes('--check');
  const fetched = new Date().toISOString().slice(0, 10);
  const T = {};
  await Promise.all(Object.keys(SRC).map(async k => { T[k] = await get(SRC[k]); }));

  // Facts the text above depends on: if the code moves, the build stops and someone rereads it.
  const facts = [
    [/score\[i\] = 100;/.test(T.emCmds), 'Gen III: every move starts at 100 points'],
    [/moveScore\[i\] = 100;/.test(T.ptAI), 'Gen IV: every move starts at 100 points'],
    [/Random\(\) % 3 < 2/.test(T.emSwitch), 'Gen III Wonder Guard: 2 in 3'],
    [/return \(buffedStatsValue > 3\);/.test(T.emSwitch), 'Gen III: boosts of 4 stages or more keep it in'],
    [/numBoosts >= 4;/.test(T.ptAI), 'Gen IV: boosts of 4 stages or more keep it in'],
    [/FindMonWithFlagsAndSuperEffective\(MOVE_RESULT_DOESNT_AFFECT_FOE, 2\)[\s\S]{0,80}FindMonWithFlagsAndSuperEffective\(MOVE_RESULT_NOT_VERY_EFFECTIVE, 3\)/.test(T.emSwitch), 'Gen III: immune partner 1 in 2, resisting partner 1 in 3'],
    [/AI_HasPartyMemberWithSuperEffectiveMove\(battleSys, battleCtx, battler, 0x8, 2\)[\s\S]{0,400}0x4, 3\)/.test(T.ptAI), 'Gen IV: immune partner 1 in 2, resisting partner 1 in 3'],
    [/Possible bug: this comparison gives the type that takes the most damage/.test(T.emSwitch), 'Gen III replacement: ranks by damage taken'],
    [/u8 score, maxScore; \/\/ BUG: Post-KO Switch-In AI Scoring Overflow/.test(T.ptLib), 'Gen IV replacement: the documented one-byte score overflow'],
    [/as having a score equivalent to 65 rather than 320/.test(T.ptBugs), 'Gen IV overflow: 65 instead of 320'],
    [/BUG: This line should branch on Dry Skin rather than Levitate/.test(T.ptScript), 'Gen IV: the Dry Skin bug in Basic'],
  ];
  const broken = facts.filter(f => !f[0]).map(f => f[1]);
  if (broken.length) throw new Error('the code no longer says what the text claims:\n  ' + broken.join('\n  '));

  const g3names = Object.keys(SWITCH_TEXT).filter(k => !/^AI_/.test(k));
  const g4names = Object.keys(SWITCH_TEXT).filter(k => /^AI_/.test(k));
  const emOrder = callOrder(T.emSwitch, 'static bool8 ShouldSwitch(void)', g3names);
  const frOrder = callOrder(T.frSwitch, 'static bool8 ShouldSwitch(void)', g3names);
  const ptOrder = callOrder(T.ptAI, 'static BOOL TrainerAI_ShouldSwitch(', g4names);
  if (emOrder.join() !== frOrder.join()) throw new Error('FireRed and Emerald switch checks differ: ' + emOrder.join() + ' vs ' + frOrder.join());

  const engines = {
    gen3: { label: 'Generation III (Ruby, Sapphire, Emerald, FireRed, LeafGreen)', source: 'pret/pokeemerald and pret/pokefirered',
      howItChooses: HOW_IT_CHOOSES + ' When it compares damage it uses its own random roll (85-100%), so its estimate can differ from yours.',
      flags: flagRows(gen3Flags(T.emFlags), GEN3_FLAGS), neverSwitch: NEVER_SWITCH, switchRules: rules(emOrder), replacement: REPLACEMENT.gen3 },
    gen4: { label: 'Generation IV (Diamond, Pearl, Platinum, HeartGold, SoulSilver)', source: 'pret/pokeplatinum',
      howItChooses: HOW_IT_CHOOSES,
      flags: flagRows(gen4Flags(T.ptFlags), GEN4_FLAGS), neverSwitch: NEVER_SWITCH, switchRules: rules(ptOrder), replacement: REPLACEMENT.gen4,
      bugs: ['Basic checks Levitate where it should check Dry Skin, so it does not know a Dry Skin Pokémon absorbs Water moves (pokeplatinum\'s own comment).'] },
  };
  const pkLines = RH.csvRows(T.pkAI).map(r => (r[0] || '').trim()).filter(Boolean).join('\n').replace(/^PLATINUM KAIZO AI CHANGES:\s*/i, '').trim();
  const hacks = {
    'renegade-platinum': { engine: 'gen4', base: 'Platinum', changes: null, changesNote: 'Drayano\'s documents describe no changes to the AI; it is Platinum\'s.', flagSource: 'The hack\'s calculator data, which records each trainer\'s flags.' },
    'sacred-gold': { engine: 'gen4', base: 'HeartGold / SoulSilver', changes: null, changesNote: 'Drayano\'s documents describe no changes to the AI. HeartGold/SoulSilver\'s AI code is not decompiled yet; this page shows Platinum\'s, the closest decompiled engine.', flagSource: 'The hack\'s calculator data, which records each trainer\'s flags.' },
    'platinum-kaizo': { engine: 'gen4', base: 'Platinum', changes: pkLines, changesNote: 'From the Mastersheet\'s "AI Changes" tab, in the authors\' words. Their sheet marks each trainer\'s flags with colours, which its export does not carry, so per-trainer flags are not shown here.', flagSource: null },
    'emerald-kaizo': { engine: 'gen3', base: 'Emerald', changes: null, changesNote: 'No published source documents Emerald Kaizo\'s AI or which flags its trainers have. The engine below is Emerald\'s; any change the hack makes to it is not documented.', flagSource: null },
    'firered-omega': { engine: 'gen3', base: 'FireRed', changes: null, changesNote: 'No published source documents FireRed Omega\'s AI. The engine below is FireRed\'s.', flagSource: null },
    'run-and-bun': { engine: null, base: 'pokeemerald-expansion', changes: null, changesNote: 'Run & Bun runs on pokeemerald-expansion, whose AI was rewritten in C with its own, much larger set of flags (smart switching, knowing your party, predicting switches, and more). Which version of it Run & Bun uses, and which flags its trainers have, are not in dekzeh\'s public data, so this page does not guess. hzla\'s Run & Bun calculator models its switch-ins.', flagSource: null },
  };
  Object.keys(hacks).forEach(k => { hacks[k].flagCounts = hackFlagCounts(k); });

  const doc = { about: 'Generated by build/generate-ai-docs.js. Do not edit by hand.', fetched, sources: Object.values(SRC), facts: facts.map(f => f[1]), engines, hacks };
  const next = JSON.stringify(doc) + '\n';
  if (check) {
    const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') : '';
    const strip = s => s.replace(/"fetched":"[^"]*",/, '');
    const same = strip(cur) === strip(next);
    console.log(same ? 'check: ai-docs.json matches the code' : 'STALE: ai-docs.json differs');
    process.exit(same ? 0 : 1);
  }
  fs.writeFileSync(OUT, next);
  console.log('Gen III flags: ' + engines.gen3.flags.map(f => f.code).join(', '));
  console.log('Gen IV flags:  ' + engines.gen4.flags.map(f => f.code).join(', '));
  console.log('Gen III switch order: ' + emOrder.join(' > '));
  console.log('Gen IV switch order:  ' + ptOrder.join(' > '));
  console.log('facts checked: ' + facts.length);
  Object.keys(hacks).forEach(k => console.log(k + ': ' + (hacks[k].flagCounts ? JSON.stringify(hacks[k].flagCounts) : 'no per-trainer flags')));
}
module.exports = { gen3Flags, gen4Flags, callOrder };
if (require.main === module) main().catch(e => { console.error(e.stack || e); process.exit(1); });
