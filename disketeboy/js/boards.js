// Juegos de mesa: «¿Qué jugamos esta noche?», textos y préstamos (funciones puras).
import { t, tp } from './i18n.js';

export const TIME_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 0]; // 0 = sin prisa

export function playersText(g) {
  if (g.minPlayers === g.maxPlayers) return tp(g.minPlayers, '1 jugador', '{n} jugadores');
  return t('{min}–{max} jugadores', { min: g.minPlayers, max: g.maxPlayers });
}

export const minutesText = (m) => (m >= 60 && m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

export function daysSince(iso, now = new Date()) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((now.getTime() - ms) / 86400000));
}

export const lentText = (g, now = new Date()) => {
  if (!g.lentTo) return '';
  const d = daysSince(g.lentAt, now);
  if (d === 0) return t('Lo tiene {name} desde hoy', { name: g.lentTo });
  return d === 1 ? t('Lo tiene {name} desde ayer', { name: g.lentTo }) : t('Lo tiene {name} desde hace {n} días', { name: g.lentTo, n: d });
};

/**
 * Los juegos que encajan con la noche: caben los jugadores, da tiempo y está en casa.
 * Primero los favoritos, luego los sin estrenar (¡ya toca!), y después por nota.
 */
export function whatToPlay(boards, { players = 4, minutes = 60 } = {}) {
  const rank = (g) => (g.status === 'favorito' ? 0 : g.status === 'pendiente' ? 1 : 2);
  return boards
    .filter((g) => !g.lentTo && g.minPlayers <= players && players <= g.maxPlayers && (!minutes || g.minutes <= minutes))
    .sort((a, b) => rank(a) - rank(b) || (b.score ?? -1) - (a.score ?? -1) || a.plays - b.plays || a.title.localeCompare(b.title, 'es'));
}

export function boardStats(boards) {
  return {
    total: boards.length,
    plays: boards.reduce((s, g) => s + g.plays, 0),
    unplayed: boards.filter((g) => g.status === 'pendiente').length,
    lent: boards.filter((g) => g.lentTo),
    mostPlayed: [...boards].filter((g) => g.plays > 0).sort((a, b) => b.plays - a.plays)[0] || null,
  };
}

/** Elige uno al azar (con un generador inyectable para poder probarlo). */
export const pickOne = (list, random = Math.random) => (list.length ? list[Math.floor(random() * list.length)] : null);

/** Tamaño de caja aproximado según lo que dura la partida (BGG no da medidas). */
export function boxForMinutes(minutes) {
  if (minutes && minutes <= 20) return 'mesa-s';
  if (minutes && minutes <= 45) return 'mesa-m';
  if (minutes && minutes >= 120) return 'mesa-xl';
  return 'mesa-l';
}

/**
 * Tu colección de BoardGameGeek → juegos de la Kallax.
 * Si apuntas partidas en BGG, los que no tienen ninguna van encima, sin estrenar.
 * Si no apuntas ninguna, no damos nada por «sin estrenar». Con un 9 o más, favorito.
 */
export function mapBggGames(list) {
  const games = (Array.isArray(list) ? list : []).filter((g) => g && Number.isInteger(g.id) && g.name);
  const logsPlays = games.some((g) => g.plays > 0);
  return games.map((g) => {
    const unplayed = logsPlays && !g.plays;
    const score = Number.isFinite(g.rating) && g.rating > 0 ? Math.round(g.rating) : null;
    return {
      kind: 'mesa',
      title: g.name,
      bggId: g.id,
      minPlayers: g.minPlayers || 1,
      maxPlayers: g.maxPlayers || g.minPlayers || 4,
      minutes: g.minutes || 45,
      plays: g.plays || 0,
      score,
      platform: boxForMinutes(g.minutes),
      status: unplayed ? 'pendiente' : score !== null && score >= 9 ? 'favorito' : 'jugado',
    };
  });
}
