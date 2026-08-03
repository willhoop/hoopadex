# Backlog — HoopaDex

Planned work, newest thinking at the top of each entry. This file is the single list; anything
picked up moves to `CHANGELOG.md` when it ships. Items are not in priority order — the number is
an identifier, not a rank.

Status values: `open`, `in progress`, `blocked`, `done`.

---

## 0. The moves-table sort does nothing — `open`

**Found 2026-08-03 while working on v3.8. Not fixed in that pass because it is unrelated to what
was asked for, and it deserves its own version.**

`sortMovesTable()` reads every sort key through
`cellOf = (r,key) => r.querySelector('td[data-'+key+']')?.getAttribute(...)`, but
`renderMovesSection()` emits no `data-name`, `data-cat`, `data-type`, `data-pow`, `data-acc` or
`data-lv` attributes on any `<td>`. Confirmed by count: the file contains zero occurrences of
`data-pow`, `data-type` and `data-lv`, and the single `data-acc` hit is `data-accent` on the detail
panel. Every comparison therefore reads `''` against `''`, every row ties, and the sort is a
stable no-op.

The header still toggles its `ms-asc` / `ms-desc` arrow, so the control looks like it worked. This
shipped in 3.2 as "sortable moves".

**Fix.** Emit the data attributes in `renderMovesSection()` — they are the values already being
rendered into each cell. **Then prove it:** a test that asserts the sorted order changes, checked by
mutation against a copy of the source, because this is precisely the class of bug the existing
suites' own history warns about (whitepaper 5.1 — the Pokédex sort tests were passing vacuously for
the same reason: the assertion never observed the thing it claimed to test).

**Note.** Backlog item for the Moves tab type filter should be done in the same pass, since it
touches the same rows.

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

## 16. Audit the remaining generation-aware tables — `open`

*Added 2026-08-02.* Three of the tables behind the generation-accuracy claim have now been found
wrong on inspection: `PAST_STATS` (10 of 43 entries correct, fixed in 1.96), the Gen I type chart
(`C1`, fixed in 1.97), and Pokémon typing (absent entirely, fixed in 1.98). Each was found only
because someone looked.

Not yet audited: `ITEM_INTRO_GEN`, `EVO_OVERRIDES`, `REGIONAL`, and the `C2`/`CM` type charts —
only `C1` was checked, and only against `C2` over Gen I types. Same method applies: derive from a
published source, diff against what the app believes, and pin the result with a test.

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

## 21. Moves tab type filter — `open`

*Asked for three times.* Same pattern as `filterPriority()`: filter in the DOM on each keystroke
rather than re-rendering, and hide a group once nothing in it survives.

**Do this in the same pass as item 0** — both touch the rows emitted by `renderMovesSection()`, and
item 0 requires adding data attributes to exactly those rows.

## 22. Bulk calculator — when to invest Def/SpD over HP — `open`

Maximise HP × Def. Spend each point on whichever of the two current stats is lower.

**VERIFY AGAINST BRUTE FORCE BEFORE SHIPPING.** Will's note: this was not verified the first time.
The greedy rule is intuitive and not obviously correct at the boundaries — a full search over the
66-point budget is cheap and settles it. Ship the brute-force check as a test, not as a one-off.

## 23. Stat formula article — `open`

Champions, level 50, fixed 31 IVs: `stat = base + 20`, **`HP = base + 75`**, then +1 per Stat Point,
then the nature multiplier.

**HP IS DIFFERENT — say so explicitly.** The article exists to stop someone applying the non-HP
formula to HP. The Speed Tiers table and the damage calculator already use this model, so the
article must be derived from the same constants rather than restating them by hand.

## 24. Damage calculator: team selector and paste both sides — `open`

Pick attacker and defender from the built team; paste a full set for either side; auto-populate all
four moves; report Showdown-style damage ranges.

Overlaps the "still open" half of item 19 — the calc does not yet apply imported EVs, IVs, level or
nature.

## 25. Megas, regionals and alt forms in Team Builder and calc pickers — `open`

Same underlying gap as item 20(a), different surfaces. Worth doing together; the form-availability
and Champions-legality questions only want answering once.

## 26. Move-class articles; item changes and a patch-notes link — `open`

Articles on the move classes, plus item changes surfaced in the regulation diff with a link to the
patch notes.

## 27. Team editor: clicking the backdrop silently saves — `open`

*Found 2026-08-03 while fixing the stat-spread bug (3.9).* The overlay is
`onclick="if(event.target===this)saveTeamEdit(idx)"` — there is no cancel. Clicking outside the
dialog commits whatever state the fields are in, and there is no undo.

That is what turned the 3.9 read bug from an annoyance into data loss: you did not have to press
Done to lose a spread. The write path is correct now, but a modal whose only dismissal is "save"
is still the wrong default for a destructive edit. Consider a real Cancel, or making backdrop
dismissal discard.

## 28. Hidden-ability pill needs a solid colour — `done` (3.8)

*Asked for three times; two earlier attempts rejected.* `.ability-tag.hidden` and the ability-page
"Hidden" badge were both `background:transparent` in both themes, so the only thing marking a hidden
ability was a faint purple border. Both are now solid fills, verified opaque in both themes by
computed style.

**Not visually confirmed by Will at time of writing.** Screenshots did not composite in that
session, so the colour choice itself is unverified by eye — reopen if the third attempt is wrong too.
