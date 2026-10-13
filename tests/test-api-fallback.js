/* HoopaDex — the PokeAPI fallback archive
 * Run: node tests/test-api-fallback.js
 *
 * Asked from the live site: "what happens if the api we rely on fails, can we build a historical
 * record of the data and put it in an archive that activates only if the api fails. i just want the
 * raw data", then "make sure the sync is for future things only, no deleting".
 *
 * The archive is willhoop/pokeapi-data, a fork of PokeAPI/api-data synced weekly by a job that adds
 * and updates and never removes. This suite runs the app's real fetch wrapper - sliced out of
 * index.html - against a fake network, and checks that it falls back exactly when it should.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(process.env.HOOPADEX_SRC || path.join(ROOT, 'app', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function check(ok, label, detail) {
  if (ok) { pass++; console.log('pass  ' + label); }
  else { fail++; console.log('FAIL  ' + label + '  ' + (detail === undefined ? '' : String(detail))); }
}

// --- a fake network -------------------------------------------------------------------------------
const ARCH = 'https://raw.githubusercontent.com/willhoop/pokeapi-data/master/data/api/v2/';
const archive = {
  'pokemon/6/index.json': { id: 6, name: 'charizard', species: { name: 'charizard', url: '/api/v2/pokemon-species/6/' } },
  'pokemon/index.json': { count: 5, next: null, previous: null, results: ['a', 'b', 'c', 'd', 'e'].map((n, i) => ({ name: n, url: '/api/v2/pokemon/' + (i + 1) + '/' })) },
};
let mode = 'up', calls = [];
class Resp {
  constructor(body, status) { this._b = body; this.status = status; this.ok = status >= 200 && status < 300; }
  async text() { return this._b; }
  async json() { return JSON.parse(this._b); }
}
async function fakeFetch(url) {
  calls.push(url);
  if (url.indexOf(ARCH) === 0) {
    const k = url.slice(ARCH.length);
    return archive[k] ? new Resp(JSON.stringify(archive[k], null, 2), 200) : new Resp('404', 404);
  }
  if (mode === 'down') throw new TypeError('Failed to fetch');
  if (mode === '500') return new Resp('oops', 500);
  if (mode === '404') return new Resp('Not Found', 404);
  return new Resp(JSON.stringify({ id: 6, name: 'charizard', live: true }), 200);
}

const a = src.indexOf('const POKEAPI_ROOT=');
const b = src.indexOf('// === CONSTANTS ===');
const window = { fetch: fakeFetch };
const W = new Function('window', 'Response', 'AbortController', 'setTimeout', 'clearTimeout', 'console',
  src.slice(a, b) + '\nreturn {fetch: window.fetch, state(){return {down: pokeapiDownUntil, n: pokeapiFallbacks}}, reset(){pokeapiDownUntil=0}};')(
  window, Resp, undefined, setTimeout, clearTimeout, { warn() {} });

(async () => {
  // Response here is the fake class: the wrapper builds its answer with `new Response(text, init)`.
  mode = 'up'; calls = [];
  let r = await W.fetch('https://pokeapi.co/api/v2/pokemon/6');
  check((await r.json()).live === true && calls.length === 1, 'with pokeapi.co up, the request goes there and only there');

  mode = '404'; calls = []; W.reset();
  r = await W.fetch('https://pokeapi.co/api/v2/pokemon/99999');
  check(r.status === 404 && !calls.some(u => u.indexOf(ARCH) === 0), 'a 404 is a real answer: no fallback');

  mode = 'down'; calls = []; W.reset();
  r = await W.fetch('https://pokeapi.co/api/v2/pokemon/6/');
  let j = JSON.parse(await r.text());
  check(j.name === 'charizard' && calls[1] === ARCH + 'pokemon/6/index.json', 'a network failure is answered from the archive', calls.join(' , '));
  check(j.species.url === 'https://pokeapi.co/api/v2/pokemon-species/6/', 'and its links point at pokeapi.co again, so following one falls back too', j.species.url);

  calls = [];
  r = await W.fetch('https://pokeapi.co/api/v2/pokemon/6');
  check(calls.length === 1 && calls[0].indexOf(ARCH) === 0, 'after a failure the archive is used directly, not one timeout per request', calls.join(' , '));

  mode = '500'; calls = []; W.reset();
  r = await W.fetch('https://pokeapi.co/api/v2/pokemon/6');
  check(JSON.parse(await r.text()).name === 'charizard', 'a server error (500) falls back too');

  mode = 'down'; W.reset();
  r = await W.fetch('https://pokeapi.co/api/v2/pokemon?limit=2&offset=1');
  j = JSON.parse(await r.text());
  check(j.results.map(x => x.name).join() === 'b,c', 'a list request takes its ?limit/?offset slice from the archive\'s whole list', j.results.map(x => x.name).join());

  mode = 'up'; calls = [];
  r = await W.fetch('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/6.png');
  check(calls.length === 1 && calls[0].indexOf('sprites') > 0, 'requests that are not to pokeapi.co are untouched');

  // --- the archive repository is configured to never delete ---------------------------------------
  const archMd = 'https://github.com/willhoop/pokeapi-data';
  check(/raw\.githubusercontent\.com\/willhoop\/pokeapi-data\/master\/data\/api\/v2\//.test(src), 'the app points at the archive ' + archMd);

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
