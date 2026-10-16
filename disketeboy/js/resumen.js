// «Mi resumen»: tu colección contada en tarjetas, como esos resúmenes de fin de año
// que todo el mundo comparte. Aquí solo están los datos (funciones puras); las
// tarjetas animadas se dibujan en story.js.
import { mark } from './i18n.js';

const RETRO = new Set(['nes', 'snes', 'n64', 'gb', 'gbc', 'ps1', 'md', 'saturn', 'dc']);

// Personalidades: la primera que encaja gana (el orden importa)
export const PERSONAS = [
  { id: 'completista', icon: '🏆', title: mark('El Completista'), text: mark('Lo que empiezas, lo terminas. Tu estantería es un museo de créditos finales.'), test: (s) => s.video >= 8 && s.beaten / s.video >= 0.5 },
  { id: 'montanero', icon: '🗻', title: mark('El Montañero'), text: mark('Tu pila de la vergüenza ya tiene su propio clima. Un día de estos la escalas.'), test: (s) => s.video >= 8 && s.backlog / s.video >= 0.35 },
  { id: 'arqueologo', icon: '👾', title: mark('El Arqueólogo'), text: mark('Lo tuyo son los cartuchos y los CD con olor a recreo.'), test: (s) => s.video >= 5 && s.retro / s.video >= 0.3 },
  { id: 'anfitrion', icon: '🎲', title: mark('El Anfitrión'), text: mark('En tu casa siempre hay una mesa montada y alguien barajando.'), test: (s) => s.boards >= 6 && s.boards >= s.video },
  { id: 'duelista', icon: '🃏', title: mark('El Duelista'), text: mark('Tienes un mazo para cada ocasión y un récord que enseñar.'), test: (s) => s.decks >= 3 },
  { id: 'critico', icon: '✍️', title: mark('El Crítico'), text: mark('No hay caja sin reseña: tu colección tiene contraportada.'), test: (s) => s.total >= 6 && s.reviews / s.total >= 0.4 },
  { id: 'explorador', icon: '🧭', title: mark('El Explorador'), text: mark('Ni Sony, ni Nintendo, ni Xbox: tú juegas a todo.'), test: (s) => s.platforms >= 6 },
  { id: 'tranquilo', icon: '☕', title: mark('El Jugador Tranquilo'), text: mark('Sin prisa y sin culpa: juegas a lo que te apetece, cuando te apetece.'), test: () => true },
];

/** Todo lo que cuentan las tarjetas. */
export function buildSummary(games) {
  const list = Array.isArray(games) ? games : [];
  const video = list.filter((g) => g.kind === 'video');
  const boards = list.filter((g) => g.kind === 'mesa');
  const decks = list.filter((g) => g.kind === 'mazo');
  const binders = list.filter((g) => g.kind === 'carpeta');
  const byPlatform = new Map();
  for (const g of video) byPlatform.set(g.platform, (byPlatform.get(g.platform) || 0) + 1);
  const topPlatform = [...byPlatform.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  const scored = list.filter((g) => g.score !== null && g.score !== undefined);
  const s = {
    total: list.length,
    video: video.length,
    boards: boards.length,
    decks: decks.length,
    binders: binders.length,
    beaten: video.filter((g) => g.status === 'terminado').length,
    backlog: video.filter((g) => g.status === 'pendiente').length,
    playing: video.filter((g) => g.status === 'jugando').map((g) => g.title).slice(0, 3),
    hours: Math.round(video.reduce((n, g) => n + (g.hours || 0), 0)),
    mostHours: [...video].sort((a, b) => (b.hours || 0) - (a.hours || 0)).find((g) => g.hours > 0) || null,
    podium: [...scored].sort((a, b) => b.score - a.score || (b.hours || 0) - (a.hours || 0)).slice(0, 3),
    reviews: list.filter((g) => String(g.review || '').trim()).length,
    retro: video.filter((g) => RETRO.has(g.platform)).length,
    platforms: byPlatform.size,
    topPlatform: topPlatform ? { id: topPlatform[0], count: topPlatform[1] } : null,
    plays: boards.reduce((n, g) => n + (g.plays || 0), 0),
    mostPlayed: [...boards].sort((a, b) => (b.plays || 0) - (a.plays || 0)).find((g) => g.plays > 0) || null,
    bestDeck: [...decks].filter((d) => d.wins + d.losses > 0).sort((a, b) => b.wins - a.wins)[0] || null,
    cards: binders.reduce((n, b) => n + (b.cards || 0), 0),
  };
  s.persona = PERSONAS.find((p) => p.test(s));
  return s;
}
