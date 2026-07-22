# Historical Correctness in a Pokémon Reference Tool

### Why a dex that ignores time gives wrong answers, and how HoopaDex fixes it

**Version 1.0 · Last updated 2026-07-22**
**Will Hooper · HoopaDex v1.93**

> This is a living document. It is updated in the same pass as any change to the code.
> New information is appended. A prior conclusion is not silently rewritten; what changed
> and why is recorded in [`CHANGELOG.md`](../CHANGELOG.md).

---

## Abstract

Almost every Pokémon reference tool answers questions as though the current generation were
the only one. That is wrong for anyone playing an older game, and it is wrong in ways that
change decisions rather than merely annoying the reader. This paper states the problem
precisely, describes the data model HoopaDex uses to resolve a query against a chosen point
in the series' history, documents the Champions stat system and its move-legality export,
and records the limits of the approach. Every claim about a rule change is cited.

---

## 1. The problem

A type chart is not a constant. It is a function of the generation.

| Interaction | Generations 2 to 5 | Generation 6 onward |
|---|---|---|
| Ghost attacking Steel | 0.5× | 1× |
| Dark attacking Steel | 0.5× | 1× |
| Steel defending against Ghost and Dark | resists both | neutral to both |

The Fairy type did not exist before generation 6. Before generation 4, whether a move used
the physical or the special attack stat was decided by the move's **type**, not by the move
itself: every Fire move was special and every Rock move was physical, regardless of whether
that made sense.

The consequence is concrete. A player working through Pokémon Crystal who consults a modern
dex is told that a Dark move hits a Steel type neutrally. In the game in front of them it is
resisted. The reader does not get a slightly stale answer. They get a wrong one, and they
have no signal that anything is wrong, because the tool renders the incorrect number with
exactly the same confidence as a correct one.

**This is the failure mode the project exists to remove:** a reference that is silently wrong
is worse than one that declines to answer, because it removes the reader's opportunity to
doubt it.

*Sources: Bulbapedia, "Type chart" and "Damage category", revision histories for generation
transitions II→III, III→IV, and V→VI. Game Freak, Pokémon X and Y (2013), which introduced
the Fairy type and removed the Steel resistances to Ghost and Dark.*

---

## 2. The data model

### 2.1 Generation as a query parameter

The central design decision is that **the generation is an input to every lookup, not a
display setting.** The application holds one selected generation, `selectedGenNum`, and every
resolver reads it.

A query is therefore a pair, not a single value:

```
answer = resolve(subject, generation)
```

rather than the more common, and incorrect:

```
answer = resolve(subject)
```

Type effectiveness resolves through a generation-indexed chart. Base stats resolve through a
table of historical revisions, because several species were rebalanced between generations —
for example, many stats were raised in generation 6. Abilities resolve against the generation
that introduced them, so a species does not display an ability it could not have had.

### 2.2 Why the era is shown, not assumed

The selected generation is displayed at all times. This is a deliberate cost: it takes screen
space that a modern-only dex would not spend. The justification is section 1. A tool whose
answers depend on a hidden parameter must show that parameter, or the reader cannot tell a
correct answer from a stale one.

### 2.3 Data sources

Species, move and ability data come from PokéAPI at run time. The generation-dependent tables
— type charts, the physical/special split, the Champions rosters — are held in the file
itself, because they are small, they are historical, and they must not depend on a network
call succeeding.

*Source: PokéAPI v2, <https://pokeapi.co/>.*

---

## 3. Champions mode

Pokémon Champions uses a stat system unlike the main series, and HoopaDex models it directly
rather than approximating it with EVs.

### 3.1 The SP system

| Property | Main series | Champions |
|---|---|---|
| Investment unit | EVs, 0 to 252 per stat | SP, 0 to 32 per stat |
| Total budget | 510 EVs | 66 SP |
| IVs | 0 to 31, variable | fixed at 31 |
| Level | variable | fixed at 50 |

The stat formulas the calculator uses, for level 50:

```
stat(base, sp, nature) = floor( ( floor((2·base + 31)·50/100) + 5 + sp ) · nature )
hp(base, sp)           = floor( (2·base + 31)·50/100 ) + 60 + sp
```

The nature multiplier is applied **after** the SP addition, not before. This ordering is not
cosmetic: applying the nature first and then adding SP produces a different integer after the
floor operation, and the error compounds through the damage calculation. The ordering above
is pinned by the golden tests in the CHOMP project, which shares these formulas.

### 3.2 Movesets are a flat list

Champions has **no level-up movesets and no TM items**. A species can learn a move or it
cannot. Any learnable move is taught directly for 100 VP. There is no level gate, no order,
and no item to find.

This is a genuine structural difference from every previous generation, and it simplifies the
model considerably: a moveset is a set-membership question, not a path through a learn table.

The export `champions-learnsets.json` records the result. It retains a `methods` field for
compatibility, but that field carries no information in this format: all 14,192
species-and-move pairs hold the single value `["TM"]`. The field has zero variance.

**A moveset from Scarlet and Violet is not a guide to Champions legality.** The lists differ.
Garchomp learns Surf in Champions; it does not learn Waterfall.

### 3.3 The export as a shared asset

The learnset export is a separate file rather than inline data, for two reasons. It is
approximately 1.4 MB, which would roughly triple the size of the application file. And it is
consumed by a second project: CHOMP uses it to check that a synthesized opponent moveset is
legal.

That second use exposed a subtlety worth recording. The export covers 208 of 208 legal
species, but only 496 of the 500 moves in the legal pool. Five moves — `spore`, `softboiled`,
`milkdrink`, `powershift`, `struggle` — are absent from it.

A consumer must therefore treat the export as an oracle that answers **"is this pair recorded
as legal"**, not **"is this pair illegal"**. Anything absent must be treated as unknown and
allowed. Treating absence as prohibition would silently delete five legal moves from
consideration. This rule is stated here because it is not obvious from the file, and a future
consumer will otherwise get it wrong.

---

## 4. Architecture

### 4.1 One file

The application is a single HTML file with no build step, no dependency tree, and no server.
It can be emailed, opened from a disk, or hosted anywhere static.

The trade is real and worth stating. A single file has no module boundaries, so discipline
about structure has to be maintained by convention rather than enforced by tooling, and the
file is large enough that editing it requires searching rather than navigating. For a
reference tool maintained by one person, the removal of build and deployment cost outweighs
this. For a tool maintained by a team, it would not.

### 4.2 The damage calculator

Champions mode includes a damage calculator built on `@smogon/calc`, the same engine that
underlies the widely used Smogon calculator. Using the established engine rather than a
reimplementation means the damage arithmetic is community-verified; the project's own work is
the Champions stat system layered on top of it.

### 4.3 State in the URL

The visible view is encoded in the URL hash, so any view can be linked or bookmarked:

```
#pokedex/gchampions/gm:reg-mb
```

`gchampions` selects Champions mode; `g1` to `g9` select a classic generation; `gm:` carries
the regulation or the specific game.

**A defect in this mechanism, and its correction.** Before v1.93 the hash writer emitted the
generation number `g9` even while Champions mode was active, and the hash reader interpreted
`g9` as an instruction to leave Champions mode. Every link the application produced therefore
opened a different view than the one it was generated from. The published link
`#pokedex/g9/gm:reg-mb` had this defect.

Version 1.93 corrects it in two parts: the writer emits `gchampions`, and the reader ignores a
generation number when the same hash also carries a `gm:reg-*` token, so previously shared
links now resolve correctly. Nine tests pin this behaviour, and they slice the parser out of
the shipped file rather than copying it, so they cannot drift from the code they describe.

### 4.4 Regulations are a single edit

Champions regulations change on a schedule. The application holds them in one array, ordered
newest first, and defaults to the head of that array. Adding a regulation is one row: the
default, the dropdown, the URL, and the legality note in the move list all read from it.

This follows the project standard that anything which changes over time lives in exactly one
configuration block.

---

## 5. Verification

Nine tests cover URL routing and the regulation default. They assert that a bare address opens
Champions mode on the newest regulation, that a legacy `g9` link no longer leaves Champions
mode, that a real generation link still does, and that an unknown regulation key degrades to
the newest rather than to an empty dex.

**What is not covered, stated plainly.** There is no automated test of the historical type
charts, the base-stat revisions, or the ability introduction data against an authoritative
source. Those tables were entered by hand and checked by inspection. Given that historical
correctness is the entire premise of the project, this is the most significant gap in its
verification, and it is the first thing that should be addressed. The nine tests should not be
read as evidence that the historical data is right; they are evidence that the routing is.

---

## 6. Known limitations

1. The historical data tables are unverified by automated test (section 5).
2. Run-time data depends on PokéAPI. If it is unavailable, species data degrades to
   placeholders while the local generation tables continue to work.
3. Location and encounter data exists only for the generations PokéAPI covers well.
4. The single-file architecture has no module boundaries (section 4.1).
5. The learnset export omits five moves in the legal pool (section 3.3).

---

## 7. References

1. PokéAPI v2. <https://pokeapi.co/>
2. Smogon University. `@smogon/calc` damage engine.
   <https://github.com/smogon/damage-calc>
3. Bulbapedia. "Type chart." Generation-by-generation effectiveness tables.
4. Bulbapedia. "Physical/special split." Generation IV change.
5. Game Freak. Pokémon X and Y (2013). Introduction of the Fairy type.
6. Serebii.net. Pokémon Champions regulation rosters, Regulation M-A and M-B.

---

**Companion documents.** [Slide deck](HOOPADEX-deck-plain-english.md) ·
[Technical documentation](HOOPADEX-technical-docs.md) · [Changelog](../CHANGELOG.md)
