import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/places.mjs';

test('places API: valida parámetros', async () => {
  for (const q of ['', '?cat=nope&lat=1&lng=1', '?cat=pharmacy&lat=abc&lng=1', '?cat=pharmacy&lat=99&lng=1']) {
    const r = await handler(new Request(`http://x/api/places${q}`));
    assert.equal(r.status, 400, q);
  }
});

test('places API sin clave usa OpenStreetMap y ordena por distancia', async (t) => {
  delete process.env.GOOGLE_PLACES_KEY;
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(String(url), /overpass/);
    return Response.json({ elements: [
      { type: 'node', id: 1, lat: 40.43, lon: -3.70, tags: { amenity: 'pharmacy', name: 'Lejana' } },
      { type: 'node', id: 2, lat: 40.4202, lon: -3.702, tags: { amenity: 'pharmacy', name: 'Cercana' } },
    ] });
  });
  const r = await handler(new Request('http://x/api/places?cat=pharmacy&lat=40.42&lng=-3.702'));
  const d = await r.json();
  assert.equal(d.source, 'osm');
  assert.deepEqual(d.places.map((p) => p.name), ['Cercana', 'Lejana']);
  assert.match(r.headers.get('cache-control'), /max-age/);
});

test('places API con clave usa Google Places y no filtra la clave', async (t) => {
  process.env.GOOGLE_PLACES_KEY = 'SECRETO';
  t.after(() => delete process.env.GOOGLE_PLACES_KEY);
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.match(String(url), /places\.googleapis\.com/);
    assert.equal(init.headers['X-Goog-Api-Key'], 'SECRETO');
    const body = JSON.parse(init.body);
    assert.deepEqual(body.includedTypes, ['restaurant']);
    return Response.json({ places: [
      { id: 'a', displayName: { text: 'Popular' }, location: { latitude: 40.421, longitude: -3.702 }, rating: 4.6, userRatingCount: 5000 },
      { id: 'b', displayName: { text: 'Pocas reseñas' }, location: { latitude: 40.4201, longitude: -3.702 }, rating: 5, userRatingCount: 3 },
    ] });
  });
  const r = await handler(new Request('http://x/api/places?cat=restaurant&lat=40.42&lng=-3.702'));
  const text = await r.text();
  assert.ok(!text.includes('SECRETO'));
  const d = JSON.parse(text);
  assert.equal(d.source, 'google');
  assert.equal(d.places[0].name, 'Popular');
});
