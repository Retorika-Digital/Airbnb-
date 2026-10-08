import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setLang, t, loc } from '../../assets/js/i18n.js';
import { buildIndex, ask } from '../../assets/js/faq.js';
import { nowTip, isNight, countdown } from '../../assets/js/now.js';
import { uberLink, directionsLink, telLink, whatsappLink } from '../../assets/js/mobility.js';

const g = JSON.parse(readFileSync(new URL('../../data/guides/granvia.json', import.meta.url)));
setLang('es');

test('i18n: 5 idiomas, respaldo en inglés y textos multidioma', () => {
  setLang('de');
  assert.equal(t('sec.wifi'), 'WLAN');
  assert.equal(t('seeMore'), 'See more picks', 'clave sin traducir → inglés');
  assert.equal(loc({ es: 'Hola', en: 'Hi' }), 'Hi');
  setLang('xx');
  assert.equal(t('sec.wifi'), 'WiFi');
  setLang('es');
  assert.equal(t('welcomeHi', { name: 'Laura' }), '¡Hola, Laura!');
  assert.ok(Array.isArray(t('askSuggest')));
});

test('FAQ: responde las preguntas típicas en varios idiomas', () => {
  const idx = buildIndex(g);
  const top = (q) => ask(idx, q)[0]?.title;
  assert.equal(top('¿Cuál es la contraseña del wifi?'), 'WiFi');
  assert.equal(top('a qué hora tengo que irme'), 'Check-out');
  assert.equal(top('dónde tiro la basura'), 'Basura y reciclaje');
  assert.equal(top('puedo dejar las maletas'), 'Equipaje');
  assert.equal(top('código del portal'), 'Acceso al edificio');
  assert.equal(top('se puede fumar'), 'Normas de la casa');
  assert.equal(top('mot de passe wifi'), 'WiFi');
  assert.equal(top('Wo ist die Apotheke?'), 'Cerca de mí');
  assert.equal(top('cómo llego al aeropuerto'), 'Moverme');
  assert.deepEqual(ask(idx, 'tenéis piscina'), []);
  assert.deepEqual(ask(idx, '   '), []);
  assert.match(ask(idx, 'wifi')[0].text, /GranVia24!/);
});

const at = (h, d = '2026-10-09') => new Date(`${d}T${String(h).padStart(2, '0')}:00:00`);

test('Ahora mismo: cambia con la hora, la lluvia y los días de llegada/salida', () => {
  const recs = { ...g, recommendations: { eat: g.recommendations.eat.map((p) => ({ ...p, minutes: 5 })), do: g.recommendations.do } };
  assert.equal(nowTip(recs, { now: at(9), lang: 'es' }).key, 'breakfast');
  assert.equal(nowTip(recs, { now: at(9), lang: 'es' }).action.place.name, 'Celicioso');
  assert.equal(nowTip(recs, { now: at(13), lang: 'es' }).key, 'lunch');
  assert.equal(nowTip(recs, { now: at(17), lang: 'es' }).key, 'afternoon');
  assert.equal(nowTip(recs, { now: at(17), rain: true, lang: 'es' }).key, 'rainy');
  assert.equal(nowTip(recs, { now: at(17), rain: true, lang: 'es' }).action.place.name, 'Museo del Prado');
  assert.equal(nowTip(recs, { now: at(21), lang: 'es' }).key, 'dinner');
  assert.equal(nowTip(recs, { now: at(2), lang: 'es' }).action.section, 'move');
  const stay = { in: '2026-10-09', out: '2026-10-12', nights: 3 };
  assert.equal(nowTip(recs, { now: at(10), stay, lang: 'es' }).key, 'arrival');
  assert.equal(nowTip(recs, { now: at(9, '2026-10-12'), stay, lang: 'es' }).key, 'checkout');
  assert.match(nowTip(recs, { now: at(21), lang: 'fr' }).title, /dîner/);
});

test('Modo noche de 21:00 a 7:00 y forzable', () => {
  assert.equal(isNight(at(22)), true);
  assert.equal(isNight(at(6)), true);
  assert.equal(isNight(at(12)), false);
  assert.equal(isNight(at(12), '1'), true);
  assert.equal(isNight(at(23), '0'), false);
});

test('Cuenta atrás de la estancia', () => {
  setLang('es');
  const stay = { in: '2026-10-10', out: '2026-10-13', nights: 3 };
  assert.equal(countdown(stay, g, at(12, '2026-10-07')), 'Faltan 3 días ✈️');
  assert.equal(countdown(stay, g, at(12, '2026-10-09')), '¡Mañana llegas! ✈️');
  assert.match(countdown(stay, g, at(12, '2026-10-10')), /Hoy llegas.*15:00/);
  assert.equal(countdown(stay, g, at(12, '2026-10-11')), 'Noche 2 de 3');
  assert.match(countdown(stay, g, at(8, '2026-10-13')), /check-out.*11:00/);
  assert.equal(countdown(stay, g, at(8, '2026-10-20')), '¡Gracias por venir! ♡');
});

test('Movilidad: enlaces sin apps', () => {
  const home = { lat: 40.42, lng: -3.70, name: 'Casa', address: 'Gran Vía 24' };
  const u = new URL(uberLink({ pickup: home, dropoff: { lat: 40.49, lng: -3.59, name: 'T4' } }));
  assert.equal(u.hostname, 'm.uber.com');
  assert.equal(u.searchParams.get('pickup[latitude]'), '40.42');
  assert.equal(u.searchParams.get('dropoff[nickname]'), 'T4');
  assert.equal(new URL(uberLink({ dropoff: home })).searchParams.get('pickup'), 'my_location');
  const d = new URL(directionsLink({ origin: home, destination: 'Metro Sol, Madrid', mode: 'transit', waypoints: [home] }));
  assert.equal(d.searchParams.get('destination'), 'Metro Sol, Madrid');
  assert.equal(d.searchParams.get('travelmode'), 'transit');
  assert.equal(d.searchParams.get('waypoints'), '40.42,-3.7');
  assert.equal(telLink('+34 91 447-51 80'), 'tel:+34914475180');
  assert.equal(whatsappLink('+34 600 00 00 00', 'Hola ¿qué tal?'), 'https://wa.me/34600000000?text=Hola%20%C2%BFqu%C3%A9%20tal%3F');
});

test('Guía demo: datos completos y válidos', () => {
  assert.ok(g.property.lat && g.property.lng);
  assert.ok(g.wifi.ssid && g.wifi.password);
  assert.ok(g.emergencies.some((e) => e.phone === '112' && e.primary));
  for (const p of [...g.recommendations.eat, ...g.recommendations.do]) {
    assert.ok(p.id && p.name && Number.isFinite(p.lat) && Number.isFinite(p.lng), p.name);
  }
  const ids = [...g.recommendations.eat, ...g.recommendations.do].map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'ids únicos');
});
