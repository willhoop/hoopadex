/* HoopaDex — abilities a species had in an earlier generation
 * Run: node tests/test-past-abilities.js
 *
 * Gengar's ability is Cursed Body. It was LEVITATE from Generation III through Generation VI — a
 * full immunity to Ground. The app showed Cursed Body in every generation, so a reader on
 * Generation IV was told Earthquake hits Gengar. It does not.
 *
 * That is a worse class of error than a stale label, and it is why this suite is separate. An
 * ability is not only displayed; it feeds the type-matchup answer. One stale field produces a
 * confident, wrong answer to a DIFFERENT question, several screens away from where the mistake
 * lives — which is exactly the failure mode the project exists to remove.
 *
 * 141 species are affected in three kinds, and the largest kind is the least obvious:
 *   112  a slot that did not exist yet. Pidgey had no second ability until Generation IV, and the
 *        app listed Tangled Feet in Generation III.
 *    21  a hidden ability that was a different ability
 *     8  a normal ability that was a different ability
 *
 * Rows saying a hidden slot simply did not exist are deliberately NOT shipped: hidden abilities
 * arrived in Generation V, the app already gates on that, and carrying the rule twice would create
 * two places to keep in step.
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

const paLine = lines.find(l => l.startsWith('const PASTABIL='));
const start = lines.findIndex(l => l.startsWith('function pastAbilityOverrides('));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function getMoveTypeForGen('));
if (!paLine || start < 0 || end < 0) throw new Error('could not locate the past-ability helpers');
const app = (0, eval)(paLine + '\n' + lines.slice(start, end).join('\n') +
  '\n;({PASTABIL,pastAbilityOverrides,applyPastAbilities})');
const { PASTABIL, applyPastAbilities } = app;

// --- the embedded table is the generated one ------------------------------------------------------
const embedPath = path.join(ROOT, 'data', 'past-abilities.embed.json');
const a = src.indexOf('/*BEGIN-PASTABIL*/'), b = src.indexOf('/*END-PASTABIL*/');
check(fs.existsSync(embedPath), 'data/past-abilities.embed.json exists');
check(src.slice(a + '/*BEGIN-PASTABIL*/'.length, b) === fs.readFileSync(embedPath, 'utf8').trim(),
  'the table embedded in the app is byte-identical to the generated one',
  'run: node build/generate-past-abilities.js && node build/embed-past-abilities.js');

// --- Gengar, which is the whole point --------------------------------------------------------------
const GENGAR = [{ ability: { name: 'cursed-body' }, is_hidden: false, slot: 1 }];
const names = (species, list, g) => applyPastAbilities(species, list, g).map(x => x.ability.name);
check(names('gengar', GENGAR, 3)[0] === 'levitate', 'Gen III Gengar has Levitate', names('gengar', GENGAR, 3));
check(names('gengar', GENGAR, 6)[0] === 'levitate', 'and so does Gen VI, the last generation it had it');
check(names('gengar', GENGAR, 7)[0] === 'cursed-body', 'Gen VII is Cursed Body', names('gengar', GENGAR, 7));
check(names('gengar', GENGAR, 9)[0] === 'cursed-body', 'and so is Gen IX');
check(names('gengar', GENGAR, 6)[0] !== names('gengar', GENGAR, 7)[0],
  'the two eras genuinely differ — not one answer for all of them');

// --- a slot that did not exist yet -----------------------------------------------------------------
const PIDGEY = [
  { ability: { name: 'keen-eye' }, is_hidden: false, slot: 1 },
  { ability: { name: 'tangled-feet' }, is_hidden: false, slot: 2 },
  { ability: { name: 'big-pecks' }, is_hidden: true, slot: 3 },
];
check(names('pidgey', PIDGEY, 3).indexOf('tangled-feet') < 0,
  'Gen III Pidgey has no second ability — Tangled Feet is a Gen IV addition', names('pidgey', PIDGEY, 3));
check(names('pidgey', PIDGEY, 3).indexOf('keen-eye') >= 0, 'but keeps the ability it did have');
check(names('pidgey', PIDGEY, 4).indexOf('tangled-feet') >= 0, 'and Gen IV has it', names('pidgey', PIDGEY, 4));
/* Removing a slot must not renumber the others. The hidden gate downstream keys off is_hidden, and
   the ability page keys off slot, so a shifted slot would be a quiet second bug. */
const g3 = applyPastAbilities('pidgey', PIDGEY, 3);
check(g3.every(x => x.slot === 1 || x.slot === 3), 'the surviving slots keep their own numbers',
  JSON.stringify(g3.map(x => x.slot)));
check(g3.some(x => x.is_hidden), 'and a hidden ability stays marked hidden for the downstream gate');

/* Pidgey alone cannot prove the slot numbers survive, and the mutation check said so: its only
   changed slot is a REMOVAL, so the branch that rebuilds a replaced entry never runs and a mutant
   that renumbered from the output position stayed green. Proving it needs a species where a removal
   comes BEFORE a replacement, and no real species does both — so one is injected. */
PASTABIL['zz-test-species'] = { id: 0, gens: { 3: [
  { slot: 1, hidden: false, ability: null },
  { slot: 2, hidden: false, ability: 'swapped-in' },
] } };
const THREE = [
  { ability: { name: 'gone' }, is_hidden: false, slot: 1 },
  { ability: { name: 'modern' }, is_hidden: false, slot: 2 },
  { ability: { name: 'kept' }, is_hidden: true, slot: 3 },
];
const mixed = applyPastAbilities('zz-test-species', THREE, 3);
delete PASTABIL['zz-test-species'];
check(mixed.length === 2, 'the removed slot is gone', JSON.stringify(mixed.map(x => x.ability.name)));
check(mixed[0].ability.name === 'swapped-in' && mixed[0].slot === 2,
  'and the replaced one keeps slot 2 even though it is now first in the list',
  JSON.stringify(mixed.map(x => x.slot)));
check(mixed[1].slot === 3 && mixed[1].is_hidden,
  'while the untouched hidden ability keeps slot 3', JSON.stringify(mixed[1]));

// --- species with no history at all -----------------------------------------------------------------
const PIKACHU = [{ ability: { name: 'static' }, is_hidden: false, slot: 1 }];
check(applyPastAbilities('pikachu', PIKACHU, 3) === PIKACHU,
  'a species with no recorded change is passed through untouched, not rebuilt');
check(applyPastAbilities('not-a-species', PIKACHU, 3) === PIKACHU, 'and so is an unknown species');
check(applyPastAbilities('gengar', [], 3).length === 0, 'an empty ability list stays empty');
check(applyPastAbilities('gengar', undefined, 3).length === 0, 'and a missing one does not throw');

// --- the table as a whole ----------------------------------------------------------------------------
const sp = Object.keys(PASTABIL);
check(sp.length >= 120, 'the table holds the measured ~141 species', sp.length);
let absent = 0, changed = 0, hidden = 0;
sp.forEach(k => Object.values(PASTABIL[k].gens).forEach(list => list.forEach(e => {
  if (!e.ability) absent++; else if (e.hidden) hidden++; else changed++;
})));
check(changed === 8, 'eight normal abilities genuinely changed', changed);
check(hidden === 21, 'twenty-one hidden abilities genuinely changed', hidden);
check(absent >= 100, 'and the bulk is slots that did not exist yet', absent);
/* If this ever goes non-zero, the generator has started shipping the 428 rows that only say a
   hidden slot predates Generation V — a rule the app already applies elsewhere. */
const dupHiddenRule = sp.filter(k => Object.values(PASTABIL[k].gens)
  .some(list => list.some(e => e.hidden && !e.ability))).length;
check(dupHiddenRule === 0,
  'the Generation V hidden-ability rule is not duplicated into this table', dupHiddenRule + ' species');

// --- and the app applies it before its other gates ----------------------------------------------------
check(/abilityList=applyPastAbilities\(p\.name,allAbilities,genNum\)/.test(src),
  'the species page resolves history before filtering by generation');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
