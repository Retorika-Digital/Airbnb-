// Cartas: juegos de cartas coleccionables, mazos y carpetas (funciones puras).
// Los nombres de los juegos solo se usan para identificarlos: sin logos ni arte.
import { t, mark, locale, getLang } from './i18n.js';

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
  { id: 'otro', name: mark('Otro'), short: 'TCG', color: '#4a4a52' },
];
export const TCG_IDS = TCGS.map((x) => x.id);
export const tcg = (id) => TCGS.find((x) => x.id === id) || TCGS.at(-1);

export const DECK_STATUSES = ['montado', 'construccion', 'desmontado'];
export const DECK_STATUS_LABEL = { montado: mark('Montado'), construccion: mark('En construcción'), desmontado: mark('Desmontado') };
export const BINDER_STATUSES = ['progreso', 'completa', 'buscando'];
export const BINDER_STATUS_LABEL = { progreso: mark('En progreso'), completa: mark('Completa'), buscando: mark('Buscando cartas') };

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
  return wr === null ? t('Sin partidas') : t('{w}V · {l}D ({pct}%)', { w: g.wins, l: g.losses, pct: wr });
};

export const euros = (n) => {
  const v = Number(n || 0).toLocaleString(locale(), { maximumFractionDigits: 2 });
  return getLang() === 'en' ? `€${v}` : `${v} €`;
};

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

/** Un precio escrito de cualquier manera: «1,50», «1.234,56», «$1,234.56» o «0.25 €». */
export function parseAmount(raw) {
  let s = String(raw ?? '').replace(/[^\d.,-]/g, '');
  if (!s) return null;
  const comma = s.lastIndexOf(',');
  const dot = s.lastIndexOf('.');
  if (comma > -1 && dot > -1) s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (comma > -1) s = /,\d{1,2}$/.test(s) && s.indexOf(',') === comma ? s.replace(',', '.') : s.replace(/,/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Separa una línea de CSV respetando las comillas. */
function csvRow(line, sep) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) out.push(cur), (cur = '');
    else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim());
}

const QTY = ['quantity', 'qty', 'count', 'amount', 'cantidad', 'copies'];
const PRICE = ['purchase price', 'price', 'market price', 'value', 'precio', 'price (eur)', 'price (usd)', 'tcg market price'];

/**
 * Lee el CSV que exportan ManaBox, Dragon Shield, Delver Lens y compañía:
 * suma las cartas (columna de cantidad) y su valor (cantidad × precio, si hay precio).
 */
export function parseCardCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: 0, cards: 0, value: 0, hasPrice: false };
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const head = csvRow(lines[0], sep).map((h) => h.toLowerCase());
  const qi = head.findIndex((h) => QTY.includes(h));
  const pi = head.findIndex((h) => PRICE.includes(h));
  let cards = 0;
  let value = 0;
  let rows = 0;
  for (const line of lines.slice(1)) {
    const cells = csvRow(line, sep);
    if (cells.every((c) => !c)) continue;
    const qty = qi > -1 ? Math.max(0, Math.round(parseAmount(cells[qi]) ?? 1)) : 1;
    const price = pi > -1 ? parseAmount(cells[pi]) : null;
    cards += qty;
    if (price !== null && price > 0) value += qty * price;
    rows++;
  }
  return { rows, cards, value: Math.round(value * 100) / 100, hasPrice: pi > -1 };
}
