# HoopaDex — Technical Documentation

**Version 1.1 · Last updated 2026-07-22**
Documents the published application and the local file `app/HoopaDex_1_92.html`.
Written in ASD-STE100 Simplified Technical English. Organised with the Diataxis model.

---

## 0. About this document

### 0.1 Purpose
This document tells you how to use, host, and change HoopaDex. A new engineer can use this
document to start work without help.

### 0.2 What HoopaDex is
HoopaDex is a Pokedex web application. It is **one HTML file**. It has no build step, no server,
and no dependencies to install. You open the file and it runs.

The application covers **all nine generations** of the games. It is *generation-aware*. It shows
the type chart, the base stats, the types, the abilities, and the items **as they were in the
generation that you select**. It does not show only the current values.

### 0.3 Terms
| Term | Meaning |
|---|---|
| generation | A numbered era of the games, from 1 to 9. |
| version group | A specific game release, for example `sword-shield`. |
| species id | The National Dex number of a Pokemon. |
| form | An alternative appearance of a species, for example a regional form. |
| pin | A Pokemon, ability, item, or location that you keep on screen for comparison. |
| set | A competitive build: an item, an ability, a nature, stat spreads, and moves. |

---

# PART 1 - TUTORIAL
*Learn HoopaDex.*

## 1.1 Open the application
1. Double-click `app/HoopaDex_1_92.html`.
2. The application opens in your browser.

Installation is not necessary. An internet connection is necessary. See Part 3.4.

## 1.2 Find a Pokemon
1. Type a name in the search bar at the top.
2. Select a result. The application shows the detail view.

The search is fuzzy. It finds a Pokemon if you spell the name incorrectly.

## 1.3 Compare two Pokemon
1. Find the first Pokemon. Add it to the compare list.
2. Find the second Pokemon. Add it to the compare list.
3. Open the **Other** tab. Select **Compare Pokemon**.

## 1.4 Build a team
1. Open the **Team Builder** tab.
2. Add a maximum of six Pokemon.
3. Apply a competitive set to a team member. See Part 2.3.

---

# PART 2 - HOW-TO GUIDES
*Do one task.*

## 2.1 How to see historical data for one generation
1. Select the generation or the game in the filter.
2. The application changes what it shows.

The application changes these items when you change the generation:
- The **type chart**. For example, Steel resisted Ghost and Dark before generation 6.
- The **types of a Pokemon**. Some Pokemon changed type. Fairy did not exist before generation 6.
- The **base stats**. Some Pokemon received stat changes.
- The **abilities**. The application hides an ability that did not exist in that generation.
- The **items**. The application hides an item that did not exist in that generation.
- The **evolution chain**. The application removes an evolution that did not exist.

## 2.2 How to find where a Pokemon appears in a game
1. Open the detail view of the Pokemon.
2. Open the **Locations** tab.
3. Select the game.

The application groups the locations by type of encounter.

## 2.3 How to apply a competitive set
1. Open the **Team Builder** tab.
2. Select a team member.
3. Select a competitive set from the list.

The sets come from public Smogon set data. See Part 3.4.

## 2.4 How to change the theme
1. Click the theme control.
2. The application saves your choice in browser local storage. The key is `hoopa-theme`.

## 2.5 How to release a new version
This rule is written on line 2 of the HTML file. Obey it.

1. Edit the file.
2. Increase the version number in the comment on line 2.
3. Rename the file to agree with the comment. For example, change `HoopaDex_1_92.html` to
   `HoopaDex_1_93.html`.
4. Record the change in `CHANGELOG.md`.

**Caution:** The version in the comment and the version in the file name must always agree.

## 2.6 How to host the application
1. Copy the HTML file to a static web host.
2. Do not use a build step. A build step is not necessary.

The application reads public APIs from the browser. Those APIs permit cross-origin requests.

---

# PART 3 - REFERENCE
*Facts.*

## 3.1 File
| Property | Value |
|---|---|
| File | `app/HoopaDex_1_92.html` |
| Version | 1.92 |
| Size | Approximately 449 KB |
| Lines | Approximately 6,800 |
| Dependencies | None to install. Two web fonts load from Google Fonts. |
| Browser storage | `localStorage` key `hoopa-theme` |

## 3.2 Tabs
| Tab | Purpose |
|---|---|
| Pokedex | Browse and filter the species list. Open a detail view. |
| Moves | Browse moves. Includes the TM list for each game. |
| Abilities | Browse abilities. Shows the generation that introduced each one. |
| Items | Browse items by category. Shows the generation that introduced each one. |
| Locations | Find where a Pokemon appears, by game. |
| Type Chart | Show the type effectiveness chart for the selected generation. |
| Natures | Show the stat that each nature raises and lowers. |
| Team Builder | Build a team of six. Apply competitive sets. |
| EV Training | Show EV yields and training locations. |
| Other | Move priority, the physical/special split, compare, EV yields, training spots. |

## 3.3 Generation-aware data tables
The application holds these tables. They let it show historical data correctly.

| Table | Purpose |
|---|---|
| `GEN_GAMES`, `VG_GEN` | Map a game or a version group to a generation number. |
| `pastTypes` | The types that a Pokemon had in earlier generations. |
| `PAST_STATS` | The base stats that a Pokemon had in earlier generations. |
| `ITEM_INTRO_GEN` | The generation that introduced each item. |
| `EVO_OVERRIDES` | Corrections to evolution chains. |
| `REGIONAL` | Regional forms and the generation that introduced them. |
| `CM` | The type effectiveness chart for each generation. |

## 3.4 External data sources
| Source | Used for | Notes |
|---|---|---|
| `pokeapi.co/api/v2/` | Species, Pokemon, moves, abilities, items, item categories, regions | The primary source. |
| `raw.githubusercontent.com/PokeAPI/sprites` | Pokemon sprites and item sprites | Images only. |
| `data.pkmn.cc/sets/` | Competitive sets for the Team Builder | Public Smogon set data. |
| `raw.githubusercontent.com/msikma/pokesprite` | Mint item sprites | Images only. |
| Google Fonts | The Nunito and JetBrains Mono fonts | Cosmetic. |

**Important:** The application needs an internet connection. It has no offline mode.

## 3.5 Caching
The application caches responses in memory. This reduces the number of requests. The caches are
`evoCache`, `speciesCache`, `formSpeciesCache`, and a TM move index.

The cache is not persistent. The cache clears when you reload the page.

## 3.6 Champions learnset export
The published version produces `champions-learnsets.json`. CHOMP consumes this file to check move
legality. The file is approximately 1.4 MB.

**Canonical location:**
`https://raw.githubusercontent.com/willhoop/hoopadex/main/champions-learnsets.json`

### Schema
The file is a JSON object. Each key is a move key: the move name in lowercase, with spaces and
punctuation removed.

```json
{
  "acidspray": {
    "name": "Acid Spray",
    "type": "Poison",
    "category": "Special",
    "learnedBy": [
      {
        "species": "Venusaur",
        "num": 3,
        "sid": "venusaur",
        "methods": ["TM"],
        "legalIn": ["reg-ma", "reg-mb"]
      }
    ]
  }
}
```

| Field | Type | Meaning |
|---|---|---|
| *(key)* | string | The move key. Lowercase. No spaces or punctuation. |
| `name` | string | The display name of the move. |
| `type` | string | The move type, for example `Poison`. |
| `category` | string | `Physical`, `Special`, or `Status`. |
| `learnedBy` | array | One entry for each species that can learn the move. |
| `learnedBy[].species` | string | The display name, for example `Slowbro-Galar`. |
| `learnedBy[].num` | number | The National Dex number. |
| `learnedBy[].sid` | string | The species id. Lowercase. |
| `learnedBy[].methods` | array of string | How the species learns the move, for example `TM`. |
| `learnedBy[].legalIn` | array of string | The regulations that allow it, for example `reg-ma`, `reg-mb`. |

**Multiple regulations.** The export holds more than one regulation. A species can be legal in one
regulation and not legal in another. Always check `legalIn` for the regulation that you use.

**Compatibility rule.** This shape is a public contract. CHOMP depends on it. A change to the shape
is a breaking change. Increase the version when you change it.

## 3.7 Published version (GitHub Pages)
The published version is newer than the local file `app/HoopaDex_1_92.html`. It adds three things.

**Live site:** `https://willhoop.github.io/hoopadex/`
**Repository:** `https://github.com/willhoop/hoopadex`

| File | Size | Purpose |
|---|---|---|
| `index.html` | ~494 KB | The application. |
| `calc-engine.js` | ~481 KB | The `@smogon/calc` damage engine. |
| `champions-learnsets.json` | ~1.4 MB | The legality export. See Part 3.6. |

### Additions over version 1.92
1. **Champions mode.** A `Champions` option in the generation selector. In this mode the
   application limits the Pokémon and the moves to the Champions roster.
2. **Damage calculator tab.** It uses the official Smogon calculation engine (`@smogon/calc`). It
   supports abilities, items, weather, terrain, stat stages, burn, critical hits, spread damage, and
   screens.
3. **Stat Point (SP) system.** In Champions mode the calculator uses the SP system: 0 to 32 SP for
   each stat, a 66-point total budget, fixed 31 IVs, and level 50. Other generations use the
   classic EV and IV system.


#### How Champions movesets differ from the main games
Pokémon Champions has **no level-up movesets and no TM items**. A species can learn a move, or it
cannot. Any move it can learn is taught directly, at a cost of 100 VP. There is no order, no level
gate, and no item to find.

The export keeps a `methods` field, but in this format the field carries no information: all 14,192
species-and-move pairs hold the single value `["TM"]`. Read the export as a flat legality list for
each regulation. Do not read `methods` as a learn path.

This also means a moveset from Scarlet and Violet is not a guide to Champions legality. The lists
differ. For example, Garchomp can learn Surf in Champions.

### URL format
The application reads the URL hash to open a specific view. Example:
`https://willhoop.github.io/hoopadex/#pokedex/gchampions/gm:reg-mb`

| Part | Meaning |
|---|---|
| `#pokedex` | The tab to open. |
| `gchampions` | Champions mode. For a classic generation, use `g1` to `g9`. |
| `gm:reg-mb` | The regulation in Champions mode, or the game in a classic generation. |

**You do not need a hash to open Champions mode.** The application starts in Champions mode on the
newest regulation. Use the plain address `https://willhoop.github.io/hoopadex/`.

#### Legacy links
Versions before 1.93 wrote `g9` into the hash while the application was in Champions mode. The
reader then used `g9` to leave Champions mode. This made a saved or shared link open the wrong
mode. Version 1.93 corrects this in two ways:

1. `saveHash()` writes `gchampions` when Champions mode is active.
2. The reader ignores a generation number if the same hash also holds a `gm:reg-*` token. Therefore
   old links such as `#pokedex/g9/gm:reg-mb` now open Champions mode correctly.

`tests/test-hash-routing.js` holds these rules. The test file reads the parser out of
`app/index.html`, so the test cannot become different from the shipped code.

### How to add a new Champions regulation
Do these steps when a new regulation starts.

1. Open `app/index.html`.
2. Find `CHAMPIONS_IDS_MA` and `REG_MB_NEW`. Add a constant for the new species list, for example
   `const REG_MC_NEW=[...]` and `const CHAMPIONS_IDS_MC=new Set([...CHAMPIONS_IDS_MB,...REG_MC_NEW]);`
3. Find the block `CHAMPIONS REGULATIONS - newest FIRST`. Add one row to the **top** of the array:

   ```js
   {key:'reg-mc', short:'m-c', label:'Regulation M-C', ids:()=>CHAMPIONS_IDS_MC},
   ```

4. Increment the version number in the comment on line 2.
5. Run `node tests/test-hash-routing.js`. All tests must pass.

Step 3 is the only change that controls behaviour. The default regulation, the dropdown contents,
the URL hash, and the legality note in the move list all read from this array. Do not change them
one at a time.

---

# PART 4 - EXPLANATION
*Why the design is like this.*

## 4.1 Why the application is one file
One HTML file has no build step, no dependency tree, and no version conflicts. You can email it,
open it from a disk, or host it anywhere. For a reference tool that one person maintains, this
removes almost all maintenance cost.

The cost is that the file is large. A small change means that you edit a large file. The version
rule in Part 2.5 controls that cost.

## 4.2 Why the application is generation-aware
A Pokedex that shows only current data gives incorrect answers about older games. Steel resisted
Ghost and Dark until generation 6. Fairy did not exist until generation 6. Some Pokemon changed
type or base stats. A player who uses current data to plan an older game will make mistakes.

Therefore the application stores the historical values. It selects the correct values for the
generation that you choose.

## 4.3 Why the application reads live APIs
The full Pokedex is large. Embedded data would make the file very large, and the data would become
old. PokeAPI supplies the bulk data and stays current. The application embeds only the data that
PokeAPI does not supply well: historical types, historical stats, item introduction generations,
and evolution corrections.

The cost is the internet requirement. This cost is accepted.

## 4.4 Why the Champions export is a separate file
The Champions export is a separate JSON file, not embedded in the HTML. Two reasons:

1. **Size.** The export is approximately 1.4 MB. Embedding it would make the application slow to
   load for every user, including users who never open Champions mode.
2. **Reuse.** CHOMP reads the same file. A separate file gives one source of truth for legality.
   If the data were embedded in the HTML, CHOMP would need its own copy, and the two copies would
   become different over time.

**Note on version 1.92.** The local file `app/HoopaDex_1_92.html` does not contain Champions mode
and does not produce this export. Champions mode, the damage calculator, and the export are in the
published version. See Part 3.7.

---

## References
1. PokeAPI. https://pokeapi.co/
2. PokeAPI sprite repository. https://github.com/PokeAPI/sprites
3. Smogon set data. https://data.pkmn.cc/
4. pokesprite. https://github.com/msikma/pokesprite
5. ASD-STE100 Simplified Technical English. https://www.asd-ste100.org/
6. Procida, D. Diataxis. https://diataxis.fr/
