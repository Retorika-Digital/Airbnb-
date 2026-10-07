// Service worker: la guía sigue funcionando sin datos (turistas en roaming).
// - App y guías: "network first" con copia en caché.
// - Mapas, fotos y fuentes: "stale-while-revalidate".
const VERSION = 'rh-v1';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'assets/css/base.css', 'assets/css/guide.css',
  'assets/js/app.js', 'assets/js/board.js', 'assets/js/sections.js', 'assets/js/i18n.js', 'assets/js/store.js',
  'assets/js/util.js', 'assets/js/places.js', 'assets/js/places-config.js', 'assets/js/mobility.js', 'assets/js/map.js',
  'assets/vendor/lucide.min.js', 'assets/vendor/leaflet/leaflet.js', 'assets/vendor/leaflet/leaflet.css', 'assets/vendor/qrcode.js',
  'assets/img/logo.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const staleWhileRevalidate = async (req) => {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit || net;
};

const networkFirst = async (req) => {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req, { ignoreSearch: req.mode === 'navigate' })) || Response.error();
  }
};

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (/basemaps\.cartocdn\.com|images\.unsplash\.com|muscache\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    e.respondWith(staleWhileRevalidate(request));
  } else if (url.origin === location.origin && !url.pathname.includes('/api/')) {
    e.respondWith(networkFirst(request));
  }
});
