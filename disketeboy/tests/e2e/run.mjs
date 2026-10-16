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

async function newPage(browser, { viewport = { width: 1280, height: 800 }, steam = null, reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'es-ES', reducedMotion });
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
const booted = (page) => page.waitForFunction(() => window.disketeboy && !['boot'].includes(window.disketeboy.device.screenName) && document.querySelector('#screen [data-nav]'), null, { timeout: 15000 });
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

  await check('demo: 41 cajas, coger una con el teclado, girarla y soltarla', async () => {
    const page = await newPage(browser);
    await page.goto(`${BASE}/?demo=1&hora=22`);
    await booted(page);
    eq(await page.evaluate(() => window.disketeboy.room.count), 41, 'cajas en la habitación (26 videojuegos + 15 de mesa)');
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
    expect(zones.every(([kind, z]) => z === (kind === 'mesa' ? 'kallax' : 'estanteria')), 'videojuegos a la estantería y juegos de mesa a la Kallax');
    eq(await page.getAttribute('#r-ordenar', 'aria-pressed'), 'true', 'botón marcado');
    await shot(page, '04-ordenada');
    await page.click('#r-ordenar');
    await idle(page);
    const back = await page.evaluate(() => [...window.disketeboy.room.debug.entries.values()].filter((e) => e.zone === 'pila').length);
    eq(back, 7, 'la pila de la vergüenza vuelve');
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
    eq(n, 41, 'juegos restaurados');
    await idle(page);
    eq(await page.evaluate(() => window.disketeboy.room.count), 41, 'cajas tras restaurar');
    await page.close();
  });

  await check('«Visita mi habitación»: el enlace enseña tu colección sin tocar la de quien lo abre', async () => {
    const page = await newPage(browser);
    page.on('dialog', (d) => d.dismiss());
    await page.goto(`${BASE}/?demo=1`);
    await booted(page);
    await page.evaluate(() => window.disketeboy.store.setSettings({ name: 'Laura' }));
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
    expect(await visitor.isHidden('#m-nuevo'), 'de visita no se puede añadir');
    await visitor.click('#m-coleccion');
    await visitor.click('#screen .item.game >> nth=0');
    expect(await visitor.isHidden('#f-estado'), 'la ficha es de solo lectura');
    eq(JSON.parse(await visitor.evaluate(() => localStorage.getItem('dkb:v1'))).games[0].title, 'Mi juego', 'la colección propia sigue intacta');
    await shot(visitor, '08-visita');
    await visitor.click('#visit-leave');
    await visitor.waitForFunction(() => !location.hash && window.disketeboy && !window.disketeboy.store.visiting());
    eq(await visitor.evaluate(() => window.disketeboy.store.getGames().map((g) => g.title).join()), 'Mi juego', 'al salir vuelves a tu habitación');
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
    for (const [screen, params] of [['lista', { filter: 'todos' }], ['nuevo', {}], ['steam', {}], ['ajustes', {}], ['stats', {}], ['pila', {}]]) {
      await page.evaluate(([s, p]) => window.disketeboy.device.go(s, p), [screen, params]);
      await page.waitForTimeout(150);
      await axe(page, screen);
    }
    const id = await page.evaluate(() => window.disketeboy.store.getGames()[0].id);
    await page.evaluate((gid) => window.disketeboy.device.go('ficha', { id: gid }), id);
    await page.waitForTimeout(150);
    await axe(page, 'ficha');
    const boardId = await page.evaluate(() => window.disketeboy.store.getBoards()[0].id);
    for (const [screen, params] of [['mesa', {}], ['mesaLista', { filter: 'todos' }], ['ficha', { id: boardId }], ['mesaNuevo', {}], ['queJugamos', {}], ['prestamos', {}], ['mesaStats', {}]]) {
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
