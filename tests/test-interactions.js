/* HoopaDex — move classes, and who acts on them
 * Run: node tests/test-interactions.js
 *
 * Why this suite exists. Two things shipped wrong for a long time and neither was a crash.
 *
 * 1. Every ability, item and move was described by ONE string with no generation dimension —
 *    PokeAPI's `short_effect`, or the newest flavor text via `.pop()`. Scrappy's short_effect has
 *    said "Lets the Pokemon's Normal and Fighting moves hit Ghost Pokemon" since Generation IV and
 *    says nothing about Intimidate, which the ability has resisted since Generation VIII. The app
 *    printed that sentence in Champions and called it current.
 *
 * 2. An ability whose subject is a CLASS of moves had nowhere to name the class. Mega Launcher
 *    boosts pulse moves; nothing on its page said which moves those are, and nothing on Aura
 *    Sphere said Mega Launcher existed.
 *
 * The fix is derived on both sides — game text per version group from PokeAPI, mechanics from
 * Showdown's own flag tests — so the failure this guards against is not "someone deleted a
 * function". It is the quieter one: a generation filter that stops filtering, an argument order
 * that silently inverts a comparison, an embedded table that goes stale against the generator.
 * Every assertion below runs the shipped code against a known answer rather than grepping for it.
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
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

// --- load the shipped functions, not copies of them --------------------------------------------
const vgLine = lines.find(l => l.startsWith('const VG_GEN='));
const ixLine = lines.find(l => l.startsWith('const IX='));
const start = lines.findIndex(l => l.startsWith('function ixRoman('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('const WEATHER_ABILITY_TEXT='));
if (!vgLine || !ixLine || start < 0 || end < 0) throw new Error('could not locate the IX block in index.html');
/* isRestatement lives further down the file and renderInteractions does not call it, but
   ixContradicts is the guard that keeps a stale PokeAPI multiplier off the page and it must be the
   real one. Nothing here is restated locally: a correct copy in the test file would hide a broken
   original, which is the exact failure mode this project has already been bitten by. */
const app = (0, eval)(
  vgLine + '\n' + ixLine + '\n' + lines.slice(start, end).join('\n') +
  '\n;({IX,ixRoman,ixTitle,genFlavorText,ixRuleText,ixFlagMoves,ixMoveChips,' +
  'ixContradicts,renderInteractions,moveInteractions,renderMoveInteractions})'
);
const { IX, genFlavorText, ixRuleText, ixFlagMoves, ixContradicts,
        renderInteractions, moveInteractions } = app;

// --- the embedded table is the generated one ---------------------------------------------------
/* The blob in index.html is 25 KB of generated JSON inside a hand-edited file. If the two are
   allowed to drift, the app's copy becomes a fourth source of truth that nobody regenerates —
   which is precisely how PAST_STATS ended up with 10 of 43 entries correct. */
const embedPath = path.join(ROOT, 'data', 'interactions.embed.json');
const a = src.indexOf('/*BEGIN-INTERACTIONS*/'), b = src.indexOf('/*END-INTERACTIONS*/');
const embedded = src.slice(a + '/*BEGIN-INTERACTIONS*/'.length, b);
check(fs.existsSync(embedPath), 'data/interactions.embed.json exists');
check(embedded === fs.readFileSync(embedPath, 'utf8').trim(),
  'the table embedded in the app is byte-identical to the generated one',
  'run: node build/generate-interactions.js && node build/embed-interactions.js');

// --- the game's own words, for the generation on screen ----------------------------------------
/* A real Scrappy fixture, trimmed. The Intimidate clause appears only in Scarlet/Violet, so this
   is the whole reported bug in one object. */
const SCRAPPY = [
  { language: { name: 'en' }, version_group: { name: 'x-y' },
    flavor_text: 'Makes Normal- and Fighting-type moves hit Ghost-type Pokemon.' },
  { language: { name: 'en' }, version_group: { name: 'ultra-sun-ultra-moon' },
    flavor_text: 'The Pokemon can hit Ghost-type Pokemon with Normal- and Fighting-type moves.' },
  { language: { name: 'en' }, version_group: { name: 'scarlet-violet' },
    flavor_text: 'The Pokemon can hit Ghost-type Pokemon with Normal- and Fighting-type moves.\nIt is also unaffected by Intimidate.' },
  { language: { name: 'ja' }, version_group: { name: 'scarlet-violet' }, flavor_text: 'NOT ENGLISH' },
];
check(/unaffected by Intimidate/.test(genFlavorText(SCRAPPY, 9) || ''),
  'Gen IX gets the Scarlet/Violet wording, which mentions Intimidate', genFlavorText(SCRAPPY, 9));
check(!/Intimidate/.test(genFlavorText(SCRAPPY, 7) || ''),
  'Gen VII does NOT — the clause is later than the generation being shown', genFlavorText(SCRAPPY, 7));
check(/^Makes Normal/.test(genFlavorText(SCRAPPY, 6) || ''),
  'Gen VI gets X/Y, the newest wording at or below that generation', genFlavorText(SCRAPPY, 6));
check(!/NOT ENGLISH/.test(genFlavorText(SCRAPPY, 9) || ''), 'non-English entries are excluded');
check(!/\n/.test(genFlavorText(SCRAPPY, 9) || ''),
  'the hard line breaks PokeAPI ships inside flavor text are flattened');
// Below the earliest entry there is still a right answer: the oldest wording, not nothing.
check(genFlavorText(SCRAPPY, 3) !== null, 'a generation below every entry falls back rather than blanking');
check(genFlavorText([], 9) === null && genFlavorText(undefined, 9) === null,
  'no entries returns null so the caller can fall back');
// Items call the same field `text`. One helper, two field names, because it is one problem.
check(genFlavorText([{ language: { name: 'en' }, version_group: { name: 'sword-shield' }, text: 'Item wording.' }], 9)
  === 'Item wording.', 'item entries use `text` and are read by the same helper');
// A version group the app does not map must not be picked over one it does.
check(genFlavorText([{ language: { name: 'en' }, version_group: { name: 'made-up-game' }, flavor_text: 'X' }], 9)
  === null, 'an unmapped version group is ignored rather than dated as generation undefined');

// --- flag membership is cut to the generation --------------------------------------------------
const pulse9 = ixFlagMoves('pulse', 9).map(x => x[0]);
const pulse6 = ixFlagMoves('pulse', 6).map(x => x[0]);
check(pulse9.length === 7, 'seven pulse moves in Gen IX', pulse9.join(','));
check(pulse9.indexOf('aura-sphere') >= 0, 'Aura Sphere is one of them');
check(pulse6.indexOf('terrain-pulse') < 0,
  'Terrain Pulse is NOT offered in Gen VI — it is a Generation VIII move', pulse6.join(','));
check(pulse6.indexOf('origin-pulse') >= 0, 'Origin Pulse is, because Gen VI is when it arrived');
check(ixFlagMoves('pulse', 2).length === 0, 'and none of them exist in Gen II');

// --- the sentence for each rule shape ----------------------------------------------------------
check(ixRuleText({ flag: 'pulse', kind: 'boost', mult: 1.5 }) === 'Boosts pulse moves &times;1.5',
  'a boost states the multiplier', ixRuleText({ flag: 'pulse', kind: 'boost', mult: 1.5 }));
check(ixRuleText({ flag: 'bullet', kind: 'block', mult: null }) === 'Blocks ballistic moves',
  'a block does not invent a multiplier');
check(ixRuleText({ flag: 'sound', kind: 'resist', mult: 0.5 }) === 'Takes 50% less damage from sound moves',
  'a resist is stated as a reduction, not as a factor below one');
/* 0.5 is the only resist multiplier in the shipped data, and it is the one value where "50% less"
   and "50% of" are the same string — so an assertion built on it cannot tell the two apart. The
   mutation check caught exactly that: printing the raw factor instead of the reduction survived
   the suite. A fixture with an asymmetric multiplier is what actually pins the arithmetic. */
check(ixRuleText({ flag: 'contact', kind: 'resist', mult: 0.75 }) === 'Takes 25% less damage from contact moves',
  'and the reduction is 1 minus the multiplier, not the multiplier',
  ixRuleText({ flag: 'contact', kind: 'resist', mult: 0.75 }));
check(ixRuleText({ flag: 'contact', kind: 'removes', mult: null }) === 'Its own moves never make contact',
  'Long Reach is phrased as what a player would feel, not as a flag edit');
check(/hit through Protect/.test(ixRuleText({ flag: 'contact', kind: 'strips', strips: 'protect', mult: null })),
  'Unseen Fist is phrased against Protect');
check(/no longer make contact/.test(ixRuleText({ flag: 'punch', kind: 'strips', strips: 'contact', mult: null })),
  'Punching Glove is phrased against contact');
check(ixRuleText({ flag: 'not-a-flag', kind: 'boost', mult: 2 }) === null,
  'an unknown flag produces nothing rather than a sentence with a hole in it');

// --- the ability panel, end to end -------------------------------------------------------------
const ml9 = renderInteractions('ability', 'mega-launcher', 9);
check(/Boosts pulse moves/.test(ml9) && /&times;1\.5/.test(ml9), 'Mega Launcher states the rule and the number');
check(/Aura Sphere/.test(ml9) && /Water Pulse/.test(ml9), 'and names the moves it applies to');
check(/Terrain Pulse/.test(ml9), 'including the Gen VIII one, in Gen IX');
check(!/Terrain Pulse/.test(renderInteractions('ability', 'mega-launcher', 6)),
  'but not in Gen VI, where the move does not exist yet');
check(renderInteractions('ability', 'not-an-ability', 9) === '',
  'an ability with nothing derived renders no heading at all');

/* Punk Rock tests the one-list-per-flag rule. It has two rules on `sound` — it boosts them and it
   resists them — and printing the member list per rule put the same thirty-three moves on screen
   twice, a screen apart. */
const pr = renderInteractions('ability', 'punk-rock', 9);
check((pr.match(/Boomburst/g) || []).length === 1,
  'Punk Rock names its sound moves once, not once per rule', (pr.match(/Boomburst/g) || []).length + ' occurrences');
check(/Boosts sound moves/.test(pr) && /less damage from sound moves/.test(pr),
  'while still stating both of its rules');

/* Broad flags are counted, not listed. 277 contact moves is not a list anyone reads, and printing
   it would bury the one sentence that matters. */
const tc = renderInteractions('ability', 'tough-claws', 9);
check(/such moves in Gen IX/.test(tc), 'contact is reported as a count');
check(!/Aerial Ace/.test(tc), 'and not enumerated');

// --- Intimidate: the case this was reported for ------------------------------------------------
const scr9 = renderInteractions('ability', 'scrappy', 9);
const scr8 = renderInteractions('ability', 'scrappy', 8);
const scr7 = renderInteractions('ability', 'scrappy', 7);
check(/Intimidate/.test(scr8) && /VIII/.test(scr8), 'Scrappy resists Intimidate from Gen VIII, and says so');
check(!/Intimidate/.test(scr7),
  'and does not in Gen VII, where Showdown deletes the hook entirely', scr7);
/* When the game text already says it — which it does from Scarlet/Violet — the panel must add the
   date rather than repeat the sentence. Showdown puts the mechanic two years before the games
   reworded the description, and that gap is the only new information left to give. */
check(/added in Gen VIII/.test(renderInteractions('ability', 'scrappy', 9, 'It is also unaffected by Intimidate.')),
  'when the description already mentions Intimidate, the panel gives the date instead');
check(/Attack is not lowered/.test(scr9),
  'and gives the full sentence when the description does not mention it');
check(/Intimidate/.test(renderInteractions('ability', 'guard-dog', 9)),
  'Guard Dog blocks Intimidate too');
check(!/since Gen/.test(renderInteractions('ability', 'guard-dog', 9)),
  'with no "since" — it is a Gen IX ability that never behaved any other way');
check(/Triggered by Intimidate/.test(renderInteractions('item', 'adrenaline-orb', 9)),
  'Adrenaline Orb is triggered BY Intimidate, not immune to it');

// --- the same facts from the move's side -------------------------------------------------------
const as9 = moveInteractions('aura-sphere', 9).map(x => x.who);
const as5 = moveInteractions('aura-sphere', 5).map(x => x.who);
check(as9.indexOf('Mega Launcher') >= 0, 'Aura Sphere names Mega Launcher', as9.join(','));
check(as9.indexOf('Bulletproof') >= 0, 'and Bulletproof, because it is ballistic as well as a pulse');
check(as5.length === 0,
  'and neither in Gen V, because both abilities are Generation VI', as5.join(','));
check(moveInteractions('boomburst', 5).map(x => x.who).indexOf('Soundproof') >= 0,
  'Soundproof does reach back to Gen V');
check(moveInteractions('sleep-powder', 9).map(x => x.who).indexOf('Safety Goggles') >= 0,
  'items appear alongside abilities');
check(moveInteractions('aerial-ace', 9).map(x => x.who).indexOf('Rocky Helmet') >= 0,
  'contact punishers are found, which needs checkMoveMakesContact to be read as a contact test');
check(moveInteractions('tackle', 9).every(x => x.rule.kind !== 'removes' && x.rule.kind !== 'strips'),
  'a rule about the holder\'s OWN moves is not reported as something that happens to this move');

// --- a stale multiplier from PokeAPI never sits next to the derived one -------------------------
/* Tough Claws is the live example: Showdown multiplies by 5325/4096, which is 1.3, and PokeAPI's
   short_effect still says 1.33x — the Generation VI value, wrong since Generation VII. Both were on
   screen at once, disagreeing, with nothing to tell the reader which to believe. */
check(ixContradicts('Strengthens moves that make contact to 1.33x their power.', 'tough-claws'),
  'a multiplier that disagrees with the derived one is suppressed');
check(!ixContradicts('Strengthens moves that make contact to 1.3x their power.', 'tough-claws'),
  'one that agrees is kept');
check(!ixContradicts('Powers up moves that make direct contact.', 'tough-claws'),
  'prose with no number is always kept — this suppresses conflicts, not detail');
check(!ixContradicts('Strengthens aura and pulse moves to 1.5x their power.', 'mega-launcher'),
  'Mega Launcher agrees with PokeAPI and keeps its sentence');
check(!ixContradicts('anything at all 2x', 'overcoat'),
  'an ability with no derived multiplier has nothing to contradict');

// --- the table itself holds together -----------------------------------------------------------
let flagless = [], badSlug = [];
Object.keys(IX.abilities).concat(Object.keys(IX.items)).forEach(function (k) {
  const rec = IX.abilities[k] || IX.items[k];
  (rec.rules || []).forEach(function (r) { if (!IX.flagLabels[r.flag]) flagless.push(k + ':' + r.flag); });
});
Object.keys(IX.flagMoves).forEach(function (f) {
  IX.flagMoves[f].forEach(function (x) {
    if (!/^[a-z0-9-]+$/.test(x[0]) || !(x[1] >= 1 && x[1] <= 9)) badSlug.push(f + ':' + x[0] + '@' + x[1]);
  });
});
check(flagless.length === 0, 'every rule names a flag the app has a label for', flagless.join(', '));
check(badSlug.length === 0, 'every move is a PokeAPI slug with a generation between 1 and 9', badSlug.slice(0, 5).join(', '));
check(!Object.prototype.hasOwnProperty.call(IX.flagMoves, 'protect'),
  'Protect is not shipped as a move list — 669 of 953 moves carry it and the list says nothing');
check(Object.keys(IX.abilities).length >= 30 && Object.keys(IX.items).length >= 5,
  'the table is populated rather than an empty object that would silently render nothing',
  Object.keys(IX.abilities).length + ' abilities, ' + Object.keys(IX.items).length + ' items');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
