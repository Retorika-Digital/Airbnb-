import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const store = await import('../../js/store.js');
const { deckCount, winRate, recordText, cardsStats, tcg } = await import('../../js/cards.js');
const { computeLayout, DESK } = await import('../../js/layout.js');
const { encodeRoom, decodeRoom } = await import('../../js/share.js');
beforeEach(() => {
  mem.clear();
  store._reload();
});

test('contar las cartas de una lista de mazo', () => {
  assert.equal(deckCount('4 Lightning Bolt\n4x Rift Bolt\n1 Sol Ring\nCommand Tower\n\n// comentario\n# otro\nSideboard:\n2 Pyroblast'), 12);
  assert.equal(deckCount(''), 0);
  assert.equal(deckCount('20 Mountain'), 20);
});

test('victorias, derrotas y porcentaje', () => {
  assert.equal(winRate({ wins: 0, losses: 0 }), null);
  assert.equal(winRate({ wins: 23, losses: 11 }), 68);
  assert.equal(recordText({ wins: 23, losses: 11 }), '23V · 11D (68%)');
  assert.equal(recordText({ wins: 0, losses: 0 }), 'Sin partidas');
});

test('mazos y carpetas se validan con sus campos', () => {
  const d = store.addGame({ kind: 'mazo', title: 'Burn', tcg: 'inventado', platform: 'pc', status: 'pendiente', format: '  Modern  ', wins: '3', losses: -2, list: '4 Lightning Bolt' });
  assert.deepEqual([d.kind, d.platform, d.tcg, d.status, d.format, d.wins, d.losses], ['mazo', 'deckbox', 'otro', 'montado', 'Modern', 3, 0]);
  const c = store.addGame({ kind: 'carpeta', title: 'Brillis', tcg: 'pokemon', cards: '165', value: '120.456', status: 'completa' });
  assert.deepEqual([c.kind, c.platform, c.tcg, c.cards, c.value, c.status], ['carpeta', 'binder', 'pokemon', 165, 120.46, 'completa']);
  assert.equal(store.getVideoGames().length, 0, 'las cartas no cuentan como videojuegos');
  assert.equal(store.getCards().length, 2);
});

test('apuntar partidas con un mazo', () => {
  const d = store.addGame({ kind: 'mazo', title: 'Burn' });
  store.logResult(d.id, true);
  store.logResult(d.id, true);
  const after = store.logResult(d.id, false);
  assert.deepEqual([after.wins, after.losses], [2, 1]);
  assert.ok(after.lastPlayed);
  assert.equal(store.logResult(store.addGame({ title: 'Hades' }).id, true), null, 'solo los mazos');
});

test('estadísticas de cartas: récord total, valor y mejor mazo (mínimo 3 partidas)', () => {
  const cs = cardsStats([
    store.cleanGame({ kind: 'mazo', title: 'A', wins: 2, losses: 0 }),
    store.cleanGame({ kind: 'mazo', title: 'B', wins: 6, losses: 4 }),
    store.cleanGame({ kind: 'carpeta', title: 'C', cards: 100, value: 10.5 }),
    store.cleanGame({ kind: 'carpeta', title: 'D', cards: 50, value: 4.25 }),
  ]);
  assert.deepEqual([cs.decks, cs.binders, cs.cards, cs.value, cs.wins, cs.losses, cs.winRate, cs.best.title], [2, 2, 150, 14.75, 8, 4, 67, 'B']);
  assert.equal(tcg('nope').id, 'otro');
});

test('los mazos van delante de la tele y las carpetas a los cubos de abajo de la Kallax', () => {
  const items = [
    ...Array.from({ length: 9 }, (_, i) => store.cleanGame({ kind: 'mazo', title: `Mazo ${i}` })),
    store.cleanGame({ kind: 'carpeta', title: 'Carpeta' }),
    store.cleanGame({ kind: 'mesa', title: 'Catan' }),
  ];
  const { placements, counts } = computeLayout(items);
  assert.equal(counts.mazos, 9);
  const decks = items.slice(0, 9).map((g) => placements.get(g.id));
  assert.ok(decks.every((p) => p.zone === 'mazos' && p.y > DESK.top), 'encima de la mesa');
  const low = Math.min(...decks.map((p) => p.y));
  assert.equal(decks.filter((p) => p.y > low + 0.01).length, 2, '7 en la primera fila y los otros 2 apilados encima');
  const binder = placements.get(items[9].id);
  const board = placements.get(items[10].id);
  assert.equal(binder.zone, 'kallax');
  assert.ok(binder.y < board.y, 'la carpeta abajo y el juego de mesa arriba');
});

test('el enlace de visita lleva mazos y carpetas (sin las listas)', async () => {
  const room = await decodeRoom(
    await encodeRoom([
      store.cleanGame({ kind: 'mazo', title: 'Burn', tcg: 'mtg', format: 'Modern', wins: 4, losses: 2, list: '4 Lightning Bolt' }),
      store.cleanGame({ kind: 'carpeta', title: 'Brillis', tcg: 'pokemon', cards: 165, value: 120, status: 'completa' }),
    ]),
  );
  const [d, c] = room.games;
  assert.deepEqual([d.kind, d.tcg, d.format, d.wins, d.losses, d.list], ['mazo', 'mtg', 'Modern', 4, 2, '']);
  assert.deepEqual([c.kind, c.tcg, c.cards, c.value, c.status], ['carpeta', 'pokemon', 165, 120, 'completa']);
});

test('precios escritos de cualquier manera', async () => {
  const { parseAmount } = await import('../../js/cards.js');
  assert.deepEqual(['1,50', '1.234,56', '$1,234.56', '0.25 €', '12', '1,234', 'N/A', ''].map(parseAmount), [1.5, 1234.56, 1234.56, 0.25, 12, 1234, null, null]);
});

test('el CSV de ManaBox (o de cualquier app) llena la carpeta: cartas y valor', async () => {
  const { parseCardCsv } = await import('../../js/cards.js');
  const manabox = [
    'Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Misprint,Altered,Condition,Language,Purchase price currency',
    '"Lightning Bolt",M10,Magic 2010,146,normal,common,4,1,abc,1.50,false,false,near_mint,en,EUR',
    '"Atraxa, Praetors\' Voice",C16,Commander 2016,28,foil,mythic,1,2,def,25.00,false,false,near_mint,en,EUR',
    '',
  ].join('\r\n');
  assert.deepEqual(parseCardCsv(manabox), { rows: 2, cards: 5, value: 31, hasPrice: true }, 'la coma dentro de comillas no corta la fila');
  assert.deepEqual(parseCardCsv('﻿Nombre;Cantidad;Precio\nRayo;4;1,50\nAnillo solar;1;2,25\n'), { rows: 2, cards: 5, value: 8.25, hasPrice: true }, 'Excel en español: punto y coma y coma decimal');
  assert.deepEqual(parseCardCsv('Card\nSol Ring\nForest\n'), { rows: 2, cards: 2, value: 0, hasPrice: false }, 'sin cantidad: una por fila');
  assert.equal(parseCardCsv('solo cabecera').rows, 0);
});

test('CSV de verdad: saltos de línea entre comillas, «sep=» y sin precios', async () => {
  const { parseCardCsv } = await import('../../js/cards.js');
  const notes = 'Name,Quantity,Price,Notes\n"Bolt",4,1.50,"comprada en\nla tienda"\nSol Ring,1,2.25,\n';
  assert.deepEqual(parseCardCsv(notes), { rows: 2, cards: 5, value: 8.25, hasPrice: true }, 'una nota con salto de línea no parte la fila');
  const dragon = 'sep=,\nQuantity,Card Name,Price\n4,Bolt,1.00\n10,Forest,0.10\n';
  assert.deepEqual(parseCardCsv(dragon), { rows: 2, cards: 14, value: 5, hasPrice: true }, 'la línea «sep=» de Dragon Shield');
  const noPrices = 'Name,Quantity,Purchase price\nBolt,4,\nSol Ring,1,0\n';
  assert.equal(parseCardCsv(noPrices).hasPrice, false, 'columna de precio vacía: no se toca el valor de la carpeta');
});
