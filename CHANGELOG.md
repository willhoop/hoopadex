# CHANGELOG — HoopaDex
Newest first. The application version lives on line 2 of the HTML file.

## 2026-07-22 — documentation
- Added HoopaDex to the Pokémon umbrella project with the standard structure.
- Installed application version **1.92** at `app/HoopaDex_1_92.html`.
- Wrote full technical documentation (ASD-STE100, Diátaxis) from the source: tabs, generation-aware
  data tables, external data sources, caching, and the versioning rule.
- Recorded an open item: the Champions learnset export consumed by CHOMP is not present in v1.92.

## Application history
- **1.92** — current version in this folder. Earlier version history is recorded only in the file
  name convention; no changelog existed before this document.

## 2026-07-22 — documentation corrected from the published source
- Located the published version: `github.com/willhoop/hoopadex`, served at `willhoop.github.io/hoopadex`.
- **Closed the open item.** The Champions learnset export exists as `champions-learnsets.json` (~1.4 MB).
  Documented its real schema: move-level `name`/`type`/`category`, and per-species `species`, `num`,
  `sid`, `methods`, and `legalIn`. It covers multiple regulations (`reg-ma`, `reg-mb`).
- Documented the published additions over v1.92: **Champions mode**, a **damage calculator** using the
  official `@smogon/calc` engine, and the **SP stat system**.
- Documented the URL hash format (`#pokedex/g9/gm:reg-mb`).
- Corrected an earlier assumption: the export records which regulations allow each species-and-move
  pair.

## 2026-07-22 — v1.93: Champions mode opens by default, and stays selected
**Defect fixed.** The application already started in Champions mode on Regulation M-B from a plain
address. However `saveHash()` wrote `g9` into the URL while Champions mode was active, and the hash
reader used `g9` to leave Champions mode. Any link the application produced therefore opened the
wrong mode. The published link `#pokedex/g9/gm:reg-mb` had this defect.

Changes in `app/index.html`:
- Added a `CHAMPIONS_REGS` registry, ordered newest first. The default regulation is now
  `CHAMPIONS_REGS[0]`. A new regulation is one row added to the top of this array.
- `saveHash()` and the Ctrl+click handler write `gchampions` in Champions mode.
- Both hash readers accept `gchampions`, and ignore a generation number when the hash also holds a
  `gm:reg-*` token. Legacy links open Champions mode correctly.
- An unknown regulation key falls back to the newest regulation instead of an empty dex.
- Replaced four hard-coded `reg-ma`/`reg-mb` comparisons with registry lookups.

Added `tests/test-hash-routing.js`: 9 tests, all passing. The test file slices the parser out of
`app/index.html` instead of copying it, so the tests cannot drift from the shipped code.

**Note on the version rule.** The published copy must keep the name `index.html` because GitHub
Pages serves it as the site entry point. For this file the version comment on line 2 is the
authoritative version marker. The rename rule still applies to archived standalone copies.

## 2026-07-22 — correction: `methods` carries no information in Champions
Champions has no level-up movesets and no TM items. A species can learn a move or it cannot, and any
learnable move is taught for 100 VP. Checked against the export: all 14,192 species-and-move pairs
hold the single value `["TM"]`, so the field has zero variance and no meaning in this format.

Earlier documentation described the export as recording "how a move is learned". That was wrong and
is corrected. The export is a flat legality list for each regulation. Documented in the technical
documentation under "How Champions movesets differ from the main games".

## 2026-07-22 — white paper and deck written
HoopaDex had technical documentation but no white paper and no plain-English deck. The project
standard requires all three. This was a gap in the documentation work, not a decision.

- Added `docs/HOOPADEX-whitepaper.md`: the historical-correctness problem stated with examples,
  the generation-as-query-parameter data model, the Champions SP formulas, the learnset export
  and the rule that absence means unknown rather than illegal, the URL-routing defect and its
  correction, and the limitations. Sources cited.
- Added `docs/HOOPADEX-deck-plain-english.md`: the same content in plain words.
- Both state the largest verification gap plainly: the historical type charts and stat
  revisions are not covered by any automated test, which matters because historical accuracy
  is the whole premise of the project.
