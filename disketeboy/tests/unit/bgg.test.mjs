import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bgg, { parseBggInput, parseCollection } from '../../api/bgg.mjs';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import('../../js/store.js');
const { mapBggGames, boxForMinutes } = await import('../../js/boards.js');
beforeEach(() => {
  mem.clear();
  store._reload();
});

const XML = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<items totalitems="3" termsofuse="https://boardgamegeek.com/xmlapi/termsofuse">
  <item objecttype="thing" objectid="13" subtype="boardgame" collid="1">
    <name sortindex="1">CATAN</name>
    <yearpublished>1995</yearpublished>
    <stats minplayers="3" maxplayers="4" minplaytime="60" maxplaytime="120" playingtime="120" numowned="1">
      <rating value="7.5"><usersrated value="1"/></rating>
    </stats>
    <status own="1" prevowned="0" fortrade="0" want="0" wanttoplay="0" wanttobuy="0" wishlist="0" preordered="0" lastmodified="2024-01-01 10:00:00"/>
    <numplays>12</numplays>
  </item>
  <item objecttype="thing" objectid="9209" subtype="boardgame" collid="2">
    <name sortindex="1">Ticket to Ride &amp; Friends&#039; Edition</name>
    <stats minplayers="2" maxplayers="5" playingtime="60"><rating value="N/A"/></stats>
    <numplays>0</numplays>
  </item>
  <item objecttype="thing" objectid="0" subtype="boardgame"><name>Roto</name></item>
</items>`;

test('el usuario de BGG: nombre o URL de su perfil o colección', () => {
  assert.equal(parseBggInput('Aldie'), 'Aldie');
  assert.equal(parseBggInput(' https://boardgamegeek.com/user/Aldie '), 'Aldie');
  assert.equal(parseBggInput('https://boardgamegeek.com/collection/user/Board%20Gamer?own=1'), 'Board Gamer');
  for (const bad of ['', 'a', '<script>', 'x'.repeat(41), 'https://boardgamegeek.com/user/%E0%A4%A']) assert.equal(parseBggInput(bad), null, bad);
});

test('lee la colección del XML de BGG, con entidades y sin nota', () => {
  const { games } = parseCollection(XML);
  assert.deepEqual(games, [
    { id: 13, name: 'CATAN', minPlayers: 3, maxPlayers: 4, minutes: 120, plays: 12, rating: 7.5 },
    { id: 9209, name: "Ticket to Ride & Friends' Edition", minPlayers: 2, maxPlayers: 5, minutes: 60, plays: 0, rating: null },
  ]);
  assert.equal(parseCollection('<errors><error><message>Invalid username specified</message></error></errors>').error, 'no_encontrado');
});

const reqFor = (user) => new Request(`http://x/api/bgg?user=${encodeURIComponent(user)}`);
const xmlResponse = (body, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/xml' } });

test('si BGG está preparando la colección (202), espera y vuelve a pedirla', async () => {
  const calls = [];
  const replies = [xmlResponse('', 202), xmlResponse(XML)];
  const res = await bgg(reqFor('Aldie'), { fetchImpl: async (url, opts) => (calls.push({ url: String(url), opts }), replies.shift()), wait: async () => {}, token: 'abc' });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.games.length, 2);
  assert.equal(calls.length, 2);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('own'), '1');
  assert.equal(url.searchParams.get('excludesubtype'), 'boardgameexpansion');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer abc', 'con BGG_TOKEN manda la clave');
});

test('errores de BGG con su código, para que la consola los explique', async () => {
  const run = async (user, reply, extra = {}) => {
    const res = await bgg(reqFor(user), { fetchImpl: async () => (typeof reply === 'function' ? reply() : reply), wait: async () => {}, token: '', ...extra });
    return [res.status, (await res.json()).error];
  };
  assert.deepEqual(await run('<x>', xmlResponse(XML)), [400, 'usuario']);
  assert.deepEqual(await run('Nadie', xmlResponse('<errors><error><message>Invalid username specified</message></error></errors>')), [404, 'bgg_no_encontrado']);
  assert.deepEqual(await run('Aldie', () => xmlResponse('', 401)), [501, 'bgg_clave']);
  assert.deepEqual(await run('Aldie', () => xmlResponse('', 429)), [503, 'bgg_ocupado']);
  assert.deepEqual(await run('Aldie', () => xmlResponse('', 202)), [503, 'bgg_en_cola']);
  assert.deepEqual(await run('Aldie', () => { throw new Error('sin red'); }), [502, 'bgg_red']);
});

test('de BGG a la Kallax: sin partidas → sin estrenar, solo si apuntas partidas', () => {
  const list = parseCollection(XML).games;
  const mapped = mapBggGames(list);
  assert.deepEqual(mapped.map((g) => [g.title, g.status, g.score, g.platform, g.bggId]), [
    ['CATAN', 'jugado', 8, 'mesa-xl', 13],
    ["Ticket to Ride & Friends' Edition", 'pendiente', null, 'mesa-l', 9209],
  ]);
  const noLog = mapBggGames(list.map((g) => ({ ...g, plays: 0 })));
  assert.ok(noLog.every((g) => g.status !== 'pendiente'), 'si no apuntas partidas, no se da nada por sin estrenar');
  assert.equal(mapBggGames([{ id: 1, name: 'Brass', rating: 9.2, plays: 3 }])[0].status, 'favorito');
  assert.deepEqual([15, 30, 60, 180, null].map(boxForMinutes), ['mesa-s', 'mesa-m', 'mesa-l', 'mesa-xl', 'mesa-l']);
});

test('importar dos veces la colección de BGG no duplica nada (ni con otra caja)', () => {
  const mapped = mapBggGames(parseCollection(XML).games);
  assert.equal(store.importGames(mapped).added, 2);
  assert.equal(store.importGames(mapped).added, 0);
  assert.equal(store.importGames([{ kind: 'mesa', title: 'Catan', platform: 'mesa-s' }]).added, 0, 'mismo título, otra caja');
  assert.equal(store.getBoards().find((g) => g.title === 'CATAN').bggId, 13);
});
