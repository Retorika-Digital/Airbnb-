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
