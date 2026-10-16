// Arranque de DisketeBoy: la consola en primer plano y la habitación 3D detrás.
// La habitación se carga aparte: si el navegador no puede con WebGL, la
// consola sigue funcionando igual.
import * as store from './store.js';
import { createDevice } from './device.js';
import { demoCollection } from './demo.js';
import { platform } from './platforms.js';
import { statusLabel, isBoard } from './store.js';
import { playersText, minutesText, lentText } from './boards.js';
import { tcg, recordText, euros, deckCount } from './cards.js';
import { t, tp, num, setLang, detectLang } from './i18n.js';

const params = new URLSearchParams(location.search);
setLang(params.get('lang') || store.getSettings().lang || detectLang());
translatePage();
const body = document.body;
const canvas = document.getElementById('room');
const deviceEl = document.getElementById('dkb');
const inspectEl = document.getElementById('inspect');
const ticketEl = document.getElementById('ticket');
const tidyBtn = document.getElementById('r-ordenar');
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
}

function leaveVisit() {
  location.replace(location.pathname);
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
    });
    if (!room) return showFallback();
    room.sync(store.getGames(), store.getSettings(), { type: 'init' });
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
  tidyBtn.setAttribute('aria-pressed', String(store.getSettings().tidy));
  if (change.type === 'remove' && change.ids.includes(inspecting)) onInspect(null);
});
tidyBtn.setAttribute('aria-pressed', String(store.getSettings().tidy));

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
document.getElementById('i-girar').addEventListener('click', () => room?.flip());
document.getElementById('i-cerrar').addEventListener('click', release);
document.getElementById('i-editar').addEventListener('click', () => {
  const id = inspecting;
  raise();
  if (id) device.go('ficha', { id });
});
document.getElementById('t-cerrar').addEventListener('click', closeTicket);
ticketEl.addEventListener('click', (e) => e.target === ticketEl && closeTicket());

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
window.disketeboy = { store, get room() { return room; }, device, lower, raise, shareVisit };
canvas.tabIndex = 0;
await maybeVisit();
if (!store.visiting() && params.get('demo') === '1' && !store.getGames().length) store.importGames(demoCollection());
device.boot();
startRoom();
