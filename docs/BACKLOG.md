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

## 8. Sprite matches selected generation — `open`

Show the sprite from the selected generation rather than current artwork. PokéAPI serves these
under `sprites.versions.generation-*`.

**Open question.** What renders for a Pokémon that did not exist in the selected generation — the
modern sprite, a placeholder, or is it filtered out of the list already?

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

## 12. Remember the selected form tab — `open`

Navigating away from a multi-form Pokémon and back resets to the first form. Rotom is the case to
test.

## 13. Coverage calculator — `open`

Enter a set of move types; see which types are hit super effectively, neutrally, resisted and
immune.

**Open question.** Where does it live — its own tab, or inside Team Builder next to the defensive
matchups?

---

## 14. Generation I Special stat — `open`

*Added 2026-08-02 while fixing the historical base stat table (see CHANGELOG 1.96).*

Gen I had a single Special stat rather than the Sp. Atk / Sp. Def split. `PAST_STATS` deliberately
does not model this, because it is a display question rather than a value substitution: the dex
would need to show one Special bar for Gen I, not two identical ones. Showdown's `gen1` mod carries
the values (152 species) whenever the display side is decided.

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

## 22. Bulk calculator — when to invest Def/SpD over HP — `done` (4.2)

*Shipped 2026-08-03 as the Bulk tab under Other.*

**The rule specified here was wrong, and the brute force is what said so.** The entry said
"maximise HP × Def; spend each point on whichever CURRENT stat is lower", with the instruction
"VERIFY AGAINST BRUTE FORCE BEFORE SHIPPING — I did not." Verified before writing any of it:

- **Neutral nature: the rule is exactly optimal.** 260,100 combinations, zero misses. A neutral stat
  gains exactly +1 per point, so comparing current levels and comparing marginal gains are the same
  comparison.
- **With a nature: not optimal** — wrong in 13–26% of cases, by up to 1.3%.
  `Math.floor((base+20+sp)*nature)` does not step by 1. A hindering nature wastes the first point
  outright and a boosting one occasionally pays 2.
- **"Spend where the marginal gain is highest" is much worse** — up to 41% off — because a zero-gain
  first point stops it ever starting on a defence. Kept as a test so it is not reintroduced.

Shipped as an exact search over all ≤33 splits instead. `tests/test-bulk-split.js` re-derives every
one of those claims and confirms the shipped function equals brute force across 294,912
combinations; swapped for the greedy rule it fails with 32,298 misses.

**The substantive finding.** For most of the roster the optimum is to put *everything* into the
defence, because HP starts 55 points higher (`base+75` vs `base+20`) and the two are nowhere near
balanced to begin with. The interesting cases are the already-lopsided ones.

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

## 24. Damage calculator: team selector and paste both sides — `open`

Pick attacker and defender from the built team; paste a full set for either side; auto-populate all
four moves; report Showdown-style damage ranges.

Overlaps the "still open" half of item 19 — the calc does not yet apply imported EVs, IVs, level or
nature.

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

## 26. Move-class articles; item changes and a patch-notes link — `open`

Articles on the move classes, plus item changes surfaced in the regulation diff with a link to the
patch notes.

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
