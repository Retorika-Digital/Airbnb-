// Guía imprimible (A4): portada, WiFi, llegada/salida, la casa,
// recomendaciones con QR para abrir cada sitio en el mapa, transporte y
// emergencias. Pensada para dejarla en el piso o enviar como PDF.
import { loc, setLang } from './i18n.js';
import { esc, qrSvg, params } from './util.js';
import { loadGuide } from './store.js';
import { directionsLink } from './mobility.js';

const book = document.getElementById('book');
const id = params.get('guide') || 'granvia';
setLang(params.get('lang') || 'es');

const guideUrl = () => {
  const u = new URL('index.html', location.href);
  u.search = `?guide=${encodeURIComponent(id)}`;
  return u.toString();
};
const list = (arr) => `<ul>${(arr || []).map((x) => `<li>${esc(loc(x))}</li>`).join('')}</ul>`;
const wifiString = (w) => `WIFI:T:${w.security || 'WPA'};S:${String(w.ssid).replace(/([\\;,:"])/g, '\\$1')};P:${String(w.password).replace(/([\\;,:"])/g, '\\$1')};;`;

function places(title, items, g) {
  if (!items?.length) return '';
  return `<section class="page-block"><h2>${title}</h2><div class="pgrid">
    ${items.map((p) => `<article class="pcard">
      <div class="pcard__qr">${qrSvg(directionsLink({ origin: { lat: g.property.lat, lng: g.property.lng }, destination: p, mode: 'walking' }), 2)}</div>
      <div><b>${esc(p.name)}</b>${p.hostPick ? ' <span class="heart">♥</span>' : ''}<small>${esc(loc(p.category) || '')}</small>
      ${p.desc ? `<p class="hand">“${esc(loc(p.desc))}”</p>` : ''}</div>
    </article>`).join('')}
  </div><p class="tip">Escanea el QR de cada sitio para ver cómo llegar andando.</p></section>`;
}

async function render() {
  const g = await loadGuide(id);
  document.title = `${g.property.name} · Guía`;
  const c = g.checkin || {};
  const h = g.house || {};
  const w = g.wifi || {};
  const tr = g.transport || {};
  book.innerHTML = `
    <section class="sheet-a4 cover">
      <div class="cover__photo">${g.property.photos?.[0] ? `<img src="${esc(g.property.photos[0])}" alt="">` : ''}<span class="tape"></span></div>
      <h1 class="hand">${esc(g.property.name)}</h1>
      <p class="cover__tag hand">${esc(loc(g.property.tagline) || '')} ♡</p>
      <p class="cover__addr">${esc(g.property.address)}</p>
      <div class="cover__qr">${qrSvg(guideUrl(), 4)}<div><b>Tu guía en el móvil</b><span>WiFi, mapas en vivo, recomendaciones y tu propio tablón de viaje.</span></div></div>
      <div class="cover__brand"><img src="assets/img/logo.svg" alt=""> retorika <b>Home</b></div>
    </section>

    <section class="sheet-a4">
      <div class="two">
        <div class="box box--green">
          <h2>WiFi</h2>
          <p class="label">Red</p><p class="big">${esc(w.ssid)}</p>
          <p class="label">Contraseña</p><p class="big hand pass">${esc(w.password)}</p>
          <div class="qr-small">${w.ssid ? qrSvg(wifiString(w), 3) : ''}<span>Escanea para conectarte</span></div>
        </div>
        <div class="box box--pink">
          <h2>Llegada y salida</h2>
          <p class="label">Check-in</p><p class="big">${esc(c.from)}${c.to ? ` – ${esc(c.to)}` : ''}</p>
          <p class="label">Check-out</p><p class="big">antes de las ${esc(c.checkoutBy)}</p>
          ${c.building ? `<p class="label">Acceso</p><p>${esc(loc(c.building))}</p>` : ''}
          ${c.keys ? `<p class="label">Llaves</p><p>${esc(loc(c.keys))}</p>` : ''}
        </div>
      </div>
      ${(c.checkoutSteps || []).length ? `<div class="box"><h2>Antes de irte</h2><ul class="checks">${c.checkoutSteps.map((s) => `<li>${esc(loc(s))}</li>`).join('')}</ul></div>` : ''}
      <div class="box box--blue">
        <h2>La casa</h2>
        ${(h.howItWorks || []).map((x) => `<p><b>${esc(loc(x.title))}.</b> ${esc(loc(x.text))}</p>`).join('')}
        <div class="two">
          <div><h3>Normas</h3>${list(h.rules)}</div>
          <div><h3>Equipamiento</h3>${list(h.equipment)}</div>
        </div>
        ${h.trash ? `<h3>Basura y reciclaje</h3><p>${esc(loc(h.trash))}</p>` : ''}
        ${h.manual ? `<h3>Manual rápido</h3><p>${esc(loc(h.manual))}</p>` : ''}
      </div>
    </section>

    <section class="sheet-a4">
      ${places('Dónde comer', g.recommendations?.eat, g)}
      ${places('Qué hacer', g.recommendations?.do, g)}
    </section>

    <section class="sheet-a4">
      <div class="two">
        <div class="box box--blue">
          <h2>Moverte</h2>
          ${(tr.nearestStations || []).length ? `<h3>Estaciones cercanas</h3><ul>${tr.nearestStations.map((s) => `<li><b>${esc(s.name)}</b> ${esc(s.lines || '')} · ${s.minutes} min</li>`).join('')}</ul>` : ''}
          ${(tr.taxiPhones || []).length ? `<h3>Taxi</h3><ul>${tr.taxiPhones.map((t) => `<li>${esc(t.name)}: <b>${esc(t.phone)}</b></li>`).join('')}</ul>` : ''}
          ${(tr.airport || []).length ? `<h3>Aeropuerto</h3><ul>${tr.airport.map((a) => `<li><b>${esc(loc(a.title))}</b>: ${esc(loc(a.text))}</li>`).join('')}</ul>` : ''}
          <div class="driver"><span>Para el taxista</span><b>${esc(g.property.address)}</b></div>
        </div>
        <div class="box box--red">
          <h2>Emergencias</h2>
          <ul class="sos">${(g.emergencies || []).map((e) => `<li><b>${esc(e.phone)}</b> ${esc(loc(e.name))}</li>`).join('')}</ul>
          ${g.hospital ? `<h3>Hospital más cercano</h3><p>${esc(g.hospital.name)}<br><small>${esc(loc(g.hospital.desc) || '')}</small></p>` : ''}
          <h3>Tu anfitrión</h3>
          <p class="host"><b>${esc(g.host?.name)}</b><br>WhatsApp: ${esc(g.host?.phone || g.host?.whatsapp || '')}<br>${esc(g.host?.email || '')}<br><small>Respondo de ${esc(g.host?.responseHours || '')}</small></p>
        </div>
      </div>
      <p class="bye hand">¡Disfruta tu viaje! ♡</p>
    </section>`;
  if (params.get('auto')) document.fonts.ready.then(() => setTimeout(() => print(), 400));
}

render().catch((e) => { book.innerHTML = `<p style="padding:40px">${esc(e.message)}</p>`; });
