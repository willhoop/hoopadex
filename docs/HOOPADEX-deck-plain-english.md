# HoopaDex — the deck

### A Pokédex that knows what year it is

**Version 1.1 · Last updated 2026-08-03 · HoopaDex v2.9.3**
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

## Slide 12 — What we don't claim

Ten test suites and 252 assertions now cover the historical data, and each one has been checked
by deliberately breaking the code to confirm the test goes red. Three tests were found to be
passing without testing anything, and fixed.

**But nothing tests what the app looks like.** Layout, light mode and phones are unverified — and
that has already cost us: a type chart that passed every colour and contrast measurement was
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
