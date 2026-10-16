// Vídeo promocional de DisketeBoy (≈25 s), grabado fotograma a fotograma con un reloj
// virtual: la página solo avanza 1/30 s entre captura y captura, así sale fluido aunque
// el navegador dibuje lento. Arranca su propio servidor y, si hay ffmpeg, saca el MP4.
//   node disketeboy/tools/video.mjs            → docs/video/disketeboy-en.mp4
//   node disketeboy/tools/video.mjs es         → docs/video/disketeboy-es.mp4
//   node disketeboy/tools/video.mjs mesa [es]  → docs/video/disketeboy-mesa-en.mp4 (o -es)
// Videojuegos: importar de Steam (simulado) → lluvia de cajas → pila de la vergüenza →
// estantería arcoíris → coger una caja y leer la reseña → cartel final.
// Mesa: importar de BoardGameGeek (simulado) → la Kallax se llena → «¿Qué jugamos esta
// noche?» → la ruleta elige → la caja sale de la Kallax → cartel final.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const lang = args.includes('es') ? 'es' : 'en';
const MESA = args.includes('mesa');
const W = 1280, H = 720;
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const NAME = `disketeboy-${MESA ? 'mesa-' : ''}${lang}`;
const OUT = join(tmpdir(), NAME);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const FPS = 30;
const EN = lang === 'en';
const server = spawn(process.execPath, [`${ROOT}server.mjs`], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
for (let i = 0; i < 50; i++) {
  try {
    if ((await fetch(BASE)).ok) break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
// Biblioteca de Steam de mentira: nombres conocidos, sin portadas (se dibujan con código)
const NAMES = `Terraria;Portal;Half-Life 2;Left 4 Dead 2;Team Fortress 2;Counter-Strike 2;Dota 2;Rocket League;Among Us;Dead Cells;
Cuphead;Undertale;Ori and the Blind Forest;Ori and the Will of the Wisps;Subnautica;No Man's Sky;Valheim;Risk of Rain 2;Hotline Miami;Into the Breach;
FTL: Faster Than Light;Darkest Dungeon;Enter the Gungeon;The Binding of Isaac: Rebirth;Spelunky 2;Return of the Obra Dinn;Papers, Please;Firewatch;What Remains of Edith Finch;Gris;
Journey;Limbo;Inside;Hollow Knight: Silksong;Tunic;Death's Door;Sea of Stars;Chained Echoes;Pizza Tower;Vampire Survivors;
Brotato;Dave the Diver;Cult of the Lamb;Spiritfarer;A Short Hike;Unpacking;Night in the Woods;Oxenfree;Kentucky Route Zero;Pentiment;
Divinity: Original Sin 2;Pillars of Eternity;Pathfinder: Wrath of the Righteous;XCOM 2;Civilization VI;Stellaris;Crusader Kings III;Europa Universalis IV;Cities: Skylines;Frostpunk;
RimWorld;Oxygen Not Included;Dyson Sphere Program;Satisfactory;Hollow Knight;Dark Souls III;Sekiro: Shadows Die Twice;Monster Hunter: World;Nioh 2;Lies of P;
The Elder Scrolls V: Skyrim;Fallout 4;Fallout: New Vegas;Mass Effect Legendary Edition;Dragon Age: Inquisition;Kingdom Come: Deliverance;Mount & Blade II;Starfield;Persona 5 Royal;Yakuza 0;
Like a Dragon;Final Fantasy XIV;Nier: Automata;Metal Gear Solid V;Death Stranding;Control;Alan Wake 2;Prey;Dishonored 2;Deus Ex: Mankind Divided;
BioShock Infinite;Titanfall 2;DOOM Eternal;Ultrakill;Doom (1993);Quake;Halo: The Master Chief Collection;Forza Horizon 5;It Takes Two;A Way Out;
Stray;Little Nightmares;Hades II;Lethal Company;Phasmophobia;Palworld;Sons of the Forest;Grounded;Deep Rock Galactic;Helldivers 2`.split(';').map((s) => s.trim()).filter(Boolean);
const rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
const STEAM = {
  steamid: '76561197960287930',
  games: NAMES.filter((n) => n !== 'Hollow Knight').map((name, i) => {
    const r = rnd();
    const never = r < 0.45; // casi la mitad, sin abrir: a la pila
    return { appid: 900000 + i, name, playtime_forever: never ? 0 : Math.round(60 + rnd() * 9000), playtime_2weeks: !never && rnd() < 0.08 ? 120 : 0 };
  }),
};

// Colección de BoardGameGeek de mentira: [nombre, mín., máx., minutos, partidas, nota]
const BOARDS = [
  ['Azul', 2, 4, 45, 18, 8], ['7 Wonders Duel', 2, 2, 30, 25, 9], ['Splendor', 2, 4, 30, 14, 7], ['Pandemic', 2, 4, 45, 9, 8],
  ['Codenames', 2, 8, 15, 40, 8], ['King of Tokyo', 2, 6, 30, 22, 7], ['Patchwork', 2, 2, 30, 12, 8], ['Root', 2, 4, 90, 4, 9],
  ['Spirit Island', 1, 4, 120, 6, 9], ['Everdell', 1, 4, 80, 7, 8], ['Cascadia', 1, 4, 45, 11, 8], ['Scythe', 1, 5, 115, 3, 8],
  ['The Crew', 2, 5, 20, 30, 9], ['Jaipur', 2, 2, 30, 16, 7], ['Sushi Go!', 2, 5, 15, 21, 7], ['Dominion', 2, 4, 30, 10, 7],
  ['Agricola', 1, 4, 120, 2, 8], ['Concordia', 2, 5, 100, 5, 8], ['Heat: Pedal to the Metal', 1, 6, 60, 8, 9], ['Cartographers', 1, 100, 45, 6, 7],
  ['Kingdomino', 2, 4, 15, 19, 7], ['Hanabi', 2, 5, 25, 13, 7], ['Mysterium', 2, 7, 42, 5, 7], ['Blood Rage', 2, 4, 90, 3, 8],
  ['Ark Nova', 1, 4, 150, 0, null], ['Frosthaven', 1, 4, 120, 0, null], ['Twilight Imperium', 3, 6, 480, 0, null], ['Sky Team', 2, 2, 20, 0, null],
];
const BGG = { user: 'meeple_mike', games: BOARDS.map(([name, minPlayers, maxPlayers, minutes, plays, rating], i) => ({ id: 100 + i, name, minPlayers, maxPlayers, minutes, plays, rating })) };

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, locale: EN ? 'en-US' : 'es-ES' });
await ctx.route(/steamstatic|api\/cover/, (r) => r.abort());
await ctx.route(/\/api\/steam/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(STEAM) }));
await ctx.route(/\/api\/bgg/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(BGG) }));
await ctx.addInitScript(() => {
  let now = 0;
  const t0 = Date.now();
  const timers = [];
  let seq = 1;
  const rafs = new Map();
  const animStart = new WeakMap();
  performance.now = () => now;
  Date.now = () => t0 + now;
  window.setTimeout = (fn, ms = 0, ...a) => { const id = seq++; timers.push({ id, at: now + Math.max(0, Number(ms) || 0), fn: () => (typeof fn === 'function' ? fn(...a) : 0) }); return id; };
  window.clearTimeout = (id) => { const i = timers.findIndex((x) => x.id === id); if (i >= 0) timers.splice(i, 1); };
  window.setInterval = (fn, ms = 0, ...a) => { const id = seq++; const tick = () => { fn(...a); timers.push({ id, at: now + Math.max(1, ms), fn: tick }); }; timers.push({ id, at: now + Math.max(1, ms), fn: tick }); return id; };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = (fn) => { const id = seq++; rafs.set(id, fn); return id; };
  window.cancelAnimationFrame = (id) => rafs.delete(id);
  // Las animaciones y transiciones CSS también siguen el reloj virtual
  const syncCss = () => {
    for (const a of document.getAnimations()) {
      if (!animStart.has(a)) { animStart.set(a, now); a.pause(); }
      a.currentTime = now - animStart.get(a);
    }
  };
  window.__advance = (ms) => {
    const end = now + ms;
    for (;;) {
      timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = timers[0];
      if (!next || next.at > end) break;
      timers.shift();
      now = next.at;
      try { next.fn(); } catch (e) { console.error(e); }
    }
    now = end;
    const cbs = [...rafs.values()];
    rafs.clear();
    for (const cb of cbs) { try { cb(now); } catch (e) { console.error(e); } }
    syncCss();
  };
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
// Unos cuantos juegos con reseña antes de empezar (para coger uno al final)
await page.goto(`${BASE}/?hora=21&lang=${lang}`);
await page.evaluate(async (mesa) => {
  const { demoCollection } = await import('./js/demo.js');
  // Unos cuantos con reseña: para coger uno al final y darle la vuelta
  const keep = new Set([367520, 1145360, 413150, 504230, 753640]);
  const boards = new Set(['Carcassonne', 'Catan', 'Wingspan']);
  window.disketeboy.store.importGames(demoCollection().filter((g) => (mesa ? g.kind === 'mesa' && boards.has(g.title) : keep.has(g.steamAppId))));
  window.disketeboy.store.setSettings({ sort: 'color', palette: 'verde', sound: false });
}, MESA);
await page.goto(`${BASE}/?hora=${MESA ? 20 : 21}&lang=${lang}`);
for (let i = 0; i < 400; i++) {
  await page.evaluate(() => window.__advance?.(50));
  if (await page.evaluate((sel) => !!(window.disketeboy?.room && document.querySelector(sel)), MESA ? '#screen #b-bgg' : '#screen #m-steam')) break;
}
await page.evaluate(() => document.fonts.ready);
let frame = 0;
async function shoot(seconds, each) {
  const n = Math.round(seconds * FPS);
  for (let i = 0; i < n; i++) {
    if (each) await page.evaluate(each, i / n);
    await page.evaluate((ms) => window.__advance(ms), 1000 / FPS);
    await page.screenshot({ path: `${OUT}/f${String(frame++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 });
  }
}
const run = (fn, arg) => page.evaluate(fn, arg);

if (!MESA) {
  // 1) La consola: Importar de Steam y escribir el perfil
  await shoot(0.6);
  await run(() => window.disketeboy.device.go('steam'));
  await shoot(0.4);
  await shoot(1.3, (p) => {
    const input = document.getElementById('s-perfil');
    input.value = 'steamcommunity.com/id/backlog'.slice(0, Math.ceil(p * 30));
  });
  await run(() => document.getElementById('s-buscar').click());
  await shoot(0.4);
  await page.waitForSelector('#s-importar');
  await shoot(1.6);
  // 2) ¡Lluvia de cajas!
  await run(() => document.getElementById('s-importar').click());
  await shoot(5.2);
  // 3) La pila de la vergüenza
  await run(() => window.disketeboy.room.focusZone('pila'));
  await shoot(3.4);
  // 4) Ordenar: todo a la estantería, por colores
  await run(() => {
    window.disketeboy.store.setSettings({ tidy: true });
    window.disketeboy.room.focusZone('estanteria');
  });
  await shoot(4.2);
  await run(() => window.disketeboy.store.setSettings({ tidy: false }));
  await shoot(1.4);
  // 5) Coger una caja y darle la vuelta: detrás está tu reseña
  const id = await run(() => window.disketeboy.store.getGames().find((g) => g.steamAppId === 367520).id);
  await run((gid) => window.disketeboy.room.inspect(gid), id);
  await shoot(1.5);
  await run(() => window.disketeboy.room.flip());
  // Zoom suave para que la reseña se lea: la caja está a 0,75 m de la cámara
  await shoot(2.8, (p) => {
    const { camera } = window.disketeboy.room.debug;
    const k = Math.min(1, p * 2.2);
    camera.fov = 50 - 16 * (k * k * (3 - 2 * k));
    camera.updateProjectionMatrix();
    window.disketeboy.room.invalidate();
  });
} else {
  // 1) El disquete azul: Importar de BoardGameGeek
  await shoot(0.6);
  await run(() => window.disketeboy.device.go('bgg'));
  await shoot(0.4);
  await shoot(1.3, (p) => {
    document.getElementById('g-usuario').value = 'meeple_mike'.slice(0, Math.ceil(p * 11));
  });
  await run(() => document.getElementById('g-buscar').click());
  await shoot(0.4);
  await page.waitForSelector('#g-importar');
  await shoot(1.6);
  // 2) La Kallax se llena (los que no tienen partidas, encima y con su plástico)
  await run(() => document.getElementById('g-importar').click());
  await shoot(5.0);
  // 3) ¿Qué jugamos esta noche? La ruleta elige (con azar fijo, para que el vídeo sea siempre igual)
  await run(() => window.disketeboy.raise());
  await shoot(0.8);
  await run(() => window.disketeboy.device.go('queJugamos'));
  await shoot(1.4);
  await run(async () => {
    const { whatToPlay } = await import('./js/boards.js');
    const list = whatToPlay(window.disketeboy.store.getBoards(), { players: 4, minutes: 60 });
    const i = Math.max(0, list.findIndex((g) => g.title === 'Carcassonne'));
    window.__random = Math.random;
    Math.random = () => (i + 0.5) / list.length;
    document.getElementById('q-ruleta').click();
  });
  await shoot(4.2);
  await run(() => (Math.random = window.__random));
  // 4) ¡Sácalo de la Kallax! y darle la vuelta
  await run(() => document.getElementById('r-sacar').click());
  await shoot(2.2);
  await run(() => window.disketeboy.room.flip());
  await shoot(2.6, (p) => {
    const { camera } = window.disketeboy.room.debug;
    const k = Math.min(1, p * 2.2);
    camera.fov = 50 - 16 * (k * k * (3 - 2 * k));
    camera.updateProjectionMatrix();
    window.disketeboy.room.invalidate();
  });
}
// 6) Cartel final
await page.addStyleTag({ content: `
  .vid-end { position: fixed; inset: 0; z-index: 50; display: grid; place-items: center; background: #1d1814e6; opacity: 0; }
  .vid-end div { padding: 30px 40px 26px; border-radius: 26px; background: #f3ead8; box-shadow: 0 12px 0 #c9bca4, 0 24px 60px #000a; text-align: center; }
  .vid-end b { display: block; font: 58px/1 "Press Start 2P", monospace; color: #2b2622; }
  .vid-end b span { color: #c8553d; }
  .vid-end i { display: block; margin: 18px auto 0; height: 12px; border-radius: 6px; background: linear-gradient(90deg, #c8553d 0 33%, #3a6ea5 33% 66%, #4f8a3b 66%); }
  .vid-end p { margin: 20px 0 0; font: 600 30px/1.3 "Trebuchet MS", system-ui, sans-serif; color: #2b2622; }
` });
await run((text) => {
  const el = document.createElement('div');
  el.className = 'vid-end';
  el.innerHTML = `<div><b>Diskete<span>Boy</span></b><i></i><p>${text}</p></div>`;
  document.body.append(el);
}, EN ? 'Video games · Board games · Cards<br>Free, no sign-up' : 'Videojuegos · Juegos de mesa · Cartas<br>Gratis y sin registro');
await page.evaluate(() => document.fonts.load('58px "Press Start 2P"'));
await shoot(2.4, (p) => { document.querySelector('.vid-end').style.opacity = String(Math.min(1, p * 3)); });
console.log(`${frame} fotogramas en ${OUT}`);
await browser.close();
server.kill();
try {
  const mp4 = `${ROOT}docs/video/${NAME}.mp4`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(OUT, 'f%05d.jpg'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-preset', 'slow', '-movflags', '+faststart', mp4]);
  console.log(`Vídeo: ${mp4}`);
} catch {
  console.log('No hay ffmpeg: los fotogramas se quedan en la carpeta de arriba.');
}
