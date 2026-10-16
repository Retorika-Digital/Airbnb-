// Arranque de DisketeBoy: la consola en primer plano y la habitación 3D detrás.
// La habitación se carga aparte: si el navegador no puede con WebGL, la
// consola sigue funcionando igual.
import * as store from './store.js';
import { createDevice } from './device.js';
import { DEMO_GAMES, DEMO_BOARDS, DEMO_CARDS } from './demo.js';
import { platform } from './platforms.js';
import { statusLabel, isBoard } from './store.js';
import { playersText, minutesText, lentText } from './boards.js';
import { tcg, recordText, euros, deckCount } from './cards.js';

const params = new URLSearchParams(location.search);
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
      return { error: 'red', message: 'No hay conexión con el servidor. ¿Estás sin internet?' };
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
  const long = url.length > LONG_URL ? ` Ojo: tu colección es enorme y el enlace mide ${Math.round(url.length / 1000)} mil caracteres; alguna app podría cortarlo.` : '';
  if (navigator.share && matchMedia('(pointer: coarse)').matches) {
    try {
      await navigator.share({ title: 'Mi habitación en DisketeBoy', text: '¡Pasa a ver mi colección!', url });
      return;
    } catch {
      /* cancelado: probamos a copiarlo */
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    device.toast(`¡Enlace copiado! Quien lo abra verá tu habitación de visita.${long}`);
  } catch {
    window.prompt('Copia este enlace para compartir tu habitación:', url);
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
    document.getElementById('visit-name').textContent = name || 'alguien';
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
    ? [tcg(game.tcg).name, game.format, statusLabel(game), recordText(game), `${deckCount(game.list)} cartas`]
    : game.kind === 'carpeta'
      ? [tcg(game.tcg).name, `${game.cards} cartas`, euros(game.value), statusLabel(game)]
      : isBoard(game)
    ? [playersText(game), minutesText(game.minutes), statusLabel(game), game.score === null ? 'sin nota' : `${game.score}/10`, `${game.plays} partida${game.plays === 1 ? '' : 's'}`, game.lentTo ? lentText(game) : null]
    : [platform(game.platform).name, statusLabel(game), game.score === null ? 'sin nota' : `${game.score}/10`, game.hours ? `${game.hours} h` : null];
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
  img.alt = 'Ticket con el resumen de tu colección';
  ticketEl.hidden = false;
  lastFocus = document.activeElement;
  document.getElementById('t-descargar').focus();
  const { sfx } = await import('./audio.js');
  sfx.print();
  const shareBtn = document.getElementById('t-compartir');
  shareBtn.hidden = !navigator.canShare;
  shareBtn.onclick = () => shareCanvas(canvasTicket, 'disketeboy-ticket.png', 'Mi colección en DisketeBoy');
  document.getElementById('t-descargar').onclick = () => download(canvasTicket, 'disketeboy-ticket.png');
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
  if (!room) return device.toast('Sin habitación 3D no puedo hacer la foto');
  const { renderSnapshot } = await import('./ticket.js');
  const shot = renderSnapshot(room.snapshot(), store.getGames());
  await shareCanvas(shot, 'mi-habitacion-disketeboy.png', 'Mi habitación en DisketeBoy 🎮');
}

// ------------------------------------------------------------------ botones de la habitación
document.getElementById('r-subir').addEventListener('click', raise);
document.getElementById('dkb-handle').addEventListener('click', raise);
tidyBtn.addEventListener('click', () => {
  const tidy = !store.getSettings().tidy;
  store.setSettings({ tidy });
  device.toast(tidy ? '¡Todo a la estantería! (la pila sigue contando, tranquilo)' : 'Vuelta al caos natural de tu habitación');
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
if (!store.visiting() && params.get('demo') === '1' && !store.getGames().length) store.importGames([...DEMO_GAMES, ...DEMO_BOARDS, ...DEMO_CARDS]);
device.boot();
startRoom();
