import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSummary, PERSONAS } from '../../js/resumen.js';

const v = (over) => ({ kind: 'video', title: 'X', platform: 'pc', status: 'jugado', score: null, hours: 0, review: '', ...over });

test('el resumen cuenta lo importante de la colección', () => {
  const s = buildSummary([
    v({ title: 'Stardew', hours: 140, score: 9 }),
    v({ title: 'Hades', status: 'terminado', hours: 85, score: 10 }),
    v({ title: 'Witcher', status: 'pendiente' }),
    v({ title: 'Balatro', status: 'jugando', hours: 74, platform: 'switch' }),
    { kind: 'mesa', title: 'Catan', plays: 23, score: 7 },
    { kind: 'mazo', title: 'Burn', wins: 14, losses: 16 },
  ]);
  assert.equal(s.total, 6);
  assert.equal(s.hours, 299);
  assert.equal(s.mostHours.title, 'Stardew');
  assert.deepEqual(s.podium.map((g) => g.title), ['Hades', 'Stardew', 'Catan']);
  assert.deepEqual(s.playing, ['Balatro']);
  assert.deepEqual(s.topPlatform, { id: 'pc', count: 3 });
  assert.equal(s.mostPlayed.title, 'Catan');
  assert.equal(s.bestDeck.title, 'Burn');
});

test('una personalidad para cada colección (y siempre hay una)', () => {
  const many = (n, over) => Array.from({ length: n }, (_, i) => v({ title: `J${i}`, ...over }));
  assert.equal(buildSummary(many(10, { status: 'terminado' })).persona.id, 'completista');
  assert.equal(buildSummary(many(10, { status: 'pendiente' })).persona.id, 'montanero');
  assert.equal(buildSummary(many(6, { platform: 'snes' })).persona.id, 'arqueologo');
  assert.equal(buildSummary([]).persona.id, 'tranquilo');
  assert.equal(PERSONAS.at(-1).test({}), true, 'la última encaja siempre');
});
