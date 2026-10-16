import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLayout, sortGames, BOOKCASE, ZONE_OF_STATUS } from '../../js/layout.js';
import { boxFor } from '../../js/platforms.js';

let n = 0;
const game = (over = {}) => ({
  id: `g${n++}`,
  title: `Juego ${n}`,
  platform: 'pc',
  status: 'jugado',
  score: null,
  hours: 0,
  color: null,
  addedAt: new Date(2026, 0, 1, 0, 0, n).toISOString(),
  ...over,
});

test('cada estado va a su zona', () => {
  const games = Object.keys(ZONE_OF_STATUS).map((status) => game({ status }));
  const { placements } = computeLayout(games);
  for (const g of games) assert.equal(placements.get(g.id).zone, ZONE_OF_STATUS[g.status], g.status);
});

test('ordenar la habitación lo manda todo a la estantería', () => {
  const games = ['pendiente', 'jugando', 'abandonado', 'terminado'].map((status) => game({ status }));
  const { placements, counts } = computeLayout(games, { tidy: true });
  assert.ok([...placements.values()].every((p) => p.zone === 'estanteria'));
  assert.equal(counts.estanteria, 4);
  assert.equal(counts.pila, 0);
});

test('mismo estado → misma habitación (determinista)', () => {
  const games = Array.from({ length: 40 }, (_, i) => game({ status: i % 3 ? 'jugado' : 'pendiente', platform: ['pc', 'ps1', 'n64', 'gb'][i % 4] }));
  const a = computeLayout(games);
  const b = computeLayout(games.map((g) => ({ ...g })));
  assert.deepEqual([...a.placements.entries()], [...b.placements.entries()]);
});

test('en la estantería las cajas no se solapan y caben en la balda', () => {
  const plats = ['pc', 'ps1', 'n64', 'gb', 'switch', 'snes', 'ps4', 'md'];
  const games = Array.from({ length: 180 }, (_, i) => game({ platform: plats[i % plats.length] }));
  const { placements } = computeLayout(games);
  const rows = new Map();
  for (const g of games) {
    const p = placements.get(g.id);
    if (p.zone !== 'estanteria') continue;
    const key = `${p.bookcase}:${(p.y - boxFor(g.platform).h / 2).toFixed(3)}`;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ x: p.x, d: boxFor(g.platform).d });
  }
  for (const [key, row] of rows) {
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++) {
      const gap = row[i].x - row[i].d / 2 - (row[i - 1].x + row[i - 1].d / 2);
      assert.ok(gap >= -1e-9, `solape en la balda ${key}`);
    }
    const span = row.at(-1).x + row.at(-1).d / 2 - (row[0].x - row[0].d / 2);
    assert.ok(span <= BOOKCASE.inner + 1e-9, `la fila ${key} se sale de la balda`);
  }
});

test('una colección grande desbloquea más estanterías', () => {
  const few = computeLayout(Array.from({ length: 10 }, () => game()));
  const many = computeLayout(Array.from({ length: 400 }, () => game()));
  assert.equal(few.bookcases, 1);
  assert.ok(many.bookcases >= 2, `esperaba ≥2 estanterías, hay ${many.bookcases}`);
});

test('la pila crece hacia arriba sin atravesar cajas', () => {
  const games = Array.from({ length: 12 }, () => game({ status: 'pendiente' }));
  const { placements } = computeLayout(games);
  const ys = games.map((g) => placements.get(g.id).y);
  assert.ok(ys[0] < ys[1] && ys[1] < ys[2], 'las primeras cajas se apilan en la misma columna');
  for (const g of games) assert.ok(placements.get(g.id).y > 0, 'nada por debajo del suelo');
});

test('la balda libre lleva decoración y la fila de cajas su sujetalibros', () => {
  const { decor } = computeLayout(Array.from({ length: 5 }, () => game()));
  assert.ok(decor.some((d) => d.kind === 'sujetalibros'));
  assert.ok(decor.some((d) => ['libros', 'trofeo', 'consola', 'figura'].includes(d.kind)));
});

test('ordenar por nota, A-Z, horas y color', () => {
  const games = [game({ title: 'b', score: 5, hours: 1, color: '#2050d0' }), game({ title: 'A', score: 9, hours: 0, color: '#d02020' }), game({ title: 'c', score: null, hours: 7, color: '#20d050' })];
  assert.deepEqual(sortGames(games, 'nota').map((g) => g.title), ['A', 'b', 'c']);
  assert.deepEqual(sortGames(games, 'az').map((g) => g.title), ['A', 'b', 'c']);
  assert.deepEqual(sortGames(games, 'horas').map((g) => g.title), ['c', 'b', 'A']);
  assert.deepEqual(sortGames(games, 'color').map((g) => g.title), ['A', 'c', 'b'], 'rojo, verde, azul');
});

test('el escritorio y la caja de abandonados no crecen hasta el techo', () => {
  const games = [...Array.from({ length: 40 }, () => game({ status: 'jugando' })), ...Array.from({ length: 40 }, () => game({ status: 'abandonado' }))];
  const { placements, counts } = computeLayout(games);
  assert.equal(counts.escritorio, 12);
  assert.equal(counts.caja, 24);
  assert.equal(counts.estanteria, 44, 'lo que sobra va a la estantería');
  const deskTop = Math.max(...games.filter((g) => placements.get(g.id).zone === 'escritorio').map((g) => placements.get(g.id).y));
  assert.ok(deskTop < 0.74 + 0.2, `torre de ${deskTop.toFixed(2)} m`);
});

test('una pila de la vergüenza enorme crece en altura sin salirse de sus columnas', () => {
  const games = Array.from({ length: 150 }, () => game({ status: 'pendiente' }));
  const { placements } = computeLayout(games);
  const xs = games.map((g) => placements.get(g.id).x);
  assert.ok(Math.max(...xs) - Math.min(...xs) < 1.5, 'la pila no invade toda la habitación');
});
