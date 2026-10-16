// Arranque de DisketeBoy: la consola en primer plano y la habitación 3D detrás.
// La habitación se carga aparte: si el navegador no puede con WebGL, la
// consola sigue funcionando igual.
import * as store from './store.js';
import { createDevice, h } from './device.js';
import { demoCollection } from './demo.js';
import { platform } from './platforms.js';
import { statusLabel, isBoard } from './store.js';
import { playersText, minutesText, lentText } from './boards.js';
import { tcg, recordText, euros, deckCount } from './cards.js';
import { t, tp, num, setLang, detectLang } from './i18n.js';
import { createLogros, logrosOf, pickShowcase } from './logros.js';
import { confetti } from './fx.js';
import { sfx, setRain } from './audio.js';
import { seasonOf } from './util.js';

const params = new URLSearchParams(location.search);
setLang(params.get('lang') || store.getSettings().lang || detectLang());
translatePage();
const body = document.body;
const canvas = document.getElementById('room');
const deviceEl = document.getElementById('dkb');
const inspectEl = document.getElementById('inspect');
const ticketEl = document.getElementById('ticket');
const tidyBtn = document.getElementById('r-ordenar');
const lightBtn = document.getElementById('r-luz');
let room = null;
let inspecting = null;
let lastFocus = null;

const isLowered = () => body.classList.contains('device-down');
const deviceParts = () => deviceEl.querySelectorAll('.dkb-bezel, .dkb-controls, .dkb-pills');

function lower() {
  if (isLowered()) return;
  body.classList.replace('device-up', 'device-down');
  deviceParts().forEach((el) => (el.inert = true));
  room?.setActive(true);
  canvas.focus({ preventScroll: true });
}

function raise() {
  if (!isLowered()) return;
  release();
  body.classList.replace('device-down', 'device-up');
  deviceParts().forEach((el) => (el.inert = false));
  room?.setActive(false);
  device.focus();
}

function release() {
  if (!inspecting) return;
  room?.release();
}

// ------------------------------------------------------------------ idioma
/** Los textos fijos de la página (index.html), en el idioma elegido. */
function translatePage() {
  document.title = t(document.title);
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.textContent.trim());
  for (const el of document.querySelectorAll('[aria-label]')) el.setAttribute('aria-label', t(el.getAttribute('aria-label')));
}

// ------------------------------------------------------------------ consola
const actions = {
  isLowered,
  lower,
  raise,
  showInRoom(id) {
    lower();
    room?.inspect(id);
  },
  showZone(zone) {
    lower();
    room?.focusZone(zone);
  },
  async steamLookup(input) {
    try {
      const res = await fetch(`api/steam?id=${encodeURIComponent(input)}`, { signal: AbortSignal.timeout(15000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error || 'red', message: data.message };
      return data;
    } catch {
      return { error: 'sin_conexion' };
    }
  },
  async bggLookup(user) {
    try {
      const res = await fetch(`api/bgg?user=${encodeURIComponent(user)}`, { signal: AbortSignal.timeout(20000) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error || 'bgg_red', message: data.message };
      return data;
    } catch {
      return { error: 'sin_conexion' };
    }
  },
  /** Los logros que se ven: los tuyos, o los de la colección que visitas. */
  logrosList: () => (logros ? logros.list() : logrosOf(store.getGames())),
  async openStory() {
    const { openStory } = await import('./story.js');
    const name = store.visiting()?.name || store.getSettings().name;
    openStory(store.getGames(), {
      name,
      onShare: (cnv) => shareCanvas(cnv, 'mi-resumen-disketeboy.png', t('Mi resumen de DisketeBoy')),
      onClose: () => device.focus(),
    });
  },
  onButton: (name) => konamiStep(name),
  printTicket,
  shareVisit,
  leaveVisit,
};

const device = createDevice(deviceEl, actions);

// ------------------------------------------------------------------ visitas
async function shareVisit() {
  const { encodeRoom, visitUrl, LONG_URL } = await import('./share.js');
  const { name, theme, pet } = store.getSettings();
  const url = visitUrl(location.origin + location.pathname, await encodeRoom(store.getGames(), { name, theme, pet }));
  const long = url.length > LONG_URL ? ` ${t('Ojo: tu colección es enorme y el enlace mide {n} mil caracteres; alguna app podría cortarlo.', { n: Math.round(url.length / 1000) })}` : '';
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: t('Mi habitación en DisketeBoy'), text: t('¡Pasa a ver mi colección!'), url });
      return;
    } catch {
      /* cancelado: probamos a copiarlo */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    device.toast(`${t('¡Enlace copiado! Quien lo abra verá tu habitación de visita.')}${long}`);
  } catch {
    window.prompt(t('Copia este enlace para compartir tu habitación:'), url);
  }
  window.disketeboy.lastVisitUrl = url;
  logroEvent('compartir');
}

function leaveVisit() {
  const lang = params.get('lang');
  location.replace(location.pathname + (lang ? `?lang=${encodeURIComponent(lang)}` : ''));
}

async function maybeVisit() {
  if (!location.hash.startsWith('#visita=')) return;
  try {
    const { decodeRoom } = await import('./share.js');
    const { name, games, look } = await decodeRoom(location.hash.slice('#visita='.length));
    store.startVisit(games, name, look);
    // El nombre va en negrita en mitad de la frase, esté donde esté según el idioma
    const [before, after = ''] = t('👀 Estás de visita en la habitación de {name}').split('{name}');
    const who = Object.assign(document.createElement('b'), { id: 'visit-name', textContent: name || t('alguien') });
    document.getElementById('visit-text').replaceChildren(before, who, after);
    document.getElementById('visit-banner').hidden = false;
    document.getElementById('i-editar').hidden = true;
    body.classList.add('is-visit');
  } catch (err) {
    device.toast(err.message);
  }
}
window.addEventListener('hashchange', () => location.hash.startsWith('#visita=') && location.reload());
document.getElementById('visit-leave').addEventListener('click', leaveVisit);

// ------------------------------------------------------------------ habitación
function onInspect(game) {
  inspecting = game?.id || null;
  if (!game) {
    inspectEl.hidden = true;
    return;
  }
  document.getElementById('inspect-title').textContent = game.title;
  const bits = game.kind === 'mazo'
    ? [t(tcg(game.tcg).name), game.format, statusLabel(game), recordText(game), tp(deckCount(game.list), '1 carta', '{n} cartas')]
    : game.kind === 'carpeta'
      ? [t(tcg(game.tcg).name), tp(game.cards, '1 carta', '{n} cartas', { n: num(game.cards) }), euros(game.value), statusLabel(game)]
      : isBoard(game)
    ? [playersText(game), minutesText(game.minutes), statusLabel(game), game.score === null ? t('sin nota') : `${game.score}/10`, tp(game.plays, '1 partida', '{n} partidas'), game.lentTo ? lentText(game) : null]
    : [t(platform(game.platform).name), statusLabel(game), game.score === null ? t('sin nota') : `${game.score}/10`, game.hours ? `${game.hours} h` : null];
  document.getElementById('inspect-meta').textContent = bits.filter(Boolean).join(' · ');
  inspectEl.hidden = false;
}

async function startRoom() {
  if (params.get('sin3d') === '1') return showFallback();
  try {
    const { createRoom } = await import('./room.js');
    room = createRoom(canvas, {
      hour: params.has('hora') ? Number(params.get('hora')) : null,
      onInspect,
      onRelease: () => onInspect(null),
      onColors: (batch) => store.setColors(batch),
      onNotice: (text) => device.toast(text),
      onPet: () => logroEvent('gato'),
      season: seasonOf(new Date(), params.get('temporada')),
      weather: ['lluvia', 'despejado'].includes(params.get('tiempo')) ? params.get('tiempo') : null,
      onWeather: (on) => setRain(on),
      onLights: (on) => lightBtn.setAttribute('aria-pressed', String(!on)),
    });
    if (!room) return showFallback();
    room.sync(store.getGames(), store.getSettings(), { type: 'init' });
    room.setAmbient(store.getSettings().ambient !== false);
    room.setTrophies(trophyList());
    room.setActive(isLowered());
  } catch (err) {
    console.error(err);
    showFallback();
  }
}

function showFallback() {
  document.getElementById('room-fallback').hidden = false;
  canvas.hidden = true;
}

store.subscribe((change) => {
  room?.sync(store.getGames(), store.getSettings(), change);
  if (change.type === 'settings') room?.setAmbient(store.getSettings().ambient !== false);
  celebrate(change);
  checkLogros();
  tidyBtn.setAttribute('aria-pressed', String(store.getSettings().tidy));
  if (change.type === 'remove' && change.ids.includes(inspecting)) onInspect(null);
});
tidyBtn.setAttribute('aria-pressed', String(store.getSettings().tidy));

// ------------------------------------------------------------------ logros y celebraciones
let logros = null;
const logroEl = document.getElementById('logro');
let logroTimer = 0;
let celebrateTimer = 0;

/** Los trofeos del alféizar: los tuyos o, de visita, los de la otra persona. */
function trophyList() {
  const list = logros ? logros.list() : logrosOf(store.getGames());
  return pickShowcase(list).map((l) => ({ id: l.id, tier: l.tier, icon: l.icon, title: t(l.title) }));
}

function showLogros(nuevos) {
  const one = nuevos.length === 1;
  logroEl.replaceChildren(
    h('span', { class: 'logro-icons', 'aria-hidden': 'true', text: nuevos.slice(0, 4).map((l) => l.icon).join(' ') }),
    h(
      'span',
      { class: 'logro-text' },
      h('b', { text: one ? t('¡Logro desbloqueado!') : t('¡{n} logros desbloqueados!', { n: nuevos.length }) }),
      h('span', {
        text: one
          ? `${t(nuevos[0].title)} · ${t(nuevos[0].text)}`
          : nuevos.length > 4
            ? t('{list} y {n} más', { list: nuevos.slice(0, 3).map((l) => t(l.title)).join(' · '), n: nuevos.length - 3 })
            : nuevos.map((l) => t(l.title)).join(' · '),
      }),
    ),
  );
  logroEl.hidden = false;
  logroEl.classList.remove('is-on');
  void logroEl.offsetWidth;
  logroEl.classList.add('is-on');
  clearTimeout(logroTimer);
  logroTimer = setTimeout(() => logroEl.classList.remove('is-on'), one ? 4200 : 5600);
  sfx.fanfare();
  confetti({ count: one ? 90 : 150 });
}

function checkLogros() {
  if (!logros || store.visiting()) {
    room?.setTrophies(trophyList());
    return;
  }
  const nuevos = logros.check(store.getGames());
  room?.setTrophies(trophyList());
  if (nuevos.length) showLogros(nuevos);
}

/** Algo que no está en la colección (acariciar al gato, compartir, imprimir). */
function logroEvent(name) {
  if (!logros || store.visiting()) return;
  logros.event(name);
  checkLogros();
}

/** Terminar un juego, estrenar uno de mesa o ganar con un mazo merece confeti. */
function celebrate(change) {
  if (change.type !== 'update' || !change.prev || store.visiting()) return;
  const prev = change.prev;
  const g = store.getGame(change.ids[0]);
  if (!g) return;
  if (g.kind === 'video' && prev.status !== 'terminado' && g.status === 'terminado') {
    // Con la cruceta se pasa por «Terminado» de camino a otro estado: esperamos un poco
    clearTimeout(celebrateTimer);
    celebrateTimer = setTimeout(() => {
      if (store.getGame(g.id)?.status !== 'terminado') return;
      sfx.fanfare();
      confetti({ count: 110 });
      device.toast(t('¡«{title}» terminado! A la estantería, con su estrella ★', { title: g.title }));
    }, 900);
  } else if (g.kind === 'mesa' && prev.status === 'pendiente' && g.plays > prev.plays) {
    sfx.fanfare();
    confetti({ count: 80 });
  } else if (g.kind === 'mazo' && g.wins > prev.wins) {
    confetti({ count: 45, power: 0.8 });
  }
}

// ------------------------------------------------------------------ ticket y compartir
async function printTicket() {
  const { renderTicket } = await import('./ticket.js');
  // Que la fuente de terminal esté cargada antes de imprimir (máximo 1,5 s de espera).
  await Promise.race([document.fonts?.load('21px VT323').catch(() => {}), new Promise((r) => setTimeout(r, 1500))]);
  const canvasTicket = renderTicket(store.getVideoGames());
  const img = document.getElementById('ticket-img');
  img.src = canvasTicket.toDataURL('image/png');
  img.alt = t('Ticket con el resumen de tu colección');
  ticketEl.hidden = false;
  lastFocus = document.activeElement;
  document.getElementById('t-descargar').focus();
  const { sfx } = await import('./audio.js');
  sfx.print();
  logroEvent('ticket');
  const shareBtn = document.getElementById('t-compartir');
  shareBtn.hidden = !navigator.canShare;
  shareBtn.onclick = () => shareCanvas(canvasTicket, 'disketeboy-ticket.png', t('Mi colección en DisketeBoy'));
  document.getElementById('t-descargar').onclick = () => download(canvasTicket, 'disketeboy-ticket.png');
  // El momento «¡qué chulo!»: aquí, y no al entrar, va la invitación a donar
  const { donateUrl } = await import('./config.js');
  const donate = donateUrl();
  const donateEl = document.getElementById('t-donar');
  donateEl.hidden = !donate;
  if (donate) donateEl.querySelector('a').href = donate;
}

function closeTicket() {
  ticketEl.hidden = true;
  lastFocus?.focus?.();
}

function download(cnv, name) {
  const a = document.createElement('a');
  a.download = name;
  a.href = cnv.toDataURL('image/png');
  document.body.append(a);
  a.click();
  a.remove();
}

async function shareCanvas(cnv, name, text) {
  const blob = await new Promise((r) => cnv.toBlob(r, 'image/png'));
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return;
    } catch {
      /* cancelado */
    }
  }
  download(cnv, name);
}

async function shareRoom() {
  if (!room) return device.toast(t('Sin habitación 3D no puedo hacer la foto'));
  const { renderSnapshot } = await import('./ticket.js');
  const shot = renderSnapshot(room.snapshot(), store.getGames());
  await shareCanvas(shot, 'mi-habitacion-disketeboy.png', t('Mi habitación en DisketeBoy 🎮'));
}

// ------------------------------------------------------------------ botones de la habitación
document.getElementById('r-subir').addEventListener('click', raise);
document.getElementById('dkb-handle').addEventListener('click', raise);
tidyBtn.addEventListener('click', () => {
  const tidy = !store.getSettings().tidy;
  store.setSettings({ tidy });
  device.toast(tidy ? t('¡Todo a la estantería! (la pila sigue contando, tranquilo)') : t('Vuelta al caos natural de tu habitación'));
});
document.getElementById('r-compartir').addEventListener('click', shareRoom);
lightBtn.addEventListener('click', () => room?.toggleLights());
document.getElementById('i-girar').addEventListener('click', () => room?.flip());
document.getElementById('i-cerrar').addEventListener('click', release);
document.getElementById('i-editar').addEventListener('click', () => {
  const id = inspecting;
  raise();
  if (id) device.go('ficha', { id });
});
document.getElementById('t-cerrar').addEventListener('click', closeTicket);
ticketEl.addEventListener('click', (e) => e.target === ticketEl && closeTicket());

// Código Konami: ↑ ↑ ↓ ↓ ← → ← → B A, con el teclado o con la cruceta de la consola
const KONAMI = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a'];
const KONAMI_KEYS = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', b: 'b', B: 'b', a: 'a', A: 'a' };
let konamiAt = 0;
function konamiStep(name) {
  konamiAt = name === KONAMI[konamiAt] ? konamiAt + 1 : name === 'up' ? (konamiAt === 2 ? 2 : 1) : 0;
  if (konamiAt < KONAMI.length) return;
  konamiAt = 0;
  sfx.powerup();
  device.toast(t('↑↑↓↓←→←→BA: ¡30 vidas extra! (bueno, una ola de cajas)'));
  logroEvent('konami');
  if (!room) return;
  // Baja la consola para que se vea la ola
  const wasDown = isLowered();
  release();
  lower();
  setTimeout(() => room.wave(), wasDown ? 0 : 550);
}
document.addEventListener('keydown', (e) => !e.repeat && KONAMI_KEYS[e.key] && konamiStep(KONAMI_KEYS[e.key]), true);

document.addEventListener('keydown', (e) => {
  if (!ticketEl.hidden) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeTicket();
    }
    return;
  }
  if (isLowered()) {
    if (e.target.closest?.('.room-ui, .inspect') && !['Escape'].includes(e.key)) return;
    if (room?.handleKey(e)) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      raise();
    }
    return;
  }
  device.handleKey(e);
});

// ------------------------------------------------------------------ arranque
// Para las pruebas automáticas y para curiosos desde la consola del navegador.
window.disketeboy = { store, get room() { return room; }, device, lower, raise, shareVisit, get logros() { return logros; } };
canvas.tabIndex = 0;
await maybeVisit();
// Los logros son tuyos: de visita no se apuntan (se ven los de la otra persona)
if (!store.visiting()) logros = createLogros();
checkLogros();
if (!store.visiting() && params.get('demo') === '1' && !store.getGames().length) store.importGames(demoCollection());
device.boot();
startRoom();
