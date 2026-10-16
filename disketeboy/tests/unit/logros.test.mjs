import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLogros, counters, logrosOf, LOGROS } from '../../js/logros.js';

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), raw: m };
};
const video = (over = {}) => ({ kind: 'video', title: 'X', platform: 'pc', status: 'jugado', score: null, hours: 0, review: '', ...over });

test('cada logro tiene id único, nivel, icono y texto', () => {
  assert.equal(new Set(LOGROS.map((l) => l.id)).size, LOGROS.length);
  for (const l of LOGROS) {
    assert.ok(['bronce', 'plata', 'oro'].includes(l.tier), l.id);
    assert.ok(l.icon && l.title && l.text, l.id);
  }
});

test('la primera vez apunta lo que ya tenías sin celebrarlo; luego celebra lo nuevo', () => {
  const storage = memory();
  const logros = createLogros({ storage });
  assert.deepEqual(logros.check([video()]), [], 'primera vez: en silencio');
  assert.equal(logros.count(), 1, 'pero «Primer disquete» queda apuntado');
  const nuevos = logros.check([video({ status: 'terminado', score: 10 })]);
  assert.deepEqual(nuevos.map((l) => l.id).sort(), ['creditos-finales', 'obra-maestra']);
  assert.deepEqual(logros.check([video({ status: 'terminado', score: 10 })]), [], 'no se repiten');
  const again = createLogros({ storage });
  assert.equal(again.count(), 3, 'se guardan con su fecha');
  assert.ok(again.list().find((l) => l.id === 'obra-maestra').got);
});

test('las travesuras también cuentan: acariciar al gato diez veces', () => {
  const logros = createLogros({ storage: memory() });
  logros.check([]);
  for (let i = 0; i < 9; i++) logros.event('gato');
  assert.deepEqual(logros.check([]), []);
  logros.event('gato');
  assert.deepEqual(logros.check([]).map((l) => l.id), ['amigo-del-gato']);
  logros.event('trampa');
  assert.equal(logros.list().filter((l) => l.got).length, 1, 'un evento inventado no hace nada');
});

test('datos rotos o manipulados no rompen nada', () => {
  const storage = memory();
  storage.setItem('dkb:logros:v1', '{roto');
  assert.deepEqual(createLogros({ storage }).check([video()]), [], 'roto: se empieza de cero, en silencio');
  storage.setItem('dkb:logros:v1', JSON.stringify({ got: { inventado: 'x', museo: 42 }, ev: { gato: 'muchos' } }));
  const l = createLogros({ storage });
  assert.equal(l.count(), 0, 'solo valen ids conocidos con fecha');
});

test('contadores de una colección variada', () => {
  const c = counters([
    video({ platform: 'snes', status: 'terminado', hours: 30, review: '¡Genial!' }),
    video({ platform: 'ps1', status: 'pendiente', steamAppId: 10 }),
    { kind: 'mesa', title: 'Catan', plays: 3, lentTo: 'Pedro' },
    { kind: 'mazo', title: 'Burn', wins: 12 },
    { kind: 'carpeta', title: 'Foils', cards: 1200 },
  ]);
  assert.deepEqual([c.total, c.beaten, c.backlog, c.retro, c.platforms, c.hours, c.steam, c.plays, c.lent, c.bestWins, c.cards, c.reviews], [5, 1, 1, 2, 2, 30, 1, 3, 1, 12, 1200, 1]);
});

test('de visita se ven los logros de la colección, sin fechas ni travesuras', () => {
  const got = logrosOf([video({ status: 'terminado' })]).filter((l) => l.got).map((l) => l.id);
  assert.deepEqual(got.sort(), ['creditos-finales', 'primer-disquete']);
});
