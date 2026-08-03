/* HoopaDex — URL hash routing tests
 * Run: node tests/test-hash-routing.js
 *
 * These tests slice the REAL parser out of app/index.html rather than copying
 * it, so the tests cannot drift away from the shipped code.
 *
 * They pin the behaviour fixed on 2026-07-22: the application opens in
 * Champions mode on the newest regulation, and a legacy "g9/gm:reg-mb" link
 * no longer drops the user out of Champions mode.
 */
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a);
  if (i < 0) throw new Error('anchor not found in index.html: ' + a);
  const j = src.indexOf(b, i);
  if (j < 0) throw new Error('end anchor not found: ' + b);
  return src.slice(i, j);
};

const registry = slice('const CHAMPIONS_REGS=[', 'let CHAMPIONS_IDS=LATEST_REG.ids();')
              + 'let CHAMPIONS_IDS=LATEST_REG.ids();';
const reader   = slice('const _initHash=hashPath();', '  applyFilters();');
// The real hashPath(), sliced rather than restated: this suite exists to test the '#' handling,
// so a copy of it living in the harness would test the copy.
const hashPathFn = slice('function hashPath()', '\n');

const harness = `
const CHAMPIONS_IDS_MA=new Set([1,2,3]);
const CHAMPIONS_IDS_MB=new Set([1,2,3,4,5]);
${registry}
let isChampionsMode=true, selectedGenNum=9, dataGen='', specificGame=false,
    selectedVersion='', locVersion='';
const _sel={'data-gen-num':{value:'champions'},'data-game':{value:'',style:{},innerHTML:''}};
const document={getElementById:id=>_sel[id]};
function populateGameDropdown(){ if(isChampionsMode) _sel['data-game'].value=regByShort(championsReg).key; }
let location={hash:''};
${hashPathFn}

function run(hash){
  isChampionsMode=true; selectedGenNum=9;
  championsReg=LATEST_REG.short; CHAMPIONS_IDS=LATEST_REG.ids();
  _sel['data-gen-num'].value='champions'; _sel['data-game'].value=''; specificGame=false;
  populateGameDropdown();          // init() does this before parsing the hash
  // A browser's location.hash ALWAYS carries the leading '#', and is '' only when there is no
  // fragment at all. This harness used to assign the bare string, so the reader's
  // .replace(/^#/,'') was never exercised: an engineering review deleted that strip - which breaks
  // every deep link in the app - and this suite stayed green. Cases below are written in the bare
  // form for readability and prefixed here, exactly as a browser would deliver them.
  location.hash=hash?(hash.charAt(0)==='#'?hash:'#'+hash):'';
${reader}
  return {champ:isChampionsMode, gen:selectedGenNum, reg:championsReg,
          genSel:_sel['data-gen-num'].value, gameSel:_sel['data-game'].value,
          ids:CHAMPIONS_IDS.size};
}
module.exports={run,LATEST_REG,CHAMPIONS_REGS,regByKey,isRegKey};
`;
const tmp = path.join(require('os').tmpdir(), 'hoopadex-hash-harness.js');
fs.writeFileSync(tmp, harness);
const H = require(tmp);

let pass = 0, fail = 0;
function t(name, hash, exp) {
  const got = H.run(hash);
  const bad = Object.keys(exp).filter(k => got[k] !== exp[k])
                    .map(k => `${k}: got ${got[k]}, want ${exp[k]}`);
  if (bad.length) { fail++; console.log('FAIL  ' + name + '  [' + hash + ']  ' + bad.join('; ')); }
  else { pass++; console.log('pass  ' + name); }
}

// The core promise: no hash at all opens Champions on the newest regulation.
t('bare URL opens Champions + newest regulation', '',
  {champ:true, reg:'m-b', genSel:'champions', gameSel:'reg-mb', ids:5});

// The '#' itself, asserted explicitly rather than left to the harness. Every real deep link
// arrives with one, and the strip that removes it had no coverage at all until 2026-08-03.
t('a link written with an explicit # routes identically', '#pokedex/g9/gm:reg-ma',
  {champ:true, reg:'m-a', genSel:'champions', gameSel:'reg-ma', ids:3});
t('a lone # is treated as no fragment', '#',
  {champ:true, reg:'m-b', genSel:'champions', gameSel:'reg-mb', ids:5});

// The regression this suite exists for. saveHash() used to emit g9 while in
// Champions mode, and the reader treated g9 as "leave Champions mode".
t('legacy g9 link stays in Champions', 'pokedex/g9/gm:reg-mb',
  {champ:true, reg:'m-b', genSel:'champions', gameSel:'reg-mb', ids:5});
t('legacy g9 link, older regulation', 'pokedex/g9/gm:reg-ma',
  {champ:true, reg:'m-a', genSel:'champions', gameSel:'reg-ma', ids:3});

// The canonical token written by saveHash() now.
t('gchampions token', 'pokedex/gchampions/gm:reg-mb',
  {champ:true, reg:'m-b', genSel:'champions', gameSel:'reg-mb'});
t('gchampions token alone', 'pokedex/gchampions',
  {champ:true, reg:'m-b', genSel:'champions'});

// Real generation links must still leave Champions mode.
t('Gen III link leaves Champions', 'pokedex/g3/gm:emerald',
  {champ:false, gen:3, genSel:3, gameSel:'emerald'});
t('Gen IX game link leaves Champions', 'pokedex/g9/gm:scarlet-violet|scarlet',
  {champ:false, gen:9, genSel:9});

// An unknown regulation must degrade to the newest, never to a blank dex.
t('unknown regulation falls back to newest', 'pokedex/gchampions/gm:reg-zz',
  {champ:true, reg:'m-b', genSel:'champions'});

/* --- the OTHER hash reader -----------------------------------------------------------------
   Everything above tests the parser inside init(). It is not the only one. restoreHash() has its
   own copy of the same loop, and it is the one that restores the TAB — so it is the reader that
   decides where a shared link actually lands.

   An engineering review on 2026-08-03 deleted the '#' strip from restoreHash and measured the
   result: all 27 suites green, the mutation check green, and in a real browser
   "#calc/gchampions/gm:reg-mb" opened on the Pokédex with the title still reading "HoopaDex".
   The suite named after hash routing did not cover the half of hash routing that routes.

   The '#' strip is now a single function, hashPath(), used by both. These assertions pin that:
   there must be exactly one definition, no caller may re-implement it, and every reader must go
   through it. Structural rather than behavioural, because restoreHash is async, touches the DOM
   and awaits network calls — a behavioural harness for it is worth building and is recorded as
   open work rather than faked here. */
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : detail)); }
}

const inlineStrips = (src.match(/\(location\.hash\|\|''\)\.replace\(\/\^#\//g) || []).length;
const hashPathDefs = (src.match(/function hashPath\(\)/g) || []).length;
const hashPathUses = (src.match(/hashPath\(\)/g) || []).length;

check(hashPathDefs === 1, 'hashPath() is defined exactly once', hashPathDefs);
check(inlineStrips === 1,
  "the '#' strip exists in exactly one place — hashPath() itself, not copied into a caller",
  `${inlineStrips} inline strips found`);
check(hashPathUses >= 3, 'both readers go through hashPath()', `${hashPathUses} references`);

// restoreHash must still be the reader that handles the tab; if that moves, the note above is
// stale and whoever moved it should say so.
const restore = slice('async function restoreHash()', 'function renderTC()');
check(/const parts=h\.split\('\/'\)/.test(restore), 'restoreHash still splits the path into tokens');
check(/const tab=parts\[0\]/.test(restore), 'restoreHash still takes the tab from the first token');
check(/hashPath\(\)/.test(restore), 'restoreHash gets its path from hashPath(), not its own strip');

// The registry is the single edit point for a new regulation.
t('newest regulation is first in the registry', '',
  {reg: H.CHAMPIONS_REGS[0].short});
console.log(H.LATEST_REG.key === H.CHAMPIONS_REGS[0].key
  ? 'pass  LATEST_REG tracks the head of CHAMPIONS_REGS' : 'FAIL  LATEST_REG drift');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
