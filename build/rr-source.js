/* HoopaDex — Radical Red: one reader for the one source, shared by every ROM hack generator
 *
 * Asked for from the live site: "put radical red and the storm/sacred pair in".
 *
 * Source: the data file behind the Radical Red Dex (dex.radicalred.net), published at
 * github.com/JwowSquared/Radical-Red-Pokedex as data.js - Radical Red 4.1. It is community data; the
 * site does not call itself official, and Radical Red's author (soupercell) publishes no machine-
 * readable data. No second source was found: hzla's "rrss" calculator file is Rising Ruby / Sinking
 * Sapphire, not Radical Red. Every file built from this says it has a single source.
 *
 * What this reader settles once, so the four generators cannot settle it four ways:
 *   - stats are stored Gen III-style, HP / Atk / Def / SPEED / SpA / SpD, and are reordered here;
 *   - types, abilities and moves are numbers, resolved through the file's own tables;
 *   - TM and tutor lists are indices into the file's TM and tutor tables, where 0 means an empty slot;
 *   - each national dex number's species is its default form: the entry named as the species is.
 */
const RH = require('./generate-romhacks.js');
const { flat } = RH;

const URL = 'https://raw.githubusercontent.com/JwowSquared/Radical-Red-Pokedex/master/data.js';

function parse(text) {
  const o = (0, eval)('(' + text.slice(text.indexOf('{')) + ')');
  const V = x => Object.values(x);
  const typeName = {}; V(o.types).forEach(t => { typeName[t.ID] = t.name.toLowerCase(); });
  const ability = {}; V(o.abilities).forEach(a => { ability[a.ID] = a.names[0]; });
  const move = {}; V(o.moves).forEach(m => { move[m.ID] = m; });
  const item = {}; V(o.items).forEach(i => { item[i.ID] = i.name; });
  const species = {}; V(o.species).forEach(s => { species[s.ID] = s; });
  /* The default form of each national dex number: the entry whose name is the species' own. */
  const byDex = {};
  const SPECIES = RH.SPECIES;
  V(o.species).forEach(s => {
    if (!(s.dexID >= 1 && s.dexID <= 1025)) return;
    const row = SPECIES.find(r => r[0] === s.dexID);
    const own = row && (flat(s.name) === flat(row[1]) || flat(s.name) === flat(row[1].split('-')[0]));
    if (own && !byDex[s.dexID]) byDex[s.dexID] = s;
  });
  V(o.species).forEach(s => { if (s.dexID >= 1 && s.dexID <= 1025 && !byDex[s.dexID]) byDex[s.dexID] = s; });   // a species whose only entry has a form name
  const stats6 = s => [s.stats[0], s.stats[1], s.stats[2], s.stats[4], s.stats[5], s.stats[3]];   // HP Atk Def SpA SpD Spe
  const tm = idx => (idx || []).map(i => o.tmMoves[i]).filter(Boolean);
  const tutor = idx => (idx || []).map(i => o.tutorMoves[i]).filter(Boolean);
  /* A form keeps its species' name in the file ("Geodude" for Alolan Geodude); its key says which form
     ("Geodude-Alola"). Shown as "Geodude (Alola)". Nidoran-F and -M are species, not forms. */
  const displayName = s => {
    const n = s.name.trim(), k = String(s.key || '').trim();
    if (!k || k === n || /^Nidoran/.test(n) || k.indexOf('-') < 0) return n;
    return n + ' (' + k.slice(k.indexOf('-') + 1).replace(/-/g, ' ') + ')';
  };
  return { o, V, typeName, ability, move, item, species, byDex, stats6, tm, tutor, displayName };
}

/* FireRed's own slot chances (pret/pokefirered, src/data/wild_encounters.json, "encounter_rates"):
   Radical Red keeps FireRed's encounter engine. */
const SLOT_RATES = {
  land: [20, 20, 10, 10, 10, 10, 5, 5, 4, 4, 1, 1],
  water: [60, 30, 5, 4, 1],
  smash: [60, 30, 5, 4, 1],
  oldRod: [70, 30],
  goodRod: [60, 20, 20],
  superRod: [40, 40, 15, 4, 1],
};

module.exports = { URL, parse, SLOT_RATES };
