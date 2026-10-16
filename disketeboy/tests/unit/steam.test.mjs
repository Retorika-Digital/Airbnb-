import { test } from 'node:test';
import assert from 'node:assert/strict';
import steam, { parseSteamInput } from '../../api/steam.mjs';
import cover from '../../api/cover.mjs';
import { mapSteamGames } from '../../js/steam.js';

const req = (q) => new Request(`http://x/api/steam?id=${encodeURIComponent(q)}`);
const ok = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

test('entiende los formatos de perfil de Steam', () => {
  assert.deepEqual(parseSteamInput('76561197960287930'), { steamid: '76561197960287930' });
  assert.deepEqual(parseSteamInput('https://steamcommunity.com/profiles/76561197960287930/'), { steamid: '76561197960287930' });
  assert.deepEqual(parseSteamInput('steamcommunity.com/id/gabelogannewell'), { vanity: 'gabelogannewell' });
  assert.deepEqual(parseSteamInput('mi_nombre-1'), { vanity: 'mi_nombre-1' });
  assert.equal(parseSteamInput(''), null);
  assert.equal(parseSteamInput('<script>'), null);
  assert.equal(parseSteamInput('a b c'), null);
});

test('sin clave responde 501 y no llama a Steam', async () => {
  let called = false;
  const res = await steam(req('gaben'), { key: '', fetchImpl: () => (called = true) });
  assert.equal(res.status, 501);
  assert.equal((await res.json()).error, 'sin_clave');
  assert.equal(called, false);
});

test('perfil no válido → 400', async () => {
  const res = await steam(req('no vale'), { key: 'k' });
  assert.equal(res.status, 400);
});

test('resuelve el nombre y devuelve los juegos ordenados', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (String(url).includes('ResolveVanityURL')) return ok({ response: { success: 1, steamid: '76561197960287930' } });
    return ok({ response: { games: [{ appid: 2, name: 'Zelda?', playtime_forever: 0 }, { appid: 1, name: 'Albion', playtime_forever: 120, playtime_2weeks: 30, extra: 'x' }, { appid: 'x', name: 'roto' }] } });
  };
  const res = await steam(req('steamcommunity.com/id/gaben'), { key: 'k', fetchImpl });
  const data = await res.json();
  assert.equal(res.status, 200);
  assert.deepEqual(data.games.map((g) => g.name), ['Albion', 'Zelda?']);
  assert.equal(data.games[0].extra, undefined, 'solo pasan los campos que usamos');
  assert.ok(calls[1].includes('steamid=76561197960287930'));
  assert.ok(calls.every((u) => u.includes('key=k')));
});

test('perfil privado, inexistente o Steam caído', async () => {
  const priv = await steam(req('76561197960287930'), { key: 'k', fetchImpl: async () => ok({ response: {} }) });
  assert.equal(priv.status, 403);
  const none = await steam(req('nadie'), { key: 'k', fetchImpl: async () => ok({ response: { success: 42 } }) });
  assert.equal(none.status, 404);
  const down = await steam(req('76561197960287930'), { key: 'k', fetchImpl: async () => new Response('', { status: 500 }) });
  assert.equal(down.status, 502);
});

test('Steam → DisketeBoy: lo nunca jugado va a la pila de la vergüenza', () => {
  const games = mapSteamGames([
    { appid: 1, name: 'Nunca abierto', playtime_forever: 0 },
    { appid: 2, name: 'Jugado', playtime_forever: 90 },
    { appid: 3, name: 'Ahora mismo', playtime_forever: 600, playtime_2weeks: 60 },
    { appid: 'x', name: 'roto' },
  ]);
  assert.deepEqual(games.map((g) => g.status), ['pendiente', 'jugado', 'jugando']);
  assert.equal(games[1].hours, 1.5);
  assert.ok(games.every((g) => g.platform === 'pc' && g.steamAppId));
});

test('portadas: solo ids numéricos y respuesta con CORS', async () => {
  assert.equal((await cover(new Request('http://x/api/cover?appid=../../etc'))).status, 400);
  assert.equal((await cover(new Request('http://x/api/cover?appid=1&tipo=lo-que-sea'))).status, 400);
  let asked = '';
  const fetchImpl = async (url) => {
    asked = String(url);
    return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'image/jpeg' } });
  };
  const res = await cover(new Request('http://x/api/cover?appid=620&tipo=capsula'), { fetchImpl });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), '*');
  assert.ok(asked.endsWith('/620/capsule_sm_120.jpg'));
  const html = await cover(new Request('http://x/api/cover?appid=620'), { fetchImpl: async () => new Response('<html>', { headers: { 'Content-Type': 'text/html' } }) });
  assert.equal(html.status, 404, 'si Steam no devuelve una imagen, no la reenviamos');
});
