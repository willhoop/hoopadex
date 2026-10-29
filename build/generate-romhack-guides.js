#!/usr/bin/env node
/* HoopaDex — ROM hacks: a guide to each hack, for the Guide tab
 * Run: node build/generate-romhack-guides.js          (fetch the sources, write app/hacks/<hack>.guide.json)
 *      node build/generate-romhack-guides.js --check  (fetch again, exit 1 if any file is stale)
 *
 * Asked for: "i want to start playing platinum kaizo so please update hoopadex to include all the docs
 * and a guide on the game, especially a switch ai guide", with the PChal Discord's list of resources.
 *
 * What is read and what is written. The level caps, the quality-of-life list, the Pokémon you cannot
 * get, the starter perks and the Hall of Fame rules are READ from the authors' FAQ every build, and the
 * build fails if the FAQ stops saying them in a form this file can read. The setup steps and the list of
 * links are written here: the links are the ones the PChal Discord collects, and the setup steps are
 * the FAQ's, plus the time-of-day hours, which are Platinum's own (morning 04:00-09:59, day
 * 10:00-19:59, night 20:00-03:59). The switch-AI guide is not here: it is on the AI tab, read from
 * the decompiled game (build/generate-ai-docs.js), and the guide links to it.
 *
 * A guide is {key, fetched, sources, sections: [{id, title, paras?, list?, table?, links?}]}.
 */
const fs = require('fs');
const path = require('path');
const RH = require('./generate-romhacks.js');

const ROOT = path.join(__dirname, '..');
const OUTDIR = path.join(ROOT, 'app', 'hacks');
const SRC = {
  pkFaq: 'https://docs.google.com/document/d/11ZprzZDSaJVwzIP1tI6X-JfFoct3jNMDW9i1eciPyHk/export?format=txt',
  /* The Hall of Fame sheet's "Rules" tab: the official Nuzlocke rules ("derived from Mr. Keating's
     Platinum Kaizo HOF Rules.txt"). */
  pkHofRules: 'https://docs.google.com/spreadsheets/d/1ki6NwXMXuGP0fO0YV3lrPc-uKnwEy5xwtJoyJUtI3Zo/export?format=csv&gid=1433988800',
};
async function get(url) {
  const dir = process.env.RH_CACHE;
  if (!dir) return RH.get(url);
  const f = path.join(dir, require('crypto').createHash('sha1').update(url).digest('hex'));
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8');
  const t = await RH.get(url);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(f, t);
  return t;
}

// ---- reading the FAQ ------------------------------------------------------------------------------------
/* The text between two questions, as trimmed lines. */
function between(txt, from, to) {
  const t = txt.replace(/\r/g, '').replace(/^﻿/, '');
  const i = t.indexOf(from);
  if (i < 0) throw new Error('the FAQ no longer has "' + from + '"');
  const j = to ? t.indexOf(to, i + from.length) : t.length;
  if (j < 0) throw new Error('the FAQ no longer has "' + to + '" after "' + from + '"');
  return t.slice(i + from.length, j).split('\n').map(l => l.trim()).filter(Boolean);
}
const bullets = lines => {
  /* A bullet can wrap onto the next line ("the 'R'" / "Button in the summary screen."). */
  const out = [];
  lines.forEach(l => { if (/^\*\s*/.test(l)) out.push(l.replace(/^\*\s*/, '')); else if (out.length) out[out.length - 1] += ' ' + l; });
  return out.map(s => s.replace(/\s+/g, ' ').trim());
};
function pkFromFaq(txt) {
  const capsLines = between(txt, 'What are the level caps for a Platinum Kaizo hardcore nuzlocke?', 'Will you be providing documentation on release?');
  const caps = bullets(capsLines.filter(l => /^\*/.test(l))).map(s => { const m = s.match(/^(.+?):\s*(\d+)$/); if (!m) throw new Error('level cap line not understood: ' + s); return [m[1], +m[2]]; });
  if (caps.length < 10) throw new Error('only ' + caps.length + ' level caps read from the FAQ');
  const capNotes = capsLines.filter(l => !/^\*/.test(l) && !/^The level caps are as follows/.test(l));
  const qol = bullets(between(txt, 'Platinum Kaizo implements the following quality-of-life features for players:', 'Are HMs required?'));
  const missing = bullets(between(txt, 'However, some Pokémon will be inaccessible. These include:', 'Does the game have a mobile/pocket PC?'));
  const perks = between(txt, 'How does the Piplup Waterfall mechanic work?', 'Do I have to stream my run to get into the Hall of Fame?')
    .filter(l => !/^Will I be able to use Waterfall/.test(l));
  const hof = [
    between(txt, 'Can I save state pre-starter selection for my Nuzlocke?', 'How does the Piplup Waterfall mechanic work?').join(' '),
    between(txt, 'Do I have to stream my run to get into the Hall of Fame?', 'How do I pre-status in PlatKaizoHeX?').join(' '),
    between(txt, 'Does the game have a mobile/pocket PC?', 'What are the level caps for a Platinum Kaizo hardcore nuzlocke?').join(' '),
  ];
  const hms = between(txt, 'Are HMs required?', 'Are all 500+ enemies in Platinum Kaizo mandatory to defeat in order to progress?').join(' ');
  [[qol, 8, 'quality-of-life features'], [missing, 30, 'Pokémon you cannot get'], [perks, 1, 'starter perks']].forEach(([a, n, what]) => {
    if (a.length < n) throw new Error('only ' + a.length + ' ' + what + ' read from the FAQ');
  });
  return { caps, capNotes, qol, missing, perks, hof, hms };
}

/* The Hall of Fame rules tab. Column C holds headings (and, under "Level Caps", plain lines); a rule
   sits one column further right for each level of nesting. The tab opens with a table of contents -
   the headings, once - and the rules start at the second "The Rules". Returns [{h, items: [[depth, text]]}]. */
function pkHofRules(csv) {
  const R = RH.csvRows(csv).map(r => r.map(c => (c || '').replace(/\s+/g, ' ').trim()));
  const at = R.map(r => { const k = r.findIndex(Boolean); return k < 0 ? null : [k, r[k]]; });
  const starts = at.map((x, i) => x && x[0] === 2 && x[1] === 'The Rules' ? i : -1).filter(i => i >= 0);
  if (starts.length < 2) throw new Error('Hall of Fame rules: no table of contents followed by "The Rules"');
  const toc = new Set(at.slice(starts[0] + 1, starts[1]).filter(Boolean).map(x => x[1]));
  const groups = [];
  let g = null;
  for (let i = starts[1] + 1; i < at.length; i++) {
    const x = at[i];
    if (!x || /^_+$/.test(x[1]) || x[0] < 2) continue;
    if (x[0] === 2 && toc.has(x[1])) { g = { h: x[1], items: [] }; groups.push(g); continue; }
    if (!g) continue;
    g.items.push([Math.max(0, x[0] - 3), x[1].replace(/^[•*○-]\s*/, '')]);
  }
  const caps = (groups.find(x => x.h === 'Level Caps') || { items: [] }).items.map(([, t]) => t.match(/^(.+?):\s*Lv\.\s*(\d+)$/)).filter(Boolean).map(m => +m[2]);
  if (groups.length < 8 || caps.length < 10) throw new Error('Hall of Fame rules: read ' + groups.length + ' headings and ' + caps.length + ' level caps - the tab has changed');
  return { groups: groups.filter(x => x.items.length && x.h !== 'Level Caps'), caps };
}

// ---- Platinum Kaizo -----------------------------------------------------------------------------------------
const PK_ROM_SHA1 = '0862ec35b24de5c7e2dcb88c9eea0873110d755c';
/* The PChal Discord's resource list for Platinum Kaizo, as Will shared it on 2026-10-29. Labels are
   HoopaDex's; each was opened to see what it is. */
const PK_LINKS = [
  ['Platinum Kaizo Mastersheet', 'https://docs.google.com/spreadsheets/d/1y95UYKY9HNgZjUlbeZbQ3BWf5IqcFqAkmstC-OSa6vc/edit', 'The authors\' documents: stats, abilities, moves, learnsets, encounters, items and every trainer. HoopaDex reads it.'],
  ['FAQ', 'https://docs.google.com/document/d/11ZprzZDSaJVwzIP1tI6X-JfFoct3jNMDW9i1eciPyHk/edit', 'How to patch, emulators, level caps, Hall of Fame rules. This guide reads it.'],
  ['Trainer Docs', 'https://docs.google.com/spreadsheets/d/1FDPAoLT9Qoj-gTzosvwzcNCRxVcURgUT7TsfW69DHaA/edit', 'The trainers by split, the same splits as the Mastersheet.'],
  ['Item Sheet', 'https://docs.google.com/spreadsheets/d/1h9vW08KEWbL6ucdBIPBZG1Phmc9ZaT9KOt8NADdWIuQ/edit', 'Checklists of every item, shard, TM and Heart Scale, and the shard tutors\' prices. HoopaDex\'s Items tab reads the item list and the tutors.'],
  ['Contest Shenanigans', 'https://docs.google.com/spreadsheets/d/190KzSPAuZfIM61cPcxaGNO4iMvn-bPceGW070UmGg_I/edit', 'Contests: move effects, move changes and the trainers of each rank.'],
  ['Hall of Fame', 'https://docs.google.com/spreadsheets/d/1ki6NwXMXuGP0fO0YV3lrPc-uKnwEy5xwtJoyJUtI3Zo/edit', 'The official rules and the finished runs. This guide reads the rules.'],
  ['Patch folder (Google Drive)', 'https://drive.google.com/drive/folders/1kLhdn09AfYFy-3R3epVycGNRxnmzvVFi', 'The .xdelta patch. The FAQ names the SinisterHQ Discord\'s #kaizo-links-resources as the official source.'],
  ['Damage calculator (Anas)', 'https://pkcalc.anastarawneh.com/', 'The official calculator, with every trainer\'s set.'],
  ['Calculator with party sync (emi)', 'https://emi.dev/platinum-kaizo/', 'Reads your party from DeSmuME through vs-link-ersatz.'],
  ['Calculator (emi, ck+)', 'https://emi.dev/ck+/?pk', ''],
  ['vs-link-ersatz', 'https://github.com/emilyploszaj/vs-link-ersatz', 'The DeSmuME Lua script that sends your party to emi\'s calculator.'],
  ['PK move scoring', 'https://bparkpk.github.io/PKMoveScoring/', 'Scores each enemy move the way the AI does.'],
  ['Gen IV trainer AI notes (lhearachel)', 'https://gist.github.com/lhearachel/ff61af1f58c84c96592b0b8184dba096', 'How the Gen IV AI scores moves, read from the code.'],
  ['PlatKaizoHeX 2.1', 'https://github.com/zuils/PlatKaizoHeX/releases/tag/2.1', 'Save viewer and editor; the FAQ says what a Hall of Fame run may use it for.'],
  ['Gardenia split map', 'https://drive.google.com/file/d/1teRWH8Wp2cdUc2j1JKCbVPvLaQHBJcZz/view', 'A picture: Gardenia_Split_Map.png.'],
];
function pkGuide(faq, hofCsv) {
  const F = pkFromFaq(faq);
  const H = pkHofRules(hofCsv);
  /* The FAQ and the Hall of Fame tab each list the level caps. They must agree, or the guide would
     have to pick one; the build stops instead. */
  if (H.caps.join() !== F.caps.map(c => c[1]).join()) throw new Error('level caps differ: FAQ ' + F.caps.map(c => c[1]).join() + ', Hall of Fame ' + H.caps.join());
  /* The one rule about tools like HoopaDex, shown above the rest so it is not missed. Read, not typed. */
  const toolRule = H.groups.reduce((o, g) => o.concat(g.items), []).map(x => x[1]).find(t => /generative AI/i.test(t));
  if (!toolRule) throw new Error('Hall of Fame rules: the rule on external planning tools is no longer there');
  return [
    { id: 'setup', title: 'Set up the game', list: [
      'You need Pokémon Platinum, North American release, Revision 1, from a cartridge you own. Its SHA-1 is ' + PK_ROM_SHA1 + '. No other version (and no "Xenophobia" dump) will patch.',
      'Get the .xdelta patch (see Links) and apply it with xDeltaUI, Delta Patcher, xdelta-wasm or Rom Patcher JS. Keep the unpatched ROM: the patch needs it again for a new version.',
      'Play on DeSmuME. On a phone, RetroArch or Drastic. An emulator built on melonDS (Delta is one) cannot save this game.',
      'Some encounters depend on the time of day. Platinum\'s hours: morning 04:00-09:59, day 10:00-19:59, night 20:00-03:59. To play at a time other than your clock\'s, start DeSmuME through RunAsDate: open RunAsDate, choose DeSmuME\'s .exe as the application, set the date and time you want, and press Run.',
      'Use the in-game save. A Hall of Fame run may not use save states for the starter or early encounters (see Rules).',
    ] },
    { id: 'caps', title: 'Level caps', paras: F.capNotes.concat(['The Hall of Fame rules give the same caps.']), table: { cols: ['Fight', 'Cap'], rows: F.caps } },
    { id: 'rules', title: 'Hall of Fame rules', paras: ['The official Nuzlocke rules, from the Hall of Fame sheet, in its words. They apply to a run you submit; how you play otherwise is up to you.',
      'One rule is about tools: "' + toolRule + '" Reading documents, as on this site, is allowed; asking an AI to plan a fight is not.'], groups: H.groups },
    { id: 'starters', title: 'HMs and starter perks', paras: [F.hms].concat(F.perks) },
    { id: 'qol', title: 'What the hack changes for you', list: F.qol },
    { id: 'missing', title: 'Pokémon you cannot get', paras: [F.missing.join(', ') + '.'] },
    { id: 'ai', title: 'The trainer AI', paras: ['Every trainer\'s AI flags are on the Trainers tab. How it chooses moves, when it switches, what it sends in after a knockout and when it uses items are on the AI tab, read from the decompiled game.'], go: 'ai' },
    { id: 'links', title: 'Links', links: PK_LINKS },
  ];
}

async function main() {
  const check = process.argv.includes('--check');
  const fetched = new Date().toISOString().slice(0, 10);
  const T = {};
  await Promise.all(Object.keys(SRC).map(async k => { T[k] = await get(SRC[k]); }));
  const out = [['platinum-kaizo', { fetched, sources: [SRC.pkFaq, SRC.pkHofRules], sections: pkGuide(T.pkFaq, T.pkHofRules) }]];
  let stale = 0;
  out.forEach(([key, doc]) => {
    const file = path.join(OUTDIR, key + '.guide.json');
    const next = JSON.stringify(Object.assign({ about: 'Generated by build/generate-romhack-guides.js. Do not edit by hand.', key }, doc)) + '\n';
    if (check) {
      const strip = s => s.replace(/"fetched":"[^"]*",/, '');
      const cur = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : '';
      if (strip(cur) !== strip(next)) stale++;
    } else fs.writeFileSync(file, next);
    const caps = doc.sections.find(s => s.id === 'caps');
    console.log(key + ': ' + doc.sections.length + ' sections; level caps ' + caps.table.rows.map(r => r[0] + ' ' + r[1]).join(', '));
  });
  if (check) { console.log(stale ? 'STALE: ' + stale + ' guide files differ' : 'check: every guide matches its sources'); process.exit(stale ? 1 : 0); }
}
module.exports = { pkFromFaq, pkHofRules, between, bullets };
if (require.main === module) main().catch(e => { console.error(e.stack || e); process.exit(1); });
