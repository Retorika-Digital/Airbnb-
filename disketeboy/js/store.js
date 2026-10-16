// La colección de DisketeBoy, guardada en el navegador (localStorage).
// Todo lo que entra se valida y se limpia: datos corruptos, manipulados o de
// una versión vieja nunca rompen la consola ni la habitación.
import { PLATFORM_IDS } from './platforms.js';
import { uid, clamp, titleKey } from './util.js';

const KEY = 'dkb:v1';

export const STATUSES = ['pendiente', 'jugando', 'jugado', 'terminado', 'abandonado'];
export const STATUS_LABEL = {
  pendiente: 'Pendiente',
  jugando: 'Jugando',
  jugado: 'Jugado',
  terminado: 'Terminado',
  abandonado: 'Abandonado',
};
export const PALETTES = ['verde', 'ambar', 'hielo', 'gris'];
export const SORTS = ['plataforma', 'nota', 'color', 'az', 'horas'];
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
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
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
  return {
    id: typeof raw.id === 'string' && /^[\w-]{1,40}$/.test(raw.id) ? raw.id : uid(),
    title,
    platform: PLATFORM_IDS.includes(raw.platform) ? raw.platform : 'otra',
    status: STATUSES.includes(raw.status) ? raw.status : 'pendiente',
    score: Number.isFinite(score) ? clamp(Math.round(score), 0, 10) : null,
    hours: Number.isFinite(hours) ? clamp(Math.round(hours * 10) / 10, 0, 99999) : 0,
    review: cleanText(raw.review, LIMITS.review),
    steamAppId: Number.isInteger(appid) && appid > 0 && appid < 1e8 ? appid : null,
    cover: cleanUrl(raw.cover),
    color: /^#[0-9a-f]{6}$/i.test(raw.color || '') ? raw.color.toLowerCase() : null,
    addedAt: validDate(raw.addedAt) || now,
    updatedAt: validDate(raw.updatedAt) || now,
  };
}

function cleanSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    palette: PALETTES.includes(s.palette) ? s.palette : 'verde',
    sound: s.sound !== false,
    sort: SORTS.includes(s.sort) ? s.sort : 'plataforma',
    tidy: s.tidy === true,
    name: cleanText(s.name, 30).replace(/\s+/g, ' '),
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

/** Entra de visita en la habitación de otra persona (solo en memoria). */
export function startVisit(games, name = '') {
  const settings = get().settings;
  visit = { name: cleanText(name, 30) };
  state = normalize({ games, settings: { ...settings, tidy: false } });
  save({ type: 'reset' });
}

export const visiting = () => visit;

export const getGames = () => get().games;
export const getGame = (id) => get().games.find((g) => g.id === id) || null;
export const getSettings = () => get().settings;

export function addGame(input) {
  const s = get();
  if (s.games.length >= LIMITS.games) throw new Error(`La colección está llena (máximo ${LIMITS.games} juegos)`);
  const now = new Date().toISOString();
  const game = cleanGame({ ...input, id: uid(), addedAt: now, updatedAt: now });
  if (!game) throw new Error('El juego necesita un título');
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
  const keys = new Set();
  for (const g of s.games) {
    if (g.steamAppId) keys.add(`steam:${g.steamAppId}`);
    keys.add(`t:${g.platform}:${titleKey(g.title)}`);
  }
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
    const k1 = g.steamAppId ? `steam:${g.steamAppId}` : null;
    const k2 = `t:${g.platform}:${titleKey(g.title)}`;
    if ((k1 && keys.has(k1)) || keys.has(k2)) {
      skipped++;
      continue;
    }
    if (k1) keys.add(k1);
    keys.add(k2);
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
    throw new Error('El archivo no es una copia de DisketeBoy');
  }
  if (!raw || raw.app !== 'DisketeBoy' || !Array.isArray(raw.games)) throw new Error('El archivo no es una copia de DisketeBoy');
  state = normalize(raw);
  save({ type: 'reset' });
  return state.games.length;
}

export function clearAll() {
  const s = get();
  s.games = [];
  save({ type: 'reset' });
}

export function stats(games = getGames()) {
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
