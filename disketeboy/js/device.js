// La DisketeBoy: la consola desde la que gestionas tu colección.
// La pantalla es DOM de verdad (botones y campos), así que funciona con ratón,
// dedo, teclado y lector de pantalla; la cruceta y A/B son un atajo más.
import * as store from './store.js';
import { STATUSES, STATUS_LABEL, PALETTES, SORTS, THEMES, BOARD_STATUSES, BOARD_STATUS_LABEL, isBoard, statusLabel } from './store.js';
import { PLATFORMS, BOARD_SIZES, platform } from './platforms.js';
import { mapSteamGames } from './steam.js';
import { DEMO_GAMES, DEMO_BOARDS, DEMO_CARDS } from './demo.js';
import { TCGS, TCG_IDS, tcg, DECK_STATUSES, DECK_STATUS_LABEL, BINDER_STATUSES, BINDER_STATUS_LABEL, deckCount, recordText, euros, cardsStats } from './cards.js';
import { sfx, setSound } from './audio.js';
import { whatToPlay, playersText, minutesText, lentText, boardStats, pickOne, TIME_OPTIONS } from './boards.js';
import { clamp } from './util.js';

const PALETTE_LABEL = { verde: 'Verde clásico', ambar: 'Ámbar', hielo: 'Hielo', gris: 'Gris' };
const SORT_LABEL = { plataforma: 'Plataforma', nota: 'Nota', color: 'Color', az: 'A-Z', horas: 'Horas' };
const THEME_LABEL = { crema: 'Crema', gamer: 'Gamer RGB', retro: 'Retro 90' };
const ZONE_TEXT = {
  pendiente: 'tu pila de la vergüenza',
  jugando: 'tu escritorio',
  jugado: 'tu estantería',
  terminado: 'tu estantería',
  abandonado: 'la caja de abandonados',
};
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const FILTERS = ['todos', ...STATUSES];
const SCORES = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sizeName = (id) => BOARD_SIZES.find((s) => s.id === id)?.name || 'Estándar';
const boardMeta = (g) =>
  [g.minPlayers === g.maxPlayers ? `${g.minPlayers} jug` : `${g.minPlayers}-${g.maxPlayers} jug`, `${g.minutes}'`, g.score === null ? null : `★${g.score}`, g.plays ? `${g.plays} part.` : 'sin estrenar', g.lentTo ? 'PRESTADO' : null]
    .filter(Boolean)
    .join(' · ');

/** Crea elementos sin innerHTML: el texto del usuario nunca se interpreta como HTML. */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const stars = (score) => (score === null ? 'Sin nota' : `${'★'.repeat(Math.round(score / 2))}${'☆'.repeat(5 - Math.round(score / 2))} ${score}/10`);
const metaLine = (g) => [platform(g.platform).short, g.score === null ? null : `★${g.score}`, STATUS_LABEL[g.status]].filter(Boolean).join(' · ');
const cycle = (list, value, dir) => list[(list.indexOf(value) + dir + list.length) % list.length];

export function createDevice(root, actions) {
  const screen = root.querySelector('#screen');
  const toastEl = document.getElementById('toast');
  let current = { name: 'boot', params: {} };
  const history = [];
  let lastPlatform = 'pc';
  let toastTimer = 0;
  let booted = false;
  const night = { players: 4, minutes: 60 }; // «¿Qué jugamos esta noche?»
  let spinToken = null;

  // ---------------------------------------------------------------- utilidades
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2800);
  }

  const navs = () => [...screen.querySelectorAll('[data-nav]')].filter((el) => !el.closest('[hidden]'));

  function focusAt(index) {
    const list = navs();
    if (!list.length) return;
    const el = list[Math.max(0, Math.min(list.length - 1, index))];
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }

  function focusIndex() {
    return navs().indexOf(document.activeElement);
  }

  function move(delta) {
    const list = navs();
    if (!list.length) return;
    const i = focusIndex();
    const next = i < 0 ? 0 : Math.max(0, Math.min(list.length - 1, i + delta));
    if (next !== i) sfx.move();
    focusAt(next);
  }

  function step(dir) {
    const el = document.activeElement;
    if (el && screen.contains(el) && typeof el._step === 'function') {
      el._step(dir);
      sfx.move();
    }
  }

  function press() {
    const list = navs();
    let el = document.activeElement;
    if (!el || !screen.contains(el)) el = list[0];
    if (!el) return;
    if (el.matches('input, select, textarea')) el.focus();
    else el.click();
  }

  // ---------------------------------------------------------------- navegación
  function render(focus = 0) {
    const view = SCREENS[current.name] || SCREENS.menu;
    const content = view(current.params || {});
    screen.replaceChildren(content);
    screen.setAttribute('aria-label', `Pantalla de la DisketeBoy: ${content.dataset.title || ''}`);
    root.dataset.screen = current.name;
    if (focus !== null) requestAnimationFrame(() => focusAt(focus));
  }

  function go(name, params = {}) {
    history.push({ ...current, focus: Math.max(0, focusIndex()) });
    current = { name, params };
    sfx.select();
    render(0);
  }

  function back() {
    if (actions.isLowered?.()) return actions.raise();
    const prev = history.pop();
    if (!prev || current.name === 'menu') {
      sfx.error();
      return;
    }
    current = prev;
    sfx.back();
    render(prev.focus || 0);
  }

  function home() {
    history.length = 0;
    current = root.dataset.disk ? { name: 'menu', params: {} } : { name: 'disquetes', params: {} };
    sfx.back();
    render(0);
  }

  /** Repinta la pantalla actual si muestra datos que han cambiado (sin robar el foco a un campo). */
  function refresh() {
    if (['boot', 'nuevo', 'mesaNuevo', 'mazoNuevo', 'carpetaNueva', 'listaMazo', 'resena', 'steam', 'confirmar', 'ruleta'].includes(current.name)) return;
    const active = document.activeElement;
    if (active && screen.contains(active) && active.matches('input, textarea, select')) return;
    const keepFocus = screen.contains(active) ? Math.max(0, focusIndex()) : null;
    render(keepFocus);
  }

  // ---------------------------------------------------------------- piezas de pantalla
  const view = (title, ...kids) => {
    const el = h('div', { class: 'view' }, h('header', { class: 'view-head' }, h('h2', { text: title })), ...kids);
    el.dataset.title = title;
    return el;
  };

  const item = (label, onClick, { meta, disabled, cls, id } = {}) =>
    h(
      'button',
      {
        type: 'button',
        class: `item ${cls || ''}`.trim(),
        'data-nav': '',
        id,
        'aria-disabled': disabled ? 'true' : null,
        onclick: disabled ? () => (sfx.error(), toast('Próximamente')) : onClick,
      },
      h('span', { class: 'item-label', text: label }),
      meta ? h('span', { class: 'item-meta', text: meta }) : null,
    );

  /** Fila con ◀ valor ▶: izquierda/derecha en la cruceta, o A para avanzar. */
  function stepper(label, text, onStep, { id } = {}) {
    const el = h(
      'button',
      { type: 'button', class: 'item stepper', 'data-nav': '', id, 'aria-label': `${label}: ${text}. Cambia con las flechas izquierda y derecha.`, onclick: () => onStep(1) },
      h('span', { class: 'item-label', text: label }),
      h(
        'span',
        { class: 'stepper-value' },
        h('span', { class: 'arrow', 'aria-hidden': 'true', onclick: (e) => (e.stopPropagation(), onStep(-1)) }, '◀'),
        h('span', { text }),
        h('span', { class: 'arrow', 'aria-hidden': 'true', onclick: (e) => (e.stopPropagation(), onStep(1)) }, '▶'),
      ),
    );
    el._step = onStep;
    return el;
  }

  const p = (text, cls) => h('p', { class: cls || 'note', text });
  const statRow = (k, v) => h('div', { class: 'stat' }, h('dt', { text: k }), h('dd', { text: v }));

  // ---------------------------------------------------------------- pantallas
  const SCREENS = {
    boot() {
      const el = h(
        'div',
        { class: 'view boot' },
        h('div', { class: 'boot-logo', text: 'DisketeBoy' }),
        h('div', { class: 'boot-bar' }, h('span')),
        h('p', { class: 'boot-tip', text: 'Pulsa A para empezar' }),
      );
      el.dataset.title = 'Arrancando';
      return el;
    },

    disquetes() {
      const n = store.getVideoGames().length;
      const b = store.getBoards().length;
      return view(
        'Inserta un disquete',
        h(
          'div',
          { class: 'list' },
          item('Videojuegos', () => insertDisk('videojuegos'), { meta: `${n} juego${n === 1 ? '' : 's'}`, cls: 'disk disk-rojo', id: 'd-video' }),
          item('Juegos de mesa', () => insertDisk('mesa'), { meta: `${b} juego${b === 1 ? '' : 's'}`, cls: 'disk disk-azul', id: 'd-mesa' }),
          item('Cartas', () => insertDisk('cartas'), { meta: `${store.getCards().length} mazos y carpetas`, cls: 'disk disk-verde', id: 'd-cartas' }),
        ),
      );
    },

    menu() {
      if (root.dataset.disk === 'mesa') return SCREENS.mesa();
      if (root.dataset.disk === 'cartas') return SCREENS.cartas();
      const games = store.getVideoGames();
      const st = store.stats(games);
      const visit = store.visiting();
      if (visit) {
        return view(
          visit.name ? `Habitación de ${visit.name}` : 'De visita',
          p('Estás de visita: puedes mirarlo todo, pero no tocar nada.'),
          h(
            'div',
            { class: 'list' },
            item('Su colección', () => go('lista', { filter: 'todos' }), { meta: String(st.total), id: 'm-coleccion' }),
            item('Su pila de la vergüenza', () => go('pila'), { meta: String(st.by.pendiente), id: 'm-pila' }),
            item('Ver su habitación', () => actions.lower(), { id: 'm-habitacion' }),
            item('Estadísticas', () => go('stats'), { id: 'm-stats' }),
            item('Imprimir su ticket', () => actions.printTicket(), { id: 'm-ticket' }),
            item('Ajustes', () => go('ajustes'), { id: 'm-ajustes' }),
            item('Cambiar de disquete', ejectDisk, { id: 'm-expulsar' }),
            item('Crear mi propia habitación', () => actions.leaveVisit(), { cls: 'primary', id: 'm-salir' }),
          ),
        );
      }
      return view(
        'Videojuegos',
        h(
          'div',
          { class: 'list' },
          store.getGames().length ? null : item('Habitación vacía: ¿cargo la demo?', loadDemo, { cls: 'hint', id: 'demo-hint' }),
          item('Mi colección', () => go('lista', { filter: 'todos' }), { meta: String(st.total), id: 'm-coleccion' }),
          item('Añadir juego', () => go('nuevo'), { id: 'm-nuevo' }),
          item('Importar de Steam', () => go('steam'), { id: 'm-steam' }),
          item('Pila de la vergüenza', () => go('pila'), { meta: String(st.by.pendiente), id: 'm-pila' }),
          item('Ver mi habitación', () => actions.lower(), { id: 'm-habitacion' }),
          item('Estadísticas', () => go('stats'), { id: 'm-stats' }),
          item('Imprimir ticket', () => actions.printTicket(), { id: 'm-ticket' }),
          store.getGames().length ? item('Compartir mi habitación', () => actions.shareVisit(), { id: 'm-compartir' }) : null,
          item('Ajustes', () => go('ajustes'), { id: 'm-ajustes' }),
          item('Expulsar disquete', ejectDisk, { id: 'm-expulsar' }),
        ),
      );
    },

    lista({ filter = 'todos' }) {
      const settings = store.getSettings();
      const all = store.getVideoGames();
      const games = sortForList(filter === 'todos' ? all : all.filter((g) => g.status === filter), settings.sort);
      const label = filter === 'todos' ? 'Todos' : STATUS_LABEL[filter];
      const setFilter = (dir) => {
        current.params = { filter: cycle(FILTERS, filter, dir) };
        render(0);
      };
      return view(
        'Mi colección',
        h(
          'div',
          { class: 'list' },
          stepper('Ver', `${label} (${games.length})`, setFilter, { id: 'filtro' }),
          games.length
            ? games.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: metaLine(g), cls: 'game' }))
            : item('Nada por aquí. Añadir un juego', () => go('nuevo')),
        ),
      );
    },

    ficha({ id }) {
      const g = store.getGame(id);
      if (!g) return view('Juego borrado', p('Este juego ya no está en tu colección.'), h('div', { class: 'list' }, item('Volver', back)));
      if (isBoard(g)) return SCREENS.mesaFicha({ id });
      if (g.kind === 'mazo') return SCREENS.mazoFicha({ id });
      if (g.kind === 'carpeta') return SCREENS.carpetaFicha({ id });
      if (store.visiting()) {
        return view(
          g.title,
          p(platform(g.platform).name, 'sub'),
          h('dl', { class: 'stats' }, statRow('Estado', STATUS_LABEL[g.status]), statRow('Nota', g.score === null ? 'Sin nota' : `${g.score}/10`), statRow('Horas', String(g.hours))),
          p(g.review ? `“${g.review}”` : 'Sin reseña.', 'note quote'),
          h('div', { class: 'list' }, item('Ver en la habitación', () => actions.showInRoom(id), { id: 'f-ver' }), item('Volver', back)),
        );
      }
      const upd = (patch) => {
        store.updateGame(id, patch);
        sfx.save();
      };
      const scores = SCORES;
      const hours = h('input', {
        type: 'number',
        id: 'f-horas',
        min: '0',
        max: '99999',
        step: '0.5',
        inputmode: 'decimal',
        value: String(g.hours),
        'data-nav': '',
        onchange: (e) => upd({ hours: e.target.value }),
      });
      return view(
        g.title,
        p(platform(g.platform).name, 'sub'),
        h(
          'div',
          { class: 'list' },
          stepper('Estado', STATUS_LABEL[g.status], (dir) => upd({ status: cycle(STATUSES, g.status, dir) }), { id: 'f-estado' }),
          stepper('Nota', stars(g.score), (dir) => upd({ score: cycle(scores, g.score, dir) }), { id: 'f-nota' }),
          stepper('Plataforma', platform(g.platform).short, (dir) => upd({ platform: cycle(PLATFORMS.map((x) => x.id), g.platform, dir) }), { id: 'f-plataforma' }),
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: 'Horas' }), hours),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : 'Escribir reseña…', () => go('resena', { id }), { meta: 'Reseña', cls: 'review', id: 'f-resena' }),
          item('Ver en la habitación', () => actions.showInRoom(id), { id: 'f-ver' }),
          item('Borrar de la colección', () => go('confirmar', { text: `¿Borrar «${g.title}» de tu colección?`, yes: 'Sí, borrar', action: 'borrar', id }), { cls: 'danger', id: 'f-borrar' }),
        ),
      );
    },

    resena({ id }) {
      const g = store.getGame(id);
      if (!g) return SCREENS.ficha({ id });
      const counter = h('span', { class: 'counter', 'aria-live': 'polite', text: `${g.review.length}/${store.LIMITS.review}` });
      const area = h('textarea', {
        id: 'r-texto',
        maxlength: String(store.LIMITS.review),
        rows: '6',
        'data-nav': '',
        'aria-label': `Reseña de ${g.title}`,
        oninput: (e) => (counter.textContent = `${e.target.value.length}/${store.LIMITS.review}`),
      });
      area.value = g.review;
      return view(
        'Tu reseña',
        p(g.title, 'sub'),
        area,
        counter,
        h(
          'div',
          { class: 'list' },
          item('Guardar reseña', () => {
            store.updateGame(id, { review: area.value });
            toast('Reseña guardada: búscala en la contraportada de la caja');
            back();
          }, { id: 'r-guardar' }),
          item('Cancelar', back),
        ),
      );
    },

    nuevo() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form)) },
        h('label', {}, 'Título', h('input', { name: 'title', id: 'n-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: 'Ej.: Chrono Trigger' })),
        h('label', {}, 'Plataforma', h('select', { name: 'platform', id: 'n-plataforma', 'data-nav': '' }, PLATFORMS.map((pl) => h('option', { value: pl.id, selected: pl.id === lastPlatform, text: pl.name })))),
        h('label', {}, 'Estado', h('select', { name: 'status', id: 'n-estado', 'data-nav': '' }, STATUSES.map((st) => h('option', { value: st, selected: st === 'jugado', text: STATUS_LABEL[st] })))),
        h('label', {}, 'Nota', h('select', { name: 'score', id: 'n-nota', 'data-nav': '' }, h('option', { value: '', text: 'Sin nota' }), Array.from({ length: 11 }, (_, i) => h('option', { value: String(10 - i), text: `${10 - i}/10` })))),
        h('label', {}, 'Horas', h('input', { name: 'hours', id: 'n-horas', type: 'number', min: '0', max: '99999', step: '0.5', inputmode: 'decimal', 'data-nav': '', placeholder: '0' })),
        h('button', { type: 'submit', class: 'item primary', id: 'n-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: 'Añadir a mi colección' })),
      );
      return view('Añadir juego', form);
    },

    nuevoOk({ id }) {
      const g = store.getGame(id);
      const where = !g
        ? 'tu habitación'
        : isBoard(g)
          ? g.status === 'pendiente'
            ? 'encima de tu Kallax, aún con su plástico'
            : 'tu Kallax'
          : g.kind === 'mazo'
            ? 'tu mesa, delante de la tele'
            : g.kind === 'carpeta'
              ? 'los cubos de abajo de tu Kallax'
              : ZONE_TEXT[g.status];
      return view(
        '¡Plof!',
        p(g ? `«${g.title}» acaba de caer en ${where}.` : 'Añadido.', 'big'),
        h(
          'div',
          { class: 'list' },
          item('Añadir otro', () => {
            current = { name: !g ? 'nuevo' : isBoard(g) ? 'mesaNuevo' : g.kind === 'mazo' ? 'mazoNuevo' : g.kind === 'carpeta' ? 'carpetaNueva' : 'nuevo', params: {} };
            render(0);
          }, { id: 'ok-otro' }),
          g ? item('Verlo en la habitación', () => actions.showInRoom(id), { id: 'ok-ver' }) : null,
          item('Volver al menú', home),
        ),
      );
    },

    steam() {
      const input = h('input', { id: 's-perfil', 'data-nav': '', placeholder: 'steamcommunity.com/id/tunombre', 'aria-label': 'Tu perfil de Steam', autocomplete: 'off' });
      const status = h('div', { class: 'steam-status', role: 'status' });
      const form = h(
        'form',
        { class: 'form', onsubmit: (e) => (e.preventDefault(), lookup()) },
        input,
        h('button', { type: 'submit', class: 'item primary', 'data-nav': '', id: 's-buscar' }, h('span', { class: 'item-label', text: 'Buscar mis juegos' })),
      );
      async function lookup() {
        const value = input.value.trim();
        if (!value) return (sfx.error(), input.focus());
        status.replaceChildren(p('Conectando con Steam…'));
        const res = await actions.steamLookup(value);
        if (res.error) {
          sfx.error();
          status.replaceChildren(
            p(res.message || 'No he podido leer tu biblioteca.'),
            res.error === 'sin_clave' ? h('div', { class: 'list' }, item('Cargar la colección de demo', loadDemo, { id: 's-demo' })) : null,
          );
          focusAt(navs().length - 1);
          return;
        }
        const mapped = mapSteamGames(res.games);
        const pending = mapped.filter((g) => g.status === 'pendiente').length;
        status.replaceChildren(
          p(`He encontrado ${mapped.length} juegos. ${pending} nunca los has abierto: irán a tu pila de la vergüenza.`),
          h(
            'div',
            { class: 'list' },
            item(`Importar ${mapped.length} juegos`, () => {
              const { added, skipped } = store.importGames(mapped);
              toast(`¡Lluvia de cajas! ${added} juegos nuevos${skipped ? `, ${skipped} ya los tenías` : ''}.`);
              home();
              if (added) actions.lower();
            }, { cls: 'primary', id: 's-importar' }),
          ),
        );
        sfx.select();
        focusAt(navs().length - 1);
      }
      return view(
        'Importar de Steam',
        p('Pega tu perfil: la URL, tu nombre personalizado o tu SteamID. Tu perfil y tus juegos tienen que ser públicos.'),
        form,
        status,
      );
    },

    pila() {
      const pending = store.getVideoGames().filter((g) => g.status === 'pendiente');
      const f = store.pileForecast(pending.length);
      const text = pending.length
        ? `A un juego al mes, la terminarías en ${MONTHS[f.month]} de ${f.year}.`
        : 'No tienes nada pendiente. ¿Seguro? 👀';
      return view(
        'Pila de la vergüenza',
        h('div', { class: 'big-number', text: String(pending.length) }),
        p(text),
        h(
          'div',
          { class: 'list' },
          item('Ver la pila en mi habitación', () => actions.showZone('pila'), { id: 'p-ver' }),
          sortForList(pending, 'az').map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: metaLine(g), cls: 'game' })),
        ),
      );
    },

    stats() {
      const st = store.stats();
      const pct = st.total ? Math.round((st.by.terminado / st.total) * 100) : 0;
      const row = statRow;
      return view(
        'Estadísticas',
        h(
          'dl',
          { class: 'stats' },
          row('Juegos', String(st.total)),
          row('Plataformas', String(st.platforms)),
          row('Horas jugadas', String(st.hours)),
          row('Nota media', st.avgScore === null ? '—' : String(st.avgScore)),
          row('Terminados', `${st.by.terminado} (${pct}%)`),
          row('En la pila', String(st.by.pendiente)),
          row('Abandonados', String(st.by.abandonado)),
        ),
        st.top.length ? p(`Tu podio: ${st.top.map((g) => g.title).join(' · ')}`) : null,
        st.mostPlayed.length ? p(`Más horas: ${st.mostPlayed[0].title} (${Math.round(st.mostPlayed[0].hours)} h)`) : null,
        h('div', { class: 'list' }, item('Imprimir ticket', () => actions.printTicket(), { id: 'st-ticket' }), item('Volver', back)),
      );
    },

    // ------------------------------------------------ disquete de juegos de mesa
    mesa() {
      const boards = store.getBoards();
      const bs = boardStats(boards);
      const visit = store.visiting();
      return view(
        visit ? 'Sus juegos de mesa' : 'Juegos de mesa',
        h(
          'div',
          { class: 'list' },
          !boards.length && !visit ? item('Kallax vacía: ¿cargo la demo?', loadDemo, { cls: 'hint', id: 'demo-hint-mesa' }) : null,
          item(visit ? 'Su Kallax' : 'Mi Kallax', () => go('mesaLista', { filter: 'todos' }), { meta: String(bs.total), id: 'b-coleccion' }),
          visit ? null : item('Añadir juego de mesa', () => go('mesaNuevo'), { id: 'b-nuevo' }),
          item('¿Qué jugamos esta noche?', () => go('queJugamos'), { id: 'b-quejugamos' }),
          item('Sin estrenar', () => go('mesaLista', { filter: 'pendiente' }), { meta: String(bs.unplayed), id: 'b-sinestrenar' }),
          item('Préstamos', () => go('prestamos'), { meta: String(bs.lent.length), id: 'b-prestamos' }),
          item(visit ? 'Ver su Kallax en 3D' : 'Ver mi Kallax en 3D', () => actions.showZone('kallax'), { id: 'b-kallax' }),
          item('Estadísticas', () => go('mesaStats'), { id: 'b-stats' }),
          item(visit ? 'Cambiar de disquete' : 'Expulsar disquete', ejectDisk, { id: 'm-expulsar' }),
          visit ? item('Crear mi propia habitación', () => actions.leaveVisit(), { cls: 'primary', id: 'm-salir' }) : null,
        ),
      );
    },

    mesaLista({ filter = 'todos' }) {
      const all = store.getBoards();
      const list = (filter === 'todos' ? all : all.filter((g) => g.status === filter)).sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
      const filters = ['todos', ...BOARD_STATUSES];
      const label = filter === 'todos' ? 'Todos' : BOARD_STATUS_LABEL[filter];
      return view(
        'Juegos de mesa',
        h(
          'div',
          { class: 'list' },
          stepper('Ver', `${label} (${list.length})`, (dir) => {
            current.params = { filter: cycle(filters, filter, dir) };
            render(0);
          }, { id: 'b-filtro' }),
          list.length
            ? list.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: boardMeta(g), cls: 'game' }))
            : store.visiting()
              ? p('Nada por aquí.')
              : item('Nada por aquí. Añadir uno', () => go('mesaNuevo')),
        ),
      );
    },

    mesaFicha({ id }) {
      const g = store.getGame(id);
      if (!g) return view('Juego borrado', p('Este juego ya no está en tu colección.'), h('div', { class: 'list' }, item('Volver', back)));
      const sub = p(`${playersText(g)} · ${minutesText(g.minutes)}`, 'sub');
      if (store.visiting()) {
        return view(
          g.title,
          sub,
          h('dl', { class: 'stats' }, statRow('Estado', statusLabel(g)), statRow('Nota', g.score === null ? 'Sin nota' : `${g.score}/10`), statRow('Partidas', String(g.plays))),
          g.lentTo ? p(lentText(g)) : null,
          p(g.review ? `“${g.review}”` : 'Sin reseña.', 'note quote'),
          h('div', { class: 'list' }, item('Ver en la habitación', () => actions.showInRoom(id), { id: 'f-ver' }), item('Volver', back)),
        );
      }
      const upd = (patch) => {
        store.updateGame(id, patch);
        sfx.save();
      };
      const num = (idf, label, value, min, max, key) =>
        h(
          'label',
          { class: 'item field' },
          h('span', { class: 'item-label', text: label }),
          h('input', { type: 'number', id: idf, min, max, step: '1', inputmode: 'numeric', value: String(value), 'data-nav': '', onchange: (e) => upd({ [key]: e.target.value }) }),
        );
      const lent = h('input', {
        id: 'bf-prestado',
        maxlength: '40',
        'data-nav': '',
        placeholder: 'Nadie: está en casa',
        autocomplete: 'off',
        value: g.lentTo,
        onchange: (e) => upd({ lentTo: e.target.value, lentAt: e.target.value.trim() ? new Date().toISOString() : null }),
      });
      return view(
        g.title,
        sub,
        g.lentTo ? p(lentText(g), 'note lent') : null,
        h(
          'div',
          { class: 'list' },
          item(g.status === 'pendiente' ? '¡Lo hemos estrenado!' : `¡Hemos jugado! (${g.plays})`, () => {
            const fresh = g.status === 'pendiente';
            store.logPlay(id);
            sfx.select();
            toast(fresh ? `¡${g.title} estrenado! Fuera plástico.` : `Partida apuntada: ya van ${g.plays + 1}`);
          }, { cls: 'primary', id: 'bf-jugado' }),
          stepper('Estado', BOARD_STATUS_LABEL[g.status], (dir) => upd({ status: cycle(BOARD_STATUSES, g.status, dir) }), { id: 'bf-estado' }),
          stepper('Nota', stars(g.score), (dir) => upd({ score: cycle(SCORES, g.score, dir) }), { id: 'bf-nota' }),
          num('bf-min', 'Jugadores mín.', g.minPlayers, '1', '20', 'minPlayers'),
          num('bf-max', 'Jugadores máx.', g.maxPlayers, '1', '99', 'maxPlayers'),
          num('bf-minutos', 'Minutos', g.minutes, '5', '1000', 'minutes'),
          stepper('Caja', sizeName(g.platform), (dir) => upd({ platform: cycle(BOARD_SIZES.map((x) => x.id), g.platform, dir) }), { id: 'bf-caja' }),
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: 'Prestado a' }), lent),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : 'Escribir reseña…', () => go('resena', { id }), { meta: 'Reseña', cls: 'review', id: 'bf-resena' }),
          item('Ver en la habitación', () => actions.showInRoom(id), { id: 'bf-ver' }),
          item('Borrar de la colección', () => go('confirmar', { text: `¿Borrar «${g.title}» de tu colección?`, yes: 'Sí, borrar', action: 'borrar', id }), { cls: 'danger', id: 'bf-borrar' }),
        ),
      );
    },

    mesaNuevo() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form, { kind: 'mesa' })) },
        h('label', {}, 'Título', h('input', { name: 'title', id: 'bn-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: 'Ej.: Catan' })),
        h(
          'div',
          { class: 'row2' },
          h('label', {}, 'Jugadores mín.', h('input', { name: 'minPlayers', id: 'bn-min', type: 'number', min: '1', max: '20', value: '2', inputmode: 'numeric', 'data-nav': '' })),
          h('label', {}, 'Máx.', h('input', { name: 'maxPlayers', id: 'bn-max', type: 'number', min: '1', max: '99', value: '4', inputmode: 'numeric', 'data-nav': '' })),
        ),
        h('label', {}, 'Duración en minutos', h('input', { name: 'minutes', id: 'bn-minutos', type: 'number', min: '5', max: '1000', step: '5', value: '45', inputmode: 'numeric', 'data-nav': '' })),
        h('label', {}, 'Tamaño de la caja', h('select', { name: 'platform', id: 'bn-caja', 'data-nav': '' }, BOARD_SIZES.map((x) => h('option', { value: x.id, selected: x.id === 'mesa-l', text: x.name })))),
        h('label', {}, 'Estado', h('select', { name: 'status', id: 'bn-estado', 'data-nav': '' }, BOARD_STATUSES.map((st) => h('option', { value: st, selected: st === 'jugado', text: BOARD_STATUS_LABEL[st] })))),
        h('label', {}, 'Nota', h('select', { name: 'score', id: 'bn-nota', 'data-nav': '' }, h('option', { value: '', text: 'Sin nota' }), Array.from({ length: 11 }, (_, i) => h('option', { value: String(10 - i), text: `${10 - i}/10` })))),
        h('button', { type: 'submit', class: 'item primary', id: 'bn-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: 'Añadir a mi Kallax' })),
      );
      return view('Añadir juego de mesa', form);
    },

    queJugamos() {
      const matches = whatToPlay(store.getBoards(), night);
      const keep = () => render(Math.max(0, focusIndex()));
      return view(
        '¿Qué jugamos?',
        h(
          'div',
          { class: 'list' },
          stepper('Somos', String(night.players), (dir) => ((night.players = clamp(night.players + dir, 1, 12)), keep()), { id: 'q-jugadores' }),
          stepper('Tiempo', night.minutes ? `hasta ${minutesText(night.minutes)}` : 'Sin prisa', (dir) => ((night.minutes = cycle(TIME_OPTIONS, night.minutes, dir)), keep()), { id: 'q-tiempo' }),
          matches.length
            ? item(`¡Que elija la DisketeBoy! (${matches.length})`, () => go('ruleta', { ids: matches.map((g) => g.id) }), { cls: 'primary', id: 'q-ruleta' })
            : p('Nada encaja esta noche… ¿Más tiempo, menos gente o un juego nuevo?'),
          matches.slice(0, 15).map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: boardMeta(g), cls: 'game' })),
        ),
      );
    },

    ruleta({ ids, pick }) {
      const games = (ids || []).map((x) => store.getGame(x)).filter(Boolean);
      if (pick && store.getGame(pick)) {
        const g = store.getGame(pick);
        return view(
          '¡Esta noche toca…',
          h('div', { class: 'big-pick', text: g.title }),
          p(`${playersText(g)} · ${minutesText(g.minutes)}${g.status === 'pendiente' ? ' · ¡y por fin lo estrenáis!' : ''}`, 'sub'),
          h(
            'div',
            { class: 'list' },
            item('¡Sácalo de la Kallax!', () => actions.showInRoom(g.id), { cls: 'primary', id: 'r-sacar' }),
            item('Otra vez', () => {
              current.params = { ids };
              render(0);
            }, { id: 'r-otra' }),
            item('Volver', back),
          ),
        );
      }
      const label = h('div', { class: 'big-pick rolling', text: '…' });
      const el = view('Girando la ruleta…', label, p(`Entre ${games.length} juegos`, 'sub'));
      setTimeout(() => spin(games, label), 0);
      return el;
    },

    prestamos() {
      const lent = store.getBoards().filter((g) => g.lentTo).sort((a, b) => (a.lentAt || '').localeCompare(b.lentAt || ''));
      return view(
        'Préstamos',
        p(lent.length ? 'Lo que no está en casa, y quién lo tiene:' : 'Todo está en casa. ¡Bien!'),
        h('div', { class: 'list' }, lent.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: lentText(g), cls: 'game' })), item('Volver', back)),
      );
    },

    mesaStats() {
      const bs = boardStats(store.getBoards());
      return view(
        'Estadísticas',
        h('dl', { class: 'stats' }, statRow('Juegos de mesa', String(bs.total)), statRow('Partidas', String(bs.plays)), statRow('Sin estrenar', String(bs.unplayed)), statRow('Prestados', String(bs.lent.length))),
        bs.mostPlayed ? p(`El más jugado: ${bs.mostPlayed.title} (${bs.mostPlayed.plays} partidas)`) : null,
        h('div', { class: 'list' }, item('Volver', back)),
      );
    },

    // ------------------------------------------------ disquete de cartas
    cartas() {
      const items = store.getCards();
      const cs = cardsStats(items);
      const visit = store.visiting();
      return view(
        visit ? 'Sus cartas' : 'Cartas',
        h(
          'div',
          { class: 'list' },
          !items.length && !visit ? item('Sin cartas: ¿cargo la demo?', loadDemo, { cls: 'hint', id: 'demo-hint-cartas' }) : null,
          item(visit ? 'Sus mazos' : 'Mis mazos', () => go('cartasLista', { kind: 'mazo' }), { meta: String(cs.decks), id: 'c-mazos' }),
          visit ? null : item('Nuevo mazo', () => go('mazoNuevo'), { id: 'c-nuevo-mazo' }),
          item(visit ? 'Sus carpetas' : 'Mis carpetas', () => go('cartasLista', { kind: 'carpeta' }), { meta: String(cs.binders), id: 'c-carpetas' }),
          visit ? null : item('Nueva carpeta', () => go('carpetaNueva'), { id: 'c-nueva-carpeta' }),
          item('Ver los mazos en 3D', () => actions.showZone('mazos'), { id: 'c-ver' }),
          item('Estadísticas', () => go('cartasStats'), { id: 'c-stats' }),
          item(visit ? 'Cambiar de disquete' : 'Expulsar disquete', ejectDisk, { id: 'm-expulsar' }),
          visit ? item('Crear mi propia habitación', () => actions.leaveVisit(), { cls: 'primary', id: 'm-salir' }) : null,
        ),
      );
    },

    cartasLista({ kind = 'mazo' }) {
      const list = store.getCards().filter((g) => g.kind === kind).sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
      const meta = (g) => (kind === 'mazo' ? [tcg(g.tcg).short, g.format, recordText(g)] : [tcg(g.tcg).short, `${g.cards} cartas`, euros(g.value)]).filter(Boolean).join(' · ');
      return view(
        kind === 'mazo' ? 'Mazos' : 'Carpetas',
        h(
          'div',
          { class: 'list' },
          list.length
            ? list.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: meta(g), cls: 'game' }))
            : store.visiting()
              ? p('Nada por aquí.')
              : item(kind === 'mazo' ? 'Aún no hay mazos. Crear uno' : 'Aún no hay carpetas. Crear una', () => go(kind === 'mazo' ? 'mazoNuevo' : 'carpetaNueva')),
        ),
      );
    },

    mazoFicha({ id }) {
      const g = store.getGame(id);
      if (!g) return view('Mazo borrado', p('Este mazo ya no está en tu colección.'), h('div', { class: 'list' }, item('Volver', back)));
      const sub = p([tcg(g.tcg).name, g.format].filter(Boolean).join(' · '), 'sub');
      if (store.visiting()) {
        return view(
          g.title,
          sub,
          h('dl', { class: 'stats' }, statRow('Estado', statusLabel(g)), statRow('Récord', recordText(g)), statRow('Cartas', String(deckCount(g.list)))),
          p(g.review ? `“${g.review}”` : 'Sin notas.', 'note quote'),
          h('div', { class: 'list' }, item('Ver en la habitación', () => actions.showInRoom(id), { id: 'f-ver' }), item('Volver', back)),
        );
      }
      const upd = (patch) => {
        store.updateGame(id, patch);
        sfx.save();
      };
      const format = h('input', { id: 'cf-formato', maxlength: '40', 'data-nav': '', placeholder: 'Commander, Estándar…', autocomplete: 'off', value: g.format, onchange: (e) => upd({ format: e.target.value }) });
      return view(
        g.title,
        sub,
        p(recordText(g), 'note'),
        h(
          'div',
          { class: 'list' },
          item('¡He ganado!', () => {
            store.logResult(id, true);
            sfx.select();
            toast(`¡Victoria con ${g.title}! ${g.wins + 1}V · ${g.losses}D`);
          }, { cls: 'primary', id: 'cf-gane' }),
          item('He perdido', () => {
            store.logResult(id, false);
            sfx.back();
            toast(`Derrota apuntada. La próxima, mejor robo.`);
          }, { id: 'cf-perdi' }),
          stepper('Juego', tcg(g.tcg).short, (dir) => upd({ tcg: cycle(TCG_IDS, g.tcg, dir) }), { id: 'cf-juego' }),
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: 'Formato' }), format),
          stepper('Estado', DECK_STATUS_LABEL[g.status], (dir) => upd({ status: cycle(DECK_STATUSES, g.status, dir) }), { id: 'cf-estado' }),
          stepper('Nota', stars(g.score), (dir) => upd({ score: cycle(SCORES, g.score, dir) }), { id: 'cf-nota' }),
          item(`Lista del mazo (${deckCount(g.list)} cartas)`, () => go('listaMazo', { id }), { id: 'cf-lista' }),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : 'Escribir notas…', () => go('resena', { id }), { meta: 'Notas', cls: 'review', id: 'cf-notas' }),
          item('Ver en la habitación', () => actions.showInRoom(id), { id: 'cf-ver' }),
          item('Borrar mazo', () => go('confirmar', { text: `¿Borrar el mazo «${g.title}»?`, yes: 'Sí, borrar', action: 'borrar', id }), { cls: 'danger', id: 'cf-borrar' }),
        ),
      );
    },

    listaMazo({ id }) {
      const g = store.getGame(id);
      if (!g) return SCREENS.mazoFicha({ id });
      const counter = h('span', { class: 'counter', 'aria-live': 'polite', text: `${deckCount(g.list)} cartas` });
      const area = h('textarea', {
        id: 'lm-texto',
        rows: '8',
        maxlength: '6000',
        'data-nav': '',
        'aria-label': `Lista del mazo ${g.title}`,
        placeholder: '4 Rayo\n1 Sol Ring\n…',
        oninput: (e) => (counter.textContent = `${deckCount(e.target.value)} cartas`),
      });
      area.value = g.list;
      return view(
        'Lista del mazo',
        p(g.title, 'sub'),
        area,
        counter,
        h(
          'div',
          { class: 'list' },
          item('Guardar lista', () => {
            store.updateGame(id, { list: area.value });
            toast(`Lista guardada: ${deckCount(area.value)} cartas`);
            back();
          }, { id: 'lm-guardar' }),
          item('Cancelar', back),
        ),
      );
    },

    mazoNuevo() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form, { kind: 'mazo' })) },
        h('label', {}, 'Nombre del mazo', h('input', { name: 'title', id: 'cn-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: 'Ej.: Rojo Burn' })),
        h('label', {}, 'Juego', h('select', { name: 'tcg', id: 'cn-juego', 'data-nav': '' }, TCGS.map((t) => h('option', { value: t.id, text: t.name })))),
        h('label', {}, 'Formato', h('input', { name: 'format', id: 'cn-formato', maxlength: '40', 'data-nav': '', placeholder: 'Commander, Estándar…' })),
        h('label', {}, 'Estado', h('select', { name: 'status', id: 'cn-estado', 'data-nav': '' }, DECK_STATUSES.map((st) => h('option', { value: st, text: DECK_STATUS_LABEL[st] })))),
        h('button', { type: 'submit', class: 'item primary', id: 'cn-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: 'Crear mazo' })),
      );
      return view('Nuevo mazo', form);
    },

    carpetaNueva() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form, { kind: 'carpeta' })) },
        h('label', {}, 'Nombre de la carpeta', h('input', { name: 'title', id: 'pn-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: 'Ej.: Mis brillis' })),
        h('label', {}, 'Juego', h('select', { name: 'tcg', id: 'pn-juego', 'data-nav': '' }, TCGS.map((t) => h('option', { value: t.id, text: t.name })))),
        h(
          'div',
          { class: 'row2' },
          h('label', {}, 'Cartas', h('input', { name: 'cards', id: 'pn-cartas', type: 'number', min: '0', max: '1000000', value: '0', inputmode: 'numeric', 'data-nav': '' })),
          h('label', {}, 'Valor (€)', h('input', { name: 'value', id: 'pn-valor', type: 'number', min: '0', step: '0.01', value: '0', inputmode: 'decimal', 'data-nav': '' })),
        ),
        h('label', {}, 'Estado', h('select', { name: 'status', id: 'pn-estado', 'data-nav': '' }, BINDER_STATUSES.map((st) => h('option', { value: st, text: BINDER_STATUS_LABEL[st] })))),
        h('button', { type: 'submit', class: 'item primary', id: 'pn-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: 'Crear carpeta' })),
      );
      return view('Nueva carpeta', form);
    },

    carpetaFicha({ id }) {
      const g = store.getGame(id);
      if (!g) return view('Carpeta borrada', p('Esta carpeta ya no está en tu colección.'), h('div', { class: 'list' }, item('Volver', back)));
      const sub = p(`${tcg(g.tcg).name} · ${g.cards.toLocaleString('es-ES')} cartas · ${euros(g.value)}`, 'sub');
      if (store.visiting()) {
        return view(g.title, sub, h('dl', { class: 'stats' }, statRow('Estado', statusLabel(g))), p(g.review ? `“${g.review}”` : 'Sin notas.', 'note quote'), h('div', { class: 'list' }, item('Ver en la habitación', () => actions.showInRoom(id), { id: 'f-ver' }), item('Volver', back)));
      }
      const upd = (patch) => {
        store.updateGame(id, patch);
        sfx.save();
      };
      const num = (idf, label, value, step, key) =>
        h('label', { class: 'item field' }, h('span', { class: 'item-label', text: label }), h('input', { type: 'number', id: idf, min: '0', step, value: String(value), inputmode: 'decimal', 'data-nav': '', onchange: (e) => upd({ [key]: e.target.value }) }));
      return view(
        g.title,
        sub,
        h(
          'div',
          { class: 'list' },
          stepper('Juego', tcg(g.tcg).short, (dir) => upd({ tcg: cycle(TCG_IDS, g.tcg, dir) }), { id: 'pf-juego' }),
          stepper('Estado', BINDER_STATUS_LABEL[g.status], (dir) => upd({ status: cycle(BINDER_STATUSES, g.status, dir) }), { id: 'pf-estado' }),
          stepper('Nota', stars(g.score), (dir) => upd({ score: cycle(SCORES, g.score, dir) }), { id: 'pf-nota' }),
          num('pf-cartas', 'Cartas', g.cards, '1', 'cards'),
          num('pf-valor', 'Valor (€)', g.value, '0.01', 'value'),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : 'Escribir notas…', () => go('resena', { id }), { meta: 'Notas', cls: 'review', id: 'pf-notas' }),
          item('Ver en la habitación', () => actions.showInRoom(id), { id: 'pf-ver' }),
          item('Borrar carpeta', () => go('confirmar', { text: `¿Borrar la carpeta «${g.title}»?`, yes: 'Sí, borrar', action: 'borrar', id }), { cls: 'danger', id: 'pf-borrar' }),
        ),
      );
    },

    cartasStats() {
      const cs = cardsStats(store.getCards());
      return view(
        'Estadísticas',
        h(
          'dl',
          { class: 'stats' },
          statRow('Mazos', String(cs.decks)),
          statRow('Carpetas', String(cs.binders)),
          statRow('Cartas en carpetas', cs.cards.toLocaleString('es-ES')),
          statRow('Valor estimado', euros(cs.value)),
          statRow('Récord total', cs.winRate === null ? 'Sin partidas' : `${cs.wins}V · ${cs.losses}D (${cs.winRate}%)`),
        ),
        cs.best ? p(`Tu mejor mazo: ${cs.best.title} (${recordText(cs.best)})`) : null,
        h('div', { class: 'list' }, item('Volver', back)),
      );
    },

    ajustes() {
      const s = store.getSettings();
      const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => restore(e.target.files?.[0]) });
      const looks = [
        stepper('Pantalla', PALETTE_LABEL[s.palette], (dir) => store.setSettings({ palette: cycle(PALETTES, s.palette, dir) }), { id: 'a-paleta' }),
        stepper('Sonido', s.sound ? 'Sí' : 'No', () => store.setSettings({ sound: !s.sound }), { id: 'a-sonido' }),
        stepper('Habitación', THEME_LABEL[s.theme], (dir) => store.setSettings({ theme: cycle(THEMES, s.theme, dir) }), { id: 'a-tema' }),
        stepper('Gato', s.pet ? 'Sí, durmiendo' : 'No', () => store.setSettings({ pet: !s.pet }), { id: 'a-gato' }),
      ];
      if (store.visiting()) return view('Ajustes', h('div', { class: 'list' }, ...looks, item('Volver', back)));
      const nameInput = h('input', {
        id: 'a-nombre',
        'data-nav': '',
        maxlength: '30',
        placeholder: 'Para tus visitas',
        autocomplete: 'nickname',
        value: s.name,
        onchange: (e) => store.setSettings({ name: e.target.value }),
      });
      return view(
        'Ajustes',
        h(
          'div',
          { class: 'list' },
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: 'Tu nombre' }), nameInput),
          ...looks,
          stepper('Ordenar estantería', SORT_LABEL[s.sort], (dir) => store.setSettings({ sort: cycle(SORTS, s.sort, dir) }), { id: 'a-orden' }),
          item('Guardar copia de seguridad', backup, { id: 'a-exportar' }),
          item('Cargar copia de seguridad', () => file.click(), { id: 'a-importar' }),
          item('Cargar colección de demo', loadDemo, { id: 'a-demo' }),
          item('Borrar toda la colección', () => go('confirmar', { text: '¿Borrar TODA tu colección? No se puede deshacer (guarda antes una copia).', yes: 'Sí, borrarlo todo', action: 'vaciar' }), { cls: 'danger', id: 'a-vaciar' }),
          item('Créditos', () => go('creditos'), { id: 'a-creditos' }),
        ),
        file,
      );
    },

    creditos() {
      return view(
        'Créditos',
        p('DisketeBoy · prototipo hecho con cariño en España.'),
        p('Todo lo que ves está hecho con código: ni dibujos con IA ni assets ajenos. Las portadas de Steam son de sus autores.'),
        p('Gracias a quienes apoyan el proyecto: ¡aquí saldrá tu nombre!'),
        h('div', { class: 'list' }, item('Volver', back)),
      );
    },

    confirmar({ text, yes, action, id }) {
      const run = () => {
        if (action === 'borrar') {
          const g = store.getGame(id);
          store.removeGame(id);
          toast(g ? `«${g.title}» ya no está en tu colección` : 'Borrado');
          history.pop();
          back();
        } else if (action === 'vaciar') {
          store.clearAll();
          toast('Colección vaciada');
          home();
        }
      };
      return view('¿Seguro?', p(text, 'big'), h('div', { class: 'list' }, item('No', back, { id: 'c-no' }), item(yes || 'Sí', run, { cls: 'danger', id: 'c-si' })));
    },
  };

  // ---------------------------------------------------------------- acciones
  function sortForList(games, key) {
    const byTitle = (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
    const list = [...games];
    if (key === 'nota') return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || byTitle(a, b));
    if (key === 'horas') return list.sort((a, b) => b.hours - a.hours || byTitle(a, b));
    if (key === 'plataforma') return list.sort((a, b) => platform(a.platform).order - platform(b.platform).order || byTitle(a, b));
    return list.sort(byTitle);
  }

  function addFromForm(form, extra = {}) {
    const data = { ...Object.fromEntries(new FormData(form)), ...extra };
    if (!String(data.title || '').trim()) {
      sfx.error();
      form.elements.title.focus();
      return;
    }
    try {
      const g = store.addGame(data);
      if (!isBoard(g)) lastPlatform = g.platform;
      // Sustituye el formulario por la confirmación: B vuelve al menú, no al formulario relleno.
      current = { name: 'nuevoOk', params: { id: g.id } };
      sfx.select();
      render(0);
    } catch (err) {
      sfx.error();
      toast(err.message);
    }
  }

  /** La ruleta: los títulos pasan cada vez más despacio hasta parar en uno. */
  function spin(games, label) {
    const token = {};
    spinToken = token;
    const final = pickOne(games);
    if (!final) return;
    const total = REDUCED ? 1 : 16 + Math.floor(Math.random() * 6);
    let steps = 0;
    let delay = 55;
    const tick = () => {
      if (spinToken !== token || current.name !== 'ruleta') return;
      steps++;
      label.textContent = steps >= total ? final.title : games[(steps * 7) % games.length].title;
      sfx.move();
      if (steps >= total) {
        current.params = { ...current.params, pick: final.id };
        setTimeout(() => {
          if (spinToken !== token || current.name !== 'ruleta') return;
          sfx.select();
          render(0);
        }, REDUCED ? 0 : 450);
        return;
      }
      delay = Math.min(260, delay * 1.14);
      setTimeout(tick, delay);
    };
    tick();
  }

  function loadDemo() {
    const { added } = store.importGames([...DEMO_GAMES, ...DEMO_BOARDS, ...DEMO_CARDS]);
    toast(added ? `Demo cargada: ${added} juegos han caído en tu habitación` : 'La demo ya estaba cargada');
    if (!root.dataset.disk) root.dataset.disk = 'videojuegos';
    history.length = 0;
    current = { name: 'menu', params: {} };
    render(0);
    if (added) root.dataset.disk === 'mesa' ? actions.showZone('kallax') : root.dataset.disk === 'cartas' ? actions.showZone('mazos') : actions.lower();
  }

  function backup() {
    const blob = new Blob([store.exportBackup()], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `disketeboy-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Copia guardada en tus descargas');
  }

  async function restore(file) {
    if (!file) return;
    try {
      const n = store.importBackup(await file.text());
      toast(`Copia cargada: ${n} juegos`);
      home();
    } catch (err) {
      sfx.error();
      toast(err.message);
    }
  }

  function insertDisk(kind) {
    root.dataset.disk = kind;
    sfx.insert();
    screen.replaceChildren(h('div', { class: 'view boot' }, h('p', { class: 'boot-tip', text: 'Leyendo disquete…' }), h('div', { class: 'boot-bar' }, h('span'))));
    setTimeout(() => {
      history.length = 0;
      current = { name: 'menu', params: {} };
      render(0);
    }, 650);
  }

  function ejectDisk() {
    delete root.dataset.disk;
    sfx.eject();
    history.length = 0;
    current = { name: 'disquetes', params: {} };
    render(0);
  }

  function boot() {
    current = { name: 'boot', params: {} };
    render(null);
    const start = () => {
      if (booted) return;
      booted = true;
      if (store.getVideoGames().length || store.visiting()) insertDisk('videojuegos');
      else if (store.getBoards().length) insertDisk('mesa');
      else if (store.getCards().length) insertDisk('cartas');
      else {
        current = { name: 'disquetes', params: {} };
        render(0);
      }
    };
    root.addEventListener('dkb:press', start, { once: true });
    setTimeout(start, 1700);
    sfx.boot();
  }

  // ---------------------------------------------------------------- controles
  const buttons = {
    up: () => move(-1),
    down: () => move(1),
    left: () => step(-1),
    right: () => step(1),
    a: () => (booted ? press() : root.dispatchEvent(new Event('dkb:press'))),
    b: () => back(),
    start: () => (booted ? home() : root.dispatchEvent(new Event('dkb:press'))),
    select: () => (actions.isLowered?.() ? actions.raise() : actions.lower()),
  };

  for (const btn of root.querySelectorAll('[data-btn]')) {
    // pointerdown sin foco: pulsar la cruceta no le quita el foco a la pantalla.
    btn.addEventListener('pointerdown', (e) => e.preventDefault());
    btn.addEventListener('click', () => {
      btn.classList.remove('is-pressed');
      void btn.offsetWidth;
      btn.classList.add('is-pressed');
      buttons[btn.dataset.btn]?.();
    });
  }

  /** Teclado: flechas = cruceta, Enter = A, Escape = B. Devuelve true si lo ha usado. */
  function handleKey(e) {
    const t = e.target;
    const typing = t && t.matches?.('input, textarea, select');
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typing && t.matches('textarea')) t.blur();
      back();
      return true;
    }
    if (!booted && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      root.dispatchEvent(new Event('dkb:press'));
      return true;
    }
    if (typing) {
      const nativeArrows = t.matches('textarea, select, input[type=number]');
      if (!nativeArrows && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        move(e.key === 'ArrowDown' ? 1 : -1);
        return true;
      }
      return false;
    }
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (map[e.key]) {
      e.preventDefault();
      buttons[map[e.key]]();
      return true;
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      back();
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- arranque
  function applySettings() {
    const s = store.getSettings();
    root.dataset.palette = s.palette;
    setSound(s.sound);
  }

  store.subscribe((change) => {
    applySettings();
    if (change.type === 'settings') {
      const keep = Math.max(0, focusIndex());
      if (current.name === 'ajustes') render(keep);
      return;
    }
    refresh();
  });
  applySettings();

  return { boot, go, back, home, refresh, toast, handleKey, focus: () => focusAt(Math.max(0, focusIndex())), get screenName() { return current.name; } };
}
