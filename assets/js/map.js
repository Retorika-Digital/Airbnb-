// Mapas Leaflet con marcadores en forma de chincheta (a juego con el tablón).
/* global L */

const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>';

export function createMap(el, center, { zoom = 15, interactive = true } = {}) {
  if (!window.L) {
    el.innerHTML = '<div class="status">Mapa no disponible sin conexión</div>';
    return null;
  }
  const map = L.map(el, {
    zoomControl: interactive,
    attributionControl: true,
    scrollWheelZoom: false,
    dragging: interactive,
    tap: interactive,
  }).setView([center.lat, center.lng], zoom);
  L.tileLayer(TILES, { attribution: ATTR, maxZoom: 19, subdomains: 'abcd' }).addTo(map);
  // Leaflet calcula mal el tamaño si el contenedor aún está animándose.
  setTimeout(() => map.invalidateSize(), 450);
  return map;
}

export function homeMarker(map, pos, title = '') {
  if (!map) return null;
  const icon = L.divIcon({
    className: '',
    html: '<span class="map-pin map-pin--home"><span class="pin pin--azul"><i data-lucide="house"></i></span></span>',
    iconSize: [26, 34], iconAnchor: [13, 32], popupAnchor: [0, -28],
  });
  return L.marker([pos.lat, pos.lng], { icon, title, zIndexOffset: 1000 }).addTo(map);
}

export function pinMarker(map, pos, { color = 'fucsia', label = '', popup = '' } = {}) {
  if (!map) return null;
  const icon = L.divIcon({
    className: '',
    html: `<span class="map-pin ${label ? 'map-pin--num' : ''}"><span class="pin pin--${color}">${label}</span></span>`,
    iconSize: [26, 34], iconAnchor: [13, 32], popupAnchor: [0, -28],
  });
  const m = L.marker([pos.lat, pos.lng], { icon }).addTo(map);
  if (popup) m.bindPopup(popup);
  return m;
}

export function fitTo(map, points, padding = 30) {
  if (!map || !points.length) return;
  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], 16);
    return;
  }
  map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [padding, padding] });
}

/** Hilo rojo entre los sitios de "Mi viaje". */
export function yarn(map, points) {
  if (!map || points.length < 2) return null;
  return L.polyline(points.map((p) => [p.lat, p.lng]), {
    color: '#e0174d', weight: 3, opacity: .9, dashArray: '1 7', lineCap: 'round',
  }).addTo(map);
}
