// Secciones de la guía. Cada una define cómo se ve su nota en el tablón
// (color, chincheta, pista) y cómo se despliega al "levantarla".
import { t, loc } from './i18n.js';
import { esc, icon, photo, toast, copyText, qrSvg, refreshIcons, openSheet } from './util.js';
import { findNearby } from './places.js';
import { CATEGORIES } from './places-config.js';
import { uberLink, directionsLink, telLink, whatsappLink } from './mobility.js';
import { createMap, homeMarker, pinMarker, fitTo, yarn } from './map.js';
import { getTrip, saveTrip, toggleTrip, isInTrip, track } from './store.js';

export const SECTIONS = [
  { id: 'house', icon: 'house', note: 'azul', pin: 'fucsia' },
  { id: 'wifi', icon: 'wifi', note: 'verde', pin: 'azul' },
  { id: 'checkin', icon: 'key-round', note: 'fucsia', pin: 'azul' },
  { id: 'nearby', icon: 'map-pin', note: 'lila', pin: 'verde' },
  { id: 'eat', icon: 'utensils', note: 'amarillo', pin: 'fucsia' },
  { id: 'do', icon: 'camera', note: 'celeste', pin: 'amarillo' },
  { id: 'move', icon: 'bus', note: 'azul', pin: 'verde' },
  { id: 'emergency', icon: 'shield-plus', note: 'fucsia', pin: 'fucsia', danger: true },
  { id: 'contact', icon: 'message-circle', note: 'melocoton', pin: 'azul' },
  { id: 'trip', icon: 'heart', note: 'kraft', pin: 'fucsia' },
];

export const sectionById = (id) => SECTIONS.find((s) => s.id === id);

/** Texto pequeño que aparece en la nota del tablón (información útil de un vistazo). */
export function hintFor(id, guide) {
  const trip = getTrip(guide.id);
  switch (id) {
    case 'house': return t('hint.house');
    case 'wifi': return esc(guide.wifi?.ssid || '');
    case 'checkin': return t('hint.checkin', { t: guide.checkin?.from || '15:00' });
    case 'nearby': return t('hint.nearby');
    case 'eat': return t('hint.eat', { n: guide.recommendations?.eat?.length || 0 });
    case 'do': return t('hint.do', { n: guide.recommendations?.do?.length || 0 });
    case 'move': return t('hint.move');
    case 'emergency': return t('hint.emergency');
    case 'contact': return t('hint.contact', { name: esc(guide.host?.name || '') });
    case 'trip': return trip.items.length ? t('hint.trip', { n: trip.items.length }) : t('hint.tripEmpty');
    default: return '';
  }
}

const home = (g) => ({ lat: g.property.lat, lng: g.property.lng, name: g.property.name, address: g.property.address });

// Piezas reutilizables -----------------------------------------------------

function row({ icon: ic, title, sub = '', body = '', href = '', tone = '', open = false, chevron = true }) {
  const head = `<span class="row__icon">${icon(ic)}</span>
    <span class="row__text"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
    ${chevron ? icon(href ? 'chevron-right' : 'chevron-right', 'row__chev') : '<span></span>'}`;
  const cls = `row${tone ? ` row--tone-${tone}` : ''}`;
  if (href) {
    const ext = /^https?:/.test(href) ? ' target="_blank" rel="noopener"' : '';
    return `<div class="${cls}"><a href="${esc(href)}"${ext}>${head}</a></div>`;
  }
  return `<details class="${cls}"${open ? ' open' : ''}><summary>${head}</summary><div class="row__body">${body}</div></details>`;
}

const list = (items) => `<ul>${items.map((i) => `<li>${esc(loc(i))}</li>`).join('')}</ul>`;

function problemButton(g, label = t('problem')) {
  const msg = `Hola ${g.host.name}, soy huésped de ${g.property.name}. `;
  return `<a class="btn btn--fucsia btn--block" href="${whatsappLink(g.host.whatsapp, msg)}" target="_blank" rel="noopener" data-track="contact">${icon('message-circle-warning')}${label}</a>`;
}

function heartBtn(g, place) {
  const on = isInTrip(g.id, place.id);
  return `<button class="icon-btn${on ? ' is-on' : ''}" data-heart='${esc(JSON.stringify(place))}'
    aria-pressed="${on}" aria-label="${t('saveTrip')}" title="${t('saveTrip')}">${icon('heart')}</button>`;
}

function placeCard(g, p, i, { kind, showPhoto = true } = {}) {
  const cat = CATEGORIES[p.cat] || {};
  const dist = p.distance != null ? `${p.minutes} ${t('min')} · ${p.distance < 1000 ? `${p.distance} m` : `${(p.distance / 1000).toFixed(1)} km`}` : '';
  const tags = [
    p.hostPick ? `<span class="tag tag--pink">♥ ${t('hostPick')}</span>` : '',
    p.rating ? `<span class="tag tag--star">★ ${p.rating.toFixed(1)}${p.reviews ? ` (${p.reviews > 999 ? `${(p.reviews / 1000).toFixed(1)}k` : p.reviews})` : ''}</span>` : '',
    p.is24h ? `<span class="tag tag--green">${t('open24')}</span>` : '',
    p.openNow ? `<span class="tag tag--green">${t('openNow')}</span>` : '',
    p.cuisine ? `<span class="tag">${esc(p.cuisine)}</span>` : '',
  ].join('');
  const visual = showPhoto
    ? photo(p.photo, p.name, 'place__img', kind === 'do' ? '🏛️' : '🍽️')
    : `<span class="place__icon" style="background:var(--${cat.color === 'amarillo' ? 'azul' : cat.color === 'naranja' ? 'fucsia' : cat.color === 'lila' ? 'azul-oscuro' : cat.color || 'azul'})">${icon(cat.icon || 'map-pin')}</span>`;
  const tripPlace = { id: p.id, name: p.name, lat: p.lat, lng: p.lng, photo: p.photo || '', category: loc(p.category) || loc(cat.label) || '', kind: kind || p.cat };
  const full = { ...p, kind: kind || p.cat, catLabel: loc(p.category) || loc(cat.label) || '' };
  return `<article class="place" style="--i:${i}" data-place='${esc(JSON.stringify(full))}'>
    ${visual}
    <div>
      <button type="button" class="place__name" data-open-place>${esc(p.name)}</button>
      <div class="place__meta">${esc(loc(p.category) || '')}${p.category && dist ? ' · ' : ''}${dist}</div>
      ${p.desc ? `<div class="place__desc">${esc(loc(p.desc))}</div>` : ''}
      ${tags ? `<div class="place__tags">${tags}</div>` : ''}
    </div>
    <div class="place__side">
      ${heartBtn(g, tripPlace)}
      <a class="icon-btn" href="${esc(p.mapsUrl || directionsLink({ destination: p }))}" target="_blank" rel="noopener" aria-label="${t('howToGet')}" title="${t('howToGet')}">${icon('navigation')}</a>
    </div>
  </article>`;
}

export function withDistance(g, p) {
  if (p.distance != null || p.lat == null) return p;
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const a = home(g);
  const h = Math.sin(toRad(p.lat - a.lat) / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(p.lat)) * Math.sin(toRad(p.lng - a.lng) / 2) ** 2;
  const distance = Math.round(2 * R * Math.asin(Math.sqrt(h)));
  return { ...p, distance, minutes: Math.max(1, Math.round((distance * 1.25) / 80)) };
}

function mapBlock(id, tall = false) {
  return `<div class="map-wrap"><span class="tape tape--amarillo"></span><span class="tape tape--azul"></span><div class="map${tall ? ' map--tall' : ''}" id="${id}"></div></div>`;
}

// Delegación de eventos común a todas las hojas (♥ y seguimiento).
export function bindCommon(root, g, { onTripChange } = {}) {
  root.addEventListener('click', (e) => {
    const heart = e.target.closest('[data-heart]');
    if (heart) {
      const place = JSON.parse(heart.dataset.heart);
      const saved = toggleTrip(g.id, place);
      document.querySelectorAll('[data-heart]').forEach((h) => {
        if (JSON.parse(h.dataset.heart).id !== place.id) return;
        h.classList.toggle('is-on', saved);
        h.setAttribute('aria-pressed', saved);
      });
      heart.classList.remove('pop'); void heart.offsetWidth; heart.classList.add('pop');
      if (saved) { track(g.id, 'save'); flyHeart(heart); }
      toast(saved ? t('savedTrip') : t('removedTrip'), saved ? 'heart' : 'x');
      onTripChange?.();
      return;
    }
    if (e.target.closest('[data-track="contact"]')) track(g.id, 'contact');
    const card = e.target.closest('[data-place]');
    // Toda la tarjeta abre la ficha con el ratón/dedo; con teclado, el botón del nombre.
    if (card && (!e.target.closest('a, button') || e.target.closest('[data-open-place]'))) openPlace(g, JSON.parse(card.dataset.place));
  });
}

/** Ficha de un sitio: polaroid grande, nota del anfitrión, mini mapa y acciones. */
export function openPlace(g, p) {
  const tripPlace = { id: p.id, name: p.name, lat: p.lat, lng: p.lng, photo: p.photo || '', category: p.catLabel || '', kind: p.kind };
  const d = withDistance(g, p);
  const dist = d.distance != null ? `${d.minutes} ${t('min')} ${t('walking')} · ${d.distance < 1000 ? `${d.distance} m` : `${(d.distance / 1000).toFixed(1)} km`}` : '';
  const sheet = openSheet(`
    <figure class="polaroid place-detail__photo" style="--r:-2deg">
      <span class="tape"></span>
      ${photo(p.photo, p.name, '', p.kind === 'do' ? '🏛️' : p.kind === 'eat' ? '🍽️' : '📍')}
      <figcaption>${esc(p.name)}</figcaption>
    </figure>
    <div class="place__tags" style="justify-content:center;margin:12px 0 4px">
      ${p.catLabel ? `<span class="tag">${esc(p.catLabel)}</span>` : ''}
      ${dist ? `<span class="tag">${icon('footprints')} ${dist}</span>` : ''}
      ${p.rating ? `<span class="tag tag--star">★ ${Number(p.rating).toFixed(1)}${p.reviews ? ` · ${p.reviews}` : ''}</span>` : ''}
      ${p.is24h ? `<span class="tag tag--green">${t('open24')}</span>` : ''}
    </div>
    ${p.desc ? `<blockquote class="host-says"><span class="pin pin--fucsia"></span>“${esc(loc(p.desc))}”<cite>— ${esc(g.host.name)}</cite></blockquote>` : ''}
    ${p.address ? `<p class="muted small" style="text-align:center">${icon('map-pin')} ${esc(p.address)}</p>` : ''}
    <div class="map-wrap"><span class="tape tape--amarillo"></span><div class="map" id="place-map" style="height:190px"></div></div>
    <div class="actions actions--2">
      <a class="btn btn--primary" href="${esc(directionsLink({ origin: home(g), destination: p, mode: 'walking' }))}" target="_blank" rel="noopener">${icon('navigation')}${t('howToGet')}</a>
      <a class="btn btn--ghost" href="${esc(uberLink({ pickup: home(g), dropoff: { lat: p.lat, lng: p.lng, name: p.name } }))}" target="_blank" rel="noopener">${icon('car-front')}Uber</a>
    </div>
    <button class="btn btn--fucsia btn--block place-detail__save" data-heart='${esc(JSON.stringify(tripPlace))}' style="margin-top:10px">${icon('heart')}<span>${isInTrip(g.id, p.id) ? t('savedTrip') : t('saveTrip')}</span></button>
  `, { className: 'place-detail', label: p.name });
  bindCommon(sheet.el, g);
  sheet.el.addEventListener('click', (e) => {
    const b = e.target.closest('.place-detail__save');
    if (b) setTimeout(() => { b.querySelector('span').textContent = isInTrip(g.id, p.id) ? t('savedTrip') : t('saveTrip'); }, 0);
  });
  setTimeout(() => {
    const map = createMap(sheet.el.querySelector('#place-map'), p, { zoom: 15 });
    homeMarker(map, home(g));
    pinMarker(map, p, { color: 'fucsia' });
    fitTo(map, [home(g), p], 30);
    refreshIcons();
  }, 350);
}

/** Un corazón sale volando hacia el botón de "Mi viaje"/tablón. */
function flyHeart(from) {
  const target = document.querySelector('[data-trip-target]');
  if (!target || !from.animate) return;
  const a = from.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'fly-heart';
  el.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.5 3 4.5 6.9 4.5c2.2 0 3.6 1.2 5.1 3 1.5-1.8 2.9-3 5.1-3 3.9 0 6 4 4.5 7.3C19.5 16.4 12 21 12 21z"/></svg>';
  el.style.left = `${a.left + a.width / 2 - 14}px`;
  el.style.top = `${a.top + a.height / 2 - 14}px`;
  document.body.append(el);
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  el.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 80}px) scale(1.5) rotate(-15deg)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) scale(.4)`, opacity: 0.2 },
  ], { duration: 750, easing: 'cubic-bezier(.4,0,.2,1)' }).onfinish = () => el.remove();
}

// Renderizadores ------------------------------------------------------------

const R = {};

R.house = (g) => {
  const h = g.house || {};
  return `
    <figure class="hero-photo"><span class="tape"></span><span class="tape tape--azul"></span>${photo(g.property.photos?.[0], g.property.name, '', '🛋️')}</figure>
    <div class="rows">
      ${row({ icon: 'lightbulb', title: t('howItWorks'), sub: t('howItWorksSub'), body: (h.howItWorks || []).map((x) => `<p><b>${esc(loc(x.title))}.</b> ${esc(loc(x.text))}</p>`).join('') })}
      ${row({ icon: 'scroll-text', title: t('rules'), sub: t('rulesSub'), body: list(h.rules || []) })}
      ${row({ icon: 'sofa', title: t('equipment'), sub: t('equipmentSub'), body: list(h.equipment || []) })}
      ${row({ icon: 'recycle', title: t('trash'), sub: t('trashSub'), body: `<p>${esc(loc(h.trash))}</p>` })}
      ${row({ icon: 'book-open', title: t('manual'), sub: t('manualSub'), body: `<p>${esc(loc(h.manual))}</p>` })}
    </div>
    <div class="actions">${problemButton(g)}</div>`;
};

function wifiString({ ssid, password, security = 'WPA' }) {
  const e = (s) => String(s).replace(/([\\;,:"])/g, '\\$1');
  return `WIFI:T:${security};S:${e(ssid)};P:${e(password)};;`;
}

R.wifi = (g) => {
  const w = g.wifi || {};
  return `<div class="wifi">
    <svg class="wifi__waves" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
      <path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 14 0"/><path d="M1.5 9.4a15 15 0 0 1 21 0"/>
      <circle cx="12" cy="20" r="1.3" fill="currentColor" stroke="none"/>
    </svg>
    <div class="wifi__label">${t('network')}</div>
    <div class="wifi__ssid">${esc(w.ssid)}</div>
    <div class="wifi__label">${t('password')}</div>
    <div class="wifi__pass">${esc(w.password)}</div>
    <div class="actions"><button class="btn btn--ghost" data-copy="${esc(w.password)}">${icon('copy')}${t('copyPassword')}</button></div>
    <div class="qr" role="img" aria-label="QR WiFi">${qrSvg(wifiString(w), 5)}</div>
    <p class="muted small">${t('scanToConnect')}</p>
    ${w.notes ? `<p class="muted small">${esc(loc(w.notes))}</p>` : ''}
  </div>`;
};

R.checkin = (g, ctx) => {
  const c = g.checkin || {};
  const done = new Set(ctx.checklist || []);
  const steps = (c.checkoutSteps || []).map((s, i) => `
    <label class="row" style="display:flex;gap:12px;align-items:center;padding:12px 14px">
      <input type="checkbox" data-step="${i}" ${done.has(i) ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--verde)">
      <span>${esc(loc(s))}</span>
    </label>`).join('');
  return `
    <figure class="hero-photo"><span class="tape tape--verde"></span>${photo(g.property.photos?.[1] || g.property.photos?.[0], '', '', '🚪')}</figure>
    <div class="rows">
      ${row({ icon: 'map-pin', title: t('checkin'), sub: t('from', { t: c.from }), body: c.to ? `<p>${esc(c.from)} – ${esc(c.to)}</p>` : '' })}
      ${row({ icon: 'map-pin-check', title: t('checkout'), sub: t('until', { t: c.checkoutBy }), body: `<p>${t('until', { t: esc(c.checkoutBy) })}</p>${ctx.outDate ? `<a class="btn btn--ghost btn--sm" data-ics href="#">${icon('calendar-plus')}Recordatorio</a>` : ''}` })}
      ${row({ icon: 'door-open', title: t('building'), sub: t('buildingSub'), body: `<p>${esc(loc(c.building))}</p>`, open: true })}
      ${row({ icon: 'key-round', title: t('keys'), sub: t('keysSub'), body: `<p>${esc(loc(c.keys))}</p>` })}
      ${row({ icon: 'luggage', title: t('luggage'), sub: t('luggageSub'), body: `<p>${esc(loc(c.luggage))}</p>` })}
    </div>
    ${steps ? `<h2 class="section-title">${icon('list-checks')}${t('checkoutList')}</h2><div class="stack">${steps}</div>` : ''}
    <div class="actions"><a class="btn btn--ghost btn--block" href="${directionsLink({ destination: home(g) })}" target="_blank" rel="noopener">${icon('navigation')}${t('howToGet')}</a></div>`;
};

const NEARBY_TABS = ['all', 'supermarket', 'pharmacy', 'cafe', 'transit', 'parking'];

R.nearby = () => `
  <div class="chips" role="tablist">${NEARBY_TABS.map((c, i) => `<button class="chip${i === 0 ? ' is-active' : ''}" data-cat="${c}" role="tab">${c === 'all' ? icon('layout-grid') + t('all') : icon(CATEGORIES[c].icon) + loc(CATEGORIES[c].label)}</button>`).join('')}</div>
  ${mapBlock('nearby-map')}
  <div class="places" id="nearby-list"><div class="status status--loading">${t('loadingPlaces')}</div></div>
  <p class="source" id="nearby-source"></p>`;

function recoTabs(items, autoLabel) {
  const cats = [...new Set(items.map((i) => loc(i.category)).filter(Boolean))];
  return `<div class="chips">
    <button class="chip is-active" data-filter="">${icon('heart')}${t('all')}</button>
    ${cats.map((c) => `<button class="chip" data-filter="${esc(c)}">${esc(c)}</button>`).join('')}
    <button class="chip" data-filter="__auto">${icon('sparkles')}${autoLabel}</button>
  </div>`;
}

function recoSection(kind) {
  return (g) => {
    const items = (g.recommendations?.[kind] || []).map((p) => withDistance(g, p));
    const autoLabel = kind === 'eat' ? t('topRated') : t('nearest');
    return `${recoTabs(items, autoLabel)}
      <div class="places" id="reco-list">${items.map((p, i) => placeCard(g, p, i, { kind })).join('')}</div>
      <p class="source" id="reco-source"></p>
      <div class="actions"><button class="btn btn--fucsia btn--block" data-goto-trip data-trip-target>${icon('heart')}${t('sec.trip')}</button></div>`;
  };
}
R.eat = recoSection('eat');
R.do = recoSection('do');

R.move = (g, ctx) => {
  const tr = g.transport || {};
  const dests = [{ id: 'home', name: t('goHome'), lat: g.property.lat, lng: g.property.lng, icon: 'house' },
    ...(tr.destinations || []).map((d, i) => ({ ...d, id: `d${i}`, icon: /aeropuerto|airport/i.test(d.name) ? 'plane' : 'train-front' }))];
  const sel = dests.find((d) => d.id === ctx.dest) || dests[0];
  const goingHome = sel.id === 'home';
  const driverText = goingHome ? g.property.address : sel.name;
  const uber = goingHome
    ? uberLink({ dropoff: { ...home(g) } })
    : uberLink({ pickup: home(g), dropoff: { lat: sel.lat, lng: sel.lng, name: sel.name } });
  const transit = goingHome
    ? directionsLink({ destination: home(g), mode: 'transit' })
    : directionsLink({ origin: home(g), destination: sel, mode: 'transit' });

  return `
    <h2 class="section-title">${icon('car-taxi-front')}${t('taxi')}</h2>
    <p class="muted small">${t('taxiTo')}</p>
    <div class="dest-grid">${dests.map((d) => `<button class="dest${d.id === sel.id ? ' is-active' : ''}" data-dest="${d.id}">${icon(d.icon)}${esc(d.name)}</button>`).join('')}</div>
    <div class="taxi-card" style="margin-top:14px">
      <div class="taxi-card__label">${t('taxiDriver')}</div>
      <div class="taxi-card__addr">${esc(driverText)}</div>
      <div class="actions actions--2" style="margin-top:0">
        <a class="btn btn--primary" href="${esc(uber)}" target="_blank" rel="noopener">${icon('car-front')}${t('uber')}</a>
        <a class="btn btn--ghost" href="${esc(transit)}" target="_blank" rel="noopener">${icon('route')}${t('transitRoute')}</a>
      </div>
    </div>
    <div class="rows" style="margin-top:12px">
      ${(tr.taxiPhones || []).map((p) => row({ icon: 'phone', title: esc(p.name), sub: esc(p.phone.replace(/^\+34/, '')), href: telLink(p.phone) })).join('')}
    </div>

    <h2 class="section-title">${icon('train-front')}${t('stations')}</h2>
    <div class="rows">
      ${(tr.nearestStations || []).map((s) => row({ icon: 'train-front', title: esc(s.name), sub: `${esc(s.lines)} · ${s.minutes} ${t('min')}`, href: directionsLink({ origin: home(g), destination: `${s.name}, ${g.property.city}`, mode: 'walking' }) })).join('')}
      ${row({ icon: 'bike', title: t('bikes'), sub: t('bikesSub'), href: 'https://www.bicimad.com/' })}
    </div>

    <h2 class="section-title">${icon('plane')}${t('airport')}</h2>
    <div class="rows">
      ${(tr.airport || []).map((a, i) => row({ icon: ['bus', 'train-front', 'train-track', 'car-taxi-front'][i] || 'plane', title: esc(loc(a.title)), body: `<p>${esc(loc(a.text))}</p>` })).join('')}
    </div>`;
};

R.emergency = (g) => `
  <div class="rows">
    ${(g.emergencies || []).map((e) => row({ icon: e.primary ? 'siren' : e.tone === 'green' ? 'ambulance' : e.tone === 'orange' ? 'flame' : 'shield', title: `${esc(e.phone)} · ${esc(loc(e.name))}`, href: telLink(e.phone), tone: e.primary ? 'fucsia' : e.tone || '' })).join('')}
  </div>
  <p class="muted small" style="margin:12px 4px">${t('emergencyNote')}</p>
  <h2 class="section-title">${icon('hospital')}${t('nearestHospital')}</h2>
  <div class="rows">
    ${g.hospital ? row({ icon: 'hospital', title: esc(g.hospital.name), sub: esc(loc(g.hospital.desc)), href: directionsLink({ origin: home(g), destination: g.hospital, mode: 'driving' }) }) : ''}
  </div>
  <h2 class="section-title">${icon('pill')}${t('pharmacy24')}</h2>
  <div class="places" id="pharmacy-list"><div class="status status--loading">${t('loadingPlaces')}</div></div>`;

R.contact = (g) => {
  const h = g.host || {};
  const initial = (h.name || '?').trim()[0];
  return `<div class="host">
    ${h.photo ? `<img class="host__avatar" src="${esc(h.photo)}" alt="">` : `<div class="host__avatar">${esc(initial)}</div>`}
    <div class="host__name">${esc(h.name)}</div>
    <div class="muted">${esc(loc(h.role) || '')}</div>
    <div class="contact-btns">
      <a class="contact-btn" data-track="contact" href="${whatsappLink(h.whatsapp, `Hola ${h.name}! `)}" target="_blank" rel="noopener"><span style="background:#25d366">${icon('message-circle')}</span>WhatsApp</a>
      <a class="contact-btn" data-track="contact" href="${telLink(h.phone)}"><span style="background:var(--azul)">${icon('phone')}</span>${t('call')}</a>
      <a class="contact-btn" data-track="contact" href="mailto:${esc(h.email)}"><span style="background:var(--fucsia)">${icon('mail')}</span>${t('email')}</a>
    </div>
    <div class="rows" style="text-align:left">
      ${row({ icon: 'clock', title: t('responseHours'), sub: `${esc(h.responseHours)} · ${esc(loc(h.responseDays))}`, chevron: false, body: '' })}
    </div>
  </div>`;
};

R.trip = (g, ctx) => {
  const trip = getTrip(g.id);
  const day = ctx.day ?? -1; // -1 = todo
  const items = trip.items.filter((i) => day < 0 || i.day === day);
  const notes = trip.notes.filter((n) => day < 0 || n.day === day);
  const nights = ctx.nights || 3;
  const dayOpts = (cur) => [`<option value="0"${cur === 0 ? ' selected' : ''}>${t('noDay')}</option>`,
    ...Array.from({ length: nights }, (_, i) => `<option value="${i + 1}"${cur === i + 1 ? ' selected' : ''}>${t('day', { n: i + 1 })}</option>`)].join('');
  return `
    <p class="muted" style="margin-top:0">${t('tripIntro')}</p>
    <div class="chips day-tabs">
      <button class="chip${day < 0 ? ' is-active' : ''}" data-day="-1">${t('allDays')}</button>
      ${Array.from({ length: nights }, (_, i) => `<button class="chip${day === i + 1 ? ' is-active' : ''}" data-day="${i + 1}">${t('day', { n: i + 1 })}</button>`).join('')}
    </div>
    <div class="trip-board cork">
      ${items.length || notes.length ? `
      <div class="trip-grid" id="trip-grid">
        <svg class="trip-yarn" aria-hidden="true"></svg>
        ${items.map((it, i) => `
          <figure class="polaroid" style="--r:${[-3, 2.5, -1.5, 3, -2, 1.5][i % 6]}deg;--i:${i}" data-trip-item="${esc(it.id)}">
            <span class="pin pin--${['fucsia', 'azul', 'verde', 'amarillo'][i % 4]}"></span>
            <span class="num">${i + 1}</span>
            <button class="remove" data-remove="${esc(it.id)}" aria-label="Quitar">${icon('x')}</button>
            ${photo(it.photo, it.name, '', it.kind === 'do' ? '🏛️' : '📍')}
            <figcaption>${esc(it.name)}</figcaption>
            <select class="select-day" data-day-of="${esc(it.id)}" aria-label="Día">${dayOpts(it.day)}</select>
          </figure>`).join('')}
        ${notes.map((n, i) => `
          <div class="note note--amarillo" style="--r:${[2, -2.5, 1.5][i % 3]}deg">
            <span class="pin pin--azul"></span>${esc(n.text)}
            <button class="icon-btn" style="width:28px;height:28px;margin-top:6px" data-remove-note="${n.id}" aria-label="Quitar">${icon('x')}</button>
          </div>`).join('')}
      </div>` : `<div class="trip-empty">${esc(t('tripEmpty')).replace('\n', '<br>')}</div>`}
    </div>
    ${items.length > 1 ? `<p class="muted small" style="text-align:center;margin:-6px 0 12px">${icon('hand')} ${t('dragHint')}</p>` : ''}
    <form class="trip-note-form" id="trip-note-form">
      <input name="text" maxlength="80" placeholder="${t('tripAddNote')}" autocomplete="off">
      <button class="btn btn--primary">${icon('pin')}${t('add')}</button>
    </form>
    ${items.length ? `${mapBlock('trip-map', true)}
    <div class="actions actions--2">
      <a class="btn btn--primary" target="_blank" rel="noopener" href="${esc(directionsLink({
        origin: home(g), destination: items[items.length - 1], mode: 'walking', waypoints: items.slice(0, -1).slice(0, 8),
      }))}">${icon('route')}${t('tripRoute')}</a>
      <button class="btn btn--ghost" data-share>${icon('share-2')}${t('share')}</button>
    </div>
    ${items.length > 2 ? `<button class="btn btn--ghost btn--block btn--sm" data-optimize style="margin-top:10px">${icon('wand-sparkles')}${t('optimize')}</button>` : ''}` : `<div class="actions actions--2"><a class="btn btn--fucsia" href="#/s/eat">${icon('utensils')}${t('sec.eat')}</a><a class="btn btn--ghost" href="#/s/do">${icon('camera')}${t('sec.do')}</a></div>`}`;
};

export function renderSection(id, g, ctx) {
  return (R[id] || (() => ''))(g, ctx);
}

// Montaje (mapas, datos en vivo, eventos) ----------------------------------

export function mountSection(id, g, ctx, root) {
  bindCommon(root, g, { onTripChange: ctx.onTripChange });

  root.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    if (await copyText(b.dataset.copy)) toast(t('copied'));
  }));

  if (id === 'nearby') mountNearby(g, root);
  if (id === 'eat' || id === 'do') mountReco(id, g, root, ctx);
  if (id === 'emergency') mountPharmacies(g, root);
  if (id === 'move') {
    root.querySelectorAll('[data-dest]').forEach((b) => b.addEventListener('click', () => ctx.rerender({ dest: b.dataset.dest })));
  }
  if (id === 'checkin') mountCheckin(g, root, ctx);
  if (id === 'trip') mountTrip(g, root, ctx);
}

function mountCheckin(g, root, ctx) {
  root.querySelectorAll('[data-step]').forEach((cb) => cb.addEventListener('change', () => {
    const steps = [...root.querySelectorAll('[data-step]:checked')].map((c) => Number(c.dataset.step));
    try { localStorage.setItem(`rh:checklist:${g.id}`, JSON.stringify(steps)); } catch { /* ignore */ }
    if (steps.length === g.checkin.checkoutSteps.length) toast(t('allDone'), 'sparkles');
  }));
  root.querySelector('[data-ics]')?.addEventListener('click', (e) => {
    e.preventDefault();
    const [hh, mm] = (g.checkin.checkoutBy || '11:00').split(':');
    const d = ctx.outDate.replace(/-/g, '');
    const start = `${d}T${String(Number(hh) - 1).padStart(2, '0')}${mm}00`;
    const end = `${d}T${hh}${mm}00`;
    const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//retorika Home//ES', 'BEGIN:VEVENT',
      `UID:${g.id}-${d}@retorika.home`, `DTSTART:${start}`, `DTEND:${end}`,
      `SUMMARY:Check-out ${g.property.name}`, `LOCATION:${g.property.address}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    a.download = 'check-out.ics';
    a.click();
  });
}

async function mountNearby(g, root) {
  const map = createMap(root.querySelector('#nearby-map'), home(g), { zoom: 16 });
  homeMarker(map, home(g), g.property.name);
  refreshIcons();
  let layer = map ? window.L.layerGroup().addTo(map) : null;
  const listEl = root.querySelector('#nearby-list');
  const srcEl = root.querySelector('#nearby-source');

  const load = async (cat) => {
    listEl.innerHTML = `<div class="status status--loading">${t('loadingPlaces')}</div>`;
    const cats = cat === 'all' ? ['supermarket', 'pharmacy', 'cafe', 'transit'] : [cat];
    try {
      const results = await Promise.all(cats.map((c) => findNearby(c, g.property.lat, g.property.lng, { limit: cat === 'all' ? 2 : 8 }).catch(() => ({ places: [] }))));
      const places = results.flatMap((r) => r.places).sort((a, b) => a.distance - b.distance);
      layer?.clearLayers();
      if (!places.length) { listEl.innerHTML = `<div class="status">${t('noPlaces')}</div>`; return; }
      listEl.innerHTML = places.map((p, i) => placeCard(g, p, i, { showPhoto: false })).join('');
      places.forEach((p) => {
        const m = pinMarker(map, p, { color: CATEGORIES[p.cat].color, popup: `<b>${esc(p.name)}</b><br>${p.minutes} min` });
        if (m) layer.addLayer(m);
      });
      fitTo(map, [home(g), ...places.slice(0, 6)]);
      const google = results.some((r) => r.source === 'google');
      srcEl.textContent = google ? 'Datos: Google Places' : 'Datos © OpenStreetMap';
      refreshIcons();
    } catch {
      listEl.innerHTML = `<div class="status">${t('placesError')}</div>`;
    }
  };

  root.querySelectorAll('[data-cat]').forEach((chip) => chip.addEventListener('click', () => {
    root.querySelectorAll('[data-cat]').forEach((c) => c.classList.toggle('is-active', c === chip));
    load(chip.dataset.cat);
  }));
  load('all');
}

function mountReco(kind, g, root) {
  const listEl = root.querySelector('#reco-list');
  const srcEl = root.querySelector('#reco-source');
  const items = (g.recommendations?.[kind] || []).map((p) => withDistance(g, p));
  const render = (arr) => {
    listEl.innerHTML = arr.map((p, i) => placeCard(g, p, i, { kind })).join('') || `<div class="status">${t('noPlaces')}</div>`;
    refreshIcons();
  };
  root.querySelectorAll('[data-filter]').forEach((chip) => chip.addEventListener('click', async () => {
    root.querySelectorAll('[data-filter]').forEach((c) => c.classList.toggle('is-active', c === chip));
    const f = chip.dataset.filter;
    srcEl.textContent = '';
    if (f !== '__auto') { render(f ? items.filter((i) => loc(i.category) === f) : items); return; }
    listEl.innerHTML = `<div class="status status--loading">${t('loadingPlaces')}</div>`;
    try {
      const cat = kind === 'eat' ? 'restaurant' : 'attraction';
      const { places, source } = await findNearby(cat, g.property.lat, g.property.lng, { limit: 10 });
      render(places.map((p) => ({ ...p, category: CATEGORIES[cat].label })));
      srcEl.textContent = source === 'google' ? 'Datos: Google Places · ordenados por valoración' : 'Datos © OpenStreetMap · ordenados por cercanía';
    } catch {
      listEl.innerHTML = `<div class="status">${t('placesError')}</div>`;
    }
  }));
  root.querySelector('[data-goto-trip]')?.addEventListener('click', () => { location.hash = '#/s/trip'; });
}

async function mountPharmacies(g, root) {
  const el = root.querySelector('#pharmacy-list');
  try {
    const { places } = await findNearby('pharmacy', g.property.lat, g.property.lng, { limit: 8 });
    const sorted = [...places].sort((a, b) => (b.is24h - a.is24h) || (a.distance - b.distance)).slice(0, 3);
    el.innerHTML = sorted.map((p, i) => placeCard(g, p, i, { showPhoto: false })).join('') || `<div class="status">${t('noPlaces')}</div>`;
  } catch {
    el.innerHTML = `<div class="status">${t('placesError')}</div>`;
  }
  refreshIcons();
}

function mountTrip(g, root, ctx) {
  const trip = getTrip(g.id);
  const day = ctx.day ?? -1;
  const items = trip.items.filter((i) => day < 0 || i.day === day);

  root.querySelectorAll('[data-day]').forEach((c) => c.addEventListener('click', () => ctx.rerender({ day: Number(c.dataset.day) })));
  root.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    const tr = getTrip(g.id);
    tr.items = tr.items.filter((i) => i.id !== b.dataset.remove);
    saveTrip(g.id, tr);
    ctx.rerender({});
  }));
  root.querySelectorAll('[data-remove-note]').forEach((b) => b.addEventListener('click', () => {
    const tr = getTrip(g.id);
    tr.notes = tr.notes.filter((n) => String(n.id) !== b.dataset.removeNote);
    saveTrip(g.id, tr);
    ctx.rerender({});
  }));
  root.querySelectorAll('[data-day-of]').forEach((s) => s.addEventListener('change', () => {
    const tr = getTrip(g.id);
    const it = tr.items.find((i) => i.id === s.dataset.dayOf);
    if (it) it.day = Number(s.value);
    saveTrip(g.id, tr);
    toast(it?.day ? t('day', { n: it.day }) : t('noDay'), 'calendar');
  }));
  root.querySelector('#trip-note-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text) return;
    const tr = getTrip(g.id);
    tr.notes.push({ id: Date.now(), text, day: Math.max(0, day) });
    saveTrip(g.id, tr);
    ctx.rerender({});
  });
  root.querySelector('[data-share]')?.addEventListener('click', async () => {
    const text = `${t('sec.trip')} · ${g.property.city}\n${items.map((it, i) => `${i + 1}. ${it.name}`).join('\n')}`;
    if (navigator.share) { try { await navigator.share({ title: t('sec.trip'), text }); } catch { /* cancelado */ } } else if (await copyText(text)) toast(t('copied'));
  });

  // Reordenar: mantener pulsada una polaroid y arrastrarla (ratón o dedo).
  const grid0 = root.querySelector('#trip-grid');
  if (grid0 && items.length > 1) enableDragSort(grid0, (orderIds) => {
    const tr = getTrip(g.id);
    const visible = new Set(orderIds);
    const queue = orderIds.map((id) => tr.items.find((i) => i.id === id));
    tr.items = tr.items.map((it) => (visible.has(it.id) ? queue.shift() : it));
    saveTrip(g.id, tr);
    ctx.rerender({});
  });
  root.querySelector('[data-optimize]')?.addEventListener('click', () => {
    // Vecino más cercano desde casa: una ruta razonable sin servidor.
    const tr = getTrip(g.id);
    const left = [...items];
    const route = [];
    let cur = home(g);
    while (left.length) {
      left.sort((a, b) => distM(cur, a) - distM(cur, b));
      cur = left.shift();
      route.push(cur.id);
    }
    const visible = new Set(route);
    const queue = route.map((id) => tr.items.find((i) => i.id === id));
    tr.items = tr.items.map((it) => (visible.has(it.id) ? queue.shift() : it));
    saveTrip(g.id, tr);
    toast(t('optimized'), 'route');
    ctx.rerender({});
  });

  // Hilo rojo entre polaroids (en orden) — se dibuja tras el layout.
  const grid = root.querySelector('#trip-grid');
  const svg = grid?.querySelector('.trip-yarn');
  if (svg && items.length > 1) {
    requestAnimationFrame(() => setTimeout(() => {
      const base = grid.getBoundingClientRect();
      const pts = [...grid.querySelectorAll('[data-trip-item] .pin')].map((p) => {
        const r = p.getBoundingClientRect();
        return [r.left - base.left + r.width / 2, r.top - base.top + r.height / 2];
      });
      const d = pts.map(([x, y], i) => {
        if (!i) return `M${x},${y}`;
        const [px, py] = pts[i - 1];
        const sag = Math.min(60, Math.hypot(x - px, y - py) * 0.25);
        return `Q${(px + x) / 2},${(py + y) / 2 + sag} ${x},${y}`;
      }).join(' ');
      svg.innerHTML = `<path d="${d}"/>`;
      const path = svg.querySelector('path');
      path.style.setProperty('--len', path.getTotalLength());
    }, 350));
  }

  if (items.length) {
    const map = createMap(root.querySelector('#trip-map'), home(g), { zoom: 14 });
    homeMarker(map, home(g), g.property.name);
    items.forEach((it, i) => pinMarker(map, it, { color: 'fucsia', label: String(i + 1), popup: `<b>${esc(it.name)}</b>` }));
    yarn(map, [home(g), ...items]);
    fitTo(map, [home(g), ...items], 40);
    refreshIcons();
  }
}

function distM(a, b) {
  return withDistance({ property: { lat: a.lat, lng: a.lng } }, { ...b, distance: undefined }).distance;
}

/** Arrastrar para reordenar con Pointer Events (funciona en móvil con pulsación larga). */
function enableDragSort(grid, onDrop) {
  let drag = null;
  const cards = () => [...grid.querySelectorAll('[data-trip-item]')];
  grid.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-trip-item]');
    if (!el || e.target.closest('button, select, a') || e.button > 0) return;
    const start = { x: e.clientX, y: e.clientY };
    const begin = () => {
      drag = { el, start, id: el.dataset.tripItem };
      el.classList.add('is-dragging');
      el.setPointerCapture?.(e.pointerId);
      navigator.vibrate?.(12);
    };
    const timer = setTimeout(begin, e.pointerType === 'mouse' ? 120 : 280);
    const cancel = (ev) => {
      if (!drag && (ev.type !== 'pointermove' || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8)) {
        clearTimeout(timer);
        el.removeEventListener('pointermove', cancel);
      }
    };
    el.addEventListener('pointermove', cancel);
    el.addEventListener('pointerup', () => clearTimeout(timer), { once: true });
  });
  grid.addEventListener('touchmove', (e) => { if (drag) e.preventDefault(); }, { passive: false });
  grid.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.start.x;
    const dy = e.clientY - drag.start.y;
    drag.el.style.transform = `translate(${dx}px, ${dy}px) rotate(0deg) scale(1.07)`;
    const over = nearest(e);
    cards().forEach((c) => c.classList.toggle('is-drop-target', c === over && c !== drag.el));
  });
  const nearest = (e) => {
    let best = null; let bd = Infinity;
    cards().forEach((c) => {
      if (c === drag.el) return;
      const r = c.getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - e.clientX, r.top + r.height / 2 - e.clientY);
      if (d < bd) { bd = d; best = c; }
    });
    return bd < 140 ? best : null;
  };
  const end = (e) => {
    if (!drag) return;
    const over = nearest(e);
    const ids = cards().map((c) => c.dataset.tripItem);
    const from = ids.indexOf(drag.id);
    drag.el.classList.remove('is-dragging');
    drag.el.style.transform = '';
    cards().forEach((c) => c.classList.remove('is-drop-target'));
    if (over) {
      ids.splice(from, 1);
      ids.splice(ids.indexOf(over.dataset.tripItem) + (cards().indexOf(over) > from ? 1 : 0), 0, drag.id);
      drag = null;
      onDrop(ids);
    } else drag = null;
  };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
}
