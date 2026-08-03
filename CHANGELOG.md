# Changelog — HoopaDex

All notable changes to HoopaDex are recorded here, newest first.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), using the
two-part version stamped on line 2 of the HTML file (e.g. 1.93).

**Rule.** Every change is logged here in the same pass as the code, together with the matching
updates to the white paper, the deck, and the technical documentation. A prior conclusion is never
silently rewritten; what changed and why is stated. The top version here must match the version
comment on line 2 of `app/index.html`.

---

## [5.1] — 2026-08-03

### Fixed
- **The weather abilities claimed a duration that has been wrong for three generations.** PokéAPI's
  text is Generation V wording and has never been updated — "Summons a sandstorm that lasts
  **indefinitely** upon entering battle". True through Gen V; from Gen VI ability weather runs 5
  turns, or 8 holding the matching rock. All four are affected: Sand Stream, Drought, Drizzle and
  Snow Warning. Snow Warning carried a second staleness — it has summoned **Snow**, not Hail, since
  Gen IX.

  Corrected per generation, so Gen V still reads "lasts until it is replaced" and Champions reads
  "for 5 turns … or 8 while holding a Smooth Rock". Reported by Will.

  This adds a **hand-maintained table**, which this project otherwise avoids, and the reason is
  worth recording: neither source can supply the fact. PokéAPI carries one description with no
  generation dimension, and Showdown's wording is duration-neutral, so there is nothing to diff
  against. Four entries about one documented mechanic change, pinned by
  `tests/test-weather-duration.js`. Primordial Sea, Desolate Land and Delta Stream are deliberately
  *not* overridden — those genuinely are indefinite and PokéAPI already says so.

### Added
- **Load a saved team member into either side of the damage calculator.** The only route before was
  the Calc button on a Team Builder slot, which loaded the **attacker** only and carried species,
  moves, item and ability but **not the stat spread or the nature** — so the calculator ran your set
  against a default 32/Neutral and quietly answered a different question from the one you asked.
  There was no way at all to put a team member on the defending side, which is the half you usually
  want: *does this survive that*.

  Both panels now have a "Load from my team" picker that applies the spread and translates the
  saved nature into the multiplier that side uses. A Careful Tyranitar with 20 HP / 32 SpD loads as
  a defender with HP SP 20, Defence SP 32 and a boosting nature, not as a default.

---

## [5.0] — 2026-08-03

### Fixed
- **The Bulk tab was answering the wrong question, and its advice was wrong because of it.** 4.2
  maximised HP × Def in isolation, and on that objective balance wins — which is why it told you to
  put everything into the defence. But a point of HP multiplies **both** defences while a point of
  Defence only helps against physical, so against a mixed attacker HP is worth about twice as much.
  For Garchomp, Dragonite and Charizard the old answer was "0 HP / 32 Def" and the right answer is
  the opposite: everything into HP.

  **The rule, derived rather than assumed.** Total hits survived scales with HP × Def + HP × SpD =
  HP × (Def + SpD). One HP point gains (Def + SpD); one defence point gains HP. So the target is:

  > **HP = Def + SpD** — not "HP = 2 × Def"

  "Double the defence" is the *same statement* whenever the two defences are close, which is common
  enough that it survives as folklore. It fails on lopsided defenders: Skarmory at 140/70 wants HP
  near 210, not 280. Measured at the exact optimum across the roster, HP/(Def+SpD) averages 0.90;
  HP/(2×Def) averages 1.30 and ranges from 0.43 to 5.50.

  The tab now shows the three-way spread as the primary answer, with the one-sided columns kept for
  when you already know what you are facing. Still an exact search, now over HP/Def/SpD.

### Added
- **`tests/test-syntax.js` — the app must actually parse.** Added after a near miss: a scripted edit
  ate the escaping in `switchTab('pokedex')`, leaving a syntax error in the single inline script.
  The page was dead — no tabs, no data — and **all eighteen existing suites stayed green**, because
  every one of them slices a function out of the file and evaluates it alone. Verified: against that
  broken file, 0 of 18 suites fail and this one does. It also guards the escape corruption that
  produced the literal "95" sort arrows in 4.7, by rejecting stray control characters outright.

### Notes
- The near miss was caught by opening the page, not by any test — the same way the last three bugs
  were found. An auto-commit hook pushes this repository on a timer, so the window between breaking
  the file and shipping it is about a minute. That is the argument for the new suite.

---

## [4.9] — 2026-08-03

### Fixed
- **Speed Tiers was showing 60 of 208 Pokémon and calling the rest "still loading".** Nothing was
  loading them. The table only ever used what happened to be in the cache, which meant it showed
  whichever Pokémon you had opened — Mudsdale was missing because you had never clicked it. The
  count made an incomplete table look like one mid-fetch, which is worse than an obviously empty
  one: a speed tier list missing three quarters of the format will quietly tell you that you
  outspeed things you do not. It now fetches the roster in batches and fills in as they land.
- **The Bulk tab had the same gap**, because it copied the pattern. Fixed by the same function.
- **The damage calculator's move box stopped offering anything for a form.** A regression from 4.4:
  forms became selectable, but a form's learnset lives under its **base species** — the Champions
  export is keyed by species, and a Mega learns what its base learns. Picking Mega Blaziken gave an
  empty move list, so typing "close" matched nothing. It resolves through the base species now:
  Mega Blaziken offers 78 moves including Close Combat.

### Added
- **Speed Tiers can be narrowed to what you care about** — a search box, and a "My team only"
  toggle. Prepping for a game means comparing your six against a handful of expected threats, not
  reading 208 rows.

### Changed
- **Form names are capitalised in the calculator.** The picker and the field both read
  "tyranitar mega"; they now read "Tyranitar (Mega)", using the same `formDisplayName` as everywhere
  else.

---

## [4.8] — 2026-08-03

### Fixed
- **Champions has no TMs, and the app was showing Scarlet/Violet's TM list anyway.** In Champions
  each Pokémon simply has a moveset it can learn, taught with VP — which the Pokédex move panel
  already said in as many words. The TM controls were never gated on mode, so `GEN_TMS[9]` rendered
  SV's list, numbering and all, under a Champions banner. Current-generation data presented as
  another era's is the precise failure this app exists to prevent, and it was sitting in the middle
  of the Moves tab. Confirmed with Will before changing. The TM list and its toggle are hidden in
  Champions, and the tab's description says what actually applies.
- **Regulation Changes was offered outside Champions.** The regulations *are* Champions
  regulations, so the sub-tab was showing a Champions-only article while the selector read Gen III.
  It is hidden now rather than emptied — an empty panel invites you to wonder what you did wrong —
  and if it was the open sub-tab when you switch generation, you land on one that still applies.

### Notes
- Both are the same shape of bug, so they share one function: `applyModeVisibility()` decides what
  exists in the current selection, and runs on the only two events that can change the answer —
  switching tab and switching generation.
- **Open question recorded, not changed:** the Champions learnset export still carries a `TM`
  method on some entries, which is what drives the "(TM)" badge on a move. If Champions has no TMs
  that flag is an artefact of how the export was generated, and the fix belongs at the source rather
  than in the display. Logged rather than papered over.

---

## [4.7] — 2026-08-03

### Fixed
- **The move table's sort arrows rendered as the literal text "95".** The CSS said `content:'95'`
  (↕), but a previous Python edit wrote it into a non-raw string, where `` is an octal escape —
  so the file held control character 0x11 followed by "95". Same for the ascending and descending
  arrows, "91" and "93". They now render as ↕ ↑ ↓. Reported as overlapping text on the moves screen.
- **The variable-power table (Water Spout, Eruption, and the rest) threw its numbers across the
  page.** The table was `width:100%`, so the value column absorbed all the slack in the panel and
  each number ended up an arm's length from the condition it belonged to. It is a compact two-column
  pair now.
- **The type chart tooltip said "super effective" in green while the chart said blue.** Left over
  from the palette retired in 1.99: `showChartTip` hardcoded `#3BA53B` and `#c62828` rather than the
  theme variables. A tooltip that contradicts the cell under the cursor — and the legend directly
  above it — is worse than no tooltip. It uses `--eff-up`/`--eff-dn` now, which also means
  colourblind mode reaches it, which it never did.

### Notes
- All three were found by looking at the running app, not by reading code or running tests. The
  escape corruption in particular is invisible in a diff and passes every suite.

## [4.6] — 2026-08-03

### Fixed
- **The selected form survives navigating away and back.** Choosing Rotom-Wash, opening something
  else and returning handed you plain Rotom again, with nothing to indicate a choice had been
  discarded. `showForm` renders a form but deliberately does not move `adId` — a form is a view of
  the species, not a separate entry, and both the pins and the URL hash track the species — so
  returning re-rendered the default.

  The choice is now remembered per species for the session. It is restored only when the form is
  still loaded, so the panel never blocks on a refetch. Verified in the browser against Rotom, the
  case the backlog named: pick Wash, open Charizard, return, and Rotom-Wash is still there.

### Notes
- Backlog item 8 (period-accurate sprites) was researched and **not** shipped. PokéAPI does serve
  per-generation sprites at predictable paths, and the item's open question is answerable — the dex
  already filters by generation, so nothing out of era is listed, and a missing sprite 404s into the
  modern one. But two things stopped it: generations VII and VIII expose only 68×56 menu *icons*
  under `icons/` alongside real sprites, and generations VIII–IX are large 3D renders that would sit
  badly beside the pixel sprites of I–VII. It is a dex-wide visual change, and screenshots do not
  composite in this environment. The findings are recorded on the item so the design call can be
  made by someone who can see it.

## [4.5] — 2026-08-03

### Fixed
- **`ITEM_INTRO_GEN` was wrong in 67 of its 325 entries — 20.6% of the table.** Backlog item 16 had
  it listed as never audited. It has been audited now, against two independent sources that agree:
  Showdown's `data/items.ts` and PokéAPI's own `game_indices`.

  Four systematic shifts, no scatter:
  - **39 entries filed a generation late at Gen III that belong to Gen II.** Leftovers, King's Rock,
    Quick Claw, Focus Band, Scope Lens, Thick Club, Light Ball, Metal Powder, Lucky Punch, Stick,
    the whole type-boosting family (Charcoal, Magnet, Miracle Seed, Mystic Water, Sharp Beak, Poison
    Barb, Soft Sand, Spell Tag, Twisted Spoon, NeverMeltIce, Black Belt, Black Glasses, Dragon Fang,
    Hard Stone, Silver Powder), and the original berries. Held items are the headline mechanic
    Gold/Silver introduced; the table dated all of them to Ruby/Sapphire.
  - **19 mega stones filed at Gen VII that belong to Gen VI.** Altarianite, Audinite, Beedrillite,
    Cameruptite, Diancite, Galladite, Glalitite, Latiasite, Latiosite, Lopunnite, Metagrossite,
    Pidgeotite, Sablenite, Salamencite, Sceptilite, Sharpedonite, Slowbronite, Steelixite,
    Swampertite. These are the Omega Ruby / Alpha Sapphire stones, and ORAS is Generation VI.
  - **7 battle items filed at Gen III that are Gen I** — X Attack, X Defense, X Speed, X Accuracy,
    X Sp. Atk, Dire Hit, Guard Spec.
  - **2 filed at Gen IX that are Gen VIII** — Blank Plate, Legend Plate.

  None of this was visible in the product. An item dated a generation late simply does not appear
  when you browse that generation, which looks exactly like an item that did not exist yet.

  The table is now generated by `build/generate-item-gens.js` from PokéAPI — the same API the app
  already reads at run time — with the derivation committed to `data/item-intro-gens.json`. All 325
  items resolved; none needed a fallback.

### Notes
- **The type charts were audited too, and are correct.** `CM`, `C2` and `C1` were diffed cell by
  cell against Showdown's `data/typechart.ts` and its gen5 and gen1 mods: 838 cells, three exact
  matches, nothing to fix. Only `C1` had ever been checked before.
- `EVO_OVERRIDES` and `REGIONAL` turned out not to be generation data at all — they are display
  labels ("Alolan", "Evolve"). Listed in item 16 as unaudited; there is nothing in them to be
  wrong about. Recorded rather than "fixed".
- Three of the spot-checks in the new suite failed on first run, and all three were **my** error,
  not the app's: I had written attacker and defender the wrong way round. The pre-Gen VI fact is
  that a *Steel defender* resisted Ghost and Dark, and the Gen I quirk is that a *Fire defender*
  did not resist Ice. The exhaustive 838-cell diff had already proved the charts right; the
  hand-written assertions were the unreliable part, which is the same lesson as the tables
  themselves.

## [4.4] — 2026-08-03

### Added
- **Alternate forms in the Team Builder search and the damage calculator.** 4.0 made the ability
  page understand forms; these two still could not see them at all. The team search only ever
  consulted `master`, which stops at 1025, so there was no way to put a Mega or a regional form on
  a team — and the calculator's roster had the same limit, which meant you could not calculate
  against precisely the forms whose stats and typing change the answer.

  Searching "slowbro" in Champions now returns Slowbro, Mega Slowbro and Galarian Slowbro; "charizard"
  in Gen IX returns the species and both megas; in Gen I it returns the species alone.
- **The 326 alternate forms are loaded once**, as a second page of the endpoint `master` already
  uses. They are deliberately kept *out* of `master`: that list backs the Pokédex, and a dex that
  lists Charizard three times is not a dex. Search is where asking for "mega" should return megas.

### Changed
- **One rule decides what exists: `formAllowed()`.** The ability page, the team search and the
  calculator picker each answered "does this belong in the current selection?" separately, and only
  the ability page ever learned about forms — which is exactly why the other two were missing them.
  A form is gated on two eras, its species' and its own, and Champions legality follows the species
  because the roster names species rather than formes.
- **Team slots use `formDisplayName()`**, so a slot reads "Dragalge (Mega)" rather than
  "dragalge mega". A form's id is shown as an era pill rather than a dex number, because 10299 is
  not a dex number and printing it as one would be a wrong fact.

### Notes
- The bundled `@smogon/calc` needed no translation layer: it keys species on a flattened name, and
  PokéAPI's `dragalge-mega` flattens to the same string as Showdown's `Dragalge-Mega`. Confirmed in
  the browser — the engine resolves both `Dragalge-Mega` and `Slowbro-Galar` directly.
- `tests/test-form-names.js` is now 46 assertions and fails three ways when the form-era gate is
  removed, which is the mutation that would let a Mega appear in Generation I.

## [4.3] — 2026-08-03

### Fixed
- **Dismissing the team editor no longer saves.** Clicking the backdrop and clicking the ✕ both
  called `saveTeamEdit`, so every gesture that reads as "dismiss this" silently wrote the form's
  current state to the slot — no undo, and no cancel anywhere in the dialog.

  This is what turned the 3.9 stat-key bug into actual data loss rather than a display annoyance:
  you never had to press Done to lose an imported spread, only click outside the dialog. The read
  path was fixed in 3.9, but a destructive modal whose only exit is "save" is still the wrong
  default, and the next bug in that dialog would have done the same thing.

  Backdrop, ✕ and Escape all discard now; there is an explicit Cancel; Done is the only thing that
  commits. Guarded in `tests/test-team-edit-stats.js`, which fails on six assertions against the
  real 3.9 source.

## [4.2] — 2026-08-03

### Added
- **Bulk, under Other.** Damage taken scales with HP × defence, so "should this point go into
  Defence or HP?" has an exact answer for a given budget. The table gives the optimal split for
  physical and special bulk for every Pokémon in the regulation, at a chosen budget and nature.

- **`docs/STAT-FORMULA.md`, generated by `build/generate-stat-formula.js`.** The Champions stat
  model written down, with the warning it exists for: **HP uses a different constant from every
  other stat** (`base+75` against `base+20`) and **natures never apply to it**. Applying the non-HP
  formula to HP is out by 55 before a single Stat Point is spent.

  Every number in the article is computed by the app's own `bulkStat()` and `SPEED_COLS`, sliced at
  generation time — nothing is typed out. `tests/test-stat-formula-doc.js` recomputes the headline
  figures from the shipped functions and asserts the document still states them, so changing the
  model without rerunning the generator is a test failure rather than a quietly wrong page. Change
  the HP constant to 80 and it fails on four assertions. Jolteon still reads 300/200/182/150/130/135.

  The answer is more one-sided than expected and worth stating: for most of the roster the optimum
  is to put **everything into the defence**, because HP starts 55 points higher (`base+75` against
  `base+20`), so the two are nowhere near balanced to begin with. Venusaur at 32 SP wants 0 HP / 32
  Def. Only the already-lopsided cases — Blastoise's special side, anything with a hindering
  nature — start buying HP.

### Notes
- **The rule this was going to ship with is wrong, and the brute force is what said so.** The
  backlog specified "maximise HP × Def; spend each point on whichever current stat is lower", with
  the note "VERIFY AGAINST BRUTE FORCE BEFORE SHIPPING — I did not." Verified first, before writing
  any of it. That rule is:
  - **exactly optimal on a neutral nature** — 260,100 combinations, zero misses. A neutral stat
    gains exactly +1 per point, so comparing levels and comparing marginal gains are the same
    comparison.
  - **not optimal once a nature applies** — wrong in 13–26% of cases, by up to 1.3%.
    `Math.floor((base+20+sp)*nature)` does not step by 1: a hindering nature wastes the first point
    outright (step 0) and a boosting one occasionally pays 2, so levels and gains stop agreeing.

  The obvious repair — spend where the marginal gain is highest — is far **worse**, up to 41% off,
  because a hindering nature makes the first Defence point worth exactly zero, so that rule never
  starts on Defence at all and dumps the whole budget into HP. It is kept as a test so nobody
  "fixes" the code back to it.

  So no shortcut is used. There are at most 33 splits and the exact optimum is found by checking
  all of them. `tests/test-bulk-split.js` re-derives all three of those claims rather than trusting
  the comment, and confirms the shipped function equals brute force across 294,912 combinations.
  Swapped for the greedy rule, it fails with 32,298 misses.
- **The default budget is 32, not 66.** 66 is the whole-Pokémon budget but only 32 can go into any
  one stat, so at 66 both defences simply cap and every row read "32 / 32" — the tool answered
  nothing at the one setting it opened on. Caught by looking at the rendered table, not the code.

## [4.1] — 2026-08-03

### Fixed
- **The moves table sort had done nothing since 3.2.** `sortMovesTable()` reads every value through
  `querySelector('td[data-'+key+']')`, and `renderMovesSection()` emitted no `data-*` attributes at
  all — zero occurrences of `data-pow`, `data-type` or `data-lv` anywhere in the file. Every
  comparison read `''` against `''`, every row tied, and because the sort is stable the order never
  moved. The header still toggled its ascending/descending arrow, so the control looked like it
  worked. Eight versions.

  Both row emitters now carry the attributes. Verified in the browser rather than by reading:
  clicking Power on Charizard's learnset gives 25/35/50/50/50/55/60/60 ascending and
  150/150/150/150/130/120/120/120 descending, where before the order was identical either way.

### Added
- **A type filter on the moves tab.** A 73-move learnset is the normal case and "what Fire moves
  does this learn" was not a question you could ask. Only the types actually present are offered,
  read off the moves rather than listing all eighteen, so no option matches nothing. Filtering is
  done in the DOM like `filterPriority()`, because re-rendering would discard the current sort.
  The filter persists across tab switches and the count is per-tab: Charizard in Gen IX shows
  1 Flying move under Level Up and 5 under TM/HM.

### Notes
- `tests/test-move-table-contract.js` (20 assertions) checks the thing that actually broke: it
  derives the sortable column keys from the header and the emitted attributes from the row, both out
  of the shipped source, and asserts they agree. Run against the real 3.7 source it reports
  `emitted: []` and fails on all six keys. No behavioural test would have caught this naturally —
  each half was individually sensible, and the defect lived only in the contract between them.
- This is the same failure the white paper already records under "the question is never whether the
  suite is green, it is whether the suite can go red" — the earlier Pokédex sort tests passed
  vacuously for a closely related reason. The lesson had been written down but not generalised to
  the second sort.

## [4.0] — 2026-08-03

### Added
- **The ability page lists alternate forms.** Mega Dragalge has Regenerator and base Dragalge does
  not, and the Regenerator page could not say so. Every alternate form — megas, regionals,
  Gigantamax, Totem, Therian — is served by PokéAPI with an id above 10000, and the filter was
  `id>genMax` against a `genMax` that never exceeds 1025, so it discarded all of them before any
  other rule ran. Regenerator in Champions now lists Galarian Slowbro, Galarian Slowking and
  Mega Dragalge alongside the base species.
- **Forms are gated on two eras, not one.** A form must have a base species that exists in the
  selected generation *and* exist itself: Alolan Rattata is a Generation VII form of a Generation I
  species, so gating on the species alone would show it in Gen I. Verified across the range — megas
  disappear in Gen VIII, Gigantamax appears only there, Galarian only from VIII, Z-A megas only in
  IX.
- **A form pill states which era each form belongs to**, because "Slowbro" and "Slowbro (Galarian)"
  next to each other otherwise read as a duplicate rather than as two Pokémon.

### Fixed
- **Totem Pokémon were shown in Generation VIII.** `getFormGenRange()` tested `-alola` before
  `-totem`, and Totem Raticate's name contains both — so it claimed Gen VII+ for a form that is
  Generation VII only. The narrower window now wins. Found by listing Thick Fat in Gen VIII and
  reading the output, not by reading the code.
- **`CHAMP_MEGA_ABILITIES` covered 23 of the 41 Z-A megas the app itself declares.** The other 18 —
  Dragalge's Regenerator among them — rendered as an ability that simply had fewer Pokémon, which
  looks exactly like a correct answer. The table is now generated by
  `build/generate-mega-abilities.js` from Pokémon Showdown's `data/pokedex.ts`, the same build-time
  source as `PAST_STATS` and `POKEMON_PAST_TYPES`. 19 rows became 45.

  The hand-written rows all turned out to be correct, which is luck rather than process — nothing
  in the product could have surfaced a wrong one. The table also could not express Raichu, which
  has two distinct megas: Mega Raichu X with Electric Surge and Mega Raichu Y with No Guard. One
  row per species cannot hold that; the generated table has both.

### Changed
- **Form display names have one definition.** The Pokédex detail panel and the ability page both
  render forms, and each had its own copy of the naming rules. Extracted to `formDisplayName()`.

### Notes
- **A correction to what was said earlier in the session.** These abilities were reported as blocked
  on data that could not be derived. That was wrong twice over: Showdown carries every Z-A mega, and
  PokéAPI has since caught up too — `dragalge-mega` is id 10299 with `regenerator`, and the
  Regenerator ability page already listed it. The whole item was plumbing. The generator is still
  worth having, because the table it replaces drives the "mega" badge and was incomplete.
- The comment claiming the four Champions abilities "do not exist in PokéAPI" is now stale —
  `mega-sol`, `dragonize`, `piercing-drill`, `spicy-spray`, `eelevate` and `fire-mane` all resolve.
  The injection guard means no duplicates are produced, so this degrades safely; recorded rather
  than changed. Note `eelevate` and `fire-mane` are Z-A abilities absent from `CHAMP_NEW_ABILITIES`,
  so they do not get the "new" badge.
- `tests/test-form-names.js` (31 assertions) was confirmed to fail against three mutations: reversing
  the longest-match-first species resolution, dating Z-A megas as Gen VI, and restoring the Totem
  branch order. The first of those initially did **not** fail — the test fixture lacked `porygon`,
  which is both a real species and a prefix of `porygon-z`, and is therefore the only case that
  distinguishes the two orderings. Fixed and noted in the fixture.

## [3.9] — 2026-08-03

### Fixed
- **The team editor was still destroying imported stat spreads.** Reported again after 3.4. The
  editor addresses its inputs by short names (`atk`, `spe`); a stored spread uses PokéAPI keys
  (`attack`, `speed`). `hp` is the only key the two spellings share, so looking a short name up in a
  canonical-keyed object returned undefined for every other stat, the fields loaded as 0, and
  `saveTeamEdit`'s `if(v>0)` then dropped them. Opening a slot and pressing Done — or clicking the
  backdrop, which also saves — turned `2 HP / 32 Atk / 32 Spe` into `2 HP`.

  3.4 fixed the **write** side of exactly this and left the **read** side, so the bug returned
  unchanged. The editor now reads through `readStatObj`, which already existed for this purpose and
  was being used elsewhere but never here.

  Guarded by `tests/test-team-edit-stats.js`, which takes the read expression **out of the shipped
  source** rather than re-implementing it — a round-trip test that models the code instead of
  running it passes against the broken version, which is how this survived a release. Against the
  pre-fix source the suite fails 7 assertions and reproduces the reported output exactly
  (`{"hp":2}`).

### Changed
- **Type names in the Defending Type Calculator's dropdowns are capitalised.** They read `flying`
  and `fire` while the badges directly beneath them read FLYING and FIRE. The option label is
  capitalised in the string rather than by CSS, because `text-transform` on `<option>` is not
  honoured consistently across browsers; the option *value* stays lowercase, since it is the key
  used against the type chart and capitalising it would break every lookup.

---

## [3.8] — 2026-08-03

### Added
- **The Defending Type Calculator lists the Pokémon that have the selected pair.** The tool resolved
  every attacking type against a typing but never said who actually has that typing. It now does,
  for two-type selections only — a single type returns hundreds of species, which answers nothing.
  Membership is derived from PokéAPI's own per-type lists, the same endpoint the Pokédex type filter
  already uses, so the two cannot disagree; a species carrying both types has exactly those two, so
  intersecting the two sets is already an exact-typing match.
- **The species list is generation-correct, not present-day.** Those lists carry current typing only.
  In Gen 1 Electric/Steel now returns nothing and Magnemite appears under Electric alone; in Gen 5
  Togetic is listed under Normal/Flying, a pair it no longer has and which no intersection of
  current type lists could ever have found. Covered by `tests/test-dual-typing.js`.

### Changed
- **"Defending typing" is now the "Defending Type Calculator", and is a card rather than a caption.**
  It sits under an 18×18 grid, below the fold, and was styled as a 10px grey label with two small
  selects — it read as a footnote to the chart rather than as the tool that answers the question the
  chart only supplies the raw material for.
- **The ability page shows one description instead of two.** PokéAPI ships a short effect text and a
  long one, and for most abilities the long one is the short one reworded — Aftermath said the same
  sentence twice, in two blocks, at two sizes. The old guard compared the two strings for exact
  inequality, which only catches character-identical text and so never fired once. A second block is
  now shown only when it is genuinely additional text. Covered by `tests/test-ability-desc.js`.
- **The ability page uses one type scale.** It had five font sizes plus an empty 28px spacer div; it
  now has four, and the species chips use classes rather than per-element inline styles.
- **The hidden-ability marker is a solid colour in both themes.** `.ability-tag.hidden` and the
  ability-page "Hidden" badge were both `background:transparent`, so the one thing distinguishing a
  hidden ability from a normal one was carried by a faint purple border alone. A hidden ability is a
  different encounter, not a variant of the same one.

### Fixed
- **Light mode's type chart was washed out.** Two independent causes, both measured rather than
  eyeballed. The neutral cell had no light-mode override at all, so it inherited the dark theme's
  `rgba(255,255,255,0.03)` fill and `rgba(255,255,255,0.10)` border — white on white, so every ×1
  cell and every grid line was invisible. Separately, the light-mode effectiveness fills sat at 33%
  and 32% saturation against 50% and 39% for the same cells in dark mode. The fills are now 64% and
  60% saturated at the same lightness, so the chart reads as coloured without going darker, and ink
  contrast against them improved as well (5.51→5.55 and 4.89→5.04).

### Notes
- The first attempt at the neutral-cell fix repainted the entire chart grey: `body.light
  .type-table td.cell` outranks `.type-table td.cell.eff-2` on specificity, so an unscoped rule
  silently overrode every coloured fill. Caught by measuring computed styles in the browser, not by
  reading the CSS. The rule is now scoped off the effect classes and the reason is recorded there.
- `tests/test-viz-palette.js` then rejected the replacement for hard-coding hex in a rule matching
  `.eff-`; it now uses theme variables. The suite was right and the rule stands.
- Both new suites were verified to FAIL against deliberately broken copies of the source before
  being trusted — removing the generation correction fails 5 assertions, and over-eager description
  de-duplication fails the three that protect genuinely additional text. Both accept a
  `HOOPADEX_SRC` override so that check never has to break the working tree, which the auto-commit
  hook would otherwise commit and push.
- Screenshots did not composite in this environment, so every visual claim above is from measured
  computed styles rather than from seeing the page.

## [3.7] — 2026-08-03

### Fixed
- **Menus flashed white on first open.** `:root` never declared a `color-scheme`, so the browser
  painted native controls with its default light chrome before the stylesheet landed. One line —
  `color-scheme: dark` on `:root`, `light` under `body.light`.

### Changed
- **Form pills are one class with modifiers.** Mega, regional and Gigantamax selectors were built
  from three inline ternaries choosing border, background and text colour independently, so every
  state read as a different component. Now: a pill, an active modifier, and an out-of-generation
  modifier shown dashed and dimmed rather than recoloured — the difference between "another form"
  and "a form that does not exist in this generation" is legible instead of guessable.


## [3.6] — 2026-08-03

### Changed
- **Search results carry type, category, power and accuracy.** A fuzzy match previously showed a
  bare name, so searching "bug" returned Headbutt and Bubble Beam with no clue why they matched or
  which of five similar moves was wanted. The whole value of a forgiving search is being able to
  browse the near-misses — that only works if you can tell them apart without opening each one.

### Notes
- Metadata comes from whatever is already in the move cache, so it appears for moves the app has
  loaded and is simply absent otherwise, rather than blocking the dropdown on a fetch per keystroke.


## [3.5] — 2026-08-03

### Added
- **Speed Tiers for the Champions roster**, under Other. Six columns, sortable by any of them:
  Scarf, Max +nature, Max SP, Neutral, Base, and Min. Every one is derived from the same model the
  damage calculator uses — at level 50 with fixed 31 IVs a stat is `base+20`, then +1 per Stat
  Point, then the nature multiplier — so a number here cannot disagree with a number there.
  Verified against Jolteon (base 130): 300 / 200 / 182 / 150 / 130 / 135.
- **Min is no SP with a speed-reducing nature**, as specified. Note it can read *higher* than the
  Base column: Base is the raw base stat, everything else is a level-50 stat.

### Changed
- **The dual-type lookup now matches the Pokédex defensive-matchup panel** — grouped under Immune /
  Super resist / Resists / Weak to / Super weak headings with type badges, instead of a flat row of
  chips. Someone who has read one has read the other. Water/Grass: super-resists Water, resists
  Ground and Steel, weak to Poison, Flying and Bug.

### Notes
- The speed table only lists Pokémon already loaded into the species cache, and says how many are
  still loading rather than silently showing a short list.
- HP does not follow the same formula — it is `base+75`, not `base+20`. Speed tiers are unaffected,
  but any stat-formula article has to say so.


## [3.4] — 2026-08-03

### Fixed
- **The team editor was silently destroying imported stat spreads.** It addressed stats as
  `hp/atk/def/spa/spd/spe` while the paste parser stores PokéAPI keys
  (`hp/attack/defense/special-attack/special-defense/speed`). **`hp` is the only key the two
  spellings share**, so opening a slot's editor and saving kept HP and dropped everything else — an
  imported `2 HP / 32 Atk / 32 Spe` became `2 HP`, with no error and no indication anything had been
  lost. Stats are stored in one canonical form now and translated at the editor's edge; older saved
  teams are read in either spelling so nothing already stored is lost.

### Notes
- This is the failure this whole project keeps producing: **two representations of the same thing,
  agreeing on exactly one value.** It looked like a paste-parser bug, and the parser was fine — I
  confirmed that by running the exact Blaziken block through it before touching anything. What gave
  it away was that Dragonite kept all four values from an identically-shaped line while Meowscarada
  kept one: the difference was not the data, it was whether that slot's editor had been opened.


## [3.3] — 2026-08-03

### Fixed
- **Immunity was a third shade of blue.** `#5f5f85` sat 1.06:1 from the super-effective fill and
  2.96:1 from the navy page — close to both. Immunity is a categorically different state, so it now
  uses a neutral grey that belongs to neither family: 6.4:1 against the page, 2.0:1 against the blue.
- **Team cards call the stat budget SP in Champions.** Showdown's format says "EVs:" in every mode,
  so a Champions paste still reads that way. The paste keeps their word so it round-trips; the card
  now uses ours, via the same `statBudget()` the editor and calculator share.

### Notes
- **The paste parser is not dropping stat values.** Running the exact Blaziken block —
  `EVs: 2 HP / 32 Atk / 32 Spe` — returns `{hp:2, attack:32, speed:32}`, all three. A team showing
  only "2 HP" is a stale autosave from before the import, not a parse failure; re-importing corrects
  it. Verified rather than assumed, because the obvious guess was that the parser was at fault.
- **The Showdown calculator cannot be given a team by link.** Its query string carries only `gen`
  and `mode`; imported sets live in its own `localStorage`, which is cross-origin and not writable
  from here. The button copies the paste and opens the page, which is the whole of what is possible.


## [3.2] — 2026-08-03

### Added
- **Dual-type lookup under the type chart.** Reading a ×4 off an 18×18 grid means finding two cells
  and multiplying them in your head. Pick a defending typing and every attacking type resolves
  against it at once, worst first. Water/Ground returns Grass ×4, Electric ×0, and four ×0.5s.
- **Sortable columns on move tables.** A 73-move list had no way to ask for it by category or by
  power. Clicking a header sorts; clicking again reverses. Category sorts Physical, Special, Status
  in that order rather than alphabetically — that is the order people think in, and alphabetical
  would give the same answer by accident and break the moment a fourth category existed.

### Fixed
- **Champions showed Smogon singles sets as if they were legal.** It loaded `gen9.json`, so a
  Blastoise in Champions offered **UU** and **Godly Gift** sets with 252 EV spreads — a format that
  does not exist here, presented with full confidence. Champions is doubles, so it now reads the
  **VGC** set file, and the section says what it is: the closest published reference, with a note
  that Champions uses SP rather than EVs.
- **Move descriptor tags only appeared after visiting the damage calculator.** The flags come from
  the calc engine, whose lookup maps are built lazily by that tab, so Aura Sphere showed no
  Ballistic or Pulse tag on the Moves tab — which is where anyone would look for it. The maps are
  now initialised on demand.
- **Berries sit above the Mega Stones** in the Items tab. Berries are chosen for a set; Mega Stones
  are a long species-locked list you scroll past.

### Changed
- **Light mode is greyer and the cells are rounded.** Both were asked for to soften a chart that
  read as harsh. Worth recording the cost honestly: desaturating drops the two fills to a
  normal-vision ΔE of 9.7, below the 15 floor, so hue alone no longer separates them reliably even
  for full colour vision. That is acceptable **only** because every cell carries its own number and
  a colourblind mode exists — the glyph is doing the work the colour used to. If the glyphs were
  ever removed, this palette would have to go back.


## [3.1] — 2026-08-03

### Fixed
- **Light mode was using dark fills with white text on a near-white page**, so every filled cell read
  as a heavy island. Light themes want the inverse: the fills are now light tints (`#7fb0d8`,
  `#dc9086`) carrying dark ink at 5.2:1 and 4.3:1. Picking them needed care — the first attempt was
  so pale it measured a normal-vision ΔE of 5.3, well under the 15 floor, meaning *full-colour*
  readers would have struggled to tell the two states apart. The shipped pair measures 16.4.
- **Colourblind mode did nothing in light mode.** `body.cvd` was declared *above* `body.light`, so
  with both classes present the light theme won on source order and silently overrode it. The mode
  now sits after `body.light`, with an explicit `body.light.cvd` rule that beats both on specificity.
- **Immune cells were invisible in dark mode** — `#33334d` measured **1.47:1** against the page.
  Now `#5f5f85` at 2.96:1.
- **The type chart's corner label was red**, the same red as "not very effective", so an axis label
  read as a legend key. Both axis labels are neutral now.
- **"Gen V — Physical / Special Split"** claimed the split happened in the generation you had
  selected. It happened in Generation IV. The heading states the rule; the generation is context.
- The natures matrix was left-aligned in a full-width column and is now centred.

### Changed
- **Move Priority fits on one screen.** It is a mid-game reference and it was scrolling — the
  bracket description took its own line, which was most of the height. It now sits inline with the
  moves: 368px against a 720px viewport, all eleven brackets visible at once.
- The Showdown handoff button is on the **damage calculator** as well as the Team Builder. It only
  existed on Team Builder, which is not where it gets looked for.

### Notes
- The immune fix nearly shipped broken: the replacement targeted a value an earlier edit had already
  changed, so it silently matched nothing. It was caught by reading the computed colour back out of
  the browser rather than by trusting the edit. Every replacement in this pass now asserts its match
  count — the ones that did not are exactly the ones that failed.


## [3.0] — 2026-08-03

### Added
- **Colourblind mode**, a toggle beside the theme control, persisted like the theme. It swaps the
  chart and natures palette for **blue against orange** — the classic deuteranopia/protanopia-safe
  diverging pair — measuring **CVD ΔE 27.1** against 13.0 for the default.
- **This is the point of it:** a dedicated mode frees the *default* palette from having to clear a
  colour-vision threshold, so the default can be chosen to look right and the mode can be chosen
  purely for separation. Every previous swing on this chart — washed out in 1.99, too loud in 2.2,
  muddy in 2.9.3 — came from making one palette serve both jobs. Glyphs remain in both modes;
  colour is never the sole encoding either way.

### Changed
- **The default fills are evened out.** The blue was a cold grey-navy against a warm earthy red, so
  the two did not read as a pair and the blue looked dull. They are now lightness-matched —
  `#35699f` and `#9e4a45`, a lightness gap of 0.008 — both carrying text near 5.8:1.
- **`½` replaced with `0.5` in chart cells.** The one-half character renders with numerals at
  roughly 60% of cap height, so beside a full-height `2` it reads small and soft *at any font size*.
  It was being set two sizes larger to compensate, which is why it looked mushy rather than merely
  small. Both glyphs now sit at the same size and the size override is gone.

### Documentation
- **The white paper and deck were eight versions stale** and said the opposite of what is now true.
  Section 5 still claimed the historical tables were untested and called that "the most significant
  gap in its verification"; the deck's Slide 10 said the same. Both rewritten: the paper now records
  what the audit actually found (10 of 43 base-stat entries correct, typing with no historical record
  at all), the derive-don't-type principle that followed, the three tests found passing vacuously,
  and the honest new largest gap — **no visual or responsive testing**. Deck slides renumbered after
  a duplicate Slide 11 crept in.


## [2.9.3] — 2026-08-03

### Changed
- **The type chart's fills are softer.** 2.2 swung from washed-out tints straight back to full
  saturation, and across a 324-cell grid that is a lot of loud colour to sit in front of — the
  correction overshot in the other direction. The fills are now muted steps that still clear every
  gate: dark `#2f5f96`/`#9e4a45` (CVD ΔE 13.0, normal-vision 20.1) and light `#3d72ab`/`#b05a55`
  (ΔE 13.3, all checks pass), carrying near-white text at 6.6:1 and 6.0:1. The immune cell came down
  with them, and the eighteen type pills sit at 82% opacity so the axes stop competing with the grid
  — their canonical colours are unchanged.
- The palette validator warns that these fills fall below 3:1 against the page surface. That warning
  demands visible labels or a table view as relief, and both are already true: this *is* a table and
  every non-neutral cell carries its glyph. The warning is answered, not waived.

### Notes
- This is the first change made after actually *seeing* the chart. Every visual decision before it
  today came from reading computed styles, because the browser pane never composited a frame — which
  is exactly how 1.99 shipped a chart that measured correct and read as unusable.


## [2.9.2] — 2026-08-03

### Added
- **`tests/test-champions-roster.js`** (19 assertions) and **`build/audit-champions-roster.js`**.
  The Champions roster was the last table in the app neither generated from a published source nor
  validated against one — ~200 hand-typed dex numbers, where a wrong entry is invisible because the
  dex still renders and the filter still filters.
  - The test checks what needs no network: valid dex numbers, each regulation a superset of its
    predecessor, `M-B size == M-A + REG_MB_NEW`, unique keys, and **no duplicates in the source
    literal**. That last one matters because a number repeated inside `new Set([...])` is silently
    collapsed, leaving the roster one Pokémon short while every count in the app still agrees with
    itself. Both failure modes were confirmed by mutation.
  - The audit script answers the evolution-stage question against PokéAPI, cached so reruns are
    offline.

### Notes
- **The roster is clean.** No duplicates, nothing out of range, M-B a strict superset of M-A,
  **no baby Pokémon at all**, and only three entries that are not a final stage: Pikachu, Qwilfish
  and Floette. All three look deliberate — Qwilfish evolves only as its Hisuian form, and Floette is
  present as its Mega (Eternal Flower), which cannot evolve. Those three are pinned in the test, so
  a fourth arriving is a failure that has to be justified rather than a silent addition.
- This closes the question of which generation-aware tables are unverified: none of them are now.
  `PAST_STATS`, `POKEMON_PAST_TYPES` and the regulation diff are generated; the type charts, move
  descriptors and this roster are tested. `ITEM_INTRO_GEN`, `EVO_OVERRIDES` and `REGIONAL` remain
  unaudited and are still recorded as backlog item 16.


## [2.9.1] — 2026-08-03

### Added
- **`build/generate-regulations.js`**, which writes `docs/REGULATIONS.md` and
  `data/regulations.json` from the `CHAMPIONS_REGS` registry in `app/index.html`. The article is
  generated, never written: the in-app page derives the same diff at runtime from the same registry,
  so the article, the page and the Pokédex filter cannot disagree. Species names are fetched from
  PokéAPI once and cached in `data/species-names.json`, so reruns work offline and are byte-identical
  — verified by running it twice and diffing.
- **A weekly scheduled agent, `hoopadex-regulation-watch`.** It regenerates the artefacts (catching
  a roster edited by hand without regenerating), then checks Serebii and Victory Road for a
  regulation the app does not know about.

### Notes
- **The agent deliberately will not invent a roster.** A regulation is roughly 200 National Dex
  numbers. If it finds a new one it reports the name, the date and what each source actually said,
  and asks for the authoritative list — it does not extrapolate from the previous regulation or
  half-populate the set. A wrong roster would silently corrupt the dex filter, the recently-added
  sort, the article and Team Builder legality simultaneously, and everything would still render, so
  nobody would notice. That is the failure mode this whole day has been about.
- The agent is stored under `~/.claude/scheduled-tasks/` and runs while the app is open; a missed
  run fires on next launch. `CronCreate` was rejected for this — it is session-only and would have
  died with the conversation that created it.


## [2.9] — 2026-08-03

### Added
- **A Regulation Changes page**, under Other. It lists what was added and removed between each pair
  of Champions regulations, with every Pokémon clickable through to its dex entry. Regulation M-A →
  M-B: 186 → 208, **+22 added, none removed**.
  - It is **derived** by set difference over `CHAMPIONS_REGS`, never written out. The computed
    additions equal `REG_MB_NEW` exactly, which the test suite asserts. Adding a regulation to that
    registry is the only edit needed — this page and the "recently added" sort both follow from it,
    and neither can disagree with the roster the Pokédex actually filters by. A hand-written article
    would be wrong the first time the roster changed, and nobody would notice.
- **`tests/test-regulations.js`** (18 assertions), covering removals as well as additions — the case
  a hand-written article is most likely to miss — three-regulation chains diffing against the right
  predecessor, an unchanged regulation reporting an empty diff rather than being omitted, and the
  shipped registry matching `REG_MB_NEW`.

### Changed
- **The "New in Pokémon Champions" banner is gone.** It was a bordered panel of cards restating what
  the list below already contained. The information now sits on the rows themselves, and "recently
  added" is a sort rather than a callout.
- **The four Champions-only abilities are now real rows** — Mega Sol, Dragonize, Piercing Drill and
  Spicy Spray. They do not exist in PokéAPI, so they lived *only* in that banner: removing it deleted
  them from the app entirely. They are injected into the list instead, searchable and sortable like
  everything else, marked "new" and showing which Mega they belong to. The abilities tab goes from
  284 to 288.

### Notes
- Two self-inflicted breaks, both caught in the browser rather than by tests. Removing the banner
  silently dropped four abilities — the regression only became visible because a check for the "new"
  markers returned zero. Fixing that then put a `const` below its first use, which is a temporal dead
  zone, so the abilities list rendered **completely empty** until the declaration was moved above.
  Neither would have been caught by the suite; both were caught by reloading the page and reading
  the numbers.


## [2.8] — 2026-08-03

### Fixed
- **"208 Pok&#233;mon found".** The result count was set with `textContent`, which does not decode
  HTML entities, so the entity rendered literally on screen. Now uses the character itself, and the
  count also appears when a search criterion is active rather than only when one of the dropdowns is.
- **The generation filter did nothing in Champions mode.** `applyFilters()` had
  `if(isChampionsMode){…} else if(g){…}` — an either/or, so selecting a generation while in Champions
  silently had no effect. They are independent filters and are now applied independently. Champions
  in Regulation M-B with Gen 2 selected returns 18 Pokémon, all inside the Gen 2 dex range.
- **2.2 hid that filter instead of fixing it.** The reasoning then — "meaningless against a fixed
  cross-generation roster" — was wrong: it was not meaningless, it was broken, and hiding it treated
  the symptom. It is visible again now that it works, because "which Gen 2 Pokémon are legal here"
  is a fair question of a cross-generational format.
- **The ability page ignored the Champions roster**, listing Riolu, Impidimp, Morgrem, Purrloin and
  other non-fully-evolved Pokémon that are not legal in the format. Same class of bug as the
  generation filter. The header also claimed "Showing Gen IX Pokémon" while in Champions; it now
  says which roster it is showing.

### Changed
- **The sorted stat is shown on every card.** Ordering by Speed without showing Speed made the order
  unverifiable and two cards impossible to compare without opening both. The badge appears only for
  stat orderings — dex number and name already show their own answer.
- **Decorative emoji removed** — 33 of them across the app. Functional glyphs stay: the direction
  arrows on the type chart axes and the natures matrix, the disclosure triangle, the close ×.
- **Tinted translucent panels removed** across 68 lines. A coloured wash behind a paragraph implied
  a meaning the content did not have. Panels now carry a neutral hairline and the coloured *text*
  does the work. Buttons keep their tint — they read as controls, and nobody objected to those.

### Added
- **A hint explaining multi-criteria search**, with a one-click demo. The feature shipped in 2.4 and
  was asked about immediately, which means it was not discoverable: the mechanic existed only in a
  placeholder. The hint states it and offers to perform it once, then disappears after the first
  criterion.

### Notes
- One of these was a genuine break I introduced and caught in the browser: the card badge shipped as
  a *call without a definition*, because an earlier script asserted out before its write while a
  later one added the call site. `cardSortValue is not defined` on every list render. The guard that
  caught it was reloading and looking, not the test suite.


## [2.7] — 2026-08-03

### Changed
- **Move Priority is a reference table with a filter, not a gallery of pills.** It is consulted
  mid-game under time pressure, and the old layout answered the wrong question: two columns meant
  scanning two axes, and every move was a tinted pill with a coloured dot, so nothing stood out
  from anything else. It is now one column running +5 down to −7, moves as plain text with a small
  type swatch, and a filter box at the top. Type "sucker" and the +1 bracket is the only thing left
  on screen; brackets with no surviving move disappear rather than sitting there empty.
- **The Physical / Special Split page is two tables.** The three tinted category cards with icon
  badges said nothing the words did not, and the tints implied a meaning the categories do not
  have; they are now a definition table that aligns the thing which actually differs — which stats
  each category reads. The wall of pills reading "Shadow Ball was Phys Special" crammed three facts
  into one token, and is now a Move / Gen III / Gen IV table, so the eye compares down a column
  instead of parsing across a badge.

### Notes
- **A bad edit was reverted rather than repaired.** The first attempt at the split page used an
  unbounded splice that removed 349 lines against 92 inserted, running past the section end and
  into the ability renderer. The tree was reset to the last verified commit and the work redone
  with explicit bounds and assertions — the block must contain what it should, must *not* contain
  the neighbouring function, and the resulting diff must be proportionate. Both replacements now
  assert before writing.
- Category colour lives on the category *name* only, where it is a label, rather than washing a
  whole panel. Same principle as the type chart fix in 2.2: colour identifies, it does not decorate.


## [2.6] — 2026-08-03

### Added
- **Teams survive a reload.** `teamSlots` lived in memory only, so refreshing the page lost the
  team — the real gap behind "you can save teams". The working team now autosaves to
  `localStorage` on every change and is restored on load, and teams can be saved under a name,
  reloaded from a dropdown, and deleted. Up to 30 are kept. Nothing leaves the browser.
- **Export as a Showdown paste**, the inverse of the importer, so a team round-trips to Showdown's
  teambuilder, Pokepaste and the damage calculators without loss. Verified byte-for-byte: a paste
  imported and re-exported comes back identical, including the forme name `Urshifu-Rapid-Strike`,
  the Tera line and a `0 SpA` IV.
- **"Showdown calc ↗"** copies the paste and opens their calculator, in Champions mode when you
  are in Champions mode.

### Notes
- **Their calculator cannot be preloaded from a URL.** I said earlier that it might be, having
  found `URLSearchParams` in their `shared_controls.js`. Reading the surrounding code, it uses the
  query string only for `gen` and `mode`; team data goes through their import box and their own
  localStorage. So the button copies and opens, and you paste once on their side. Saying that
  plainly beats a button that pretends to be automatic.
- Zero EVs and 31 IVs are omitted on export because Showdown omits them. Emitting them is legal but
  would make a round trip against a Showdown-authored paste differ, which is exactly what the new
  tests check.
- If the clipboard is refused — some browsers block it outside a user gesture — the paste is put
  into the import box and selected rather than failing silently.
- `tests/test-paste-import.js` grew from 32 to 57 assertions, covering the exporter and a real
  parse-of-emit round trip. Two mutations confirm it bites: emitting default stat values, and
  dropping forme segments from the species name, both fail the suite.


## [2.5] — 2026-08-03

### Added
- **Move descriptor tags.** Every move now shows the flags that decide which abilities and items
  interact with it — Contact, Punch, Bite, Pulse/Aura, Slicing, Sound, Ballistic, Wind — with the
  consequence on the tag itself. Aura Sphere is both **Ballistic** and **Pulse ×1.5**: Mega
  Launcher boosts it and Bulletproof blocks it outright. That decides games and is invisible in a
  plain move description.
  - A tag whose flag has a boosting ability is tinted with the "up" colour and carries the
    multiplier; a flag that can be blocked entirely (Bulletproof, Soundproof) is tinted with the
    "down" colour. Hovering gives the full consequence, including the defensive punishers on
    contact moves and what negates them.
  - Two findings from wiring it up: **Surging Strikes is a punch move**, so Iron Fist boosts it on
    top of its guaranteed critical hits; and Aura Sphere carries both flags at once, which is why
    it is the clearest example of the feature.

### Notes
- The flags are **derived at runtime** from the bundled calc engine (`gen.moves.get(id).flags`),
  not transcribed, so they cannot drift from what the damage calculator actually uses. Only the
  ability and item consequences are hand-written, because that is domain knowledge rather than data
  the engine holds — and that hand-written half is what `tests/test-move-tags.js` (34 assertions)
  checks: every flag the engine can emit has an entry, the six boosting abilities are recorded with
  correctly formatted multipliers, and the two abilities that block a move outright say so in the
  words the renderer keys its styling off.
- Without the calc engine loaded, `moveDescriptors()` returns nothing and no tags render. Degrading
  to silence rather than to a confident wrong answer is the contract, and it is tested.


## [2.4] — 2026-08-03

### Added
- **Multi-criteria Pokédex search.** "A Dark type with Prankster that gets Rain Dance" is three
  criteria intersected, not one substring match. Type a term on the Pokédex tab and press Enter and
  it becomes a filter token; they stack and are ANDed. That query returns Murkrow, Sableye,
  Purrloin and Liepard.
  - Each criterion resolves to a **set of dex numbers with one request**: `/type/{t}`,
    `/ability/{a}` and `/move/{m}` each return their own member list. Loading all 1025 Pokémon to
    filter locally is what makes this kind of search feel impossible in a client-only app; it is
    never done. Sets are cached, so re-adding a criterion is free.
  - A term is classified against the type list and the ability and move indexes the app already
    preloads. An unrecognised term is **never guessed at** — it falls through to the ordinary
    substring search rather than silently changing what you are looking at. A criterion that fails
    to resolve matches nothing rather than quietly widening the results.
  - Tokens name their own kind ("ABILITY Prankster"), so a reader never has to infer from colour
    whether a term was read as an ability or a move.
- **A sort control**, covering dex number, name, BST, each of the six stats, and **recently added**.
  Recently-added is derived from the regulation registry — the set difference between the current
  regulation and the one before it — so it stays correct when a regulation is added and needs no
  hand-kept list. In Champions it currently surfaces exactly the 22 Pokémon added in Regulation M-B.

### Notes
- This makes the hand-written "New in Pokémon Champions" banner redundant; removing it is queued
  rather than done here, so the sort can be checked against the banner it replaces first.
- `tests/test-dex-search.js` (19 assertions). Worth recording: its first draft **passed its sort
  assertions without ever changing the sort** — `let dexSort` inside the sliced code is scoped to
  the eval, so the outer stub assignment did nothing. The suite now exports a setter that closes
  over the real binding, and a mutation reversing the comparator fails it. The tautological
  "recently added" assertion in that draft was replaced with a real one.


## [2.3] — 2026-08-03

### Fixed
- **The team editor showed a 510 EV budget in Champions mode.** Champions replaces EVs with Stat
  Points — 0–32 per stat, 66 total, whole steps — and the damage calculator already knew that, but
  the editor did not: it offered a 510 budget, capped each stat at 252, and stepped in fours. The
  rules are now declared once in `statBudget()` and read by both, so they cannot disagree again.
  The label switches between "SP" and "EVs" with the mode.

### Changed
- **Team weaknesses, resistances and offensive coverage are now two matrices.** They were three
  lists of comma-separated names that ran down the page. Rows are the eighteen types and columns
  are your team, so "who folds to this?" and "who covers this?" are a glance down a column instead
  of a paragraph to parse. Defensive rows sort by quad-weaknesses first, offensive rows sort holes
  first, and ×4 / ×¼ cells carry a ring rather than a different hue so the diverging pair keeps its
  meaning. Cell colours are the type chart's, so the app speaks one visual language.
- **Team slot moves sit in a fixed 2×2 grid.** Flex-wrap gave four across on short names and 3+1 on
  long ones, so cards read ragged. Every card now has the same geometry regardless of move length.

### Notes
- The two matrices share a row axis deliberately: a type with no tick in the offensive matrix and a
  column of ×2 in the defensive one is the same problem seen from both sides.


## [2.2] — 2026-08-03

### Fixed
- **The type chart redesign in 1.99 made it worse, and this reverses that part of it.** Softening
  was right for the neutral cells and wrong for everything else: the tinted fills washed out, and
  reducing the type labels to a hairline chip destroyed scannability. The eighteen type pills *are*
  the axes — loud identity anchors are what make a matrix readable — so they are back at full
  saturation, and the effectiveness cells are solid again with white text. Neutral cells keep a
  faint fill rather than none: with nothing drawn, the grid stopped reading as a grid and rows
  became impossible to track. Glyphs are back to bare `2` / `½` / `0`, which read better than
  `×2` at 24px, with the multiplier spelled out in the legend.
  - The accessibility fix is untouched. Solid fills use `#2a6fc4` / `#c0403c`, validated on this
    app's surfaces (CVD ΔE 21.0, normal-vision 28.5, contrast ≥3:1, all pass) and carrying white
    text at 5.0:1 and 5.2:1. Colour still never encodes alone.

### Changed
- **The natures table is now a 5×5 matrix.** That is the real shape of the data — five raised stats
  against five lowered — and it turns "I want +Speed −Sp. Atk" into a single lookup instead of a
  scan down twenty-five rows. The diagonal is empty because a nature cannot raise and lower the
  same stat, which is also the honest explanation of why there are five neutral natures. It uses
  the same crosshair idiom as the type chart, so learning one teaches the other.

### Fixed
- **The generation filter is hidden in Champions mode.** The Champions roster is a fixed,
  deliberately cross-generation list, so filtering it by debut generation only fragments it. The
  control is reset as well as hidden — otherwise a stale selection carries on filtering from a
  control that is no longer on screen.

## [2.1] — 2026-08-02

### Fixed
- **EV Training was still hiding Sword and Shield.** The list of games PokéAPI has no encounter data
  for existed in **two** places — `loadLocations()` and `renderEVSpots()` — and 1.99 only fixed one.
  The Locations tab started serving Galar while EV Training carried on reporting that the data did
  not exist. This is exactly how the two drifted in the first place, so the list is now declared once
  as `NO_ENCOUNTER_DATA` and both readers share it. Verified: EV training spots for Sword now list
  Clefable and the rest with their location counts.

### Notes
- Found by checking the deployed file rather than the diff — `grep` on the live page returned two
  `UNSUPPORTED_VERSIONS` declarations where there should have been one. Shipping 1.99 as "fixed" was
  wrong; it was half fixed.
- `tests/test-viz-palette.js` now also asserts the list is declared exactly once, that Sword and
  Shield are absent from it, that the genuinely-empty games are still present, and that both call
  sites read the same constant.

## [2.0] — 2026-08-02

### Added
- **The damage calculator answers all four moves at once.** A filled Team Builder slot gets a
  **Calc** button that loads the species, its four moves, item and ability, then runs the engine
  once per move against one defender and ranks the results best-first. This changes the question the
  tab answers: from "how much does this move do" to "which of my moves does the most to this",
  which is the question people actually arrive with. Status moves and anything the engine cannot
  resolve are listed separately rather than silently dropped.
  - `calcRunSmogon()` gained `moveOverride` and `collect` parameters instead of being duplicated, so
    both views run the *same* calculation and cannot drift apart.
- **Showdown / Pokepaste import.** The Team Builder takes a Showdown export block — the format the
  Showdown teambuilder, Pokepaste and every serious calculator already speak — and fills the team
  from it: species, nickname, gender, item, ability, level, Tera type, EVs, IVs, nature and moves.
  Parsed here rather than by pulling in `@pkmn/sets`, because `calc-engine.js` is already a ~480 KB
  bundle and the one-file, no-dependency constraint is worth more than the ~60 lines saved.
  Importing replaces the team rather than appending — a paste is a whole team, not an addition.

### Fixed
- **The calculator's "name lookup failed" error named the wrong thing.** It reported any of three
  different failures identically. Forme-named species are the usual cause — PokéAPI calls 645
  `landorus-incarnate` while the calc engine calls it `Landorus` — and the message now says which
  lookup failed.

### Notes
- **A first draft of the paste importer silently imported the wrong Pokémon.** Its fallback matched
  species by prefix, so `Rotom-Wash` resolved to base Rotom (Electric/Ghost instead of
  Electric/Water) and `Urshifu-Rapid-Strike` resolved to Urshifu-**Single**-Strike — a different
  Pokémon with different typing, silently substituted into your team. The resolver now asks PokéAPI
  for the exact forme slug, which it serves, and accepts **exact matches only**; anything it cannot
  resolve is named in the status line. Importing nothing is better than importing something the
  paste did not say. Caught in browser testing, not by the unit tests — the parser was correct, the
  resolution was not.
- `tests/test-paste-import.js` (32 assertions) covers the parser against real-world messiness:
  nicknames, genders, trailing whitespace Showdown actually emits, hyphenated formes, absent
  fields, zero IVs that must not be dropped as falsy, and multi-member blocks.


## [1.99] — 2026-08-02

### Fixed
- **Sword and Shield location data was being hidden.** `UNSUPPORTED_VERSIONS` listed both as having
  no PokéAPI encounter data. They do have it — Galar is region 8 with 92 locations, and the API
  returns encounters for `sword`, `shield`, and the Isle of Armor and Crown Tundra entries. The app
  was suppressing real data and telling users it did not exist. Only Brilliant Diamond, Shining
  Pearl, Legends: Arceus, Scarlet and Violet are genuinely empty; the on-screen message said
  "Gen VIII–IX", which was wrong, and now names the games. Verified: Galar Route 1 returns Skwovet
  at Lv 2–5 / 40% and Blipbug at 30%.
- **The type chart and the natures table were unreadable for colourblind users.** Both encoded
  their two states as saturated green against saturated red. Measured with the data-viz palette
  validator against this app's own surfaces, that pair scores a CVD separation of **ΔE 4.2**
  (deuteranopia) against a ≥8 target — a fail. Roughly 1 in 12 men could not distinguish "super
  effective" from "not very effective", or "+10%" from "−10%". Replaced with the validated
  diverging pair — dark `#3987e5`/`#e66767`, light `#2a78d6`/`#e34948` — which passes every check
  in both themes (CVD ΔE 19.2 dark / 21.6 light, normal-vision 29.0 / 32.3, contrast ≥3:1).

### Changed
- **Type chart: the grid stops shouting.** Neutral ×1 cells now carry no fill, only a hairline.
  Slightly over half the grid says nothing, and letting it recede is what makes the signal legible
  without turning the signal up. Every non-neutral cell carries a glyph — ×2, ×½, ×0 — so the chart
  still reads with colour removed entirely. Immunity gets the solid treatment rather than the
  dullest one, because ×0 is categorically different from "less effective" and is the most
  decision-relevant cell on the board. Type labels became a thin colour chip over neutral text, so
  eighteen saturated pills stop competing with the layer that carries meaning.
- **Type chart: hovering a cell lights its whole row and column** and outlines both type headers.
  Tracing one cell back to two labels across an 18×18 grid was the hardest part of reading it. Row
  headers are also sticky, so they survive horizontal scrolling.
- **Natures: direction is no longer colour-only.** ▲ and ▼ carry the meaning, so it survives
  greyscale, printing and colour vision deficiency. Columns are now "Raises" and "Lowers" rather
  than "+10%" and "−10%" — the percentage is already stated in the line above, and the column's job
  is what a first-time reader needs. Zebra rows let the eye cross three columns without drifting.
  The five neutral natures collapse into one summary line instead of ten em-dashes that read as
  missing data.

### Added
- **`tests/test-viz-palette.js`** (28 assertions), a guard rather than a rendering test: it fails if
  the retired hexes reappear in the chart or natures rules, if either theme loses its `--eff-*`
  variables, if any colour that *encodes* meaning goes back to a literal, or if the glyph and arrow
  fallbacks are removed. Scoped to those two components deliberately — the same greens and reds are
  legitimate elsewhere as single-state indicators, where there is no pair to confuse.

### Notes
- Colour is now reinforcement in both views, never the sole carrier. That is the actual fix; the
  palette swap alone would have left a chart that fails in greyscale and in print.


## [1.98] — 2026-08-02

### Added
- **`POKEMON_PAST_TYPES`, a real record of historical Pokémon typing** — 24 species, generated from
  Pokémon Showdown's per-generation mod data, the same source and method as `PAST_STATS`. Until now
  the application had no record of what a species used to be. `filterTypesForGen()` merely *deleted*
  types that did not exist yet, and nothing else stood behind it.

### Fixed
- **Togetic and Togekiss were pure Flying in Generations II–V.** Both are Normal/Flying before
  Generation VI. Subtraction is only correct where Fairy was *added* to a species; where it
  *replaced* a type, dropping "fairy" loses one outright. This was not cosmetic — Normal/Flying is
  immune to Ghost and neutral to Fighting, while pure Flying is neither, so the defensive matchup
  panel, the Pokédex cards, the compare view and the damage figures were all wrong for those two in
  four generations. Verified against Serebii's Black/White dex, which lists Togetic as Normal/Flying.
- **The Team Builder scored teams against types that did not exist.** `renderTeamAnalysis()` read
  `p.types` raw, with no generation correction at all, so a Generation V team containing Clefable
  was analysed as Fairy — a type introduced a generation later. It now resolves typing the same way
  every other view does. The team slot badges and the set-editor badges were showing present-day
  types for the same reason and are corrected with it.

### Notes
- `pastTypes` (lower case) is unrelated and was never broken: it holds per-*move* type history from
  PokéAPI's `past_values` and works correctly. The row in the technical documentation describing it
  as Pokémon typing was mislabelled and has been corrected.
- Storing present-day types on team and compare slots is deliberate. Typing is resolved at render
  time from the dex number, so a team stays correct when the selected generation changes.
- Three of the generation-aware tables have now been found wrong on inspection: `PAST_STATS`
  (1.96), the Generation I type chart (1.97), and typing (this release). All three are now either
  generated from published data or covered by tests. `ITEM_INTRO_GEN`, `EVO_OVERRIDES` and
  `REGIONAL` have not been audited; recorded as backlog item 16.


## [1.97] — 2026-08-02

### Added
- **Tabs now hide themselves when they do not apply.** Champions mode is a competitive format
  rather than a playable world, so Locations and EV Training no longer appear while it is
  selected — there are no routes to list and no in-game training spots to point at. The rule lives
  in one `TAB_RELEVANCE` table rather than scattered `isChampionsMode` checks, and `switchTab()`
  redirects to the Pokédex if a saved link names a tab the current selection has hidden.
- **Team Builder: ×4 and ×¼ matchups.** The team analysis folded ×4 into "weak" and ×0.25 into
  "resist", which hid the matchups that actually decide games. Quad weaknesses and quad resistances
  are now counted separately and badged inline; quad weaknesses also get their own line, because a
  single member taking ×4 matters even when nobody else on the team is weak to that type.
- **Team Builder: a Dex button on each filled slot.** The slot body opens the set editor, so
  reaching the full Pokédex entry needed its own control rather than a change to what clicking does.

### Fixed
- **Generation I: Fire no longer resists Ice.** Fire gained that resistance in Generation II; the
  Gen I chart `C1` carried `ice → fire: ½`, so Ice moves read as resisted in Red/Blue/Yellow. The
  chart's other Gen I quirks were already correct and were re-checked in the same pass: Bug → Poison
  at 2×, Poison → Bug at 2×, and Ghost → Psychic at 0× (the Gen I programming bug) all verified
  against the Gen I chart and against `C2`.
- **Stat bar colours are now absolute thresholds.** The old `statColor()` interpolated a red → green
  ramp over `value / 180` while the bar's *length* used `value / 255`, so colour and length
  disagreed, everything above 180 looked identical, and the function's own comment described four
  bands it did not implement. Colour now comes from fixed bands — under 60 poor, 60–89 average,
  90–119 good, 120+ excellent — so a number means the same thing in every generation and does not
  drift as new Pokémon are added. Length still carries magnitude; the band is exposed as a tooltip.
- **Urshifu's signature moves describe their guaranteed critical hit.** Wicked Blow and Surging
  Strikes take their text from PokéAPI, which does not explain that the crit ignores the target's
  defensive boosts and the user's own offensive drops, nor that Battle Armor, Shell Armor and Lucky
  Chant switch it off. Both now have `VARIABLE_MOVE_INFO` entries, including the Unseen Fist note
  about hitting through Protect and Detect.

### Notes
- The damage calculator was **already correct** for both Urshifu moves — the bundled engine carries
  `willCrit` for each and `multihit: 3` for Surging Strikes. Only the descriptions were wrong. This
  closes the open question recorded against backlog item 11.
- Still open from the same batch: regional dex filter toggle (4), stripping the Fairy type from
  Pokémon typing in Gens I–V (5), and remembering the selected form tab (12).


## [1.96] — 2026-08-02

### Changed
- **`PAST_STATS` is now generated, not hand-typed.** The Krookodile bug fixed in 1.95 was one
  symptom of a table that was largely wrong. Auditing all 43 entries against Pokémon Showdown's
  per-generation mod data found only 10 correct. The table is now derived by diffing
  `data/mods/gen{5,6,7,8}/pokedex.ts` against Showdown's current Pokédex, and covers 58 Pokémon
  across four cutoffs. The two independent spot checks used to validate the derivation — Serebii's
  Black/White and X/Y dex entries for Krookodile and Dodrio — both agree with it.

### Fixed
- **Ten species showed Sun/Moon stats one generation early.** Arbok, Dugtrio, Farfetch'd, Dodrio,
  Electrode, Exeggutor, Noctowl, Ariados, Qwilfish, Magcargo and Corsola had their Generation VII
  revision filed under a Generation VI cutoff, so the Gen VI view served Gen VII values. Dugtrio is
  the clearest case: its Attack went 80 → 100 in Sun/Moon, but Gen VI displayed 100.
- **Eleven entries asserted values that were never real.** Alongside the mis-filed revisions sat
  invented figures — Dugtrio at 100 Speed (it has been 120 in every generation), Venomoth at 65
  Sp. Atk (always 90), and similar for Starmie, Quagsire, Magcargo and Corsola. A further 15
  entries were no-ops that rewrote the present-day value over itself.
- **41 revisions were missing entirely**, including every Generation VIII and IX change (Aegislash's
  150 → 140 defences, Cresselia, Zacian and Zamazenta) and 18 Generation VI changes.
- **`getStatsForGen()` layered revisions in the wrong order.** It walked the cutoffs with
  `Object.entries()`, which visits integer-like keys in ascending order, so for a species revised
  more than once the *newest* revision was applied last and won. Revisions are now applied newest
  first, leaving the era closest to the selected generation to win. No shipping species had two
  revisions at the time, so this was latent rather than visible — the new table introduces the
  possibility, so the bug is fixed ahead of it.

### Added
- **`tests/test-past-stats.js`** (29 assertions), which slices the real table and the real
  `getStatsForGen()` out of `app/index.html` so it cannot drift from shipped code. It pins
  Krookodile, the Dugtrio mis-filing, the Pikachu/Raichu duplicate-key regression, Aegislash and
  Cresselia, and asserts the structural invariants: no duplicate ids in the literal, every cutoff
  in 6..9, every stat name a valid PokéAPI name. Verified to have teeth by mutation: removing the
  Krookodile entry, re-filing Dugtrio under Gen VI, reintroducing a duplicate id, and reversing the
  layering order each fail the suite.

### Notes
- Base stats were stable from Generation II through Generation V — Showdown carries no stat
  overrides for gens 2, 3 or 4 — so cutoff 6 is the earliest that can exist.
- Generation I is still not modelled. It used a single Special stat rather than the Sp. Atk /
  Sp. Def split, which is a display question (one Special bar versus two identical ones) rather
  than a value substitution. Recorded as open; see `docs/BACKLOG.md`.
- CI now discovers `tests/test-*.js` by glob instead of naming one file, so a new suite cannot be
  added without being run.


## [1.95] — 2026-08-02

### Fixed
- **Krookodile's Defense now reads 70 in Generations V, not 80.** Krookodile debuted in Black/White
  with 70 Defense (BST 509) and was raised to 80 in Generation VI (X/Y). It was absent from
  `PAST_STATS`, so the Gen V view served the current PokéAPI value. Added `553:{6:{defense:70}}`.
  Confirmed against Serebii's Black/White dex (70) and X/Y dex (80), and against Bulbapedia's
  Krookodile page, which splits the stat block at "Generation V" / "Generation VI onward".
  BST is derived from `getStatsForGen()`, so the header total corrects to 509 with it.
- **Two duplicate keys in `PAST_STATS` were silently deleting correct data.** The table declared
  `25` and `26` twice — once under a Gen 6 cutoff and again under a "Gen 7 changes (Sun/Moon)"
  heading. In a JavaScript object literal the later duplicate key replaces the earlier one
  outright, so the Gen VI entries for Pikachu and Raichu never existed at runtime. Effect:
  Generations I–V showed Pikachu at 40 Defense / 50 Sp. Def (correct: 30 / 40) and Raichu at
  110 Speed (correct: 100). Both stat changes happened in Generation VI, not Generation VII —
  Bulbapedia's Generation VII list contains neither Pokémon — so the Gen 7 entries were wrong on
  their own terms as well as destructive. Removed them; the Gen 6 entries now take effect.

### Notes
- The Generation VII cutoff is now unpopulated, and roughly 25 Pokémon changed stats in Sun/Moon.
  Nine of them (Farfetch'd, Dodrio, Electrode, Exeggutor, Noctowl, Ariados, Qwilfish, Magcargo,
  Corsola) are already in the table under a Gen 6 cutoff and may be mis-bucketed, which would make
  the Generation VI view show Sun/Moon values. Not audited in this pass; recorded as open.


## [1.94] — 2026-07-22

### Added
- **Governance and delivery files** to meet the portfolio's public-company documentation bar:
  `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `.gitignore`, and a GitHub Actions CI
  workflow that runs the test suite on every push and pull request.


## [1.93] — 2026-07-22

### Fixed
- **Champions mode now stays selected.** The application already opened in Champions mode on
  Regulation M-B from a plain address, but `saveHash()` wrote `g9` into the URL while Champions mode
  was active, and the hash reader read `g9` as an instruction to leave Champions mode. Every link the
  app produced therefore opened the wrong mode. The published link `#pokedex/g9/gm:reg-mb` had this
  defect.
  - `saveHash()` and the Ctrl+click handler now write `gchampions` in Champions mode.
  - Both hash readers accept `gchampions` and ignore a generation number when the hash also carries a
    `gm:reg-*` token, so legacy links open Champions mode correctly.
  - An unknown regulation key falls back to the newest regulation instead of an empty dex.

### Added
- **`CHAMPIONS_REGS` registry**, ordered newest first. The default regulation is `CHAMPIONS_REGS[0]`;
  a new regulation is one row at the top of the array. Replaced four hard-coded `reg-ma`/`reg-mb`
  comparisons with registry lookups.
- `tests/test-hash-routing.js` (9 tests), sliced out of `app/index.html` so they cannot drift.
- `docs/HOOPADEX-whitepaper.md` and `docs/HOOPADEX-deck-plain-english.md`. The project standard
  requires all three documents; only the technical documentation existed before. Both state the
  largest verification gap plainly: the historical type charts and stat revisions are covered by no
  automated test, which matters because historical accuracy is the whole premise of the project.

### Notes
- The published copy must keep the name `index.html` because GitHub Pages serves it as the site entry
  point. For this file the version comment on line 2 is the authoritative version marker; the rename
  rule still applies to archived standalone copies.

---

## [1.92] — 2026-07-22

### Added
- HoopaDex brought into the Pokémon umbrella project with the standard structure.
- Application version 1.92 installed at `app/HoopaDex_1_92.html`.
- Full technical documentation (ASD-STE100, Diátaxis): tabs, generation-aware data tables, external
  data sources, caching, and the versioning rule.

### Changed
- **Documentation corrected from the published source.** Located the published version at
  `github.com/willhoop/hoopadex`. The Champions learnset export `champions-learnsets.json` (~1.4 MB)
  was documented with its real schema: move-level `name`/`type`/`category`, and per-species
  `species`, `num`, `sid`, `methods`, `legalIn`, covering `reg-ma` and `reg-mb`.
- Documented the published additions over v1.92: Champions mode, a damage calculator using the
  official `@smogon/calc` engine, and the SP stat system.

### Fixed
- **Corrected the `methods` documentation.** Champions has no level-up movesets and no TM items; a
  species can learn a move or it cannot. All 14,192 pairs hold the single value `["TM"]`, so the
  field has zero variance and no meaning. Earlier text describing the export as recording "how a move
  is learned" was wrong. The export is a flat legality list per regulation.

### Notes
- Version history before this changelog was recorded only in the file-name convention.
