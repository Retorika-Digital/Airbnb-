// GET /api/places?cat=pharmacy&lat=40.42&lng=-3.70
//
// - Con GOOGLE_PLACES_KEY → Google Places API (New) "searchNearby", ordenado
//   por popularidad y re-ordenado por valoración bayesiana (rating + nº reseñas).
//   La clave nunca llega al navegador.
// - Sin clave → OpenStreetMap (Overpass), gratis, ordenado por distancia.
import {
  CATEGORIES, buildOverpassQuery, normalizeOverpass, rankPlaces, distanceM, walkMinutes,
} from '../assets/js/places-config.js';

const json = (status, data, maxAge = 0) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store',
  },
});

const env = (k) => (typeof process !== 'undefined' ? process.env[k] : undefined);

async function google(cat, lat, lng, key) {
  const c = CATEGORIES[cat];
  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': [
        'places.id', 'places.displayName', 'places.location', 'places.rating', 'places.userRatingCount',
        'places.shortFormattedAddress', 'places.googleMapsUri', 'places.currentOpeningHours.openNow',
        'places.regularOpeningHours.periods', 'places.primaryTypeDisplayName',
      ].join(','),
    },
    body: JSON.stringify({
      includedTypes: c.google,
      maxResultCount: 20,
      rankPreference: c.rank === 'distance' ? 'DISTANCE' : 'POPULARITY',
      languageCode: 'es',
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: c.radius } },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Google Places ${res.status}`);
  const data = await res.json();
  return (data.places || []).map((p) => {
    const pos = { lat: p.location.latitude, lng: p.location.longitude };
    const distance = distanceM({ lat, lng }, pos);
    const periods = p.regularOpeningHours?.periods || [];
    return {
      id: `g-${p.id}`,
      name: p.displayName?.text || '',
      ...pos, distance, minutes: walkMinutes(distance), cat,
      address: p.shortFormattedAddress || '',
      rating: p.rating ?? null,
      reviews: p.userRatingCount ?? null,
      openNow: p.currentOpeningHours?.openNow ?? null,
      is24h: periods.length === 1 && !periods[0].close,
      cuisine: p.primaryTypeDisplayName?.text || '',
      mapsUrl: p.googleMapsUri,
      source: 'google',
    };
  });
}

async function overpass(cat, lat, lng) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: new URLSearchParams({ data: buildOverpassQuery(cat, lat, lng) }),
    headers: { 'User-Agent': 'retorika-home/1.0 (guia de alojamientos)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  return normalizeOverpass(await res.json(), cat, { lat, lng });
}

export default async function handler(request) {
  const q = new URL(request.url).searchParams;
  const cat = q.get('cat');
  const lat = Number(q.get('lat'));
  const lng = Number(q.get('lng'));
  if (!CATEGORIES[cat] || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json(400, { error: 'Parámetros: cat, lat, lng' });
  }
  const key = env('GOOGLE_PLACES_KEY');
  try {
    if (key) {
      const places = await google(cat, lat, lng, key);
      return json(200, { source: 'google', places: rankPlaces(places, CATEGORIES[cat].rank) }, 86400);
    }
    const places = await overpass(cat, lat, lng);
    return json(200, { source: 'osm', places: rankPlaces(places, CATEGORIES[cat].rank) }, 86400);
  } catch (err) {
    return json(502, { error: err.message });
  }
}
