import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, distanceM, walkMinutes, ratingScore, rankPlaces, buildOverpassQuery, normalizeOverpass,
} from '../../assets/js/places-config.js';

test('distanceM: Sol → Gran Vía ≈ 450 m', () => {
  const d = distanceM({ lat: 40.41694, lng: -3.70361 }, { lat: 40.42008, lng: -3.70199 });
  assert.ok(d > 350 && d < 450, `distancia ${d}`);
});

test('walkMinutes: nunca 0 y crece con la distancia', () => {
  assert.equal(walkMinutes(0), 1);
  assert.ok(walkMinutes(1000) > walkMinutes(300));
  assert.equal(walkMinutes(640), 10);
});

test('ratingScore: muchas reseñas pesan más que una nota alta con pocas', () => {
  assert.ok(ratingScore(4.6, 3000) > ratingScore(4.9, 8));
  assert.equal(ratingScore(null, 100), 0);
});

test('rankPlaces: por distancia o por valoración', () => {
  const ps = [
    { name: 'lejos-top', distance: 900, rating: 4.8, reviews: 2000 },
    { name: 'cerca-flojo', distance: 100, rating: 3.9, reviews: 50 },
  ];
  assert.equal(rankPlaces(ps, 'distance')[0].name, 'cerca-flojo');
  assert.equal(rankPlaces(ps, 'rating')[0].name, 'lejos-top');
  assert.equal(ps[0].name, 'lejos-top', 'no muta la entrada');
});

test('buildOverpassQuery incluye todos los filtros y el radio', () => {
  const q = buildOverpassQuery('supermarket', 40.4, -3.7);
  assert.match(q, /shop"="supermarket/);
  assert.match(q, /shop"="convenience/);
  assert.match(q, new RegExp(`around:${CATEGORIES.supermarket.radius},40.4,-3.7`));
});

test('normalizeOverpass: nodos y vías, nombre por defecto, 24h, duplicados fuera', () => {
  const json = { elements: [
    { type: 'node', id: 1, lat: 40.4201, lon: -3.702, tags: { amenity: 'pharmacy', opening_hours: '24/7' } },
    { type: 'way', id: 2, center: { lat: 40.421, lon: -3.703 }, tags: { amenity: 'pharmacy', name: 'Farmacia Sol', 'addr:street': 'Calle Mayor', 'addr:housenumber': '1' } },
    { type: 'node', id: 3, lat: 40.421, lon: -3.703, tags: { amenity: 'pharmacy', name: 'Farmacia Sol', 'addr:street': 'Calle Mayor', 'addr:housenumber': '1' } },
    { type: 'node', id: 4, tags: { name: 'sin coordenadas' } },
  ] };
  const out = normalizeOverpass(json, 'pharmacy', { lat: 40.42, lng: -3.702 });
  assert.equal(out.length, 2);
  assert.equal(out[0].name, 'Farmacia');
  assert.equal(out[0].is24h, true);
  assert.equal(out[1].address, 'Calle Mayor, 1');
  assert.match(out[1].mapsUrl, /travelmode=walking/);
});
