# HoopaDex

A generation-aware Pokédex that runs from a folder of static files. It shows types, stats,
abilities, moves and evolutions **as they were in the game you pick** — every generation, every main
game, Pokémon Champions, and six ROM hacks.

**Version 5.59 · 2026-10-13** · Live: [willhoop.github.io/hoopadex/app](https://willhoop.github.io/hoopadex/app/)

## What it covers

- **Generations I–IX, game by game.** Steel resisted Ghost and Dark before Generation VI, Fairy did
  not exist, Recover had 20 PP in Generation III. FireRed shows FireRed's sprites, not Emerald's.
- **Pokémon Champions**, regulation by regulation, with Champions' own PP rule, move changes and
  sprites, and a damage calculator built on `@smogon/calc`.
- **ROM hacks** in their own section: Renegade Platinum (Complete / Classic), Sacred Gold / Storm
  Silver (Complete / Classic, optional Fairy patch), Platinum Kaizo, Emerald Kaizo, FireRed Omega and
  Run & Bun. Each hack's own types, base stats, abilities, moves, learnsets and evolutions, from its
  author's documentation where one exists, checked against a second source; the Dmg Calc tab links to
  the hack's own calculator. A **Trainers** tab lists every trainer by section of the game, with your
  own notes and a "beaten" tick saved in the browser, and copies a team for a calculator. The
  **Locations** tab lists each hack's wild encounters, area by area.
- **Trainer AI**, read from the decompiled games: how trainers pick moves, when they switch, and what
  they send in, for Generations III and IV and every hack built on them.
- **A fallback archive.** If pokeapi.co fails, every request is answered from
  [willhoop/pokeapi-data](https://github.com/willhoop/pokeapi-data), a raw copy of PokéAPI synced
  weekly that never deletes.

## Components

| Part | Where | What it is |
|---|---|---|
| App | `app/index.html` | The application. Version on line 2. |
| Damage engine | `app/calc-engine.js` | Vendored `@smogon/calc`, checksum-pinned (`data/vendor-pins.json`). |
| List snapshots | `app/dex-index.json`, `app/abilities-index.json`, `app/moves-index.json` | PokéAPI data the list views read in one request each. |
| Champions learnsets | `app/champions-learnsets.json` | Move legality per regulation. Read by CHOMP. |
| ROM hack data | `app/hacks/*.json`, `*.data.json`, `*.trainers.json`, `*.encounters.json` | Species; moves, learnsets, evolutions, items; trainers; wild encounters. |
| Generators | `build/generate-*.js` | Every derived table and snapshot. Each has `--check` for drift. |
| Tests | `tests/test-*.js` | 49 suites, 1,924 assertions. |
| Mutation check | `build/mutation-check.js` | 190 deliberate defects; each must turn a suite red. |
| API archive | [willhoop/pokeapi-data](https://github.com/willhoop/pokeapi-data) | Fork of PokeAPI/api-data. Weekly add-and-update sync. |

## Documentation

- [White paper](docs/HOOPADEX-whitepaper.md) — results, figures and sources.
- [Plain-English deck](docs/HOOPADEX-deck-plain-english.md) — the same story without the jargon.
- [Technical documentation](docs/HOOPADEX-technical-docs.md) — install, run and maintain (ASD-STE100, Diátaxis).
- [CHANGELOG](CHANGELOG.md) — every change, with the reason.
- [Regulation changes](docs/REGULATIONS.md) — generated; do not edit.

## Running the tests, and publishing

```
for f in tests/test-*.js; do node "$f"; done
node build/mutation-check.js
bash build/publish.sh
```

The version on line 2 of `app/index.html` and the newest CHANGELOG entry must match;
`tests/test-syntax.js` fails if they do not. `publish.sh` refuses to push a red suite.

## The Champions export

`app/champions-learnsets.json` answers "can this Pokémon legally use this move in this regulation?"
for every regulation. CHOMP reads it; its schema is section 3.6 of the technical documentation.
Canonical URL: `https://raw.githubusercontent.com/willhoop/hoopadex/main/app/champions-learnsets.json`
