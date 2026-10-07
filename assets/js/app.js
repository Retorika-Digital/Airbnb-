// Guía del huésped — arranque y enrutado (#/ tablón · #/s/<sección>).
//
// Parámetros de URL:
//   ?guide=granvia      guía a cargar
//   &g=Laura            nombre del huésped (saludo personalizado)
//   &in=2026-10-08&out=2026-10-11   fechas de la estancia (ticket, días de "Mi viaje")
//   &embed=1            sin barra superior (vista previa del panel)
import { t, loc, getLang, setLang } from './i18n.js';
import { esc, icon, refreshIcons, params } from './util.js';
import { loadGuide, track } from './store.js';
import { SECTIONS, sectionById, renderSection, mountSection } from './sections.js';
import { renderBoard, mountBoard } from './board.js';
import { whatsappLink } from './mobility.js';

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

function askFab(g) {
  return `<a class="ask-fab" data-track="contact" href="${whatsappLink(g.host.whatsapp, `Hola ${g.host.name}! `)}" target="_blank" rel="noopener">
    <span class="ask-fab__icon">${icon('message-circle')}</span>
    <span><b>${t('askTitle')}</b><small>${t('askSub')}</small></span>
  </a>`;
}

function showBoard() {
  const g = state.guide;
  state.boardCtl?.destroy();
  app.innerHTML = renderBoard(g, { guest, stay }) + askFab(g);
  state.boardCtl = mountBoard(app, g, {
    onOpen: (id) => { location.hash = `#/s/${id}`; },
    lastSection: () => state.lastSection,
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
          <h1 class="sheet__title" id="sheet-title">${icon(meta.icon)}<span>${t(`sec.${id}`)}</span></h1>
          <a class="sheet__nav" href="#/s/${next.id}" aria-label="${t(`sec.${next.id}`)}">${icon('chevron-right')}</a>
        </header>
        <div class="sheet__body">${renderSection(id, g, ctx)}</div>
      </article>
    </section>
    ${id !== 'contact' ? askFab(g) : ''}`;
  mountSection(id, g, ctx, app);
  setLeftButton('layout-dashboard');
  refreshIcons();
  if (!extra || !Object.keys(extra).length) scrollTo({ top: 0 });
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

btnLang.addEventListener('click', () => {
  setLang(getLang() === 'es' ? 'en' : 'es');
  btnLang.textContent = getLang().toUpperCase();
  route();
});

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
