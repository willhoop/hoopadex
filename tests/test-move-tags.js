/* HoopaDex — move descriptor tag tests
 * Run: node tests/test-move-tags.js
 *
 * Slices the REAL moveDescriptors()/ixFlagConsequences()/renderMoveTags() out of app/index.html so
 * the tests cannot drift from shipped code.
 *
 * Move flags decide which abilities and items interact with a move. Aura Sphere is both `bullet`
 * and `pulse`, which is why Mega Launcher boosts it and Bulletproof blocks it outright — a fact
 * that decides games and is invisible in a plain move description.
 *
 * WHAT CHANGED IN 5.29, AND WHY THIS SUITE LOOKS DIFFERENT
 * -------------------------------------------------------
 * Until 5.29 the consequences were a hand-written table, `MOVE_FLAG_INFO`, and this suite checked
 * that the hand-written entries were present and well-formed. That was checking the wrong thing.
 * The table was incomplete in a way no assertion about its shape could ever catch: it named three
 * of the eighteen abilities that punish contact, had no entry for powder or reflectable, and gave
 * Punching Glove a description that was not a sentence. Meanwhile the same facts sat in Showdown's
 * source in machine-readable form.
 *
 * The consequences are now derived (see build/generate-interactions.js) and the only hand-written
 * thing left is presentation vocabulary — a label and a gloss per flag. So the assertions moved
 * with the code: this suite now checks that the derived facts arrive intact, that the label table
 * stays complete against the flags the engine can emit, and that nothing here makes a factual claim
 * about an ability at all.
 *
 * The old suite also asserted that a missing calc engine produced NO tags. That was the shipped
 * behaviour and it was worse than the alternative: a move opened before the damage calculator had
 * ever been loaded showed nothing. There is now a build-time table to fall back on, so the contract
 * is "the engine if it is there, the embedded table otherwise" — and the assertions below pin the
 * fallback rather than the old silence.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const lines = src.split(/\r?\n/);
const ixLine = lines.find(l => l.startsWith('const IX='));
const ixTitleLine = lines.find(l => l.startsWith('function ixTitle('));
const start = lines.findIndex(l => l.startsWith('const MOVE_TAG_NOTE='));
const end = lines.findIndex((l, i) => i > start && l.startsWith('function renderVariableMoveInfo'));
if (!ixLine || !ixTitleLine || start < 0 || end < 0) throw new Error('could not locate the move descriptor code');

/* No calc engine in node — that is deliberate, and it is what exercises the fallback. getDataGenNum
   is the app's generation selector and is stubbed rather than sliced, because which generation is
   selected is a UI question; what this suite tests is what each generation is TOLD. */
/* Indirect eval, so the slice gets its own scope. A direct eval() shares this module's scope and
   the destructuring below would collide with the function declarations it just created. */
const app = (0, eval)(
  ixLine + '\n' + ixTitleLine + '\n' +
  'var GEN=9; function getDataGenNum(){return GEN}\n' +
  lines.slice(start, end).join('\n') +
  '\n;({IX,MOVE_TAG_NOTE,moveDescriptors,ixFlagConsequences,renderMoveTags,setGen:function(g){GEN=g}})'
);
const { IX, MOVE_TAG_NOTE, moveDescriptors, ixFlagConsequences, renderMoveTags, setGen } = app;

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : JSON.stringify(detail))); }
}

// --- the fallback: no engine must mean the build-time answer, not silence ----------------------
const as = moveDescriptors('aura-sphere');
check(Array.isArray(as), 'moveDescriptors always returns an array');
check(as.indexOf('pulse') >= 0 && as.indexOf('bullet') >= 0,
  'without the calc engine, Aura Sphere is still known to be both pulse and ballistic', as);
check(as.indexOf('protect') < 0,
  'and `protect` is never tagged — 669 of 953 moves carry it, so the badge would distinguish nothing', as);
check(moveDescriptors('this-is-not-a-move').length === 0, 'an unknown move claims no flags');
check(moveDescriptors(undefined).length === 0, 'a missing move name does not throw');
check(moveDescriptors('').length === 0, 'an empty move name does not throw');
check(renderMoveTags('this-is-not-a-move') === '', 'a move with no flags renders nothing at all');

// --- the label table stays complete against what the engine can emit ---------------------------
/* A flag with no entry silently renders no tag. That is the failure this guards, and it is why the
   list below is the flags observed on the bundled engine's data rather than the keys of the table
   being tested — checking a table against itself proves nothing. */
const ENGINE_FLAGS = ['contact', 'punch', 'bite', 'pulse', 'slicing', 'sound', 'bullet', 'wind'];
for (const f of ENGINE_FLAGS) {
  check(!!MOVE_TAG_NOTE[f], `flag "${f}" has an entry`, Object.keys(MOVE_TAG_NOTE));
  if (MOVE_TAG_NOTE[f]) {
    check(typeof MOVE_TAG_NOTE[f].label === 'string' && MOVE_TAG_NOTE[f].label.length > 0, `flag "${f}" has a label`);
    check(typeof MOVE_TAG_NOTE[f].note === 'string' && MOVE_TAG_NOTE[f].note.length > 0, `flag "${f}" has a gloss`);
  }
}
/* Every flag that has a label must also be a flag the derived table knows, or the tag renders with
   a gloss and no consequences and the reader cannot tell whether that means "nothing interacts with
   this" or "we lost the data". */
const unknown = Object.keys(MOVE_TAG_NOTE).filter(f => !IX.flagLabels[f]);
check(unknown.length === 0, 'every labelled flag is one the derived table carries', unknown);

// --- the consequences are derived, and nothing here asserts them by hand ----------------------
const names = f => ixFlagConsequences(f, 9).map(c => c.t);
check(names('pulse').some(t => /^Mega Launcher boosts it ×1\.5$/.test(t)),
  'pulse consequences name Mega Launcher and its multiplier', names('pulse'));
check(names('bullet').indexOf('Blocked by Bulletproof') >= 0,
  'ballistic moves are blocked by Bulletproof', names('bullet'));
check(names('sound').indexOf('Blocked by Soundproof') >= 0, 'sound moves are blocked by Soundproof');
check(names('sound').some(t => /Punk Rock takes 50% less/.test(t)),
  'and Punk Rock resists them, stated as a reduction', names('sound'));
check(names('punch').some(t => /^Iron Fist boosts it ×1\.2$/.test(t)), 'Iron Fist boosts punching moves ×1.2');
check(names('bite').some(t => /^Strong Jaw boosts it ×1\.5$/.test(t)), 'Strong Jaw boosts biting moves ×1.5');
check(names('slicing').some(t => /^Sharpness boosts it ×1\.5$/.test(t)), 'Sharpness boosts slicing moves ×1.5');
check(names('powder').indexOf('Blocked by Overcoat') >= 0, 'powder moves are blocked by Overcoat');
check(names('reflectable').indexOf('Blocked by Magic Bounce') >= 0, 'reflectable moves are bounced by Magic Bounce');

/* Contact is the entry the hand table got most wrong — it listed three punishers. Derivation finds
   every ability whose code asks checkMoveMakesContact, plus the items. Naming several here is not
   redundancy: it is the assertion that the count did not quietly collapse back to a handful. */
const contact = names('contact');
['Rough Skin', 'Iron Barbs', 'Static', 'Flame Body', 'Poison Point', 'Effect Spore',
 'Rocky Helmet', 'Gooey', 'Mummy', 'Tangling Hair', 'Aftermath', 'Perish Body']
  .forEach(a => check(contact.indexOf(a) >= 0, `contact punisher "${a}" is found`, contact));
check(contact.length >= 15, 'contact names at least fifteen consequences, not three', contact.length);
check(contact.some(t => /^Tough Claws boosts it ×1\.3$/.test(t)), 'and Tough Claws boosts them ×1.3', contact);
check(contact.indexOf('Long Reach removes it') >= 0, 'and Long Reach is recorded as removing contact');
check(contact.some(t => /^Unseen Fist removes its protectable status$/.test(t)),
  'a strip rule names the flag it removes — "Unseen Fist" alone tells a reader nothing',
  contact.filter(t => /Unseen Fist/.test(t)));

/* The tag tooltip used to be capped, ranked and truncated, because contact carries twenty-two
   consequences and twenty of them are abilities the move merely SETS OFF. Reported from the live
   site as repetitive — "of course i know a contact move sets off gooey" — and it was right: those
   twenty are what the word "contact" means, they are identical on every contact move in the game,
   and they were crowding out the three entries that are actually about this move.

   They are now dropped at the render site, so the cap, the ranking that kept the boost above the
   cap, and the overflow line are all gone with them. What a tag tooltip may contain is what the
   tag COSTS or BUYS. */
const contactTag = renderMoveTags('aerial-ace');
const contactTitle = (contactTag.match(/title="([^"]*)"/) || [])[1] || '';
const contactBits = contactTitle.split(' · ');
check(!/and \d+ more/.test(contactTitle),
  'the tooltip is short enough to state outright, so nothing is truncated', contactTitle);
check(contactBits.length <= 6, 'and it is a handful of entries, not a paragraph', contactBits.length);
check(/Tough Claws boosts it ×1\.3/.test(contactTitle), 'the boost is named with its multiplier', contactTitle);
check(/Long Reach removes it/.test(contactTitle), 'and so is what removes the tag');
/* The assertion that keeps it clean. Every one of these is a real contact consequence and every one
   of them is noise on a move page: they follow from the tag, not from the move. */
['Gooey', 'Aftermath', 'Effect Spore', 'Static', 'Rough Skin', 'Cute Charm', 'Flame Body']
  .forEach(a => check(contactTitle.indexOf(a) < 0,
    `"${a}" is not listed — it is a property of the tag, not of this move`, contactTitle));
/* ...but the derivation still knows them, because the ability pages answer "what sets this off"
   and that is where the list belongs. The checks above on `contact` assert exactly that. */
check(ixFlagConsequences('contact', 9).filter(c => c.trigger).length >= 15,
  'the triggers are still derived and marked, just not rendered here',
  ixFlagConsequences('contact', 9).filter(c => c.trigger).length);

/* THE CHIP FACE STATES WHAT THE MOVE IS, NOT A NUMBER.
   It used to read "CONTACT ×1.3" and was asked, from the live site, what that meant. The
   question was the finding: a multiplier printed next to a move reads as a property OF THE MOVE,
   and it is not one. Nothing about Mortal Spin is ×1.3 — that is what Tough Claws does to it, and
   only for the handful of Pokemon that have Tough Claws. On every other Pokemon the number is
   simply false, which is this project's oldest failure mode wearing a very small badge.

   The multiplier lives in the hover text now, where the ability doing the multiplying can be
   named. */
const spinTag = renderMoveTags('mortal-spin');
check(!/×/.test(spinTag.replace(/title="[^"]*"/g, '')),
  'no multiplier is printed on the face of a tag chip', spinTag.replace(/title="[^"]*"/g, ''));
check(!/<b>/.test(spinTag), 'and the bold multiplier element is gone with it', spinTag);
check(/Tough Claws boosts it ×1\.3/.test((spinTag.match(/title="([^"]*)"/) || [])[1] || ''),
  'the number survives in the hover text, with the ability that causes it named',
  (spinTag.match(/title="([^"]*)"/) || [])[1]);
/* The verb is the whole point. "Tough Claws ×1.3" is a name beside a number and leaves the reader
   to supply the relationship; the one they supply is the wrong one. */
check(ixFlagConsequences('contact', 9).filter(c => c.boost)
        .every(c => / boosts it ×/.test(c.t)),
  'every boost states the relationship, not just a name and a number',
  ixFlagConsequences('contact', 9).filter(c => c.boost).map(c => c.t));

/* THE COLOUR A TAG DESERVES, and why contact is not blue.
   Contact used to render in the "good for you" colour because Tough Claws boosts it. Eighteen
   abilities punish it. Calling that good is the same overclaim as printing x1.3 on the face: true
   of one ability, false of the situation. Blue now requires a boost AND nothing punishing the tag. */
const roleOf = (move, label) => {
  const m = renderMoveTags(move).match(new RegExp('class="(mv-tag[^"]*)"[^>]*>' + label));
  return m ? m[1] : null;
};
check(roleOf('aerial-ace', 'Contact') === 'mv-tag',
  'contact is neutral - one ability boosts it, eighteen punish it', roleOf('aerial-ace', 'Contact'));
check(roleOf('ice-punch', 'Punch') === 'mv-tag mv-tag-boost',
  'punching is good for you - boosts and nothing that punishes it', roleOf('ice-punch', 'Punch'));
check(roleOf('aura-sphere', 'Ballistic') === 'mv-tag mv-tag-block',
  'ballistic is bad for you - Bulletproof stops it dead', roleOf('aura-sphere', 'Ballistic'));
check(roleOf('aura-sphere', 'Pulse') === 'mv-tag mv-tag-boost',
  'and the same move can carry one of each');

/* THE FALLBACK CONTRACT, exercised with an engine present. Every other assertion in this file runs
   with no calc engine at all, so the engine branch was never executed here — and that is where the
   defect was. The bundled engine carries `flags:{}` on a great many moves; an empty object is
   truthy, so `if(m.flags) return keys(m.flags)` returned [] and short-circuited the build-time
   table that had the answer. 77 of the 441 moves with known tags rendered no tags at all: every
   reflectable move in the game, and every powder move. */
/* Wrapped in an IIFE so the slice gets a FUNCTION scope. An indirect eval runs in global scope, so
   without this the `var CalcMaps` below would overwrite the one the rest of this file uses, and
   every later assertion would silently be testing a fake engine. It did, on the first attempt. */
const withEngine = (flags) => (0, eval)('(function(){\n' +
  ixLine + '\n' + ixTitleLine + '\n' +
  'var GEN=9; function getDataGenNum(){return GEN}\n' +
  'var SmogonCalc={};\n' +
  'var CalcMaps={gen:{moves:{get:function(){return {flags:' + JSON.stringify(flags) + '}}}}};\n' +
  'function calcEnsureMaps(){}\n' +
  lines.slice(start, end).join('\n') +
  '\nreturn moveDescriptors;})()'
);
check(withEngine({})('sleep-powder').length > 0,
  'an EMPTY engine flags object falls through to the build-time table rather than answering []',
  JSON.stringify(withEngine({})('sleep-powder')));
check(withEngine({})('sleep-powder').indexOf('powder') >= 0,
  'so Sleep Powder still knows it is a powder move', JSON.stringify(withEngine({})('sleep-powder')));
check(withEngine({ sound: 1 })('sleep-powder').join() === 'sound',
  'but an engine that actually says something still wins over the table',
  JSON.stringify(withEngine({ sound: 1 })('sleep-powder')));

/* WHAT THE MOVE TOOLTIP SAYS ABOUT ITS TAGS, and what it no longer says.
   It used to print "Boosted x1.3 by Tough Claws ABILITY" under the move. Reported from the live
   site as "kill the tough claws all we need to know is contact". The Pokemon holding the move
   almost certainly does not have Tough Claws, so the line is false far more often than true - the
   same overclaim the chip face carried until 5.43, moved one line down rather than removed. The
   tooltip now shows the tag pills and nothing else. */
check(/renderVariableMoveInfo\(name\)\+\s*\/\*[\s\S]{0,600}?renderMoveTags\(name\)/.test(src),
  'the move tooltip shows its tags, not a list of who acts on them');
/* The definition, not the name — the comment left where it used to live names it on purpose, so
   that anyone about to rebuild it reads why it went first. */
check(!/function renderMoveInteractions\(/.test(src),
  'and the renderer that listed them is gone from the app entirely');
/* An emoji is not a label. It carried no meaning the heading did not already carry, and it was the
   only one in the interface. */
check(!/⚡/.test(src), 'no lightning-bolt emoji is rendered anywhere');

// --- consequences are cut to the generation ----------------------------------------------------
check(ixFlagConsequences('pulse', 5).length === 0,
  'Gen V is told nothing about pulse moves, because Mega Launcher is a Gen VI ability',
  names('pulse'));
check(ixFlagConsequences('sound', 5).map(c => c.t).indexOf('Blocked by Soundproof') >= 0,
  'but Soundproof does reach back to Gen V');
check(ixFlagConsequences('slicing', 8).length === 0, 'and Sharpness does not exist before Gen IX');

// --- the rendered tag ---------------------------------------------------------------------------
setGen(9);
const tags = renderMoveTags('aura-sphere');
check(/mv-tag-boost/.test(tags), 'Aura Sphere is marked as boosted, because it is a pulse move', tags);
check(/mv-tag-block/.test(tags), 'and as blockable, because it is also ballistic');
check(/×1\.5/.test(tags), 'and the multiplier is on the tag itself, not only in the tooltip');
check(/Mega Launcher/.test(tags) && /Bulletproof/.test(tags), 'both are named in the tooltip text');
/* Escaping cannot be tested against the real table, because no ability or item in the game has a
   quote in its name — so an assertion over the shipped data passes whether the escape is there or
   not. The mutation check proved that: deleting the .replace() left this suite green. A hostile
   name has to be injected to test the guard at all. It is not hypothetical either; the tooltip is
   built by string concatenation into an HTML attribute, and the name comes from a generated file. */
IX.abilities['x"onmouseover="alert(1)'] = { rules: [{ flag: 'pulse', kind: 'block', mult: null }] };
const escaped = renderMoveTags('aura-sphere');
delete IX.abilities['x"onmouseover="alert(1)'];
check(/&quot;/.test(escaped), 'a quote in the tooltip text is escaped to &quot;', escaped.slice(0, 200));
check(!/onmouseover="alert/.test(escaped),
  'so it cannot close the title attribute and open a new one', escaped.slice(0, 300));
check((escaped.match(/<span class="mv-tag/g) || []).length === 2,
  'and the tag markup is still exactly two spans, not more', escaped);
setGen(5);
const tags5 = renderMoveTags('aura-sphere');
check(!/mv-tag-boost/.test(tags5) && !/Mega Launcher/.test(tags5),
  'and in Gen V the same move carries its flags with none of the Gen VI consequences', tags5);
setGen(9);

// --- no hand-written ability claims remain in the vocabulary table ------------------------------
/* The point of 5.29 is that this file holds exactly one claim about Mega Launcher. If a label or a
   gloss starts naming abilities again, there are two. */
const abilityWords = Object.values(MOVE_TAG_NOTE)
  .flatMap(i => [i.label, i.note])
  .filter(t => /Mega Launcher|Iron Fist|Strong Jaw|Sharpness|Punk Rock|Tough Claws|Bulletproof|Soundproof|Rocky Helmet/.test(t));
check(abilityWords.length === 0,
  'the label table makes no factual claim about any ability — those are all derived', abilityWords);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
