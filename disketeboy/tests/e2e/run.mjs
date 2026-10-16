// Pruebas de extremo a extremo de DisketeBoy en un navegador real (Chromium + Playwright).
//   node disketeboy/tests/e2e/run.mjs              (arranca el servidor solo)
//   E2E_SHOTS=1 node disketeboy/tests/e2e/run.mjs  → capturas en disketeboy/tests/e2e/out/
// La red externa (Steam, fuentes) se simula para que todo sea determinista y sin conexión.
import { spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const PORT = 5197;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.E2E_SHOTS ? `${ROOT}tests/e2e/out` : null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const AXE = `${REPO}node_modules/axe-core/axe.min.js`;

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
    console.log(`  ✘ ${name}\n    ${String(err.stack || err).split('\n').slice(0, 4).join('\n    ')}`);
  }
}
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};
const eq = (a, b, msg) => expect(a === b, `${msg}: esperado ${JSON.stringify(b)}, obtenido ${JSON.stringify(a)}`);

// --- Red simulada -------------------------------------------------------------
const COVER = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="600" height="900" fill="#3a6ea5"/><circle cx="300" cy="380" r="160" fill="#f2c14e"/></svg>';
const STEAM_GAMES = {
  steamid: '76561197960287930',
  games: [
    { appid: 620, name: 'Portal 2', playtime_forever: 840, playtime_2weeks: 0 },
    { appid: 413150, name: 'Stardew Valley', playtime_forever: 600, playtime_2weeks: 120 },
    { appid: 292030, name: 'The Witcher 3: Wild Hunt', playtime_forever: 0, playtime_2weeks: 0 },
  ],
};

async function newPage(browser, { viewport = { width: 1280, height: 800 }, steam = null, reducedMotion = 'no-preference', locale = 'es-ES' } = {}) {
  const ctx = await browser.newContext({ viewport, locale, reducedMotion });
  await ctx.route(/fonts\.(googleapis|gstatic)/, (r) => r.fulfill({ body: '' }));
  await ctx.route(/steamstatic\.com/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: COVER, headers: { 'Access-Control-Allow-Origin': '*' } }));
  if (steam) await ctx.route(/\/api\/steam/, (r) => r.fulfill(steam));
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text());
  });
  return page;
}

const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });
const booted = (page) => page.waitForFunction(() => window.disketeboy && !['boot'].includes(window.disketeboy.device.screenName) && document.querySelector('#screen [data-nav]'), null, { timeout: 30000 });
const idle = (page) => page.waitForFunction(() => !window.disketeboy.room || !window.disketeboy.room.busy, null, { timeout: 30000 });
const games = (page) => page.evaluate(() => window.disketeboy.store.getGames());

async function axe(page, label) {
  if (!existsSync(AXE)) throw new Error('Falta axe-core: ejecuta npm ci en la raíz');
  await page.addScriptTag({ path: AXE });
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ['violations'] });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
  });
  expect(res.length === 0, `axe en ${label}:\n      ${res.join('\n      ')}`);
}

// --- Servidor -----------------------------------------------------------------
const server = spawn(process.execPath, [`${ROOT}server.mjs`], { env: { ...process.env, PORT: String(PORT), STEAM_API_KEY: '' }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
console.log('\nDisketeBoy · pruebas en navegador\n');

try {
  await check('arranca sin errores y pide un disquete', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    eq(await page.evaluate(() => window.disketeboy.device.screenName), 'disquetes', 'pantalla inicial');
    await shot(page, '01-disquetes');
    await page.click('text=Videojuegos');
    await page.waitForSelector('#m-coleccion');
    eq(await page.getAttribute('#dkb', 'data-disk'), 'videojuegos', 'disquete metido');
    expect(await page.isVisible('#demo-hint'), 'con la habitación vacía se ofrece la demo');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('añadir un juego: cae en la habitación y sobrevive a recargar', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    await page.click('text=Videojuegos');
    await page.click('#m-nuevo');
    await page.fill('#n-titulo', 'Chrono Trigger');
    await page.selectOption('#n-plataforma', 'snes');
    await page.selectOption('#n-estado', 'pendiente');
    await page.selectOption('#n-nota', '10');
    await page.click('#n-anadir');
    await page.waitForSelector('text=¡Plof!');
    expect((await page.textContent('#screen')).includes('pila de la vergüenza'), 'dice dónde ha caído');
    eq(await page.evaluate(() => window.disketeboy.room?.count), 1, 'una caja en la habitación');
    await page.reload();
    await booted(page);
    const list = await games(page);
    eq(list.length, 1, 'juegos tras recargar');
    eq(list[0].platform, 'snes', 'plataforma');
    eq(list[0].score, 10, 'nota');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('ficha: cambiar estado y nota con la cruceta, y escribir la reseña', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.click('#m-coleccion');
    await page.click('#screen .item.game >> nth=0');
    await page.waitForSelector('#f-estado');
    const before = await page.evaluate(() => window.disketeboy.store.getGames().find((g) => g.title === document.querySelector('.view-head h2').textContent));
    await page.focus('#f-estado');
    await page.keyboard.press('ArrowRight');
    await page.click('[data-btn="down"]');
    await page.click('[data-btn="left"]');
    const after = await page.evaluate((id) => window.disketeboy.store.getGame(id), before.id);
    expect(after.status !== before.status, 'el estado cambia con →');
    expect(after.score !== before.score, 'la nota cambia con la cruceta en pantalla');
    await page.click('#f-resena');
    await page.fill('#r-texto', 'Una reseña de prueba con «comillas» y <b>etiquetas</b>.');
    await page.click('#r-guardar');
    await page.waitForSelector('#f-estado');
    eq((await page.evaluate((id) => window.disketeboy.store.getGame(id), before.id)).review, 'Una reseña de prueba con «comillas» y <b>etiquetas</b>.', 'reseña guardada tal cual');
    await shot(page, '02-ficha');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('buscar en la lista y corregir el título desde la ficha', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.evaluate(() => window.disketeboy.device.go('lista', { filter: 'todos' }));
    await page.fill('#l-buscar', 'hollow');
    const visible = await page.$$eval('#screen .item.game', (els) => els.filter((e) => !e.hidden).map((e) => e.querySelector('.item-label').textContent));
    eq(visible.sort().join(' | '), 'Hollow Knight | Hollow Knight: Silksong', 'la búsqueda filtra sin repintar');
    await page.click('#screen .item.game:not([hidden]) >> nth=0');
    await page.waitForSelector('#f-titulo');
    await page.fill('#f-titulo', 'Hollow Knight (Voidheart)');
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.disketeboy.store.getGames().some((g) => g.title === 'Hollow Knight (Voidheart)'));
    await page.fill('#f-titulo', '   ');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.disketeboy.store.getGames().some((g) => g.title === 'Hollow Knight (Voidheart)')), 'un título vacío no se guarda');
    await page.evaluate(() => window.disketeboy.device.go('mesaLista', { filter: 'todos' }));
    await page.fill('#b-buscar', 'aventureros');
    eq(await page.$$eval('#screen .item.game', (els) => els.filter((e) => !e.hidden).length), 1, 'también en la Kallax');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('un título con HTML se muestra como texto (sin XSS)', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    await page.evaluate(() => {
      window.disketeboy.store.addGame({ title: '<img src=x onerror="window.__xss=1">', review: '<script>window.__xss=2</script>', status: 'jugando' });
    });
    await page.click('text=Videojuegos');
    await page.click('#m-coleccion');
    await page.waitForSelector('#screen .item.game');
    expect((await page.textContent('#screen .item.game')).includes('<img src=x'), 'el título se ve como texto');
    await page.click('#screen .item.game');
    await page.click('#f-ver');
    await idle(page);
    expect((await page.textContent('#inspect-title')).includes('<img'), 'también en la caja cogida');
    eq(await page.evaluate(() => window.__xss), undefined, 'no se ejecutó nada');
    await page.close();
  });

  await check('demo: 49 cajas, coger una con el teclado, girarla y soltarla', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1&hora=22`);
    await booted(page);
    eq(await page.evaluate(() => window.disketeboy.room.count), 49, 'cajas en la habitación (26 videojuegos + 15 de mesa + 8 de cartas)');
    await page.click('#m-habitacion');
    await idle(page);
    expect(await page.isVisible('#r-ordenar'), 'botones de la habitación visibles');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await idle(page);
    expect(await page.isVisible('#inspect'), 'barra de la caja cogida');
    const title = await page.textContent('#inspect-title');
    expect(title.length > 0, 'muestra el título');
    await page.keyboard.press('f');
    await idle(page);
    await shot(page, '03-contraportada');
    await page.keyboard.press('Escape');
    await idle(page);
    expect(await page.isHidden('#inspect'), 'al soltarla se va la barra');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.body.classList.contains('device-up'));
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('ordenar la habitación lo manda todo a la estantería y vuelve', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.evaluate(() => window.disketeboy.lower());
    await page.click('#r-ordenar');
    await idle(page);
    const zones = await page.evaluate(() => [...window.disketeboy.room.debug.entries.values()].map((e) => [e.game.kind, e.zone]));
    const expected = { video: 'estanteria', mesa: 'kallax', carpeta: 'kallax', mazo: 'mazos' };
    expect(zones.every(([kind, z]) => z === expected[kind]), 'cada cosa a su mueble');
    eq(await page.getAttribute('#r-ordenar', 'aria-pressed'), 'true', 'botón marcado');
    await shot(page, '04-ordenada');
    await page.click('#r-ordenar');
    await idle(page);
    const back = await page.evaluate(() => [...window.disketeboy.room.debug.entries.values()].filter((e) => e.zone === 'pila').length);
    eq(back, 7, 'la pila de la vergüenza vuelve');
    await page.close();
  });

  await check('regresión: cambiar el orden mientras caen las cajas no deja cajas invisibles', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    await page.evaluate(() => {
      const { store } = window.disketeboy;
      store.importGames(Array.from({ length: 60 }, (_, i) => ({ title: `Caja ${String(i).padStart(2, '0')}`, platform: 'pc', status: 'jugado', score: i % 11 })));
      store.setSettings({ sort: 'nota' });
    });
    await idle(page);
    const hidden = await page.evaluate(() => [...window.disketeboy.room.debug.entries.values()].filter((e) => !e.mesh.visible).length);
    eq(hidden, 0, 'cajas invisibles');
    await page.close();
  });

  await check('cambiar el estado mueve la caja de zona', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    const id = await page.evaluate(() => window.disketeboy.store.getGames().find((g) => g.status === 'pendiente').id);
    await page.evaluate((gid) => window.disketeboy.store.updateGame(gid, { status: 'terminado' }), id);
    await idle(page);
    eq(await page.evaluate((gid) => window.disketeboy.room.debug.entries.get(gid).zone, id), 'estanteria', 'zona tras terminarlo');
    await page.close();
  });

  await check('Steam (simulado): importa sin duplicar y lo no jugado va a la pila', async () => {
    const page = await newPage(browser, { steam: { json: STEAM_GAMES } });
    await page.goto(BASE);
    await booted(page);
    await page.click('text=Videojuegos');
    await page.click('#m-steam');
    await page.fill('#s-perfil', 'steamcommunity.com/id/gaben');
    await page.click('#s-buscar');
    await page.waitForSelector('#s-importar');
    expect((await page.textContent('#screen')).includes('1 nunca los has abierto'), 'avisa de los nunca jugados');
    await page.click('#s-importar');
    await page.waitForFunction(() => window.disketeboy.store.getGames().length === 3);
    const list = await games(page);
    eq(list.find((g) => g.title.startsWith('The Witcher')).status, 'pendiente', 'nunca jugado → pila');
    eq(list.find((g) => g.title === 'Stardew Valley').status, 'jugando', 'jugado hace poco → escritorio');
    eq(list.find((g) => g.title === 'Portal 2').hours, 14, 'horas');
    await page.evaluate(() => window.disketeboy.raise());
    await page.evaluate(() => window.disketeboy.device.go('steam'));
    await page.fill('#s-perfil', 'gaben');
    await page.click('#s-buscar');
    await page.click('#s-importar');
    await page.waitForTimeout(300);
    eq((await games(page)).length, 3, 'la segunda importación no duplica');
    await page.close();
  });

  await check('Steam sin clave en el servidor: lo explica y ofrece la demo', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    await page.click('text=Videojuegos');
    await page.click('#m-steam');
    await page.fill('#s-perfil', 'gaben');
    await page.click('#s-buscar');
    await page.waitForSelector('#s-demo');
    expect((await page.textContent('#screen')).includes('clave de Steam'), 'explica que falta la clave');
    await page.click('#s-demo');
    await page.waitForFunction(() => window.disketeboy.store.getVideoGames().length === 26);
    await page.close();
  });

  await check('DisketePrinter: ticket de 384 px y foto para compartir', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.click('#m-ticket');
    await page.waitForSelector('#ticket:not([hidden])');
    await page.waitForFunction(() => document.getElementById('ticket-img').naturalWidth > 0);
    eq(await page.evaluate(() => document.getElementById('ticket-img').naturalWidth), 384, 'ancho del ticket');
    await page.waitForTimeout(1500);
    await shot(page, '05-ticket');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#ticket[hidden]', { state: 'attached' });
    const snap = await page.evaluate(async () => {
      const { renderSnapshot } = await import('./js/ticket.js');
      const c = renderSnapshot(window.disketeboy.room.snapshot(), window.disketeboy.store.getGames());
      return { w: c.width, h: c.height };
    });
    eq(snap.w, 1200, 'ancho de la foto');
    await page.close();
  });

  await check('donaciones: el botón solo sale cuando hay enlace, y tras imprimir el ticket', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.evaluate(() => window.disketeboy.device.go('creditos', {}));
    await page.waitForSelector('#screen .list');
    expect(!(await page.$('#a-donar')), 'sin enlace configurado no hay botón de donar');
    await page.close();
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'es-ES' });
    await ctx.route(/fonts\.(googleapis|gstatic)|steamstatic/, (r) => r.abort());
    await ctx.route(/\/js\/config\.js$/, async (r) => {
      const res = await r.fetch();
      r.fulfill({ response: res, body: (await res.text()).replace("DONATE_URL = ''", "DONATE_URL = 'https://ko-fi.com/disketeboy'") });
    });
    const withLink = await ctx.newPage();
    await withLink.goto(`${BASE}/?demo=1`);
    await booted(withLink);
    await withLink.evaluate(() => window.disketeboy.device.go('creditos', {}));
    await withLink.waitForSelector('#a-donar');
    eq(await withLink.getAttribute('#a-donar', 'href'), 'https://ko-fi.com/disketeboy', 'enlace en Créditos');
    eq(await withLink.getAttribute('#a-donar', 'rel'), 'noopener', 'se abre aparte y sin acceso a la página');
    await withLink.evaluate(() => window.disketeboy.device.go('menu', {}));
    await withLink.click('#m-ticket');
    await withLink.waitForSelector('#t-donar:not([hidden])');
    eq(await withLink.getAttribute('#t-donar a', 'href'), 'https://ko-fi.com/disketeboy', 'invitación bajo el ticket');
    await ctx.close();
  });

  await check('copia de seguridad: exportar, vaciar y restaurar', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    const n = await page.evaluate(() => {
      const { store } = window.disketeboy;
      const backup = store.exportBackup();
      store.clearAll();
      if (store.getGames().length) return -1;
      return store.importBackup(backup);
    });
    eq(n, 49, 'juegos restaurados');
    await idle(page);
    eq(await page.evaluate(() => window.disketeboy.room.count), 49, 'cajas tras restaurar');
    await page.close();
  });

  await check('«Visita mi habitación»: el enlace enseña tu colección sin tocar la de quien lo abre', async () => {
    const page = await newPage(browser);
    page.on('dialog', (d) => d.dismiss());
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.evaluate(() => window.disketeboy.store.setSettings({ name: 'Laura', theme: 'gamer', pet: false }));
    await page.click('#m-compartir');
    await page.waitForFunction(() => window.disketeboy.lastVisitUrl);
    const url = await page.evaluate(() => window.disketeboy.lastVisitUrl);
    expect(url.includes('#visita='), 'el enlace lleva la colección tras la #');
    const visitor = await newPage(browser);
    await visitor.goto(BASE);
    await visitor.evaluate(() => localStorage.setItem('dkb:v1', JSON.stringify({ games: [{ id: 'mio', title: 'Mi juego' }] })));
    await visitor.goto(url);
    await booted(visitor);
    expect(await visitor.isVisible('#visit-banner'), 'franja de visita');
    eq(await visitor.textContent('#visit-name'), 'Laura', 'nombre de quien comparte');
    eq(await visitor.evaluate(() => window.disketeboy.store.getVideoGames().length), 26, 'se ven sus videojuegos');
    eq(await visitor.evaluate(() => window.disketeboy.store.getBoards().length), 15, 'y sus juegos de mesa');
    eq(await visitor.evaluate(() => window.disketeboy.store.getCards().length), 8, 'y sus mazos y carpetas');
    expect(await visitor.isHidden('#m-nuevo'), 'de visita no se puede añadir');
    const look = await visitor.evaluate(() => ({ ...window.disketeboy.store.getSettings() }));
    eq(`${look.theme}/${look.pet}`, 'gamer/false', 'la visita ve su tema y sin gato');
    await visitor.click('#m-coleccion');
    await visitor.click('#screen .item.game >> nth=0');
    expect(await visitor.isHidden('#f-estado'), 'la ficha es de solo lectura');
    eq(JSON.parse(await visitor.evaluate(() => localStorage.getItem('dkb:v1'))).games[0].title, 'Mi juego', 'la colección propia sigue intacta');
    await shot(visitor, '08-visita');
    await visitor.click('#visit-leave');
    await visitor.waitForFunction(() => !location.hash && window.disketeboy && !window.disketeboy.store.visiting());
    eq(await visitor.evaluate(() => window.disketeboy.store.getGames().map((g) => g.title).join()), 'Mi juego', 'al salir vuelves a tu habitación');
    eq(await visitor.evaluate(() => window.disketeboy.store.getSettings().theme), 'crema', 'y a tu tema');
    eq(visitor.errors.join('\n') + page.errors.join('\n'), '', 'errores en consola');
    await page.close();
    await visitor.close();
  });

  await check('juegos de mesa: disquete azul, añadir, ¡hemos jugado!, prestar y la ruleta de esta noche', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    await page.click('#d-mesa');
    await page.waitForSelector('#b-coleccion');
    eq(await page.getAttribute('#dkb', 'data-disk'), 'mesa', 'disquete de juegos de mesa');
    await page.click('#b-nuevo');
    await page.fill('#bn-titulo', 'Carcassonne');
    await page.fill('#bn-min', '2');
    await page.fill('#bn-max', '5');
    await page.fill('#bn-minutos', '40');
    await page.selectOption('#bn-estado', 'pendiente');
    await page.click('#bn-anadir');
    await page.waitForSelector('text=¡Plof!');
    expect((await page.textContent('#screen')).includes('Kallax'), 'dice que ha caído en la Kallax');
    const id = await page.evaluate(() => window.disketeboy.store.getBoards()[0].id);
    eq(await page.evaluate((gid) => window.disketeboy.room.debug.entries.get(gid).zone, id), 'encima', 'sin estrenar: encima de la Kallax');
    await page.evaluate((gid) => window.disketeboy.device.go('ficha', { id: gid }), id);
    await page.click('#bf-jugado');
    await idle(page);
    const g = await page.evaluate((gid) => window.disketeboy.store.getGame(gid), id);
    eq([g.plays, g.status].join(), '1,jugado', 'estrenado tras la primera partida');
    eq(await page.evaluate((gid) => window.disketeboy.room.debug.entries.get(gid).zone, id), 'kallax', 'y ya va a los cubos');
    await page.fill('#bf-prestado', 'Pedro');
    await page.press('#bf-prestado', 'Enter');
    await page.waitForFunction((gid) => window.disketeboy.store.getGame(gid).lentTo === 'Pedro', id);
    await page.evaluate(() => window.disketeboy.device.go('queJugamos'));
    expect(!(await page.isVisible('#q-ruleta')), 'prestado: no está en casa para esta noche');
    await page.fill('#bf-prestado', '').catch(() => {});
    await page.evaluate((gid) => window.disketeboy.store.updateGame(gid, { lentTo: '' }), id);
    await page.evaluate(() => { window.disketeboy.device.home(); window.disketeboy.device.go('queJugamos'); });
    await page.waitForSelector('#q-ruleta');
    await page.click('#q-ruleta');
    await page.waitForSelector('#r-sacar', { timeout: 20000 });
    expect((await page.textContent('#screen')).includes('Carcassonne'), 'la ruleta elige el único que encaja');
    await page.click('#r-sacar');
    await idle(page);
    eq(await page.textContent('#inspect-title'), 'Carcassonne', 'la caja sale de la Kallax');
    expect((await page.textContent('#inspect-meta')).includes('2–5 jugadores'), 'con sus jugadores');
    await shot(page, '09-mesa');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('BoardGameGeek (simulado): importa la colección a la Kallax y no duplica', async () => {
    const page = await newPage(browser);
    const collection = {
      user: 'Aldie',
      games: [
        { id: 13, name: 'CATAN', minPlayers: 3, maxPlayers: 4, minutes: 120, plays: 12, rating: 7.5 },
        { id: 822, name: 'Carcassonne', minPlayers: 2, maxPlayers: 5, minutes: 45, plays: 30, rating: 9.1 },
        { id: 174430, name: 'Gloomhaven', minPlayers: 1, maxPlayers: 4, minutes: 120, plays: 0, rating: null },
      ],
    };
    await page.route(/\/api\/bgg/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(collection) }));
    await page.goto(BASE);
    await booted(page);
    await page.click('#d-mesa');
    await page.click('#b-bgg');
    await page.fill('#g-usuario', 'https://boardgamegeek.com/collection/user/Aldie');
    await page.click('#g-buscar');
    await page.waitForSelector('#g-importar');
    expect((await page.textContent('.steam-status')).includes('1 sin partidas'), 'avisa de los que van encima con plástico');
    await page.click('#g-importar');
    await page.waitForSelector('text=¡A la Kallax! 3 juegos nuevos');
    const boards = await page.evaluate(() => window.disketeboy.store.getBoards().map((g) => `${g.title}:${g.status}:${g.bggId}`).sort());
    eq(boards.join(), 'CATAN:jugado:13,Carcassonne:favorito:822,Gloomhaven:pendiente:174430', 'juegos importados');
    await idle(page);
    eq(await page.evaluate(() => window.disketeboy.room.count), 3, 'cajas en la habitación');
    await page.evaluate(() => window.disketeboy.raise());
    await page.click('#b-bgg');
    await page.fill('#g-usuario', 'Aldie');
    await page.click('#g-buscar');
    await page.click('#g-importar');
    await page.waitForSelector('text=0 juegos nuevos, 3 ya los tenías');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('cartas: disquete verde, mazo con récord y lista, y carpeta en la Kallax', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    await page.click('#d-cartas');
    await page.waitForSelector('#c-mazos');
    eq(await page.getAttribute('#dkb', 'data-disk'), 'cartas', 'disquete de cartas');
    await page.click('#c-nuevo-mazo');
    await page.fill('#cn-titulo', 'Rojo Burn');
    await page.selectOption('#cn-juego', 'mtg');
    await page.fill('#cn-formato', 'Modern');
    await page.click('#cn-anadir');
    await page.waitForSelector('text=¡Plof!');
    const id = await page.evaluate(() => window.disketeboy.store.getCards()[0].id);
    eq(await page.evaluate((gid) => window.disketeboy.room.debug.entries.get(gid).zone, id), 'mazos', 'el mazo va delante de la tele');
    await page.evaluate((gid) => window.disketeboy.device.go('ficha', { id: gid }), id);
    await page.click('#cf-gane');
    await page.click('#cf-gane');
    await page.click('#cf-perdi');
    await page.waitForFunction((gid) => window.disketeboy.store.getGame(gid).losses === 1, id);
    expect((await page.textContent('#screen')).includes('2V · 1D (67%)'), 'récord en la ficha');
    await page.click('#cf-lista');
    await page.fill('#lm-texto', '4 Lightning Bolt\n4x Rift Bolt\n20 Mountain');
    expect((await page.textContent('#screen')).includes('28 cartas'), 'cuenta las cartas mientras escribes');
    await page.click('#lm-guardar');
    await page.waitForSelector('#cf-lista');
    expect((await page.textContent('#cf-lista')).includes('28 cartas'), 'lista guardada');
    await page.evaluate(() => window.disketeboy.device.home());
    await page.click('#c-nueva-carpeta');
    await page.fill('#pn-titulo', 'Mis brillis');
    await page.fill('#pn-cartas', '165');
    await page.fill('#pn-valor', '120.5');
    await page.click('#pn-anadir');
    await page.waitForSelector('text=¡Plof!');
    const binder = await page.evaluate(() => window.disketeboy.store.getCards().find((g) => g.kind === 'carpeta'));
    eq([binder.cards, binder.value].join(), '165,120.5', 'cartas y valor');
    await idle(page);
    eq(await page.evaluate((gid) => window.disketeboy.room.debug.entries.get(gid).zone, binder.id), 'kallax', 'la carpeta va a la Kallax');
    await page.evaluate((gid) => window.disketeboy.device.go('ficha', { id: gid }), id);
    await page.click('#cf-ver');
    await idle(page);
    expect((await page.textContent('#inspect-meta')).includes('2V · 1D'), 'la caja cogida enseña el récord');
    await shot(page, '10-cartas');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('carpeta: importar el CSV de ManaBox cuenta las cartas y suma su valor', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await booted(page);
    const id = await page.evaluate(() => {
      window.disketeboy.store.importGames([{ kind: 'carpeta', title: 'Mi Modern', tcg: 'mtg', cards: 0, value: 0 }]);
      return window.disketeboy.store.getCards()[0].id;
    });
    await page.evaluate((gid) => window.disketeboy.device.go('ficha', { id: gid }), id);
    await page.waitForSelector('#pf-csv');
    const csv = 'Name,Set code,Quantity,Purchase price\n"Lightning Bolt",M10,4,1.50\n"Atraxa, Praetors\' Voice",C16,1,25.00\n';
    await page.setInputFiles('#screen input[type=file]', { name: 'manabox.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.waitForSelector('text=CSV importado: 5 cartas');
    const g = await page.evaluate((gid) => window.disketeboy.store.getGame(gid), id);
    eq(`${g.cards}/${g.value}`, '5/31', 'cartas y valor de la carpeta');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('se puede instalar en el móvil: manifiesto e iconos', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    const manifest = await (await fetch(new URL(href, `${BASE}/`))).json();
    eq(manifest.display, 'standalone', 'se abre como una app');
    for (const icon of manifest.icons) eq((await fetch(new URL(icon.src, `${BASE}/`))).status, 200, `icono ${icon.src}`);
    expect(manifest.icons.some((i) => i.sizes === '512x512') && manifest.icons.some((i) => i.sizes === '192x192'), 'iconos de 192 y 512');
    await page.close();
  });

  await check('logros: aviso con confeti, trofeos en el alféizar y el gato secreto', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    // El aviso sale nada más cargar la demo y se va solo: basta con que haya salido
    await page.waitForFunction(() => /logros desbloqueados/.test(document.getElementById('logro').textContent));
    const count = await page.evaluate(() => window.disketeboy.logros.count());
    expect(count >= 10, `logros con la demo: ${count}`);
    await page.evaluate(() => window.disketeboy.device.go('logros', {}));
    await page.waitForSelector('#screen .logro-row');
    expect(new RegExp(`${count} de 24 conseguidos`).test(await page.textContent('#screen')), 'cuenta de logros');
    expect((await page.textContent('#screen')).includes('Logro secreto'), 'el del gato es secreto');
    await page.evaluate(() => window.disketeboy.lower());
    await idle(page);
    eq(await page.evaluate(() => window.disketeboy.room.debug.trophies.size), 8, 'trofeos en el alféizar');
    // Acariciar al gato diez veces
    const cat = await page.evaluate(() => {
      const { scene, camera } = window.disketeboy.room.debug;
      const c = scene.getObjectByName('gato');
      const p = c.getWorldPosition(c.position.clone());
      p.y += 0.07;
      p.project(camera);
      return { x: ((p.x + 1) / 2) * innerWidth, y: ((1 - p.y) / 2) * innerHeight };
    });
    for (let i = 0; i < 10; i++) {
      await page.mouse.click(cat.x, cat.y);
      await page.waitForTimeout(60);
    }
    await page.waitForFunction(() => window.disketeboy.logros.list().find((l) => l.id === 'amigo-del-gato').got);
    // Terminar un juego: confeti (tras un momento, por si solo se pasaba por «Terminado»)
    await page.evaluate(() => {
      const g = window.disketeboy.store.getVideoGames().find((x) => x.status === 'jugado');
      window.disketeboy.store.updateGame(g.id, { status: 'terminado' });
    });
    await page.waitForFunction(async () => (await import('./js/fx.js')).confettiCount() > 0, null, { timeout: 5000 });
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('«Mi resumen»: tarjetas animadas, personalidad e imagen vertical para compartir', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.click('#m-resumen');
    await page.waitForSelector('.story-card');
    expect((await page.textContent('.story-card')).includes('Tu colección en DisketeBoy'), 'primera tarjeta');
    for (let i = 0; i < 8 && !(await page.$('#story-guardar')); i++) {
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(250);
    }
    await page.waitForSelector('#story-guardar');
    expect((await page.textContent('.story-card')).includes('Tu personalidad'), 'la última es la personalidad');
    await axe(page, 'mi resumen');
    const img = await page.evaluate(async () => {
      const { buildSummary } = await import('./js/resumen.js');
      const { renderStoryImage } = await import('./js/story.js');
      const c = renderStoryImage(buildSummary(window.disketeboy.store.getGames()), 'Laura');
      return `${c.width}x${c.height}`;
    });
    eq(img, '1080x1920', 'imagen para historias');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.story', { state: 'detached' });
    await page.evaluate(() => window.disketeboy.device.go('ajustes', {}));
    await page.click('#a-ambiente');
    await page.waitForFunction(() => window.disketeboy.store.getSettings().ambient === false);
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('ajustes: tema de la habitación y el gato que duerme en la alfombra', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.evaluate(() => window.disketeboy.device.go('ajustes', {}));
    await page.waitForSelector('#a-tema');
    const wall = () => page.evaluate(() => {
      const { scene } = window.disketeboy.room.debug;
      return { cat: scene.getObjectByName('gato').visible, led: scene.getObjectByName('led').visible };
    });
    eq(JSON.stringify(await wall()), '{"cat":true,"led":false}', 'de serie: gato y sin luces');
    await page.click('#a-tema');
    await page.waitForFunction(() => window.disketeboy.store.getSettings().theme === 'gamer');
    expect((await page.getAttribute('#a-tema', 'aria-label')).includes('Gamer RGB'), 'el ajuste dice el tema');
    eq((await wall()).led, true, 'el tema gamer enciende la tira LED');
    await page.click('#a-gato');
    await page.waitForFunction(() => window.disketeboy.store.getSettings().pet === false);
    eq((await wall()).cat, false, 'sin gato');
    await page.reload();
    await booted(page);
    const s = await page.evaluate(() => window.disketeboy.store.getSettings());
    eq(`${s.theme}/${s.pet}`, 'gamer/false', 'se guarda al recargar');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('inglés: un navegador en inglés lo ve todo en inglés, y se cambia en Ajustes', async () => {
    const page = await newPage(browser, { locale: 'en-US' });
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    eq(await page.evaluate(() => document.documentElement.lang), 'en', 'idioma de la página');
    const menu = await page.textContent('#screen');
    expect(menu.includes('My collection') && menu.includes('Pile of shame'), `menú en inglés: ${menu.slice(0, 120)}`);
    eq((await page.textContent('#r-ordenar')).trim(), '🧹 Tidy up room', 'botones de la habitación');
    eq(await page.getAttribute('[data-btn="a"]', 'aria-label'), 'A, confirm', 'etiquetas para lector de pantalla');
    const hk = await page.evaluate(() => window.disketeboy.store.getGames().find((g) => g.title === 'Pokémon Red'));
    expect(hk && hk.review.startsWith('Link cable'), 'la demo llega traducida');
    await page.click('#m-ticket');
    await page.waitForFunction(() => document.getElementById('ticket-img').naturalWidth > 0);
    eq(await page.getAttribute('#ticket-img', 'alt'), 'Receipt summing up your collection', 'texto del ticket');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.disketeboy.device.go('ajustes', {}));
    await page.waitForSelector('#a-idioma');
    await axe(page, 'ajustes en inglés');
    await page.click('#a-idioma');
    await page.waitForURL(/lang=es/);
    await booted(page);
    eq(await page.evaluate(() => document.documentElement.lang), 'es', 'vuelta al español');
    expect((await page.textContent('#screen')).includes('Mi colección'), 'menú en español');
    eq(await page.evaluate(() => window.disketeboy.store.getSettings().lang), 'es', 'se recuerda');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('datos corruptos y sin 3D: la consola sigue funcionando', async () => {
    const page = await newPage(browser);
    await page.goto(BASE);
    await page.evaluate(() => localStorage.setItem('dkb:v1', '{roto'));
    await page.goto(`${BASE}/?sin3d=1`);
    await booted(page);
    expect(await page.isVisible('#room-fallback'), 'aviso sin 3D');
    await page.click('text=Videojuegos');
    await page.click('#m-nuevo');
    await page.fill('#n-titulo', 'Tetris');
    await page.click('#n-anadir');
    await page.waitForSelector('text=¡Plof!');
    eq(page.errors.join('\n'), '', 'errores en consola');
    await page.close();
  });

  await check('móvil: la consola cabe en pantalla y la habitación se ve al bajarla', async () => {
    const page = await newPage(browser, { viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/?demo=1&hora=20`);
    await booted(page);
    const box = await page.locator('#dkb').boundingBox();
    expect(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844, `la consola se sale: ${JSON.stringify(box)}`);
    await shot(page, '06-movil-consola');
    await page.click('[data-btn="select"]');
    await idle(page);
    await page.waitForTimeout(700);
    await shot(page, '07-movil-habitacion');
    expect(await page.isVisible('#r-subir'), 'botón para volver a la consola');
    await page.close();
  });

  await check('movimiento reducido: animaciones cortas y sin retrasos', async () => {
    const page = await newPage(browser, { reducedMotion: 'reduce' });
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    const t = await page.evaluate(() => {
      window.disketeboy.store.setSettings({ tidy: true });
      const now = performance.now();
      const list = [...window.disketeboy.room.debug.tweens.values()];
      return { n: list.length, maxDur: Math.max(...list.map((x) => x.dur)), maxDelay: Math.max(...list.map((x) => x.start - now)) };
    });
    expect(t.n > 0, 'hay cajas moviéndose');
    expect(t.maxDur <= 120, `duración máxima ${t.maxDur} ms`);
    expect(t.maxDelay <= 5, `retraso máximo ${t.maxDelay} ms`);
    await idle(page);
    await page.close();
  });

  await check('accesibilidad (axe): consola, formularios y habitación sin errores', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await axe(page, 'menú');
    for (const [screen, params] of [['lista', { filter: 'todos' }], ['nuevo', {}], ['steam', {}], ['ajustes', {}], ['stats', {}], ['pila', {}], ['privacidad', {}], ['creditos', {}], ['logros', {}]]) {
      await page.evaluate(([s, p]) => window.disketeboy.device.go(s, p), [screen, params]);
      await page.waitForTimeout(150);
      await axe(page, screen);
    }
    const id = await page.evaluate(() => window.disketeboy.store.getGames()[0].id);
    await page.evaluate((gid) => window.disketeboy.device.go('ficha', { id: gid }), id);
    await page.waitForTimeout(150);
    await axe(page, 'ficha');
    const boardId = await page.evaluate(() => window.disketeboy.store.getBoards()[0].id);
    const deckId = await page.evaluate(() => window.disketeboy.store.getCards().find((g) => g.kind === 'mazo').id);
    const binderId = await page.evaluate(() => window.disketeboy.store.getCards().find((g) => g.kind === 'carpeta').id);
    for (const [screen, params] of [
      ['mesa', {}], ['mesaLista', { filter: 'todos' }], ['ficha', { id: boardId }], ['mesaNuevo', {}], ['bgg', {}], ['queJugamos', {}], ['prestamos', {}], ['mesaStats', {}],
      ['cartas', {}], ['cartasLista', { kind: 'mazo' }], ['ficha', { id: deckId }], ['listaMazo', { id: deckId }], ['ficha', { id: binderId }], ['mazoNuevo', {}], ['carpetaNueva', {}], ['cartasStats', {}],
    ]) {
      await page.evaluate(([s, p]) => window.disketeboy.device.go(s, p), [screen, params]);
      await page.waitForTimeout(150);
      await axe(page, `mesa: ${screen}`);
    }
    await page.evaluate(() => window.disketeboy.lower());
    await idle(page);
    await axe(page, 'habitación');
    await page.close();
  });
} finally {
  await browser.close();
  server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} pruebas superadas${failed.length ? ` · ${failed.length} fallos` : ''}\n`);
process.exit(failed.length ? 1 : 0);
