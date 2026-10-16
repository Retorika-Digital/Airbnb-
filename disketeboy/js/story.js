// «Mi resumen»: tarjetas animadas a pantalla completa, como las historias de las redes,
// y una imagen vertical de 1080×1920 lista para compartir.
import { t, tp, num } from './i18n.js';
import { buildSummary } from './resumen.js';
import { platform } from './platforms.js';
import { h } from './device.js';
import { sfx } from './audio.js';
import { confetti } from './fx.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const SLIDE_MS = 5200;

/** Un número que sube contando hasta su valor. */
function countUp(el, value, ms = 900) {
  if (REDUCED || !value) {
    el.textContent = num(value);
    return;
  }
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    el.textContent = num(Math.round(value * (1 - (1 - k) ** 3)));
    if (k < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const big = (value, label) => {
  const n = h('b', { class: 'story-num', 'data-value': String(value), text: '0' });
  return h('div', { class: 'story-stat' }, n, h('span', { text: label }));
};

function slides(s, name) {
  const out = [];
  out.push({
    color: 'rojo',
    body: [
      h('p', { class: 'story-kicker', text: name ? t('El resumen de {name}', { name }) : t('Tu resumen') }),
      h('h2', { class: 'story-title', text: t('Tu colección en DisketeBoy') }),
      big(s.total, tp(s.total, 'cosa en tu colección', 'cosas en tu colección')),
      h('p', { class: 'story-line', text: [s.video && tp(s.video, '1 videojuego', '{n} videojuegos'), s.boards && tp(s.boards, '1 juego de mesa', '{n} juegos de mesa'), s.decks + s.binders && t('{n} mazos y carpetas', { n: s.decks + s.binders })].filter(Boolean).join(' · ') }),
    ],
  });
  if (s.video) {
    out.push({
      color: 'azul',
      body: [
        h('p', { class: 'story-kicker', text: t('Videojuegos') }),
        big(s.hours, t('horas jugadas')),
        s.mostHours ? h('p', { class: 'story-line', text: t('Le has dado {hours} h a {title}.', { hours: num(Math.round(s.mostHours.hours)), title: s.mostHours.title }) }) : null,
        s.topPlatform ? h('p', { class: 'story-line small', text: t('Tu plataforma: {name} ({n} juegos)', { name: t(platform(s.topPlatform.id).name), n: s.topPlatform.count }) }) : null,
        s.playing.length ? h('p', { class: 'story-line small', text: t('Ahora mismo: {list}', { list: s.playing.join(' · ') }) }) : null,
      ],
    });
    out.push({
      color: 'mostaza',
      body: [
        h('p', { class: 'story-kicker', text: t('La pila de la vergüenza') }),
        h('div', { class: 'story-emoji wobble', text: s.backlog ? '🗻' : '🧹' }),
        big(s.backlog, s.backlog ? t('juegos sin empezar') : t('pila a cero, ¡enhorabuena!')),
        s.backlog ? h('p', { class: 'story-line small', text: t('A un juego al mes, tardarías {n} meses. Sin prisa.', { n: num(s.backlog) }) }) : null,
        h('p', { class: 'story-line small', text: tp(s.beaten, 'Y 1 terminado, con sus créditos finales.', 'Y {n} terminados, con sus créditos finales.') }),
      ],
    });
  }
  if (s.podium.length) {
    out.push({
      color: 'verde',
      body: [
        h('p', { class: 'story-kicker', text: t('Tu podio') }),
        h(
          'ol',
          { class: 'story-podium' },
          s.podium.map((g, i) => h('li', { style: `--i:${i}` }, h('span', { class: 'medal', text: ['🥇', '🥈', '🥉'][i] }), h('span', { class: 'name', text: g.title }), h('span', { class: 'score', text: `★ ${g.score}` }))),
        ),
      ],
    });
  }
  if (s.boards || s.decks || s.binders) {
    out.push({
      color: 'morado',
      body: [
        h('p', { class: 'story-kicker', text: t('Mesa y cartas') }),
        s.boards ? big(s.plays, t('partidas apuntadas')) : null,
        s.mostPlayed ? h('p', { class: 'story-line', text: t('El más jugado: {title} ({n} partidas)', { title: s.mostPlayed.title, n: s.mostPlayed.plays }) }) : null,
        s.bestDeck ? h('p', { class: 'story-line small', text: t('Tu mejor mazo: {title} ({w}V · {l}D)', { title: s.bestDeck.title, w: s.bestDeck.wins, l: s.bestDeck.losses }) }) : null,
        s.cards ? h('p', { class: 'story-line small', text: tp(s.cards, '1 carta en carpetas', '{n} cartas en carpetas', { n: num(s.cards) }) }) : null,
      ],
    });
  }
  out.push({
    color: 'crema',
    final: true,
    body: [
      h('p', { class: 'story-kicker', text: t('Tu personalidad') }),
      h('div', { class: 'story-emoji pop', text: s.persona.icon }),
      h('h2', { class: 'story-title', text: t(s.persona.title) }),
      h('p', { class: 'story-line', text: t(s.persona.text) }),
    ],
  });
  return out;
}

/** La imagen para compartir: 1080×1920, con lo mejor del resumen. */
export function renderStoryImage(s, name = '') {
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#2b2118');
  g.addColorStop(0.55, '#3a2730');
  g.addColorStop(1, '#1b2a3a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Rayas de colores de los disquetes
  ['#c8553d', '#3a6ea5', '#4f8a3b'].forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, 150 + i * 22, W, 14);
  });
  const PX = '"Press Start 2P", ui-monospace, monospace';
  const SANS = '"Trebuchet MS", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbf3e4';
  ctx.font = `64px ${PX}`;
  ctx.fillText('DisketeBoy', W / 2, 110);
  ctx.font = `600 40px ${SANS}`;
  ctx.fillStyle = '#d9cbb4';
  ctx.fillText(name ? t('El resumen de {name}', { name }) : t('Tu resumen'), W / 2, 300);
  // Personalidad
  ctx.font = '220px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.fillText(s.persona.icon, W / 2, 560);
  ctx.fillStyle = '#f2c14e';
  ctx.font = `44px ${PX}`;
  fitText(ctx, t(s.persona.title), W / 2, 680, W - 120, 44, PX);
  ctx.fillStyle = '#fbf3e4';
  ctx.font = `500 36px ${SANS}`;
  wrapText(ctx, t(s.persona.text), W / 2, 760, W - 200, 48);
  // Cifras
  const stats = [
    [num(s.total), tp(s.total, 'cosa en tu colección', 'cosas en tu colección')],
    s.video ? [num(s.hours), t('horas jugadas')] : null,
    s.video ? [num(s.backlog), t('en la pila de la vergüenza')] : null,
    s.boards ? [num(s.plays), t('partidas apuntadas')] : null,
  ].filter(Boolean);
  stats.forEach(([value, label], i) => {
    const y = 960 + i * 150;
    ctx.fillStyle = '#ffffff14';
    roundRect(ctx, 120, y - 90, W - 240, 128, 28);
    ctx.fillStyle = '#fbf3e4';
    ctx.font = `48px ${PX}`;
    ctx.textAlign = 'left';
    ctx.fillText(value, 170, y);
    ctx.font = `600 34px ${SANS}`;
    ctx.fillStyle = '#d9cbb4';
    ctx.textAlign = 'right';
    fitText(ctx, label, W - 170, y - 6, 480, 34, SANS, '600');
    ctx.textAlign = 'center';
  });
  // Podio
  let y = 960 + stats.length * 150 + 30;
  if (s.podium.length) {
    ctx.fillStyle = '#f2c14e';
    ctx.font = `30px ${PX}`;
    ctx.fillText(t('Tu podio'), W / 2, y);
    ctx.font = `600 38px ${SANS}`;
    ctx.fillStyle = '#fbf3e4';
    s.podium.forEach((p, i) => fitText(ctx, `${['🥇', '🥈', '🥉'][i]} ${p.title} · ★${p.score}`, W / 2, y + 70 + i * 62, W - 200, 38, SANS, '600'));
  }
  ctx.fillStyle = '#c8553d';
  ctx.fillRect(0, H - 120, W, 120);
  ctx.fillStyle = '#fbf3e4';
  ctx.font = `600 34px ${SANS}`;
  ctx.fillText(t('disketeboy · tu colección en tu habitación'), W / 2, H - 48);
  return c;
}

function roundRect(ctx, x, y, w, hgt, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, hgt, r);
  ctx.fill();
}

function fitText(ctx, text, x, y, max, size, family, weight = '') {
  let s = size;
  do ctx.font = `${weight} ${s}px ${family}`.trim();
  while (ctx.measureText(text).width > max && --s > 14);
  ctx.fillText(text, x, y);
}

function wrapText(ctx, text, x, y, max, line) {
  const words = String(text).split(/\s+/);
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > max && cur) {
      ctx.fillText(cur, x, y);
      y += line;
      cur = w;
    } else cur = next;
  }
  if (cur) ctx.fillText(cur, x, y);
}

/** Abre el resumen. Devuelve una función para cerrarlo. */
export function openStory(games, { name = '', onClose = () => {}, onShare } = {}) {
  const s = buildSummary(games);
  const list = slides(s, name);
  let index = 0;
  let timer = 0;
  const bars = list.map(() => h('i', {}, h('b')));
  const stage = h('div', { class: 'story-stage' });
  const close = () => {
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey, true);
    root.classList.add('is-leaving');
    setTimeout(() => root.remove(), REDUCED ? 0 : 260);
    onClose();
  };
  const actions = h(
    'div',
    { class: 'story-actions' },
    h('button', { type: 'button', class: 'chip chip-main', id: 'story-guardar', onclick: (e) => (e.stopPropagation(), onShare?.(renderStoryImage(s, name))) }, t('📤 Compartir mi resumen')),
    h('button', { type: 'button', class: 'chip', id: 'story-cerrar', onclick: (e) => (e.stopPropagation(), close()) }, t('Cerrar')),
  );
  const root = h(
    'div',
    { class: 'story', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('Mi resumen') },
    h('div', { class: 'story-bars', 'aria-hidden': 'true' }, bars),
    h('button', { type: 'button', class: 'story-x', 'aria-label': t('Cerrar'), onclick: (e) => (e.stopPropagation(), close()) }, '✕'),
    stage,
    h('button', { type: 'button', class: 'story-prev', 'aria-label': t('Anterior'), onclick: (e) => (e.stopPropagation(), go(index - 1)) }),
    h('button', { type: 'button', class: 'story-next', 'aria-label': t('Siguiente'), onclick: (e) => (e.stopPropagation(), go(index + 1)) }),
  );
  function go(i) {
    if (i < 0) i = 0;
    if (i >= list.length) return close();
    index = i;
    const slide = list[i];
    const card = h('div', { class: `story-card story-${slide.color}` }, slide.body, slide.final ? actions : null);
    stage.replaceChildren(card);
    root.classList.toggle('is-final', !!slide.final);
    bars.forEach((b, k) => b.classList.toggle('done', k < i));
    bars.forEach((b, k) => b.classList.toggle('now', k === i));
    for (const n of card.querySelectorAll('.story-num')) countUp(n, Number(n.dataset.value));
    clearTimeout(timer);
    if (slide.final) {
      sfx.fanfare();
      const r = root.getBoundingClientRect();
      confetti({ x: r.width / 2, y: r.height * 0.32, count: 120 });
      actions.querySelector('button')?.focus();
    } else {
      sfx.select();
      if (!REDUCED) timer = setTimeout(() => go(index + 1), SLIDE_MS);
    }
  }
  function onKey(e) {
    if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), close());
    else if (e.key === 'ArrowRight' || e.key === ' ') (e.preventDefault(), e.stopPropagation(), go(index + 1));
    else if (e.key === 'ArrowLeft') (e.preventDefault(), e.stopPropagation(), go(index - 1));
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(root);
  go(0);
  return close;
}
