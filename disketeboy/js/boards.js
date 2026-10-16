// Juegos de mesa: «¿Qué jugamos esta noche?», textos y préstamos (funciones puras).

export const TIME_OPTIONS = [15, 30, 45, 60, 90, 120, 180, 0]; // 0 = sin prisa

export function playersText(g) {
  if (g.minPlayers === g.maxPlayers) return `${g.minPlayers} jugador${g.minPlayers === 1 ? '' : 'es'}`;
  return `${g.minPlayers}–${g.maxPlayers} jugadores`;
}

export const minutesText = (m) => (m >= 60 && m % 60 === 0 ? `${m / 60} h` : m > 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);

export function daysSince(iso, now = new Date()) {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}

export const lentText = (g, now = new Date()) => {
  if (!g.lentTo) return '';
  const d = daysSince(g.lentAt, now);
  return `Lo tiene ${g.lentTo} ${d === 0 ? 'desde hoy' : d === 1 ? 'desde ayer' : `desde hace ${d} días`}`;
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
