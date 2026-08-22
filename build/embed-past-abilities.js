#!/usr/bin/env node
/* HoopaDex — put the past-ability table into the app
 * Run: node build/generate-past-abilities.js && node build/embed-past-abilities.js
 *
 * Rewrites the region between /*BEGIN-PASTABIL* / and /*END-PASTABIL* / in app/index.html
 * with the contents of data/interactions.embed.json. Nothing else in the file is touched.
 *
 * Why a script rather than a paste. The blob is 25 KB of generated JSON living inside a 650 KB
 * hand-edited file. Pasting it means the shipped copy and the generated copy drift the first time
 * Showdown adds a flag and nobody remembers which one is authoritative — which is the exact failure
 * this project has already fixed twice, for base stats and for forme gating. With this script the
 * app's copy is reproducible: regenerate, re-embed, and the diff is the data change or there is no
 * diff at all. tests/test-past-abilities.js asserts the two are identical, so a stale embed fails the
 * build rather than shipping quietly.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const DATA = path.join(ROOT, 'data', 'past-abilities.embed.json');

const OPEN = '/*BEGIN-PASTABIL*/';
const CLOSE = '/*END-PASTABIL*/';

const src = fs.readFileSync(APP, 'utf8');
const blob = fs.readFileSync(DATA, 'utf8').trim();

const a = src.indexOf(OPEN);
const b = src.indexOf(CLOSE);
if (a < 0 || b < 0 || b < a) {
  console.error('FAIL: could not find the ' + OPEN + ' … ' + CLOSE + ' markers in app/index.html.');
  console.error('They delimit the embedded table. Without them this script has no idea what to replace.');
  process.exit(1);
}

/* Parse before writing. A blob that does not parse would take the whole app down — every function
   below it in the file stops being defined — and the failure would look like "the site is blank",
   not "the build step is wrong". */
try { JSON.parse(blob); } catch (e) {
  console.error('FAIL: data/interactions.embed.json is not valid JSON: ' + e.message);
  process.exit(1);
}

const before = src.slice(0, a + OPEN.length);
const after = src.slice(b);
const out = before + blob + after;

if (out === src) {
  console.log('app/index.html already carries this table — nothing to do.');
  process.exit(0);
}

fs.writeFileSync(APP, out);
const old = src.slice(a + OPEN.length, b).length;
console.log('embedded ' + blob.length + ' bytes into app/index.html (was ' + old + ')');
console.log('  remember: version comment on line 2, and a CHANGELOG entry in the same pass.');
