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

const src = fs.readFileSync(path.join(__dirname, '..', 'app', 'index.html'), 'utf8');
const slice = (a, b) => {
  const i = src.indexOf(a);
  if (i < 0) throw new Error('anchor not found in index.html: ' + a);
  const j = src.indexOf(b, i);
  if (j < 0) throw new Error('end anchor not found: ' + b);
  return src.slice(i, j);
};

const registry = slice('const CHAMPIONS_REGS=[', 'let CHAMPIONS_IDS=LATEST_REG.ids();')
              + 'let CHAMPIONS_IDS=LATEST_REG.ids();';
const reader   = slice('const _initHash=(location.hash', '  applyFilters();');

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

function run(hash){
  isChampionsMode=true; selectedGenNum=9;
  championsReg=LATEST_REG.short; CHAMPIONS_IDS=LATEST_REG.ids();
  _sel['data-gen-num'].value='champions'; _sel['data-game'].value=''; specificGame=false;
  populateGameDropdown();          // init() does this before parsing the hash
  location.hash=hash;
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

// The registry is the single edit point for a new regulation.
t('newest regulation is first in the registry', '',
  {reg: H.CHAMPIONS_REGS[0].short});
console.log(H.LATEST_REG.key === H.CHAMPIONS_REGS[0].key
  ? 'pass  LATEST_REG tracks the head of CHAMPIONS_REGS' : 'FAIL  LATEST_REG drift');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
