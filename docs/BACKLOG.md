# Backlog — HoopaDex

Planned work, newest thinking at the top of each entry. This file is the single list; anything
picked up moves to `CHANGELOG.md` when it ships. Items are not in priority order — the number is
an identifier, not a rank.

Status values: `open`, `in progress`, `blocked`, `done`.

---

## 0. The moves-table sort does nothing — `done` (4.1)

*Found 2026-08-03; shipped broken in 3.2 and fixed in 4.1, eight versions later.*

`sortMovesTable()` read every value through `td[data-<key>]` and `renderMovesSection()` emitted no
`data-*` attributes at all. Every comparison read `''` against `''`, every row tied, and a stable
sort left the order untouched — while the header still toggled its arrow, so the control looked
live. Both row emitters now carry the attributes.

**The guard is the interesting part.** This was a contract between two functions that were each
individually sensible, which is why no behavioural test caught it. `tests/test-move-table-contract.js`
derives the sortable keys from the header and the emitted attributes from the row, both out of the
shipped source, and asserts they agree. Pointed at the real 3.7 file it reports `emitted: []`.

## 1. Nuzlocke tracker — `open`

Track a Nuzlocke run inside the dex: first-encounter per route, which encounters are used, and
deaths.

**Open questions.** Which ruleset is the default (species clause, dupes clause, shiny clause)? Does
it persist in `localStorage` or export to a file? Is it per-game, or one run at a time?

## 2. ROM save upload for boss calc — `open`

**Partly superseded by item 19.** Showdown paste import (2.0) already gets a real set into the
calculator without parsing a save file. A save would still add actual in-game IVs/EVs and the box,
but the common case is covered.

Upload a save file and load the player's actual party into the damage calculator, so boss fights
are computed against real EVs, IVs, levels and items rather than assumptions.

**Open questions.** Which save formats — Gen III `.sav`, Gen IV/V DS saves, all of them? Does the
save stay in the browser (it should: parsing client-side keeps a personal file off any server)?
Does it import the party only, or the box too?

## 3. Fix dungeon labels — `open`

**Blocked on detail.** No string matching `dungeon` exists anywhere in `app/index.html`, so this
needs the specific labels that are wrong, or a screenshot. Likely refers to location names in the
Locations tab.

## 4. Regional dex filter toggle — `open`

Toggle the Pokédex between national numbering and the selected game's regional dex.

## 5. Strip Fairy type Gen I–V — `done` (1.98)

Fairy did not exist before Gen VI. `getMoveTypeForGen()` already reverts Fairy *moves* to Normal
for gens < 6 (`app/index.html`, in the move-type resolver), but Pokémon typing is not covered —
Clefable should read Normal in Gen V, and the type chart and matchups should follow. Check the
Team Builder and Dmg Calc paths too, not just the detail panel.

## 6. Team Builder: click through to Pokédex page — `done` (1.97)

Clicking a team member opens its detail page.

## 7. Team Builder: show ×0.25 and ×4 matchups — `done` (1.97)

The defensive matchup rows currently stop at ×½ and ×2. Dual types produce ×0.25 and ×4, which are
the ones that decide games.

## 8. Sprite matches selected generation — `done` (5.2)

Generations I–VII use their own sprites. VIII and IX fall through to the current sprite on purpose:
both are large 3D renders (33–42 KB against 1–9 KB for the pixel sprites) that look broken in the
same grid, and for IX the default sprite already *is* the Scarlet/Violet one. The `icons/` sets that
VII and VIII also publish are never used — 68×56 menu icons, not box sprites.

The open question is answered: nothing needs a placeholder. The dex already filters by generation,
so a Pokémon that did not exist then is not listed, and a sprite missing for a particular game falls
back to the modern one through one capture-phase listener rather than an `onerror` per image.

## 9. Gen I type chart: Fire does not resist Ice — `done` (1.97)

In Gen I, Fire did not resist Ice; that resistance was added in Gen II. Verify the rest of the Gen I
chart in the same pass — Bug/Poison and Ghost/Psychic also differ from the modern chart.

## 10. Verify stat bar colours — `done` (1.97)

**Needs a definition of correct.** Are the bars coloured by absolute thresholds, by percentile
against all Pokémon, or by a fixed scale to 255? Say which, and the check becomes mechanical.

## 11. Fix Urshifu move descriptions — `done` (1.97)

Wicked Blow and Surging Strikes always critically hit: 1.5× damage, and the crit ignores the
target's defensive stat boosts. Note that Unseen Fist lets contact moves bypass Protect and Detect.
Check whether the damage calculator models the guaranteed crit, or only the description is wrong.

## 12. Remember the selected form tab — `done` (4.6)

Choosing Rotom-Wash, navigating away and returning handed you plain Rotom, with nothing to show a
choice had been discarded. `showForm` renders a form without moving `adId` — correctly, since a form
is a view of the species and both the pins and the hash track the species — so returning re-rendered
the default.

Remembered per species for the session, restored only when the form is still loaded so the panel
never blocks on a refetch. Verified in the browser against Rotom.

## 13. Coverage calculator — `done` (5.7)

Shipped as the **Attacking Type Calculator** on the Type Chart tab, directly beneath the defending
one. That answers the open question about where it lives: the two are mirrors of each other and
belong together.

**The gap is the headline, not the coverage.** Fighting / Fire / Rock / Ground reports "7 of 18
types are not hit super effectively" and names them, because that is what you opened the tool to
find out. The full breakdown follows underneath.

Each defending type is scored by the **best** of the picks rather than the sum — in a battle you use
the move that works, so coverage is a maximum. `tests/test-coverage.js` asserts that property
directly: repeating a type changes nothing, and adding one can only ever help.

## 14. Generation I Special stat — `done` (5.2)

Gen I had one Special stat for both attacking and defending; Gen II split it. Charizard in Gen I now
reads HP 78 / Atk 84 / Def 78 / Special 85 / Spe 100, base total 425.

**Not derivable from the modern stats.** 46 of the 151 differ from modern Special Attack, because
the split often kept the old Special as the new Special *Defence* and raised Special Attack —
Charizard 85 vs a modern 109, Chansey 105 vs 35. Generated by `build/generate-gen1-special.js` from
Showdown's gen1 mod, where `spa === spd` encodes the single stat; the generator asserts that
equality rather than trusting it.

Both halves are set internally so the calculator and comparison need no special case; only the
visible list collapses to five rows.

## 15. Hide tabs that do not apply to the selection — `done` (1.97)

*Added 2026-08-02.* Champions mode hides Locations and EV Training. The rule lives in
`TAB_RELEVANCE` in `app/index.html`; a rule is one line, and `switchTab()` redirects saved links
that name a hidden tab.

**Open question.** Which tabs should Gen I hide? Gen I has no held items, and "EV Training" is the
wrong name for stat experience, but Moves and the bag-item list are both real in Red/Blue. Needs a
decision on Items and on EV Training for Gens I–II before more rules go in.

## 16. Audit the remaining generation-aware tables — `done` (4.5)

*Audited 2026-08-03. The pattern held: the table nobody had checked was wrong.*

| Table | Result |
|---|---|
| `CM` type chart (Gen VI+) | 324 cells, matches Showdown exactly |
| `C2` type chart (Gen II–V) | 289 cells, matches Showdown exactly |
| `C1` type chart (Gen I) | 225 cells, matches Showdown exactly |
| `ITEM_INTRO_GEN` | **67 of 325 entries wrong — 20.6%** |
| `EVO_OVERRIDES`, `REGIONAL` | not generation data — display labels only |

**The item table's errors were systematic, not scattered.** 39 Generation II held items filed under
Generation III (Leftovers, King's Rock, the whole type-boosting family, the original berries — held
items are the mechanic Gold/Silver introduced); 19 ORAS mega stones filed under Generation VII when
ORAS is Generation VI; 7 Gen I battle items filed under Generation III; 2 Gen VIII plates filed
under IX. Confirmed against two independent sources that agree — Showdown's `data/items.ts` and
PokéAPI's `game_indices`.

Invisible in the product, like every one of these: an item dated a generation late just does not
appear when you browse that generation, which is indistinguishable from an item that did not exist.

Now generated by `build/generate-item-gens.js`; derivation committed to `data/item-intro-gens.json`;
pinned by `tests/test-generation-tables.js`, which fails 56 ways against the old table.

**The charts being clean is worth recording too** — it is the first of these audits to come back
negative, and it means the type chart, the thing the app is most used for, is trustworthy.

## 17. Locations: Sword/Shield were wrongly blocked — `done` (1.99)

*Added 2026-08-02.* `UNSUPPORTED_VERSIONS` claimed PokéAPI had no encounter data for Sword and
Shield. It does. The app was hiding 92 Galar locations behind a message saying the data did not
exist. Re-check the API before adding a game to that list; do not assume by generation.

## 18. Type chart and natures readability — `done` (1.99)

*Added 2026-08-02.* Both encoded two states as green vs red, which measured ΔE 4.2 for
deuteranopia against a ≥8 target. Replaced with a validated blue/red diverging pair, plus glyphs
and arrows so colour is never the only encoding, recessive neutrals, and a crosshair on the chart.

**Still open from this thread.** The same audit has not been run on the other coloured signals —
encounter rarity (`loc-chance-*`), EV totals, TM status and the damage-roll colours. They are
single-state indicators rather than diverging pairs, so they do not have the same failure mode,
but none has been checked for contrast against either surface.

## 19. Four-move damage calc and paste import — `done` (2.0)

*Added 2026-08-02.* The calculator runs all four moves from a Team Builder slot at once, ranked
best-first, and the Team Builder imports Showdown/Pokepaste blocks.

**Watch item.** The species resolver accepts exact matches only, by design: an earlier draft matched
by prefix and silently substituted Urshifu-Single-Strike for Urshifu-Rapid-Strike. Do not
reintroduce fuzzy matching here — a wrong Pokémon in the team is worse than a named skip.

**Still open.** Export in the same format (the parser exists; the emitter does not), and the calc
does not yet apply the imported EVs, IVs, level or nature — it loads species, moves, item and
ability, and uses the attacker fields already on screen for the rest.


## 20. Megas, regionals and alt forms in the ability search — `done` (4.0)

*Asked for 2026-08-03: Mega Dragalge has Regenerator, base Dragalge does not, and the ability page
did not list it.*

**This was recorded as blocked on data that could not be derived. That was wrong, and the correction
is worth keeping.** Showdown carries every Z-A mega, and PokéAPI has since caught up as well —
`dragalge-mega` is id 10299 with `regenerator`, and the Regenerator ability page already listed it.
The entire item was plumbing.

**What was actually wrong.** `showAbilityPage()` filtered with `id>genMax` against a `genMax` that
never exceeds 1025. Every alternate form has an id above 10000, so all of them were discarded before
any other rule ran. Forms are now resolved to their base species by name (`baseSpeciesId()`) and
gated on two eras: the species must exist in the selected generation, and so must the form.

**Also fixed here.** `CHAMP_MEGA_ABILITIES` covered 23 of 41 Z-A megas; it is now generated by
`build/generate-mega-abilities.js` and covers all of them (45 rows, including Raichu's two distinct
megas, which one-row-per-species could not express). And Totem Pokémon were appearing in Generation
VIII because `-alola` was tested before `-totem`.

**Not done:** the same form plumbing in Team Builder and the calculator pickers — see item 25.

## 21. Moves tab type filter — `done` (4.1)

*Asked for three times.* Done in the same pass as item 0, as planned — both touch the rows emitted
by `renderMovesSection()`, and item 0 required adding data attributes to exactly those rows.

Only the types actually present on the Pokémon are offered, read off its moves rather than listing
all eighteen, so no option can match nothing. Filtering is done in the DOM like `filterPriority()`,
because re-rendering would discard the current sort. The filter persists across tab switches and the
count is per-tab.

## 22. Bulk calculator — when to invest Def/SpD over HP — `done` (4.2, corrected in 5.0)

**Shipped wrong in 4.2 and corrected in 5.0. Both halves are worth keeping.**

**4.2** brute-forced the stated rule — "spend each point on whichever current stat is lower" — and
found it exactly optimal on a neutral nature (260,100 combinations, zero misses) but off by up to
1.3% once a nature applies, because the floored multiplier means a hindering nature wastes the first
point. The obvious repair, highest marginal gain, is up to 41% worse. Shipped as an exact search.

**5.0** fixed the real error: it was optimising HP × Def **in isolation**, which ignores that a point
of HP multiplies *both* defences. Against a mixed attacker HP is worth about twice as much, so the
old advice — everything into the defence — was backwards for most of the roster.

Derived: one HP point gains (Def+SpD) and one defence point gains HP. **The target is
HP = Def + SpD, not HP = 2 × Def.** The two coincide when the defences are close, which is why the
folk rule survives; it fails on lopsided defenders like Skarmory (140/70 wants HP near 210,
not 280).

### Corrected 5.9 — the objective is a modelling choice, not a derivation

The architecture review of 2026-08-03 re-derived this and found the sentence it originally opened
with — *"total hits survived scales with HP × (Def + SpD)"* — is true only under one model, and was
stated as though it were the only mathematics. Both of these are correct, and they disagree:

| Model of the opponent | Quantity to maximise | Shipped? |
|---|---|---|
| Fully physical **or** fully special, even chance of each — maximise *expected* hits survived | HP × (Def + SpD) | yes |
| A mixture of both **within one battle** — maximise hits actually survived | HP × Def × SpD / (Def + SpD) | no |

The first is an average over two separate battles; the second is one battle. They are not the same
question and they do not have the same answer. Measured over all 208 Pokémon of Regulation M-B at
32 SP, cap 32, neutral nature, the two objectives pick **different spreads for 135 of 208 (64.9%)**.
Mean shortfall in hits survived under the mixed model is 0.95%; the worst case is Avalugg
(95/184/46), where the shipped answer 32/0/0 survives **10.49% fewer** mixed hits than 0/0/32.

The reason is that HP × (Def + SpD) is dominated by the *larger* defence, so it over-rewards HP;
real survivability is bottlenecked by the *weaker* one.

The tool still ships the first model — that is a product decision, not a bug, and it is now stated
in the Bulk tab rather than left implicit. What was wrong was the claim that it followed from the
mathematics alone.

**Figures withdrawn.** The published averages could not be reproduced. Against the Regulation M-B
roster the tool actually serves, at 32 SP / cap 32 / neutral, HP/(Def+SpD) averages **0.890**
(consistent with the published 0.90), but HP/(2×Def) averages **0.919, not 1.30**, and ranges
**0.41–1.42, not 0.43–5.50**. Ten combinations of budget (12–66), cap (32, 66) and nature
(0.9, 1.0, 1.1) were swept and none produced a mean near 1.30 or a maximum above 1.52. A maximum of
5.50 needs a Chansey- or Blissey-class stat line, and neither is in the Champions roster. The
population behind the original figures was never recorded, so they cannot be checked — which is the
finding. Every figure above now names its roster, budget, cap and nature.

**The lesson is the objective, not the arithmetic.** 4.2 was rigorous about solving the wrong
problem — brute-forced, tested against 294,912 combinations, and confidently wrong. 5.0 fixed the
objective but described it as a derivation. Checking the maths does not check that you asked the
right question, and *stating* the question is part of answering it.

## 23. Stat formula article — `done` (4.2)

*Shipped 2026-08-03 as `docs/STAT-FORMULA.md`.*

Champions, level 50, fixed 31 IVs: `stat = base + 20`, **`HP = base + 75`**, then +1 per Stat Point,
then the nature multiplier — and **natures never apply to HP**. The article leads with that
difference, because applying the non-HP formula to HP is out by 55 before a point is spent, and that
is the whole reason it exists.

**Generated, not written.** `build/generate-stat-formula.js` slices the app's own `bulkStat()` and
`SPEED_COLS` and computes every figure from them, so the article cannot state a formula the app does
not use. `tests/test-stat-formula-doc.js` recomputes the headline numbers and asserts the document
still says them — change the HP constant without rerunning the generator and it fails on four
assertions.

It also documents the floored nature multiplier: a hindering nature makes the first Stat Point worth
zero, which is the mechanism behind item 22's finding.

## 24. Damage calculator: team selector and paste both sides — `done` (5.1, 5.4)

Both panels can load a saved team member (5.1) or take a pasted Showdown set (5.4). Both routes go
through one `calcApplySet`, so a pasted set and a saved set cannot resolve differently — they were
otherwise going to drift, and the way they would drift is the spread quietly not being applied,
which is the exact bug the team picker was added to fix.

**5.4 also fixed a bug 5.1 introduced.** The nature was applied without regard to the move's damage
class, so a Jolly physical attacker was given 0.9 — Jolly lowers Special Attack, which is irrelevant
to Close Combat — understating its damage by 10%. The multiplier now follows the move category and
is re-derived when the move changes. Found by pasting a real set in and reading the field, not by a
test; `tests/test-calc-nature.js` now covers it and fails three ways against the old logic.

## 25. Megas, regionals and alt forms in Team Builder and calc pickers — `done` (4.4)

Same gap as item 20, different surfaces. Both consulted only `master`, which stops at 1025, so no
Mega or regional form could be put on a team or calculated against — the forms whose stats and
typing actually change a calculation were the ones you could not select.

The 326 forms load once as a second page of the endpoint `master` already uses, and are kept out of
`master` on purpose: it backs the Pokédex list, and a dex listing Charizard three times is not a dex.

**The real fix was consolidation.** All three surfaces now share `formAllowed()`. Each used to
answer "does this belong here?" for itself, and only the ability page ever learned about forms,
which is precisely why the other two lagged. `@smogon/calc` needed no translation — it flattens
species names the same way PokéAPI slugs do.

## 26. Move-class articles; item changes and a patch-notes link — `open` (items and moves done)

**Moves (5.3):** no change between M-A and M-B. All 186 Pokémon in both regulations learn exactly
the same moves; the extra entries belong to the 22 new species. The page says so rather than staying
silent.

**Items (5.8):** 31 items became legal in M-B, none removed. There *was* a data source — Showdown
carries the regulations as separate mods, and `championsregma` inherits from `champions`, so its
items.ts contains only the differences. Twelve are mega stones tracking the roster; the rest are a
real format shift — Life Orb, Expert Belt, Muscle Band, Wise Glasses, Wide Lens, Zoom Lens,
Metronome, Big Root, Shed Shell, Iron Ball, Light Clay, and all four weather rocks together.

The absence is evidence too: `championsregma` has no moves.ts or learnsets.ts, which independently
confirms the move finding by a separate route.

**Still open:**
- **A patch-notes link** per transition. Needs the URLs.
- **Move-class articles** — the original half of this item, untouched.

## 27. Team editor: clicking the backdrop silently saves — `done` (4.3)

*Found 2026-08-03 while fixing the stat-spread bug; fixed in 4.3.*

The overlay was `onclick="if(event.target===this)saveTeamEdit(idx)"`, and the ✕ called
`saveTeamEdit` too. Both gestures read as "dismiss this" and both committed, with no undo and no
cancel in the dialog at all.

That is what made the 3.9 read bug destructive rather than cosmetic — losing a spread needed nothing
more than clicking outside the dialog. Backdrop, ✕ and Escape now discard, there is an explicit
Cancel, and Done is the only thing that commits. `tests/test-team-edit-stats.js` asserts all of it
against the shipped markup and fails six ways against the real 3.9 file.

## 28. Hidden-ability pill needs a solid colour — `done` (3.8)

*Asked for three times; two earlier attempts rejected.* `.ability-tag.hidden` and the ability-page
"Hidden" badge were both `background:transparent` in both themes, so the only thing marking a hidden
ability was a faint purple border. Both are now solid fills, verified opaque in both themes by
computed style.

**Not visually confirmed by Will at time of writing.** Screenshots did not composite in that
session, so the colour choice itself is unverified by eye — reopen if the third attempt is wrong too.

## Champions move mechanics are inherited, not verified

`MOVETEXT` (v5.32) corrects a move's one-line description for the generation on screen, from
Showdown's per-generation text. Showdown documents the **mainline games**. Nothing published
describes Pokemon Champions' move mechanics separately.

Champions selects Generation IX in this app, so it inherits Scarlet/Violet wording. That is very
probably right — Champions appears to build on SV mechanics — and it is **not verified**. The panel
therefore names the rules it is quoting ("Scarlet/Violet rules") rather than implying the check has
been done.

What would close it: a published source for Champions move behaviour, or a diff of the Champions
battle engine against SV. Until one exists, the honest position is the label. Do not quietly relabel
it "Champions" — that would be a claim the data cannot support, which is the failure mode this
project exists to prevent.

Related: the app already knows Champions differs in roster, legality, items and the stat system.
Move *mechanics* is the one axis it has no source for.

## ~~The ability page still lists species by their modern ability~~ — CLOSED in v5.34

As of v5.33 a species page resolves its abilities for the selected generation — Gengar shows Levitate
in Generations III to VI. The REVERSE join is not done: the Levitate page does not list Gengar in
those generations, and the Cursed Body page still does.

The forward direction is the one a reader hits first, and half a fix that looks whole is worse than
an obvious gap, so this was written down rather than partly shipped.

**Closed in v5.34** by `abilityHoldersForGen`, which does both directions: it adds species whose past
ability was this one and removes species whose modern ability is this one but was not then. Verified
at the boundary — Levitate lists Gengar in Generations IV to VI and not in VII or IX.

## Move effect changes were audited and deliberately skipped

PokeAPI's `moveeffectchange` table has 28 rows recording per-version-group effect changes. They
overlap what `MOVETEXT` already derives from Showdown's per-generation text (v5.32), so adding them
would be a second source for the same fact.

Not "too small to bother with" — the reason is that two sources for one fact is the failure this
project spends most of its effort avoiding. If Showdown's coverage is ever found wanting for a
specific move, this is where to look first.

## The damage engine is unverified with items and abilities

`tests/test-calc-engine.js` checks the formula with an inert ability and no item on both sides, on
purpose: a species' real ability changes the damage — Thick Fat, Huge Power, Levitate — and mixing
that in would have made the cross-check a test of ability implementations rather than of the formula.

So Choice Band, Life Orb, Huge Power, Thick Fat and the rest are unverified in the engine. They are
also exactly what a competitive player brings, which makes this the most valuable remaining gap in
the calculator.

Closing it needs a different oracle. Hand-working a damage figure with an item and an ability is
doable but slow; the practical route is probably a published set of calculations from the Showdown
calculator's own test suite, if one can be extracted.

