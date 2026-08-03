/* HoopaDex — the app must actually parse
 * Run: node tests/test-syntax.js
 *
 * This exists because of a near miss on 2026-08-03. A scripted edit wrote
 * `switchTab('pokedex')` into a single-quoted JavaScript string where it needed
 * `switchTab(\'pokedex\')` — the escaping was eaten somewhere between a shell heredoc and Python.
 * The result was a syntax error in the one inline script, so NOTHING ran: no tabs, no data, a blank
 * shell of a page. An auto-commit hook runs on a timer here and pushes straight to the live site.
 *
 * Every other suite in this directory slices a function out of the file and evaluates it in
 * isolation, so all eighteen of them stayed green while the shipped page was completely dead. That
 * is the gap: they test the parts, and nothing tested that the whole still parses.
 *
 * It also catches the other half of the same trap — the file stores characters like × and ↕ as CSS
 * or JS escapes, and a non-raw Python string turns `\2195` into a control character. Those do not
 * break parsing, so they are checked separately below.
 */
const fs = require('fs');
const path = require('path');

const SRC = process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html');
const src = fs.readFileSync(SRC, 'utf8');

let pass = 0, fail = 0;
function check(ok, l, d) {
  if (ok) { pass++; console.log('pass  ' + l); }
  else { fail++; console.log('FAIL  ' + l + '  ' + (d === undefined ? '' : String(d))); }
}

// --- the whole app must parse -------------------------------------------------------------
const scripts = [...src.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
check(scripts.length >= 1, 'found the inline script', scripts.length);
scripts.forEach((code, i) => {
  let err = null;
  try { new Function(code); } catch (e) { err = e.message; }
  check(err === null, 'inline script ' + i + ' parses as JavaScript', err);
  check(code.length > 100000, 'inline script ' + i + ' is the real application, not a stub', code.length);
});

// --- control characters are always corruption ---------------------------------------------
// A literal control character in this file has only ever come from a mangled escape: `\2195`
// through a non-raw Python string yields 0x11 followed by "95", which then renders as the text
// "95" in a CSS ::after. Tab, newline and carriage return are the only legitimate ones.
const controls = [];
for (let i = 0; i < src.length; i++) {
  const c = src.charCodeAt(i);
  if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) {
    controls.push({ at: i, code: '0x' + c.toString(16), near: JSON.stringify(src.slice(i - 30, i + 10)) });
  }
}
check(controls.length === 0, 'no stray control characters — the signature of a mangled escape',
  controls.slice(0, 3).map(c => c.code + ' near ' + c.near).join(' | '));

// --- the CSS escapes that were corrupted once already --------------------------------------
check(/content:'\\2195'/.test(src), 'the sort indicator is the up-down arrow escape, not literal text');
check(/content:'\\2191'/.test(src), 'the ascending indicator is the up arrow escape');
check(/content:'\\2193'/.test(src), 'the descending indicator is the down arrow escape');

// --- the version stamp the whole release process keys off ----------------------------------
const ver = src.match(/HOOPADEX VERSION: ([\d.]+)/);
check(!!ver, 'the version comment on line 2 is present and parseable', ver && ver[1]);
const line2 = src.split(/\r?\n/)[1] || '';
check(/HOOPADEX VERSION:/.test(line2), 'and it is genuinely on line 2, where CLAUDE.md says it lives');

// --- the version stamped here must be the one the CHANGELOG announces ----------------------
// check_projects.py enforces this too, but it lives in another repository and it currently exits
// non-zero because of an unrelated project, so in practice it gets skipped. A gate that is always
// red teaches you to walk past it. This is the same assertion, inside the suite that must pass.
const changelog = fs.readFileSync(path.join(__dirname, '..', 'CHANGELOG.md'), 'utf8');
const topVer = changelog.match(/^## \[([\d.]+)\]/m);
check(!!topVer, 'the CHANGELOG has a parseable newest version', topVer && topVer[1]);
if (ver && topVer) check(ver[1] === topVer[1],
  'the app version and the newest CHANGELOG entry agree',
  `index.html ${ver[1]}, CHANGELOG ${topVer[1]}`);

// --- nothing stale is published alongside it -------------------------------------------------
// GitHub Pages serves everything in app/. A copy of the app from version 1.92 sat there until
// 5.9, reachable at /app/HoopaDex_1_92.html and returning HTTP 200. It predated the historical
// base-stat fix, the Gen I type chart fix and the item generation fix, so a reader who opened it
// got a dex that was wrong in every way this project has since spent versions correcting — and it
// looked exactly as authoritative as the real one.
const appDir = path.join(__dirname, '..', 'app');
const strays = fs.readdirSync(appDir).filter(f => /\.html?$/i.test(f) && f !== 'index.html');
check(strays.length === 0,
  'app/ publishes index.html and no other page — a stale copy is a wrong dex with a live URL',
  strays.join(', '));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
