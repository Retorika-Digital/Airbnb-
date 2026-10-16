import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// localStorage mínimo en memoria para Node.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const store = await import('../../js/store.js');
beforeEach(() => {
  mem.clear();
  store._reload();
});

test('añadir un juego lo valida y lo guarda', () => {
  const g = store.addGame({ title: '  Chrono   Trigger ', platform: 'snes', status: 'terminado', score: '9', hours: '32.26' });
  assert.equal(g.title, 'Chrono Trigger');
  assert.equal(g.platform, 'snes');
  assert.equal(g.score, 9);
  assert.equal(g.hours, 32.3);
  store._reload();
  assert.equal(store.getGames().length, 1, 'se lee de nuevo desde localStorage');
});

test('un juego sin título no entra', () => {
  assert.throws(() => store.addGame({ title: '   ' }), /título/);
  assert.equal(store.getGames().length, 0);
});

test('valores raros se corrigen en vez de romper', () => {
  const g = store.addGame({ title: 'X', platform: 'nintendo-virtual-boy-2', status: 'robado', score: 99, hours: -5, steamAppId: 'abc', cover: 'javascript:alert(1)', color: 'rojo' });
  assert.equal(g.platform, 'otra');
  assert.equal(g.status, 'pendiente');
  assert.equal(g.score, 10);
  assert.equal(g.hours, 0);
  assert.equal(g.steamAppId, null);
  assert.equal(g.cover, null, 'solo se aceptan portadas https');
  assert.equal(g.color, null);
});

test('la nota vacía es «sin nota», no un cero', () => {
  assert.equal(store.addGame({ title: 'A', score: '' }).score, null);
  assert.equal(store.addGame({ title: 'B', score: 0 }).score, 0);
});

test('los caracteres de control desaparecen y la reseña conserva los saltos de línea', () => {
  const g = store.addGame({ title: 'Ho\u0000la', review: 'línea 1\nlínea 2\u0007' });
  assert.equal(g.title, 'Hola');
  assert.equal(g.review, 'línea 1\nlínea 2');
});

test('actualizar mantiene id y fecha de alta; un título vacío no se aplica', () => {
  const g = store.addGame({ title: 'Celeste', platform: 'pc' });
  const u = store.updateGame(g.id, { status: 'terminado', score: 9, id: 'otro', addedAt: '2000-01-01' });
  assert.equal(u.id, g.id);
  assert.equal(u.addedAt, g.addedAt);
  assert.equal(u.status, 'terminado');
  assert.equal(store.updateGame(g.id, { title: '' }).title, 'Celeste');
  assert.equal(store.updateGame('no-existe', { title: 'x' }), null);
});

test('borrar quita el juego', () => {
  const g = store.addGame({ title: 'Borrable' });
  assert.equal(store.removeGame(g.id), true);
  assert.equal(store.removeGame(g.id), false);
  assert.equal(store.getGames().length, 0);
});

test('datos corruptos en localStorage no rompen nada', () => {
  mem.set('dkb:v1', '{roto');
  store._reload();
  assert.deepEqual(store.getGames(), []);
  mem.set('dkb:v1', JSON.stringify({ games: [null, 42, { title: 'Bueno' }, { title: '' }, { id: 'a', title: 'Dup' }, { id: 'a', title: 'Dup 2' }], settings: { palette: 'fucsia', sound: 'quizá' } }));
  store._reload();
  assert.deepEqual(store.getGames().map((g) => g.title), ['Bueno', 'Dup']);
  assert.equal(store.getSettings().palette, 'verde');
  assert.equal(store.getSettings().sound, true);
});

test('importar no duplica: ni por id de Steam ni por título + plataforma', () => {
  store.addGame({ title: 'The Witcher 3: Wild Hunt', platform: 'pc' });
  const r = store.importGames([
    { title: 'the witcher 3 wild hunt', platform: 'pc' },
    { title: 'Hades', platform: 'pc', steamAppId: 1145360 },
    { title: 'Hades (otro nombre)', platform: 'pc', steamAppId: 1145360 },
    { title: 'Hades', platform: 'switch' },
    { title: '' },
  ]);
  assert.deepEqual(r, { added: 2, skipped: 3 });
  assert.equal(store.getGames().length, 3);
});

test('los avisos llegan a los suscriptores con el tipo de cambio', () => {
  const seen = [];
  const off = store.subscribe((c) => seen.push(c.type));
  const g = store.addGame({ title: 'A' });
  store.updateGame(g.id, { score: 5 });
  store.importGames([{ title: 'B' }]);
  store.setSettings({ tidy: true });
  store.removeGame(g.id);
  off();
  store.addGame({ title: 'C' });
  assert.deepEqual(seen, ['add', 'update', 'import', 'settings', 'remove']);
});

test('copia de seguridad: ida y vuelta, y archivos que no son de DisketeBoy', () => {
  store.addGame({ title: 'Uno', review: 'Muy bueno' });
  store.addGame({ title: 'Dos' });
  const backup = store.exportBackup();
  store.clearAll();
  assert.equal(store.getGames().length, 0);
  assert.equal(store.importBackup(backup), 2);
  assert.equal(store.getGames()[0].review, 'Muy bueno');
  assert.throws(() => store.importBackup('no es json'), /copia/);
  assert.throws(() => store.importBackup(JSON.stringify({ games: [] })), /copia/);
});

test('setColors guarda solo colores válidos y avisa una vez', () => {
  const a = store.addGame({ title: 'A' });
  const b = store.addGame({ title: 'B' });
  let calls = 0;
  const off = store.subscribe(() => calls++);
  assert.equal(store.setColors({ [a.id]: '#AABBCC', [b.id]: 'azul', nope: '#000000' }), 1);
  off();
  assert.equal(calls, 1);
  assert.equal(store.getGame(a.id).color, '#aabbcc');
  assert.equal(store.getGame(b.id).color, null);
});

test('estadísticas y previsión de la pila de la vergüenza', () => {
  store.importGames([
    { title: 'A', status: 'terminado', score: 10, hours: 50 },
    { title: 'B', status: 'pendiente' },
    { title: 'C', status: 'pendiente' },
    { title: 'D', status: 'jugando', score: 6, hours: 10.4 },
  ]);
  const st = store.stats();
  assert.equal(st.total, 4);
  assert.equal(st.by.pendiente, 2);
  assert.equal(st.hours, 60);
  assert.equal(st.avgScore, 8);
  assert.equal(st.top[0].title, 'A');
  const f = store.pileForecast(14, 1, new Date(2026, 9, 15));
  assert.deepEqual([f.months, f.year, f.month], [14, 2027, 11]);
});

test('el límite de la colección se respeta', () => {
  const many = Array.from({ length: store.LIMITS.games + 5 }, (_, i) => ({ title: `Juego ${i}` }));
  const r = store.importGames(many);
  assert.equal(r.added, store.LIMITS.games);
  assert.equal(r.skipped, 5);
  assert.throws(() => store.addGame({ title: 'Uno más' }), /llena/);
});

test('tema y gato: valores de serie, se guardan y uno inventado se ignora', () => {
  assert.equal(store.getSettings().theme, 'crema');
  assert.equal(store.getSettings().pet, true, 'el gato viene de serie');
  store.setSettings({ theme: 'gamer', pet: false });
  store._reload();
  assert.equal(store.getSettings().theme, 'gamer');
  assert.equal(store.getSettings().pet, false);
  mem.set('dkb:v1', JSON.stringify({ games: [], settings: { theme: 'unicornio' } }));
  store._reload();
  assert.equal(store.getSettings().theme, 'crema');
});

test('de visita se ve el tema de quien comparte, sin tocar el tuyo', () => {
  store.setSettings({ theme: 'retro' });
  store.startVisit([{ title: 'Tetris', platform: 'gb' }], 'Laura', { theme: 'gamer', pet: false });
  assert.equal(store.getSettings().theme, 'gamer');
  assert.equal(store.getSettings().pet, false);
  store.setSettings({ theme: 'crema' });
  assert.equal(JSON.parse(mem.get('dkb:v1')).settings.theme, 'retro', 'la visita no se guarda encima de lo tuyo');
});
