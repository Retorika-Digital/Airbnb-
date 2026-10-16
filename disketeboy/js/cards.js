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

/** Lee un CSV entero respetando las comillas (dentro puede haber comas y saltos de línea). */
function csvRecords(text, sep) {
  const rows = [];
  let row = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cur += '"'), i++;
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) row.push(cur.trim()), (cur = '');
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur.trim());
      rows.push(row);
      row = [];
      cur = '';
    } else cur += ch;
  }
  if (cur || row.length) rows.push([...row, cur.trim()]);
  return rows.filter((r) => r.some((c) => c));
}

const QTY = ['quantity', 'qty', 'count', 'amount', 'cantidad', 'copies'];
const PRICE = ['purchase price', 'price', 'market price', 'value', 'precio', 'price (eur)', 'price (usd)', 'tcg market price'];

/**
 * Lee el CSV que exportan ManaBox, Dragon Shield, Delver Lens y compañía:
 * suma las cartas (columna de cantidad) y su valor (cantidad × precio, si hay precio).
 */
export function parseCardCsv(text) {
  let body = String(text || '').replace(/^\uFEFF/, '');
  // Algunas apps (Dragon Shield) empiezan con «sep=,» para Excel: manda ese separador
  const hint = body.match(/^"?sep=(.)"?\r?\n/i);
  if (hint) body = body.slice(hint[0].length);
  const firstLine = body.split(/\r?\n/, 1)[0] || '';
  const sep = hint ? hint[1] : (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const records = csvRecords(body, sep);
  if (records.length < 2) return { rows: 0, cards: 0, value: 0, hasPrice: false };
  const head = records[0].map((x) => x.toLowerCase());
  const qi = head.findIndex((x) => QTY.includes(x));
  const pi = head.findIndex((x) => PRICE.includes(x));
  let cards = 0;
  let value = 0;
  let priced = 0;
  for (const cells of records.slice(1)) {
    const qty = qi > -1 ? Math.max(0, Math.round(parseAmount(cells[qi]) ?? 1)) : 1;
    const price = pi > -1 ? parseAmount(cells[pi]) : null;
    cards += qty;
    if (price !== null && price > 0) {
      value += qty * price;
      priced++;
    }
  }
  // Sin ningún precio rellenado no tocamos el valor que ya tenía la carpeta
  return { rows: records.length - 1, cards, value: Math.round(value * 100) / 100, hasPrice: priced > 0 };
}
