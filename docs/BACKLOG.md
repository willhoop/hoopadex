# Backlog — HoopaDex

Planned work, newest thinking at the top of each entry. This file is the single list; anything
picked up moves to `CHANGELOG.md` when it ships. Items are not in priority order — the number is
an identifier, not a rank.

Status values: `open`, `in progress`, `blocked`, `done`.

---

## 1. Nuzlocke tracker — `open`

Track a Nuzlocke run inside the dex: first-encounter per route, which encounters are used, and
deaths.

**Open questions.** Which ruleset is the default (species clause, dupes clause, shiny clause)? Does
it persist in `localStorage` or export to a file? Is it per-game, or one run at a time?

## 2. ROM save upload for boss calc — `open`

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
