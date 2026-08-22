# HoopaDex — Technical Documentation

**Version 2.2 · Last updated 2026-08-21 · HoopaDex v5.38**
Documents the published application, `app/index.html`.
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
1. Double-click `app/index.html`.
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
3. The published copy stays named `index.html`, because GitHub Pages serves it as the site entry
   point. The comment on line 2 is its authoritative version marker.
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
| File | `app/index.html` (published copy; see 3.7) |
| Version | 5.8 |
| Size | Approximately 578 KB |
| Lines | Approximately 8,760 |
| Dependencies | None to install. Two web fonts load from Google Fonts. |
| Browser storage | `localStorage` key `hoopa-theme` |

## 3.2 Tabs
| Tab | Purpose |
|---|---|
| Pokedex | Browse and filter the species list. Open a detail view. |
| Moves | Browse moves. Includes the TM list for each game. A Pokemon's learnset can be sorted by any column and filtered by type. |
| Abilities | Browse abilities. Shows the generation that introduced each one, and which Pokemon have it in the selected generation, alternate forms included. |
| Items | Browse items by category. Shows the generation that introduced each one. |
| Locations | Find where a Pokemon appears, by game. |
| Type Chart | Show the type effectiveness chart for the selected generation. Includes the Defending Type Calculator (3.8). |
| Natures | Show the stat that each nature raises and lowers. |
| Team Builder | Build a team of six, alternate forms included. Apply competitive sets. |
| EV Training | Show EV yields and training locations. |
| Other | Move priority, the physical/special split, regulation changes, speed tiers, bulk allocation. |

## 3.3 Generation-aware data tables
The application holds these tables. They let it show historical data correctly.

| Table | Purpose |
|---|---|
| `GEN_GAMES`, `VG_GEN` | Map a game or a version group to a generation number. |
| `pastTypes` | The types that a **move** had in earlier generations, from PokeAPI `past_values`. |
| `POKEMON_PAST_TYPES` | The types that a **Pokemon** had in earlier generations. Generated, not hand-typed — see 3.4. |
| `PAST_STATS` | The base stats that a Pokemon had in earlier generations. Generated, not hand-typed — see 3.4. |
| `ITEM_INTRO_GEN` | The generation that introduced each item. |
| `EVO_OVERRIDES` | Corrections to evolution chains. |
| `REGIONAL` | Regional forms and the generation that introduced them. |
| `CM` | The type effectiveness chart for each generation. |

## 3.3a Stat formula

The Champions stat model is documented in `docs/STAT-FORMULA.md`, which is generated by
`build/generate-stat-formula.js` from the application's own `bulkStat()` and `SPEED_COLS`.

| | Formula |
|---|---|
| HP | `base + 75 + SP` |
| Every other stat | `floor((base + 20 + SP) * nature)` |

HP takes a different constant and never takes a nature. Level 50 and 31 IVs are fixed in Champions,
which is why there is no level or IV term.

Regenerate rather than editing the article. `tests/test-stat-formula-doc.js` fails if the model
changes and the article is not regenerated.

## 3.4 External data sources
| Source | Used for | Notes |
|---|---|---|
| `pokeapi.co/api/v2/` | Species, Pokemon, moves, abilities, items, item categories, regions | The primary source. |
| `raw.githubusercontent.com/PokeAPI/sprites` | Pokemon sprites and item sprites | Images only. |
| `data.pkmn.cc/sets/` | Competitive sets for the Team Builder | Public Smogon set data. |
| Showdown export format | Team import (paste) | A text format, not a service. Parsed in-app; nothing is sent anywhere. |
| `raw.githubusercontent.com/msikma/pokesprite` | Mint item sprites | Images only. |
| Google Fonts | The Nunito and JetBrains Mono fonts | Cosmetic. |

**Important:** The application needs an internet connection. It has no offline mode.

### How the generated tables are produced
`PAST_STATS` and `POKEMON_PAST_TYPES` are the embedded tables that are generated rather than written
by hand. `PAST_STATS` is built
by diffing Pokemon Showdown's per-generation mod data — `data/mods/gen{5,6,7,8}/pokedex.ts` in the
`smogon/pokemon-showdown` repository — against Showdown's current Pokedex. Each mod file records how
a generation differs from the one above it, so a `genN` override becomes a `genN+1` cutoff in the
table's "in generations below this, use these values" form.

This is a build-time source, not a runtime one: the generated table is embedded, and the application
never calls Showdown. Regenerate rather than editing entries by hand. The hand-maintained version
that this replaced in 1.96 had only 10 of its 43 entries correct — the rest were filed under the
wrong generation, asserted values that were never real, or were missing.

Two constraints follow from the source data:
- Base stats were stable from Generation II through Generation V, so cutoff 6 is the earliest that
  can exist. Showdown carries no stat overrides for generations 2, 3 or 4.
- Generation I is not modelled, because its single Special stat is a display question rather than a
  value substitution. See `docs/BACKLOG.md` item 14.

`POKEMON_PAST_TYPES` is produced the same way, from the `types` overrides in the same mod files.
It must restore rather than subtract: deleting a type that did not exist yet is only correct where
that type was ADDED to a species. Where Fairy REPLACED a type it loses one — Togetic and Togekiss
were Normal/Flying and rendered as pure Flying in Gens II-V until 1.98.

### Move classes, and the abilities and items that act on them
`IX` is the third generated table, built by `build/generate-interactions.js` and put into
`app/index.html` by `build/embed-interactions.js`. It answers two questions the app previously could
not: *what does this ability do to a class of moves*, and *which moves are in the class*.

The class has a name in the game's own data. Showdown records a set of flags per move — `pulse`,
`punch`, `bite`, `sound`, `bullet`, `slicing`, `wind`, `powder`, `contact`, `protect`,
`reflectable` — and an ability's code tests them directly:

```
megalauncher: {
  onBasePower(basePower, attacker, defender, move) {
    if (move.flags['pulse']) return this.chainModify(1.5);
  },
}
```

So "boosts pulse moves ×1.5" and the seven moves carrying the flag are both read out rather than
typed. The generator emits 36 abilities and 6 items with a rule, and 441 moves with at least one
shown flag.

Four constraints on what it is willing to claim:

- **A multiplier is stated only when its attribution is unambiguous** — one flag tested, one
  `chainModify` in that hook, brace-matched so a modifier in `onSourceModifyDamage` is never
  credited to a flag test in `onBasePower`. Fluffy tests contact and has two branches, so it is
  reported as an interaction with no number rather than being given one of the two.
- **`chainModify` takes either a number or an `[n, 4096]` pair**, which is how the games store a
  modifier. `4915/4096` is 1.2; `5325/4096` is 1.30005, rounded to 1.3, because printing
  "×1.30005" would be accurate and useless.
- **Contact is not tested through the flag.** Three things remove it conditionally — Long Reach,
  Punching Glove, Protective Pads — so Showdown asks `checkMoveMakesContact` instead. Reading that
  call as a contact test is the only reason Rocky Helmet, Rough Skin, Static and fifteen others
  appear at all.
- **An unknown flag fails the build.** `FLAG_LABEL` and `FLAG_INTERNAL` partition the vocabulary
  rather than filtering it, so a flag Showdown adds later cannot be silently dropped.

Comments are blanked before brace matching, and that is correctness rather than tidiness: Oblivious
contains `// Taunt's volatile already sends the -end message`, and a matcher that treats the
apostrophe as a string opener runs past the end of the entry. The first run of the generator did
exactly that and reported Oblivious as blocking powder moves — Overcoat's rule, attributed to its
alphabetical neighbour.

**When behaviour changed** comes from the same mod files as `PAST_STATS`, on the same cutoff
convention. `mods/gen7/abilities.ts` contains `oblivious: { inherit: true, onTryBoost: undefined }`,
which says these abilities did not resist Intimidate in Generation VII or below — so the mechanic
landed in Generation VIII. A mod entry counts only if it changes behaviour; most of the 271 entries
in the gen8 mod are `isNonstandard` or `rating` edits, and counting those would put a "changed in
Gen IX" note on half the ability list.

**Where the two sources disagree, both are kept.** Showdown puts the Intimidate clause at Generation
VIII; the games did not reword the in-game description until Scarlet/Violet. Showdown decides
whether the mechanic is present, because that is a question about the mechanic; PokeAPI's per
version-group text supplies the wording the game itself prints. Neither is stretched to cover the
other.

### Generation-correct descriptions
PokeAPI's `effect_entries.short_effect` has **no generation dimension**, and for a large class of
abilities it is years behind the games. Scrappy's has read "Lets the Pokemon's Normal and Fighting
moves hit Ghost Pokemon" since Generation IV. Tough Claws' still says 1.33×, the Generation VI
value, wrong since Generation VII.

`flavor_text_entries` does carry a line per version group, and `VG_GEN` already maps version group
to generation. `genFlavorText(entries, genNum)` takes the newest entry at or below the selected
generation, falling back to the oldest available when the generation predates them all. Abilities
and moves call the field `flavor_text`; items call it `text`; one helper reads both. Before 5.29
the ability and move paths called `.pop()` — newest regardless of generation — and `loadItemDetail`
took the first English entry, which is the oldest, so a rewritten item description showed its debut
wording for ever.

Where PokeAPI's prose states a multiplier the derived rule disagrees with, the prose is dropped —
`ixContradicts()`. This is a numeric conflict check only. Prose that adds anything else still shows,
because the alternative to suppressing a contradiction is printing both and asking the reader to
arbitrate.

### A move's numbers, and a species' abilities, in an older generation
PokeAPI ships `past_values` on every move — `power`, `accuracy`, `pp` and `type`. The app read only
`type` and discarded the rest, so 140 moves showed the modern number in every generation. Wing Attack
was 35 base power in Generation I and the app said 60; Jump Kick was 70 and the app said 100.

That reached the **damage calculator**, which took `md.power` directly. `TAB_RELEVANCE` has no rule
for `calc`, so the tab is available in every generation. `getMovePowerForGen`, `getMoveAccForGen` and
`getMovePPForGen` now resolve against the selection, and the calculator uses the resolved value.

`makeMoveRecord()` builds every cache entry. Before it, `moveCache` was written from six places and
four of them set `pastTypes:{}`, so whether the app knew a move's history depended on which path
fetched it first — the Pokedex route was generation-aware and the Team Builder route was not, and
both rendered.

`PASTABIL`, generated by `build/generate-past-abilities.js`, covers abilities that differed. Gengar
had **Levitate** from Generation III to VI, a Ground immunity, and the app showed Cursed Body
throughout. That is a worse class than a stale label: an ability feeds the type-matchup answer, so
the wrong answer appears on a different screen from the stale field.

141 species, in three kinds — 112 a slot that did not exist yet, 21 a hidden ability that differed,
8 a normal ability that differed. Rows saying a hidden slot predates Generation V are not shipped;
the app gates that already and duplicating it would be two rules to keep in step.

All three tables use the same cutoff convention as `PAST_STATS`: an entry recorded against
generation N describes N and every generation below it, until a lower entry takes over.

### Who had an ability in that generation, in both directions
`applyPastAbilities` answers "what did this species have then". `abilityHoldersForGen` answers the
reverse — "who had this ability then" — and both are needed for the same question to be answered
consistently from either side. Until v5.34 only the first existed, so Gengar showed Levitate on its
own page in Generation IV while the Levitate page did not list it and the Cursed Body page still did.

The reverse makes two corrections:

- **Remove** a species whose slot held something else then. Cursed Body exists from Generation V, but
  Gengar did not have it until VII.
- **Add** a species whose slot held this ability then. Nothing in PokeAPI's Levitate list mentions
  Gengar at any point, so there is no entry to correct — one is produced, shaped exactly like a real
  entry (including a url the id parser can read) so `formAllowed`, the hidden-ability gate and the
  sprite lookup all read it without knowing it was synthesised.

Removing only the stale entries would leave the question answerable and incomplete, which is the
worse failure: a short list still looks like an answer.

### Changing generation or game reloads the application
`resetToHomeAndReload()` writes the new selection into the address, clears the game-specific location
version, and calls `location.reload()`. Both `onGenNumChange` and `onGameChange` use it, including
the Champions regulation path.

This replaced `triggerDataRefresh()` on those paths in v5.34, reported as "sometimes it still shows
old data". The application holds a dozen caches scoped to the selected generation and
`triggerDataRefresh` cleared the ones that had been remembered. Every cache added afterwards had to
be remembered again, and the failure when one was missed is not an error — it is the previous
generation's answer, rendered with full confidence.

A reload is the only clear-down that cannot be incomplete. The cost is a few seconds of refetching;
what it removes is an entire category of defect rather than one more entry on a list kept in step by
hand. The address is written BEFORE the reload so the reader returns to the selection they asked for,
and the tab resets to the Pokedex because the previous tab's state is exactly what is being discarded.

### Tabs for mechanics an era did not have
`TAB_RELEVANCE` supported a `minGen` rule and did not use it, so Generations I and II were offered a
Natures tab and an Abilities tab. Both mechanics arrived in Generation III, and the tabs rendered a
full modern list — a confident answer to a question those games cannot be asked. Both are now gated.
Champions is Generation IX under the hood and keeps them, because the mode flag and the generation
number are separate questions.

### What a move DID: per-generation move text
`MOVETEXT` is generated by `build/generate-move-text.js` from Showdown's `data/text/moves.ts` and
embedded by `build/embed-move-text.js`. PokeAPI gives one description per move with no generation
dimension, written for the current games, so for an older generation it is somewhere between
incomplete and false.

| Generation | Jump Kick, if it misses |
|---|---|
| I | 1 HP. Flat. |
| II | 1/8 of the damage it would have dealt |
| III to IV | 1/2 of the damage it would have dealt |
| V onward | 50% of the user's own MAXIMUM HP |

138 moves are affected: 73 in Gen I, 62 in II, 58 in III, 56 in IV, 27 in V, 15 in VI, 12 in VII,
7 in VIII, and 0 in Gen IX, which is the generation PokeAPI's text is written for. Generation IX
therefore renders nothing extra, and the panel appears only where there is a correction to make.

**The cutoff convention** is Showdown's own and matches `PAST_STATS`: a `genN` block describes
generation N **and every generation below it**, until a lower override takes over. Resolving a
generation means taking the override with the smallest N at or above it. Bind's summary changes at
gen1 and gen4 only, so Generations II and III read the gen4 text. Resolving downward instead would
hand Generation III the Generation I wording, and nothing about that looks wrong on screen.

Three rules keep it honest, each of which was got wrong first:

- **`shortDesc` only.** A generation block holding just `desc` is saying the long explanation
  differs and the one-line summary does not. The first version fell back to `desc` and was wrong
  twice over: it claimed a difference for moves whose summary had not changed, and it produced a
  437 KB blob with a 232-character median where a short line belongs. 312 of 882 moves carry *some*
  override; only 138 change the summary.
- **Cutoffs, not generations.** Storing an entry per generation duplicated identical text — Jump
  Kick's Gen III and IV wording is the same sentence — and doubled the payload for nothing.
- **Nothing below the move's own debut.** Aurora Veil is a Generation VII move carrying a gen8
  override, so an ungated cutoff search answered "what did Aurora Veil do in Generation III" with a
  real sentence about a move that did not exist.

**Champions is inherited, not verified.** Showdown documents the mainline games and nothing
published describes Champions' move mechanics separately. Champions selects Generation IX here and
so inherits Scarlet/Violet wording. The panel names the rules it is quoting rather than implying the
check has been done; see `docs/BACKLOG.md`.

### The selected game, not only the selected generation
`genFlavorText` prefers the exact version group when a specific game is chosen, falling back to the
generation when that game has no wording of its own. Ruby and FireRed are both Generation III and do
not print the same sentence for Surf; answering at generation granularity ignored half of what the
reader had told the app, since the game selector sits next to the generation one.

`triggerDataRefresh()` re-asks the Moves search rather than emptying it. The move names survive the
refresh and are re-resolved against the new generation — the results genuinely have to be recomputed,
because legality and the Pokemon list are generation-dependent, so re-rendering the stale rows would
be worse than clearing them.

### Where the battle is happening: Nature Power, Secret Power, Camouflage
`ENVMOVES` is generated by `build/generate-environment-moves.js` and embedded by
`build/embed-environment-moves.js`. It answers what these three moves turn into, indexed by
generation, because the mapping changed in every one of them:

| Generation | A cave gives |
|---|---|
| III | Shadow Ball |
| V | Rock Slide |
| VI to VIII | Power Gem |

Generation IX carries a sentence rather than a table — the move cannot be selected — because
rendering nothing there would read as missing data instead of as the answer.

**This is the only table in the application NOT derived from Showdown, and the reason is important.**
Showdown is a battle simulator with no overworld. It has no cave or tall grass to be standing in, so
its per-generation mods collapse the whole table to one hardcoded call:

```
gen3 mod: this.actions.useMove('swift', target)       // one row of a nine-row table
gen4 mod: this.actions.useMove('triattack', pokemon)
gen5 mod: this.actions.useMove('earthquake', pokemon)
```

Each is a correct answer to "what does Nature Power do in a Showdown battle" and a wrong answer to
"what does Nature Power do in Ruby". Deriving from Showdown here would have produced a confident,
precise, single-row falsehood — the failure mode this project exists to prevent, reached through the
source it otherwise trusts most. **A source being good is not the same as a source being applicable.**

The source is Bulbapedia's wikitext through the MediaWiki API — the artefact the site renders from,
not scraped HTML. From Generation VI the terrain MOVES do override the environment, and that part
Showdown models properly, so the four terrain rows are cross-checked against its `onTryHit` and the
build fails on disagreement.

Three parsing rules carry the weight, and each exists because its absence produced a wrong table
that did not throw:

- **Templates resolve innermost-first, repeatedly.** Bulbapedia nests them —
  `{{color|{{locationcolor/text|volcano}}|Volcano}}` is a colour helper used as the colour argument
  of another. A single non-nesting regex matched the inner one as though it were the outer one and
  produced `volcano|Volcano}}` as the name of a place, in eleven rows across all three moves.
- **Generation headings come in three forms.** "Generation III", "Generations IV and V", and
  "Generation VIII onwards"; Secret Power also nests its headings one level deeper than the other
  two. A parser that knew only the first form returned an entirely empty table for two of the three
  moves, which renders as no panel at all — indistinguishable from "this move has no table".
- **Only the Effect section, first table wins.** The scan stops at the first level-2 heading after
  `==Effect==`, which excludes Mystery Dungeon, Rumble and the per-terrain galleries; first-wins
  keeps Secret Power's in-battle table over the outside-of-battle one repeating the same headings
  lower down, which is about cutting a tree rather than fighting.

### The search must agree with itself about the generation
The universal search runs two passes: exact substring, then fuzzy. Both must apply the same
generation rule, and until 5.31 only the exact one did, because an ability's introduction generation
was resolved inline inside that branch and existed nowhere else. `getAbilityIntroGen()` is now the
single definition and both branches call it.

It returns **0**, not 9, when no source knows the answer. The caller compares against the selected
generation, so a confident 9 would hide every ability whose data has not loaded yet — turning a slow
network into an empty search box. Unknown means "do not exclude it".

The fuzzy pass also deduplicates against `items`, `otherGenItems` and `champNotItems` together.
`items` alone is not the set of things already handled: the exact pass moves later-generation hits
into `otherGenItems`, so checking only `items` let Bullet Punch be listed under MOVES *and* under
NOT IN GEN III at the same time.

### The Champions roster is the one table still hand-maintained
`CHAMPIONS_IDS_MA` and `REG_MB_NEW` are ~200 National Dex numbers written by hand. Everything else
generation-aware in this app is derived — base stats and typing from Showdown's mod data, move
descriptors from the bundled calc engine, the regulation diff by set difference. This one is not,
because no machine-readable Champions roster is published.

A wrong number here is invisible: the dex renders, the filter filters, the article generates, and
all of them are quietly wrong about legality. Two things guard it:

- `tests/test-champions-roster.js` runs on every test pass and checks what needs no network —
  valid dex numbers, no duplicates **in the source literal** (a repeat inside `new Set([...])` is
  silently collapsed, leaving the roster one short while every count still agrees), each regulation
  a superset of its predecessor, and `M-B size == M-A + REG_MB_NEW`.
- **An anchor outside the app.** Every check in the list above is *relational* — it compares the
  rosters to one another. Because M-B is built as M-A plus additions, deleting an id shrinks both
  sides together and every one of those assertions still holds; the architecture review of
  2026-08-03 deleted Venusaur and all 23 suites of the day stayed green. Each regulation's size is
  now also compared against `data/regulations.json`. That file is generated *from* this registry, so
  it cannot prove the roster is correct — only that it cannot change without the committed artefact
  changing in the same pass. Regenerate with `node build/generate-regulations.js`.
- `build/audit-champions-roster.js` answers the evolution-stage question against PokéAPI, cached in
  `data/evolution-cache.json`. As of 2026-08-03: no baby Pokémon, and exactly three entries that are
  not a final stage — Pikachu, Qwilfish (evolves only as its Hisuian form) and Floette (present as
  its Mega, the Eternal Flower, which cannot evolve). Those three are pinned in the test, so a
  fourth arriving is a failure someone has to justify rather than a silent addition.

### Regulation changes are generated, not written
`docs/REGULATIONS.md` and `data/regulations.json` are produced by `build/generate-regulations.js`,
which reads the `CHAMPIONS_REGS` registry out of `app/index.html` and takes the set difference
between each pair of regulations. The in-app Regulation Changes page derives the same diff at
runtime from the same registry, so the article, the page and the Pokedex filter cannot disagree.

Adding a regulation is one edit — a new ID set and one row unshifted onto `CHAMPIONS_REGS` — after
which rerunning the generator updates everything downstream. Species names are fetched from PokeAPI
once and cached in `data/species-names.json`, so reruns work offline and are byte-identical.

A scheduled task, `hoopadex-regulation-watch`, runs this weekly and checks whether a regulation
exists that the app does not know about. It deliberately **does not** invent a roster: a regulation
is roughly 200 dex numbers, and a wrong roster would silently corrupt the dex filter, the
recently-added sort, the article and Team Builder legality at once while still rendering fine. It
reports and asks instead.

`tests/test-past-stats.js` and `tests/test-past-types.js` pin the results and assert the structural
invariants.

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
The published version is `app/index.html`. It adds three things over version 1.92.

**Live site:** `https://willhoop.github.io/hoopadex/`
**Repository:** `https://github.com/willhoop/hoopadex`

| File | Size | Purpose |
|---|---|---|
| `index.html` | ~633 KB | The application. |
| `calc-engine.js` | ~481 KB | The `@smogon/calc` damage engine. Vendored; no version is recorded — see the architecture review. |
| `champions-learnsets.json` | ~1.4 MB | The legality export. See Part 3.6. |

`calc-engine.js` and `champions-learnsets.json` are checksummed in `data/vendor-pins.json` and
verified by `tests/test-vendor-pins.js` on every run. Neither carries a version number, so the
checksum is what stops either being swapped or truncated unnoticed. A checksum pins the artefact,
not its provenance: the engine's upstream version is still unknown.

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

## 3.8 Publishing, and how the tests are verified

### How it is published
`bash build/publish.sh`. It checks that `app/index.html` parses, runs every suite, refuses to push
if either fails, guards against a file GitHub will reject, pushes, then verifies that the commit
reached `origin/main` **and** that GitHub Pages actually served the new version number.

Until 2026-08-03 this repository was published by `Projectsuto-publish.bat`, a hidden background
loop that ran `git add -A && git commit && git push` across six repositories every ten minutes with
no test run of any kind. It published a copy of this app left as a syntax error — a blank page —
with every suite of the day still green, and it committed and pushed an architecture review's own
half-finished work while that review was being written. It existed because Claude Cowork would not
push to GitHub itself; that is no longer a constraint, and the script is retired.

`Projects\publish-gate.js` survives from an intermediate version of that fix and is useful on its
own: `node publish-gate.js <repo-dir>` reports whether any repository is safe to publish.

### How the tests are verified
`node build/mutation-check.js`, and it runs in continuous integration.

It applies eleven deliberate defects to the shipped code — a wrong critical-hit multiplier, a wrong
STAB, a missing spread-move reduction, a corrupted historical stat, a deleted roster entry, and so
on — and asserts that the suite which claims to cover each one goes red. The run fails if any defect
survives, and also if an anchor no longer matches, because a mutation that no longer applies is not
a pass.

This exists because the claim it replaces turned out to be false. Part 5 of the white paper stated
that every suite had been mutation-checked. When that was tested on 2026-08-03 against 23 suites and
778 assertions, **five of ten deliberate defects survived undetected**, three of them in the damage
calculator, which had no test that computed a damage number. A mutation check performed once by hand
decays into a claim about the past; running it automatically is the only version of it that stays
true.

### The build scripts
| Script | Produces |
|---|---|
| `build/generate-past-stats.js` | `data/past-stats.json` — historical base stats from Showdown's per-generation mods |
| `build/generate-gen1-special.js` | `data/gen1-special.json` — the single Generation I Special stat |
| `build/generate-item-gens.js` | `data/item-intro-gens.json` — item introduction generations from PokéAPI |
| `build/generate-mega-abilities.js` | `data/mega-abilities.json` — Legends Z-A mega abilities |
| `build/generate-interactions.js` | `data/interactions.json` and `data/interactions.embed.json` — move flags, and the abilities and items that act on them |
| `build/embed-interactions.js` | Rewrites the `IX` table inside `app/index.html` from the generated copy |
| `build/generate-environment-moves.js` | `data/environment-moves.json` and `.embed.json` — what Nature Power, Secret Power and Camouflage become, per generation, from Bulbapedia |
| `build/embed-environment-moves.js` | Rewrites the `ENVMOVES` table inside `app/index.html` from the generated copy |
| `build/generate-move-text.js` | `data/move-text.json` and `.embed.json` — per-generation move descriptions from Showdown's text data |
| `build/embed-move-text.js` | Rewrites the `MOVETEXT` table inside `app/index.html` from the generated copy |
| `build/generate-past-abilities.js` | `data/past-abilities.json` and `.embed.json` — abilities a species had in an earlier generation |
| `build/embed-past-abilities.js` | Rewrites the `PASTABIL` table inside `app/index.html` from the generated copy |
| `build/generate-regulations.js` | `data/regulations.json` and `docs/REGULATIONS.md` |
| `build/generate-regulation-items.js` | `data/regulation-items.json` — per-regulation item legality |
| `build/generate-stat-formula.js` | `docs/STAT-FORMULA.md`, every figure computed by the shipped code |
| `build/audit-champions-roster.js` | Evolution-stage audit of the Champions roster |
| `build/mutation-check.js` | Pass or fail — the tests' own test |
| `build/publish.sh` | A verified deployment |
| `build/omnibus.py` | A PDF from a Markdown report |

Every generated table is compared to its committed derivation by a suite on every run, so the app
and the data cannot drift apart silently. Eight of the twelve files in `data/` are checked this way;
the exceptions are the two caches (`evolution-cache.json`, `species-names.json`), the raw Showdown
extract that `generate-mega-abilities.js` reads, and `interactions.json`, whose trimmed sibling
`interactions.embed.json` is the copy the app carries and the copy the suite compares byte for byte.

---

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

**Note on version 1.92.** That superseded version did not contain Champions mode
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
