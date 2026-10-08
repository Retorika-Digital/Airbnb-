// Pruebas de extremo a extremo en un navegador real (Chromium + Playwright).
//   npm run test:e2e            (arranca el servidor solo)
//   E2E_SHOTS=1 npm run test:e2e  → guarda capturas en tests/e2e/out/
// La red externa (OpenStreetMap, mapas, tiempo, fotos) se simula para que las
// pruebas sean deterministas y funcionen sin conexión.
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.E2E_SHOTS ? `${ROOT}tests/e2e/out` : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const AXE = `${ROOT}node_modules/axe-core/axe.min.js`;

// --- Mini arnés ---------------------------------------------------------------
const results = [];
async function check(name, fn) {
  const t0 = Date.now();
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`  ✔ ${name} (${Date.now() - t0} ms)`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`  ✘ ${name}\n    ${String(err.stack || err).split('\n').slice(0, 3).join('\n    ')}`);
  }
}
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => expect(a === b, `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);

// --- Red simulada -------------------------------------------------------------
function fakeOverpass(body) {
  const q = decodeURIComponent(String(body).replace(/\+/g, ' '));
  const [, lat, lng] = q.match(/around:\d+,(-?[\d.]+),(-?[\d.]+)/).map(Number);
  const sets = [
    [/pharmacy/, ['Farmacia 24H', 'Farmacia Montera'], { amenity: 'pharmacy' }],
    [/supermarket/, ['Mercadona', 'Dia'], { shop: 'supermarket' }],
    [/cafe/, ['Café Federal', 'Toma Café'], { amenity: 'cafe' }],
    [/restaurant/, ['Casa Labra', 'Lhardy', 'Botín'], { amenity: 'restaurant' }],
    [/station|subway/, ['Gran Vía', 'Callao'], { railway: 'station' }],
    [/parking/, ['Parking Carmen'], { amenity: 'parking' }],
    [/tourism/, ['Reina Sofía', 'Bellas Artes'], { tourism: 'museum' }],
    [/hospital/, ['Hospital Clínico'], { amenity: 'hospital' }],
  ];
  const [, names, tags] = sets.find(([re]) => re.test(q)) || sets[0];
  return { elements: names.map((name, i) => ({ type: 'node', id: i + 1, lat: lat + (i + 1) * 0.001, lon: lng + 0.001, tags: { ...tags, name, ...(i === 0 && /pharmacy/.test(q) ? { opening_hours: '24/7' } : {}) } })) };
}
const IMG = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#9cc2e8"/></svg>';

async function newPage(browser, viewport = { width: 390, height: 844 }, locale = 'es-ES') {
  const ctx = await browser.newContext({ viewport, locale, serviceWorkers: 'block' });
  await ctx.route(/overpass/, (r) => r.fulfill({ json: fakeOverpass(r.request().postData() || '') }));
  await ctx.route(/open-meteo/, (r) => r.fulfill({ json: { current: { temperature_2m: 21, weather_code: 1 }, daily: { time: ['a', '2026-10-08', '2026-10-09', '2026-10-10'], temperature_2m_max: [1, 2, 3, 4], temperature_2m_min: [1, 1, 1, 1], weather_code: [1, 1, 1, 1] } } }));
  await ctx.route(/cartocdn|unsplash|muscache/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: IMG }));
  await ctx.route(/nominatim/, (r) => r.fulfill({ json: [{ lat: '40.4229', lon: '-3.6989', address: { city: 'Madrid' } }] }));
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.fulfill({ body: '' }));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  return page;
}
const shot = (p, n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.png` });

// --- Servidor -----------------------------------------------------------------
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), GOOGLE_PLACES_KEY: '' }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* aún arrancando */ }
  await new Promise((r) => setTimeout(r, 100));
}

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});

console.log('\nGuía del huésped');
const p = await newPage(browser);
await check('el tablón carga con saludo, 10 notas y camino punteado', async () => {
  await p.goto(`${BASE}/?guide=granvia&g=Laura&in=2030-03-01&out=2030-03-04&time=13`);
  await p.waitForSelector('.note[data-section]');
  eq(await p.$$eval('.note[data-section]', (n) => n.length), 10, 'notas');
  expect((await p.textContent('.note--welcome h1')).includes('Laura'), 'saludo personalizado');
  expect((await p.getAttribute('.board__thread path', 'd')).startsWith('M'), 'camino dibujado');
  expect(await p.isVisible('.ticket__count'), 'cuenta atrás visible');
  await p.waitForFunction(() => document.querySelector('.postcard__temp')?.textContent.includes('21'));
  await shot(p, 'tablon');
});
await check('nota "Ahora mismo" a mediodía abre la ficha de un restaurante', async () => {
  expect((await p.textContent('[data-now]')).includes('Casa Lucio'), 'recomienda comida');
  await p.click('[data-now]');
  await p.waitForSelector('.place-detail .host-says');
  await p.keyboard.press('Escape');
  await p.waitForSelector('.place-detail', { state: 'detached' });
});
await check('vista general (zoom out) y vuelta', async () => {
  await p.click('#btn-left');
  await p.waitForSelector('.board-viewport.is-overview');
  const scale = await p.$eval('#board', (b) => b.style.transform);
  expect(/scale\(0\.\d+\)/.test(scale), `escala ${scale}`);
  await p.click('#btn-left');
  await p.waitForSelector('.board-viewport:not(.is-overview)');
});
await check('abrir WiFi levantando la nota: contraseña, copiar y QR', async () => {
  await p.click('.note[data-section="wifi"]');
  await p.waitForSelector('.wifi__pass');
  eq((await p.textContent('.wifi__pass')).trim(), 'GranVia24!', 'contraseña');
  expect(await p.$('.qr svg'), 'QR del WiFi');
  expect(p.url().endsWith('#/s/wifi'), 'ruta');
  await p.waitForSelector('.flip-ghost', { state: 'detached' });
});
await check('navegar a la siguiente sección con la flecha', async () => {
  await p.click('.sheet__nav[href="#/s/checkin"]');
  await p.waitForSelector('[data-step]');
  await p.$$eval('[data-step]', (cs) => cs.forEach((c) => c.click()));
  await p.waitForSelector('.toast.is-visible');
});
await check('Cerca de mí: mapa, chinchetas y lista ordenada por distancia', async () => {
  await p.goto(`${BASE}/?guide=granvia#/s/nearby`);
  await p.waitForSelector('#nearby-list .place');
  const mins = await p.$$eval('#nearby-list .place__meta', (els) => els.map((e) => Number((e.textContent.match(/(\d+) min/) || [])[1])));
  expect(mins.every((m, i) => !i || m >= mins[i - 1]), `orden ${mins}`);
  expect((await p.$$('.leaflet-marker-icon')).length > 2, 'chinchetas en el mapa');
  await p.click('[data-cat="pharmacy"]');
  await p.waitForFunction(() => document.querySelector('#nearby-list')?.textContent.includes('Farmacia 24H'));
  expect((await p.textContent('#nearby-list')).includes('24h'), 'etiqueta 24h');
});
await check('Comer: guardar en Mi viaje (♥) y sugerencias automáticas', async () => {
  await p.goto(`${BASE}/?guide=granvia#/s/eat`);
  const hearts = await p.$$('#reco-list [data-heart]');
  await hearts[0].click(); await hearts[1].click(); await hearts[2].click();
  eq(await p.$$eval('#reco-list [data-heart].is-on', (h) => h.length), 3, 'corazones activos');
  await p.click('[data-filter="__auto"]');
  await p.waitForFunction(() => document.querySelector('#reco-list')?.textContent.includes('Casa Labra'));
});
await check('regresión: navegar entre secciones no duplica los clics (♥ cambia una vez)', async () => {
  for (const sec of ['house', 'wifi', 'do', 'eat']) {
    await p.evaluate((h) => { location.hash = h; }, `#/s/${sec}`);
    await p.waitForSelector(`.sheet__title`);
  }
  await p.waitForSelector('#reco-list [data-heart]');
  const btn = (await p.$$('#reco-list [data-heart]'))[3];
  const before = await btn.evaluate((b) => b.classList.contains('is-on'));
  await btn.click();
  eq(await btn.evaluate((b) => b.classList.contains('is-on')), !before, 'el corazón cambia de estado');
  await btn.click();
});
await check('Mi viaje: polaroids, hilo rojo, nota propia, arrastrar y ordenar', async () => {
  await p.goto(`${BASE}/?guide=granvia&in=2026-10-08&out=2026-10-11#/s/trip`);
  await p.waitForSelector('[data-trip-item]');
  eq(await p.$$eval('[data-trip-item]', (n) => n.length), 3, 'polaroids');
  await p.waitForFunction(() => document.querySelector('.trip-yarn path')?.getAttribute('d'));
  await p.fill('#trip-note-form input', 'Comprar turrón');
  await p.click('#trip-note-form button');
  await p.waitForFunction(() => document.querySelector('.trip-grid')?.textContent.includes('Comprar turrón'));
  const order = () => p.$$eval('[data-trip-item] figcaption', (e) => e.map((x) => x.textContent));
  const before = await order();
  const boxes = await p.$$eval('[data-trip-item]', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  await p.mouse.move(...boxes[0]); await p.mouse.down(); await p.waitForTimeout(250);
  await p.mouse.move(...boxes[1], { steps: 10 }); await p.mouse.up();
  await p.waitForTimeout(400);
  const after = await order();
  eq(after[1], before[0], 'el primero pasa a segunda posición');
  await p.click('[data-optimize]');
  await p.waitForSelector('.toast.is-visible');
  expect((await p.getAttribute('.actions a.btn--primary', 'href')).includes('waypoints'), 'ruta con paradas');
  await shot(p, 'mi-viaje');
});
await check('Moverme: Uber web con destino y teléfonos de taxi', async () => {
  await p.goto(`${BASE}/?guide=granvia#/s/move`);
  await p.click('[data-dest="d0"]');
  const href = await p.getAttribute('.taxi-card a.btn--primary', 'href');
  const u = new URL(href);
  eq(u.hostname, 'm.uber.com', 'Uber web');
  eq(u.searchParams.get('dropoff[nickname]'), 'Aeropuerto T4', 'destino');
  eq((await p.textContent('.taxi-card__addr')).trim(), 'Aeropuerto T4', 'tarjeta del taxista');
  expect((await p.$$('a[href^="tel:+34"]')).length >= 3, 'radio-taxis');
});
await check('¿Tienes dudas?: respuesta de la guía y WhatsApp si no sabe', async () => {
  await p.click('[data-ask]');
  await p.fill('.ask-form input', '¿a qué hora es el check-out?');
  await p.press('.ask-form input', 'Enter');
  await p.waitForSelector('.answer h3');
  eq(await p.textContent('.answer h3'), 'Check-out', 'respuesta');
  await p.fill('.ask-form input', '¿tenéis piscina?');
  await p.press('.ask-form input', 'Enter');
  await p.waitForSelector('.answer--none a[href^="https://wa.me/"]');
  await p.keyboard.press('Escape');
});
await check('Emergencias: 112 y farmacia 24h primero', async () => {
  await p.goto(`${BASE}/?guide=granvia#/s/emergency`);
  expect(await p.$('a[href="tel:112"]'), 'enlace al 112');
  await p.waitForSelector('#pharmacy-list .place');
  expect((await p.textContent('#pharmacy-list .place')).includes('24h'), 'farmacia 24h la primera');
});
await check('idiomas: menú y cambio a alemán', async () => {
  await p.goto(`${BASE}/?guide=granvia`);
  await p.click('#btn-lang');
  await p.click('[data-lang="de"]');
  await p.waitForFunction(() => document.querySelector('.note[data-section="wifi"] .note__title')?.textContent === 'WLAN');
  await p.click('#btn-lang');
  await p.click('[data-lang="es"]');
});
await check('modo noche con guirnalda', async () => {
  await p.goto(`${BASE}/?guide=granvia&night=1&time=22`);
  await p.waitForSelector('.lights .bulb');
  expect(await p.evaluate(() => document.body.classList.contains('is-night')), 'clase is-night');
  await shot(p, 'noche');
});
await check('sin errores de JavaScript en la guía', async () => eq(p.errors.length, 0, `errores: ${p.errors.join(' | ')}`));

console.log('\nPanel del propietario');
const d = await newPage(browser, { width: 1366, height: 900 });
await check('importar: error claro si Airbnb no responde → ejemplo → crear guía', async () => {
  await d.route(/api\/airbnb/, (r) => r.fulfill({ status: 502, json: { ok: false, error: 'Airbnb respondió 403' } }));
  await d.goto(`${BASE}/panel.html#/nuevo`);
  await d.fill('#import-form input', 'https://www.airbnb.es/rooms/123');
  await d.click('#import-form button');
  await d.waitForSelector('.hint-box--warn');
  await d.click('#import-out [data-act="demo"]');
  await d.waitForSelector('.import-log li');
  await d.waitForFunction(() => document.querySelectorAll('#mini-board > *').length >= 2);
  await d.click('#to-s3');
  await d.waitForSelector('#auto-out .pick');
  expect((await d.$$('#auto-out input:checked')).length >= 4, 'preseleccionados');
  await d.click('#to-s4');
  await d.fill('#f-ssid', 'LoftChueca'); await d.fill('#f-pass', 'Chueca2026');
  await d.click('#create');
  await d.waitForURL(/#\/editar\/loft-luminoso-en-chueca/);
  await d.waitForSelector('#preview');
});
await check('importar: datos reales del servidor (respuesta simulada)', async () => {
  await d.route(/api\/airbnb/, (r) => r.fulfill({ json: { ok: true, name: 'Ático Lavapiés', city: 'Madrid', lat: 40.408, lng: -3.70, photos: [], hostName: 'Belén', checkIn: '16:00', checkOut: '11:00', amenities: ['Wifi'], warnings: ['photos'] } }));
  await d.goto(`${BASE}/panel.html#/nuevo`);
  await d.fill('#import-form input', 'https://www.airbnb.es/rooms/1');
  await d.click('#import-form button');
  await d.waitForSelector('.import-log li.warn');
  eq(await d.inputValue('#f-name'), 'Ático Lavapiés', 'nombre autocompletado');
});
await check('editor: guardar cambios se ve en la vista previa del móvil', async () => {
  await d.goto(`${BASE}/panel.html#/editar/granvia`);
  await d.click('summary:has-text("WiFi")');
  await d.fill('#f-wifi-ssid', 'RedNueva');
  await d.click('button:has-text("Guardar cambios")');
  const frame = d.frameLocator('#preview');
  await frame.locator('.note[data-section="wifi"] .note__hint', { hasText: 'RedNueva' }).waitFor();
  await d.click('#reset');
});
await check('editor: nota por recomendación viaja con la fila al reordenar', async () => {
  await d.fill('[data-reco-desc="eat:0"]', 'Nota de prueba');
  await d.click('[data-reco-move="eat:0:1"]');
  await d.waitForTimeout(300);
  eq(await d.inputValue('[data-reco-desc="eat:1"]'), 'Nota de prueba', 'nota en su fila');
  await d.click('#reset');
});
await check('enviar al huésped: enlace personalizado y mensaje de WhatsApp', async () => {
  await d.goto(`${BASE}/panel.html#/huesped/granvia`);
  await d.fill('#gname', 'Marta');
  const link = await d.textContent('#glink');
  expect(link.includes('g=Marta') && link.includes('in='), `enlace ${link}`);
  expect((await d.getAttribute('#send-wa', 'href')).startsWith('https://wa.me/'), 'WhatsApp');
  expect(await d.$('#qr-general svg'), 'QR');
});
await check('analíticas: preguntas de huéspedes con datos de ejemplo', async () => {
  await d.goto(`${BASE}/panel.html#/analiticas`);
  await d.click('#seed');
  await d.waitForSelector('.bar__fill');
  expect((await d.textContent('#main')).includes('ventilador'), 'pregunta sin respuesta listada');
});
await check('guía imprimible: 4 páginas A4', async () => {
  await d.goto(`${BASE}/print.html?guide=granvia`);
  await d.waitForSelector('.pcard');
  await d.emulateMedia({ media: 'print' });
  const heights = await d.$$eval('.sheet-a4', (s) => s.map((e) => e.getBoundingClientRect().height / 3.7795));
  eq(heights.length, 4, 'hojas');
  expect(heights.every((h) => h <= 297), `cada hoja cabe en A4: ${heights.map(Math.round)}`);
});
await check('sin errores de JavaScript en el panel', async () => eq(d.errors.length, 0, `errores: ${d.errors.join(' | ')}`));

console.log('\nAccesibilidad (axe-core)');
for (const path of ['/?guide=granvia', '/?guide=granvia#/s/wifi', '/?guide=granvia#/s/eat', '/?guide=granvia#/s/move', '/?guide=granvia#/s/trip', '/panel.html', '/panel.html#/editar/granvia', '/panel.html#/huesped/granvia']) {
  await check(`sin violaciones en ${path}`, async () => {
    const a = await newPage(browser);
    await a.goto(BASE + path);
    await a.waitForTimeout(2000); // esperar a que terminen las animaciones de entrada (el contraste se mide mal a mitad de un fundido)
    await a.addScriptTag({ path: AXE });
    const v = await a.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.map((x) => `${x.id} (${x.nodes.length})`));
    eq(v.length, 0, v.join(', '));
    await a.context().close();
  });
}

await browser.close();
server.kill();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas OK${failed.length ? ` — fallan: ${failed.map((f) => f.name).join('; ')}` : ''}\n`);
process.exit(failed.length ? 1 : 0);
