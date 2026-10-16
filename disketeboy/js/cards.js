// Cartas: juegos de cartas coleccionables, mazos y carpetas (funciones puras).
// Los nombres de los juegos solo se usan para identificarlos: sin logos ni arte.

export const TCGS = [
  { id: 'mtg', name: 'Magic: The Gathering', short: 'MTG', color: '#4a3a7a' },
  { id: 'pokemon', name: 'Pokémon', short: 'PKM', color: '#c9932a' },
  { id: 'yugioh', name: 'Yu-Gi-Oh!', short: 'YGO', color: '#8a5a2b' },
  { id: 'onepiece', name: 'One Piece', short: 'OP', color: '#b3261e' },
  { id: 'lorcana', name: 'Lorcana', short: 'LOR', color: '#2b4a8a' },
  { id: 'fab', name: 'Flesh and Blood', short: 'FAB', color: '#7a1f2a' },
  { id: 'swu', name: 'Star Wars Unlimited', short: 'SWU', color: '#1f3a5a' },
  { id: 'riftbound', name: 'Riftbound', short: 'RFT', color: '#1f6a6a' },
  { id: 'digimon', name: 'Digimon', short: 'DGM', color: '#2a6aa8' },
  { id: 'otro', name: 'Otro', short: 'TCG', color: '#4a4a52' },
];
export const TCG_IDS = TCGS.map((t) => t.id);
export const tcg = (id) => TCGS.find((t) => t.id === id) || TCGS.at(-1);

export const DECK_STATUSES = ['montado', 'construccion', 'desmontado'];
export const DECK_STATUS_LABEL = { montado: 'Montado', construccion: 'En construcción', desmontado: 'Desmontado' };
export const BINDER_STATUSES = ['progreso', 'completa', 'buscando'];
export const BINDER_STATUS_LABEL = { progreso: 'En progreso', completa: 'Completa', buscando: 'Buscando cartas' };

/**
 * Cuenta las cartas de una lista de mazo: «4 Lightning Bolt», «4x Rayo» o «Sol Ring».
 * Ignora líneas vacías, comentarios (// o #) y cabeceras como «Sideboard:».
 */
export function deckCount(list) {
  let n = 0;
  for (const raw of String(list || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('//') || line.startsWith('#') || /^[\p{L} ]+:$/u.test(line)) continue;
    const m = line.match(/^(\d{1,3})\s*x?\s+\S/i);
    n += m ? Number(m[1]) : 1;
  }
  return n;
}

/** Porcentaje de victorias (null si aún no se ha jugado). */
export function winRate(g) {
  const total = (g.wins || 0) + (g.losses || 0);
  return total ? Math.round(((g.wins || 0) / total) * 100) : null;
}

export const recordText = (g) => {
  const wr = winRate(g);
  return wr === null ? 'Sin partidas' : `${g.wins}V · ${g.losses}D (${wr}%)`;
};

export const euros = (n) => `${Number(n || 0).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;

export function cardsStats(items) {
  const decks = items.filter((g) => g.kind === 'mazo');
  const binders = items.filter((g) => g.kind === 'carpeta');
  const wins = decks.reduce((s, d) => s + d.wins, 0);
  const losses = decks.reduce((s, d) => s + d.losses, 0);
  const best = decks.filter((d) => d.wins + d.losses >= 3).sort((a, b) => winRate(b) - winRate(a) || b.wins - a.wins)[0] || null;
  return {
    decks: decks.length,
    binders: binders.length,
    cards: binders.reduce((s, b) => s + b.cards, 0),
    value: Math.round(binders.reduce((s, b) => s + b.value, 0) * 100) / 100,
    wins,
    losses,
    winRate: wins + losses ? Math.round((wins / (wins + losses)) * 100) : null,
    best,
  };
}
