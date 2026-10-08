import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage mínimo en memoria para Node.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const store = await import('../../assets/js/store.js');
beforeEach(() => mem.clear());

test('Mi viaje: guardar y quitar con toggleTrip', () => {
  const place = { id: 'p1', name: 'Prado', lat: 1, lng: 2, extra: 'no se guarda' };
  assert.equal(store.toggleTrip('g', place), true);
  assert.equal(store.isInTrip('g', 'p1'), true);
  assert.equal(store.getTrip('g').items[0].extra, undefined);
  assert.equal(store.toggleTrip('g', place), false);
  assert.equal(store.getTrip('g').items.length, 0);
});

test('datos corruptos en localStorage no rompen nada', () => {
  mem.set('rh:trip:g', '{roto');
  mem.set('rh:stats:g', 'null');
  mem.set('rh:guide:g', '42');
  mem.set('rh:guides', '{"no":"array"}');
  assert.deepEqual(store.getTrip('g'), { items: [], notes: [] });
  assert.equal(store.getStats('g').opens, 0);
  assert.deepEqual(store.listLocalGuideIds(), []);
  store.track('g', 'open');
  assert.equal(store.getStats('g').opens, 1);
});

test('estadísticas antiguas sin campos nuevos se completan', () => {
  mem.set('rh:stats:g', JSON.stringify({ opens: 5 }));
  const s = store.getStats('g');
  assert.equal(s.opens, 5);
  assert.deepEqual(s.sections, {});
  store.track('g', 'ask', { q: '¿wifi?', answered: true });
  assert.equal(store.getStats('g').questions[0].q, '¿wifi?');
});

test('saveGuide devuelve false si no cabe', () => {
  const orig = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(store.saveGuide({ id: 'x' }), false);
  globalThis.localStorage.setItem = orig;
  assert.equal(store.saveGuide({ id: 'x' }), true);
  assert.deepEqual(store.listLocalGuideIds(), ['x']);
});

test('slugify', () => {
  assert.equal(store.slugify('Ático en Lavapiés · ★4,9'), 'atico-en-lavapies-4-9');
  assert.equal(store.slugify(''), 'guia');
});
