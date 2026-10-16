// Logros: se ganan con lo que hay en tu colección (y con alguna travesura, como
// acariciar al gato). Se guardan aparte de la colección para celebrarlos una sola vez
// y recordar cuándo llegaron. Sin dependencias del navegador: se puede probar en Node.
import { mark } from './i18n.js';

// Consolas de antes del año 2000
const RETRO = new Set(['nes', 'snes', 'n64', 'gb', 'gbc', 'ps1', 'md', 'saturn', 'dc']);

/** Todo lo que se cuenta para los logros, sacado de la colección. */
export function counters(games, ev = {}) {
  const list = Array.isArray(games) ? games : [];
  const video = list.filter((g) => g.kind === 'video');
  const boards = list.filter((g) => g.kind === 'mesa');
  const decks = list.filter((g) => g.kind === 'mazo');
  const binders = list.filter((g) => g.kind === 'carpeta');
  return {
    total: list.length,
    video: video.length,
    beaten: video.filter((g) => g.status === 'terminado').length,
    backlog: video.filter((g) => g.status === 'pendiente').length,
    dropped: video.filter((g) => g.status === 'abandonado').length,
    reviews: list.filter((g) => String(g.review || '').trim()).length,
    tens: list.filter((g) => g.score === 10).length,
    retro: video.filter((g) => RETRO.has(g.platform)).length,
    platforms: new Set(video.map((g) => g.platform)).size,
    hours: video.reduce((s, g) => s + (g.hours || 0), 0),
    steam: video.filter((g) => g.steamAppId).length,
    boards: boards.length,
    plays: boards.reduce((s, g) => s + (g.plays || 0), 0),
    lent: boards.filter((g) => g.lentTo).length,
    bestWins: decks.reduce((m, d) => Math.max(m, d.wins || 0), 0),
    cards: binders.reduce((s, b) => s + (b.cards || 0), 0),
    cat: ev.gato || 0,
    shares: ev.compartir || 0,
    tickets: ev.ticket || 0,
    konami: ev.konami || 0,
  };
}

// tier: bronce, plata u oro (el color del trofeo). secret: no se cuenta cómo se gana.
export const LOGROS = [
  { id: 'primer-disquete', tier: 'bronce', icon: '💾', title: mark('Primer disquete'), text: mark('Añade lo primero a tu colección'), test: (c) => c.total >= 1 },
  { id: 'diez-cajas', tier: 'bronce', icon: '📦', title: mark('Diez cajas'), text: mark('Diez cosas en tu colección'), test: (c) => c.total >= 10 },
  { id: 'coleccionista', tier: 'plata', icon: '🏛️', title: mark('Coleccionista'), text: mark('Cien cosas en tu colección'), test: (c) => c.total >= 100 },
  { id: 'museo', tier: 'oro', icon: '🏰', title: mark('Museo'), text: mark('Quinientas cosas en tu colección'), test: (c) => c.total >= 500 },
  { id: 'creditos-finales', tier: 'bronce', icon: '🏁', title: mark('Créditos finales'), text: mark('Termina tu primer juego'), test: (c) => c.beaten >= 1 },
  { id: 'completista', tier: 'plata', icon: '🎖️', title: mark('Completista'), text: mark('Termina 25 juegos'), test: (c) => c.beaten >= 25 },
  { id: 'pila-cero', tier: 'oro', icon: '🧹', title: mark('Pila a cero'), text: mark('Ni un juego pendiente, con diez o más en tu colección'), test: (c) => c.video >= 10 && c.backlog === 0 },
  { id: 'montana', tier: 'bronce', icon: '🗻', title: mark('Montaña de la vergüenza'), text: mark('25 juegos sin empezar. Aquí no se juzga.'), test: (c) => c.backlog >= 25 },
  { id: 'a-otra-cosa', tier: 'bronce', icon: '🪦', title: mark('A otra cosa'), text: mark('Abandona un juego. Sin rencores.'), test: (c) => c.dropped >= 1 },
  { id: 'critico', tier: 'bronce', icon: '✍️', title: mark('Crítico'), text: mark('Escribe tu primera reseña'), test: (c) => c.reviews >= 1 },
  { id: 'columnista', tier: 'plata', icon: '📰', title: mark('Columnista'), text: mark('Diez reseñas escritas'), test: (c) => c.reviews >= 10 },
  { id: 'obra-maestra', tier: 'bronce', icon: '⭐', title: mark('Obra maestra'), text: mark('Ponle un 10 a algo'), test: (c) => c.tens >= 1 },
  { id: 'arqueologo', tier: 'bronce', icon: '👾', title: mark('Arqueólogo'), text: mark('Un juego de una consola de antes del 2000'), test: (c) => c.retro >= 1 },
  { id: 'sin-bandos', tier: 'plata', icon: '🎮', title: mark('Sin bandos'), text: mark('Juegos de cinco plataformas distintas'), test: (c) => c.platforms >= 5 },
  { id: 'mil-horas', tier: 'oro', icon: '⏳', title: mark('Mil horas'), text: mark('Mil horas de juego apuntadas'), test: (c) => c.hours >= 1000 },
  { id: 'vapor', tier: 'bronce', icon: '☁️', title: mark('Vapor'), text: mark('Trae juegos de tu biblioteca de Steam'), test: (c) => c.steam >= 1 },
  { id: 'noche-de-juegos', tier: 'bronce', icon: '🎲', title: mark('Noche de juegos'), text: mark('Apunta una partida de un juego de mesa'), test: (c) => c.plays >= 1 },
  { id: 'kallax-llena', tier: 'plata', icon: '🧱', title: mark('Kallax llena'), text: mark('Dieciséis juegos de mesa'), test: (c) => c.boards >= 16 },
  { id: 'buen-amigo', tier: 'bronce', icon: '🤝', title: mark('Buen amigo'), text: mark('Presta un juego de mesa'), test: (c) => c.lent >= 1 },
  { id: 'invicto', tier: 'plata', icon: '🏆', title: mark('Invicto'), text: mark('Un mazo con diez victorias'), test: (c) => c.bestWins >= 10 },
  { id: 'archivero', tier: 'plata', icon: '📚', title: mark('Archivero'), text: mark('Mil cartas en carpetas'), test: (c) => c.cards >= 1000 },
  { id: 'anfitrion', tier: 'bronce', icon: '🔗', title: mark('Anfitrión'), text: mark('Comparte tu habitación'), test: (c) => c.shares >= 1 },
  { id: 'ticket', tier: 'bronce', icon: '🧾', title: mark('Pide el ticket'), text: mark('Imprime tu ticket en la DisketePrinter'), test: (c) => c.tickets >= 1 },
  { id: 'amigo-del-gato', tier: 'oro', icon: '🐱', title: mark('Amigo del gato'), text: mark('Acaricia al gato diez veces'), secret: true, test: (c) => c.cat >= 10 },
  { id: 'konami', tier: 'oro', icon: '🕹️', title: mark('Código Konami'), text: mark('↑ ↑ ↓ ↓ ← → ← → B A'), secret: true, test: (c) => c.konami >= 1 },
];

const KEY = 'dkb:logros:v1';
const EVENTS = ['gato', 'compartir', 'ticket', 'konami'];

/**
 * Lleva la cuenta de los logros conseguidos (y cuándo).
 * La primera vez se apuntan sin celebrar los que ya tenías: así nadie recibe 15
 * avisos de golpe al estrenar esta función.
 */
export function createLogros({ storage = globalThis.localStorage, now = () => new Date() } = {}) {
  let state = { got: {}, ev: {} };
  let fresh = true;
  try {
    const raw = JSON.parse(storage?.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') {
      fresh = false;
      for (const l of LOGROS) if (typeof raw.got?.[l.id] === 'string') state.got[l.id] = raw.got[l.id];
      for (const e of EVENTS) if (Number.isInteger(raw.ev?.[e]) && raw.ev[e] > 0) state.ev[e] = Math.min(raw.ev[e], 1e6);
    }
  } catch {
    /* datos rotos: se empieza de cero */
  }
  const save = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(state));
    } catch {
      /* sin espacio o sin permiso: los logros se quedan en memoria */
    }
  };
  return {
    /** Comprueba la colección y devuelve los logros nuevos (vacío la primera vez). */
    check(games) {
      const c = counters(games, state.ev);
      const fresh_ = fresh;
      fresh = false;
      const nuevos = LOGROS.filter((l) => !state.got[l.id] && l.test(c));
      for (const l of nuevos) state.got[l.id] = now().toISOString();
      if (nuevos.length || fresh_) save();
      return fresh_ ? [] : nuevos;
    },
    /** Algo que no se ve en la colección: acariciar al gato, compartir, imprimir. */
    event(name) {
      if (!EVENTS.includes(name)) return;
      state.ev[name] = (state.ev[name] || 0) + 1;
      save();
    },
    /** Todos los logros con su fecha, o null si aún no. */
    list() {
      return LOGROS.map((l) => ({ ...l, got: state.got[l.id] || null }));
    },
    count: () => Object.keys(state.got).length,
  };
}

/** Los logros que se ven en una colección ajena (de visita): sin fechas ni travesuras. */
export const logrosOf = (games) => {
  const c = counters(games);
  return LOGROS.map((l) => ({ ...l, got: l.test(c) ? true : null }));
};

const RANK = { oro: 0, plata: 1, bronce: 2 };

/** Los que caben en el alféizar: primero oro, luego plata y bronce; a igualdad, los más recientes. */
export function pickShowcase(list, max = 8) {
  return [...list]
    .filter((l) => l.got)
    .sort((a, b) => RANK[a.tier] - RANK[b.tier] || String(b.got).localeCompare(String(a.got)))
    .slice(0, max);
}
