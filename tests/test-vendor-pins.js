/* HoopaDex — vendored asset pins
 * Run: node tests/test-vendor-pins.js
 *
 * Why this suite exists. The app is described everywhere as "one HTML file, no dependencies". It is
 * not. app/ also holds calc-engine.js — a ~480 KB vendored build of @smogon/calc, which is the
 * PRIMARY damage engine, the one whose numbers the reader actually sees — and a 1.4 MB Champions
 * learnset export. An architecture review on 2026-08-03 found that neither had a version, a
 * lockfile, an upstream commit, a checksum or a test. Either could have been replaced, truncated by
 * a failed copy, or corrupted, and nothing anywhere would have noticed.
 *
 * A checksum is a weaker guarantee than a version pin and it is worth being clear about which one
 * this is. It cannot tell you the file is CORRECT or say where it came from. It tells you the file
 * is the same one that was reviewed, which is the difference between an unaudited dependency and an
 * unaudited dependency that cannot change behind your back.
 *
 * Deliberately not hashed: app/index.html, which changes every version by design.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const PINS = path.join(ROOT, 'data', 'vendor-pins.json');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

check(fs.existsSync(PINS), 'data/vendor-pins.json exists');
const pins = JSON.parse(fs.readFileSync(PINS, 'utf8'));
check(Array.isArray(pins.files) && pins.files.length > 0, 'it pins at least one file', pins.files && pins.files.length);

for (const f of pins.files) {
  const full = path.join(ROOT, f.path);
  if (!fs.existsSync(full)) {
    check(false, `${f.path} is present`, 'missing — it is referenced by app/index.html');
    continue;
  }
  const buf = fs.readFileSync(full);
  const sha = crypto.createHash('sha256').update(buf).digest('hex');

  check(buf.length === f.bytes, `${f.path} is ${f.bytes} bytes`, `got ${buf.length} — a truncated copy is the usual cause`);
  check(sha === f.sha256,
    `${f.path} matches its pinned checksum`,
    `expected ${f.sha256.slice(0, 16)}…, got ${sha.slice(0, 16)}… — if this was deliberate, update data/vendor-pins.json and say why in the CHANGELOG`);
}

// --- the pins must describe what they pin -----------------------------------------------------
// A checksum with no note beside it becomes an unexplained hex string that nobody dares change.
for (const f of pins.files) {
  check(typeof f.what === 'string' && f.what.length > 10, `${f.path} says what it is`, f.what);
  check('version' in f, `${f.path} records its version, even if that record is "UNKNOWN"`, f.version);
}
check(/does NOT prove|not its provenance/i.test(pins.limitation || ''),
  'the file states plainly that a checksum is not a version pin', pins.limitation);

// --- every vendored file the app loads should be pinned ----------------------------------------
// Catches the case where a new sibling is added to app/ and quietly goes unpinned.
const appHtml = fs.readFileSync(path.join(ROOT, 'app', 'index.html'), 'utf8');
const referenced = [...appHtml.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
const pinned = new Set(pins.files.map(f => path.basename(f.path)));
const unpinned = referenced.filter(r => !pinned.has(path.basename(r)));
check(unpinned.length === 0,
  'every local script the app loads is pinned',
  unpinned.join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
