# HOOPADEX — HANDOFF

REPO   `C:\Users\willj\Projects\Pokemon\HoopaDex`  (willhoop/hoopadex)
LIVE   https://willhoop.github.io/hoopadex/app/
STATE  v5.10, tree clean, local == origin/main, 27 suites / 871 assertions green,
       11 of 11 mutations caught (`node build/mutation-check.js`, also in CI).
ARCH   `app/index.html` (~633 KB) plus two siblings it loads: `calc-engine.js` (vendored
       `@smogon/calc`) and `champions-learnsets.json`. No build step. It also pulls a webfont
       from Google, so it is not fully offline. This line used to read "one HTML file, no
       dependencies", which was not true.

> **Superseded in parts — read `ARCHITECTURE-REVIEW-2026-08-03.md` alongside this.**
> This file is kept as the record of the session that produced v5.8. The review that followed
> tested its claims, and three did not survive:
>
> - *"Every suite accepts a `HOOPADEX_SRC` env override."* Nine of twenty-three did not. All 27
>   do now.
> - *"An auto-commit hook commits AND PUSHES the working tree every few minutes."* The behaviour
>   was real but it was not a hook — `.git/hooks/` was empty. It was `Projects\auto-publish.bat`
>   on a Startup shortcut, and looking for a hook wasted time. **That script is now dead**, and
>   publishing goes through `build/publish.sh`, which runs the suites and refuses on red.
> - The bulk figures below (HP/(2×Def) averaging 1.30, ranging 0.43–5.50) could not be reproduced
>   and are withdrawn. See section 4 of the review.
>
> The central lesson below — that the real bugs were found by opening the page, not by testing —
> still stands, and the review adds a second: a green suite proves the code has not changed, not
> that it is right. Five of ten deliberate bugs passed all 23 suites.

READ FIRST: `CLAUDE.md` in the repo root. Non-negotiable rules:
  - Bump the version comment on line 2 of `app/index.html` on EVERY edit.
  - CHANGELOG.md entry in the same pass; top version must match line 2.
  - Update whitepaper / deck / technical docs in the same pass.
  - Push to main and confirm the live site. Standing authorization, no need to ask.
  - Run: `for f in tests/test-*.js; do node "$f"; done` — all must pass.
  - Run: `python C:\Users\willj\Projects\portfolio\build\check_projects.py` before publishing.

---

## THE ONE THING TO UNDERSTAND

**Almost every real bug this session was found by looking at the running app, not by testing.**
The dead page, Speed Tiers silently missing 148 of 208 Pokémon, the sort arrows rendering as the
literal text "95", the green tooltip, the bulk calculator optimising the wrong objective, the broken
move chooser, "how do I click calculate" (the answer was rendering off-screen). Not one of those was
caught by a suite.

The suites are good at *locking down* a thing once it is understood, and useless at telling you that
you built the wrong thing. Budget time for opening the page. Will's screenshots caught more than any
measurement did.

**Corollary: I was confidently wrong three times.** Twice I declared data "not derivable" when it was
(Z-A mega abilities; regulation item legality — both were in Showdown all along). Once I brute-forced
a wrong question rigorously and shipped the wrong answer (bulk). Check the premise before checking
the arithmetic.

---

## TRAPS — every one of these cost real time

- **NEVER let two sessions edit `app/index.html`.** An auto-commit hook commits AND PUSHES the
  working tree every few minutes. Check `git log` — your commit may not be the one that landed. It
  repeatedly beat me to a commit and my message was lost while the content shipped fine.
- **Python string-splicing this file fails silently.** The file stores `×` as `\u00D7`, an ESCAPE,
  not a literal. A non-raw Python string turns `\2195` into a control character — that is exactly
  how the sort arrows became the literal text "95" for eight versions. ALWAYS assert match counts
  before writing, and assert the diff is proportionate.
- **Shell heredocs mangle escaping.** Several splices silently matched zero times, or worse, wrote
  `switchTab('pokedex')` where `switchTab(\'pokedex\')` was needed and left the entire app a syntax
  error — a blank page, with all 18 suites still green. Prefer the Edit tool for anything with
  nested quotes. `tests/test-syntax.js` now catches this specific catastrophe; it is the only suite
  that does.
- **Tests slice real functions out of `index.html`.** That is good, but a test that *re-implements*
  the logic instead of exercising it passes against broken code. It happened twice this session.
  Mutate the source and confirm the suite goes RED, or it proves nothing. Every suite accepts a
  `HOOPADEX_SRC` env override so you can point it at a mutated copy and never break the working tree.
- **The hash-router range that `test-hash-routing.js` slices ends at `applyFilters()`.** Don't put
  unrelated code inside it.
- **Watch for two copies of one decision.** Three separate bugs this session were the same shape:
  the ability page was the only place that knew about alternate forms; the move sort's reader and
  writer disagreed about attributes; `calcLoadFromTeamSlot` had its own copy of the set-loading
  logic and was the only path that ran all four moves. When you find a second implementation,
  delete it rather than fixing it twice.

---

## THE PRINCIPLE THAT DRIVES THE PROJECT

**If a value can be derived from a published artefact, derive it.** Hand-maintained tables are
wrong, and a wrong number renders exactly like a right one.

Track record, all found by auditing rather than by anyone noticing:

| Table | Result |
|---|---|
| `PAST_STATS` | 10 of 43 entries correct (fixed 1.96) |
| Gen I type chart | wrong (1.97) |
| Pokémon typing | absent entirely (1.98) |
| `ITEM_INTRO_GEN` | **67 of 325 wrong — 20.6%** (5.5) |
| `CHAMP_MEGA_ABILITIES` | covered 23 of 41 megas (4.0) |
| `CM` / `C2` / `C1` type charts | **838 cells, all correct** — the only clean audit |

Generators in `build/`, derived data committed in `data/`:
- `generate-regulations.js` — regulation diff + `docs/REGULATIONS.md`
- `generate-mega-abilities.js` — Z-A mega abilities from Showdown
- `generate-item-gens.js` — item introduction generations from PokéAPI
- `generate-gen1-special.js` — the Gen I Special stat from Showdown's gen1 mod
- `generate-stat-formula.js` — `docs/STAT-FORMULA.md`, every figure computed by the shipped code
- `generate-regulation-items.js` — per-regulation item legality
- `audit-champions-roster.js`

**Showdown is the workhorse.** `smogon/pokemon-showdown` carries per-generation mods AND — the find
of the session — the Champions regulations as separate mods: `data/mods/champions` (Reg M-B) and
`data/mods/championsregma` (Reg M-A, inheriting from it, so its files contain only the differences).
Check there before concluding something is not derivable. I concluded that twice and was wrong both
times.

**The one deliberate exception** is `WEATHER_ABILITY_TEXT` (4 entries). PokéAPI has one description
with no generation dimension and Showdown's wording is duration-neutral, so neither can supply it.
It has its own suite. Do not add hand-maintained tables without that standard of justification.

---

## OPEN WORK (`docs/BACKLOG.md` has the detail)

**Blocked on Will — do not guess:**
1. **Nuzlocke tracker** — needs the default ruleset, whether it persists or exports, per-game or one
   run at a time.
2. **ROM save upload** — needs which formats. Largely superseded by paste import.
3. **Dungeon labels** — no string matching `dungeon` exists anywhere in the file. Needs one actual
   wrong label or a screenshot; minutes of work once supplied.
26. **Patch-notes link** per regulation transition — needs the URLs.

**Real work, unblocked:**
4. **Regional dex filter toggle** — national vs the selected game's regional numbering. PokéAPI
   serves it, so it is derivable.
26. **Move-class articles** — writing, not code. The items and moves halves of item 26 are done.

---

## NEEDS WILL'S EYES — measured, never seen

Screenshots did not composite for me at any point. These are correct by measurement and unverified
by a human:
- **Light-mode type chart** (3.8). Saturation raised from 33%/32% to 64%/60%; the neutral cell had
  no light-mode override at all and was white-on-white.
- **Hidden-ability pill** (3.8). Third attempt at a solid colour; the first two were rejected.
- **Period-accurate sprites** (5.2). Every picture in the dex changes for Gens I–VII.

---

## VERIFICATION

`preview_start {name:"hoopadex-alt"}` — config in `C:\Users\willj\Downloads\.claude\launch.json`,
serves port 8766. Port 8765 is the original entry and is often held by another session; the alt
entry exists to avoid fighting for it.

Then read computed styles and DOM via `javascript_tool`. **Do not trust a visual claim you have not
measured**, and say plainly when something is unverified by eye.

Useful check before any commit:
```
node -e "const s=require('fs').readFileSync('app/index.html','utf8');[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].forEach(m=>{try{new Function(m[1]);console.log('OK')}catch(e){console.log('SYNTAX ERROR: '+e.message)}})"
```

---

## RECENT SHAPE OF THE APP

- **Type Chart tab** holds two mirrored tools: **Defending Type Calculator** (pick a typing, see
  every attacking type resolved, plus which Pokémon have it) and **Attacking Type Calculator**
  (pick your move types, see the coverage gap first).
- **Other tab**: Move Priority, Phys/Spec Split, Regulation Changes (Champions only), Speed Tiers,
  Bulk.
- **Damage Calc**: both sides load from any saved team or a pasted Showdown set, all four moves run
  at once, ranked best first. There is no calculate button — it updates as you type.
- **Alternate forms** (megas, regionals, Gigantamax) work across the ability page, Team Builder
  search and the calculator, gated by one shared `formAllowed()`.
- **Champions has no TMs.** Each Pokémon has a moveset taught with VP. The TM list is hidden in
  Champions mode. **Open question recorded, not fixed:** the Champions learnset export still tags
  some entries with a `TM` method, which drives a "(TM)" badge. If Champions has no TMs that flag is
  an artefact of how the export was generated and belongs fixed in CHOMP at the source.

## THE BULK FINDING, BECAUSE IT IS EASY TO GET WRONG AGAIN

Damage taken scales with HP × defence. A point of HP multiplies **both** defences; a point of Defence
only helps against physical. So the target is:

> **HP = Def + SpD** — not "HP = 2 × Def"

Those are the same statement when the two defences are close, which is why the folk rule survives.
It fails on lopsided defenders: Skarmory at 140/70 wants HP near 210, not 280. Measured at the exact
optimum, HP/(Def+SpD) averages 0.90; HP/(2×Def) averages 1.30 and ranges 0.43–5.50.

The Bulk tab searches all ≤33 splits exactly rather than applying any rule. v4.2 shipped the wrong
advice — everything into the defence — because it optimised HP × Def *in isolation*, which was
rigorous about the wrong question.
