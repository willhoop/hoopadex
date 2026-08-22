# HoopaDex — the deck

### A Pokédex that knows what year it is

**Version 2.1 · Last updated 2026-08-21 · HoopaDex v5.41**
**Will Hooper**

> Plain words only. The math and the citations live in the
> [white paper](HOOPADEX-whitepaper.md).

---

## Slide 1 — What this is

**A complete Pokémon reference in one file that you can open from your desktop.**

No install. No server. No account. One HTML file, about half a megabyte, that works offline
once it has loaded.

---

## Slide 2 — The problem it solves

Every other dex assumes you are playing the newest game.

You are often not. And the rules have changed a lot.

---

## Slide 3 — What actually changed

Three examples, all real:

| Then | Now |
|---|---|
| Dark attacks were **weak** against Steel | They do normal damage |
| Ghost attacks were **weak** against Steel | They do normal damage |
| Fairy **did not exist** | Fairy exists |

---

## Slide 4 — Why that matters

You are playing an old game. You look up "is my Dark move good against this Steel type?"

A normal dex says **yes**.

In the game in front of you, the answer is **no**.

**You were not given a slightly old answer. You were given a wrong one — and nothing told you
to doubt it.**

---

## Slide 5 — The fix

You pick the generation. Everything on the screen re-answers itself for that generation.

Type chart, stats, abilities, evolutions. All of it.

And the generation you picked stays visible on screen, so you always know which set of rules
you are being shown.

---

## Slide 6 — Champions mode

Pokémon Champions plays by different rules, so it gets its own mode.

**Stats work differently.** Instead of the old system, every Pokémon gets 66 points to spread
across its stats, up to 32 in any one. Level is always 50.

**Moves work differently.** There is no learning by level and there are no TMs. A Pokémon can
learn a move or it can't. If it can, you just teach it.

---

## Slide 7 — A surprise worth knowing

The Champions move list is **not** the Scarlet and Violet list.

Real example: **Garchomp learns Surf in Champions. It does not learn Waterfall.**

If you assume the lists match, you will build illegal sets. The dex checks the real list.

---

## Slide 8 — The damage calculator

Champions mode has a built-in damage calculator.

It runs on the same engine the competitive community already uses, so the numbers are the
numbers everyone else gets. The only new part is the Champions stat system layered on top.

---

## Slide 9 — Finding the Pokémon you actually mean

Most dex search is one box, one word, one match.

Here you stack criteria. Type **dark**, press Enter. Type **prankster**, press Enter. Type **rain
dance**, press Enter. Three filters, combined: four Pokémon come back — Murkrow, Sableye, Purrloin
and Liepard.

It works in a static web page with no server because each criterion costs exactly one request —
the API will tell you every Dark type, every Prankster user, and everything that learns Rain Dance,
and the answer is the overlap. Loading all 1,025 Pokémon to filter them locally is what makes this
feel impossible elsewhere.

Teams speak Showdown's format, so a team built here pastes straight into Showdown, Pokepaste or
their calculator — and back again, unchanged.

---

## Slide 9a — Asking the type chart a question instead of reading it

An 18×18 grid is a lookup table. Reading a ×4 off it means finding two cells and multiplying them
in your head.

The Defending Type Calculator asks it directly: pick a defending typing and every attacking type is
resolved against it at once, ×4 first. As of v3.8 it also answers the other half of the question —
who actually has that typing. Fire/Flying in Generation IX: Charizard, Moltres, Ho-Oh, Fletchinder,
Talonflame, Oricorio-Baile.

Only for two types. One type returns hundreds of species, which is a list nobody reads.

And it knows what year it is, like everything else here. Ask for Electric/Steel in Generation I and
you get nothing — Steel did not exist yet, and Magnemite was a pure Electric type until Generation
II. That answer cannot come from asking what Magnemite is today, which is exactly why the list is
re-checked against the historical record rather than trusted as fetched.

---

## Slide 10 — The bug that turned out to be a pattern

Someone noticed Krookodile's Defence looked wrong. It showed 80 for a Generation V game; it was
70 back then.

One entry missing from a table. Except the table was checked properly afterwards, against
published game data — and **only 10 of its 43 entries were right.** Ten species had their
Generation VII change filed one generation too early. Eleven listed numbers that were never real
in any generation. Forty-one changes were missing altogether.

Nobody had noticed, because there is nothing to notice. A wrong stat renders exactly like a right
one.

---

## Slide 11 — So the tables stopped being written by hand

The fix was not to correct 43 entries. It was to stop typing them.

Base stats and historical typing are now **generated** from published per-generation game data.
Move tags come from the same damage engine the calculator runs on. The regulation-change article
is computed from the roster the dex itself filters by.

The rule: **if it can be derived from something published, derive it.** A table you maintain by
hand is wrong the day the world changes and stays wrong. A table you generate is only ever as
stale as the last time you ran it.

---

## Slide 11a — The same problem, hiding in the sentences

Numbers are easy to distrust. Sentences are not, so this one lasted longer.

Every ability in the dex was described by a single line of text with **no year attached to it**.
Scrappy's has read "lets Normal and Fighting moves hit Ghosts" since 2006. Since Generation VIII it
also ignores Intimidate. The dex never said so — in any generation.

The game itself does say so. It carries a different description for each set of games, and the dex
was throwing all but one of them away. It now shows the wording from the games you selected: pick
Scarlet and Violet, you get the Intimidate line. Pick Ultra Sun, you don't — because back then it
was not true.

**And a whole kind of fact was simply missing.** Mega Launcher boosts "pulse moves". Which moves are
those? The dex had no answer. Nothing on Aura Sphere mentioned Mega Launcher either. You could only
find that out if you already knew it.

Those seven moves were never a mystery — the games group them under a tag, and the ability's own
code checks that tag. So the dex now reads it: **Boosts pulse moves ×1.5 — Aura Sphere, Dark Pulse,
Dragon Pulse, Heal Pulse, Origin Pulse, Terrain Pulse, Water Pulse.** Same for punching, biting,
slicing, sound, wind, powder and contact. 36 abilities, 6 items, 441 moves.

One thing worth saying out loud: where the game's description and the game's *behaviour* disagree,
both are shown rather than one picked. The Intimidate resistance started working in Generation VIII.
The description did not mention it until Generation IX. That gap is real, and pretending either
date is the whole answer would be tidier and worse.

---

## Slide 11b — And sometimes the good source is the wrong source

Nature Power turns into a different move depending on where you're standing. In a Gen III cave it's
Shadow Ball. Same cave in Gen V, it's Rock Slide. From Gen VI it's Power Gem. The dex used to say
"uses a move which depends upon the terrain" and leave you there.

The obvious place to look it up was the battle simulator every other table here comes from. It has
the answer — except it doesn't. A simulator has no overworld. There's no cave for it to be standing
in, so it just picks one move per generation and moves on.

That would have sailed through every check we have. Generated, not typed. Reproducible. Checked
against its source. And a nine-row table shown as one row, wearing the credentials of a good source.

**A source being trustworthy isn't the same as a source being about your question.** No amount of
tooling catches that. Somebody has to read it.

So this one table comes from Bulbapedia instead — and the part the simulator *does* get right (the
four terrain moves) is checked against it, with the build failing if they disagree. One source where
one is all there is; two where two exist.

---

## Slide 11c — Two screens, one question, two answers

The list of abilities said Aura Break was on **1 Pokémon**. Clicking it said **0**. One click apart.

The page was right. Working out who has an ability means asking several questions — did this Pokémon
have it *back then*, is it even in the game you've selected, did this form exist yet, was this a
hidden ability before hidden abilities existed. The page asked all of them. The list asked one: *is
this Pokémon's number low enough?* In Champions that counted Zygarde, and Zygarde isn't in Champions.

It wasn't one row. In Champions, 97 abilities advertised Pokémon they didn't have and another 170
had the wrong number — 267 of 373 rows. In Gen IX the mistake ran the other way: the quick version
can't see alternate forms, so it counted *too few*.

Here's the uncomfortable part. Every one of those wrong numbers looked exactly like a right number.
No glitch, no blank, no error — just a plausible integer beside an ability name. The only way to
catch it is to hold both screens in your head at once, and nobody does that. The person who found it
happened to click through at the right moment.

Why did it happen? Because the correct way is a function call with four arguments, and the wrong way
is one line. If you just want a number for a card, the one-liner works — in the sense that a number
appears.

So the fix isn't really "make the number right". It's that there's now **one** piece of code that
answers "who has this ability", and both screens call it. And the test doesn't check that Levitate
says 47 — that would pass again the day someone adds a third way to count. It checks that the
shortcut *isn't in the file*.

**When two parts of a program answer the same question separately they will eventually disagree —
and the cheaper one is the one that looks fine.**

---

## Slide 12 — What we don't claim

Thirty-four test suites and 1,222 assertions now cover the data, the damage formula, the derived
mechanics, and the files we did not write ourselves.

**That number used to be the wrong thing to be proud of.** This slide previously said every test
had been checked by deliberately breaking the code. In August 2026 someone actually did that,
properly, to all of them — and **five out of ten deliberate bugs walked straight through the whole
suite**. Three were in the damage calculator, which had no test that worked out a damage number.
It only checked that a function with the right name existed.

The pattern was worth more than the bugs. Every table we *generate* from published data was
defended, because we compare the two on every run. Every table we *typed* was defended only by
whichever handful of entries someone remembered to check — for historical stats, 8 out of 58.

All ten now fail the way they should, plus an eleventh. The bugs are kept in the repository and
re-run automatically, because a check done once by hand quietly turns into a story about the past.

**And nothing still tests what the app looks like.** Layout, light mode and phones are unverified —
and that has already cost us: a type chart that passed every colour and contrast measurement was
genuinely unpleasant to read, and only a human looking at it caught that.

That is now the biggest gap, it is written down in the white paper, and it is the next thing to
fix.

---


## Slide 13 — Read more

**The white paper** — the data model, the stat formulas, every source:

**[HOOPADEX-whitepaper.md](HOOPADEX-whitepaper.md)**

**The technical documentation** — how to run it, change it, and add a regulation:

**[HOOPADEX-technical-docs.md](HOOPADEX-technical-docs.md)**

**The changelog** — what changed, when, and why:

**[CHANGELOG.md](../CHANGELOG.md)**
