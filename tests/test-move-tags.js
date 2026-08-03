/* HoopaDex — move descriptor tag tests
 * Run: node tests/test-move-tags.js
 *
 * Slices the REAL MOVE_FLAG_INFO table and the REAL moveDescriptors()/renderMoveTags() out of
 * app/index.html so the tests cannot drift from shipped code.
 *
 * Move flags decide which abilities and items interact with a move. Aura Sphere is both `bullet`
 * and `pulse`, which is why Mega Launcher boosts it and Bulletproof blocks it outright — a fact
 * that decides games and is invisible in a plain move description.
 *
 * The flags themselves are DERIVED at runtime from the bundled calc engine, so they cannot drift
 * from what the damage calculator uses; there is nothing to unit-test there beyond the contract
 * that a missing engine degrades to no tags rather than to a confident wrong answer. What IS
 * hand-written — the ability and item consequences — is what this suite checks.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const lines = src.split(/\r?\n/);
const start = lines.findIndex(l => l.startsWith('const MOVE_FLAG_INFO='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function renderVariableMoveInfo'));
if (start < 0 || end < 0) throw new Error('could not locate the move descriptor code');

// No calc engine in node — that is the point of the degradation tests below.
const app = eval(lines.slice(start, end).join('\n') + '\n;({MOVE_FLAG_INFO,moveDescriptors,renderMoveTags})');
const INFO = app.MOVE_FLAG_INFO;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

// --- degradation: no engine must mean no tags, never a wrong tag ----------------------
check(Array.isArray(app.moveDescriptors('Aura Sphere')), 'moveDescriptors always returns an array', '');
check(app.moveDescriptors('Aura Sphere').length === 0, 'without the calc engine, no flags are claimed', '');
check(app.renderMoveTags('Aura Sphere') === '', 'without the calc engine, nothing is rendered', '');
check(app.moveDescriptors(undefined).length === 0, 'a missing move name does not throw', '');
check(app.moveDescriptors('').length === 0, 'an empty move name does not throw', '');

// --- the hand-written half: every flag the engine can emit must be explained -----------
// These eight are the flags observed on the bundled engine's move data. A flag with no entry
// would silently render no tag, which is the failure mode this guards.
const ENGINE_FLAGS = ['contact', 'punch', 'bite', 'pulse', 'slicing', 'sound', 'bullet', 'wind'];
for (const f of ENGINE_FLAGS) {
  check(!!INFO[f], `flag "${f}" has an entry`, Object.keys(INFO));
  if (INFO[f]) check(typeof INFO[f].label === 'string' && INFO[f].label.length > 0, `flag "${f}" has a label`, INFO[f]);
}

// --- the interactions that actually decide games --------------------------------------
const boostedBy = (flag, ability) => (INFO[flag]?.boosts || []).some(b => b.by === ability);
check(boostedBy('punch', 'Iron Fist'), 'Iron Fist is recorded against punch moves', INFO.punch);
check(boostedBy('bite', 'Strong Jaw'), 'Strong Jaw is recorded against bite moves', INFO.bite);
check(boostedBy('pulse', 'Mega Launcher'), 'Mega Launcher is recorded against pulse moves', INFO.pulse);
check(boostedBy('slicing', 'Sharpness'), 'Sharpness is recorded against slicing moves', INFO.slicing);
check(boostedBy('sound', 'Punk Rock'), 'Punk Rock is recorded against sound moves', INFO.sound);
check(boostedBy('contact', 'Tough Claws'), 'Tough Claws is recorded against contact moves', INFO.contact);

// The three that block a move outright are the most consequential and must say so in those words,
// because renderMoveTags keys its "blocked" styling off that phrasing.
const blocks = f => (INFO[f]?.risks || []).some(r => /Blocked entirely/.test(r));
check(blocks('bullet'), 'Bulletproof is recorded as blocking ballistic moves outright', INFO.bullet);
check(blocks('sound'), 'Soundproof is recorded as blocking sound moves outright', INFO.sound);

// Contact is the one with defensive consequences rather than a block.
check((INFO.contact.risks || []).length >= 3, 'contact lists its defensive punishers', INFO.contact.risks);
check(/Protective Pads/.test(INFO.contact.negatedBy || ''), 'contact records what negates it', INFO.contact.negatedBy);

// --- multipliers are present and formatted consistently --------------------------------
const allBoosts = Object.values(INFO).flatMap(i => i.boosts || []);
check(allBoosts.length >= 6, 'several boosting abilities are recorded', allBoosts.length);
check(allBoosts.every(b => /^×[\d.]+$/.test(b.mult)), 'every multiplier is written as ×N', allBoosts.map(b => b.mult));
check(allBoosts.every(b => b.by && b.by[0] === b.by[0].toUpperCase()), 'ability names are capitalised', '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
