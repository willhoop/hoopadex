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
