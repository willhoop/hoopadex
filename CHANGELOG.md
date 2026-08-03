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
