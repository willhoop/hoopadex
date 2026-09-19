#!/usr/bin/env node
/* HoopaDex — Champions regulations, derived from Showdown
 * Run: node build/generate-champions.js [--refresh]
 *
 * Writes:
 *   data/showdown-champions-extract.json   the parsed Showdown snapshot (offline, byte-identical reruns)
 *   data/champions-regulations.json        what was derived, and what it was verified against
 *   app/champions-learnsets.json           the learnset export, extended with every new regulation
 *   app/index.html                         the block between BEGIN/END-CHAMPIONS-DERIVED, and
 *                                          REG_ITEM_CHANGES
 *
 * WHERE THE DATA COMES FROM. Showdown carries each Champions regulation as its own mod. The CURRENT
 * one is `data/mods/champions`; each older one is a mod that inherits it and overrides only what
 * differed. When Regulation M-C arrived, `champions` became M-C, `championsregmb` appeared holding
 * M-B's differences, and `championsregma` was deleted upstream. So an older regulation's mod files
 * ARE its change list — the same arrangement build/generate-regulation-items.js already relies on.
 *
 * WHY THE DERIVATION IS TRUSTED. Before any of this was written into the app, the same rules were
 * run against Regulation M-B and compared with what was already in the app, typed by hand:
 *
 *   roster   208 species        derived 208, identical — 0 missing, 0 extra
 *   items    148 items          derived 148, identical — 0 missing, 0 extra
 *
 * The roster rule that reproduces it is "a species is in if ANY of its entries is legal". Floette is
 * the case that needs it: base Floette is not legal, Floette-Eternal (the Mega Floette line) is, and
 * the hand-typed roster correctly has #670. Checking only base species gives 207.
 *
 * Every run re-performs that check against the M-B still embedded in the app, and refuses to write
 * anything if it no longer holds — because a derivation that stops reproducing the known answer is
 * no longer entitled to produce the unknown one.
 *
 * WHAT IS NOT DERIVED, and why. The usable-move list (CHAMPIONS_MOVES) came from Serebii, and
 * Showdown's learnsets do not reproduce it exactly: they agree on 12,900 of 12,944 M-B
 * species-move pairs. The 44 extra pairs in the old list are all Floette-Eternal, whose movepool
 * Showdown's mod does not carry (it is carried forward below). The one real disagreement is Slash:
 * Showdown gives it to 27 legal M-B species, the old list to none. Champions REBALANCED Slash
 * (80 base power, in the same mod), which settles that it is in the game. So M-B keeps its original
 * list untouched — rewriting a past regulation from a different source would change answers
 * nobody asked to change — and M-C follows Showdown, including Slash.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app', 'index.html');
const EXPORT = path.join(ROOT, 'app', 'champions-learnsets.json');
const EXTRACT = path.join(ROOT, 'data', 'showdown-champions-extract.json');
const OUT = path.join(ROOT, 'data', 'champions-regulations.json');
const MA_ITEMS = path.join(ROOT, 'data', 'regulation-items.json');   // the M-A diff, cached before
const REFRESH = process.argv.includes('--refresh');                  // championsregma was deleted
/* --check recomputes everything from the committed snapshot and compares it with what is on disk,
   writing nothing. tests/test-champions-mc.js runs it: if anyone edits the generated block, the
   export or the record by hand, or edits this generator without rerunning it, the suite goes red. */
const CHECK = process.argv.includes('--check');
const drift = [];
function writeOrCheck(file, content) {
  if (!CHECK) { fs.writeFileSync(file, content); return; }
  const now = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (now !== content) drift.push(path.relative(ROOT, file));
}
const SD = 'https://raw.githubusercontent.com/smogon/pokemon-showdown/master/';

/* Newest first. `mod` is the Showdown directory; `inherits` is the regulation it overrides. */
const REGS = [
  /* `window` is the one hand-entered field: no Showdown file carries a date. Sources, read by the
     weekly regulation watch on 2026-09-14: Serebii "September 9th 2026 - December 2nd 2026"; Victory
     Road "from 9 September to 2 December 2026"; Pokémon.com "September 8, 2026, at 7:00 p.m. PDT to
     Tuesday, December 1, 2026" (the same instant, in Pacific time). */
  { key: 'reg-mc', label: 'Regulation M-C', mod: 'champions', window: 'Sept 9 - Dec 2, 2026' },
  { key: 'reg-mb', label: 'Regulation M-B', mod: 'championsregmb', inherits: 'reg-mc' },
];

const toID = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

// --- fetching -------------------------------------------------------------------------------------
function get(url) {
  return new Promise((res, rej) => {
    https.get(url, { headers: { 'User-Agent': 'hoopadex-build' } }, r => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) return res(get(r.headers.location));
      if (r.statusCode === 404) return res(null);
      if (r.statusCode !== 200) return rej(new Error('HTTP ' + r.statusCode + ' ' + url));
      let b = ''; r.setEncoding('utf8'); r.on('data', c => b += c); r.on('end', () => res(b));
    }).on('error', rej);
  });
}

// --- parsing Showdown's TypeScript tables -----------------------------------------------------------
/* Top-level entries are one tab in and close with `\t},`. Every table below uses that shape. */
function entries(ts) {
  const out = {}, re = /^\t([a-z0-9]+): \{([\s\S]*?)^\t\},/gm;
  let m;
  while ((m = re.exec(ts))) out[m[1]] = m[2];
  return out;
}
/* undefined = the file does not mention it (inherit), null = explicitly legal, string = the reason
   it is not. The distinction matters: an override file saying nothing is not the same as saying yes. */
function nonstandard(body) {
  const m = body.match(/isNonstandard: (null|"[A-Za-z]+")/);
  return m ? (m[1] === 'null' ? null : m[1].replace(/"/g, '')) : undefined;
}
function flagsOf(body) {
  const m = body.match(/^\t\tflags: \{([^}]*)\}/m);
  return m ? m[1].split(',').map(s => s.trim().split(':')[0]).filter(Boolean).sort() : undefined;
}
const BEHAVIOUR_KEYS = ['secondary', 'self', 'condition', 'boosts', 'target', 'onDisableMove', 'onHit',
  'onTry', 'onModifyMove', 'volatileStatus', 'drain', 'recoil', 'heal', 'priority'];

function parseMoveOverrides(ts) {
  const out = {};
  for (const [id, b] of Object.entries(entries(ts))) {
    const r = {};
    const ns = nonstandard(b); if (ns !== undefined) r.isNonstandard = ns;
    const bp = b.match(/^\t\tbasePower: (\d+)/m); if (bp) r.basePower = +bp[1];
    const pp = b.match(/^\t\tpp: (\d+)/m); if (pp) r.pp = +pp[1];
    const acc = b.match(/^\t\taccuracy: (\d+|true)/m); if (acc) r.accuracy = acc[1] === 'true' ? true : +acc[1];
    const ty = b.match(/^\t\ttype: "([A-Za-z]+)"/m); if (ty) r.type = ty[1];
    const fl = flagsOf(b); if (fl) r.flags = fl;
    const beh = BEHAVIOUR_KEYS.filter(k => new RegExp('^\\t\\t' + k + ':', 'm').test(b));
    if (beh.length) r.behaviour = beh;
    out[id] = r;
  }
  return out;
}
function parseLearnsets(ts) {
  const out = {}, re = /^\t([a-z0-9]+): \{\n\t\tlearnset: \{([\s\S]*?)^\t\t\},/gm;
  let m;
  while ((m = re.exec(ts))) out[m[1]] = [...m[2].matchAll(/^\t\t\t([a-z0-9]+):/gm)].map(x => x[1]).sort();
  return out;
}

async function refresh() {
  console.log('downloading Showdown\'s Champions mods…');
  const extract = { note: 'Parsed from Pokémon Showdown by build/generate-champions.js --refresh. Do not edit by hand.',
                    source: SD + 'data/mods/', mods: {} };
  const commit = await get('https://api.github.com/repos/smogon/pokemon-showdown/commits?path=data/mods/champions&per_page=1')
    .then(j => { try { const c = JSON.parse(j)[0]; return { sha: c.sha, date: c.commit.committer.date }; } catch { return null; } });
  extract.showdownCommit = commit;

  for (const r of REGS) {
    const f = {};
    for (const name of ['formats-data', 'items', 'moves', 'learnsets']) {
      f[name] = await get(SD + 'data/mods/' + r.mod + '/' + name + '.ts');
    }
    if (!f['formats-data']) throw new Error(r.mod + '/formats-data.ts is missing — Showdown has restructured the Champions mods');
    extract.mods[r.mod] = {
      formats: Object.fromEntries(Object.entries(entries(f['formats-data'])).map(([k, b]) => [k, nonstandard(b) === undefined])),
      items: f.items ? Object.fromEntries(Object.entries(entries(f.items)).map(([k, b]) => [k, nonstandard(b)]).filter(([, v]) => v !== undefined)) : {},
      moves: f.moves ? parseMoveOverrides(f.moves) : {},
      learnsets: f.learnsets ? parseLearnsets(f.learnsets) : {},
    };
  }

  // Base tables, trimmed to what the derivation touches, so the snapshot stays small.
  const dexTs = entries(await get(SD + 'data/pokedex.ts'));
  const wanted = new Set(Object.values(extract.mods).flatMap(m => Object.keys(m.formats)));
  extract.dex = {};
  for (const k of wanted) {
    const b = dexTs[k]; if (!b) continue;
    extract.dex[k] = { num: +((b.match(/\bnum: (-?\d+)/) || [])[1]), name: (b.match(/name: "([^"]+)"/) || [])[1],
      base: (b.match(/baseSpecies: "([^"]+)"/) || [])[1] || null, forme: (b.match(/forme: "([^"]+)"/) || [])[1] || null };
  }
  const itemTs = entries(await get(SD + 'data/items.ts'));
  extract.items = Object.fromEntries(Object.entries(itemTs).map(([k, b]) =>
    [k, { name: (b.match(/name: "([^"]+)"/) || [])[1] || k, ns: nonstandard(b) === undefined ? null : nonstandard(b) }]));
  const moveTs = entries(await get(SD + 'data/moves.ts'));
  const wantedMoves = new Set(Object.values(extract.mods).flatMap(m => [...Object.keys(m.moves), ...Object.values(m.learnsets).flat()]));
  extract.moves = {};
  for (const k of wantedMoves) {
    const b = moveTs[k]; if (!b) continue;
    extract.moves[k] = {
      name: (b.match(/name: "([^"]+)"/) || [])[1], type: (b.match(/^\t\ttype: "([A-Za-z]+)"/m) || [])[1],
      category: (b.match(/category: "([A-Za-z]+)"/) || [])[1],
      basePower: +((b.match(/^\t\tbasePower: (\d+)/m) || [])[1] || 0),
      accuracy: (m => m ? (m[1] === 'true' ? true : +m[1]) : null)(b.match(/^\t\taccuracy: (\d+|true)/m)),
      pp: +((b.match(/^\t\tpp: (\d+)/m) || [])[1] || 0), flags: flagsOf(b) || [],
    };
  }
  fs.writeFileSync(EXTRACT, JSON.stringify(extract, null, 1) + '\n');
  return extract;
}

// --- deriving ---------------------------------------------------------------------------------------
function modChain(extract, key) {
  const chain = []; let r = REGS.find(x => x.key === key);
  while (r) { chain.unshift(extract.mods[r.mod]); r = r.inherits && REGS.find(x => x.key === r.inherits); }
  return chain;   // oldest ancestor first; later entries override earlier ones
}
/* formats-data is a FULL table in every mod (not a diff), so the regulation's own file decides. */
function legalEntries(extract, key) {
  const f = extract.mods[REGS.find(x => x.key === key).mod].formats;
  return Object.keys(f).filter(k => f[k] && extract.dex[k] && extract.dex[k].num > 0);
}
function roster(extract, key) { return new Set(legalEntries(extract, key).map(k => extract.dex[k].num)); }
function items(extract, key) {
  const res = Object.fromEntries(Object.entries(extract.items).map(([k, v]) => [k, v.ns]));
  for (const m of modChain(extract, key)) for (const [k, v] of Object.entries(m.items)) res[k] = v;
  return new Set(Object.keys(res).filter(k => res[k] === null));
}
function learnsetsFor(extract, key) {
  const ls = {};
  for (const m of modChain(extract, key)) Object.assign(ls, m.learnsets);
  return ls;
}
/* The overrides that make a regulation's move differ from Scarlet/Violet. Only fields that actually
   differ are kept: championsregmb sets Strength Sap back to 10 PP, which IS the SV value, so in M-B
   Strength Sap has no override at all. */
function moveOverrides(extract, key) {
  const merged = {};
  for (const m of modChain(extract, key)) for (const [k, v] of Object.entries(m.moves)) merged[k] = Object.assign({}, merged[k], v);
  const out = {};
  for (const [k, o] of Object.entries(merged)) {
    const sv = extract.moves[k]; if (!sv) continue;
    const d = {};
    if (o.basePower !== undefined && o.basePower !== sv.basePower) d.bp = o.basePower;
    if (o.pp !== undefined && o.pp !== sv.pp) d.pp = o.pp;
    if (o.accuracy !== undefined && o.accuracy !== sv.accuracy) d.acc = o.accuracy;
    if (o.type && o.type !== sv.type) d.type = o.type;
    if (o.flags) {
      const add = o.flags.filter(f => !sv.flags.includes(f)), rem = sv.flags.filter(f => !o.flags.includes(f));
      if (add.length) d.flagsAdd = add;
      if (rem.length) d.flagsRemove = rem;
    }
    if (o.behaviour) d.behaviour = true;
    if (Object.keys(d).length) out[k] = d;
  }
  return out;
}
/* Each field that differs between two regulations' view of a move, as {move, field, from, to}. A
   regulation with no override for a field has Scarlet/Violet's value, so that is the "from" or "to". */
let regMoveChanges;
function makeRegMoveChanges(extract) {
  regMoveChanges = (fromKey, toKey) => {
    const a = moveOverrides(extract, fromKey), b = moveOverrides(extract, toKey), out = [];
    const FIELD = { bp: 'basePower', pp: 'pp', acc: 'accuracy', type: 'type' };
    for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      const sv = extract.moves[k]; if (!sv) continue;
      for (const f of Object.keys(FIELD)) {
        const from = (a[k] && a[k][f] !== undefined) ? a[k][f] : sv[FIELD[f]];
        const to = (b[k] && b[k][f] !== undefined) ? b[k][f] : sv[FIELD[f]];
        if (from !== to) out.push({ move: sv.name, field: FIELD[f], from, to });
      }
    }
    return out;
  };
}
function sidOf(extract, k) { const d = extract.dex[k]; return d.base ? toID(d.base) + '-' + toID(d.forme) : toID(d.name); }

function readApp() {
  const src = fs.readFileSync(APP, 'utf8');
  const MA = eval('[' + src.match(/const CHAMPIONS_IDS_MA=new Set\(\[([^\]]*)\]\)/)[1] + ']');
  const NEW = eval('[' + src.match(/const REG_MB_NEW=\[([^\]]*)\]/)[1] + ']');
  // The M-B item and move sets live either as the original hand-typed Set or, after the first run,
  // inside CHAMPIONS_*_BY_REG. Read whichever is present.
  const byReg = (name) => { const m = src.match(new RegExp('const ' + name + '=(\\{[^\\n]*\\});')); return m ? JSON.parse(m[1]) : null; };
  const itemsByReg = byReg('CHAMPIONS_ITEMS_BY_REG'), movesByReg = byReg('CHAMPIONS_MOVES_BY_REG');
  const hand = (name) => { const m = src.match(new RegExp('const ' + name + "=new Set\\('([^']*)'")); return m ? m[1].split(',') : null; };
  return {
    src, rosterMB: new Set([...MA, ...NEW]),
    itemsMB: new Set(itemsByReg ? itemsByReg['reg-mb'].split(',') : hand('CHAMPIONS_ITEMS')),
    movesMB: new Set(movesByReg ? movesByReg['reg-mb'].split(',') : hand('CHAMPIONS_MOVES')),
  };
}

const setEq = (a, b) => a.size === b.size && [...a].every(x => b.has(x));
const minus = (a, b) => [...a].filter(x => !b.has(x)).sort((x, y) => (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))));

(async () => {
  if (CHECK && !fs.existsSync(EXTRACT)) throw new Error('--check needs the committed snapshot, data/showdown-champions-extract.json');
  // --check never refreshes: it answers "does what is committed still follow from what is committed".
  const extract = (!CHECK && (REFRESH || !fs.existsSync(EXTRACT))) ? await refresh() : JSON.parse(fs.readFileSync(EXTRACT, 'utf8'));
  const app = readApp();
  makeRegMoveChanges(extract);

  // --- the trust anchor: M-B must reproduce what the app already holds ---------------------------
  const rMB = roster(extract, 'reg-mb'), iMB = items(extract, 'reg-mb');
  if (!setEq(rMB, app.rosterMB)) {
    throw new Error('REFUSING TO WRITE: the derived M-B roster no longer matches the one in the app.\n' +
      '  in the app only: ' + minus(app.rosterMB, rMB).join(',') + '\n  derived only: ' + minus(rMB, app.rosterMB).join(','));
  }
  if (!setEq(iMB, app.itemsMB)) {
    throw new Error('REFUSING TO WRITE: the derived M-B items no longer match the ones in the app.\n' +
      '  in the app only: ' + minus(app.itemsMB, iMB).join(',') + '\n  derived only: ' + minus(iMB, app.itemsMB).join(','));
  }
  console.log('verified: derived M-B roster (' + rMB.size + ') and items (' + iMB.size + ') match the app exactly');

  // --- M-C ------------------------------------------------------------------------------------------
  const rMC = roster(extract, 'reg-mc'), iMC = items(extract, 'reg-mc');
  const removedSpecies = minus(rMB, rMC);
  if (removedSpecies.length) {
    throw new Error('Regulation M-C REMOVES species (' + removedSpecies.join(',') + '). The app builds each roster by adding\n' +
      '  to the one before it, so this needs a full set rather than REG_MC_NEW — extend the generator.');
  }
  const addedSpecies = minus(rMC, rMB);

  // Items: M-A is M-B minus what the cached M-A diff says arrived in M-B.
  const maDiff = JSON.parse(fs.readFileSync(MA_ITEMS, 'utf8'));
  const iMA = new Set([...iMB].filter(k => !maDiff.added.some(a => a.key === k)).concat(maDiff.removed.map(r => r.key)));
  const itemsAdded = minus(iMC, iMB), itemsRemoved = minus(iMB, iMC);

  // Usable moves: M-B keeps its original list; M-C adds everything Showdown says an M-C Pokemon learns.
  const lsMC = learnsetsFor(extract, 'reg-mc');
  const usableMC = new Set(app.movesMB);
  for (const k of legalEntries(extract, 'reg-mc')) (lsMC[k] || []).forEach(m => usableMC.add(m));
  const movesAdded = minus(usableMC, app.movesMB);

  const ovMC = moveOverrides(extract, 'reg-mc'), ovMB = moveOverrides(extract, 'reg-mb');
  const moveChangesMBtoMC = Object.keys(Object.assign({}, ovMC, ovMB)).filter(k => JSON.stringify(ovMC[k]) !== JSON.stringify(ovMB[k])).sort();

  // --- the learnset export ---------------------------------------------------------------------------
  const EX = JSON.parse(fs.readFileSync(EXPORT, 'utf8'));
  // Strip any reg-mc from a previous run so reruns are idempotent rather than cumulative.
  for (const rec of Object.values(EX)) {
    rec.learnedBy.forEach(e => { e.legalIn = e.legalIn.filter(r => r !== 'reg-mc'); });
    rec.learnedBy = rec.learnedBy.filter(e => e.legalIn.length);
  }
  for (const k of Object.keys(EX)) if (!EX[k].learnedBy.length) delete EX[k];

  // Existing rows, by sid, with the moves they had in M-B — the carry-forward for Floette-Eternal.
  const rowsMB = {};
  for (const [mv, rec] of Object.entries(EX)) for (const e of rec.learnedBy) {
    if (!e.legalIn.includes('reg-mb')) continue;
    (rowsMB[e.sid] = rowsMB[e.sid] || { species: e.species, num: e.num, moves: new Set() }).moves.add(mv);
  }
  const legalMC = legalEntries(extract, 'reg-mc');
  const carried = [];
  const rowsMC = {};
  /* A row exists for every legal entry with a movepool of its OWN. Megas and battle formes share
     their base's and have no row — the existing export was already built that way (verified: the
     83 legal M-B entries without a row are exactly the ones with no learnset of their own). */
  for (const k of legalMC) {
    const sid = sidOf(extract, k), d = extract.dex[k];
    if (lsMC[k]) rowsMC[sid] = { species: d.name, num: d.num, moves: new Set(lsMC[k]) };
  }
  // Rows Showdown cannot give a movepool for, but which are still legal: carry M-B forward unchanged.
  for (const [sid, row] of Object.entries(rowsMB)) {
    if (rowsMC[sid]) continue;
    if (!rMC.has(row.num)) continue;
    rowsMC[sid] = { species: row.species, num: row.num, moves: new Set(row.moves) };
    carried.push(row.species);
  }
  for (const [sid, row] of Object.entries(rowsMC)) {
    for (const mv of row.moves) {
      if (!EX[mv]) {
        const info = extract.moves[mv];
        if (!info) continue;   // a move the base table does not know cannot be described; skip it
        EX[mv] = { name: info.name, type: info.type, category: info.category, learnedBy: [] };
      }
      let e = EX[mv].learnedBy.find(x => x.sid === sid);
      if (!e) { e = { species: row.species, num: row.num, sid, methods: ['TM'], legalIn: [] }; EX[mv].learnedBy.push(e); }
      if (!e.legalIn.includes('reg-mc')) e.legalIn.push('reg-mc');
    }
  }
  const order = ['reg-ma', 'reg-mb', 'reg-mc'];
  for (const rec of Object.values(EX)) {
    rec.learnedBy.forEach(e => e.legalIn.sort((a, b) => order.indexOf(a) - order.indexOf(b)));
    rec.learnedBy.sort((a, b) => a.num - b.num || a.sid.localeCompare(b.sid));
  }
  const sorted = Object.fromEntries(Object.keys(EX).sort().map(k => [k, EX[k]]));
  writeOrCheck(EXPORT, JSON.stringify(sorted));

  /* Which M-B -> M-C learnset differences are NOT changes M-C made. M-B's rows came from a different
     source (see the header), so for a species in both regulations, any pair that differs and that
     Showdown did not DECLARE as a change (the only declared learnset change is the championsregmb
     override file) is the two sources disagreeing, not the regulation changing. These are recorded
     separately so they can never be reported as rule changes. */
  const declared = new Set(Object.keys(extract.mods.championsregmb.learnsets));
  const sourceDiff = { onlyShowdown: {}, onlyOldList: {} }, sourceDiffKeys = [];
  for (const [sid, row] of Object.entries(rowsMC)) {
    const before = rowsMB[sid]; if (!before) continue;
    if (declared.has(toID(sid))) continue;
    for (const m of row.moves) if (!before.moves.has(m)) {
      (sourceDiff.onlyShowdown[m] = sourceDiff.onlyShowdown[m] || []).push(row.species); sourceDiffKeys.push(row.num + '|' + m);
    }
    for (const m of before.moves) if (!row.moves.has(m)) {
      (sourceDiff.onlyOldList[m] = sourceDiff.onlyOldList[m] || []).push(row.species); sourceDiffKeys.push(row.num + '|' + m);
    }
  }

  // --- what was derived, for the tests and the changelog ------------------------------------------------
  const nameOf = n => { const e = Object.values(extract.dex).find(d => d.num === n && !d.base); return e ? e.name : '#' + n; };
  const record = {
    note: 'Generated by build/generate-champions.js. Do not edit by hand.',
    showdownCommit: extract.showdownCommit,
    verification: {
      rosterMB: { derived: rMB.size, app: app.rosterMB.size, identical: true },
      itemsMB: { derived: iMB.size, app: app.itemsMB.size, identical: true },
    },
    'reg-mc': {
      size: rMC.size,
      speciesAdded: addedSpecies.map(n => ({ id: n, name: nameOf(n) })),
      speciesRemoved: [],
      formesAdded: legalMC.filter(k => extract.dex[k].base && !extract.mods.championsregmb.formats[k]).map(k => extract.dex[k].name).sort(),
      itemsAdded: itemsAdded.map(k => (extract.items[k] || {}).name || k),
      itemsRemoved: itemsRemoved.map(k => (extract.items[k] || {}).name || k),
      movesNowUsable: movesAdded.map(k => (extract.moves[k] || {}).name || k),
      moveChangesFromMB: moveChangesMBtoMC.map(k => ({ move: (extract.moves[k] || {}).name || k, mb: ovMB[k] || null, mc: ovMC[k] || null })),
      learnsetRowsCarriedForward: carried,
      declaredLearnsetChanges: [...declared].map(k => ({ species: (extract.dex[k] || {}).name || k,
        gained: (lsMC[k] || []).filter(m => !(extract.mods.championsregmb.learnsets[k] || []).includes(m)),
        lost: (extract.mods.championsregmb.learnsets[k] || []).filter(m => !(lsMC[k] || []).includes(m)) })),
      sourceDifferencesNotRuleChanges: {
        why: 'M-B learnsets came from an older list; M-C follows Showdown. These differ between the two SOURCES, not between the regulations.',
        onlyInShowdown: sourceDiff.onlyShowdown,
        onlyInOldList: sourceDiff.onlyOldList,
      },
    },
  };
  writeOrCheck(OUT, JSON.stringify(record, null, 1) + '\n');

  // --- embed ---------------------------------------------------------------------------------------------
  const q = s => [...s].sort().join(',');
  const block =
    '/*BEGIN-CHAMPIONS-DERIVED*/\n' +
    '/* Everything between these markers is generated by build/generate-champions.js from Showdown\'s\n' +
    '   Champions mods. Do not edit by hand; rerun the generator. REG_MC_NEW is what M-C added to M-B. */\n' +
    'const REG_MC_NEW=' + JSON.stringify(addedSpecies) + '; // Added in Regulation M-C (' + REGS[0].window + ')\n' +
    'const CHAMPIONS_IDS_MC=new Set([...CHAMPIONS_IDS_MB,...REG_MC_NEW]);\n' +
    'const CHAMPIONS_ITEMS_BY_REG=' + JSON.stringify({ 'reg-mc': q(iMC), 'reg-mb': q(iMB), 'reg-ma': q(iMA) }) + ';\n' +
    'const CHAMPIONS_MOVES_BY_REG=' + JSON.stringify({ 'reg-mc': q(usableMC), 'reg-mb': q(app.movesMB), 'reg-ma': q(app.movesMB) }) + ';\n' +
    'const CHAMP_MOVE_OVERRIDES=' + JSON.stringify({ 'reg-mc': ovMC, 'reg-mb': ovMB, 'reg-ma': ovMB }) + ';\n' +
    '/* Learnset pairs ("dex|move") that differ between M-B and M-C because the two regulations\' learnsets\n' +
    '   came from DIFFERENT SOURCES, not because M-C changed them. The Regulation Changes page must not\n' +
    '   report these as rule changes. See data/champions-regulations.json for the named list. */\n' +
    'const REG_LEARNSET_SOURCE_DIFFS=' + JSON.stringify({ 'reg-mb->reg-mc': [...new Set(sourceDiffKeys)].sort() }) + ';\n' +
    '/* Move values that changed between regulations, with BOTH ends stated. The page cannot work the\n' +
    '   "before" out for itself: an override only exists where a value differs from Scarlet/Violet. */\n' +
    'const REG_MOVE_CHANGES=' + JSON.stringify({ 'reg-ma->reg-mb': [], 'reg-mb->reg-mc': regMoveChanges('reg-mb', 'reg-mc') }) + ';\n' +
    '/*END-CHAMPIONS-DERIVED*/';
  let src = app.src;
  if (/\/\*BEGIN-CHAMPIONS-DERIVED\*\/[\s\S]*?\/\*END-CHAMPIONS-DERIVED\*\//.test(src)) {
    src = src.replace(/\/\*BEGIN-CHAMPIONS-DERIVED\*\/[\s\S]*?\/\*END-CHAMPIONS-DERIVED\*\//, () => block);
  } else {
    const anchor = src.match(/^const CHAMPIONS_IDS_MB=.*$/m);
    if (!anchor) throw new Error('could not find CHAMPIONS_IDS_MB to insert after');
    src = src.replace(anchor[0], () => anchor[0] + '\n' + block);
  }
  // REG_ITEM_CHANGES: both transitions. M-A->M-B comes from the cache, because championsregma no longer
  // exists upstream and cannot be re-derived; M-B->M-C is derived here.
  const nm = k => JSON.stringify((extract.items[k] || {}).name || k);
  const itemLiteral = '{"reg-ma->reg-mb":{added:[' + maDiff.added.map(a => JSON.stringify(a.name)).join(',') +
    '],removed:[' + maDiff.removed.map(r => JSON.stringify(r.name)).join(',') + ']},' +
    '"reg-mb->reg-mc":{added:[' + itemsAdded.map(nm).join(',') + '],removed:[' + itemsRemoved.map(nm).join(',') + ']}}';
  if (!/^const REG_ITEM_CHANGES=\{.*?\};$/m.test(src)) throw new Error('REG_ITEM_CHANGES not found');
  src = src.replace(/^const REG_ITEM_CHANGES=\{.*?\};$/m, () => 'const REG_ITEM_CHANGES=' + itemLiteral + ';');
  writeOrCheck(APP, src);
  if (CHECK) {
    if (drift.length) {
      console.error('DRIFT: ' + drift.join(', ') + ' no longer match what the generator produces from the snapshot.\n' +
        '  Rerun: node build/generate-champions.js');
      process.exit(1);
    }
    console.log('check: the generated block, the learnset export and the record all match the snapshot');
    return;
  }

  console.log('Regulation M-C: ' + rMC.size + ' species (+' + addedSpecies.length + '), ' + iMC.size + ' items (+' + itemsAdded.length +
    '), ' + usableMC.size + ' usable moves (+' + movesAdded.length + '), ' + Object.keys(ovMC).length + ' moves differ from Scarlet/Violet');
  console.log('M-B -> M-C move changes: ' + moveChangesMBtoMC.join(', '));
  console.log('learnset rows carried forward (no Showdown movepool): ' + (carried.join(', ') || 'none'));
})().catch(e => { console.error(e.message); process.exit(1); });
