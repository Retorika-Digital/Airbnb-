import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { t, tp, setLang, getLang, detectLang, locale } = await import('../../js/i18n.js');
const EN = (await import('../../js/lang/en.js')).default;
const { euros, recordText } = await import('../../js/cards.js');
const { playersText, lentText } = await import('../../js/boards.js');
const { ticketLines } = await import('../../js/ticket.js');

// Saca las claves igual que las lee una persona: t('…'), mark('…'), tp(n, '…', '…') y el HTML.
const ROOT = new URL('../../', import.meta.url);
const LIT = String.raw`'((?:[^'\\\n]|\\.)*)'`;
const unescape = (k) => k.replace(/\\n/g, '\n').replace(/\\'/g, "'");
function sourceKeys() {
  const keys = new Set();
  for (const f of readdirSync(new URL('js/', ROOT)).filter((x) => x.endsWith('.js'))) {
    const s = readFileSync(new URL(`js/${f}`, ROOT), 'utf8');
    for (const m of s.matchAll(new RegExp(String.raw`\b(?:t|mark)\(\s*` + LIT, 'g'))) keys.add(unescape(m[1]));
    for (const m of s.matchAll(new RegExp(String.raw`\btp\((?:[^,()]|\([^()]*\))+,\s*` + LIT + String.raw`,\s*` + LIT, 'g'))) {
      keys.add(unescape(m[1]));
      keys.add(unescape(m[2]));
    }
  }
  const html = readFileSync(new URL('index.html', ROOT), 'utf8');
  for (const m of html.matchAll(/<[a-z]+[^>]*\sdata-i18n[^>]*>([^<]+)</g)) keys.add(m[1].trim());
  for (const m of html.matchAll(/aria-label="([^"]+)"/g)) keys.add(m[1]);
  for (const m of html.matchAll(/<title>([^<]+)<\/title>/g)) keys.add(m[1]);
  return keys;
}

test('el inglés no se deja ningún texto ni guarda traducciones que ya no se usan', () => {
  const keys = sourceKeys();
  assert.ok(keys.size > 400, `solo ${keys.size} textos: ¿se ha roto la extracción?`);
  const missing = [...keys].filter((k) => !(k in EN));
  const unused = Object.keys(EN).filter((k) => !keys.has(k));
  assert.deepEqual(missing, [], 'textos sin traducir');
  assert.deepEqual(unused, [], 'traducciones que sobran');
});

test('las {llaves} de cada traducción son las mismas que las del español', () => {
  const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
  const bad = Object.entries(EN).filter(([es, en]) => holes(es) !== holes(en));
  assert.deepEqual(bad, []);
});

test('el idioma del navegador: español para es, ca, gl y eu; inglés para el resto', () => {
  assert.equal(detectLang(['es-ES']), 'es');
  assert.equal(detectLang(['ca']), 'es');
  assert.equal(detectLang(['en-US', 'es']), 'en');
  assert.equal(detectLang(['fr-FR', 'es']), 'es', 'si sabe español, mejor que inglés');
  assert.equal(detectLang(['de-DE']), 'en');
  assert.equal(detectLang([]), 'es');
});

test('traduce, rellena las llaves y vuelve al español', () => {
  setLang('en');
  assert.equal(getLang(), 'en');
  assert.equal(locale(), 'en-US');
  assert.equal(t('Habitación de {name}', { name: 'Laura' }), "Laura's room");
  assert.equal(tp(1, '1 juego', '{n} juegos'), '1 game');
  assert.equal(tp(3, '1 juego', '{n} juegos'), '3 games');
  assert.equal(t('Un texto sin traducción'), 'Un texto sin traducción', 'lo que no está, sale tal cual');
  assert.equal(euros(1234.5), '€1,234.5');
  assert.equal(recordText({ wins: 3, losses: 1 }), '3W · 1L (75%)');
  assert.equal(playersText({ minPlayers: 2, maxPlayers: 4 }), '2–4 players');
  assert.equal(lentText({ lentTo: 'Pedro', lentAt: '2026-01-01T00:00:00Z' }, new Date('2026-01-11T00:00:00Z')), 'Pedro has had it for 10 days');
  const ticket = ticketLines([{ id: 'a', title: 'Tetris', platform: 'gb', status: 'pendiente', score: null, hours: 0, kind: 'video' }], new Date(2026, 9, 16, 9, 5)).map((l) => l.text).join('\n');
  assert.match(ticket, /BALANCE DUE:\s+1 GAME/);
  assert.match(ticket, /10\/16\/2026/, 'fecha a la americana');
  setLang('xx');
  assert.equal(getLang(), 'es', 'un idioma desconocido vuelve al español');
  assert.equal(t('Habitación de {name}', { name: 'Laura' }), 'Habitación de Laura');
  assert.equal(euros(1234.5), '1234,5 €');
});
