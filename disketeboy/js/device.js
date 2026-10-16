// La DisketeBoy: la consola desde la que gestionas tu colección.
// La pantalla es DOM de verdad (botones y campos), así que funciona con ratón,
// dedo, teclado y lector de pantalla; la cruceta y A/B son un atajo más.
import * as store from './store.js';
import { STATUSES, STATUS_LABEL, PALETTES, SORTS, THEMES, BOARD_STATUSES, BOARD_STATUS_LABEL, isBoard, statusLabel } from './store.js';
import { PLATFORMS, BOARD_SIZES, platform } from './platforms.js';
import { mapSteamGames } from './steam.js';
import { demoCollection } from './demo.js';
import { TCGS, TCG_IDS, tcg, DECK_STATUSES, DECK_STATUS_LABEL, BINDER_STATUSES, BINDER_STATUS_LABEL, deckCount, recordText, euros, cardsStats } from './cards.js';
import { sfx, setSound } from './audio.js';
import { whatToPlay, playersText, minutesText, lentText, boardStats, pickOne, TIME_OPTIONS } from './boards.js';
import { clamp } from './util.js';
import { donateUrl } from './config.js';
import { t, tp, mark, num, LANGS, LANG_NAME, getLang } from './i18n.js';

const PALETTE_LABEL = { verde: mark('Verde clásico'), ambar: mark('Ámbar'), hielo: mark('Hielo'), gris: mark('Gris') };
const SORT_LABEL = { plataforma: mark('Plataforma'), nota: mark('Nota'), color: mark('Color'), az: 'A-Z', horas: mark('Horas') };
const THEME_LABEL = { crema: mark('Crema'), gamer: 'Gamer RGB', retro: 'Retro 90' };
const ZONE_TEXT = {
  pendiente: mark('tu pila de la vergüenza'),
  jugando: mark('tu escritorio'),
  jugado: mark('tu estantería'),
  terminado: mark('tu estantería'),
  abandonado: mark('la caja de abandonados'),
};
const STEAM_ERROR = {
  perfil: mark('Eso no parece un perfil de Steam. Prueba con la URL de tu perfil.'),
  sin_clave: mark('Este servidor aún no tiene clave de Steam, así que no puedo leer tu biblioteca. Mientras tanto, ¿cargo la colección de demo?'),
  no_encontrado: mark('No encuentro ningún perfil llamado «{name}».'),
  privado: mark('Tu perfil o tu lista de juegos es privada. En Steam: Perfil → Editar perfil → Privacidad → «Detalles del juego: público».'),
  red: mark('Steam no responde ahora mismo. Inténtalo en un rato.'),
  sin_conexion: mark('No hay conexión con el servidor. ¿Estás sin internet?'),
};
const MONTHS = [mark('enero'), mark('febrero'), mark('marzo'), mark('abril'), mark('mayo'), mark('junio'), mark('julio'), mark('agosto'), mark('septiembre'), mark('octubre'), mark('noviembre'), mark('diciembre')];
const FILTERS = ['todos', ...STATUSES];
const SCORES = [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sizeName = (id) => t(BOARD_SIZES.find((s) => s.id === id)?.name || 'Estándar');
const boardMeta = (g) =>
  [g.minPlayers === g.maxPlayers ? t('{n} jug', { n: g.minPlayers }) : t('{min}-{max} jug', { min: g.minPlayers, max: g.maxPlayers }), `${g.minutes}'`, g.score === null ? null : `★${g.score}`, g.plays ? tp(g.plays, '1 part.', '{n} part.') : t('sin estrenar'), g.lentTo ? t('PRESTADO') : null]
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

const stars = (score) => (score === null ? t('Sin nota') : `${'★'.repeat(Math.round(score / 2))}${'☆'.repeat(5 - Math.round(score / 2))} ${score}/10`);
const metaLine = (g) => [platform(g.platform).short, g.score === null ? null : `★${g.score}`, t(STATUS_LABEL[g.status])].filter(Boolean).join(' · ');
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
    screen.setAttribute('aria-label', t('Pantalla de la DisketeBoy: {title}', { title: content.dataset.title || '' }));
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
        onclick: disabled ? () => (sfx.error(), toast(t('Próximamente'))) : onClick,
      },
      h('span', { class: 'item-label', text: label }),
      meta ? h('span', { class: 'item-meta', text: meta }) : null,
    );

  /** Fila con ◀ valor ▶: izquierda/derecha en la cruceta, o A para avanzar. */
  function stepper(label, text, onStep, { id } = {}) {
    const el = h(
      'button',
      { type: 'button', class: 'item stepper', 'data-nav': '', id, 'aria-label': t('{label}: {value}. Cambia con las flechas izquierda y derecha.', { label, value: text }), onclick: () => onStep(1) },
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
        h('p', { class: 'boot-tip', text: t('Pulsa A para empezar') }),
      );
      el.dataset.title = 'Arrancando';
      return el;
    },

    disquetes() {
      const n = store.getVideoGames().length;
      const b = store.getBoards().length;
      return view(
        t('Inserta un disquete'),
        h(
          'div',
          { class: 'list' },
          item(t('Videojuegos'), () => insertDisk('videojuegos'), { meta: tp(n, '1 juego', '{n} juegos'), cls: 'disk disk-rojo', id: 'd-video' }),
          item(t('Juegos de mesa'), () => insertDisk('mesa'), { meta: tp(b, '1 juego', '{n} juegos'), cls: 'disk disk-azul', id: 'd-mesa' }),
          item(t('Cartas'), () => insertDisk('cartas'), { meta: t('{n} mazos y carpetas', { n: store.getCards().length }), cls: 'disk disk-verde', id: 'd-cartas' }),
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
          visit.name ? t('Habitación de {name}', { name: visit.name }) : t('De visita'),
          p(t('Estás de visita: puedes mirarlo todo, pero no tocar nada.')),
          h(
            'div',
            { class: 'list' },
            item(t('Su colección'), () => go('lista', { filter: 'todos' }), { meta: String(st.total), id: 'm-coleccion' }),
            item(t('Su pila de la vergüenza'), () => go('pila'), { meta: String(st.by.pendiente), id: 'm-pila' }),
            item(t('Ver su habitación'), () => actions.lower(), { id: 'm-habitacion' }),
            item(t('Estadísticas'), () => go('stats'), { id: 'm-stats' }),
            item(t('Imprimir su ticket'), () => actions.printTicket(), { id: 'm-ticket' }),
            item(t('Ajustes'), () => go('ajustes'), { id: 'm-ajustes' }),
            item(t('Cambiar de disquete'), ejectDisk, { id: 'm-expulsar' }),
            item(t('Crear mi propia habitación'), () => actions.leaveVisit(), { cls: 'primary', id: 'm-salir' }),
          ),
        );
      }
      return view(
        t('Videojuegos'),
        h(
          'div',
          { class: 'list' },
          store.getGames().length ? null : item(t('Habitación vacía: ¿cargo la demo?'), loadDemo, { cls: 'hint', id: 'demo-hint' }),
          item(t('Mi colección'), () => go('lista', { filter: 'todos' }), { meta: String(st.total), id: 'm-coleccion' }),
          item(t('Añadir juego'), () => go('nuevo'), { id: 'm-nuevo' }),
          item(t('Importar de Steam'), () => go('steam'), { id: 'm-steam' }),
          item(t('Pila de la vergüenza'), () => go('pila'), { meta: String(st.by.pendiente), id: 'm-pila' }),
          item(t('Ver mi habitación'), () => actions.lower(), { id: 'm-habitacion' }),
          item(t('Estadísticas'), () => go('stats'), { id: 'm-stats' }),
          item(t('Imprimir ticket'), () => actions.printTicket(), { id: 'm-ticket' }),
          store.getGames().length ? item(t('Compartir mi habitación'), () => actions.shareVisit(), { id: 'm-compartir' }) : null,
          item(t('Ajustes'), () => go('ajustes'), { id: 'm-ajustes' }),
          item(t('Expulsar disquete'), ejectDisk, { id: 'm-expulsar' }),
        ),
      );
    },

    lista({ filter = 'todos' }) {
      const settings = store.getSettings();
      const all = store.getVideoGames();
      const games = sortForList(filter === 'todos' ? all : all.filter((g) => g.status === filter), settings.sort);
      const label = filter === 'todos' ? t('Todos') : t(STATUS_LABEL[filter]);
      const setFilter = (dir) => {
        current.params = { filter: cycle(FILTERS, filter, dir) };
        render(0);
      };
      return view(
        t('Mi colección'),
        h(
          'div',
          { class: 'list' },
          stepper(t('Ver'), `${label} (${games.length})`, setFilter, { id: 'filtro' }),
          games.length
            ? games.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: metaLine(g), cls: 'game' }))
            : item(t('Nada por aquí. Añadir un juego'), () => go('nuevo')),
        ),
      );
    },

    ficha({ id }) {
      const g = store.getGame(id);
      if (!g) return view(t('Juego borrado'), p(t('Este juego ya no está en tu colección.')), h('div', { class: 'list' }, item(t('Volver'), back)));
      if (isBoard(g)) return SCREENS.mesaFicha({ id });
      if (g.kind === 'mazo') return SCREENS.mazoFicha({ id });
      if (g.kind === 'carpeta') return SCREENS.carpetaFicha({ id });
      if (store.visiting()) {
        return view(
          g.title,
          p(t(platform(g.platform).name), 'sub'),
          h('dl', { class: 'stats' }, statRow(t('Estado'), t(STATUS_LABEL[g.status])), statRow(t('Nota'), g.score === null ? t('Sin nota') : `${g.score}/10`), statRow(t('Horas'), String(g.hours))),
          p(g.review ? `“${g.review}”` : t('Sin reseña.'), 'note quote'),
          h('div', { class: 'list' }, item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'f-ver' }), item(t('Volver'), back)),
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
        p(t(platform(g.platform).name), 'sub'),
        h(
          'div',
          { class: 'list' },
          stepper(t('Estado'), t(STATUS_LABEL[g.status]), (dir) => upd({ status: cycle(STATUSES, g.status, dir) }), { id: 'f-estado' }),
          stepper(t('Nota'), stars(g.score), (dir) => upd({ score: cycle(scores, g.score, dir) }), { id: 'f-nota' }),
          stepper(t('Plataforma'), platform(g.platform).short, (dir) => upd({ platform: cycle(PLATFORMS.map((x) => x.id), g.platform, dir) }), { id: 'f-plataforma' }),
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: t('Horas') }), hours),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : t('Escribir reseña…'), () => go('resena', { id }), { meta: t('Reseña'), cls: 'review', id: 'f-resena' }),
          item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'f-ver' }),
          item(t('Borrar de la colección'), () => go('confirmar', { text: t('¿Borrar «{title}» de tu colección?', { title: g.title }), yes: t('Sí, borrar'), action: 'borrar', id }), { cls: 'danger', id: 'f-borrar' }),
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
        'aria-label': t('Reseña de {title}', { title: g.title }),
        oninput: (e) => (counter.textContent = `${e.target.value.length}/${store.LIMITS.review}`),
      });
      area.value = g.review;
      return view(
        t('Tu reseña'),
        p(g.title, 'sub'),
        area,
        counter,
        h(
          'div',
          { class: 'list' },
          item(t('Guardar reseña'), () => {
            store.updateGame(id, { review: area.value });
            toast(t('Reseña guardada: búscala en la contraportada de la caja'));
            back();
          }, { id: 'r-guardar' }),
          item(t('Cancelar'), back),
        ),
      );
    },

    nuevo() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form)) },
        h('label', {}, t('Título'), h('input', { name: 'title', id: 'n-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: t('Ej.: Chrono Trigger') })),
        h('label', {}, t('Plataforma'), h('select', { name: 'platform', id: 'n-plataforma', 'data-nav': '' }, PLATFORMS.map((pl) => h('option', { value: pl.id, selected: pl.id === lastPlatform, text: t(pl.name) })))),
        h('label', {}, t('Estado'), h('select', { name: 'status', id: 'n-estado', 'data-nav': '' }, STATUSES.map((st) => h('option', { value: st, selected: st === 'jugado', text: t(STATUS_LABEL[st]) })))),
        h('label', {}, t('Nota'), h('select', { name: 'score', id: 'n-nota', 'data-nav': '' }, h('option', { value: '', text: t('Sin nota') }), Array.from({ length: 11 }, (_, i) => h('option', { value: String(10 - i), text: `${10 - i}/10` })))),
        h('label', {}, t('Horas'), h('input', { name: 'hours', id: 'n-horas', type: 'number', min: '0', max: '99999', step: '0.5', inputmode: 'decimal', 'data-nav': '', placeholder: '0' })),
        h('button', { type: 'submit', class: 'item primary', id: 'n-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: t('Añadir a mi colección') })),
      );
      return view(t('Añadir juego'), form);
    },

    nuevoOk({ id }) {
      const g = store.getGame(id);
      const where = !g
        ? t('tu habitación')
        : isBoard(g)
          ? g.status === 'pendiente'
            ? t('encima de tu Kallax, aún con su plástico')
            : t('tu Kallax')
          : g.kind === 'mazo'
            ? t('tu mesa, delante de la tele')
            : g.kind === 'carpeta'
              ? t('los cubos de abajo de tu Kallax')
              : t(ZONE_TEXT[g.status]);
      return view(
        t('¡Plof!'),
        p(g ? t('«{title}» acaba de caer en {where}.', { title: g.title, where }) : t('Añadido.'), 'big'),
        h(
          'div',
          { class: 'list' },
          item(t('Añadir otro'), () => {
            current = { name: !g ? 'nuevo' : isBoard(g) ? 'mesaNuevo' : g.kind === 'mazo' ? 'mazoNuevo' : g.kind === 'carpeta' ? 'carpetaNueva' : 'nuevo', params: {} };
            render(0);
          }, { id: 'ok-otro' }),
          g ? item(t('Verlo en la habitación'), () => actions.showInRoom(id), { id: 'ok-ver' }) : null,
          item(t('Volver al menú'), home),
        ),
      );
    },

    steam() {
      const input = h('input', { id: 's-perfil', 'data-nav': '', placeholder: t('steamcommunity.com/id/tunombre'), 'aria-label': t('Tu perfil de Steam'), autocomplete: 'off' });
      const status = h('div', { class: 'steam-status', role: 'status' });
      const form = h(
        'form',
        { class: 'form', onsubmit: (e) => (e.preventDefault(), lookup()) },
        input,
        h('button', { type: 'submit', class: 'item primary', 'data-nav': '', id: 's-buscar' }, h('span', { class: 'item-label', text: t('Buscar mis juegos') })),
      );
      async function lookup() {
        const value = input.value.trim();
        if (!value) return (sfx.error(), input.focus());
        status.replaceChildren(p(t('Conectando con Steam…')));
        const res = await actions.steamLookup(value);
        if (res.error) {
          sfx.error();
          status.replaceChildren(
            p(STEAM_ERROR[res.error] ? t(STEAM_ERROR[res.error], { name: value.replace(/\/+$/, '').split('/').pop() }) : res.message || t('No he podido leer tu biblioteca.')),
            res.error === 'sin_clave' ? h('div', { class: 'list' }, item(t('Cargar la colección de demo'), loadDemo, { id: 's-demo' })) : null,
          );
          focusAt(navs().length - 1);
          return;
        }
        const mapped = mapSteamGames(res.games);
        const pending = mapped.filter((g) => g.status === 'pendiente').length;
        status.replaceChildren(
          p(t('He encontrado {n} juegos. {pending} nunca los has abierto: irán a tu pila de la vergüenza.', { n: mapped.length, pending })),
          h(
            'div',
            { class: 'list' },
            item(t('Importar {n} juegos', { n: mapped.length }), () => {
              const { added, skipped } = store.importGames(mapped);
              toast(skipped ? t('¡Lluvia de cajas! {added} juegos nuevos, {skipped} ya los tenías.', { added, skipped }) : t('¡Lluvia de cajas! {added} juegos nuevos.', { added }));
              home();
              if (added) actions.lower();
            }, { cls: 'primary', id: 's-importar' }),
          ),
        );
        sfx.select();
        focusAt(navs().length - 1);
      }
      return view(
        t('Importar de Steam'),
        p(t('Pega tu perfil: la URL, tu nombre personalizado o tu SteamID. Tu perfil y tus juegos tienen que ser públicos.')),
        form,
        status,
      );
    },

    pila() {
      const pending = store.getVideoGames().filter((g) => g.status === 'pendiente');
      const f = store.pileForecast(pending.length);
      const text = pending.length
        ? t('A un juego al mes, la terminarías en {month} de {year}.', { month: t(MONTHS[f.month]), year: f.year })
        : t('No tienes nada pendiente. ¿Seguro? 👀');
      return view(
        t('Pila de la vergüenza'),
        h('div', { class: 'big-number', text: String(pending.length) }),
        p(text),
        h(
          'div',
          { class: 'list' },
          item(t('Ver la pila en mi habitación'), () => actions.showZone('pila'), { id: 'p-ver' }),
          sortForList(pending, 'az').map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: metaLine(g), cls: 'game' })),
        ),
      );
    },

    stats() {
      const st = store.stats();
      const pct = st.total ? Math.round((st.by.terminado / st.total) * 100) : 0;
      const row = statRow;
      return view(
        t('Estadísticas'),
        h(
          'dl',
          { class: 'stats' },
          row(t('Juegos'), String(st.total)),
          row(t('Plataformas'), String(st.platforms)),
          row(t('Horas jugadas'), String(st.hours)),
          row(t('Nota media'), st.avgScore === null ? '—' : String(st.avgScore)),
          row(t('Terminados'), `${st.by.terminado} (${pct}%)`),
          row(t('En la pila'), String(st.by.pendiente)),
          row(t('Abandonados'), String(st.by.abandonado)),
        ),
        st.top.length ? p(t('Tu podio: {list}', { list: st.top.map((g) => g.title).join(' · ') })) : null,
        st.mostPlayed.length ? p(t('Más horas: {title} ({hours} h)', { title: st.mostPlayed[0].title, hours: Math.round(st.mostPlayed[0].hours) })) : null,
        h('div', { class: 'list' }, item(t('Imprimir ticket'), () => actions.printTicket(), { id: 'st-ticket' }), item(t('Volver'), back)),
      );
    },

    // ------------------------------------------------ disquete de juegos de mesa
    mesa() {
      const boards = store.getBoards();
      const bs = boardStats(boards);
      const visit = store.visiting();
      return view(
        visit ? t('Sus juegos de mesa') : t('Juegos de mesa'),
        h(
          'div',
          { class: 'list' },
          !boards.length && !visit ? item(t('Kallax vacía: ¿cargo la demo?'), loadDemo, { cls: 'hint', id: 'demo-hint-mesa' }) : null,
          item(visit ? t('Su Kallax') : t('Mi Kallax'), () => go('mesaLista', { filter: 'todos' }), { meta: String(bs.total), id: 'b-coleccion' }),
          visit ? null : item(t('Añadir juego de mesa'), () => go('mesaNuevo'), { id: 'b-nuevo' }),
          item(t('¿Qué jugamos esta noche?'), () => go('queJugamos'), { id: 'b-quejugamos' }),
          item(t('Sin estrenar'), () => go('mesaLista', { filter: 'pendiente' }), { meta: String(bs.unplayed), id: 'b-sinestrenar' }),
          item(t('Préstamos'), () => go('prestamos'), { meta: String(bs.lent.length), id: 'b-prestamos' }),
          item(visit ? t('Ver su Kallax en 3D') : t('Ver mi Kallax en 3D'), () => actions.showZone('kallax'), { id: 'b-kallax' }),
          item(t('Estadísticas'), () => go('mesaStats'), { id: 'b-stats' }),
          item(visit ? t('Cambiar de disquete') : t('Expulsar disquete'), ejectDisk, { id: 'm-expulsar' }),
          visit ? item(t('Crear mi propia habitación'), () => actions.leaveVisit(), { cls: 'primary', id: 'm-salir' }) : null,
        ),
      );
    },

    mesaLista({ filter = 'todos' }) {
      const all = store.getBoards();
      const list = (filter === 'todos' ? all : all.filter((g) => g.status === filter)).sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
      const filters = ['todos', ...BOARD_STATUSES];
      const label = filter === 'todos' ? t('Todos') : t(BOARD_STATUS_LABEL[filter]);
      return view(
        t('Juegos de mesa'),
        h(
          'div',
          { class: 'list' },
          stepper(t('Ver'), `${label} (${list.length})`, (dir) => {
            current.params = { filter: cycle(filters, filter, dir) };
            render(0);
          }, { id: 'b-filtro' }),
          list.length
            ? list.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: boardMeta(g), cls: 'game' }))
            : store.visiting()
              ? p(t('Nada por aquí.'))
              : item(t('Nada por aquí. Añadir uno'), () => go('mesaNuevo')),
        ),
      );
    },

    mesaFicha({ id }) {
      const g = store.getGame(id);
      if (!g) return view(t('Juego borrado'), p(t('Este juego ya no está en tu colección.')), h('div', { class: 'list' }, item(t('Volver'), back)));
      const sub = p(`${playersText(g)} · ${minutesText(g.minutes)}`, 'sub');
      if (store.visiting()) {
        return view(
          g.title,
          sub,
          h('dl', { class: 'stats' }, statRow(t('Estado'), statusLabel(g)), statRow(t('Nota'), g.score === null ? t('Sin nota') : `${g.score}/10`), statRow(t('Partidas'), String(g.plays))),
          g.lentTo ? p(lentText(g)) : null,
          p(g.review ? `“${g.review}”` : t('Sin reseña.'), 'note quote'),
          h('div', { class: 'list' }, item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'f-ver' }), item(t('Volver'), back)),
        );
      }
      const upd = (patch) => {
        store.updateGame(id, patch);
        sfx.save();
      };
      const field = (idf, label, value, min, max, key) =>
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
        placeholder: t('Nadie: está en casa'),
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
          item(g.status === 'pendiente' ? t('¡Lo hemos estrenado!') : t('¡Hemos jugado! ({n})', { n: g.plays }), () => {
            const fresh = g.status === 'pendiente';
            store.logPlay(id);
            sfx.select();
            toast(fresh ? t('¡{title} estrenado! Fuera plástico.', { title: g.title }) : t('Partida apuntada: ya van {n}', { n: g.plays + 1 }));
          }, { cls: 'primary', id: 'bf-jugado' }),
          stepper(t('Estado'), t(BOARD_STATUS_LABEL[g.status]), (dir) => upd({ status: cycle(BOARD_STATUSES, g.status, dir) }), { id: 'bf-estado' }),
          stepper(t('Nota'), stars(g.score), (dir) => upd({ score: cycle(SCORES, g.score, dir) }), { id: 'bf-nota' }),
          field('bf-min', t('Jugadores mín.'), g.minPlayers, '1', '20', 'minPlayers'),
          field('bf-max', t('Jugadores máx.'), g.maxPlayers, '1', '99', 'maxPlayers'),
          field('bf-minutos', t('Minutos'), g.minutes, '5', '1000', 'minutes'),
          stepper(t('Caja'), sizeName(g.platform), (dir) => upd({ platform: cycle(BOARD_SIZES.map((x) => x.id), g.platform, dir) }), { id: 'bf-caja' }),
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: t('Prestado a') }), lent),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : t('Escribir reseña…'), () => go('resena', { id }), { meta: t('Reseña'), cls: 'review', id: 'bf-resena' }),
          item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'bf-ver' }),
          item(t('Borrar de la colección'), () => go('confirmar', { text: t('¿Borrar «{title}» de tu colección?', { title: g.title }), yes: t('Sí, borrar'), action: 'borrar', id }), { cls: 'danger', id: 'bf-borrar' }),
        ),
      );
    },

    mesaNuevo() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form, { kind: 'mesa' })) },
        h('label', {}, t('Título'), h('input', { name: 'title', id: 'bn-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: t('Ej.: Catan') })),
        h(
          'div',
          { class: 'row2' },
          h('label', {}, t('Jugadores mín.'), h('input', { name: 'minPlayers', id: 'bn-min', type: 'number', min: '1', max: '20', value: '2', inputmode: 'numeric', 'data-nav': '' })),
          h('label', {}, t('Máx.'), h('input', { name: 'maxPlayers', id: 'bn-max', type: 'number', min: '1', max: '99', value: '4', inputmode: 'numeric', 'data-nav': '' })),
        ),
        h('label', {}, t('Duración en minutos'), h('input', { name: 'minutes', id: 'bn-minutos', type: 'number', min: '5', max: '1000', step: '5', value: '45', inputmode: 'numeric', 'data-nav': '' })),
        h('label', {}, t('Tamaño de la caja'), h('select', { name: 'platform', id: 'bn-caja', 'data-nav': '' }, BOARD_SIZES.map((x) => h('option', { value: x.id, selected: x.id === 'mesa-l', text: t(x.name) })))),
        h('label', {}, t('Estado'), h('select', { name: 'status', id: 'bn-estado', 'data-nav': '' }, BOARD_STATUSES.map((st) => h('option', { value: st, selected: st === 'jugado', text: t(BOARD_STATUS_LABEL[st]) })))),
        h('label', {}, t('Nota'), h('select', { name: 'score', id: 'bn-nota', 'data-nav': '' }, h('option', { value: '', text: t('Sin nota') }), Array.from({ length: 11 }, (_, i) => h('option', { value: String(10 - i), text: `${10 - i}/10` })))),
        h('button', { type: 'submit', class: 'item primary', id: 'bn-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: t('Añadir a mi Kallax') })),
      );
      return view(t('Añadir juego de mesa'), form);
    },

    queJugamos() {
      const matches = whatToPlay(store.getBoards(), night);
      const keep = () => render(Math.max(0, focusIndex()));
      return view(
        t('¿Qué jugamos?'),
        h(
          'div',
          { class: 'list' },
          stepper(t('Somos'), String(night.players), (dir) => ((night.players = clamp(night.players + dir, 1, 12)), keep()), { id: 'q-jugadores' }),
          stepper(t('Tiempo'), night.minutes ? t('hasta {time}', { time: minutesText(night.minutes) }) : t('Sin prisa'), (dir) => ((night.minutes = cycle(TIME_OPTIONS, night.minutes, dir)), keep()), { id: 'q-tiempo' }),
          matches.length
            ? item(t('¡Que elija la DisketeBoy! ({n})', { n: matches.length }), () => go('ruleta', { ids: matches.map((g) => g.id) }), { cls: 'primary', id: 'q-ruleta' })
            : p(t('Nada encaja esta noche… ¿Más tiempo, menos gente o un juego nuevo?')),
          matches.slice(0, 15).map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: boardMeta(g), cls: 'game' })),
        ),
      );
    },

    ruleta({ ids, pick }) {
      const games = (ids || []).map((x) => store.getGame(x)).filter(Boolean);
      if (pick && store.getGame(pick)) {
        const g = store.getGame(pick);
        return view(
          t('¡Esta noche toca…'),
          h('div', { class: 'big-pick', text: g.title }),
          p(`${playersText(g)} · ${minutesText(g.minutes)}${g.status === 'pendiente' ? t(' · ¡y por fin lo estrenáis!') : ''}`, 'sub'),
          h(
            'div',
            { class: 'list' },
            item(t('¡Sácalo de la Kallax!'), () => actions.showInRoom(g.id), { cls: 'primary', id: 'r-sacar' }),
            item(t('Otra vez'), () => {
              current.params = { ids };
              render(0);
            }, { id: 'r-otra' }),
            item(t('Volver'), back),
          ),
        );
      }
      const label = h('div', { class: 'big-pick rolling', text: '…' });
      const el = view(t('Girando la ruleta…'), label, p(t('Entre {n} juegos', { n: games.length }), 'sub'));
      setTimeout(() => spin(games, label), 0);
      return el;
    },

    prestamos() {
      const lent = store.getBoards().filter((g) => g.lentTo).sort((a, b) => (a.lentAt || '').localeCompare(b.lentAt || ''));
      return view(
        t('Préstamos'),
        p(lent.length ? t('Lo que no está en casa, y quién lo tiene:') : t('Todo está en casa. ¡Bien!')),
        h('div', { class: 'list' }, lent.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: lentText(g), cls: 'game' })), item(t('Volver'), back)),
      );
    },

    mesaStats() {
      const bs = boardStats(store.getBoards());
      return view(
        t('Estadísticas'),
        h('dl', { class: 'stats' }, statRow(t('Juegos de mesa'), String(bs.total)), statRow(t('Partidas'), String(bs.plays)), statRow(t('Sin estrenar'), String(bs.unplayed)), statRow(t('Prestados'), String(bs.lent.length))),
        bs.mostPlayed ? p(t('El más jugado: {title} ({n} partidas)', { title: bs.mostPlayed.title, n: bs.mostPlayed.plays })) : null,
        h('div', { class: 'list' }, item(t('Volver'), back)),
      );
    },

    // ------------------------------------------------ disquete de cartas
    cartas() {
      const items = store.getCards();
      const cs = cardsStats(items);
      const visit = store.visiting();
      return view(
        visit ? t('Sus cartas') : t('Cartas'),
        h(
          'div',
          { class: 'list' },
          !items.length && !visit ? item(t('Sin cartas: ¿cargo la demo?'), loadDemo, { cls: 'hint', id: 'demo-hint-cartas' }) : null,
          item(visit ? t('Sus mazos') : t('Mis mazos'), () => go('cartasLista', { kind: 'mazo' }), { meta: String(cs.decks), id: 'c-mazos' }),
          visit ? null : item(t('Nuevo mazo'), () => go('mazoNuevo'), { id: 'c-nuevo-mazo' }),
          item(visit ? t('Sus carpetas') : t('Mis carpetas'), () => go('cartasLista', { kind: 'carpeta' }), { meta: String(cs.binders), id: 'c-carpetas' }),
          visit ? null : item(t('Nueva carpeta'), () => go('carpetaNueva'), { id: 'c-nueva-carpeta' }),
          item(t('Ver los mazos en 3D'), () => actions.showZone('mazos'), { id: 'c-ver' }),
          item(t('Estadísticas'), () => go('cartasStats'), { id: 'c-stats' }),
          item(visit ? t('Cambiar de disquete') : t('Expulsar disquete'), ejectDisk, { id: 'm-expulsar' }),
          visit ? item(t('Crear mi propia habitación'), () => actions.leaveVisit(), { cls: 'primary', id: 'm-salir' }) : null,
        ),
      );
    },

    cartasLista({ kind = 'mazo' }) {
      const list = store.getCards().filter((g) => g.kind === kind).sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
      const meta = (g) => (kind === 'mazo' ? [tcg(g.tcg).short, g.format, recordText(g)] : [tcg(g.tcg).short, tp(g.cards, '1 carta', '{n} cartas', { n: num(g.cards) }), euros(g.value)]).filter(Boolean).join(' · ');
      return view(
        kind === 'mazo' ? t('Mazos') : t('Carpetas'),
        h(
          'div',
          { class: 'list' },
          list.length
            ? list.map((g) => item(g.title, () => go('ficha', { id: g.id }), { meta: meta(g), cls: 'game' }))
            : store.visiting()
              ? p(t('Nada por aquí.'))
              : item(kind === 'mazo' ? t('Aún no hay mazos. Crear uno') : t('Aún no hay carpetas. Crear una'), () => go(kind === 'mazo' ? 'mazoNuevo' : 'carpetaNueva')),
        ),
      );
    },

    mazoFicha({ id }) {
      const g = store.getGame(id);
      if (!g) return view(t('Mazo borrado'), p(t('Este mazo ya no está en tu colección.')), h('div', { class: 'list' }, item(t('Volver'), back)));
      const sub = p([t(tcg(g.tcg).name), g.format].filter(Boolean).join(' · '), 'sub');
      if (store.visiting()) {
        return view(
          g.title,
          sub,
          h('dl', { class: 'stats' }, statRow(t('Estado'), statusLabel(g)), statRow(t('Récord'), recordText(g)), statRow(t('Cartas'), String(deckCount(g.list)))),
          p(g.review ? `“${g.review}”` : t('Sin notas.'), 'note quote'),
          h('div', { class: 'list' }, item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'f-ver' }), item(t('Volver'), back)),
        );
      }
      const upd = (patch) => {
        store.updateGame(id, patch);
        sfx.save();
      };
      const format = h('input', { id: 'cf-formato', maxlength: '40', 'data-nav': '', placeholder: t('Commander, Estándar…'), autocomplete: 'off', value: g.format, onchange: (e) => upd({ format: e.target.value }) });
      return view(
        g.title,
        sub,
        p(recordText(g), 'note'),
        h(
          'div',
          { class: 'list' },
          item(t('¡He ganado!'), () => {
            store.logResult(id, true);
            sfx.select();
            toast(t('¡Victoria con {title}! {w}V · {l}D', { title: g.title, w: g.wins + 1, l: g.losses }));
          }, { cls: 'primary', id: 'cf-gane' }),
          item(t('He perdido'), () => {
            store.logResult(id, false);
            sfx.back();
            toast(t('Derrota apuntada. La próxima, mejor robo.'));
          }, { id: 'cf-perdi' }),
          stepper(t('Juego'), tcg(g.tcg).short, (dir) => upd({ tcg: cycle(TCG_IDS, g.tcg, dir) }), { id: 'cf-juego' }),
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: t('Formato') }), format),
          stepper(t('Estado'), t(DECK_STATUS_LABEL[g.status]), (dir) => upd({ status: cycle(DECK_STATUSES, g.status, dir) }), { id: 'cf-estado' }),
          stepper(t('Nota'), stars(g.score), (dir) => upd({ score: cycle(SCORES, g.score, dir) }), { id: 'cf-nota' }),
          item(t('Lista del mazo ({n} cartas)', { n: deckCount(g.list) }), () => go('listaMazo', { id }), { id: 'cf-lista' }),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : t('Escribir notas…'), () => go('resena', { id }), { meta: t('Notas'), cls: 'review', id: 'cf-notas' }),
          item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'cf-ver' }),
          item(t('Borrar mazo'), () => go('confirmar', { text: t('¿Borrar el mazo «{title}»?', { title: g.title }), yes: t('Sí, borrar'), action: 'borrar', id }), { cls: 'danger', id: 'cf-borrar' }),
        ),
      );
    },

    listaMazo({ id }) {
      const g = store.getGame(id);
      if (!g) return SCREENS.mazoFicha({ id });
      const counter = h('span', { class: 'counter', 'aria-live': 'polite', text: tp(deckCount(g.list), '1 carta', '{n} cartas') });
      const area = h('textarea', {
        id: 'lm-texto',
        rows: '8',
        maxlength: '6000',
        'data-nav': '',
        'aria-label': t('Lista del mazo {title}', { title: g.title }),
        placeholder: t('4 Rayo\n1 Sol Ring\n…'),
        oninput: (e) => (counter.textContent = tp(deckCount(e.target.value), '1 carta', '{n} cartas')),
      });
      area.value = g.list;
      return view(
        t('Lista del mazo'),
        p(g.title, 'sub'),
        area,
        counter,
        h(
          'div',
          { class: 'list' },
          item(t('Guardar lista'), () => {
            store.updateGame(id, { list: area.value });
            toast(t('Lista guardada: {n} cartas', { n: deckCount(area.value) }));
            back();
          }, { id: 'lm-guardar' }),
          item(t('Cancelar'), back),
        ),
      );
    },

    mazoNuevo() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form, { kind: 'mazo' })) },
        h('label', {}, t('Nombre del mazo'), h('input', { name: 'title', id: 'cn-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: t('Ej.: Rojo Burn') })),
        h('label', {}, t('Juego'), h('select', { name: 'tcg', id: 'cn-juego', 'data-nav': '' }, TCGS.map((x) => h('option', { value: x.id, text: t(x.name) })))),
        h('label', {}, t('Formato'), h('input', { name: 'format', id: 'cn-formato', maxlength: '40', 'data-nav': '', placeholder: t('Commander, Estándar…') })),
        h('label', {}, t('Estado'), h('select', { name: 'status', id: 'cn-estado', 'data-nav': '' }, DECK_STATUSES.map((st) => h('option', { value: st, text: t(DECK_STATUS_LABEL[st]) })))),
        h('button', { type: 'submit', class: 'item primary', id: 'cn-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: t('Crear mazo') })),
      );
      return view(t('Nuevo mazo'), form);
    },

    carpetaNueva() {
      const form = h(
        'form',
        { class: 'form', autocomplete: 'off', onsubmit: (e) => (e.preventDefault(), addFromForm(form, { kind: 'carpeta' })) },
        h('label', {}, t('Nombre de la carpeta'), h('input', { name: 'title', id: 'pn-titulo', required: true, maxlength: '120', 'data-nav': '', placeholder: t('Ej.: Mis brillis') })),
        h('label', {}, t('Juego'), h('select', { name: 'tcg', id: 'pn-juego', 'data-nav': '' }, TCGS.map((x) => h('option', { value: x.id, text: t(x.name) })))),
        h(
          'div',
          { class: 'row2' },
          h('label', {}, t('Cartas'), h('input', { name: 'cards', id: 'pn-cartas', type: 'number', min: '0', max: '1000000', value: '0', inputmode: 'numeric', 'data-nav': '' })),
          h('label', {}, t('Valor (€)'), h('input', { name: 'value', id: 'pn-valor', type: 'number', min: '0', step: '0.01', value: '0', inputmode: 'decimal', 'data-nav': '' })),
        ),
        h('label', {}, t('Estado'), h('select', { name: 'status', id: 'pn-estado', 'data-nav': '' }, BINDER_STATUSES.map((st) => h('option', { value: st, text: t(BINDER_STATUS_LABEL[st]) })))),
        h('button', { type: 'submit', class: 'item primary', id: 'pn-anadir', 'data-nav': '' }, h('span', { class: 'item-label', text: t('Crear carpeta') })),
      );
      return view(t('Nueva carpeta'), form);
    },

    carpetaFicha({ id }) {
      const g = store.getGame(id);
      if (!g) return view(t('Carpeta borrada'), p(t('Esta carpeta ya no está en tu colección.')), h('div', { class: 'list' }, item(t('Volver'), back)));
      const sub = p(`${t(tcg(g.tcg).name)} · ${tp(g.cards, '1 carta', '{n} cartas', { n: num(g.cards) })} · ${euros(g.value)}`, 'sub');
      if (store.visiting()) {
        return view(g.title, sub, h('dl', { class: 'stats' }, statRow(t('Estado'), statusLabel(g))), p(g.review ? `“${g.review}”` : t('Sin notas.'), 'note quote'), h('div', { class: 'list' }, item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'f-ver' }), item(t('Volver'), back)));
      }
      const upd = (patch) => {
        store.updateGame(id, patch);
        sfx.save();
      };
      const field = (idf, label, value, step, key) =>
        h('label', { class: 'item field' }, h('span', { class: 'item-label', text: label }), h('input', { type: 'number', id: idf, min: '0', step, value: String(value), inputmode: 'decimal', 'data-nav': '', onchange: (e) => upd({ [key]: e.target.value }) }));
      return view(
        g.title,
        sub,
        h(
          'div',
          { class: 'list' },
          stepper(t('Juego'), tcg(g.tcg).short, (dir) => upd({ tcg: cycle(TCG_IDS, g.tcg, dir) }), { id: 'pf-juego' }),
          stepper(t('Estado'), t(BINDER_STATUS_LABEL[g.status]), (dir) => upd({ status: cycle(BINDER_STATUSES, g.status, dir) }), { id: 'pf-estado' }),
          stepper(t('Nota'), stars(g.score), (dir) => upd({ score: cycle(SCORES, g.score, dir) }), { id: 'pf-nota' }),
          field('pf-cartas', t('Cartas'), g.cards, '1', 'cards'),
          field('pf-valor', t('Valor (€)'), g.value, '0.01', 'value'),
          item(g.review ? `“${g.review.slice(0, 70)}${g.review.length > 70 ? '…' : ''}”` : t('Escribir notas…'), () => go('resena', { id }), { meta: t('Notas'), cls: 'review', id: 'pf-notas' }),
          item(t('Ver en la habitación'), () => actions.showInRoom(id), { id: 'pf-ver' }),
          item(t('Borrar carpeta'), () => go('confirmar', { text: t('¿Borrar la carpeta «{title}»?', { title: g.title }), yes: t('Sí, borrar'), action: 'borrar', id }), { cls: 'danger', id: 'pf-borrar' }),
        ),
      );
    },

    cartasStats() {
      const cs = cardsStats(store.getCards());
      return view(
        t('Estadísticas'),
        h(
          'dl',
          { class: 'stats' },
          statRow(t('Mazos'), String(cs.decks)),
          statRow(t('Carpetas'), String(cs.binders)),
          statRow(t('Cartas en carpetas'), num(cs.cards)),
          statRow(t('Valor estimado'), euros(cs.value)),
          statRow(t('Récord total'), cs.winRate === null ? t('Sin partidas') : t('{w}V · {l}D ({pct}%)', { w: cs.wins, l: cs.losses, pct: cs.winRate })),
        ),
        cs.best ? p(t('Tu mejor mazo: {title} ({record})', { title: cs.best.title, record: recordText(cs.best) })) : null,
        h('div', { class: 'list' }, item(t('Volver'), back)),
      );
    },

    ajustes() {
      const s = store.getSettings();
      const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: (e) => restore(e.target.files?.[0]) });
      // Cambiar de idioma recarga la página: así todo (consola, habitación y portadas) sale en el nuevo
      const setLanguage = (dir) => {
        const lang = cycle(LANGS, getLang(), dir);
        if (!store.visiting()) store.setSettings({ lang });
        const url = new URL(location.href);
        url.searchParams.set('lang', lang);
        location.replace(url);
      };
      const looks = [
        stepper(t('Idioma'), LANG_NAME[getLang()], setLanguage, { id: 'a-idioma' }),
        stepper(t('Pantalla'), t(PALETTE_LABEL[s.palette]), (dir) => store.setSettings({ palette: cycle(PALETTES, s.palette, dir) }), { id: 'a-paleta' }),
        stepper(t('Sonido'), s.sound ? t('Sí') : t('No'), () => store.setSettings({ sound: !s.sound }), { id: 'a-sonido' }),
        stepper(t('Habitación'), t(THEME_LABEL[s.theme]), (dir) => store.setSettings({ theme: cycle(THEMES, s.theme, dir) }), { id: 'a-tema' }),
        stepper(t('Gato'), s.pet ? t('Sí, durmiendo') : t('No'), () => store.setSettings({ pet: !s.pet }), { id: 'a-gato' }),
      ];
      if (store.visiting()) return view(t('Ajustes'), h('div', { class: 'list' }, ...looks, item(t('Volver'), back)));
      const nameInput = h('input', {
        id: 'a-nombre',
        'data-nav': '',
        maxlength: '30',
        placeholder: t('Para tus visitas'),
        autocomplete: 'nickname',
        value: s.name,
        onchange: (e) => store.setSettings({ name: e.target.value }),
      });
      return view(
        t('Ajustes'),
        h(
          'div',
          { class: 'list' },
          h('label', { class: 'item field' }, h('span', { class: 'item-label', text: t('Tu nombre') }), nameInput),
          ...looks,
          stepper(t('Ordenar estantería'), t(SORT_LABEL[s.sort]), (dir) => store.setSettings({ sort: cycle(SORTS, s.sort, dir) }), { id: 'a-orden' }),
          item(t('Guardar copia de seguridad'), backup, { id: 'a-exportar' }),
          item(t('Cargar copia de seguridad'), () => file.click(), { id: 'a-importar' }),
          item(t('Cargar colección de demo'), loadDemo, { id: 'a-demo' }),
          item(t('Borrar toda la colección'), () => go('confirmar', { text: t('¿Borrar TODA tu colección? No se puede deshacer (guarda antes una copia).'), yes: t('Sí, borrarlo todo'), action: 'vaciar' }), { cls: 'danger', id: 'a-vaciar' }),
          item(t('Privacidad'), () => go('privacidad'), { id: 'a-privacidad' }),
          item(t('Créditos'), () => go('creditos'), { id: 'a-creditos' }),
        ),
        file,
      );
    },

    privacidad() {
      return view(
        t('Privacidad'),
        p(t('Tu colección se guarda solo en este navegador. No hay cuentas, ni cookies, ni anuncios.')),
        p(t('Steam: solo se lee la biblioteca que tu perfil ya enseña en público. Pasa por nuestro servidor para hablar con Steam y no se guarda.')),
        p(t('Las portadas se cargan desde Steam.')),
        p(t('El enlace de visita lleva tu colección dentro del propio enlace, detrás de la #, y nunca pasa por ningún servidor.')),
        p(t('Guarda de vez en cuando una copia de seguridad: si borras los datos del navegador, la colección se va con ellos.')),
        h('div', { class: 'list' }, item(t('Volver'), back)),
      );
    },

    creditos() {
      const donate = donateUrl();
      return view(
        t('Créditos'),
        p(t('DisketeBoy · prototipo hecho con cariño en España.')),
        p(t('Todo lo que ves está hecho con código: ni dibujos con IA ni assets ajenos. Las portadas de Steam son de sus autores.')),
        p(t('Es gratis y lo seguirá siendo. Gracias a quienes apoyan el proyecto: ¡aquí saldrá tu nombre!')),
        h(
          'div',
          { class: 'list' },
          donate
            ? h('a', { class: 'item', 'data-nav': '', id: 'a-donar', href: donate, target: '_blank', rel: 'noopener' }, h('span', { class: 'item-label', text: t('☕ Invítame a un café') }))
            : null,
          item(t('Volver'), back),
        ),
      );
    },

    confirmar({ text, yes, action, id }) {
      const run = () => {
        if (action === 'borrar') {
          const g = store.getGame(id);
          store.removeGame(id);
          toast(g ? t('«{title}» ya no está en tu colección', { title: g.title }) : t('Borrado'));
          history.pop();
          back();
        } else if (action === 'vaciar') {
          store.clearAll();
          toast(t('Colección vaciada'));
          home();
        }
      };
      return view(t('¿Seguro?'), p(text, 'big'), h('div', { class: 'list' }, item(t('No'), back, { id: 'c-no' }), item(yes || t('Sí'), run, { cls: 'danger', id: 'c-si' })));
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
    const { added } = store.importGames(demoCollection());
    toast(added ? t('Demo cargada: {n} juegos han caído en tu habitación', { n: added }) : t('La demo ya estaba cargada'));
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
    toast(t('Copia guardada en tus descargas'));
  }

  async function restore(file) {
    if (!file) return;
    try {
      const n = store.importBackup(await file.text());
      toast(t('Copia cargada: {n} juegos', { n }));
      home();
    } catch (err) {
      sfx.error();
      toast(err.message);
    }
  }

  function insertDisk(kind) {
    root.dataset.disk = kind;
    sfx.insert();
    screen.replaceChildren(h('div', { class: 'view boot' }, h('p', { class: 'boot-tip', text: t('Leyendo disquete…') }), h('div', { class: 'boot-bar' }, h('span'))));
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
    const target = e.target;
    const typing = target && target.matches?.('input, textarea, select');
    if (e.key === 'Escape') {
      e.preventDefault();
      if (typing && target.matches('textarea')) target.blur();
      back();
      return true;
    }
    if (!booted && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      root.dispatchEvent(new Event('dkb:press'));
      return true;
    }
    if (typing) {
      const nativeArrows = target.matches('textarea, select, input[type=number]');
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
