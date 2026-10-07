// Lugares cercanos, geocodificación y tiempo — lado navegador.
// Orden de proveedores:
//   1. /api/places (servidor propio → Google Places si hay clave, con valoraciones)
//   2. Overpass (OpenStreetMap) directamente desde el navegador, sin clave
import { CATEGORIES, buildOverpassQuery, normalizeOverpass, rankPlaces } from './places-config.js';

const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

function withTimeout(ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(id) };
}

function cacheGet(key) {
  try {
    const hit = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (hit && Date.now() - hit.t < 1000 * 60 * 60 * 6) return hit.v;
  } catch { /* ignore */ }
  return null;
}
function cacheSet(key, v) {
  try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v })); } catch { /* ignore */ }
}

async function viaServer(cat, lat, lng) {
  const to = withTimeout(9000);
  try {
    const res = await fetch(`api/places?cat=${cat}&lat=${lat}&lng=${lng}`, { signal: to.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.places) ? data : null;
  } catch {
    return null;
  } finally {
    to.done();
  }
}

async function viaOverpass(cat, lat, lng) {
  const query = buildOverpassQuery(cat, lat, lng);
  let lastErr;
  for (const url of OVERPASS) {
    const to = withTimeout(15000);
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: query }),
        signal: to.signal,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = await res.json();
      return { places: normalizeOverpass(json, cat, { lat, lng }), source: 'osm' };
    } catch (err) {
      lastErr = err;
    } finally {
      to.done();
    }
  }
  throw lastErr || new Error('Overpass no disponible');
}

/**
 * @returns {Promise<{places: object[], source: 'google'|'osm'}>}
 */
export async function findNearby(cat, lat, lng, { limit = 8 } = {}) {
  if (!CATEGORIES[cat]) throw new Error(`Categoría desconocida: ${cat}`);
  const key = `rh:places:${cat}:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, places: cached.places.slice(0, limit) };

  const data = (await viaServer(cat, lat, lng)) || (await viaOverpass(cat, lat, lng));
  const ranked = { source: data.source, places: rankPlaces(data.places, CATEGORIES[cat].rank) };
  cacheSet(key, ranked);
  return { ...ranked, places: ranked.places.slice(0, limit) };
}

/** Dirección → coordenadas (Nominatim / OpenStreetMap). */
export async function geocode(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'es' } });
  if (!res.ok) throw new Error('No se pudo geocodificar');
  const [hit] = await res.json();
  if (!hit) return null;
  const a = hit.address || {};
  return {
    lat: Number(hit.lat), lng: Number(hit.lon),
    city: a.city || a.town || a.village || a.municipality || '',
    display: hit.display_name,
  };
}

const WMO = {
  0: ['sun', { es: 'Despejado', en: 'Clear' }],
  1: ['cloud-sun', { es: 'Casi despejado', en: 'Mostly clear' }],
  2: ['cloud-sun', { es: 'Algunas nubes', en: 'Partly cloudy' }],
  3: ['cloud', { es: 'Nublado', en: 'Cloudy' }],
  45: ['cloud-fog', { es: 'Niebla', en: 'Fog' }],
  48: ['cloud-fog', { es: 'Niebla', en: 'Fog' }],
  51: ['cloud-rain', { es: 'Llovizna', en: 'Drizzle' }],
  61: ['cloud-rain', { es: 'Lluvia', en: 'Rain' }],
  63: ['cloud-rain', { es: 'Lluvia', en: 'Rain' }],
  65: ['cloud-rain', { es: 'Lluvia fuerte', en: 'Heavy rain' }],
  71: ['snowflake', { es: 'Nieve', en: 'Snow' }],
  80: ['cloud-rain', { es: 'Chubascos', en: 'Showers' }],
  95: ['cloud-lightning', { es: 'Tormenta', en: 'Storm' }],
};
export const weatherInfo = (code) => WMO[code] || WMO[Math.floor(code / 10) * 10] || WMO[3];

/** Tiempo actual + 3 días (Open-Meteo, sin clave). */
export async function getWeather(lat, lng) {
  const key = `rh:wx:${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=4`;
  const to = withTimeout(8000);
  try {
    const res = await fetch(url, { signal: to.signal });
    if (!res.ok) return null;
    const data = await res.json();
    cacheSet(key, data);
    return data;
  } catch {
    return null;
  } finally {
    to.done();
  }
}
