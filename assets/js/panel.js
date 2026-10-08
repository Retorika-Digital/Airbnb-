// Panel del propietario: conectar anuncio de Airbnb → autocompletar →
// recomendaciones automáticas → editar → enviar al huésped (enlace + QR).
import { esc, icon, refreshIcons, toast, copyText, qrSvg, photo } from './util.js';
import { loadGuide, saveGuide, listLocalGuideIds, deleteLocalGuide, getStats, slugify, seedDemoStats } from './store.js';
import { findNearby, geocode } from './places.js';
import { CATEGORIES } from './places-config.js';
import { createMap } from './map.js';
import { whatsappLink } from './mobility.js';

let main = document.getElementById('main');
const OWNER = 'Belén';
const DEMO_ID = 'granvia';

// Utilidades de datos ----------------------------------------------------------

const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.');
  let cur = o;
  ks.slice(0, -1).forEach((k) => { cur[k] = cur[k] ?? {}; cur = cur[k]; });
  cur[ks.at(-1)] = v;
}

const guideUrl = (id, extra = {}) => {
  const u = new URL('index.html', location.href);
  u.search = new URLSearchParams({ guide: id, ...extra }).toString();
  u.hash = '';
  return u.toString();
};

async function allGuides() {
  const ids = [...new Set([DEMO_ID, ...listLocalGuideIds()])];
  const out = [];
  for (const id of ids) {
    try { out.push(await loadGuide(id)); } catch { /* guía borrada */ }
  }
  return out;
}

/** Plantilla de guía nueva con valores por defecto sensatos (España). */
async function newGuideFrom(data) {
  let tpl = null;
  if (/madrid/i.test(data.city || '')) {
    try { tpl = await (await fetch('data/guides/granvia.json')).json(); } catch { /* sin plantilla */ }
  }
  const base = slugify(data.name || data.city || 'alojamiento');
  let id = base;
  for (let n = 2; listLocalGuideIds().includes(id) || id === DEMO_ID; n++) id = `${base}-${n}`;
  return {
    id,
    slug: id,
    property: {
      name: data.name || 'Mi alojamiento',
      tagline: `Tu hogar temporal en ${data.city || 'la ciudad'}`,
      address: data.address || data.city || '',
      city: data.city || '',
      lat: data.lat, lng: data.lng,
      photos: data.photos || [],
      airbnbUrl: data.url || '',
    },
    host: {
      name: data.hostName || OWNER, role: 'Tu anfitriona', photo: '',
      phone: data.phone || '', whatsapp: (data.phone || '').replace(/\D/g, ''), email: '',
      responseHours: '8:00 - 22:00', responseDays: 'Todos los días',
    },
    wifi: { ssid: data.wifiSsid || '', password: data.wifiPass || '', security: 'WPA', notes: '' },
    checkin: {
      from: data.checkIn || '15:00', to: '23:00', checkoutBy: data.checkOut || '11:00',
      building: data.building || '', keys: data.keys || '', luggage: '',
      checkoutSteps: ['Deja las toallas usadas en la bañera', 'Saca la basura', 'Apaga luces y aire acondicionado', 'Deja las llaves donde las encontraste'],
    },
    house: {
      howItWorks: [],
      rules: ['No se permite fumar', 'Silencio a partir de las 22:00', 'No se permiten fiestas'],
      equipment: data.amenities || [],
      trash: '', manual: '',
    },
    recommendations: { eat: data.eat || [], do: data.do || [] },
    transport: {
      nearestStations: data.stations || [],
      airport: tpl?.transport.airport || [],
      taxiPhones: tpl?.transport.taxiPhones || [],
      destinations: tpl?.transport.destinations || [],
    },
    emergencies: tpl?.emergencies || [
      { name: 'Emergencias generales', phone: '112', primary: true },
      { name: 'Policía Nacional', phone: '091' },
      { name: 'Policía Local', phone: '092' },
      { name: 'Bomberos', phone: '080', tone: 'orange' },
    ],
    hospital: data.hospital || null,
    nearby: null,
    createdAt: new Date().toISOString(),
  };
}

// Vistas -------------------------------------------------------------------------

const views = {};

views.resumen = async () => {
  const guides = await allGuides();
  const stats = guides.map((g) => getStats(g.id));
  const sum = (k) => stats.reduce((a, s) => a + (s[k] || 0), 0);
  const sections = stats.reduce((acc, s) => { Object.entries(s.sections).forEach(([k, v]) => { acc[k] = (acc[k] || 0) + v; }); return acc; }, {});
  const top = Object.entries(sections).sort((a, b) => b[1] - a[1])[0];
  const g0 = guides[0];

  main.innerHTML = `
    <div class="main__head">
      <div><h1>Hola, ${OWNER} 👋</h1><p>Tus alojamientos y lo que tus huéspedes consultan.</p></div>
      <a class="btn btn--primary" href="#/nuevo">${icon('plus')}Nuevo alojamiento</a>
    </div>

    <div class="grid grid--4" style="margin-bottom:18px">
      <div class="stat"><small>Aperturas de guía</small><b>${sum('opens')}</b></div>
      <div class="stat"><small>Sitios guardados por huéspedes</small><b>${sum('saves')}</b></div>
      <div class="stat"><small>Contactos desde la guía</small><b>${sum('contacts')}</b></div>
      <div class="stat"><small>Lo más consultado</small><b style="font-size:1.3rem;padding-top:8px">${top ? esc(labelOf(top[0])) : '—'}</b></div>
    </div>

    <h2 style="font-weight:900;margin:0 0 12px">Mis alojamientos</h2>
    <div class="grid grid--3" style="margin-bottom:22px">
      ${guides.map((g) => `
        <article class="listing">
          ${photo(g.property.photos?.[0], g.property.name, '', '🏠')}
          <div class="listing__body">
            <div class="listing__name">${esc(g.property.name)}</div>
            <div class="listing__addr">${esc(g.property.address)}</div>
            <div class="listing__foot">
              <span class="badge${g.wifi?.password ? '' : ' badge--draft'}">${g.wifi?.password ? 'Activo' : 'Faltan datos'}</span>
              <span class="listing__links">
                <a href="${guideUrl(g.id)}" target="_blank" rel="noopener">${icon('eye')}Ver guía</a>
                <a href="#/editar/${g.id}">${icon('pencil')}Editar</a>
              </span>
            </div>
          </div>
        </article>`).join('')}
      <a class="listing listing--new" href="#/nuevo">${icon('circle-plus')}Conectar otro anuncio<br><small class="muted">Pega el enlace de Airbnb</small></a>
    </div>

    <div class="grid grid--2">
      <section class="card">
        <h2>${icon('link')}Conecta tu anuncio de Airbnb</h2>
        <p class="sub">Pega el enlace de tu anuncio publicado y autocompletamos la guía: fotos, ubicación, horarios, comodidades y los mejores sitios de alrededor.</p>
        <form class="input-row" id="quick-import">
          <input name="url" placeholder="https://www.airbnb.es/rooms/…" inputmode="url" autocomplete="off" required>
          <button class="btn btn--primary">${icon('wand-sparkles')}Conectar y autocompletar</button>
        </form>
      </section>
      <section class="card">
        <h2>${icon('qr-code')}Tu guía para huéspedes</h2>
        <p class="sub">Enlace público de ${esc(g0.property.name)}</p>
        <div class="qr-box">
          <div class="qr">${qrSvg(guideUrl(g0.id), 4)}</div>
          <div style="flex:1;min-width:180px;display:grid;gap:10px">
            <div class="link-copy"><span style="flex:1">${esc(guideUrl(g0.id))}</span><button data-copy="${esc(guideUrl(g0.id))}" aria-label="Copiar">${icon('copy')}</button></div>
            <a class="btn btn--ghost btn--sm" href="#/huesped/${g0.id}">${icon('send')}Enlace personalizado y QR</a>
          </div>
        </div>
      </section>
    </div>`;

  main.querySelector('#quick-import').addEventListener('submit', (e) => {
    e.preventDefault();
    sessionStorage.setItem('rh:pending-url', e.target.url.value);
    location.hash = '#/nuevo';
  });
};

const SECTION_LABELS = {
  house: 'La casa', wifi: 'WiFi', checkin: 'Check-in / out', nearby: 'Cerca de mí', eat: 'Comer',
  do: 'Qué hacer', move: 'Moverme', emergency: 'Emergencias', contact: 'Contacto', trip: 'Mi viaje',
};
const labelOf = (k) => SECTION_LABELS[k] || k;

// Importador ---------------------------------------------------------------------

const DEMO_IMPORT = {
  ok: true, id: 'demo', url: 'https://www.airbnb.es/rooms/000000',
  name: 'Loft luminoso en Chueca', type: 'Loft', city: 'Madrid', address: 'Calle de Fuencarral, 10, Madrid', rating: 4.92,
  summary: '1 habitación · 1 cama · 1 baño',
  lat: 40.4229, lng: -3.6989,
  photos: [
    'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=900&q=70',
    'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=900&q=70',
    'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=900&q=70',
  ],
  hostName: 'Belén', checkIn: '15:00', checkOut: '11:00',
  amenities: ['Wifi', 'Cocina', 'Lavadora', 'Aire acondicionado', 'Secador de pelo', 'Cafetera'],
  maxGuests: 2, warnings: [], demo: true,
};

views.nuevo = async () => {
  const pending = sessionStorage.getItem('rh:pending-url') || '';
  sessionStorage.removeItem('rh:pending-url');
  const draft = {};
  let map; let marker;

  main.innerHTML = `
    <div class="main__head"><div><h1>Conecta tu anuncio</h1><p>De enlace de Airbnb a guía lista en un par de minutos.</p></div></div>
    <div class="grid grid--2" style="align-items:start">
      <div class="steps">
        <section class="card step" id="s1"><span class="step__num">1</span>
          <h2>${icon('link')}Pega el enlace de tu anuncio</h2>
          <p class="sub">Lo encuentras en Airbnb → tu anuncio → Compartir → Copiar enlace.</p>
          <form class="input-row" id="import-form">
            <input name="url" value="${esc(pending)}" placeholder="https://www.airbnb.es/rooms/…" inputmode="url" autocomplete="off" required>
            <button class="btn btn--primary">${icon('wand-sparkles')}Autocompletar</button>
          </form>
          <p class="small muted" style="margin:10px 2px 0">¿Sin enlace a mano? <a href="#" id="manual">Empieza con la dirección</a> · <a href="#" id="demo">Prueba con un anuncio de ejemplo</a></p>
          <div id="import-out"></div>
        </section>

        <section class="card step" id="s2" hidden><span class="step__num">2</span>
          <h2>${icon('map-pin')}Confirma la ubicación exacta</h2>
          <p class="sub">Airbnb muestra una ubicación aproximada por privacidad. Escribe la dirección o arrastra la chincheta a tu portal.</p>
          <div class="field"><label for="f-name">Nombre del alojamiento</label><input id="f-name"></div>
          <form class="input-row" id="geo-form" style="margin-bottom:6px">
            <input id="f-address" placeholder="Calle, número, ciudad" style="padding-left:14px;background-image:none">
            <button class="btn btn--ghost">${icon('search')}Buscar</button>
          </form>
          <div class="mini-map" id="geo-map"></div>
          <button class="btn btn--primary btn--block" id="to-s3">${icon('sparkles')}Buscar lo mejor de la zona</button>
        </section>

        <section class="card step" id="s3" hidden><span class="step__num">3</span>
          <h2>${icon('sparkles')}Recomendaciones automáticas</h2>
          <p class="sub">Hemos buscado alrededor de tu alojamiento. Marca lo que quieras <b>chinchetar</b> en tu guía; podrás añadir tus favoritos personales después.</p>
          <div id="auto-out"></div>
        </section>

        <section class="card step" id="s4" hidden><span class="step__num">4</span>
          <h2>${icon('key-round')}Lo que Airbnb no sabe</h2>
          <p class="sub">Estos datos son privados y solo los ven tus huéspedes con el enlace.</p>
          <div class="row2">
            <div class="field"><label for="f-ssid">Red WiFi</label><input id="f-ssid"></div>
            <div class="field"><label for="f-pass">Contraseña WiFi</label><input id="f-pass"></div>
          </div>
          <div class="field"><label for="f-building">Acceso al edificio</label><input id="f-building" placeholder="Portal con código 1234#, 3.º B"></div>
          <div class="field"><label for="f-keys">Llaves</label><input id="f-keys" placeholder="Caja de seguridad junto a la puerta, código…"></div>
          <div class="field"><label for="f-phone">Tu WhatsApp (con prefijo)</label><input id="f-phone" placeholder="+34 600 000 000" inputmode="tel"></div>
          <button class="btn btn--fucsia btn--block" id="create">${icon('pin')}Crear mi guía</button>
        </section>
      </div>

      <aside class="card" style="position:sticky;top:20px">
        <h2>${icon('sticky-note')}Así se va montando tu tablón</h2>
        <p class="sub">Cada dato que encontramos se pincha en la guía de tus huéspedes.</p>
        <div class="trip-board cork" style="margin:0;min-height:300px">
          <div class="trip-grid" id="mini-board"><div class="trip-empty">Pega tu enlace ✨</div></div>
        </div>
      </aside>
    </div>`;

  const out = main.querySelector('#import-out');
  const miniBoard = main.querySelector('#mini-board');
  const pinOnBoard = (html, color = 'fucsia') => {
    miniBoard.querySelector('.trip-empty')?.remove();
    const n = miniBoard.children.length;
    miniBoard.insertAdjacentHTML('beforeend', html.replace('%PIN%', `<span class="pin pin--${color}"></span>`).replace('%R%', `--r:${[-3, 2, -1.5, 3, -2.5][n % 5]}deg;--i:${n}`));
    refreshIcons();
  };

  function showImport(data) {
    Object.assign(draft, data);
    const items = [
      ['Título', data.name, 'fucsia'],
      ['Fotos', data.photos?.length ? `${data.photos.length} fotos` : '', 'azul'],
      ['Ubicación', data.lat ? `${data.city || ''} (aprox.)` : '', 'verde'],
      ['Anfitrión', data.hostName, 'amarillo'],
      ['Horarios', data.checkIn ? `Entrada ${data.checkIn} · Salida ${data.checkOut || '—'}` : '', 'fucsia'],
      ['Comodidades', data.amenities?.length ? `${data.amenities.length} encontradas` : '', 'azul'],
    ];
    out.innerHTML = `
      ${data.demo ? `<div class="hint-box" style="margin-top:14px">${icon('info')}Anuncio de ejemplo: así se verá con tu enlace real.</div>` : ''}
      <ul class="import-log">${items.map(([k, v, c], i) => `
        <li style="--i:${i}" class="${v ? '' : 'warn'}"><span class="pin pin--${v ? c : 'amarillo'}"></span>${k}<small>${v ? esc(v) : 'Complétalo tú'}</small></li>`).join('')}
      </ul>`;
    // El mini tablón se va llenando a la vez que el log.
    if (data.photos?.[0]) setTimeout(() => pinOnBoard(`<figure class="polaroid" style="%R%"><span class="tape"></span>${photo(data.photos[0], '', '', '🏠')}<figcaption>${esc(data.name || '')}</figcaption></figure>`), 200);
    setTimeout(() => pinOnBoard(`<div class="note note--verde" style="%R%">%PIN%${icon('house')}<span class="note__title">La casa</span><span class="note__hint">${(data.amenities || []).slice(0, 3).map(esc).join(', ')}</span></div>`, 'azul'), 500);
    if (data.checkIn) setTimeout(() => pinOnBoard(`<div class="note note--fucsia" style="%R%">%PIN%${icon('key-round')}<span class="note__title">Check-in</span><span class="note__hint">Desde las ${esc(data.checkIn)}</span></div>`, 'azul'), 800);

    main.querySelector('#s2').hidden = false;
    main.querySelector('#f-name').value = data.name || '';
    main.querySelector('#f-address').value = data.address || data.city || '';
    setupMap();
  }

  function setupMap() {
    const center = draft.lat ? { lat: draft.lat, lng: draft.lng } : { lat: 40.4168, lng: -3.7038 };
    if (!map) {
      map = createMap(main.querySelector('#geo-map'), center, { zoom: draft.lat ? 16 : 6 });
      if (!map) return;
      marker = window.L.marker([center.lat, center.lng], {
        draggable: true,
        icon: window.L.divIcon({ className: '', html: '<span class="map-pin map-pin--home"><span class="pin pin--fucsia"><i data-lucide="house"></i></span></span>', iconSize: [26, 34], iconAnchor: [13, 32] }),
      }).addTo(map);
      marker.on('dragend', () => { const p = marker.getLatLng(); draft.lat = p.lat; draft.lng = p.lng; draft.located = true; });
      refreshIcons();
    } else {
      map.setView([center.lat, center.lng], 17);
      marker.setLatLng([center.lat, center.lng]);
    }
    main.querySelector('#s2').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function doImport(url) {
    out.innerHTML = '<div class="status status--loading">Leyendo tu anuncio…</div>';
    try {
      const res = await fetch(`api/airbnb?url=${encodeURIComponent(url)}`);
      const data = await res.json().catch(() => null);
      if (!data) throw new Error('El servidor de importación no está disponible en este despliegue (solo web estática).');
      if (!data.ok) throw new Error(data.error);
      showImport(data);
    } catch (err) {
      out.innerHTML = `<div class="hint-box hint-box--warn" style="margin-top:14px">${icon('triangle-alert')}<div><b>No hemos podido leer el anuncio.</b><br>${esc(err.message)}<br>
        <a href="#" data-act="manual">Continúa con la dirección</a> o <a href="#" data-act="demo">prueba el ejemplo</a>.</div></div>`;
      refreshIcons();
    }
  }

  main.querySelector('#import-form').addEventListener('submit', (e) => { e.preventDefault(); doImport(e.target.url.value); });
  main.addEventListener('click', (e) => {
    const a = e.target.closest('#manual, #demo, [data-act]');
    if (!a) return;
    e.preventDefault();
    const act = a.dataset.act || a.id;
    if (act === 'demo') showImport({ ...DEMO_IMPORT });
    else showImport({ name: '', city: '', photos: [], amenities: [], warnings: [] });
  });
  if (pending) doImport(pending);

  main.querySelector('#geo-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = main.querySelector('#f-address').value.trim();
    if (!q) return;
    try {
      const hit = await geocode(q);
      if (!hit) { toast('No encontramos esa dirección', 'x'); return; }
      Object.assign(draft, { lat: hit.lat, lng: hit.lng, address: q, city: draft.city || hit.city, located: true });
      setupMap();
    } catch { toast('Sin conexión con el buscador de direcciones', 'x'); }
  });

  main.querySelector('#to-s3').addEventListener('click', async () => {
    if (!draft.lat) { toast('Primero indica la ubicación', 'map-pin'); return; }
    draft.name = main.querySelector('#f-name').value.trim() || draft.name;
    draft.address = main.querySelector('#f-address').value.trim() || draft.address;
    const s3 = main.querySelector('#s3');
    s3.hidden = false;
    s3.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const auto = main.querySelector('#auto-out');
    auto.innerHTML = '<div class="status status--loading">Buscando restaurantes, farmacias, metro…</div>';

    const groups = [
      { cat: 'restaurant', title: 'Restaurantes mejor valorados', to: 'eat', pre: 4 },
      { cat: 'cafe', title: 'Cafeterías', to: 'eat', pre: 2 },
      { cat: 'attraction', title: 'Qué ver', to: 'do', pre: 4 },
      { cat: 'transit', title: 'Metro y tren', to: 'stations', pre: 3 },
      { cat: 'pharmacy', title: 'Farmacias (se muestran en vivo en "Cerca de mí")', to: null },
      { cat: 'supermarket', title: 'Supermercados (en vivo en "Cerca de mí")', to: null },
      { cat: 'hospital', title: 'Hospital más cercano', to: 'hospital', pre: 1 },
    ];
    const results = await Promise.all(groups.map((g) => findNearby(g.cat, draft.lat, draft.lng, { limit: 8 }).catch(() => ({ places: [], source: 'error' }))));
    draft.auto = {};
    auto.innerHTML = groups.map((g, gi) => {
      const places = results[gi].places;
      draft.auto[g.cat] = places;
      return `<div class="pick-group"><h3>${icon(CATEGORIES[g.cat].icon)}${g.title}</h3>
        <div class="pick-list">${places.length ? places.map((p, i) => `
          <label class="pick">
            ${g.to ? `<input type="checkbox" data-cat="${g.cat}" data-to="${g.to}" data-idx="${i}" ${i < (g.pre || 0) ? 'checked' : ''}>` : `<span>${icon('check')}</span>`}
            <span><b>${esc(p.name)}</b><small>${p.minutes} min a pie${p.address ? ` · ${esc(p.address)}` : ''}${p.cuisine ? ` · ${esc(p.cuisine)}` : ''}</small></span>
            ${p.rating ? `<span class="tag tag--star">★ ${p.rating.toFixed(1)}</span>` : p.is24h ? '<span class="tag tag--green">24h</span>' : ''}
          </label>`).join('') : '<p class="small muted">Nada encontrado en esta categoría.</p>'}</div></div>`;
    }).join('') + `<p class="source">${results.some((r) => r.source === 'google') ? 'Datos y valoraciones: Google Places' : 'Datos © OpenStreetMap — añade una clave de Google Places en el servidor para ordenar por valoraciones'}</p>
      <button class="btn btn--primary btn--block" id="to-s4">${icon('arrow-down')}Siguiente</button>`;
    refreshIcons();

    const restaurant = draft.auto.restaurant[0];
    if (restaurant) pinOnBoard(`<div class="note note--amarillo" style="%R%">%PIN%${icon('utensils')}<span class="note__title">Comer</span><span class="note__hint">${esc(restaurant.name)}</span></div>`);
    const pharmacy = draft.auto.pharmacy[0];
    if (pharmacy) pinOnBoard(`<div class="note note--lila" style="%R%">%PIN%${icon('pill')}<span class="note__title">Cerca de mí</span><span class="note__hint">Farmacia a ${pharmacy.minutes} min</span></div>`, 'verde');

    main.querySelector('#to-s4').addEventListener('click', () => {
      const s4 = main.querySelector('#s4');
      s4.hidden = false;
      s4.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  main.querySelector('#create').addEventListener('click', async () => {
    const picked = { eat: [], do: [], stations: [], hospital: [] };
    main.querySelectorAll('#auto-out input[type=checkbox]:checked').forEach((cb) => {
      const p = draft.auto[cb.dataset.cat][Number(cb.dataset.idx)];
      picked[cb.dataset.to].push({ ...p, category: CATEGORIES[cb.dataset.cat].label.es });
    });
    const val = (id) => main.querySelector(id).value.trim();
    const guide = await newGuideFrom({
      ...draft,
      wifiSsid: val('#f-ssid'), wifiPass: val('#f-pass'), building: val('#f-building'), keys: val('#f-keys'), phone: val('#f-phone'),
      eat: picked.eat.map((p) => ({ id: p.id, name: p.name, category: p.category, desc: '', lat: p.lat, lng: p.lng, photo: '', rating: p.rating, reviews: p.reviews })),
      do: picked.do.map((p) => ({ id: p.id, name: p.name, category: 'Imprescindibles', desc: '', lat: p.lat, lng: p.lng, photo: '' })),
      stations: picked.stations.map((p) => ({ name: p.name, lines: '', minutes: p.minutes })),
      hospital: picked.hospital[0] ? { name: picked.hospital[0].name, desc: picked.hospital[0].address || 'Urgencias', lat: picked.hospital[0].lat, lng: picked.hospital[0].lng } : null,
    });
    saveGuide(guide);
    toast('¡Guía creada y pinchada en tu tablón!', 'sparkles');
    location.hash = `#/editar/${guide.id}`;
  });
};

// Editor ---------------------------------------------------------------------------

const F = {
  text: (path, label, opts = {}) => ({ type: 'text', path, label, ...opts }),
  area: (path, label, opts = {}) => ({ type: 'area', path, label, ...opts }),
  lines: (path, label, opts = {}) => ({ type: 'lines', path, label, ...opts }),
  pairs: (path, label, keys, opts = {}) => ({ type: 'pairs', path, label, keys, ...opts }),
};

const EDITOR_GROUPS = [
  { icon: 'house', title: 'Alojamiento', open: true, fields: [
    F.text('property.name', 'Nombre'), F.text('property.tagline', 'Frase de bienvenida'),
    F.text('property.address', 'Dirección'), F.text('property.city', 'Ciudad'),
    { type: 'photos', path: 'property.photos', label: 'Fotos', hint: 'La primera es la portada (la polaroid del tablón). Puedes subir las tuyas.' },
  ] },
  { icon: 'user', title: 'Anfitrión y contacto', fields: [
    { type: 'photo1', path: 'host.photo', label: 'Tu foto (opcional)' },
    F.text('host.name', 'Nombre'), F.text('host.whatsapp', 'WhatsApp (solo números con prefijo)'),
    F.text('host.phone', 'Teléfono'), F.text('host.email', 'Email'), F.text('host.responseHours', 'Horario de respuesta'),
  ] },
  { icon: 'wifi', title: 'WiFi', fields: [F.text('wifi.ssid', 'Red'), F.text('wifi.password', 'Contraseña'), F.area('wifi.notes', 'Notas')] },
  { icon: 'key-round', title: 'Check-in / Check-out', fields: [
    F.text('checkin.from', 'Check-in desde'), F.text('checkin.to', 'Check-in hasta'), F.text('checkin.checkoutBy', 'Check-out antes de'),
    F.area('checkin.building', 'Acceso al edificio'), F.area('checkin.keys', 'Llaves'), F.area('checkin.luggage', 'Equipaje'),
    F.lines('checkin.checkoutSteps', 'Antes de irte (una tarea por línea)'),
  ] },
  { icon: 'sofa', title: 'La casa', fields: [
    F.pairs('house.howItWorks', 'Cómo funciona (Título: explicación)', ['title', 'text']),
    F.lines('house.rules', 'Normas (una por línea)'), F.lines('house.equipment', 'Equipamiento (uno por línea)'),
    F.area('house.trash', 'Basura y reciclaje'), F.area('house.manual', 'Manual rápido'),
  ] },
  { icon: 'bus', title: 'Moverme', fields: [
    F.pairs('transport.taxiPhones', 'Radio-taxi (Nombre: teléfono)', ['name', 'phone']),
    F.pairs('transport.airport', 'Aeropuerto (Opción: explicación)', ['title', 'text']),
  ] },
];

function fieldHtml(f, g) {
  const v = getPath(g, f.path);
  const id = `f-${f.path.replace(/\./g, '-')}`;
  const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
  let input;
  if (f.type === 'text') input = `<input id="${id}" data-path="${f.path}" data-type="text" value="${esc(v ?? '')}">`;
  if (f.type === 'area') input = `<textarea id="${id}" data-path="${f.path}" data-type="text">${esc(v ?? '')}</textarea>`;
  if (f.type === 'lines') input = `<textarea id="${id}" data-path="${f.path}" data-type="lines">${esc((v || []).join('\n'))}</textarea>`;
  if (f.type === 'pairs') input = `<textarea id="${id}" data-path="${f.path}" data-type="pairs" data-keys="${f.keys.join(',')}">${esc((v || []).map((o) => `${o[f.keys[0]]}: ${o[f.keys[1]]}`).join('\n'))}</textarea>`;
  if (f.type === 'photos') {
    input = `<div class="photo-grid">${(v || []).map((src, i) => `
      <figure class="photo-grid__item${i === 0 ? ' is-cover' : ''}">${photo(src, '', '', '🖼️')}
        ${i === 0 ? '<span class="photo-grid__badge">Portada</span>' : `<button type="button" class="icon-btn" data-photo-cover="${i}" title="Usar de portada">${icon('star')}</button>`}
        <button type="button" class="icon-btn photo-grid__rm" data-photo-rm="${i}" title="Quitar">${icon('x')}</button>
      </figure>`).join('')}
      <label class="photo-grid__add">${icon('image-plus')}<span>Subir fotos</span><input type="file" accept="image/*" multiple data-photo-upload hidden></label>
    </div>`;
  }
  if (f.type === 'photo1') {
    input = `<div class="photo-one">${v ? `<img src="${esc(v)}" alt="">` : `<span class="host__avatar" style="width:64px;height:64px;font-size:2rem;border-width:3px">${esc((g.host?.name || '?')[0])}</span>`}
      <label class="btn btn--ghost btn--sm">${icon('camera')}${v ? 'Cambiar' : 'Subir foto'}<input type="file" accept="image/*" data-host-photo hidden></label>
      ${v ? `<button type="button" class="btn btn--ghost btn--sm" data-host-photo-rm>${icon('trash-2')}</button>` : ''}</div>`;
  }
  return `<div class="field${empty ? ' is-missing' : ''}"><label for="${id}">${f.label}</label>${input}${f.hint ? `<small>${f.hint}</small>` : ''}</div>`;
}

function recoEditor(g, kind) {
  const items = g.recommendations?.[kind] || [];
  return `<div class="reco-edit" data-reco="${kind}">
    ${items.map((p, i) => `<div class="reco-edit__item">
      <span><b>${esc(p.name)}</b><small>${esc(p.category || '')}${p.rating ? ` · ★ ${p.rating}` : ''}</small>
        <input class="reco-edit__note" data-reco-desc="${kind}:${i}" value="${esc(p.desc || '')}" placeholder="Tu nota para el huésped (sale en un pósit)…"></span>
      <span class="reco-edit__btns">
        <button class="icon-btn" data-reco-move="${kind}:${i}:-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${icon('arrow-up')}</button>
        <button class="icon-btn" data-reco-move="${kind}:${i}:1" aria-label="Bajar" ${i === items.length - 1 ? 'disabled' : ''}>${icon('arrow-down')}</button>
        <button class="icon-btn" data-reco-pick="${kind}:${i}" aria-label="Favorito" title="Favorito del anfitrión" style="${p.hostPick ? 'color:var(--fucsia);background:#ffe4ec' : ''}">${icon('heart')}</button>
        <button class="icon-btn" data-reco-remove="${kind}:${i}" aria-label="Quitar">${icon('trash-2')}</button>
      </span></div>`).join('') || '<p class="small muted">Aún no hay recomendaciones.</p>'}
  </div>
  <div class="row2">
    <button class="btn btn--ghost btn--sm" data-reco-auto="${kind}">${icon('sparkles')}Sugerir automáticamente</button>
    <button class="btn btn--ghost btn--sm" data-reco-add="${kind}">${icon('plus')}Añadir a mano</button>
  </div>`;
}

views.editar = async (id) => {
  let g;
  try { g = structuredClone(await loadGuide(id)); } catch { main.innerHTML = '<p>Guía no encontrada.</p>'; return; }
  const previewSrc = () => `${guideUrl(g.id, { embed: '1', g: 'Laura' })}&t=${Date.now()}`;

  const render = () => {
    const open = [...main.querySelectorAll('#editor-form > details')].map((d) => d.open);
    main.innerHTML = `
      <div class="main__head">
        <div><h1>${esc(g.property.name)}</h1><p>Edita tu guía · los cambios se ven en el móvil de la derecha al guardar.</p></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <a class="btn btn--ghost" href="${guideUrl(g.id)}" target="_blank" rel="noopener">${icon('external-link')}Abrir guía</a>
          <a class="btn btn--ghost" href="print.html?guide=${encodeURIComponent(g.id)}" target="_blank" rel="noopener">${icon('printer')}Guía en PDF</a>
          <a class="btn btn--primary" href="#/huesped/${g.id}">${icon('send')}Enviar al huésped</a>
        </div>
      </div>
      <div class="editor">
        <form id="editor-form" class="grid">
          ${EDITOR_GROUPS.map((grp) => `
            <details class="card"${grp.open ? ' open' : ''}>
              <summary>${icon(grp.icon)}${grp.title}${icon('chevron-right', 'chev')}</summary>
              <div class="card__body">${grp.fields.map((f) => fieldHtml(f, g)).join('')}</div>
            </details>`).join('')}
          <details class="card" open>
            <summary>${icon('utensils')}Comer · tus recomendaciones${icon('chevron-right', 'chev')}</summary>
            <div class="card__body">${recoEditor(g, 'eat')}</div>
          </details>
          <details class="card">
            <summary>${icon('camera')}Qué hacer${icon('chevron-right', 'chev')}</summary>
            <div class="card__body">${recoEditor(g, 'do')}</div>
          </details>
          <div class="save-bar">
            ${g.id === DEMO_ID ? `<button type="button" class="btn btn--ghost" id="reset">${icon('rotate-ccw')}Restaurar demo</button>` : `<button type="button" class="btn btn--ghost" id="delete">${icon('trash-2')}Borrar</button>`}
            <button class="btn btn--primary">${icon('save')}Guardar cambios</button>
          </div>
        </form>
        <aside class="preview" aria-label="Vista previa en el móvil">
          <div class="phone"><iframe id="preview" title="Vista previa de la guía" src="${previewSrc()}"></iframe></div>
        </aside>
      </div>`;
    if (open.length) main.querySelectorAll('#editor-form > details').forEach((d, i) => { d.open = open[i]; });
    refreshIcons();
  };

  const readForm = () => {
    main.querySelectorAll('[data-path]').forEach((el) => {
      const { path, type } = el.dataset;
      const lines = el.value.split('\n').map((s) => s.trim()).filter(Boolean);
      if (type === 'text') setPath(g, path, el.value.trim());
      if (type === 'lines') setPath(g, path, lines);
      if (type === 'pairs') {
        const [k1, k2] = el.dataset.keys.split(',');
        setPath(g, path, lines.map((l) => { const i = l.indexOf(':'); return i < 0 ? { [k1]: l, [k2]: '' } : { [k1]: l.slice(0, i).trim(), [k2]: l.slice(i + 1).trim() }; }));
      }
    });
    main.querySelectorAll('[data-reco-desc]').forEach((el) => {
      const [kind, i] = el.dataset.recoDesc.split(':');
      const it = g.recommendations[kind]?.[i];
      if (it) it.desc = el.value.trim();
    });
    g.host.whatsapp = String(g.host.whatsapp || '').replace(/\D/g, '');
  };

  // read=false cuando ya se leyó el formulario antes de mover/quitar filas
  // (si no, las notas se reasignarían por posición a la fila equivocada).
  const save = (read = true) => {
    if (read) readForm();
    if (!saveGuide(g)) { toast('No cabe: en el prototipo las fotos se guardan en el navegador. Quita alguna.', 'triangle-alert'); return false; }
    main.querySelector('#preview').src = previewSrc();
    toast('Guardado ✓ tu tablón está al día');
    return true;
  };
  main.addEventListener('change', async (e) => {
    const up = e.target.closest('[data-photo-upload]');
    const hp = e.target.closest('[data-host-photo]');
    if (!up && !hp) return;
    readForm();
    const files = [...e.target.files].slice(0, 8);
    toast('Preparando fotos…', 'image');
    if (up) {
      for (const f of files) g.property.photos = [...(g.property.photos || []), await compressImage(f, 1280)];
    } else if (files[0]) g.host.photo = await compressImage(files[0], 360);
    save(false);
    render();
  });

  render();
  main.addEventListener('submit', (e) => { if (e.target.id === 'editor-form') { e.preventDefault(); save(); } });
  main.addEventListener('click', async (e) => {
    const rm = e.target.closest('[data-reco-remove]');
    const auto = e.target.closest('[data-reco-auto]');
    const add = e.target.closest('[data-reco-add]');
    if (e.target.closest('#reset')) { deleteLocalGuide(g.id); g = structuredClone(await loadGuide(g.id)); render(); toast('Demo restaurada'); return; }
    if (e.target.closest('#delete')) { if (confirm('¿Borrar esta guía?')) { deleteLocalGuide(g.id); location.hash = '#/'; } return; }
    const ph = e.target.closest('[data-photo-rm], [data-photo-cover], [data-host-photo-rm], [data-reco-move], [data-reco-pick]');
    if (ph) {
      e.preventDefault();
      readForm();
      const d = ph.dataset;
      if (d.photoRm != null) g.property.photos.splice(Number(d.photoRm), 1);
      if (d.photoCover != null) g.property.photos.unshift(...g.property.photos.splice(Number(d.photoCover), 1));
      if (d.hostPhotoRm != null) g.host.photo = '';
      if (d.recoMove) {
        const [kind, i, dir] = d.recoMove.split(':');
        const arr = g.recommendations[kind];
        const j = Number(i) + Number(dir);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      if (d.recoPick) { const [kind, i] = d.recoPick.split(':'); const it = g.recommendations[kind][i]; it.hostPick = !it.hostPick; }
      save(false);
      render();
      return;
    }
    if (!rm && !auto && !add) return;
    e.preventDefault();
    readForm();
    if (rm) {
      const [kind, i] = rm.dataset.recoRemove.split(':');
      g.recommendations[kind].splice(Number(i), 1);
    }
    if (add) {
      const kind = add.dataset.recoAdd;
      const name = prompt('Nombre del sitio');
      if (!name) return;
      const desc = prompt('¿Por qué lo recomiendas? (opcional)') || '';
      const hit = await geocode(`${name}, ${g.property.city}`).catch(() => null);
      g.recommendations[kind] = g.recommendations[kind] || [];
      g.recommendations[kind].push({ id: `own-${Date.now()}`, name, desc, category: kind === 'eat' ? 'Restaurantes' : 'Imprescindibles', lat: hit?.lat ?? g.property.lat, lng: hit?.lng ?? g.property.lng, photo: '', hostPick: true });
    }
    if (auto) {
      const kind = auto.dataset.recoAuto;
      auto.disabled = true;
      auto.innerHTML = `${icon('loader')}Buscando…`;
      refreshIcons();
      try {
        const cat = kind === 'eat' ? 'restaurant' : 'attraction';
        const { places } = await findNearby(cat, g.property.lat, g.property.lng, { limit: 10 });
        const have = new Set((g.recommendations[kind] || []).map((p) => p.name));
        const fresh = places.filter((p) => !have.has(p.name)).slice(0, 4);
        g.recommendations[kind] = [...(g.recommendations[kind] || []), ...fresh.map((p) => ({
          id: p.id, name: p.name, category: CATEGORIES[cat].label.es, desc: '', lat: p.lat, lng: p.lng, photo: '', rating: p.rating, reviews: p.reviews,
        }))];
        toast(`${fresh.length} sitios añadidos`, 'sparkles');
      } catch { toast('No se pudo buscar ahora', 'x'); }
    }
    save(false);
    render();
  });
};

// Enviar al huésped ---------------------------------------------------------------

views.huesped = async (id) => {
  const g = await loadGuide(id);
  const today = new Date().toISOString().slice(0, 10);
  const plus = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  main.innerHTML = `
    <div class="main__head"><div><h1>Enviar al huésped</h1><p>${esc(g.property.name)} · un enlace personalizado con su nombre y sus fechas.</p></div></div>
    <div class="grid grid--2" style="align-items:start">
      <section class="card">
        <h2>${icon('user')}Datos de la reserva</h2>
        <p class="sub">El huésped verá "¡Hola, Laura!", sus noches en el ticket del tablón y los días para montar su viaje.</p>
        <div class="field"><label for="gname">Nombre del huésped</label><input id="gname" value="Laura"></div>
        <div class="row2">
          <div class="field"><label for="gin">Llegada</label><input type="date" id="gin" value="${today}"></div>
          <div class="field"><label for="gout">Salida</label><input type="date" id="gout" value="${plus(today, 3)}"></div>
        </div>
        <div class="field"><label for="gphone">Teléfono del huésped (opcional, para WhatsApp)</label><input id="gphone" placeholder="+44 7…" inputmode="tel"></div>
        <div class="field"><label for="gmsg">Mensaje</label><textarea id="gmsg" style="min-height:120px"></textarea></div>
        <div class="actions actions--2">
          <a class="btn btn--verde" id="send-wa" target="_blank" rel="noopener">${icon('message-circle')}Enviar por WhatsApp</a>
          <button class="btn btn--ghost" id="copy-msg">${icon('copy')}Copiar mensaje</button>
        </div>
      </section>
      <section class="card">
        <h2>${icon('qr-code')}QR para el alojamiento</h2>
        <p class="sub">Imprímelo y déjalo en la entrada o en la nevera: abre la guía general (sin datos personales).</p>
        <div class="qr-box" style="justify-content:center">
          <div class="qr" id="qr-general">${qrSvg(guideUrl(g.id), 6)}</div>
        </div>
        <div class="actions actions--2">
          <button class="btn btn--primary" id="print">${icon('printer')}Imprimir cartel</button>
          <button class="btn btn--ghost" id="dl-qr">${icon('download')}Descargar QR</button>
        </div>
        <a class="btn btn--ghost btn--block" style="margin-top:10px" href="print.html?guide=${encodeURIComponent(g.id)}" target="_blank" rel="noopener">${icon('book-open')}Guía completa imprimible (PDF, A4)</a>
        <div class="link-copy" style="margin-top:14px"><span style="flex:1" id="glink"></span><button id="copy-link" aria-label="Copiar">${icon('copy')}</button></div>
      </section>
    </div>`;
  refreshIcons();

  const $ = (s) => main.querySelector(s);
  const update = () => {
    const extra = { g: $('#gname').value.trim() };
    if ($('#gin').value && $('#gout').value) Object.assign(extra, { in: $('#gin').value, out: $('#gout').value });
    const link = guideUrl(g.id, extra);
    $('#glink').textContent = link;
    if (!$('#gmsg').dataset.touched) {
      $('#gmsg').value = `¡Hola ${extra.g || ''}! 👋 Soy ${g.host.name}, tu anfitriona en ${g.property.name}.\n\nAquí tienes tu guía con todo lo que necesitas (check-in, WiFi, mis sitios favoritos y cómo moverte) — y puedes montarte tu propio tablón de viaje ♡\n\n${link}\n\n¡Nos vemos pronto!`;
    }
    $('#send-wa').href = $('#gphone').value.trim()
      ? whatsappLink($('#gphone').value, $('#gmsg').value)
      : `https://wa.me/?text=${encodeURIComponent($('#gmsg').value)}`;
  };
  ['#gname', '#gin', '#gout', '#gphone'].forEach((s) => $(s).addEventListener('input', update));
  $('#gmsg').addEventListener('input', (e) => { e.target.dataset.touched = '1'; update(); });
  update();

  $('#copy-link').addEventListener('click', async () => { if (await copyText($('#glink').textContent)) toast('Enlace copiado'); });
  $('#copy-msg').addEventListener('click', async () => { if (await copyText($('#gmsg').value)) toast('Mensaje copiado'); });
  $('#dl-qr').addEventListener('click', () => downloadQr($('#qr-general svg'), `qr-${g.id}.png`));
  $('#print').addEventListener('click', () => printPoster(g));
};

function downloadQr(svg, filename) {
  const size = 1024;
  const img = new Image();
  const xml = new XMLSerializer().serializeToString(svg);
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 48, 48, size - 96, size - 96);
    const a = document.createElement('a');
    a.href = c.toDataURL('image/png');
    a.download = filename;
    a.click();
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

function printPoster(g) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cartel QR</title>
    <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nunito:wght@800;900&display=swap" rel="stylesheet">
    <style>
      body{margin:0;font-family:Nunito,sans-serif;display:grid;place-items:center;min-height:100vh;background:#fff}
      .card{width:120mm;padding:14mm;border-radius:6mm;background:#fff0a3;text-align:center;position:relative;box-shadow:0 0 0 1px #e5d47a}
      .pin{position:absolute;top:-5mm;left:calc(50% - 4mm);width:8mm;height:8mm;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 1mm,#ff3a72 2mm)}
      h1{font-family:Caveat,cursive;font-size:15mm;margin:0;line-height:1}
      p{margin:3mm 0 6mm;font-weight:800;color:#5b6475}
      svg{width:70mm;height:70mm;background:#fff;padding:4mm;border-radius:3mm}
      .brand{margin-top:6mm;font-weight:900;color:#105cb1}
      @media print{@page{margin:0}}
    </style></head><body>
    <div class="card"><span class="pin"></span><h1>Tu guía de ${esc(g.property.city || 'viaje')} ♡</h1>
    <p>Escanea y descubre WiFi, check-out, mis sitios favoritos<br>y monta tu propio tablón de viaje</p>
    ${qrSvg(guideUrl(g.id), 8)}
    <div class="brand">retorika Home</div></div>
    <script>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script></body></html>`);
  w.document.close();
}

// Analíticas ----------------------------------------------------------------------

views.analiticas = async () => {
  const guides = await allGuides();
  main.innerHTML = `
    <div class="main__head"><div><h1>Analíticas</h1><p>Qué consultan tus huéspedes para anticiparte (y recibir menos mensajes).</p></div></div>
    <div class="grid">
      ${guides.map((g) => {
        const s = getStats(g.id);
        const entries = Object.entries(s.sections).sort((a, b) => b[1] - a[1]);
        const max = Math.max(1, ...entries.map((e) => e[1]));
        return `<section class="card">
          <h2>${icon('house')}${esc(g.property.name)}</h2>
          <p class="sub">Última apertura: ${s.lastOpen ? new Date(s.lastOpen).toLocaleString('es-ES') : '—'}</p>
          <div class="grid grid--4" style="margin-bottom:16px">
            <div class="stat" style="box-shadow:none;background:#f6f8fc"><small>Aperturas</small><b>${s.opens}</b></div>
            <div class="stat" style="box-shadow:none;background:#f6f8fc"><small>Secciones vistas</small><b>${entries.reduce((a, e) => a + e[1], 0)}</b></div>
            <div class="stat" style="box-shadow:none;background:#f6f8fc"><small>Guardados ♡</small><b>${s.saves}</b></div>
            <div class="stat" style="box-shadow:none;background:#f6f8fc"><small>Contactos</small><b>${s.contacts}</b></div>
          </div>
          <div class="bars">${entries.length ? entries.map(([k, v]) => `
            <div class="bar"><span>${esc(labelOf(k))}</span><span class="bar__track"><span class="bar__fill" style="display:block;width:${(v / max) * 100}%"></span></span><span>${v}</span></div>`).join('')
            : '<p class="small muted">Aún sin datos: abre la guía y navega por las secciones para verlas aquí.</p>'}</div>
          ${(s.questions || []).length ? `
          <h3 style="margin:20px 0 8px;font-size:1rem;font-weight:900">${icon('message-circle-question')} Lo que preguntan tus huéspedes</h3>
          <p class="small muted" style="margin:0 0 10px">Las que la guía no supo responder son ideas para completarla (y recibir menos mensajes).</p>
          <div class="reco-edit">${s.questions.slice(0, 12).map((q) => `
            <div class="reco-edit__item" style="${q.answered ? '' : 'background:#fff8e6;border-color:#ffd98a'}">
              <span><b>"${esc(q.q)}"</b><small>${new Date(q.at).toLocaleString('es-ES')}</small></span>
              ${q.answered ? '<span class="badge">Respondida</span>' : `<a class="btn btn--ghost btn--sm" href="#/editar/${g.id}">${icon('plus')}Añadir a la guía</a>`}
            </div>`).join('')}</div>` : ''}
        </section>`;
      }).join('')}
      <div class="hint-box">${icon('info')}<div>En este prototipo las métricas se guardan en el navegador. En producción se envían a la base de datos (ver docs/CONCEPTO.md).
        <br><button class="btn btn--ghost btn--sm" id="seed" style="margin-top:8px">${icon('sparkles')}Cargar datos de ejemplo para una demo</button></div></div>
    </div>`;
  main.querySelector('#seed').addEventListener('click', () => { seedDemoStats(DEMO_ID); route(); });
};

// Router ---------------------------------------------------------------------------

async function route() {
  const [, view = '', arg] = location.hash.replace(/^#\/?/, '#/').split('/');
  const name = views[view] ? view : 'resumen';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    a.classList.toggle('is-active', a.dataset.nav === name);
    if (a.dataset.nav === name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  // Clona <main> para soltar los listeners de la vista anterior.
  const fresh = main.cloneNode(false);
  main.replaceWith(fresh);
  main = fresh;
  await views[name](arg ? decodeURIComponent(arg) : undefined);
  refreshIcons();
  main.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => { if (await copyText(b.dataset.copy)) toast('Copiado'); }));
  scrollTo({ top: 0 });
}

addEventListener('hashchange', route);
route();

/** Reduce una imagen a `max` px y la devuelve como JPEG en data URL. */
function compressImage(file, max) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
