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

## [5.42] - 2026-08-21

### Removed
- **The move page added in 5.41, reverted.** It was too clunky: a tall panel that pushed the
  learn-set filter — the thing the Moves tab is actually for — most of the way down the page, to
  show information the tooltip already gave. The Moves tab is byte-identical to 5.40 again;
  `goToMove` goes back to `selectTMSuggestion`, and the move Viewed bar went with it.

  The Viewed bar fix on **Abilities and Locations is kept**, because that was a real defect
  independent of the move page: both bars were built, populated, and never displayed.

- **The "Sets off …" list under each move's tags.**

  Reported from the live site: *"see how repetitive and clunky the contact, punching, sets off list
  are … of course i know a contact move sets off gooey"*. Both halves were right.

  The flag pills repeated, without their multipliers, the tag chips drawn immediately above them —
  `CONTACT`, `PUNCHING` sitting under `CONTACT ×1.3`, `PUNCH ×1.2`. Below those were twenty
  `Sets off <ability>` rows that say nothing about the move: they are what the word "contact"
  *means*, they are identical on every contact move in the game, and they were pushing the three
  rows that are specific to it past a six-row cap.

  A move now shows only what its tags **cost or buy** — what boosts it, blocks it, resists it, or
  strips the tag off. Ice Punch goes from 21 rows to 3: Iron Fist ×1.2, Tough Claws ×1.3,
  Punching Glove ×1.1. The tag tooltip loses its cap, its ranking and its "and 14 more" line, all
  of which existed only to manage the twenty entries that are now gone.

  The triggers are still **derived** and still tested — they are marked rather than dropped, and
  the ability pages, which have room, remain the place that answers "what sets this off".

---

## [5.41] - 2026-08-21

### Fixed
- **The ability card and the ability page gave different answers, on 267 of 373 rows.**

  Reported from the live site: the abilities list showed `Aura Break [MEGA] · Gen VI · 1 Pokémon`,
  and opening it showed `POKÉMON WITH THIS ABILITY (0)`. One question, two screens, two answers.

  The page was right. The list counted holders with `id<=genMax` and nothing else — no Champions
  roster, no form era, no hidden-ability rule, and no past-ability resolution — so in Champions it
  counted Zygarde, which is not in the Champions roster. Measured on the live build before the fix:

  | View | Rows claiming holders but having none | Rows with a wrong count |
  |---|---|---|
  | Champions Reg M-B | 97 | 170 |
  | Generation III | 74 | 43 |
  | Generation IX | 0 | 131 — all *under*counts |

  In Gen IX the cheap filter went the other way: it cannot see the forms and past holders that
  `abilityHoldersForGen` adds, so it reported fewer Pokémon than really have the ability. Aura Break
  was simply the row that got clicked.

  There is now one resolver, `abilityHoldersFiltered`, and the list and the page both call it.
  `tests/test-ability-counts.js` asserts the shortcut has not come back — the assertion is
  structural, because a test that checked today's counts would pass again the moment someone
  reintroduced a second way to count.

- **The MEGA badge advertised eight Megas that do not exist in Champions.**

  `CHAMP_MEGA_ABILITIES` is generated from `MEGAS_ZA` — the Legends: Z-A mega set — and the badge
  was drawn for every row of it whenever Champions mode was on. Those are different games. Eight of
  the 42 Z-A Megas are species the Champions roster does not contain (Baxcalibur, Darkrai,
  Golisopod, Heatran, Magearna, Tatsugiri, Zeraora, Zygarde), so the app was marking an ability as
  available on a Mega in a game where nothing can have it. Now gated on the same roster every other
  legality question uses.

- **The Viewed bar on Abilities and Locations was built, populated, and invisible.**

  `.pinned-bar` is `display:none` in CSS and each renderer turns its own on. `renderAbilityPins`
  and `renderLocPins` never did, so those two bars had been filling up and never showing — for long
  enough that it was reported as a missing feature rather than a broken one.

### Added
- **A move page: reading a move is now separate from filtering by one.**

  Searching a move called `selectTMSuggestion`, which adds it as a *criterion* in the "which Pokémon
  learn all of these" filter. So there was no way to just look at a move — asking about Bullet Punch
  silently changed what the tab was showing, and asking about a second one narrowed the results to
  the intersection of the two. Those are different questions and they now have different answers:
  searching a move opens the move, and a **Find Pokémon that learn this** button on the panel adds
  the criterion when that is what you wanted.

- **A Viewed bar for moves**, matching the Pokédex, Abilities and Items tabs. It is deliberately not
  the criteria row: pinning a move there does not filter anything.

### Changed
- **The `CVD` button is now labelled `Colourblind`, and only appears where it does something.**

  Reported from the live site: *"what does cvd mean? it doesnt seem to do anything?"* — both halves
  fair. It is an acronym for colour vision deficiency, which is a clinical term and not a label; and
  it recolours the effectiveness palette, which exists on the Type Chart and Natures screens only,
  so on the Abilities tab where it was clicked it genuinely changed nothing. A control that does
  nothing where you found it is indistinguishable from a broken one.

  Which screens use the palette is derived rather than listed: the variables `body.cvd` actually
  *changes* are measured (in dark mode `--eff-up` is the same blue either way, so a screen using
  only that one sees nothing happen), then matched against the rules that use them and against what
  is actually laid out. A tab added later that uses the palette is covered without anyone having to
  remember to come back.

### Removed
- **The version stamp beside the wordmark**, added in 5.40 and rejected on sight. It was permanent
  furniture answering a question nobody asks while the app is behaving. The cache problem it was
  added for is still solved, and better, by the update chip: that appears only when the published
  version differs from the running one, which is the only moment the number matters. `APP_VERSION`
  stays, because the check needs something to compare against.

---

## [5.40] - 2026-08-21

### Added
- **The running version is now shown in the header, and the app tells you when a newer one exists.**

  The search bug fixed in 5.39 was reported again immediately afterwards, from a page that was
  already three versions behind. The report was accurate about what was on screen and told us
  nothing, because **nothing in the interface said which build it was** — diagnosing it as a cache
  rather than a defect cost a full round trip.

  GitHub Pages serves this file with `Cache-Control: max-age=600`, so a reader can sit on a
  ten-minute-old copy while a fix is live. That is not a bug in Pages; it is a gap in the app, which
  had no way to say what it was.

  Two small things fix it:

  - **A version stamp** beside the wordmark. Muted and diagnostic, not something anyone needs to
    read — but it makes "what are you running?" answerable at a glance.
  - **An update check** on load. The version lives on line 2, so a `Range: bytes=0-300` request reads
    the published version in **261 bytes** rather than refetching an 800 KB page. If it differs, a
    chip appears offering a reload. It runs `no-store`, because asking the cache whether the cache is
    stale answers itself.

  The check is fully guarded. Offline, blocked, or a host that does not answer ranges — it does
  nothing at all. A version indicator is not worth an error message.

### Testing
- `APP_VERSION` is a second copy of a number that already exists on line 2, and this project spends
  most of its effort removing exactly that. The duplication is unavoidable — a comment is not
  readable at runtime — so `tests/test-syntax.js` now asserts the two are identical. They cannot
  drift without the build failing, which is the only thing that makes a second copy acceptable.
- 6 assertions added covering the version match and the update check's guards.

---

## [5.39] - 2026-08-21

### Fixed
- **The search stopped working entirely as soon as you opened any Pokémon.** Reported again after
  5.38 — "the search is still busted" — and 5.38 had fixed a real bug that was not this one.

  `ReferenceError: parseRomanGen is not defined`, thrown inside `onSmartSearch`, aborting the
  handler on every keystroke. The dropdown kept the previous query's contents and never updated,
  which from the outside is indistinguishable from "the search does nothing".

  **This is my regression, shipped in 5.31.** `parseRomanGen` was a local function declared inside
  `onSmartSearch`. When I extracted the ability-generation lookup into a top-level
  `getAbilityIntroGen()`, it called `parseRomanGen` from a scope where that name does not exist.

  It only fired once an ability had been cached — which happens the moment you open any Pokémon —
  so the symptom was "search works, then stops working after you look at something". Eight releases
  shipped on top of it.

- **A second bug in the same function.** `abilityCache[name].introGen` is already a number, and
  `parseRomanGen(4)` looked up `m[4]`, found nothing, and fell through to a default of **9**. So
  even without the ReferenceError, every cached ability reported itself as Generation IX. It now
  takes Roman numerals, `generation-vii` slugs and plain numbers, and returns 0 for anything else
  rather than a confident Gen IX.

### The part worth writing down
- **The test for `getAbilityIntroGen` supplied its own `parseRomanGen` into the eval scope.** It
  passed for eight releases while production threw on every keystroke, because the harness had built
  the exact function production was missing.

  This project's test files are full of comments warning about this — *"a correct copy in the test
  file would hide a broken original"* — and I wrote several of them today, in this suite, while
  doing it. The harness now slices the real function out of `app/index.html`, so the app failing to
  have one at the top level fails here too.

  There is no version of this that a stricter unit test would have caught. It needed the app to be
  run, and one look at the browser console.

### Testing
- 7 assertions added to `tests/test-dex-search.js`: `parseRomanGen` is sliced rather than written,
  numbers and slugs and numerals all resolve, unknown input returns 0, and `onSmartSearch` no longer
  carries a private copy.
- **One mutation added (M85)**, and **one removed (M86)** rather than made to pass — it deleted an
  explicit number branch and survived, correctly, because `String(4)` reaches the same answer
  through the `parseInt` fallback. The branch was doing nothing, so the branch went. A mutation that
  cannot be killed because the code it breaks has no effect is a finding about the code.
- Set is now **76, all killed**; 33 suites, 1,195 assertions.

### Verified in a browser
- Reproduced the exact reported flow — open Tapu Koko, type "electric" — and confirmed the dropdown
  now returns Electric Surge, Electric Terrain, Electrify and the rest, with **no console errors**.

---

## [5.38] - 2026-08-21

### Fixed
- **The stacking search stopped showing results after you picked anything.** Reported as "it's not
  really showing the search results, that was the best feature on the whole site", and it was not a
  rendering problem — the search handler was being switched off.

  Selecting a result sets `_suppressSearch` so that putting the query text back in the box does not
  fire the handler as though you had typed it. It was released at the end of
  `requestAnimationFrame` → `setTimeout(150)` → `setTimeout(300)`, and that chain had two failure
  modes:

  1. **For about 450ms after selecting anything, every keystroke was silently discarded.** The
     handler only runs on an input event, so typing inside that window and then stopping produced no
     dropdown at all. You had to type one more character to wake it up — which is exactly what
     "not really showing the results" looks like from the outside.
  2. **If any link in the chain did not run, the flag stayed raised and the search was dead for the
     rest of the session.** `requestAnimationFrame` does not fire in a hidden tab, and nothing was
     guarded, so a single exception during navigation was unrecoverable without a reload.

  Reproduced in a browser before the fix: apply one criterion, type anything, and
  `_suppressSearch` is `true` with `_pendingSearchVal` orphaned and every keystroke ignored.

  Three changes. The flag is released as soon as the programmatic write is done rather than 300ms
  later; a failsafe timer releases it no matter what happens in between; and if you typed during the
  window **your text wins** and the search re-runs on it instead of being overwritten by the
  restored query.

  Verified: typing 60ms after selecting now keeps the text, shows the dropdown, and leaves the flag
  down. Stacking still works end to end — Surf then Earthquake gives 47 Pokémon that learn both.

### Testing
- 6 assertions added to `tests/test-dex-search.js`. They are structural, because the flag lives in a
  DOM event path node cannot drive, and they pin the three properties that make it safe — a failsafe
  exists, no dependency on `requestAnimationFrame`, and typed text is preserved — rather than the
  timings.
- **Three mutations, M82–M84**, one per property. Set is now **75, all killed**; 33 suites,
  1,188 assertions.

### Worth noting
- This is a feature I had not touched today, broken by code that predates the session, and it was
  the most valuable thing on the site. Every release since 5.19 has been correctness work on data
  and arithmetic; none of it would ever have found this, because nothing about it is a wrong number.
  It needed someone using the app.

---

## [5.37] - 2026-08-21

### Removed
- **The local damage engine is gone. There is one calculator now, and it is the Smogon one.**
  A product decision, and the right one. 5.36 verified the two engines agreed exactly — in
  Generations VI to IX. Extending the same check downward:

  | | agreed | | agreed |
  |---|---|---|---|
  | Gen 3 | **18/45** | Gen 6 | 65/65 |
  | Gen 4 | **40/65** | Gen 7 | 65/65 |
  | Gen 5 | **59/65** | Gen 8 | 65/65 |
  | | | Gen 9 | 65/65 |

  The damage formula's rounding and operation order changed before Generation VI and the fallback
  only implemented the modern one. In Generation III it was wrong more often than it was right, and
  which number a reader got depended on whether a 480 KB sibling file had loaded.

  Maintaining a second implementation of a formula that differs by generation is a standing
  commitment nobody asked for. **240 lines and ~15 KB deleted.** When the engine is missing the
  calculator now says so, names the file, and offers a reload — it does not guess. That follows this
  project's own stated principle: a reference which is silently wrong is worse than one which
  declines to answer.

### Fixed
- **The calculator has never been generation-aware.** `calcEnsureMaps()` built its lookup from a
  hardcoded `Generations.get(9)` and cached it, so the damage calculator ran in **Generation IX
  whatever the selector said** — in an application whose entire premise is that the generation is an
  input to every lookup. Champions is Gen IX and was unaffected; every classic generation was wrong.

  It survived this long because the deleted fallback *was* generation-aware: the two engines
  disagreed about which generation they were even in, and the fallback is the one that kept getting
  audited. Deleting it is what surfaced this.

- **PokéAPI's `past_values` convention is the opposite of every other table here, and it was read
  wrong.** An entry filed against a version group is the value the move had **before** that version
  group. It was implemented as "this generation and below" — which is Showdown's mod convention, and
  correct for `PAST_STATS`, `MOVETEXT` and `PASTABIL`. Applied to `past_values` it is off by exactly
  one generation:

  | | showed | actually |
  |---|---|---|
  | Bite in Gen II | Normal | **Dark** |
  | Wing Attack in Gen II | 35 BP | **60 BP** |
  | Jump Kick in Gen IV | 70 BP | **85 BP** |
  | Tackle in Gen V | 35 BP | **50 BP** |

  This was wrong in two places. `getMoveTypeForGen` had shipped that way for a long time — and its
  loop also took the *highest* matching entry rather than the lowest, so a move with two recorded
  type changes resolved to the wrong one. **5.33 then copied the same misreading into power,
  accuracy and PP.** Both now go through one `pastValueForGen()`, so they cannot drift apart again.

  Caught by cross-checking against the Smogon engine, which carries per-generation values directly.
  That is the argument for a second source even when the first looks unambiguous — and the reason to
  keep the engine cross-check after deleting the engine it was checking.

### Changed
- `tests/test-damage-formula.js` and `tests/test-calc-engine-agreement.js` are replaced by
  `tests/test-calc-engine.js`. The hand-worked verification survives and now points at the engine:
  Snorlax Body Slam vs Blissey computed from the published formula to **208–246**, including the
  low roll where 208.5 rounds *down*. Plus per-generation checks for the mechanics the deleted
  engine got wrong, and golden values against a swapped bundle.
- **21 mutations deleted** — they broke code that no longer exists. Four added (M78–M81) for the
  engine generation, the missing-engine guard, and the `past_values` convention. M66 re-anchored.
  Set is now **72, all killed**; 33 suites, 1,182 assertions.

### On my own errors, since three of them are in here
- I wrote the `past_values` convention wrong in 5.33 and shipped it.
- I then wrote **four of seven golden values from memory** in this release rather than measuring
  them, including expecting damage from a matchup that is an immunity. A golden value invented
  rather than recorded is worse than none: it fails on correct code and teaches the reader to edit
  the expectation.
- I wrote the Jump Kick generation expectation wrong **twice**, in the app and then again in the
  test, from the same misreading.

  All three were caught by the same thing: a second source that had no reason to agree with me.

---

## [5.36] - 2026-08-21

### Fixed
- **The two damage engines disagreed, and the local one was wrong three ways.** The engineering
  review's largest unverified item was `@smogon/calc`: *"469 KB of third-party code producing the
  numbers most users see. I verified it loads and that the app prefers it; I did not verify a single
  number it returns."* That mattered more than it looked — Champions is the default mode and uses the
  Smogon path, so the numbers most readers see come from the bundle, not from the local fallback
  with the hand-worked tests.

  Cross-checking both engines over 1,728 cases found three real defects, all in the **local** engine:

  1. **The spread reduction was applied to every move.** The "Spread" checkbox sets
     `gameType:'Doubles'` for the Smogon engine, which reduces only moves that actually hit more
     than one target; the fallback applied ×0.75 to everything. Body Slam read **208–246** from one
     engine and **156–184** from the other, in the same app, from the same checkbox. The reduction
     now follows the move's target, and an unknown target is not reduced — a missing field should not
     quietly cut a damage number by a quarter.
  2. **Screens were halved in doubles.** They are 2732/4096 there — measured at 0.6682 — so the
     fallback under-reported damage by a quarter whenever a screen was up in doubles.
  3. **Chained modifiers floored where the games round.** `pokeRound` rounds a half *down*, which is
     identical to flooring on halves and doubles and differs on the awkward multipliers. It showed
     up as one point at the low roll — the size of error that never looks wrong and moves a KO
     verdict at the boundary.

  After the fixes: **1,728 of 1,728 comparisons agree exactly.** Sixteen rolls each, not a tolerance.

### Added
- `tests/test-calc-engine-agreement.js` — the cross-check as a permanent test rather than a one-off.
  The bundle is a browser build with no CommonJS export, so it is loaded by evaluating the file and
  taking the `SmogonCalc` global. 1,728 comparisons run in **0.3 seconds**, so it runs on every
  publish.

  Matrix: 6 species pairs × 12 moves × 2 levels × 12 modifier combinations, deliberately spread
  across immune, resisted, neutral, super-effective and dual-type matchups, both damage categories,
  single-target and spread moves. Each of the three defects above was found by exactly one column of
  it, and each is now pinned individually so a regression names itself rather than appearing as
  "n of 1728 disagree".

### Testing
- **Five mutations, M85–M89**, one per defect plus the rounding direction.
- Two older mutations, **M7 and M33, went SKIP** because the lines they anchor on changed. That is
  the runner working: it refused to mutate a target it could no longer locate rather than silently
  testing nothing. Anchors refreshed.
- One existing assertion — `spread === 0.75` — had to be **corrected rather than kept**. It passed
  before because the fallback applied the reduction unconditionally; it was asserting the bug.
- Set is now **89, all killed**; 34 suites, 1,273 assertions.

### Review status
- This closes the largest item in `docs/ENGINEERING-REVIEW-2026-08-03.md` §8. The engine's *version*
  remains unknown — the bundle carries no version string, and `data/vendor-pins.json` is explicit
  that a checksum pins the artefact and not its provenance. What has changed is that its **numbers**
  are now verified against an independent implementation on every run.

---

## [5.35] - 2026-08-21

### Changed
- **The last arithmetic left the damage calculator's DOM handler, closing the final condition of the
  2026-08-03 engineering review.** That review made one structural demand and one prediction with
  it:

  > "Move the whole calculation to one pure function... Until that happens, assume there is a fourth
  > input nobody has tested."

  It was right. Three audits had each found one more untested input to the same computation — the
  roll arithmetic, then STAB, then dual-type effectiveness — and the fourth turned up in 5.33:
  `power`, read as the modern value and fed into a calculator available in every generation.

  What was still inline after that is now pure: `calcLocalLevel`, `calcLocalApplyStage`,
  `calcLocalStatNames`, `calcLocalPercent`, `calcLocalBarWidth` and `calcLocalBattleStats`.
  `calcRunLocal` reads the form and renders. **Zero `Math.` calls and zero arithmetic operators
  remain in it.**

  Scope: this is the local fallback engine. The Smogon path builds `new M.Move(gen, …)` and gets its
  numbers from the engine, which resolves the generation itself.

- **Two guards that did not exist before.** `calcLocalPercent` returns 0 rather than dividing by
  zero — unguarded, a defender with no HP rendered "Infinity% of 0 HP", which is not an error
  message but a damage report. `calcLocalBarWidth` clamps to 0–100 so a missing value cannot put
  `NaN%` into a style attribute.

### Pinned, not endorsed
- **`parseInt(v)||50` treats a typed level 0 the same as an empty box**, because 0 is falsy — so
  level 0 shows 50 rather than the clamped 1. That is the shipped behaviour and it is now asserted,
  which makes it a decision on record rather than an accident nobody had noticed. Changing it is one
  line if it should become 1.

### Testing
- 28 assertions added to `tests/test-damage-formula.js`, every expected value worked by hand from
  the published formulas rather than read back out of the app.
- **Seven mutations, M78–M84.** One of them, M84, **survived the first run** and the finding is the
  same class of error as the thing being guarded: the "no arithmetic in the handler" check looked
  only for `Math.` calls, so reinstating `mn/hp*100` — which uses none — walked straight through it.
  The check now strips comments, string literals and regex literals from the handler and asserts no
  arithmetic operator survives.
- Set is now **84, all killed**; 33 suites, 1,257 assertions.
- End to end in Gen III: Charizard Flamethrower vs Blastoise reads 34–41 damage, 18.3%–22.0% of
  186 HP, 0.5× resisted, 5–6HKO. No NaN, no Infinity.

### Review status
- `docs/ENGINEERING-REVIEW-2026-08-03.md` §7 required four things. **All four are now done**:
  tag releases (5.19), merge the hash readers (5.11), audit the unguarded fetch sites (5.19, and the
  count was one rather than 21), and this. The verdict in that document stands as written — it was
  FIX THEN SHIP, and the fixes are complete.

---

## [5.34] - 2026-08-21

### Fixed
- **"Show me every Levitate Pokemon in this game" now answers correctly.** 5.33 fixed the species
  page and left the reverse join visibly undone; this closes it. Gengar showed Levitate on its own
  page in Generation IV while the Levitate page did not list it — and the Cursed Body page still
  did. The question was wrong in both directions at once.

  Both halves were needed. Removing the stale entries alone would have left the question answerable
  and **incomplete**, which is the worse of the two failures: a short list still looks like an
  answer.

  Verified at the boundary: Levitate lists Gengar in Gens IV–VI and not in VII or IX; Cursed Body
  omits it in Gen VI (where the ability exists but Gengar did not have it) and includes it from
  Gen VII. The add pass is a scan rather than a lookup, because nothing in PokeAPI's Levitate list
  mentions Gengar at all — there is no entry to correct, so one has to be produced, shaped exactly
  like a real one so every downstream filter reads it without knowing.

- **Changing generation or game now reloads the whole app, on the Pokedex.** Reported as "sometimes
  it still shows old data", and that is exactly what was happening. The app holds a dozen caches
  scoped to the selected generation — `moveCache`, `abilityCache`, `tmMoveDetailCache`, the location
  index, the item list, the learnset store — and `triggerDataRefresh` cleared the ones somebody had
  remembered to add to it. Every cache added since had to be remembered again, and the failure mode
  when one was missed is not an error: it is **last generation's answer, rendered with full
  confidence**.

  A reload is the only clear-down that cannot be incomplete. It costs a few seconds of refetching
  and removes a whole category of bug rather than adding another entry to a list that has to be kept
  in step by hand.

- **The reload was carrying the old game into the new address.** Switching from Gen IV to Gen II
  produced `#pokedex/g2/lv:diamond` — a Generation IV game named in a Generation II URL, which is
  precisely the anachronism this app exists to prevent, sitting in its own address bar. Now
  `#pokedex/g2`.

### Removed
- **The 5.32 Moves-search replay.** It re-asked your search after a generation change so the answer
  updated instead of vanishing. The reload supersedes it entirely, so it is deleted rather than left
  in to fire network lookups moments before the page is discarded. `triggerDataRefresh` still runs on
  other paths and clears exactly as before.

### Testing
- 15 assertions added to `tests/test-past-abilities.js` for the reverse join, and 8 to
  `tests/test-generation-tables.js` for the reload. The reload ones are structural — a page reload
  cannot be exercised in node — and pin that both entry points go through it, that the address is
  written *before* the reload, and that what gets written is not itself stale.
- **Five mutations, M73–M77.** Set is now **77, all killed**; 33 suites, 1,229 assertions.

---

## [5.33] - 2026-08-21

### Fixed
- **Move power, accuracy and PP were the modern ones in every generation — 140 moves.** The app read
  exactly one field out of PokeAPI's `past_values`, `pv.type`, and dropped the rest. Measured on the
  live build in Generation I before the fix:

  | Move | Shown | Actually |
  |---|---|---|
  | Wing Attack | 60 | **35** |
  | Tackle | 40 | **35** |
  | Jump Kick | 100 | **70** |
  | Vine Whip | 45 | **35** |

  **And it reached the damage calculator.** `calcLocalRolls({power: md.power, …})` took the modern
  number, and `TAB_RELEVANCE` has no rule for `calc`, so the Dmg Calc tab is visible in every
  generation — confirmed showing in Gen I. A wrong label on a page is bad; a wrong number out of
  something called a calculator is worse.

- **`moveCache` was built by hand from six places, four of which hard-coded `pastTypes:{}`.** So
  whether the app knew a move's type history depended on which code path fetched it first: open a
  move from the Pokedex and it was generation-aware, reach the same move through Team Builder and it
  was not. Both render. All six now call one `makeMoveRecord()`, and a test asserts no hand-built
  record survives.

- **Gengar had the wrong ability for four generations.** It shows Cursed Body; it had **Levitate**
  from Gen III through Gen VI — a full immunity to Ground. A reader on Gen IV was told Earthquake
  hits Gengar. It does not. This is a worse class than a stale label: an ability feeds the
  type-matchup answer, so one stale field produced a confident wrong answer to a *different*
  question, on a different screen from where the mistake lived.

  141 species affected, in three kinds: **112** a slot that did not exist yet (Pidgey had no second
  ability until Gen IV, and the app listed Tangled Feet in Gen III), **21** a hidden ability that was
  different, **8** a normal ability that was different. Rows saying a hidden slot simply predates
  Gen V are deliberately not shipped — the app already gates on that, and carrying it twice would be
  two rules to keep in step.

- **Generations I and II were offered a Natures tab and an Abilities tab.** Both mechanics arrived in
  Gen III. The tabs rendered a full modern list, which is not a smaller answer than the truth but a
  confident answer to a question those games cannot be asked. `TAB_RELEVANCE` already supported a
  `minGen` rule and simply did not use it.

### Corrected
- **I reported 29 species with changed abilities. It is 141.** The first count looked only at rows
  where a past ability was *named* and missed the larger kind — rows saying a slot was **empty**,
  which is equally a fact about that generation and three times as common.

### Not done, and why
- **Move effect changes (`moveeffectchange`, 28 rows) were audited and deliberately skipped.** They
  overlap what 5.32 already derives from Showdown's per-generation text, and adding them would be a
  second source for the same fact — the thing this project spends most of its effort avoiding. It is
  recorded rather than quietly dropped.
- **The ability page still lists species by their modern ability.** Gengar now shows Levitate on its
  own page in Gen IV, but the Levitate page does not yet list Gengar there. The forward direction is
  fixed; the reverse is a separate join and is on the backlog rather than half-done.

### Testing
- `tests/test-move-stats.js` (23 assertions) and `tests/test-past-abilities.js` (25).
- **Eight mutations, M65–M72.** Two problems surfaced during the run and both were real:
  **M60 went SKIP** because three functions now resolve a generation cutoff with an identically
  shaped line and two share a local name, so the anchor matched twice — the runner correctly refused
  to mutate an ambiguous target rather than silently picking one. **M71 survived** because Pidgey's
  only changed slot is a *removal*, so the branch that rebuilds a replaced entry never ran; proving
  slot numbers survive needed a species with a removal before a replacement, and no real species has
  both, so the fixture is injected.
- Set is now **72, all killed**; 33 suites, 1,206 assertions.

---

## [5.32] - 2026-08-21

### Added
- **Move descriptions are now correct for the generation you have selected.** Asked as "what other
  moves are vague like this" after the Nature Power work; the answer turned out to be a much bigger
  problem than the one that prompted it.

  PokeAPI gives one description per move with no generation dimension, written for the current
  games. Jump Kick was described as *"takes half the damage it would have inflicted"* in every
  generation ever made:

  | Gen | Miss penalty |
  |---|---|
  | I | **1 HP.** Flat. |
  | II | 1/8 of the damage dealt |
  | III–IV | 1/2 of the damage dealt |
  | V+ | **50% of the user's max HP** — a different quantity entirely |

  Four mechanics, one sentence, and in Generation I not a rounding difference but a different move.
  Whirlwind is blunter: Showdown's note for Generation I is *"No competitive use"*, while the app
  said it forces trainers to switch. Guillotine in Generation I fails against a faster target, which
  the app never mentioned.

  **138 moves** are affected: 73 in Gen I, 62 in II, 58 in III, 56 in IV, 27 in V, 15 in VI, 12 in
  VII, 7 in VIII, and 0 in Gen IX — which is the generation the old text was written for. The
  correction shows the old wording and the modern one together, because a reader has seen the modern
  sentence everywhere else and the contrast is the useful part.

- **The game selector now changes the description too, not just the generation.** Ruby and FireRed
  are both Generation III and do not print the same sentence for Surf. `genFlavorText` answered at
  generation granularity, so every Gen III game showed the newest Gen III wording; it now prefers
  the exact version group when a specific game is chosen, falling back to the generation when that
  game has no wording of its own.

### Fixed
- **Changing generation wiped the Moves search instead of re-answering it.** Searching Jump Kick and
  then switching to Gen I discarded the search along with the result — the wrong answer to a
  question the reader had already asked. The move names now survive the refresh and are re-resolved
  against the new generation, because the per-move results genuinely have to be recomputed;
  re-rendering the stale rows would have been worse than clearing them.

### Corrected
- **A number reported earlier in this session was wrong, and is corrected here rather than quietly
  restated.** The first measurement said 312 moves were affected and 169 on a Gen III selection.
  312 of 882 moves do carry some per-generation override in Showdown, but most of those change only
  the long paragraph and leave the one-line summary alone. Counting them overstated the problem by
  more than double, and building on it produced a **437 KB** blob of paragraphs where one-line
  summaries belong. The honest figure is 138 moves and 58 on Gen III, and the shipped table is 20 KB.

  The same pass also caught overrides being resolved for moves that did not exist yet — Aurora Veil
  carries a gen8 override, so "what did Aurora Veil do in Generation III" returned a real sentence
  about a move that had not been invented.

### Known gap
- **Champions move mechanics are inherited, not verified.** Showdown documents the mainline games;
  nothing published describes Champions' move behaviour separately. Champions selects Generation IX
  here and so inherits Scarlet/Violet wording, which is very probably right and is not checked. The
  panel names the rules it is quoting ("Scarlet/Violet rules") rather than implying otherwise, and
  the gap is recorded in `docs/BACKLOG.md`. The app already knows Champions differs in roster,
  legality, items and the stat system — move mechanics is the one axis with no source.

### Testing
- `tests/test-move-text.js` — 26 assertions on the cutoff arithmetic, which is the part that fails
  silently: an off-by-one shows Generation II's wording to a Generation III reader at the same size
  and confidence as the right answer. Pinned in both directions, including that a generation with no
  entry of its own reads the cutoff ABOVE it rather than below.
- 5 assertions added to `tests/test-interactions.js` for the version-group preference.
- **Five mutations, M60–M64.** Set is now **64, all killed**; 31 suites, 1,149 assertions.

---

## [5.31] - 2026-08-21

### Added
- **Nature Power, Secret Power and Camouflage now say what they actually become, per generation.**
  Reported from the live site: "for like nature power i want to know what the moves turns into based
  on the location". The app printed PokeAPI's line — *"Uses a move which depends upon the terrain"* —
  and nothing else, which tells a reader an answer exists and then withholds it. No list of what the
  terrain can be, no move it becomes, no hint that the mapping is different in every generation.

  Every ability and item page now has the table for the generation on screen. A cave is the clearest
  case, and the reason this had to be generation-indexed rather than flattened:

  | Generation | A cave gives |
  |---|---|
  | III | Shadow Ball |
  | V | Rock Slide |
  | VI–VIII | Power Gem |

  Generation IX gets a sentence instead of a table, because the move cannot be selected at all —
  which is the answer, and rendering nothing there would read as missing data.

- **This is the one table in the app not derived from Showdown, and that was a deliberate call.**
  Showdown is a battle simulator with no overworld, so it has no cave or tall grass to be standing
  in. Its per-generation mods collapse the entire table to one hardcoded call — `swift` in Gen III,
  `triattack` in Gen IV, `earthquake` in Gen V. Each is a correct answer about a Showdown battle and
  a wrong answer about Ruby. Reaching for the usual source here would have produced a confident,
  precise, **single-row lie** — this project's defining failure mode, arrived at through the source
  it normally trusts most.

  The source is Bulbapedia's wikitext via the MediaWiki API instead. The four terrain-move rows
  Showdown *does* model (Electric/Grassy/Misty/Psychic Terrain) are cross-checked against its
  `onTryHit` and the build fails on disagreement, so the one part that can have two sources has two.

### Fixed
- **The search gave two different answers to the same question.** Reported as "im getting
  conflicting answers on bullet punch": searching it in Gen III returned Bullet Punch under MOVES
  and, four rows lower, Bullet Punch under NOT IN GEN III.

  Two causes, both in the fuzzy pass that runs after the exact-match pass. It deduplicated against
  `items` only — but the exact pass routes later-generation hits into `otherGenItems`, so Bullet
  Punch was absent from `items`, looked new, and was added again. And it applied **no generation
  rule at all**, so Gen III also offered Bulletproof (Gen VI) and Ball Fetch (Gen VIII) as ordinary
  results with nothing marking them.

  The second was the more damaging and produced no visible contradiction — a wrong answer with
  nothing to notice. It survived because an ability's introduction generation was computed *inline*
  inside the exact branch and existed nowhere else, so the branch beside it had no way to ask the
  question. It is now `getAbilityIntroGen()` and both branches call it. Out-of-era hits are not
  dropped; they go to the same "Not in Gen N" section, which is what makes the answer useful rather
  than merely absent.

### Testing
- `tests/test-environment-moves.js` — 32 assertions. What they defend is the **parser**, because a
  wiki-markup parser fails quietly: its failure mode is a plausible-looking table with a wrong name
  in it, not a crash. Both real defects found while building it were that shape, and neither threw:
  one returned an entirely empty table for two of the three moves (their pages nest the generation
  headings one level deeper and write "Generation VIII onwards"); the other produced
  `volcano|Volcano}}` as the name of a place, in eleven rows, because Bulbapedia nests templates
  (`{{color|{{locationcolor/text|volcano}}|Volcano}}`) and a single non-nesting regex matched the
  inner one as though it were the outer one. Templates are now resolved innermost-first.
- 11 assertions added to `tests/test-dex-search.js`, and **seven mutations, M53–M59**. One of them,
  M55, **survived on the first run**: the assertion checked that `placedMove` was *used*, not how it
  was *built*, so reverting its definition to the in-generation bucket kept the suite green while
  Bullet Punch was listed twice again. Now asserted on the definition.
- Set is now **59 mutations, all killed**; 30 suites, 1,119 assertions.

---

## [5.30] - 2026-08-09

### Fixed
- **The Hidden pill sat outside its card, on top of the next card's sprite.** Reported from the
  Cud Chew page, where three of the four entries are Paldean Tauros forms with long names.

  The card was four siblings on one flex row — sprite, a **bare text node** for the name, the form
  pill, the Hidden pill — inside a grid cell of `minmax(160px, 1fr)`. The sprite and the form pill
  had `flex-shrink:0`, the Hidden pill had `margin-left:auto` pushing it hard right, and a bare text
  node has no `min-width` to give. Nothing in the row could yield, so it ran past the card. Measured
  in the browser: **227px of content in a 158px card**, with the pills 13px clear of the right
  border.

  The name and pills are now a column that is allowed to narrow, so a long name wraps inside the
  card. `min-width:0` on that column is the load-bearing part: a flex item's default `min-width` is
  `auto`, meaning "never smaller than my content", so without it the restructure changes nothing.
  `margin-left:auto` is gone from the Hidden pill — it was what turned "too wide" into "outside the
  card".

  Re-measured after: **158 of 158, nothing escaping**, and it holds down to 120px cards — 40px below
  the grid's declared minimum. It still breaks below about 100px, where the sprite plus a `nowrap`
  "GEN IX+" pill exceed the card on their own; the grid cannot produce a column that narrow, so that
  is a stated limit rather than a fix.

### Testing
- Card markup extracted as `apMonCard()` so it can be tested at all — the defect is a markup one,
  and a test that cannot see the markup cannot see it.
- 14 assertions added to `tests/test-ability-desc.js`, and **three mutations, M50–M52**, one per
  half of the fix. Set is now **52, all killed**; suites 29, assertions 1,076.
- Four of those assertions read the stylesheet, which is normally a change-detector and is called
  out as such in the suite. There is no layout engine in node, so the alternative is no test at all,
  and this is a defect that renders perfectly — one card overlapping another reads as a design
  choice until someone squints.

---

## [5.29] - 2026-08-09

### Added
- **Abilities, items and moves now say what they do to a CLASS of moves, and which moves are in
  it.** Reported from the live site: "Mega Launcher boosts Aura Sphere and nothing on either page
  says so". There was no way to find that out in the app. The Mega Launcher page said "Powers up
  pulse moves" and stopped; the Aura Sphere tooltip did not mention Mega Launcher; and nothing
  anywhere listed the seven moves that carry the flag.

  This is derived, not typed. A class of moves has a name in the game's own data — a move flag —
  and an ability's code tests it directly. Mega Launcher is literally
  `if (move.flags['pulse']) return this.chainModify(1.5)`, so both "boosts pulse moves ×1.5" and
  the seven members of the class are read out of Showdown by `build/generate-interactions.js` and
  embedded by `build/embed-interactions.js`. **36 abilities and 6 items** have a rule; **441 moves**
  carry at least one shown flag.

  Every ability page and item page gained a MECHANICS block, and every move tooltip gained its flag
  chips plus who acts on it — "Boosted ×1.5 by Mega Launcher", "Blocked by Bulletproof".

  Two deliberate limits. A multiplier is only stated when the hook that carries it is unambiguous:
  Fluffy, which doubles Fire damage and halves contact damage in separate branches, is reported as
  an interaction with **no number** rather than being given one of the two. And a broad flag is
  counted rather than listed — 277 contact moves is not a list anyone reads.

  Contact needed one extra rule to work at all. Showdown does not test `move.flags['contact']`
  directly, because three things remove that flag conditionally; it asks `checkMoveMakesContact`.
  Reading that call as a contact test is what puts Rocky Helmet, Rough Skin, Static and fifteen
  others on the list. Without it the app would have shown Tough Claws and implied contact had no
  other consequences.

### Fixed
- **Every ability, item and move was described by one generation-blind sentence, and for a whole
  class of them that sentence was years out of date.** Reported as "Scrappy also ignores Intimidate
  and we don't show that". The app took PokeAPI's `short_effect`, which has no generation dimension
  at all: Scrappy's has read "Lets the Pokemon's Normal and Fighting moves hit Ghost Pokemon" since
  Generation IV and has never mentioned Intimidate. Oblivious's still describes only infatuation and
  Captivate — no Taunt immunity (Gen VI), no Intimidate immunity (Gen VIII).

  PokeAPI does carry the answer and the app was not reading the field. `flavor_text_entries` holds
  one line **per version group**; the app called `.pop()` on it, which takes the newest whatever
  generation is selected, and only as a fallback behind `short_effect`. Reading it properly makes
  the page correct in both directions: Gen IX gets Scarlet/Violet's line, which mentions Intimidate,
  and Gen VII gets Ultra Sun/Ultra Moon's, which does not — because in Gen VII it did not.

  The same bug was in the move tooltip and in `loadItemDetail`, which took the **first** English
  entry: an item whose description was rewritten showed its debut wording for ever, in every
  generation. All three now share one `genFlavorText()`.

- **When did the mechanic actually change?** The two sources disagree and the disagreement is kept
  rather than flattened. Showdown's `mods/gen7/abilities.ts` contains
  `oblivious: { inherit: true, onTryBoost: undefined }` — in Gen VII and below these abilities did
  not have the hook that resists Intimidate — so the mechanic landed in **Gen VIII**. The games did
  not reword the description until **Scarlet/Violet**. Both are true about different things.
  Showdown decides whether the mechanic is present, because that is a question about the mechanic;
  the game text supplies the wording. Below the change point the line is not shown at all, rather
  than shown with a caveat. Same cutoff convention `build/generate-past-stats.js` already uses for
  base stats.

- **Tough Claws printed two different multipliers, two inches apart.** MECHANICS derives ×1.3 from
  Showdown's 5325/4096; PokeAPI's `short_effect` still says "to 1.33× their power", which was the
  Generation VI value and stopped being true in Generation VII. Both were on screen at once with
  nothing to tell the reader which to believe. The stale prose is now dropped when it states a
  multiplier the derived rule disagrees with — a numeric conflict only, so prose that adds anything
  else still shows.

- **The ability page printed its own description twice.** `isRestatement(candidate, reference)`
  scores the candidate's words, so its arguments are not interchangeable, and the new call passed
  them the other way round. That asks a different question, answers no, and put Scrappy's
  Intimidate sentence above the older sentence without it. Corrected while wiring the panel; the
  ordering is now stated in a comment at the call site.

- **Punk Rock listed the same thirty-three sound moves twice**, once for its boost rule and once
  for its resist rule, a screen apart. The member list belongs to the flag, not to the rule.

### Testing
- `tests/test-interactions.js` — **56 assertions**, behavioural rather than structural: the shipped
  functions are sliced out of `index.html` and run against known answers. Nothing is restated
  locally, so a correct copy in the test file cannot hide a broken original.
- **Thirteen new mutations, M37–M49**, each naming this suite. One of them, M42, **survived on the
  first run** and the finding was real: 0.5 is the only resist multiplier in the shipped data, and
  it is the single value where "50% less" and "50% of" are the same string — so printing the raw
  factor instead of the reduction was invisible to the suite. Fixed with an asymmetric fixture.
- The mutation set is now **49, all killed**. Suites 29, assertions 1,062.
- `M45` asserts the embedded 25 KB table is byte-identical to `data/interactions.embed.json`, so a
  stale embed fails the build instead of shipping quietly.

### Not verified
- **How it looks.** Screenshots still do not composite in this environment, so the panel was checked
  structurally — classes resolve, no horizontal overflow, no page-width growth — and read as text,
  not seen. The CSS uses only existing theme variables and `color-mix` over them, with no literal
  colour anywhere, which is what makes it safe in both themes by construction rather than by
  inspection.

---

## [5.28] - 2026-08-03

### Fixed
- **Sneasler was drawn as evolving from ordinary Sneasel. It evolves from the HISUIAN one.** The
  chart forked a single Dark/Ice Sneasel to both Weavile and Sneasler, which states something false
  about both branches: Sneasler comes from Hisuian Sneasel (Fighting/Poison) and nothing else.

  PokeAPI carries this and the app was not reading it. The Sneasler branch has
  `base_form: {name: "sneasel-hisui"}` in its `evolution_details`, right beside the Razor Claw and
  time-of-day conditions the app was already using. So it is derived, not hardcoded: any branch that
  names a `base_form` now renders that form as its parent. The row reads
  **Sneasel (Hisuian) → Sneasler**, matching the published dex.

- **A Showdown paste containing Basculegion imported as "skipped: Basculegion (not found)".** There
  is no plain `basculegion` to find: PokeAPI files #902 as `basculegion-male` and carries
  `basculegion-female` as a separate forme, so the bare name 404s and the lookup gave up.

  The `(M)` / `(F)` marker on the paste's first line was already being parsed and then ignored. For
  most species it is cosmetic, but for this one it is not: male Basculegion is the physical attacker
  and female is the special one, with different stats. Reading it is more correct than dropping it.
  Verified: a paste with `Basculegion (M)`, `Basculegion (F)` and Empoleon now imports all three, to
  `basculegion-male` (#902) and `basculegion-female` (#10248) respectively.

  Only the gendered suffixes are tried as a fallback, never a general prefix match - "Sneasel"
  prefix-matches "sneasel-hisui", and quietly resolving a plain Sneasel to the Hisuian forme would
  be a worse bug than the one being fixed.

---

## [5.27] - 2026-08-03

### Fixed
- **"No locations found." was usually a lie, and it was permanent.** The location loader ended with
  `catch{locCache[key]=[]}` - a failed fetch wrote an EMPTY ARRAY into the cache. So one network
  hiccup became a permanent verdict: the empty result was cached, every later visit read the cache
  without retrying, and the app told you Kanto has no locations. Will hit exactly this in
  Generation I, and by the time it was investigated the same URL worked perfectly, which is the
  signature of a cached failure rather than a broken feature.

  The failure is no longer cached - the key is deleted so the next visit retries - and the message
  says what actually happened: "Could not load locations. PokéAPI did not respond. This is a network
  problem, not a statement about the game", with a Try again button.

  Verified by failing the fetch and then restoring it: it reports the failure, caches nothing, and
  **recovers on the next call** with all 25 Kanto routes back.

### Notes
- **Third instance of this exact shape today**, after the Items tab spinning forever and the
  Champions learnsets caching their own failure. All three presented a network problem as an answer
  about the data: a spinner that never resolves, a legality list that is silently empty, a region
  that supposedly has no locations. A cache that remembers failures is worse than no cache, and an
  empty result presented as a fact is worse than an error. Worth watching for the fourth.

---

## [5.26] - 2026-08-03

### Changed
- **Regulation Changes is written out as an article.** It was a chip wall: ADDED 22, then twenty-two
  "#0045 Vileplume" tokens, then thirty item pills. Every fact was on screen and none of them was a
  sentence, so reading it told you what changed and never what it meant. It now reads:

  > Twenty-two Pokemon joined and none left, taking Regulation M-B from 186 to 208.
  > By typing, the arrivals lean poison (5), fighting (4) and dark (4).
  > The fastest of them is Sceptile at 120 base Speed; the highest base stat total belongs to
  > Metagross at 600.
  > Thirty-one items became legal. Fourteen of them are Mega Stones arriving with their species —
  > Barbaracle, Blaziken, Dragalge... The rest are held items — Big Root, Damp Rock... plus eleven more.
  > No move legality changed. All 186 Pokemon present in both regulations learn exactly the same moves.

  **Every clause is still derived and nothing is hand-written** - the counts, the type lean, the stat
  outliers, and which stones belong to which arriving species. That last one is worked out by
  matching the stone name back to a species rather than from a table, because Mega Stones are named
  after their species by construction and a table would be one more hand-maintained mapping to go
  stale. Where the data a clause needs has not loaded, the clause is omitted rather than guessed at,
  so the article grows as the roster arrives instead of asserting something it cannot support.

  The full roster and item lists stay underneath. The article says what the change means; the lists
  say exactly what it was, which is what you check a specific name against.

### Fixed
- Four prose faults found by reading the output rather than the code: "22" was not spelled out
  (numbers now read as words to ninety-nine, digits above), species names came through lowercase,
  the held-item overflow produced "Icy Rock and Iron Ball and 11 more" because the list join already
  ends in "and", and "Pyroar Male" kept a gender suffix that nobody says out loud.

---

## [5.25] - 2026-08-03

### Fixed
- **The white squares around old sprites, measured properly this time.** Drawing each sprite to a
  canvas and reading pixel 0,0 settles it: `generation-i` and `generation-ii` ship a fully OPAQUE
  white background, and every set from `generation-iii` onward is already transparent. The white is
  in the file, not the CSS - no ancestor of the sprite paints a background, which is why the blend
  hack of 5.21 was attacking the wrong thing.

  It cannot be removed in CSS on a dark theme, so it is made deliberate instead: Gen I and II
  sprites get a rounded plate with a soft edge, reading as a framed sprite rather than a stray white
  box. Scoped by `[src*="/generation-i/"]` so nothing later is touched.

  They also render `pixelated` now. These are 40x40 images displayed at 96px and the browser was
  smoothing them into mush; nearest-neighbour is what they were drawn for.

- **Will's "hovering gives the white square" was the missing clue and it decoded to something else.**
  Hover applies `transform`, a transform creates a stacking context, and a stacking context isolates
  `mix-blend-mode` - so the hovered card was the only one NOT being blended, and was showing the
  sprite's true appearance while its neighbours were silhouettes. The symptom pointed straight at
  the cause of the 5.21 regression rather than at a hover bug.

### Changed
- **The stack-filters hint appears on every tab that has the search bar.** It was shown on the
  Pokedex only, but the bar is shared by Pokedex, Moves, Abilities, Items and Locations, and Enter
  stacks a filter from any of them. A feature that works everywhere and is advertised in one place
  is a feature most people never find.
- **Adding a filter from another tab now takes you to the Pokedex.** Filters resolve against the
  dex, so stacking one from Moves used to succeed silently on a tab that cannot show the result -
  chips appeared, the dex updated, and you were still looking at something else. Verified: the
  filter is accepted from Moves and the view follows it.

---

## [5.24] - 2026-08-03

### Fixed
- **Most tabs stopped working. Moving EV Training into Other in 5.22 broke them.** Removing the
  `tab-evs` nav button left two loops still calling
  `document.getElementById('tab-evs').className = ...`, which returned null and threw. Throwing
  part-way through a `forEach` leaves every tab AFTER the failing one in the wrong state - which is
  why the symptom was "a lot of the tabs don't work" rather than one broken tab, and why the Type
  Chart rendered as a blank page while `renderTC()` still worked perfectly when called by hand.

  The `evs` entry belongs in those lists: its PANEL still has to be hidden when you leave it. It is
  the BUTTON that no longer exists. Both lookups are now guarded - a panel without a button is a
  normal thing to have, and crashing over it is not. There were two copies of the loop and both had
  the fault.

  Verified by switching through all ten tabs in Generation III and checking each one renders:
  previously the first failure poisoned the rest, now all ten report ok.

---

## [5.23] - 2026-08-03

### Fixed
- **Reverted the sprite blend from 5.21, which broke every sprite in the app.** I used
  `mix-blend-mode:multiply` to drop the white box around the Gen I-V sprites. Multiply DARKENS -
  each pixel is combined against the backdrop and the result can only get darker - so against this
  app's dark cards it did not remove the white, it turned every sprite into a barely visible
  silhouette, in every generation. Multiply keys white out against a LIGHT backdrop, which is the
  opposite of the theme it was applied to.

  This was shipped and live, and it was the one change of the batch I had flagged as unverifiable:
  I said at the time that it "can dull the sprite" and that I could not see the result to judge it.
  It should not have gone out on that basis. The lesson is not about blend modes - it is that a
  change whose only failure mode is visual has no business shipping from someone who cannot see it.
  The comment left in the CSS says as much, so the next person reaching for a blend mode here tests
  it on the dark theme first.

  The white boxes are back, unfixed. Honest options if it is worth another attempt: a light plate
  behind the sprite, or leaving it alone.

---

## [5.22] - 2026-08-03

### Added
- **Pin Pokemon to a comparison table at the top of Speed Tiers.** A 327-row list answers "what is
  fast" but not "does my Whimsicott outrun their Swampert", which is the question people actually
  bring to a speed sheet - and searching shows one at a time while sorting scatters them. Click the
  star on any row and it joins a pinned table above the main one, using the same columns so the
  numbers line up. Pinned rows are drawn from the whole roster rather than the filtered view, so a
  pin does not vanish when you type a search term; verified by searching "dragapult" with three
  pins held and getting both. Pins are scoped per generation, like teams.

### Changed
- **EV Training moved from the top-level nav into Other.** It is a build-planning tool like Speed
  Tiers and Bulk rather than a way of browsing the dex, and the top row had reached eleven tabs.
  Now ten, with EV Training as the sixth tool under Other.
- **The Bulk tab states the rule the way people use it.** One HP point is worth `Def + SpD`; one
  defence point is worth `HP`; so HP keeps winning until `HP is about Def + SpD` - roughly double
  each defence when the two are close, which is the rule VGC players quote. Both forms are given
  because they only part company on lopsided defenders, which is exactly where the folk version
  misleads.

  It also names what it does NOT do. It assumes an opponent that is either fully physical or fully
  special; against one that mixes both in a single battle, shore up the weaker defence further. And
  it optimises general bulk - if you are building to survive one particular attack, that is a
  damage-calculator question, and the paragraph now links there rather than quietly answering a
  different question.

  This closes finding F4 of the architecture review, which flagged the objective as possibly wrong.
  It is not: two independent published sources use the same marginal-gain framing, and the worked
  example in one of them (180 HP with 100/100 defences, invest to 200) reproduces exactly against
  the shipped model.

### Fixed
- **Mutation M24 was re-anchored.** Relabelling the speed columns in 5.20 left its anchor matching
  nothing, and `mutation-check` reported SKIP and failed the run rather than counting it as a pass
  - the second time that guard has caught a stale anchor today, working exactly as designed.

---

## [5.21] - 2026-08-03

### Fixed
- **The evolution chain showed modern artwork in every generation.** A Gen I Venusaur page had the
  Red/Blue sprite at the top and three current renders in the evolution chain beside it, because
  renderEvoStage reached for `official-artwork` BEFORE falling back to the generation-aware
  `spriteFor()`. Official artwork is the modern render for every species regardless of the
  generation selected. Showing current-generation art in an older view is the bug CLAUDE.md names
  by name, sitting in the middle of the dex entry. Period sprites now win; the artwork is used only
  where a generation has no period sprite to prefer. Verified in Gen I: all three chain sprites now
  resolve to `generation-i/red-blue/`.
- **`SPECIAL` overlapped its own value.** The stat label column was 62px-worth of text in a 36px
  box, so Gen I read "SPECIAL100". Sized to the longest label the app can produce rather than to
  HP/ATK/DEF/SPE.
- **Gen I-V sprites sat in white boxes and covered the dex number.** PokeAPI ships those files with
  an opaque white background rather than transparency. `mix-blend-mode:multiply`, scoped to
  `[src*="/versions/"]`, lets pure white fall through to the card while leaving modern (genuinely
  transparent) artwork untouched. The dex number gets a z-index so a 96px sprite stops drawing over
  the thing you scan the grid by.
- **Smogon sets showed a blank where EVs go in Gen I and II.** Those generations had no EVs: they
  used Stat Experience, awarded in EVERY stat by every defeated Pokemon, capped at 65535 each with
  no 510 budget and no 252 per-stat limit. EVs arrived in Generation III. So the sets are correct
  and Smogon publishes no EV line - but an empty space where a reader expects numbers reads as
  missing data, which is the same failure as a spinner that never resolves. It now says which
  system that generation used.

### Changed
- **Teams are scoped to the generation they were built in.** Switching to Gen I kept the Champions
  team on screen - Meowscarada and Gholdengo in Red/Blue - which is precisely the anachronism this
  app exists to prevent, sitting in its own Team Builder. Will's framing: almost nobody flicks
  between games while using this; they are on whatever game they are playing and want only what is
  true of it, which is the whole premise of a generation-aware dex. Each generation now keeps its
  own working team and its own saved teams, and teams from other generations are not shown.

  Migration: entries saved before this change carry no scope and are filed under Champions, which
  is where they were built - the working team found in storage was a Regulation M-B team. Nothing
  is deleted.
- **The hidden-ability pill stopped being coloured.** It had a solid purple that appears nowhere
  else in the app, which made a mere variant the loudest element on the panel; three attempts at a
  better colour were all rejected. The answer was not a fourth colour. Abilities are now split into
  two labelled groups - ABILITY and HIDDEN ABILITY - reusing the exact caption pattern already used
  below for SUPER RESIST / RESISTS / WEAK TO, so both pills are identical and the grouping carries
  the meaning. The cryptic `(H)` goes with it; the heading says it in words.

---

## [5.20] - 2026-08-03

### Changed
- **The type chart's hover readout moved into the legend strip.** It was a bold 14px panel pinned
  40px above the cursor, so on an 18x18 grid it covered the cells being scanned - it hid the answer
  in order to show the caption. It now writes into a fixed slot at the end of the legend, where it
  can never occlude a cell. The crosshair already says which cell you are on; the readout only has
  to name it.
- **Move Priority is a grid rather than a wrapping row.** As flex, a long bracket (+1 has fifteen
  moves) reflowed onto a ragged second line whose first item sat wherever the first line ran out,
  so nothing lined up with anything above it. Fixed tracks put move three of one bracket directly
  under move three of the next, which is the reason to lay them out in rows at all.
- **The type calculators no longer echo their own inputs.** Both panels repeated the picked types
  as badges immediately beneath the dropdowns that already named them - "Fighting, Fire, Rock" in
  the selects and FIGHTING FIRE ROCK again on the next line. It restated the input instead of
  adding to it and spent a row of vertical space on a panel whose answer is the part worth reading.
- **Speed Tiers column labels put on one grammar: nature, then SP, then item.**
  `Base / +Nat 32 / Neutral 32 / Neutral 0 / -Nat 0 / +Nat 32 + Scarf / Neutral 32 + Scarf`.
  Previously the same axis was named two different ways - "+Nat" meant a speed-boosting nature
  while "-Spe" meant a speed-reducing one, so a reader had to work out that they were opposite ends
  of one thing rather than two unrelated ideas. "Max" was also doing double duty: "Max +Nat" meant
  max SP, and "Max + Scarf" meant max SP *and* a boosting nature.
- `docs/STAT-FORMULA.md` regenerated from the shipped code.

---

## [5.19] — 2026-08-03

### Fixed
- **A failed learnset load was cached forever.** `ensureChampLS()` was the one genuinely unguarded
  `fetch` in the app, and the missing error message turned out to be the lesser half of the problem.
  `_champLSLoading` held the promise, so a *rejected* one was cached and every subsequent call
  replayed the same rejection — once `champions-learnsets.json` failed, Champions move legality
  could never load again in that session, even if the network came back a second later. **A cache
  that remembers failures is worse than no cache.**

  It now clears the cached promise on failure, warns once in the console, and resolves to `null`
  rather than rejecting — every caller already wrapped it in an empty `try{...}catch(e){}`, so
  rejecting achieved nothing except making an unhandled rejection possible, and all the consumers
  already test `if(!champLS)`. What a reader loses is Champions move legality, which degrades to
  "no data" rather than to a wrong answer.

  Verified in the browser by failing the fetch, restoring it and calling again: it previously stayed
  dead, and now **recovers and loads all 496 moves**. Mutation **M36** re-caches the failure and is
  caught.

### Notes
- **A figure in the engineering review was wrong and is corrected there.** It reported *"21 of 54
  `fetch(` sites have no try/catch within ±12 lines"*. That was a heuristic artefact. Widening the
  window and counting `.catch()` chains gives **12** candidates, and checking each one's *enclosing
  function* leaves exactly **one** genuinely unguarded — the one fixed above. **A window measured in
  lines is not the same as a scope**, which is the same mistake as sampling the wrong region of a
  file, in a different disguise.

  Also measured while checking: 48 of the app's 54 `catch` blocks show the reader nothing. Most are
  correct — a failed sprite or a missing optional field should not raise a banner — but that number
  is worth knowing rather than assuming, and it is the honest reason this was not turned into a
  sweep of all of them.

---

## [5.18] — 2026-08-03

### Fixed
- **EV Training only ever searched the first 400 Pokémon.** `master.filter(...).slice(0,400)` meant
  that in Generation IX everything from **#401 onward** — Turtwig through to the whole of Paldea —
  was invisible to the tool, and nothing on screen said so. It also fetched at most **50** species
  per run, so it usually answered from whatever happened to be cached already. Same shape as the
  Bulk 60-row cap fixed in 5.14: a truncation with no caption reads as a complete answer.

  The cap is gone, loading is batched across the whole range, and the heading now states what was
  actually searched — *"Searched 1025 of 1025 Pokémon in this generation"*, with a plain warning
  while any are still loading. Verified on Emerald: **386 of 386** searched, returning Marill,
  Wurmple, Shroomish, Slakoth and Wailmer.

- **In Champions mode it was scanning the National Dex**, not the regulation. Now filtered on
  `CHAMPIONS_IDS` like every other roster-walking tool.

- **An empty result blamed the reader.** With no encounter data for a game, the location filter
  drops everything and the message read *"No Pokémon with HP EV yields found for this progression
  point"* — when in fact 131 species yield HP EVs and PokéAPI simply publishes no encounters for
  Scarlet/Violet. It now names the real reason and distinguishes the three cases: no encounter data
  for this game, none reachable at this progression point, and genuinely none in the generation.

### Added
- **`build/publish.sh` tags each release.** There was no rollback story: zero tags, and Pages serves
  whatever is on `main`, so going back meant finding a commit by hand. The version on line 2 is
  already the release identity and the suites have just passed against it, so that is the honest
  moment to name it. Re-publishing the same version leaves the existing tag alone — a tag that
  moves is worse than no tag.

### Changed
- **A count assertion became a direction assertion.** `test-viz-palette.js` asserted that
  `NO_ENCOUNTER_DATA` had exactly **two** readers, so adding the third legitimate one above turned
  the publish gate red. The count was never the point: what matters is that nobody re-implements
  the list. It now asserts that the shared constant is read *and defined exactly once*. This is the
  "asserts a count where it should assert a direction" pattern the architecture review named,
  caught in the act — by the publish gate, which refused the push. Working as designed.

---

## [5.17] — 2026-08-03

### Changed
- **The damage calculator's remaining decisions are out of the DOM handler.** This was the
  engineering review's first recommendation, and its reasoning was that three separate audits had
  each found *one more* untested input to the same calculation — the roll loop, then STAB, then
  dual-type effectiveness — because every fix left the rest inside an event handler where no test
  could reach it. Doing it a piece at a time guarantees a fourth. This is the rest of it:

  - `calcLocalModifiers()` — weather, spread, burn and screens.
  - `calcLocalCritStages()` — the critical-hit stat-stage rule.
  - `calcLocalKO()` — **the KO verdict**, which is the sentence a reader actually acts on.
    "Guaranteed 2HKO" is the difference between bringing a Pokémon and leaving it at home, and it
    was a seven-branch ladder with no test of any kind behind it.

  28 new assertions, and four new mutations (**M32–M35**) that each break one of these and are
  caught: burn halving special attacks, a crit no longer ignoring screens, a crit clamping the
  wrong side of the defender's stage, and the 2HKO verdict reading from the high roll instead of
  the low one. 35 mutations, 962 assertions.

### Notes
- Two things worth recording, both mistakes made while writing this:
  - **The `—` trap caught me again.** Three attempted Python splices of `app/index.html`
    matched zero times because the file stores em-dashes as escapes rather than literals. `CLAUDE.md`
    and the handoff both warn about this and both say to use the editor instead; that is what
    finally worked. The rule is in the repo because it keeps happening.
  - **One new assertion was wrong, not the code.** I asserted that flat rolls of 40 against 100 HP
    give a "Possible 2HKO". They cannot: with flat rolls the low and high roll are equal, so the
    verdict is always "Guaranteed" — 40 is correctly a Guaranteed 3HKO. "Possible" means the high
    roll gets there and the low roll does not, so it needs a *spread* of rolls, and the tests now
    use one. The failing assertion was the test's fault and is kept as a case because a reader who
    sees "Possible" is being told the outcome depends on the roll.

---

## [5.16] — 2026-08-03

### Fixed
- **"Pokémon with this typing" excluded every Mega.** Asking the Type Chart for **Fire/Dragon** in
  Regulation M-B returned **nothing at all**, when the answer is **Mega Charizard X** — a typing no
  base-form Charizard has. Steel/Fairy returned Mawile, Klefki and Tinkaton but not Mega Mawile.
  This is the third instance of the same shape as the Speed Tiers and Bulk rosters, and it now uses
  the same shared `calcRoster()`.

  **Two separate places were discarding formes, and fixing only one still returned an empty list:**

  1. `resolveDexIds()` dropped every id above 10000 *at the source*, with a comment explaining that
     formes "are not rows in this list". That was true when its only caller was the Pokédex grid,
     which lists species — but it meant the typing question could never be answered correctly no
     matter what the caller did. Dropping is now the caller's decision. The other caller feeds
     `applyFilters()`, which intersects against `master`, so a forme id it does not want is simply
     never matched.
  2. `renderDualMons()` then re-filtered with `id<=genMax`. `genMax` is the highest **base** dex
     number for the generation — 1025 for Gen IX — so that comparison rejects every forme on its
     own. It was also redundant: `calcRoster()` has already run `formAllowed()`, which applies
     `genMax` to the forme's *base species*, which is the question that was meant.

  I fixed (2) first, re-tested, and still got an empty list — the ids had already been thrown away
  by (1). Both are pinned by mutations **M30** and **M31**, because either one alone silently
  empties the list again.

- Formes in that list are labelled with `formDisplayName()` and sort with their base species, so
  Mega Mawile appears directly under Mawile rather than in a clump of unrelated Megas at the end.

### Added
- `tests/test-dual-typing.js` now covers the list it is named after. The engineering review found
  that suite tested dual-type *filtering of the dex* and never touched the typing list on the Type
  Chart tab — which is what most people mean by dual typing, and is exactly why a broken typing
  list survived a suite with that name.

---

## [5.15] — 2026-08-03

### Fixed
- **Formes that are not in the game were being listed.** Will: *"a lot of these Z megas aren't in
  the game yet."* Correct. `formAllowed()` asked only two questions — is the base species on the
  roster, and is this generation inside the forme's window — and both pass for things Champions does
  not have. Speed Tiers opened with **Mega Absol, Mega Garchomp and Mega Lucario in their Legends:
  Z-A forms** at 151 base Speed, and also listed **Ash-Greninja**, which is not a Mega and cannot be
  chosen when building a team at all.

  The rule that actually decides it was already in the app as `CHAMPIONS_ITEMS`:

  > **A Mega is usable exactly when its Mega Stone is legal in the regulation.**

  `absolite` is a legal Champions item. `absolitez` is not. That single difference is the whole
  distinction between the Mega Absol that exists and the one that does not, and it is *derivable*
  rather than a judgement call — Showdown records the link directly as `requiredItem`.
  `build/generate-form-gating.js` extracts it (133 formes with a required item, 39 battle-only) into
  `data/form-gating.json`, and `formAllowed()` now applies both.

  Roster 327 → **319**; Megas 77 → **73**. Verified in the browser: no `-mega-z` forme survives, no
  battle-only forme survives, and Mega Absol, Mega Garchomp, Mega Greninja, Mega Sceptile and Mega
  Alakazam all still do. Speed Tiers now tops out at Mega Aerodactyl and Mega Alakazam on 150 base
  Speed — which is what Pikalytics shows.

- **"Max Speed" was a misleading column name.** Will: *"why is the neutral plus scarf plus 32 faster
  than max speed."* Because it was never the maximum — it is the fastest that Pokémon gets **with no
  item**, and a Choice Scarf is ×1.5 against a nature's ×1.1, so a neutral-nature Scarf holder
  genuinely outruns a boosting-nature one holding nothing. The number was right and the label was
  not. Renamed **Max +Nat**, hint "32 SP and a speed-boosting nature, no item".

- **The type chart now fits on screen with no scrolling.** It fitted on the machine it was built on
  and was cut off two rows from the bottom on Will's, because a fixed 24px row height cannot know
  about display scaling: at 150% on a 1920×1200 screen the *logical* viewport is about 630px tall,
  and the chart wanted 694. `tcFit()` measures where the table starts, divides the remaining height
  by the number of rows and clamps to 15–24px, so it can only ever shrink and never inflates on a
  tall screen. It measures the real row pitch and corrects once rather than deriving it — hand-
  computing the border and spacing overhead was wrong by 2px a row, which is 38px over the table.
  Verified at 1280×630: all 18 rows visible, 10px to spare.

### Added
- Mutations **M28** (a Mega no longer needs a legal Stone) and **M29** (battle-only formes become
  selectable), both killed by `tests/test-form-names.js`. 29 mutations, 28 suites, 927 assertions.
- `tests/test-form-names.js` now states the corrected rule. Its Champions section previously
  asserted the *old* one — "a form is legal exactly when its base is" — which is precisely what this
  release disproves, so that assertion was inverted rather than deleted.

---

## [5.14] — 2026-08-03

### Fixed
- **The Bulk tab now includes Megas and alternate forms**, the same defect Speed Tiers had in 5.12
  and the same one-line cause: it filtered `CHAMPIONS_IDS`, which names species, not formes. It
  matters more here than the row count suggests, because a Mega's defences are usually nothing like
  its base species' — Venusaur is **80/83/100** and Mega Venusaur is **80/123/120**. A tool that
  recommends defensive spreads was silently missing the entries most likely to be built around.
  It now shares `calcRoster()` with the calculator and Speed Tiers, so all three agree on what is
  legal. 208 species plus 119 forms.

- **Adding the forms exposed a second bug that would have made the fix useless.** Bulk shows only
  the first 60 rows, and `calcRoster()` returns base species first because form ids start at 10001
  — so every single Mega sorted past the cut. The forms were in the roster and not one of them was
  reachable, which is a worse failure than omitting them, because the caption claimed they were
  there. Rows are now ordered by base species with a species' forms directly after it, so Mega
  Venusaur sits under Venusaur — which is where someone looking for it would expect it anyway.
  Verified in the browser: 16 Megas in the first 60 rows, against none before.

- Bulk labels forms with `formDisplayName()` like everywhere else, so the Gen VI and Z-A Megas of
  the same species stay distinguishable after 5.13.

### Added
- `tests/test-speed-tiers.js` covers `renderBulk` as well, and mutations **M26** (Bulk reverts to
  the species-only roster) and **M27** (the Z-A mega suffix loses its case, so two Pokémon share
  one name) join the committed set. 27 mutations, all killed.

### Changed
- **M24 was re-anchored.** Relabelling the speed columns in 5.13 left its anchor matching nothing,
  and `build/mutation-check.js` reported it as SKIP and failed the run rather than counting it as a
  pass — which is the behaviour that was designed in, working. It now mutates the neutral-nature
  Scarf column to be computed from the boosting figure instead, which is the mistake that column is
  most likely to attract.

---

## [5.13] — 2026-08-03

### Fixed
- **Two different Pokémon were sharing one name.** Will looked at the new Speed Tiers table and said
  he did not believe Scarf Garchomp was the fastest thing in the game. He was right to doubt it, and
  the numbers turned out to be correct — the **label** was wrong.

  `absol-mega` and `absol-mega-z` are different Pokémon: the Generation VI Mega and the
  **Legends: Z-A** Mega. Three species have both — Absol, Garchomp and Lucario, the ones whose Z-A
  stones are `absolite-z`, `garchompite-z` and `lucarionite-z`. `formDisplayName()` had cases for
  `-mega-x` and `-mega-y` but none for `-mega-z`, so both formes rendered as "Absol (Mega)". The
  table showed two rows with identical names and different numbers, which reads as a bug in the
  table.

  Mega Garchomp is a good example of why it mattered: the Gen VI one has **92** base Speed, *slower*
  than base Garchomp, while the Z-A one has **151**. Both were called "Garchomp (Mega)". They now
  read "Garchomp (Mega)" and "Garchomp (Mega Z-A)" — called Z-A rather than Z so it does not look
  like a third sibling of Mega X and Mega Y.

  Fixed in `formDisplayName()`, the single definition of a form's on-screen name, so the Pokédex,
  the ability page, the calculator and Speed Tiers were all corrected by the one change.

### Changed
- **Speed Tiers follows the Pikalytics column layout**, which is the page people actually use to
  answer "what outspeeds what", and which Will asked for by name. Columns now read outward from the
  raw stat: **Base · Max Speed · Neutral +32 · Neutral 0 · −Spe 0 · Max + Scarf · Neutral +32 + Scarf**.
- **Added the one column Pikalytics had and this table did not: a Choice Scarf holder with a
  NEUTRAL nature.** The only Scarf figure here previously assumed a speed-boosting nature, which
  overstates what most Scarf holders actually reach. Mega Aerodactyl now reads
  `150 / 222 / 202 / 170 / 153 / 333 / 303`, matching Pikalytics on all seven columns.
- `docs/STAT-FORMULA.md` regenerated from the shipped code by `build/generate-stat-formula.js`.

### Added
- `tests/test-form-names.js` gains the Z-A cases and, more importantly, an assertion that the Gen VI
  and Z-A megas of each affected species **do not share a display name**. That one catches the next
  collision too, whatever suffix causes it.
- `tests/test-stat-formula-doc.js` asserts the speed columns by **key rather than position**, so a
  future reordering does not read as a change to the arithmetic, and pins Mega Aerodactyl against
  the figures Pikalytics publishes — an independent source, where every other check in that suite
  compares the app to itself.

### Notes
- The Bulk tab still filters `CHAMPIONS_IDS` and so still omits every Mega. The same one-line change
  applies; it was left out of this pass because the naming defect above was the live problem.

---

## [5.12] — 2026-08-03

### Fixed
- **Speed Tiers was missing every Mega and every regional form.** Reported by Will from the live
  site. The table built its list with `master.filter(p => CHAMPIONS_IDS.has(p.id))`, and the
  Champions roster names **species, not formes** — every alternate form is a separate PokéAPI entry
  with an id above 10000, so none of them could ever match.

  For a speed table this is not a cosmetic omission, it is a wrong answer with the top cut off. The
  table showed **Dragapult at 319 as the fastest thing in Regulation M-B**. Measured after the fix:
  **Mega Absol, Mega Garchomp and Mega Lucario all reach 334**, and Mega Aerodactyl and Mega
  Alakazam 333. Anyone using it to work out what outspeeds what was reading a truncated list.

  208 rows become **327** — 208 species plus 119 Mega and alternate forms, covering Mega, Mega X/Y,
  Alolan, Galarian, Hisuian and Paldean. Verified in the browser.

- The fix reuses **`calcRoster()`**, the roster the Damage Calc already uses — base species plus
  every form `formAllowed()` permits — rather than building a second list. Two lists of what is
  legal is exactly the shape of defect the last two reviews kept finding, so Speed Tiers and the
  calculator now cannot disagree, and a Mega has to be declared legal in one place only.
- `ensureRosterLoaded()` takes an optional id list. It previously fetched only `CHAMPIONS_IDS`, so
  even once `calcRoster()` returned a Mega, nothing loaded its stats and the row would have been
  dropped for want of data.
- Forms are labelled with `formDisplayName()`, the single definition of a form's on-screen name, so
  a Mega reads "Alakazam (Mega)" here exactly as it does on the ability page and in the calculator.
- The caption reports the split — "208 Pokémon in this regulation plus 119 Mega and alternate
  forms" — rather than quietly changing the total.

### Added
- `tests/test-speed-tiers.js` (10 assertions) and mutation **M25**, which reverts the roster to the
  species-only filter and fails. The assertions are structural: `renderSpeedTiers` writes DOM and
  awaits network calls, so a behavioural harness for it is real work and is recorded as open rather
  than faked. They do catch the regression that actually happened.

### Notes
- **The Bulk tab has the identical defect** — same `master.filter(CHAMPIONS_IDS.has)` line, same
  missing Megas. It is not fixed here because it was not what was reported and because its
  recommendation is already under review (see the architecture review, finding F4). One line, the
  same fix, whenever wanted.

---

## [5.11] — 2026-08-03

### Notes
- **Engineering review.** Full findings in `docs/ENGINEERING-REVIEW-2026-08-03.md` (and `.pdf`).
  The architecture review of 5.9 proved that five of ten deliberate bugs walked through the suites,
  and 5.10 fixed those. This review asked the next question: of the 27 suites, how many have ever
  been proven to fail? **Nine.** The other eighteen were mutated one at a time. Two real holes fell
  out, both in code the suites appeared to cover.

### Fixed
- **Dual-type damage was never tested, and taking the maximum instead of the product survived every
  suite.** Replacing `effMult*=eff(...)` with `Math.max` in the shipped file left all 27 suites and
  the mutation check green. Fighting into Ice/Rock would have read 2× instead of 4×; Fire into
  Water/Dragon 0.5× instead of 0.25×. `test-dual-typing.js` does not cover this — despite the name
  it tests filtering the dex *by* dual type, never damage against one. The computation is now
  `calcLocalEffectiveness()` with eight assertions, and it was left in the DOM handler by 5.9's
  extraction for exactly the reason 5.9 recorded about STAB: moving the arithmetic somewhere
  testable is not finished until every decision it depends on comes too.
- **There were two hash readers, and only one was tested.** `restoreHash()` carried its own copy of
  the parser, including its own `'#'` strip, and it is the reader that restores the **tab**.
  Deleting that strip left all 27 suites green, the mutation check green — and in a real browser
  `#calc/gchampions/gm:reg-mb` opened on the Pokédex with the title unchanged. Every shared deep
  link would have landed on the wrong tab. There is now one `hashPath()`, and
  `test-hash-routing.js` fails if a caller re-implements it.
- **The hash-routing harness fed the parser input a browser never produces.** It assigned
  `location.hash` without the leading `#`, so the strip had no coverage at all. It now prefixes it
  the way a browser does, with `#`-carrying links asserted explicitly.
- **A failed PokéAPI call left a spinner running forever.** Blocking `pokeapi.co` and opening the
  Items tab produced "Loading held items…" indefinitely: `renderItemsTab` rejected, nothing caught
  it, and the reader saw a convincing lie that work was in progress. It now shows what failed, says
  the rest of the app still works, and offers a retry. Verified by blocking the host in the browser.

### Removed
- **Eleven functions that nothing called** — not from JavaScript, not from an inline handler.
  `onSearchChange`, `renderArrowDown`, `onTMInput`, `onTMKeydown`, `onAbilityTabSearch`,
  `onCompareSearch`, `itemSpriteUrl`, `getItemNamesForDatalist`, then `updateSuggestHighlight`,
  `showTMSuggestions` and `tmSwitchGenAndAdd`, which only the first eight referenced. Removed to a
  fixpoint, brace-matched rather than line-counted, 4.1 KB. For scale: that is 11 of 338 functions,
  so the file is dense rather than bloated.

### Changed
- **`build/mutation-check.js` grows from 11 mutations to 24**, covering **21 of 27 suites** against
  9 before. The thirteen new ones are the defects found while testing the untested suites: EVs
  landing on the wrong stat in the team editor and in paste import, Adamant raising the wrong stat,
  the bulk HP constant, a lost type, a broken form-name split, a dropped regulation item, a
  relabelled speed column, a weakened restatement threshold, and the two above.
  Six suites still have no proven-failing mutation and are named in the review.

---

## [5.10] — 2026-08-03

### Notes
- **Acting on the architecture review.** 5.9 recorded the findings; this closes them. The review
  itself is updated in the same pass, including a correction to one of its own findings.

### Fixed
- **The unattended publisher is dead.** `Projects\auto-publish.bat` ran `git add -A && git commit &&
  git push` across six repositories every ten minutes with no test run anywhere in it — whatever
  was in the working tree at the ten-minute mark became the live public site. It published a
  HoopaDex left as a syntax error, a completely blank page, with all 18 suites of the day still
  green, and during the 5.9 review it committed and pushed that review's own half-finished work
  twice, under Will's name, so the history cannot tell a decision from a timer firing.

  It is retired in four places, so it cannot come back: the running process is killed, the
  `CHOMP-autopublish.lnk` Startup shortcut is removed, and both `auto-publish.bat` and its installer
  `START-AUTO-PUBLISH.bat` now exit immediately with an explanation. The original script body is
  preserved beneath its new header, so the hard-won comments about the ten-minute interval and the
  90 MB guard survive.

  It existed because Claude Cowork would not push to GitHub itself, which made a timer the only
  route some sessions had to the live site. Will is no longer using Cowork, so the reason is gone
  and the script goes with it. An intermediate version of this change gated the timer instead of
  removing it; that gate is kept as `Projects\publish-gate.js`, which reports whether any repository
  is safe to publish (`node publish-gate.js <repo-dir>`) and is useful on its own. Verified: it
  passes all five repositories as they stand, and blocks a copy of this app with one brace removed.
- **`build/publish.sh`** for anyone who *can* push directly: parse check, suites, size guard, push,
  then verify the commit landed on origin and that Pages actually served the new version. Modelled
  on ABRA's publisher and the same "one repo, one publisher" rule.
- **The item-generation derivation was circular.** `build/generate-item-gens.js` took its list of
  items from the `ITEM_INTRO_GEN` table in the app — the table it exists to validate — so it could
  only ever re-derive what it already knew. The drift check compared 325 against 325 and passed
  while the app loaded **370** items at runtime; the 45 Legends Z-A mega stones PokéAPI has added
  since were invisible to both sides. The generator now enumerates from `HELD_ITEM_CATEGORIES`, the
  same source the app uses, so it can see the universe grow.

  PokéAPI has no `game_indices` for those 45, so they genuinely cannot be dated and are recorded as
  `unresolved` rather than guessed at. Writing them into the app as `undefined` was tried and
  reverted — absence is better than a placeholder. No reader-visible data changed: all 45 are mega
  stones, and `ITEM_CAT_GENS[44]` already pins that category to Generations VI, VII and IX.
- **`getItemIntroGen` no longer defaults silently.** An unknown item still resolves to Generation IX,
  which is correct for every item currently affected, but now warns once per item in the console.
  An item PokéAPI adds to an *older* category would otherwise vanish from every generation before
  IX with nothing said.

### Added
- **`build/mutation-check.js`, wired into CI.** Eleven deliberate defects, each naming the suite
  that must catch it; the run fails if any survives or if an anchor no longer matches. A mutation
  check performed once by hand decays into a claim about the past, which is exactly what the white
  paper's verification section had become.
- **`tests/test-vendor-pins.js` and `data/vendor-pins.json`.** `app/calc-engine.js` is a ~480 KB
  vendored build of `@smogon/calc` — the primary damage engine, the one whose numbers the reader
  actually sees — with no version, lockfile, upstream commit, checksum or test. It is now pinned by
  SHA-256, along with the 1.4 MB Champions learnset export, and the suite fails if either changes
  or if a new local script is added to `app/` unpinned. **Its version is still unknown**; the file
  carries no version string. A checksum pins the artefact, not its provenance, and the pin file says
  so. The tightest bound available is that it contains Ivy Cudgel and Hospitality, so it postdates
  the Teal Mask DLC of September 2023.
- **`tests/test-doc-versions.js`.** Each of the white paper, deck and technical documentation must
  carry a `HoopaDex vX.Y` stamp equal to line 2 of the app. This does not prove their contents are
  current — nothing automated can — but it makes the checkable part of the rule checked.
- All **27** suites now accept `HOOPADEX_SRC`, so any of them can be pointed at a mutated copy. The
  5.9 handoff claimed this was already true of every suite; nine of twenty-three did not have it.

### Changed
- White paper §5 rewritten and §5.2 added: it claimed every suite had been mutation-checked, which
  the review disproved. The deck's slide 12 carried the same claim and the same stale counts.
- **A correction to the 5.9 review.** It reported the white paper and deck as badly stale — the deck
  "at version 1.3 against an app at 5.9". That was measured by taking the highest version-like
  string in each file, which picked up each *document's own* revision number rather than the app
  version it describes. Both correctly said "HoopaDex v5.8", which was current when they were
  written. The finding was wrong, it is corrected in the review, and `test-doc-versions.js` now
  measures the right number. It is the same error the project keeps meeting: a figure that is easy
  to grep for is not the figure you wanted.

---

## [5.9] — 2026-08-03

### Notes
- **Architecture review.** Full findings in `docs/ARCHITECTURE-REVIEW-2026-08-03.md` (and `.pdf`).
  The method was mutation testing: break the shipped code on purpose, run all 23 suites, and see
  whether anything notices. Five of ten deliberate bugs passed the entire battery undetected. What
  follows is what that exposed.

### Fixed
- **The damage calculator had no numeric test.** Three separate corruptions of the shipped damage
  arithmetic — critical hits at 2.5×, STAB at 1.9×, and the spread-move reduction deleted outright
  — each left all 23 suites green. Nothing in the battery ever computed a damage number. The
  arithmetic is now a pure function (`calcLocalRolls`, `calcLocalStab`, `calcLocalCritMult`) with
  `tests/test-damage-formula.js`, 43 assertions whose expected values are worked by hand from the
  damage formula rather than read back out of the app. All three mutations now fail it.
- **Critical hits were generation-blind.** The local calculator multiplied by 1.5 in every
  generation. A critical hit was ×2 from Generation II through V and became ×1.5 in VI, so every
  pre-VI critical hit read 25% low — in a dex whose stated purpose is generation accuracy. Now
  `calcLocalCritMult(gen)`, and pinned in both directions.
- **A version 1.92 copy of the app was live.** `app/HoopaDex_1_92.html` was published at
  `/app/HoopaDex_1_92.html` and returned HTTP 200. It predated the historical base-stat fix (44
  species against today's 58, no Krookodile), the Gen I type chart fix and the item generation
  fix — a dex that was wrong in every way this project has spent versions correcting, and it looked
  exactly as authoritative as the real one. Removed from the published tree; git history keeps it.
  `tests/test-syntax.js` now fails if any page other than `index.html` appears in `app/`.
- **Two derived tables had no drift check.** `data/mega-abilities.json` and `data/regulations.json`
  were generated, committed, and then never compared to the app again. Changing Mega Barbaracle's
  ability to Levitate, and deleting Venusaur from the Regulation M-A roster, both passed all 23
  suites. New `tests/test-mega-abilities.js` compares every pairing against the Showdown-derived
  file; `tests/test-champions-roster.js` gains an anchor outside the app. Both now fail on those
  mutations.
- **The roster suite could only check the rosters against each other.** Every assertion in it was
  relational, so deleting an id shrank M-A and M-B together and `M-B == M-A + additions` still
  held. A uniformly wrong roster was undetectable.

### Changed
- **The Bulk tab states its model.** The tool maximises HP × (Def + SpD), which is the right
  objective when an opponent is entirely physical or entirely special with an even chance of each.
  It is *not* the right objective against an attacker that mixes both within one battle — that one
  maximises HP × Def × SpD / (Def + SpD). Measured across all 208 Pokémon of Regulation M-B at
  32 SP, cap 32, neutral nature, the two disagree for **135 of 208 (64.9%)**; Avalugg (95/184/46) is
  the worst case, where the shipped 32/0/0 survives 10.49% fewer mixed hits than 0/0/32. The
  recommendation is unchanged — which model to serve is a product decision, not a defect — but the
  tab now says which question it answers, and no longer claims a point of HP "is worth about twice
  what a single defence point is", which is the folk rule the tool exists to replace.
- `tests/test-syntax.js` also asserts that the version on line 2 matches the newest CHANGELOG
  entry. `check_projects.py` already does this, but it lives in another repository and currently
  exits non-zero because of an unrelated project, so in practice it is walked past.
- `tests/test-champions-roster.js` accepts `HOOPADEX_SRC`, which the handoff note claimed every
  suite already did. Nine of twenty-three did not.

### Removed
- **Two published figures, withdrawn as unreproducible.** `docs/BACKLOG.md` stated that at the
  exact bulk optimum, HP/(2×Def) averages 1.30 and ranges 0.43–5.50. Against the Regulation M-B
  roster the tool actually serves, it averages **0.919** and ranges **0.41–1.42**. Ten combinations
  of budget, cap and nature were swept; none produced a mean near 1.30 or a maximum above 1.52, and
  a maximum of 5.50 needs a Chansey- or Blissey-class stat line that is not in the roster. The
  companion figure HP/(Def+SpD) ≈ 0.90 *did* reproduce, at 0.890. The population behind the
  original numbers was never recorded, which is why they could not be checked. Every figure in that
  section now names its roster, budget, cap and nature.

---

## [5.8] — 2026-08-03

### Added
- **Item changes in the regulation diff — there was a data source after all.** 5.3 said item
  legality was "not tracked", which was true of the app and not of the world. Pokémon Showdown
  carries the two Champions regulations as **separate mods**: `data/mods/champions` is Regulation
  M-B, and `data/mods/championsregma` is M-A *inheriting from it*. Because it inherits, the M-A mod
  contains only the differences — every item it marks non-standard is one that is legal in M-B and
  was not legal in M-A. That file **is** the change list, so this needs no hand-maintained table.

  **31 items became legal in Regulation M-B; none were removed.** Twelve are the mega stones of
  species M-B added, which track the roster change. The rest are a real shift in the format:
  **Life Orb, Expert Belt, Muscle Band, Wise Glasses, Wide Lens, Zoom Lens, Metronome, Big Root,
  Shed Shell, Iron Ball, Light Clay** — and all four weather rocks, Damp, Heat, Icy and Smooth,
  arriving together.

### Notes
- **The absence is evidence too.** `championsregma` has no `moves.ts`, `abilities.ts` or
  `learnsets.ts` — nothing but items differs between the regulations. That independently confirms
  5.3's move diff, which reached the same conclusion from the app's own learnset export by a
  completely separate route. Two sources, one answer, no shared assumption.
- Display names come from Showdown's base `items.ts`. The mods inherit the name, so all they carry
  is the flattened key; a first attempt guessed the name back from the slug and produced
  "Raichunitex" where the base file simply says "Raichunite X". The guessing helper is gone.

---

## [5.7] — 2026-08-03

### Added
- **Attacking Type Calculator**, on the Type Chart tab directly beneath the defending one — they
  answer the two halves of the same question, which settles where it lives (the backlog's open
  question on item 13).

  Pick the types of your four moves. **The gap is stated first**, because that is the reason to open
  it: Fighting / Fire / Rock / Ground reports *"7 of 18 types are not hit super effectively"* and
  names them — Water, Fighting, Ground, Psychic, Ghost, Dragon, Fairy. The full breakdown follows,
  grouped by super effective, neutral, resisted and immune.

  Each defending type is scored by the **best** of your picks, not the sum: in a battle you use the
  move that works, so coverage is a maximum. Summing would make four bad moves look like one good
  one. Guarded by `tests/test-coverage.js`, which asserts that property directly — repeating a type
  changes nothing, and adding a type can only ever help.

  Generation-aware like everything else: in Gen I, Psychic is not walled by Ghost.

### Notes
- Two assertions in the new suite failed on first run and both were **my** error, not the app's — I
  had picked Fighting as a move that opens up Ghost, and Fighting cannot touch Ghost either. The
  test now covers both directions: Dark opens the wall, Fighting leaves it standing.

---

## [5.6] — 2026-08-03

### Fixed
- **Loading a set now runs all four of its moves, whichever way you load it.** The four-move view
  already existed — the Team Builder's Calc button has used it since 2.0 — but the team picker and
  the paste box added in 5.1 and 5.4 each ran only the first move. The same set therefore answered
  differently depending on how it was loaded, which is worse than either behaviour on its own.

  Cause: `calcLoadFromTeamSlot` had its own copy of the load logic rather than sharing one. That
  copy is gone; every route — the Calc button, the team picker and the paste box — now goes through
  `calcApplySet`, so there is one implementation and nothing left to drift.

  Blaziken's four moves against Tyranitar now come back ranked best first: Close Combat 226–266%,
  Flare Blitz 28–33%, Rock Slide 24–28%, with Protect correctly dropped as a status move.
- **Changing the defender re-runs all four moves** rather than falling back to the single-move view.

---

## [5.5] — 2026-08-03

### Fixed
- **The calculator's team picker did not say which team it was picking from.** It listed the working
  team's six Pokémon under "Load from my team", which is ambiguous the moment more than one team is
  saved — the names alone do not tell you which team you are looking at. It now lists **every** saved
  team, each under its own heading ("Current team (in the builder)", then each by name), and the
  banner names the source: *Tyranitar loaded as defender from "Sand Team"*. Reported by Will.
- **"How do I click calculate?"** — there is no calculate button, and nothing said so. The result
  panel sits below both columns, so on a laptop a finished calculation lands off the bottom of the
  screen and nothing visibly changes. Two fixes: the description now states outright that the result
  updates as you fill the fields, and the panel scrolls itself into view when it first appears —
  on that transition only, never on every recalculation, which would yank the page around while you
  are still typing.

  The calculation itself was working the whole time. This was entirely a matter of the answer being
  somewhere you could not see.

---

## [5.4] — 2026-08-03

### Fixed
- **The calculator applied natures without knowing which stat they affected.** Introduced in 5.1
  and found by pasting a real set in and reading the field. A nature raises one stat and lowers
  another, so its effect depends on *which* stat the calculation uses — and that follows from the
  move's damage class, not from the side. The 5.1 version asked only "does this nature touch either
  offensive stat", so a **Jolly physical attacker came out at 0.9**: Jolly lowers Special Attack,
  which has nothing to do with Close Combat. It understated that attacker's damage by 10% and looked
  entirely plausible.

  The mirror error was on the defending side — a Careful defender was boosted against physical hits,
  where Special Defence does nothing.

  The multiplier is now derived from the move's category and re-derived whenever the move changes.
  A pasted set also loads its moves' data first, because with the category unknown the calculation
  quietly fell back to a neutral guess — which is precisely why the physical case looked right and
  the special case did not.

### Added
- **Paste a Showdown set straight into either side of the calculator.** No detour through the Team
  Builder. The parser already existed and the apply step already existed; this joins them, so a
  pasted set and a saved set cannot resolve differently — both now go through one `calcApplySet`.
  Species resolution reuses the exact-match-only path, which reports a miss rather than substituting
  a similar Pokémon, and a set that is not legal in the current selection is refused with a reason.
  For the attacker the four moves in the set become the move list, since the point of pasting a set
  is to ask what *that* set does.

---

## [5.3] — 2026-08-03

### Added
- **Regulation Changes now reports moves and items, not just the roster.** Reported as "still rough
  — where are the items and move changes".

  **The answer for moves turned out to be "none", and that is worth saying out loud.** Every one of
  the 186 Pokémon present in both M-A and M-B learns exactly the same moves. The 1,376 extra move
  entries in M-B all belong to the 22 newly added species, which the roster rows already list. The
  page now states that instead of staying silent — silence read as an unfinished page when it was
  actually a complete answer.

  Derived from the same learnset export the Pokédex filters by, so it cannot drift. Species present
  in only one regulation are excluded on purpose: listing a new arrival's entire movepool as
  "gained" would restate the roster change as though it were a second, much larger one.

- **Items say plainly that they are not tracked.** Nothing in the app records item legality per
  regulation, so the page says so rather than leaving a gap that reads as an oversight. Making that
  real needs a source — it is not derivable from anything bundled.

---

## [5.2] — 2026-08-03

### Fixed
- **Generation I had one Special stat, and the app showed two.** Gen I used a single Special for
  both attacking and defending; Gen II split it. Charizard in Gen I now reads five stats —
  HP 78 / Atk 84 / Def 78 / **Special 85** / Spe 100, for a base total of 425 — instead of a Gen II+
  stat line it never had.

  **The obvious shortcut is wrong.** "Show the modern Special Attack" fails for **46 of the 151**
  species, because the split frequently kept the old Special as the new Special *Defence* and raised
  Special Attack. Charizard's Gen I Special was 85 against a modern SpA of 109; Chansey's was 105
  against 35. Neither modern stat is reliably the Gen I value, so the table is generated by
  `build/generate-gen1-special.js` from Showdown's gen1 mod, where `spa === spd` encodes the single
  stat — an equality the generator asserts rather than assumes.

  Both halves are set to the Gen I value internally, so the calculator, comparison and type panel
  need no special case; only the visible stat list collapses the pair.

### Added
- **Sprites match the selected generation.** Choosing Gen I and being handed modern artwork is the
  same class of wrongness as showing modern base stats there. Generations I–VII use their own
  sprites; VIII and IX fall through to the current one deliberately — both are large 3D renders that
  look broken beside pixel sprites, and for IX the default sprite already *is* the Scarlet/Violet
  one. The `icons/` sets published for VII and VIII are never used: those are 68×56 menu icons, not
  box sprites.

  Applied everywhere sprites are built, including alternate forms, which have period sprites too. A
  sprite that does not exist for a given game falls back to the modern one through a single
  capture-phase listener rather than an `onerror` on every image.

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
