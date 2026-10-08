// Guía del huésped — arranque y enrutado (#/ tablón · #/s/<sección>).
//
// Parámetros de URL:
//   ?guide=granvia      guía a cargar
//   &g=Laura            nombre del huésped (saludo personalizado)
//   &in=2026-10-08&out=2026-10-11   fechas de la estancia (ticket, días de "Mi viaje")
//   &embed=1            sin barra superior (vista previa del panel)
import { t, loc, getLang, setLang, LANGS } from './i18n.js';
import { esc, icon, refreshIcons, params } from './util.js';
import { loadGuide, track } from './store.js';
import { SECTIONS, sectionById, renderSection, mountSection } from './sections.js';
import { renderBoard, mountBoard } from './board.js';
import { whatsappLink } from './mobility.js';
import { buildIndex, ask } from './faq.js';

const app = document.getElementById('app');
const topbar = document.querySelector('.topbar');
const btnLeft = document.getElementById('btn-left');
const btnLang = document.getElementById('btn-lang');

const guideId = params.get('guide') || 'granvia';
const guest = (params.get('g') || '').slice(0, 30);
const stay = (() => {
  const i = params.get('in');
  const o = params.get('out');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(i || '') || !/^\d{4}-\d{2}-\d{2}$/.test(o || '')) return null;
  const nights = Math.round((new Date(o) - new Date(i)) / 864e5);
  return nights > 0 && nights < 60 ? { in: i, out: o, nights } : null;
})();

if (params.get('embed')) document.body.classList.add('is-embed');

const state = {
  guide: null,
  boardCtl: null,
  boardScroll: 0,
  lastSection: null,
  ctx: { dest: 'home', day: -1 },
};

function readChecklist() {
  try { return JSON.parse(localStorage.getItem(`rh:checklist:${guideId}`) || '[]'); } catch { return []; }
}

function askFab() {
  return `<button class="ask-fab" data-ask type="button">
    <span class="ask-fab__icon">${icon('message-circle-question')}</span>
    <span><b>${t('askTitle')}</b><small>${t('askSub')}</small></span>
  </button>`;
}

/** Hoja "¿Tienes dudas?": busca en la guía y, si no hay respuesta, pasa a WhatsApp. */
function openAsk(prefill = '') {
  const g = state.guide;
  const index = buildIndex(g);
  const host = esc(g.host.name);
  document.querySelector('.ask-sheet')?.remove();
  const el = document.createElement('div');
  el.className = 'ask-sheet';
  el.innerHTML = `
    <div class="ask-sheet__backdrop" data-close></div>
    <div class="ask-sheet__note" role="dialog" aria-modal="true" aria-labelledby="ask-title">
      <span class="pin pin--azul"></span>
      <button class="ask-sheet__close icon-btn" data-close aria-label="${t('close')}">${icon('x')}</button>
      <h2 id="ask-title">${t('askTitle')}</h2>
      <p class="muted small">${t('askIntro', { name: host })}</p>
      <form class="ask-form"><input name="q" placeholder="${t('askPlaceholder')}" autocomplete="off" enterkeyhint="search" value="${esc(prefill)}">
        <button class="btn btn--primary" aria-label="${t('askTitle')}">${icon('search')}</button></form>
      <div class="chips ask-suggest">${t('askSuggest').map((q) => `<button class="chip" type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
      <div class="ask-answers" aria-live="polite"></div>
    </div>`;
  document.body.append(el);
  const input = el.querySelector('input');
  const out = el.querySelector('.ask-answers');
  let lastTracked = '';

  const answer = (q, doTrack) => {
    const hits = ask(index, q);
    const wa = whatsappLink(g.host.whatsapp, `Hola ${g.host.name}, una pregunta: ${q}`);
    if (doTrack && q.trim() && q !== lastTracked) { lastTracked = q; track(g.id, 'ask', { q: q.trim(), answered: hits.length > 0 }); }
    if (!q.trim()) { out.innerHTML = ''; return; }
    out.innerHTML = hits.length
      ? hits.map((h, i) => `<article class="answer" style="--i:${i}">
          <h3>${esc(h.title)}</h3><p>${esc(h.text)}</p>
          <a href="#/s/${h.section}" data-close>${t('askOpen')} →</a></article>`).join('')
        + `<a class="ask-still" href="${wa}" target="_blank" rel="noopener" data-track="contact">${t('askStill', { name: host })}</a>`
      : `<div class="answer answer--none"><p>${t('askNoAnswer', { name: host })}</p>
          <a class="btn btn--verde btn--block" href="${wa}" target="_blank" rel="noopener" data-track="contact">${icon('message-circle')}${t('askWrite', { name: host })}</a></div>`;
    refreshIcons();
  };

  let timer;
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(() => answer(input.value, false), 200); });
  el.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); answer(input.value, true); input.blur(); });
  el.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-q]');
    if (chip) { input.value = chip.dataset.q; answer(chip.dataset.q, true); return; }
    if (e.target.closest('[data-track="contact"]')) track(g.id, 'contact');
    if (e.target.closest('[data-close]')) close();
  });
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  function close() {
    if (input.value.trim()) answer(input.value, true);
    document.removeEventListener('keydown', onKey);
    el.classList.add('is-closing');
    setTimeout(() => el.remove(), 250);
  }
  requestAnimationFrame(() => el.classList.add('is-open'));
  if (prefill) answer(prefill, false);
  refreshIcons();
  setTimeout(() => input.focus({ preventScroll: true }), 300);
}

function showBoard() {
  const g = state.guide;
  state.boardCtl?.destroy();
  app.innerHTML = renderBoard(g, { guest, stay }) + askFab();
  state.boardCtl = mountBoard(app, g, {
    onOpen: (id) => { location.hash = `#/s/${id}`; },
    lastSection: () => state.lastSection,
    stay,
  });
  setLeftButton('zoom-out');
  requestAnimationFrame(() => scrollTo({ top: state.boardScroll }));
  refreshIcons();
}

function showSection(id, extra = {}) {
  const g = state.guide;
  const meta = sectionById(id);
  if (!meta) { location.hash = '#/'; return; }
  if (state.lastSection !== id) track(g.id, 'section', id);
  state.lastSection = id;
  Object.assign(state.ctx, extra);
  state.boardCtl?.destroy();
  state.boardCtl = null;

  const idx = SECTIONS.findIndex((s) => s.id === id);
  const next = SECTIONS[(idx + 1) % SECTIONS.length];
  const ctx = {
    ...state.ctx,
    nights: stay?.nights || 3,
    outDate: stay?.out,
    checklist: readChecklist(),
    rerender: (patch) => showSection(id, patch),
    onTripChange: () => {},
  };

  app.innerHTML = `
    <section class="detail" aria-labelledby="sheet-title">
      <article class="sheet" style="--note:var(--note-${meta.note})">
        <span class="pin pin--${meta.pin}"></span>
        <header class="sheet__head">
          <a class="sheet__nav" href="#/" aria-label="${t('back')}">${icon('chevron-left')}</a>
          <h1 class="sheet__title" id="sheet-title" tabindex="-1">${icon(meta.icon)}<span>${t(`sec.${id}`)}</span></h1>
          <a class="sheet__nav" href="#/s/${next.id}" aria-label="${t(`sec.${next.id}`)}">${icon('chevron-right')}</a>
        </header>
        <div class="sheet__body">${renderSection(id, g, ctx)}</div>
      </article>
    </section>
    ${id !== 'contact' ? askFab() : ''}`;
  mountSection(id, g, ctx, app);
  setLeftButton('layout-dashboard');
  refreshIcons();
  if (!extra || !Object.keys(extra).length) {
    scrollTo({ top: 0 });
    // Lectores de pantalla: anuncia la sección recién abierta.
    app.querySelector('#sheet-title')?.focus({ preventScroll: true });
  }
}

function setLeftButton(name) {
  btnLeft.innerHTML = icon(name);
  btnLeft.dataset.mode = name;
  btnLeft.setAttribute('aria-label', name === 'layout-dashboard' ? t('back') : t('overviewHint'));
  refreshIcons();
}

function route() {
  const m = location.hash.match(/^#\/s\/([\w-]+)/);
  if (m) {
    showSection(m[1]);
  } else {
    showBoard();
  }
}

btnLeft.addEventListener('click', () => {
  if (btnLeft.dataset.mode === 'layout-dashboard') location.hash = '#/';
  else state.boardCtl?.toggleOverview();
});

btnLang.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = document.querySelector('.lang-menu');
  if (open) { open.remove(); return; }
  const menu = document.createElement('div');
  menu.className = 'lang-menu';
  menu.setAttribute('role', 'menu');
  menu.innerHTML = LANGS.map((l) => `<button role="menuitemradio" aria-checked="${l.code === getLang()}" data-lang="${l.code}">
    <span>${l.flag}</span>${l.label}</button>`).join('');
  topbar.append(menu);
  menu.querySelector('[aria-checked="true"]')?.focus();
  menu.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-lang]');
    if (!b) return;
    setLang(b.dataset.lang);
    btnLang.textContent = getLang().toUpperCase();
    menu.remove();
    route();
  });
  setTimeout(() => addEventListener('click', () => menu.remove(), { once: true }));
});

app.addEventListener('click', (e) => { if (e.target.closest('[data-ask]')) openAsk(); });
app.addEventListener('overview', (e) => setLeftButton(e.detail ? 'zoom-in' : 'zoom-out'));
addEventListener('hashchange', () => route());
// Guarda el scroll del tablón para volver al mismo sitio.
addEventListener('scroll', () => { if (state.boardCtl) state.boardScroll = scrollY; }, { passive: true });

async function boot() {
  setLang(getLang());
  btnLang.textContent = getLang().toUpperCase();
  try {
    state.guide = await loadGuide(guideId);
  } catch (err) {
    app.innerHTML = `<div class="detail"><article class="sheet"><div class="sheet__body"><h1 class="hand">Ups…</h1><p>${esc(err.message)}</p></div></article></div>`;
    return;
  }
  document.title = `${loc(state.guide.property.name)} · retorika Home`;
  track(guideId, 'open');
  route();

  // Avisa al panel (vista previa) de cambios de tamaño, etc.
  addEventListener('message', (e) => {
    if (e.data?.type === 'rh:reload') location.reload();
  });
}

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

topbar && boot();
