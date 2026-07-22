# HoopaDex — the deck

### A Pokédex that knows what year it is

**Version 1.0 · Last updated 2026-07-22**
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

## Slide 9 — A bug we found and fixed

The dex opens in Champions mode on the newest regulation. It always did.

But every link it *generated* was broken. Sharing or bookmarking a page quietly kicked you
back into the wrong mode.

Cause: the link recorded "generation 9", and the reader treated "generation 9" as *leave
Champions mode*. Fixed in v1.93, and old broken links now work correctly.

---

## Slide 10 — What we don't claim

The whole point of this project is historical accuracy. So this matters:

**The historical tables have not been automatically tested.** They were typed in and checked
by eye. Nine tests exist, but they only cover links and defaults, not whether the generation 2
type chart is right.

That is the biggest gap in the project, it is written down in the white paper, and it is the
next thing to fix.

---

## Slide 11 — Read more

**The white paper** — the data model, the stat formulas, every source:

**[HOOPADEX-whitepaper.md](HOOPADEX-whitepaper.md)**

**The technical documentation** — how to run it, change it, and add a regulation:

**[HOOPADEX-technical-docs.md](HOOPADEX-technical-docs.md)**

**The changelog** — what changed, when, and why:

**[CHANGELOG.md](../CHANGELOG.md)**
