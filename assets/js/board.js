// El tablón de corcho: notas, polaroid, ticket de la estancia, postal del
// tiempo, el camino punteado que las une, la vista general (zoom out) y la
// animación de "levantar la nota" al abrir una sección.
import { t, loc, locale } from './i18n.js';
import { esc, icon, photo, scatter, refreshIcons, params } from './util.js';
import { SECTIONS, hintFor, withDistance, openPlace } from './sections.js';
import { nowTip, isNight } from './now.js';
import { getWeather, weatherInfo } from './places.js';
import { getTrip } from './store.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function fmtDate(iso) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
}

/** Texto de cuenta atrás según la fecha de hoy y la estancia. */
export function countdown(stay, g, now = new Date()) {
  const day = (iso) => new Date(`${iso}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const toIn = Math.round((day(stay.in) - today) / 864e5);
  const toOut = Math.round((day(stay.out) - today) / 864e5);
  if (toIn > 1) return t('cd.before', { n: toIn });
  if (toIn === 1) return t('cd.tomorrow');
  if (toIn === 0) return t('cd.today', { t: g.checkin?.from || '' });
  if (toOut > 0) return t('cd.during', { n: -toIn + 1, total: stay.nights });
  if (toOut === 0) return t('cd.out', { t: g.checkin?.checkoutBy || '' });
  return t('cd.after');
}

export function renderBoard(g, { guest, stay }) {
  const city = g.property.city || '';
  let i = 0;
  const sectionNote = (s) => {
    const idx = i++;
    const badge = s.id === 'trip' ? getTrip(g.id).items.length : 0;
    return `<a class="note note--${s.note}${s.danger ? ' note--danger' : ''}" href="#/s/${s.id}" data-section="${s.id}"
        style="${scatter(idx + 2)}"${s.id === 'trip' ? ' data-trip-target' : ''}>
      <span class="pin pin--${s.pin}"></span>
      ${badge ? `<span class="note__badge">${badge}</span>` : ''}
      ${icon(s.icon)}
      <span class="note__title">${t(`sec.${s.id}`)}</span>
      <span class="note__hint">${hintFor(s.id, g)}</span>
    </a>`;
  };
  const S = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));

  const ticket = stay
    ? `<div class="ticket" style="${scatter(8)}">
        <div class="ticket__label">${esc(g.property.name)}</div>
        <div class="ticket__big">${fmtDate(stay.in)} → ${fmtDate(stay.out)}</div>
        <div class="ticket__row">${icon('moon')} ${t('stayNights', { n: stay.nights })}</div>
        ${countdown(stay, g) ? `<span class="ticket__count">${countdown(stay, g)}</span>` : ''}
      </div>`
    : `<div class="ticket" style="${scatter(8)}">
        <div class="ticket__label">${t('checkin')} · ${t('checkout')}</div>
        <div class="ticket__big">${esc(g.checkin?.from || '')} → ${esc(g.checkin?.checkoutBy || '')}</div>
        <div class="ticket__row">${icon('map-pin')} ${esc(g.property.address)}</div>
      </div>`;

  return `
  <div class="board-viewport" id="board-vp">
    ${nightMode() ? lights() : ''}
    <div class="board" id="board">
      <svg class="board__thread" aria-hidden="true"><path d=""/></svg>

      <div class="note note--amarillo note--welcome" style="${scatter(0)};--r:-1.2deg">
        <span class="pin pin--fucsia"></span>
        <h1>${guest ? t('welcomeHi', { name: esc(guest) }) : t('welcomeAll', { city: esc(city) })} 👋</h1>
        <p>${t('welcomeSub', { city: esc(city) })} <span style="color:var(--fucsia)">♡</span></p>
        <span class="note__stay">${icon('sparkles')}${esc(loc(g.property.tagline) || g.property.name)}</span>
      </div>

      ${nowNote(g, stay)}

      <figure class="polaroid" style="${scatter(1)};--r:3deg">
        <span class="tape"></span>
        ${photo(g.property.photos?.[0], g.property.name, '', '🏠')}
        <figcaption>${esc(g.property.name)}</figcaption>
      </figure>

      ${sectionNote(S.house)}
      ${sectionNote(S.wifi)}
      ${sectionNote(S.checkin)}
      ${sectionNote(S.nearby)}
      ${sectionNote(S.eat)}
      ${sectionNote(S.do)}
      ${sectionNote(S.move)}
      ${ticket}
      <div class="postcard" id="weather" style="${scatter(9)}">
        <span class="postcard__stamp">${icon('sun')}</span>
        <div class="ticket__label">${t('weather', { city: esc(city) })}</div>
        <div class="postcard__temp">—</div>
        <div class="postcard__desc">&nbsp;</div>
      </div>
      ${sectionNote(S.emergency)}
      ${sectionNote(S.contact)}
      ${sectionNote(S.trip)}

      <div class="label-tape">${t('enjoy')} <span class="heart">♡</span></div>
    </div>
  </div>
  <div class="overview-hint">${icon('hand')} ${t('overviewHint')}</div>`;
}

/** Hora "virtual" (?time=21 para probar) y la nota de "Ahora mismo". */
function clock() {
  const now = new Date();
  const forced = Number(params.get('time'));
  if (params.get('time') && forced >= 0 && forced < 24) now.setHours(forced, 0, 0, 0);
  return now;
}

function guideWithDistances(g) {
  const map = (arr) => (arr || []).map((p) => withDistance(g, p));
  return { ...g, recommendations: { eat: map(g.recommendations?.eat), do: map(g.recommendations?.do) } };
}

function nowNote(g, stay, rain = false) {
  const tip = nowTip(guideWithDistances(g), { now: clock(), rain, stay });
  return `<button class="note note--now" data-now='${esc(JSON.stringify(tip.action))}' style="${scatter(1)};--r:.8deg">
    <span class="pin pin--verde"></span>
    <span class="note--now__icon">${icon(tip.icon)}</span>
    <span class="note--now__body">
      <span class="note--now__label">${t('rightNow')}</span>
      <span class="note__title">${esc(tip.title)}</span>
      <span class="note__hint">${esc(tip.text)}</span>
    </span>
  </button>`;
}

export const nightMode = () => isNight(clock(), params.get('night'));

function lights() {
  const n = 16;
  const colors = ['#ffd45c', '#ff7a9c', '#7fd4ff', '#9dffb5'];
  const bulbs = Array.from({ length: n }, (_, i) => {
    const x = (i + 0.5) / n * 100;
    const y = 10 + Math.sin((x / 100) * Math.PI * 3) * 8 + 8;
    return `<span class="bulb" style="left:${x}%;top:${y}px;--c:${colors[i % 4]};--d:${(i * 0.37) % 2}s"></span>`;
  }).join('');
  const path = Array.from({ length: 61 }, (_, i) => {
    const x = i / 60 * 100;
    return `${i ? 'L' : 'M'}${x},${10 + Math.sin((x / 100) * Math.PI * 3) * 8 + 4}`;
  }).join(' ');
  return `<div class="lights" aria-hidden="true"><svg viewBox="0 0 100 40" preserveAspectRatio="none"><path d="${path}"/></svg>${bulbs}</div>`;
}

/** Curva suave (Catmull-Rom → Bézier) que pasa por todos los puntos. */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function drawThread(board) {
  const notes = [...board.querySelectorAll('.note[data-section]')];
  // offsetLeft/Top ignoran los transform → no les afecta la animación de entrada.
  const pts = notes.map((n) => [n.offsetLeft + n.offsetWidth / 2, n.offsetTop + n.offsetHeight / 2]);
  board.querySelector('.board__thread path').setAttribute('d', smoothPath(pts));
}

function noteColor(note) {
  return getComputedStyle(note).getPropertyValue('--note').trim() || '#fffdf7';
}

/** Levanta la nota y la expande hasta convertirse en la hoja de detalle. */
export async function liftAndOpen(note, navigate) {
  if (reduceMotion() || !note.animate) { navigate(); return; }
  note.classList.add('is-lifting');
  await wait(200);
  const r = note.getBoundingClientRect();
  const top = (document.querySelector('.topbar')?.offsetHeight || 60) + 22;
  const width = Math.min(640, innerWidth - 24);
  const ghost = document.createElement('div');
  ghost.className = 'flip-ghost';
  ghost.style.setProperty('--note', noteColor(note));
  Object.assign(ghost.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  document.body.append(ghost);
  const anim = ghost.animate([
    { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, transform: 'rotate(-2deg)' },
    { left: `${(innerWidth - width) / 2}px`, top: `${top}px`, width: `${width}px`, height: `${innerHeight - top - 16}px`, transform: 'rotate(0deg)' },
  ], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  await anim.finished;
  navigate();
  await wait(60);
  ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }).onfinish = () => ghost.remove();
}

export function mountBoard(root, g, { onOpen, lastSection, stay: stayRef = null }) {
  const vp = root.querySelector('#board-vp');
  const board = root.querySelector('#board');
  refreshIcons();

  drawThread(board);
  const ro = new ResizeObserver(() => drawThread(board));
  ro.observe(board);

  document.body.classList.toggle('is-night', nightMode());

  // Abrir sección con animación
  board.addEventListener('click', async (e) => {
    const nowBtn = e.target.closest('[data-now]');
    if (nowBtn) {
      const a = JSON.parse(nowBtn.dataset.now);
      if (a.place) openPlace(g, { ...a.place, kind: a.kind, catLabel: loc(a.place.category) });
      else if (a.section) liftAndOpen(nowBtn, () => onOpen(a.section));
      return;
    }
    const note = e.target.closest('.note[data-section]');
    if (!note) return;
    e.preventDefault();
    const id = note.dataset.section;
    if (vp.classList.contains('is-overview')) {
      exitOverview();
      await wait(550);
      note.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
      await wait(450);
    }
    liftAndOpen(note, () => onOpen(id));
  });

  // Vista general (zoom out) ------------------------------------------------
  let here;
  function enterOverview() {
    if (vp.classList.contains('is-overview')) return;
    const bar = document.querySelector('.topbar')?.offsetHeight || 0;
    const avail = innerHeight - bar - 40;
    const s = Math.min(1, avail / board.offsetHeight, (innerWidth - 20) / board.offsetWidth);
    scrollTo({ top: 0 });
    vp.style.height = `${avail + 30}px`;
    board.style.transform = `scale(${s})`;
    vp.classList.add('is-overview');
    document.body.classList.add('is-overview');
    const target = board.querySelector(`[data-section="${lastSection()}"]`) || board.querySelector('.note--welcome');
    here = document.createElement('div');
    here.className = 'you-are-here';
    here.textContent = `${t('youAreHere')} ↓`;
    here.style.left = `${target.offsetLeft}px`;
    here.style.top = `${target.offsetTop - 44}px`;
    board.append(here);
    root.dispatchEvent(new CustomEvent('overview', { detail: true }));
  }
  function exitOverview() {
    if (!vp.classList.contains('is-overview')) return;
    board.style.transform = '';
    vp.style.height = '';
    vp.classList.remove('is-overview');
    document.body.classList.remove('is-overview');
    here?.remove();
    root.dispatchEvent(new CustomEvent('overview', { detail: false }));
  }
  const toggleOverview = () => (vp.classList.contains('is-overview') ? exitOverview() : enterOverview());

  // Pellizcar para alejar / acercar
  let startDist = 0;
  const dist = (ts) => Math.hypot(ts[0].clientX - ts[1].clientX, ts[0].clientY - ts[1].clientY);
  vp.addEventListener('touchstart', (e) => { if (e.touches.length === 2) startDist = dist(e.touches); }, { passive: true });
  vp.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 2 || !startDist) return;
    const ratio = dist(e.touches) / startDist;
    if (ratio < 0.8) { enterOverview(); startDist = 0; }
    else if (ratio > 1.25) { exitOverview(); startDist = 0; }
  }, { passive: true });

  // Pista de primera visita: cómo alejar el tablón.
  let hinted = true;
  try { hinted = !!localStorage.getItem('rh:hinted'); } catch { /* ignore */ }
  if (!hinted) {
    const hint = document.createElement('div');
    hint.className = 'first-hint';
    hint.textContent = t('firstHint');
    hint.setAttribute('role', 'status');
    (document.querySelector('main') || document.body).append(hint);
    const dismiss = () => {
      hint.classList.add('is-gone');
      setTimeout(() => hint.remove(), 300);
      try { localStorage.setItem('rh:hinted', '1'); } catch { /* ignore */ }
      removeEventListener('pointerdown', dismiss);
    };
    addEventListener('pointerdown', dismiss);
    setTimeout(dismiss, 9000);
  }

  // Tiempo en la postal
  getWeather(g.property.lat, g.property.lng).then((wx) => {
    const card = root.querySelector('#weather');
    if (!wx || !card) return;
    const [ic, desc] = weatherInfo(wx.current.weather_code);
    if (/rain|lightning|snow/.test(ic)) {
      const old = root.querySelector('[data-now]');
      if (old) { old.outerHTML = nowNote(g, stayRef, true); refreshIcons(); }
    }
    card.querySelector('.postcard__temp').textContent = `${Math.round(wx.current.temperature_2m)}°`;
    card.querySelector('.postcard__desc').textContent = loc(desc);
    card.querySelector('.postcard__stamp').innerHTML = icon(ic);
    const days = wx.daily.time.slice(1, 4).map((d, k) => {
      const name = new Date(`${d}T12:00:00`).toLocaleDateString(locale(), { weekday: 'short' });
      return `<span>${name} ${Math.round(wx.daily.temperature_2m_max[k + 1])}°</span>`;
    }).join('');
    card.insertAdjacentHTML('beforeend', `<div class="postcard__days">${days}</div>`);
    refreshIcons();
  });

  // Vida: de vez en cuando una nota se balancea como si hubiera corriente.
  let swayTimer;
  if (!reduceMotion()) {
    swayTimer = setInterval(() => {
      if (document.hidden || vp.classList.contains('is-overview')) return;
      const notes = board.querySelectorAll('.note[data-section]');
      const n = notes[Math.floor(Math.random() * notes.length)];
      n.classList.remove('sway'); void n.offsetWidth; n.classList.add('sway');
      setTimeout(() => n.classList.remove('sway'), 2500);
    }, 5000);
  }

  return {
    toggleOverview,
    exitOverview,
    destroy() { ro.disconnect(); clearInterval(swayTimer); document.body.classList.remove('is-overview', 'is-night'); },
  };
}
