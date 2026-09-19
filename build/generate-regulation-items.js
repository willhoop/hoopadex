#!/usr/bin/env node
/* HoopaDex — RETIRED in 5.47. Use build/generate-champions.js.
 *
 * This derived which items became legal between Champions regulations, from Showdown's
 * `championsregma` mod (M-A's differences from M-B). It can no longer run:
 *
 *   1. Showdown deleted `championsregma` when Regulation M-C arrived. `champions` is now M-C and
 *      `championsregmb` holds M-B's differences, so the mod this read from does not exist upstream.
 *   2. It wrote REG_ITEM_CHANGES with a single "reg-ma->reg-mb" key. Running it now would silently
 *      DELETE the "reg-mb->reg-mc" entry, and with it everything the Regulation Changes page says
 *      about M-C's items.
 *
 * build/generate-champions.js owns REG_ITEM_CHANGES now and writes both transitions. The M-A -> M-B
 * item diff this script produced is preserved in data/regulation-items.json — which is frozen, since
 * there is no longer an upstream to re-derive it from — and the new generator reads it from there.
 *
 * Kept as a file rather than deleted so that anyone who runs it from memory is told why, instead of
 * getting "Cannot find module" and trying to restore it from git history.
 */
console.error('build/generate-regulation-items.js is retired (5.47).\n' +
  '  Showdown removed the championsregma mod it read, and running it would erase Regulation M-C\'s item changes.\n' +
  '  Use: node build/generate-champions.js');
process.exit(1);
