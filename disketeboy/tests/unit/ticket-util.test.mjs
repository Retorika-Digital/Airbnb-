import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { ticketLines } = await import('../../js/ticket.js');
const { hash, rng, colorFor, inkFor, titleKey, luminance } = await import('../../js/util.js');

const g = (title, over = {}) => ({ id: title, title, platform: 'pc', status: 'jugado', score: null, hours: 0, ...over });

test('el ticket cabe en 32 columnas y cuenta bien', () => {
  const games = [
    g('Un juego con un título larguísimo que no cabe en el ticket', { hours: 123.4, status: 'terminado', score: 9 }),
    g('Pendiente 1', { status: 'pendiente' }),
    g('Pendiente 2', { status: 'pendiente', platform: 'ps2' }),
  ];
  const lines = ticketLines(games, new Date(2026, 9, 15, 23, 5));
  for (const l of lines) assert.ok(l.text.length <= 32, `«${l.text}» mide ${l.text.length}`);
  const text = lines.map((l) => l.text).join('\n');
  assert.match(text, /JUEGOS\s+3/);
  assert.match(text, /PENDIENTE DE PAGO:\s+2 JUEGOS/);
  assert.match(text, /15\/10\/2026 23:05/);
  assert.match(text, /acabas en\s+DIC 2026/);
});

test('ticket con la pila a cero', () => {
  const text = ticketLines([g('Hecho', { status: 'terminado' })]).map((l) => l.text).join('\n');
  assert.match(text, /PILA DE LA VERGÜENZA A CERO/);
});

test('utilidades deterministas', () => {
  assert.equal(hash('hola'), hash('hola'));
  assert.notEqual(hash('hola'), hash('adiós'));
  const a = rng('x');
  const b = rng('x');
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.match(colorFor('Celeste'), /^#[0-9a-f]{6}$/);
  assert.equal(colorFor('Celeste'), colorFor('celeste'));
  assert.equal(titleKey('Pokémon: Edición ¡Roja!'), 'pokemon edicion roja');
  assert.ok(luminance('#ffffff') > luminance('#000000'));
  assert.equal(inkFor('#ffffff'), '#1d1a16');
  assert.equal(inkFor('#101010'), '#fdf6e3');
});

test('la habitación se decora sola según la fecha', async () => {
  const { seasonOf } = await import('../../js/util.js');
  assert.equal(seasonOf(new Date(2026, 9, 20)), 'halloween');
  assert.equal(seasonOf(new Date(2026, 10, 1)), 'halloween', 'hasta el día de Todos los Santos');
  assert.equal(seasonOf(new Date(2026, 10, 10)), null);
  assert.equal(seasonOf(new Date(2026, 11, 24)), 'navidad');
  assert.equal(seasonOf(new Date(2027, 0, 6)), 'navidad', 'hasta Reyes');
  assert.equal(seasonOf(new Date(2027, 0, 7)), null);
  assert.equal(seasonOf(new Date(2026, 5, 1), 'navidad'), 'navidad', 'se puede forzar para probar');
  assert.equal(seasonOf(new Date(2026, 9, 31), 'ninguna'), null, 'y quitar');
});

test('clima: llueve uno de cada tres días, todo el día, y en Navidad nieva', async () => {
  const { weatherOf } = await import('../../js/util.js');
  assert.equal(weatherOf(new Date(2026, 3, 1), 'lluvia'), 'lluvia', 'se puede forzar');
  assert.equal(weatherOf(new Date(2026, 3, 1), 'despejado'), 'despejado');
  assert.equal(weatherOf(new Date(2026, 11, 24), 'auto', 'navidad'), 'despejado', 'en Navidad, nieve en vez de lluvia');
  const year = Array.from({ length: 365 }, (_, i) => weatherOf(new Date(2026, 0, 1 + i)));
  const rainy = year.filter((w) => w === 'lluvia').length;
  assert.ok(rainy > 90 && rainy < 155, `días de lluvia en un año: ${rainy}`);
  assert.equal(weatherOf(new Date(2026, 4, 5, 9)), weatherOf(new Date(2026, 4, 5, 22)), 'el mismo tiempo todo el día');
});
