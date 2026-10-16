import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { encodeRoom, decodeRoom, visitUrl } = await import('../../js/share.js');

const games = [
  { title: 'Hollow Knight', platform: 'pc', status: 'terminado', score: 10, hours: 62, steamAppId: 367520, review: 'Precioso. '.repeat(30), color: '#334455' },
  { title: 'Pokémon Rojo', platform: 'gb', status: 'pendiente', score: null, hours: 0, steamAppId: null, review: '', color: null },
];

test('el enlace de visita va y vuelve sin perder nada importante', async () => {
  const data = await encodeRoom(games, { name: 'Laura' });
  assert.match(data, /^[\w-]+$/, 'solo caracteres seguros para una URL');
  const room = await decodeRoom(data);
  assert.equal(room.name, 'Laura');
  assert.deepEqual(room.games.map((g) => [g.title, g.platform, g.status, g.score, g.hours, g.steamAppId, g.color]), [
    ['Hollow Knight', 'pc', 'terminado', 10, 62, 367520, '#334455'],
    ['Pokémon Rojo', 'gb', 'pendiente', null, 0, null, null],
  ]);
  const len = room.games[0].review.length;
  assert.ok(len > 130 && len <= 140, `las reseñas se recortan a 140 caracteres para que el enlace no sea eterno (mide ${len})`);
  assert.equal(visitUrl('https://x.es/disketeboy/', 'abc'), 'https://x.es/disketeboy/#visita=abc');
});

test('un enlace roto o manipulado no rompe nada', async () => {
  await assert.rejects(() => decodeRoom('esto-no-es-un-enlace'), /roto/);
  await assert.rejects(() => decodeRoom(''), /roto/);
  const evil = await encodeRoom([{ title: '<img src=x onerror=alert(1)>', platform: '../../etc', status: 'x', score: 99, hours: -1 }]);
  const room = await decodeRoom(evil);
  assert.equal(room.games[0].platform, 'otra');
  assert.equal(room.games[0].score, 10);
  assert.equal(room.games[0].hours, 0);
});

test('una colección de 300 juegos cabe en un enlace razonable', async () => {
  const many = Array.from({ length: 300 }, (_, i) => ({ title: `Juego número ${i}`, platform: 'pc', status: 'jugado', score: i % 11, hours: i, steamAppId: 1000 + i, review: '' }));
  const data = await encodeRoom(many);
  assert.ok(data.length < 8000, `mide ${data.length} caracteres`);
  assert.equal((await decodeRoom(data)).games.length, 300);
});

test('la visita ve la habitación con su tema y su gato', async () => {
  const room = await decodeRoom(await encodeRoom(games, { name: 'Laura', theme: 'gamer', pet: false }));
  assert.deepEqual(room.look, { theme: 'gamer', pet: false });
  const raw = async (obj) => {
    const bytes = new Uint8Array(await new Response(new Blob([JSON.stringify(obj)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const old = await decodeRoom(await raw({ v: 1, n: 'Antiguo', g: [['Tetris', 'gb', 2, 8, 30, 0, '', '']] }));
  assert.deepEqual(old.look, {}, 'los enlaces sin aspecto usan el de quien visita');
  const evil = await decodeRoom(await raw({ v: 1, n: '', t: '<script>', p: 'sí', g: [] }));
  assert.deepEqual(evil.look, {}, 'un tema inventado se ignora');
});
