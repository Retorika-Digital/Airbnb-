// La colección de DisketeBoy, guardada en el navegador (localStorage).
// Todo lo que entra se valida y se limpia: datos corruptos, manipulados o de
// una versión vieja nunca rompen la consola ni la habitación.
import { PLATFORM_IDS, BOARD_IDS } from './platforms.js';
import { uid, clamp, titleKey } from './util.js';
import { TCG_IDS, DECK_STATUSES, DECK_STATUS_LABEL, BINDER_STATUSES, BINDER_STATUS_LABEL } from './cards.js';
import { t, mark, LANGS } from './i18n.js';

const KEY = 'dkb:v1';

// Todo vive en la misma colección; cada cosa tiene su kind:
// 'video' (videojuego), 'mesa' (juego de mesa), 'mazo' y 'carpeta' (cartas).
export const STATUSES = ['pendiente', 'jugando', 'jugado', 'terminado', 'abandonado'];
export const BOARD_STATUSES = ['pendiente', 'jugado', 'favorito'];
// El orden importa: lo usan los enlaces de visita. Lo nuevo, siempre al final.
export const ALL_STATUSES = [...STATUSES, 'favorito', ...DECK_STATUSES, ...BINDER_STATUSES];
const KINDS = ['video', 'mesa', 'mazo', 'carpeta'];
const STATUS_BY_KIND = { video: STATUSES, mesa: BOARD_STATUSES, mazo: DECK_STATUSES, carpeta: BINDER_STATUSES };
const DEFAULT_STATUS = { video: 'pendiente', mesa: 'jugado', mazo: 'montado', carpeta: 'progreso' };
export const STATUS_LABEL = {
  pendiente: mark('Pendiente'),
  jugando: mark('Jugando'),
  jugado: mark('Jugado'),
  terminado: mark('Terminado'),
  abandonado: mark('Abandonado'),
  favorito: mark('Favorito'),
};
export const BOARD_STATUS_LABEL = { pendiente: mark('Sin estrenar'), jugado: mark('Jugado'), favorito: mark('Favorito') };
export const isBoard = (g) => g?.kind === 'mesa';
export const isCard = (g) => g?.kind === 'mazo' || g?.kind === 'carpeta';
const LABELS = { video: STATUS_LABEL, mesa: BOARD_STATUS_LABEL, mazo: DECK_STATUS_LABEL, carpeta: BINDER_STATUS_LABEL };
/** El estado de un juego, ya traducido. */
export const statusLabel = (g) => t((LABELS[g.kind] || STATUS_LABEL)[g.status]);
export const PALETTES = ['verde', 'ambar', 'hielo', 'gris'];
export const SORTS = ['plataforma', 'nota', 'color', 'az', 'horas'];
export const THEMES = ['crema', 'gamer', 'retro'];
export const WEATHERS = ['auto', 'lluvia', 'despejado'];
export const LIMITS = { title: 120, review: 2000, games: 2000 };

let state = null;
let visit = null; // { name } mientras se visita la habitación de otra persona
const listeners = new Set();

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value, max) {
  return String(value ?? '').replace(CONTROL, '').trim().slice(0, max);
}

function cleanUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' ? url.href.slice(0, 500) : null;
  } catch {
    return null;
  }
}

function validDate(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Deja un juego en un estado válido, o devuelve null si no se puede salvar. */
export function cleanGame(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = cleanText(raw.title, LIMITS.title).replace(/\s+/g, ' ');
  if (!title) return null;
  const hasScore = raw.score !== null && raw.score !== undefined && raw.score !== '';
  const score = hasScore ? Number(raw.score) : NaN;
  const hours = Number(raw.hours);
  const appid = Number(raw.steamAppId);
  const now = new Date().toISOString();
  const kind = KINDS.includes(raw.kind) ? raw.kind : 'video';
  const board = kind === 'mesa';
  const int = (v, min, max, def) => (v !== '' && v !== null && Number.isFinite(Number(v)) ? clamp(Math.round(Number(v)), min, max) : def);
  const platformFor = {
    video: () => (PLATFORM_IDS.includes(raw.platform) ? raw.platform : 'otra'),
    mesa: () => (BOARD_IDS.includes(raw.platform) ? raw.platform : 'mesa-l'),
    mazo: () => 'deckbox',
    carpeta: () => 'binder',
  };
  const game = {
    id: typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : uid(),
    kind,
    title,
    platform: platformFor[kind](),
    status: STATUS_BY_KIND[kind].includes(raw.status) ? raw.status : DEFAULT_STATUS[kind],
    score: Number.isFinite(score) ? clamp(Math.round(score), 0, 10) : null,
    hours: Number.isFinite(hours) ? clamp(Math.round(hours * 10) / 10, 0, 99999) : 0,
    review: cleanText(raw.review, LIMITS.review),
    steamAppId: kind === 'video' && Number.isInteger(appid) && appid > 0 && appid < 1e8 ? appid : null,
    cover: cleanUrl(raw.cover),
    color: /^#[0-9a-f]{6}$/i.test(raw.color || '') ? raw.color.toLowerCase() : null,
    addedAt: validDate(raw.addedAt) || now,
    updatedAt: validDate(raw.updatedAt) || now,
  };
  if (kind === 'mazo' || kind === 'carpeta') game.tcg = TCG_IDS.includes(raw.tcg) ? raw.tcg : 'otro';
  if (kind === 'mazo') {
    game.format = cleanText(raw.format, 40).replace(/\s+/g, ' ');
    game.list = cleanText(raw.list, 6000);
    game.wins = int(raw.wins, 0, 99999, 0);
    game.losses = int(raw.losses, 0, 99999, 0);
    game.lastPlayed = validDate(raw.lastPlayed);
  }
  if (kind === 'carpeta') {
    game.cards = int(raw.cards, 0, 1000000, 0);
    const value = Number(raw.value);
    game.value = raw.value !== '' && Number.isFinite(value) ? clamp(Math.round(value * 100) / 100, 0, 1e7) : 0;
  }
  if (board) {
    game.minPlayers = int(raw.minPlayers, 1, 20, 2);
    game.maxPlayers = Math.max(game.minPlayers, int(raw.maxPlayers, 1, 99, Math.max(game.minPlayers, 4)));
    game.minutes = int(raw.minutes, 5, 1000, 45);
    game.plays = int(raw.plays, 0, 99999, 0);
    game.lentTo = cleanText(raw.lentTo, 40).replace(/\s+/g, ' ');
    game.lentAt = game.lentTo ? validDate(raw.lentAt) || now : null;
    game.lastPlayed = validDate(raw.lastPlayed);
    const bggId = Number(raw.bggId);
    game.bggId = Number.isInteger(bggId) && bggId > 0 && bggId < 1e8 ? bggId : null;
  }
  return game;
}

function cleanSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    palette: PALETTES.includes(s.palette) ? s.palette : 'verde',
    sound: s.sound !== false,
    sort: SORTS.includes(s.sort) ? s.sort : 'plataforma',
    tidy: s.tidy === true,
    name: cleanText(s.name, 30).replace(/\s+/g, ' '),
    theme: THEMES.includes(s.theme) ? s.theme : 'crema',
    pet: s.pet !== false,
    lang: LANGS.includes(s.lang) ? s.lang : '',
    ambient: s.ambient !== false,
    weather: WEATHERS.includes(s.weather) ? s.weather : 'auto',
  };
}

function normalize(raw) {
  const list = Array.isArray(raw?.games) ? raw.games : [];
  const seen = new Set();
  const games = [];
  for (const item of list) {
    const g = cleanGame(item);
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    games.push(g);
    if (games.length >= LIMITS.games) break;
  }
  return { version: 1, games, settings: cleanSettings(raw?.settings) };
}

function read() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return normalize(null);
  }
}

const get = () => (state ??= read());

function save(change) {
  try {
    // De visita no se guarda nada: tu colección sigue intacta.
    if (!visit) localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Modo privado o almacenamiento lleno: seguimos en memoria sin romper nada.
  }
  for (const fn of listeners) {
    try {
      fn(change, state);
    } catch (err) {
      console.error(err);
    }
  }
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Solo para tests: olvida el estado en memoria y vuelve a leer. */
export function _reload() {
  state = null;
  visit = null;
}

/** Entra de visita en la habitación de otra persona (solo en memoria), con su tema y su gato. */
export function startVisit(games, name = '', look = {}) {
  const settings = get().settings;
  visit = { name: cleanText(name, 30) };
  state = normalize({ games, settings: { ...settings, ...look, tidy: false } });
  save({ type: 'reset' });
}

export const visiting = () => visit;

export const getGames = () => get().games;
export const getVideoGames = () => get().games.filter((g) => g.kind === 'video');
export const getBoards = () => get().games.filter(isBoard);
export const getCards = () => get().games.filter(isCard);
export const getGame = (id) => get().games.find((g) => g.id === id) || null;
export const getSettings = () => get().settings;

export function addGame(input) {
  const s = get();
  if (s.games.length >= LIMITS.games) throw new Error(t('La colección está llena (máximo {n} juegos)', { n: LIMITS.games }));
  const now = new Date().toISOString();
  const game = cleanGame({ ...input, id: uid(), addedAt: now, updatedAt: now });
  if (!game) throw new Error(t('El juego necesita un título'));
  s.games.push(game);
  save({ type: 'add', ids: [game.id] });
  return game;
}

export function updateGame(id, patch) {
  const s = get();
  const i = s.games.findIndex((g) => g.id === id);
  if (i < 0) return null;
  const prev = s.games[i];
  const next = cleanGame({ ...prev, ...patch, id: prev.id, addedAt: prev.addedAt, updatedAt: new Date().toISOString() });
  if (!next) return prev;
  s.games[i] = next;
  save({ type: 'update', ids: [id], prev });
  return next;
}

export function removeGame(id) {
  const s = get();
  const i = s.games.findIndex((g) => g.id === id);
  if (i < 0) return false;
  s.games.splice(i, 1);
  save({ type: 'remove', ids: [id] });
  return true;
}

/**
 * Añade muchos juegos de golpe (Steam, demo…), sin duplicar: se reconoce un
 * juego repetido por su id de Steam o por título + plataforma.
 */
export function importGames(list) {
  const s = get();
  // Un juego ya está si coincide su id de Steam o de BGG, o su título (en juegos de mesa,
  // aunque la caja sea de otro tamaño; en el resto, en la misma plataforma)
  const idOf = (g) => (g.steamAppId ? `steam:${g.steamAppId}` : g.bggId ? `bgg:${g.bggId}` : null);
  const titleOf = (g) => {
    const k = titleKey(g.title);
    return k ? `t:${g.kind === 'mesa' ? 'mesa' : g.platform}:${k}` : null;
  };
  const knownIds = new Set();
  const titles = new Set(); // de todos
  const idlessTitles = new Set(); // solo de los que no tienen id
  const remember = (g) => {
    const id = idOf(g);
    const title = titleOf(g);
    if (id) knownIds.add(id);
    if (title) titles.add(title);
    if (title && !id) idlessTitles.add(title);
  };
  s.games.forEach(remember);
  // Con id: repetido si ya está ese id, o si hay uno igual apuntado a mano (sin id).
  // Sin id: repetido si ya hay uno con el mismo título.
  const isDuplicate = (g) => {
    const id = idOf(g);
    const title = titleOf(g);
    return id ? knownIds.has(id) || (!!title && idlessTitles.has(title)) : !!title && titles.has(title);
  };
  const ids = [];
  let skipped = 0;
  const base = Date.now();
  for (const [i, item] of (Array.isArray(list) ? list : []).entries()) {
    if (s.games.length >= LIMITS.games) {
      skipped++;
      continue;
    }
    const stamp = new Date(base + i).toISOString();
    const g = cleanGame({ ...item, id: uid() + i.toString(36), addedAt: item?.addedAt || stamp, updatedAt: stamp });
    if (!g) {
      skipped++;
      continue;
    }
    if (isDuplicate(g)) {
      skipped++;
      continue;
    }
    remember(g);
    s.games.push(g);
    ids.push(g.id);
  }
  if (ids.length) save({ type: 'import', ids });
  return { added: ids.length, skipped };
}

/** Guarda de una vez los colores sacados de las portadas (para los lomos y ordenar por color). */
export function setColors(map) {
  const s = get();
  const ids = [];
  for (const g of s.games) {
    const c = map?.[g.id];
    if (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) && g.color !== c.toLowerCase()) {
      g.color = c.toLowerCase();
      ids.push(g.id);
    }
  }
  if (ids.length) save({ type: 'colors', ids });
  return ids.length;
}

export function setSettings(patch) {
  const s = get();
  s.settings = cleanSettings({ ...s.settings, ...patch });
  save({ type: 'settings' });
  return s.settings;
}

export function exportBackup() {
  const s = get();
  return JSON.stringify({ app: 'DisketeBoy', version: 1, exportedAt: new Date().toISOString(), games: s.games, settings: s.settings }, null, 2);
}

/** Restaura una copia de seguridad. Lanza un error si el archivo no es válido. */
export function importBackup(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error(t('El archivo no es una copia de DisketeBoy'));
  }
  if (!raw || raw.app !== 'DisketeBoy' || !Array.isArray(raw.games)) throw new Error(t('El archivo no es una copia de DisketeBoy'));
  state = normalize(raw);
  save({ type: 'reset' });
  return state.games.length;
}

export function clearAll() {
  const s = get();
  s.games = [];
  save({ type: 'reset' });
}

/** Una partida más: si estaba sin estrenar, queda estrenado. */
export function logPlay(id) {
  const g = getGame(id);
  if (!isBoard(g)) return null;
  return updateGame(id, { plays: g.plays + 1, lastPlayed: new Date().toISOString(), status: g.status === 'pendiente' ? 'jugado' : g.status });
}

/** Apunta el resultado de una partida con un mazo. */
export function logResult(id, won) {
  const g = getGame(id);
  if (g?.kind !== 'mazo') return null;
  return updateGame(id, won ? { wins: g.wins + 1, lastPlayed: new Date().toISOString() } : { losses: g.losses + 1, lastPlayed: new Date().toISOString() });
}

/** Estadísticas de los videojuegos (los juegos de mesa y las cartas tienen las suyas). */
export function stats(games = getVideoGames()) {
  const by = Object.fromEntries(STATUSES.map((st) => [st, 0]));
  let hours = 0;
  let scored = 0;
  let sum = 0;
  for (const g of games) {
    by[g.status]++;
    hours += g.hours;
    if (g.score !== null) {
      scored++;
      sum += g.score;
    }
  }
  return {
    total: games.length,
    by,
    hours: Math.round(hours),
    avgScore: scored ? Math.round((sum / scored) * 10) / 10 : null,
    platforms: new Set(games.map((g) => g.platform)).size,
    top: games.filter((g) => g.score !== null).sort((a, b) => b.score - a.score || b.hours - a.hours).slice(0, 3),
    mostPlayed: [...games].filter((g) => g.hours > 0).sort((a, b) => b.hours - a.hours).slice(0, 3),
  };
}

/** Cuándo acabarías la pila de la vergüenza a un ritmo de N juegos al mes. */
export function pileForecast(pending, perMonth = 1, now = new Date()) {
  const months = Math.ceil(Math.max(0, pending) / Math.max(0.1, perMonth));
  const d = new Date(now.getFullYear(), now.getMonth() + months, 1);
  return { months, year: d.getFullYear(), month: d.getMonth() };
}
