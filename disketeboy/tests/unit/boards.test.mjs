import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import('../../js/store.js');
const { whatToPlay, playersText, minutesText, lentText, boardStats, pickOne, daysSince } = await import('../../js/boards.js');
const { computeLayout, KALLAX } = await import('../../js/layout.js');
const { encodeRoom, decodeRoom } = await import('../../js/share.js');
const { boxFor } = await import('../../js/platforms.js');
beforeEach(() => {
  mem.clear();
  store._reload();
});

const board = (title, over = {}) => store.cleanGame({ kind: 'mesa', title, minPlayers: 2, maxPlayers: 4, minutes: 45, ...over });

test('un juego de mesa se valida con sus propios campos', () => {
  const g = store.addGame({ kind: 'mesa', title: 'Catan', platform: 'ps5', status: 'terminado', minPlayers: '5', maxPlayers: '3', minutes: '2', plays: -4, lentTo: '  Pedro  ' });
  assert.equal(g.kind, 'mesa');
  assert.equal(g.platform, 'mesa-l', 'las plataformas de videojuegos no valen para un juego de mesa');
  assert.equal(g.status, 'jugado', 'los estados de videojuego no valen');
  assert.equal(g.minPlayers, 5);
  assert.equal(g.maxPlayers, 5, 'el máximo nunca es menor que el mínimo');
  assert.equal(g.minutes, 5);
  assert.equal(g.plays, 0);
  assert.equal(g.lentTo, 'Pedro');
  assert.ok(g.lentAt, 'al prestarlo se apunta la fecha');
  assert.equal(store.updateGame(g.id, { lentTo: '' }).lentAt, null, 'al devolverlo se borra la fecha');
  const v = store.addGame({ title: 'Hades', platform: 'mesa-l' });
  assert.equal(v.kind, 'video');
  assert.equal(v.platform, 'otra', 'un videojuego no puede tener caja de juego de mesa');
  assert.equal(v.minPlayers, undefined);
});

test('¡Hemos jugado!: suma partidas y estrena lo que tenía el plástico', () => {
  const g = store.addGame({ kind: 'mesa', title: 'Gloomhaven', status: 'pendiente' });
  const once = store.logPlay(g.id);
  assert.equal(once.plays, 1);
  assert.equal(once.status, 'jugado');
  assert.ok(once.lastPlayed);
  store.updateGame(g.id, { status: 'favorito' });
  assert.equal(store.logPlay(g.id).status, 'favorito', 'un favorito sigue siendo favorito');
  const v = store.addGame({ title: 'Celeste' });
  assert.equal(store.logPlay(v.id), null, 'los videojuegos no llevan partidas');
});

test('las estadísticas de videojuegos no cuentan los juegos de mesa', () => {
  store.importGames([{ title: 'A', status: 'pendiente' }, { kind: 'mesa', title: 'B', status: 'pendiente' }]);
  assert.equal(store.stats().total, 1);
  assert.equal(store.getVideoGames().length, 1);
  assert.equal(store.getBoards().length, 1);
});

test('¿Qué jugamos esta noche?: jugadores, tiempo, en casa y buen orden', () => {
  const list = [
    board('Largo', { minutes: 120, score: 10 }),
    board('Fiesta', { minPlayers: 4, maxPlayers: 8, minutes: 15, score: 7 }),
    board('Prestado', { lentTo: 'Ana' }),
    board('Favorito', { status: 'favorito', score: 6 }),
    board('Nuevo', { status: 'pendiente' }),
    board('Bueno', { score: 9, plays: 3 }),
    board('Bueno también', { score: 9, plays: 1 }),
  ];
  assert.deepEqual(whatToPlay(list, { players: 4, minutes: 60 }).map((g) => g.title), ['Favorito', 'Nuevo', 'Bueno también', 'Bueno', 'Fiesta']);
  assert.deepEqual(whatToPlay(list, { players: 6, minutes: 60 }).map((g) => g.title), ['Fiesta']);
  assert.ok(whatToPlay(list, { players: 4, minutes: 0 }).some((g) => g.title === 'Largo'), 'sin prisa entran los largos');
  assert.equal(whatToPlay(list, { players: 1, minutes: 60 }).length, 0);
});

test('textos de jugadores, duración y préstamos', () => {
  assert.equal(playersText(board('x', { minPlayers: 1, maxPlayers: 1 })), '1 jugador');
  assert.equal(playersText(board('x', { minPlayers: 2, maxPlayers: 2 })), '2 jugadores');
  assert.equal(playersText(board('x')), '2–4 jugadores');
  assert.deepEqual([minutesText(45), minutesText(60), minutesText(90), minutesText(120)], ['45 min', '1 h', '1 h 30 min', '2 h']);
  const now = new Date('2026-10-16T12:00:00Z');
  assert.equal(daysSince('2026-05-26T12:00:00Z', now), 143);
  assert.equal(lentText(board('Dixit', { lentTo: 'Pedro', lentAt: '2026-05-26T12:00:00Z' }), now), 'Lo tiene Pedro desde hace 143 días');
  assert.equal(lentText(board('Dixit', { lentTo: 'Pedro', lentAt: '2026-10-15T12:00:00Z' }), now), 'Lo tiene Pedro desde ayer');
  assert.equal(lentText(board('En casa')), '');
});

test('estadísticas de mesa y elegir al azar', () => {
  const bs = boardStats([board('A', { plays: 3 }), board('B', { plays: 10, lentTo: 'Ana' }), board('C', { status: 'pendiente' })]);
  assert.deepEqual([bs.total, bs.plays, bs.unplayed, bs.lent.length, bs.mostPlayed.title], [3, 13, 1, 1, 'B']);
  assert.equal(pickOne(['a', 'b', 'c'], () => 0.99), 'c');
  assert.equal(pickOne([], () => 0), null);
});

test('Kallax: los jugados de pie en los cubos y los sin estrenar encima', () => {
  const list = [board('Jugado'), board('Favorito', { status: 'favorito' }), board('Plástico', { status: 'pendiente' })];
  const { placements, counts } = computeLayout(list);
  assert.equal(placements.get(list[0].id).zone, 'kallax');
  assert.equal(placements.get(list[1].id).zone, 'kallax');
  const top = placements.get(list[2].id);
  assert.equal(top.zone, 'encima');
  assert.ok(top.y > KALLAX.height, 'encima de la Kallax');
  assert.deepEqual([counts.kallax, counts.encima], [2, 1]);
  const tidy = computeLayout(list, { tidy: true });
  assert.equal(tidy.placements.get(list[2].id).zone, 'kallax', 'al ordenar, todo a los cubos');
});

test('Kallax: cada cubo se llena sin pasarse y lo que sobra va encima', () => {
  const many = Array.from({ length: 40 }, (_, i) => board(`Juego ${String(i).padStart(2, '0')}`, { platform: i % 3 ? 'mesa-l' : 'mesa-xl' }));
  const { placements, counts } = computeLayout(many);
  assert.ok(counts.kallax > 20 && counts.encima > 0, JSON.stringify(counts));
  const cells = new Map();
  for (const g of many) {
    const p = placements.get(g.id);
    if (p.zone !== 'kallax') continue;
    const key = `${p.y.toFixed(3)}:${Math.floor((p.z - (KALLAX.z - KALLAX.width / 2)) / (KALLAX.cell + KALLAX.wall))}`;
    cells.set(key, (cells.get(key) || 0) + boxFor(g.platform).d);
  }
  for (const [key, used] of cells) assert.ok(used <= KALLAX.cell, `el cubo ${key} se pasa: ${used}`);
});

test('el enlace de visita lleva también los juegos de mesa', async () => {
  const g = board('Dixit', { lentTo: 'Pedro', plays: 15, minPlayers: 3, maxPlayers: 8, minutes: 30, status: 'favorito', score: 8 });
  const room = await decodeRoom(await encodeRoom([g, store.cleanGame({ title: 'Hades', platform: 'pc', status: 'terminado' })]));
  const [d, h] = room.games;
  assert.deepEqual([d.kind, d.title, d.minPlayers, d.maxPlayers, d.minutes, d.plays, d.lentTo, d.status, d.score], ['mesa', 'Dixit', 3, 8, 30, 15, 'Pedro', 'favorito', 8]);
  assert.equal(h.kind, 'video');
  assert.equal(h.status, 'terminado');
});
