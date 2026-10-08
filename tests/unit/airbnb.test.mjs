import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { parseListing, resolveListingId } from '../../api/airbnb.mjs';

const HTML = `<html><head>
<meta property="og:title" content="Apartamento en Madrid · ★4,87 · 1 habitación · 1 cama · 1 baño">
<meta name="description" content="Luminoso piso en plena Gran Vía">
<meta property="og:image" content="https://a0.muscache.com/im/pictures/og.jpg"></head><body>
<script>{"lat":40.4201,"lng":-3.7021,"hostName":"Belén","title":"Wifi","title":"Cocina","title":"Air conditioning"}</script>
<div>Llegada: a partir de las 15:00</div><div>Salida antes de las 11:00</div><span>4 huéspedes</span>
https://a0.muscache.com/im/pictures/miso/Hosting-1/original/aaa.jpeg
https://a0.muscache.com/im/pictures/user/User-1/original/avatar.jpeg
</body></html>`;

test('parseListing extrae los datos públicos del anuncio', () => {
  const d = parseListing(HTML, '123');
  assert.equal(d.name, 'Luminoso piso en plena Gran Vía');
  assert.equal(d.type, 'Apartamento');
  assert.equal(d.city, 'Madrid');
  assert.equal(d.rating, 4.87);
  assert.equal(d.lat, 40.4201);
  assert.equal(d.lng, -3.7021);
  assert.equal(d.hostName, 'Belén');
  assert.equal(d.checkIn, '15:00');
  assert.equal(d.checkOut, '11:00');
  assert.deepEqual(d.amenities, ['Wifi', 'Cocina', 'Aire acondicionado']);
  assert.equal(d.maxGuests, 4);
  assert.ok(d.photos.every((u) => !/user/.test(u)), 'sin fotos de perfil');
  assert.deepEqual(d.warnings, []);
});

test('parseListing: horas en formato AM/PM y avisos cuando falta información', () => {
  const d = parseListing('<meta property="og:title" content="Loft in Paris · ★4.9"><p>Check-in after 3:00 PM</p><p>Checkout before 10 AM</p>', '9');
  assert.equal(d.checkIn, '15:00');
  assert.equal(d.checkOut, '10:00');
  assert.equal(d.city, 'Paris');
  assert.ok(d.warnings.includes('coords'));
  assert.ok(d.warnings.includes('host'));
});

test('resolveListingId solo acepta dominios de Airbnb (anti-SSRF)', async () => {
  assert.equal(await resolveListingId('https://www.airbnb.es/rooms/12345678?adults=2'), '12345678');
  assert.equal(await resolveListingId('https://es.airbnb.com/rooms/plus/999'), '999');
  assert.equal(await resolveListingId('https://www.airbnb.co.uk/rooms/42'), '42');
  assert.equal(await resolveListingId('https://evil.com/rooms/1'), null);
  assert.equal(await resolveListingId('https://airbnb.es.evil.com/rooms/1'), null);
  assert.equal(await resolveListingId('no es una url'), null);
});

test('handler: 400 sin url o con url ajena', async () => {
  let r = await handler(new Request('http://x/api/airbnb'));
  assert.equal(r.status, 400);
  r = await handler(new Request('http://x/api/airbnb?url=https://evil.com/rooms/1'));
  assert.equal(r.status, 400);
  assert.equal((await r.json()).ok, false);
});

test('handler: lee el anuncio y devuelve JSON (fetch simulado)', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    assert.match(String(url), /^https:\/\/www\.airbnb\.es\/rooms\/777/);
    return new Response(HTML, { status: 200 });
  });
  const r = await handler(new Request('http://x/api/airbnb?url=' + encodeURIComponent('https://www.airbnb.com/rooms/777')));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.url, 'https://www.airbnb.es/rooms/777');
});

test('handler: 502 si Airbnb falla', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('no', { status: 403 }));
  const r = await handler(new Request('http://x/api/airbnb?url=https://www.airbnb.es/rooms/1'));
  assert.equal(r.status, 502);
});
