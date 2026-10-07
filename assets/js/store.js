// Persistencia del prototipo.
// - Guías: JSON en /data/guides/<id>.json; las ediciones del panel se guardan
//   en localStorage y tienen prioridad (en producción → base de datos).
// - "Mi viaje" del huésped y estadísticas de uso: localStorage.

const KEY_GUIDE = (id) => `rh:guide:${id}`;
const KEY_GUIDES = 'rh:guides';
const KEY_TRIP = (id) => `rh:trip:${id}`;
const KEY_STATS = (id) => `rh:stats:${id}`;

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const slugify = (s) =>
  String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40) || 'guia';

// Guías ---------------------------------------------------------------------

export async function loadGuide(id) {
  const local = readJSON(KEY_GUIDE(id), null);
  if (local) return local;
  const res = await fetch(`data/guides/${encodeURIComponent(id)}.json`);
  if (!res.ok) throw new Error(`Guía "${id}" no encontrada`);
  return res.json();
}

/** Devuelve false si no cabe (p. ej. demasiadas fotos para localStorage). */
export function saveGuide(guide) {
  if (!writeJSON(KEY_GUIDE(guide.id), { ...guide, updatedAt: new Date().toISOString() })) return false;
  const ids = new Set(readJSON(KEY_GUIDES, []));
  ids.add(guide.id);
  writeJSON(KEY_GUIDES, [...ids]);
  return true;
}

export function deleteLocalGuide(id) {
  try { localStorage.removeItem(KEY_GUIDE(id)); } catch { /* ignore */ }
  writeJSON(KEY_GUIDES, readJSON(KEY_GUIDES, []).filter((g) => g !== id));
}

export function listLocalGuideIds() {
  return readJSON(KEY_GUIDES, []);
}

// Mi viaje ------------------------------------------------------------------

export function getTrip(guideId) {
  return readJSON(KEY_TRIP(guideId), { items: [], notes: [] });
}

export function saveTrip(guideId, trip) {
  writeJSON(KEY_TRIP(guideId), trip);
}

export function isInTrip(guideId, placeId) {
  return getTrip(guideId).items.some((i) => i.id === placeId);
}

/** Añade o quita un sitio. Devuelve true si queda guardado. */
export function toggleTrip(guideId, place) {
  const trip = getTrip(guideId);
  const idx = trip.items.findIndex((i) => i.id === place.id);
  if (idx >= 0) {
    trip.items.splice(idx, 1);
  } else {
    const { id, name, lat, lng, photo = '', category = '', kind = '' } = place;
    trip.items.push({ id, name, lat, lng, photo, category, kind, day: 0, addedAt: Date.now() });
  }
  saveTrip(guideId, trip);
  return idx < 0;
}

// Estadísticas ----------------------------------------------------------------

export function track(guideId, event, detail) {
  const stats = readJSON(KEY_STATS(guideId), { opens: 0, sections: {}, saves: 0, contacts: 0, lastOpen: null, days: {} });
  if (event === 'open') {
    stats.opens += 1;
    stats.lastOpen = new Date().toISOString();
    const day = stats.lastOpen.slice(0, 10);
    stats.days[day] = (stats.days[day] || 0) + 1;
  }
  if (event === 'section') stats.sections[detail] = (stats.sections[detail] || 0) + 1;
  if (event === 'save') stats.saves += 1;
  if (event === 'contact') stats.contacts += 1;
  if (event === 'ask') {
    stats.questions = [{ q: detail.q, answered: detail.answered, at: Date.now() }, ...(stats.questions || [])].slice(0, 50);
  }
  writeJSON(KEY_STATS(guideId), stats);
}

export function getStats(guideId) {
  return readJSON(KEY_STATS(guideId), { opens: 0, sections: {}, saves: 0, contacts: 0, lastOpen: null, days: {} });
}

/** Datos de ejemplo para enseñar el panel en una demo. */
export function seedDemoStats(guideId) {
  const sections = { wifi: 41, checkin: 33, nearby: 27, eat: 24, move: 19, house: 15, do: 14, trip: 9, contact: 6, emergency: 2 };
  const now = Date.now();
  const questions = [
    ['¿Hay secador de pelo?', true], ['¿Dónde aparco el coche?', true], ['¿Puedo hacer el check-in a las 12?', true],
    ['¿Hay ventilador en el dormitorio?', false], ['¿Contraseña del WiFi?', true], ['¿Se puede subir con bicicleta?', false],
  ].map(([q, answered], i) => ({ q, answered, at: now - i * 36e5 * 7 }));
  writeJSON(KEY_STATS(guideId), { opens: 328, sections, saves: 57, contacts: 18, lastOpen: new Date().toISOString(), days: {}, questions });
}
