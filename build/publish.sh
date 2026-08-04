#!/usr/bin/env bash
# publish.sh — the ONE publisher for HoopaDex. Runs the tests, pushes, and verifies it landed.
#
# WHY THIS EXISTS
# ---------------
# Until 2026-08-03 HoopaDex was published by C:\Users\willj\Projects\auto-publish.bat, a hidden
# background loop that ran `git add -A && git commit && git push` every ten minutes across six
# repositories with NO test run anywhere in it. Whatever was in the working tree at the ten-minute
# mark became the live public site.
#
# The architecture review of 2026-08-03 watched it commit and push that review's own half-finished
# work twice, under Will's name, while the review was being written. It is also how a previous
# session's blank page — the app left as a syntax error by a mangled shell heredoc, with all 18
# suites still green — reached the live site.
#
# ABRA hit the same thing harder and was removed from the watcher on 2026-07-25 after two
# publishers on one repo produced 312 failed pushes, a wedged rebase, 250 duplicated store lines
# and 90 minutes of dead Pages builds. Its build/publish.sh is the model for this one. The rule
# that came out of it is "one repo, one publisher", and HoopaDex now follows it.
#
# WHAT IT GUARANTEES
#   1. It never pushes a red test suite. This is the whole point.
#   2. It never pushes an app that does not parse — a blank page is the worst failure this app has.
#   3. It never creates a commit GitHub will reject (size guard before staging).
#   4. It VERIFIES the push landed on origin and that Pages served the new version.
#
#   bash build/publish.sh                  test, commit, push, verify
#   bash build/publish.sh --check          report what would happen, change nothing
#   bash build/publish.sh -m "message"     use a real commit message
set -uo pipefail
cd "$(dirname "$0")/.."

PAGES_URL="https://willhoop.github.io/hoopadex/app/index.html"
MAXBYTES=$((90 * 1024 * 1024))
CHECK=0; MSG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --check) CHECK=1 ;;
    -m) shift; MSG="${1:-}" ;;
    *) echo "unknown argument: $1"; exit 2 ;;
  esac
  shift
done

say() { printf '%s\n' "$*"; }
fail() { printf 'REFUSED: %s\n' "$*" >&2; exit 1; }

# --- 1. the app must parse ------------------------------------------------------------------
# Checked before the suites because a syntax error can leave every suite green while the page is
# blank: the suites slice text out of the file, and text still slices fine when it cannot run.
say "== checking app/index.html parses =="
node -e '
const s = require("fs").readFileSync("app/index.html", "utf8");
const blocks = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (!blocks.length) { console.error("no inline script found"); process.exit(1); }
let bad = 0;
for (const m of blocks) { try { new Function(m[1]); } catch (e) { console.error("SYNTAX ERROR: " + e.message); bad = 1; } }
process.exit(bad);
' || fail "app/index.html does not parse — this is the blank-page failure, do not publish it"
say "   parses"

# --- 2. the suites must pass ----------------------------------------------------------------
say "== running the test suites =="
red=0; suites=0
for f in tests/test-*.js; do
  [ -e "$f" ] || continue
  suites=$((suites + 1))
  if ! out=$(node "$f" 2>&1); then
    red=$((red + 1))
    printf '   FAIL %s\n' "$f"
    printf '%s\n' "$out" | grep -E '^FAIL' | head -3 | sed 's/^/        /'
  fi
done
[ "$suites" -gt 0 ] || fail "no suites found — refusing to publish an unverified tree"
[ "$red" -eq 0 ] || fail "$red of $suites suites are red"
say "   $suites suites green"

# --- 3. nothing GitHub will reject -----------------------------------------------------------
say "== size guard =="
toobig=""
while IFS= read -r line; do
  rel="${line:3}"
  rel="${rel%\"}"; rel="${rel#\"}"
  [ -f "$rel" ] || continue
  sz=$(wc -c < "$rel" 2>/dev/null || echo 0)
  [ "$sz" -gt "$MAXBYTES" ] && toobig="$rel ($sz bytes)"
done < <(git status --porcelain --untracked-files=all)
[ -z "$toobig" ] || fail "$toobig is over 90MB — add it to .gitignore. A commit that cannot be pushed wedges the branch."
say "   nothing oversized"

# --- 4. commit and push ----------------------------------------------------------------------
VER=$(sed -n '2p' app/index.html | grep -oE 'VERSION: [0-9.]+' | cut -d' ' -f2)
if git diff --quiet && git diff --cached --quiet && [ -z "$(git status --porcelain --untracked-files=all)" ]; then
  say "== nothing to commit; will still verify the live site =="
else
  if [ "$CHECK" -eq 1 ]; then
    say "== --check: would commit and push the following =="
    git status --short
    exit 0
  fi
  say "== committing =="
  git add -A
  git commit -q -m "${MSG:-publish: HoopaDex $VER}" || fail "commit failed"
fi

if [ "$CHECK" -eq 1 ]; then say "== --check: would push =="; exit 0; fi

say "== pushing =="
git push -q origin main || fail "push failed"

# --- tag the release ---------------------------------------------------------------------------
# There was no rollback story at all: zero tags, and GitHub Pages serves whatever is on main, so
# going back meant finding a commit by hand. The version on line 2 is already the release identity
# and the tests above have just passed against it, so this is the honest moment to name it.
# Idempotent: re-publishing the same version leaves the existing tag alone rather than moving it,
# because a tag that moves is worse than no tag.
if git rev-parse -q --verify "refs/tags/v$VER" >/dev/null; then
  say "   tag v$VER already exists, leaving it where it is"
else
  git tag -a "v$VER" -m "HoopaDex $VER" && git push -q origin "v$VER" \
    && say "   tagged v$VER" || say "   WARNING: could not tag v$VER (the push itself succeeded)"
fi

# --- 5. verify it actually landed -------------------------------------------------------------
local_head=$(git rev-parse HEAD)
remote_head=$(git ls-remote origin main 2>/dev/null | cut -f1)
[ "$local_head" = "$remote_head" ] || fail "push reported success but origin/main is $remote_head, not $local_head"
say "   origin/main == $local_head"

say "== waiting for GitHub Pages to serve $VER =="
for i in $(seq 1 20); do
  live=$(curl -s -L "$PAGES_URL" | sed -n '2p' | grep -oE 'VERSION: [0-9.]+' | cut -d' ' -f2)
  if [ "$live" = "$VER" ]; then say "   live site is $live"; exit 0; fi
  sleep 15
done
say "   WARNING: live site still reports '${live:-unknown}' after 5 minutes, expected $VER."
say "   The push landed. Pages may still be building — re-check before assuming it deployed."
exit 0
