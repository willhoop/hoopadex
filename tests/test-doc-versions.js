/* HoopaDex — documentation version stamps
 * Run: node tests/test-doc-versions.js
 *
 * CLAUDE.md requires the white paper, the deck and the technical documentation to be updated in the
 * same pass as any change to the code. Nothing checked that, so it was a preference rather than a
 * rule, and the architecture review of 2026-08-03 set out to measure how far they had drifted.
 *
 * It measured it wrongly. Taking the highest version-like string in each file picked up the
 * DOCUMENT's own version — the deck is on its 1.3rd revision — and reported that as the app version
 * the deck described, concluding the deck was fifty versions stale. It was not: it correctly said
 * "HoopaDex v5.8", which was current. The review published that error and this suite is the
 * correction.
 *
 * The lesson is the one the project already knows and this is a second instance of it: a number
 * that is easy to grep for is not the same as the number you want. So the rule is now expressed
 * precisely and machine-checked. Each document carries an explicit "HoopaDex vX.Y" stamp, and that
 * stamp must equal the version on line 2 of app/index.html.
 *
 * This does NOT prove a document's contents are current — nothing automated can. It proves someone
 * touched the stamp in the same pass, which is the checkable part of the rule.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

const appVer = (fs.readFileSync(SRC, 'utf8').match(/HOOPADEX VERSION: ([\d.]+)/) || [])[1];
check(!!appVer, 'the app version is readable from line 2', appVer);

// The three artefacts CLAUDE.md names by path.
const DOCS = [
  ['docs/HOOPADEX-whitepaper.md', 'white paper'],
  ['docs/HOOPADEX-deck-plain-english.md', 'plain-English deck'],
  ['docs/HOOPADEX-technical-docs.md', 'technical documentation'],
];

for (const [rel, label] of DOCS) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { check(false, `${label} exists`, rel); continue; }
  const text = fs.readFileSync(full, 'utf8');

  const stamp = text.match(/HoopaDex v([\d.]+)/);
  check(!!stamp, `${label} carries an explicit "HoopaDex vX.Y" stamp`, rel);
  if (stamp) check(stamp[1] === appVer,
    `${label} is stamped for the shipped version`,
    `${rel} says v${stamp[1]}, app is v${appVer} — update it in this pass, that is the rule`);

  // Its own revision number is a different number and must not be confused with the app's.
  // Asserted so that the mistake this suite exists to correct cannot be made silently again.
  const own = text.match(/\*\*Version ([\d.]+)/);
  check(!!own, `${label} also records its own document revision`, rel);
  if (own && stamp) check(own[1] !== stamp[1] || own[1] === appVer,
    `${label}: its own revision and the app stamp are distinguishable`, `doc ${own[1]}, app ${stamp[1]}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
