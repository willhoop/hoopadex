# HoopaDex

A complete Pokédex in **one HTML file**. No build step, no server, no install — open it and it runs.

Its distinguishing feature is that it is **generation-aware**: it shows the type chart, base stats,
types, abilities, items, and evolution chains *as they were in the generation you select*, not only
as they are today. Steel resisted Ghost and Dark before generation 6. Fairy didn't exist. Several
Pokémon changed type. A dex that ignores that gives wrong answers about older games.

## Features
Ten tabs: Pokédex · Moves · Abilities · Items · Locations · Type Chart · Natures · Team Builder ·
EV Training · Other (move priority, physical/special split, compare, EV yields, training spots).

Plus fuzzy search, pinning and side-by-side comparison, per-game encounter locations, TM lists,
a six-slot team builder with importable competitive sets, and a light/dark theme.

## Two versions
| | Where | Notes |
|---|---|---|
| **Published (current)** | [willhoop.github.io/hoopadex](https://willhoop.github.io/hoopadex/) · [repo](https://github.com/willhoop/hoopadex) | Adds **Champions mode**, a **damage calculator** built on the official `@smogon/calc` engine, and the **SP stat system** (0–32 per stat, 66 budget, fixed 31 IVs, level 50). |
| Local snapshot | `app/HoopaDex_1_92.html` | Version 1.92. No Champions mode. |

Both need an internet connection — they read live data from PokéAPI.

## Versioning rule
The version is recorded on line 2 of the HTML file. **When you edit the file, increment that
version and rename the file to match** (`HoopaDex_1_92.html` → `HoopaDex_1_93.html`), then record
the change in `CHANGELOG.md`.

## Documentation
`docs/HOOPADEX-technical-docs.md` — full technical documentation (ASD-STE100, Diátaxis).

## The Champions export
The published version produces **`champions-learnsets.json`** (~1.4 MB), the authoritative answer to
"can this Pokémon legally use this move in this regulation?". It covers multiple regulations
(`reg-ma`, `reg-mb`) and records how each move is learned.

**CHOMP consumes this file** to validate every recommended move. Its schema is documented in
section 3.6 of the technical docs and is treated as a public contract — changing it breaks CHOMP.

Canonical URL:
`https://raw.githubusercontent.com/willhoop/hoopadex/main/champions-learnsets.json`
