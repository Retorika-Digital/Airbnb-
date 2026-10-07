// Configuración compartida (navegador + servidor) de las categorías de
// "lugares cercanos". Cada categoría sabe cómo pedirse a OpenStreetMap
// (Overpass, gratis y sin clave) y a Google Places (con valoraciones).

export const CATEGORIES = {
  supermarket: {
    label: { es: 'Supermercados', en: 'Groceries' }, icon: 'shopping-cart', color: 'verde',
    osm: ['nwr["shop"="supermarket"]["name"]', 'nwr["shop"="convenience"]["name"]'],
    google: ['supermarket', 'grocery_store'], radius: 700, rank: 'distance',
  },
  pharmacy: {
    label: { es: 'Farmacias', en: 'Pharmacies' }, icon: 'pill', color: 'fucsia',
    osm: ['nwr["amenity"="pharmacy"]'], google: ['pharmacy'], radius: 900, rank: 'distance',
  },
  cafe: {
    label: { es: 'Cafeterías', en: 'Cafés' }, icon: 'coffee', color: 'naranja',
    osm: ['nwr["amenity"="cafe"]["name"]'], google: ['cafe', 'coffee_shop'], radius: 600, rank: 'rating',
  },
  restaurant: {
    label: { es: 'Restaurantes', en: 'Restaurants' }, icon: 'utensils', color: 'fucsia',
    osm: ['nwr["amenity"="restaurant"]["name"]'], google: ['restaurant'], radius: 800, rank: 'rating',
  },
  bar: {
    label: { es: 'Tapas y bares', en: 'Tapas & bars' }, icon: 'wine', color: 'lila',
    osm: ['nwr["amenity"~"^(bar|pub)$"]["name"]'], google: ['bar'], radius: 700, rank: 'rating',
  },
  parking: {
    label: { es: 'Parking', en: 'Parking' }, icon: 'square-parking', color: 'azul',
    osm: ['nwr["amenity"="parking"]["access"!="private"]'], google: ['parking'], radius: 900, rank: 'distance',
  },
  transit: {
    label: { es: 'Metro y tren', en: 'Metro & train' }, icon: 'train-front', color: 'azul',
    osm: ['node["railway"="station"]["name"]', 'node["station"="subway"]["name"]'],
    google: ['subway_station', 'train_station'], radius: 900, rank: 'distance',
  },
  attraction: {
    label: { es: 'Qué ver', en: 'Sights' }, icon: 'landmark', color: 'amarillo',
    osm: ['nwr["tourism"~"^(museum|attraction|viewpoint|gallery)$"]["name"]'],
    google: ['tourist_attraction', 'museum'], radius: 2000, rank: 'rating',
  },
  hospital: {
    label: { es: 'Hospitales', en: 'Hospitals' }, icon: 'hospital', color: 'fucsia',
    osm: ['nwr["amenity"="hospital"]["name"]'], google: ['hospital'], radius: 3500, rank: 'distance',
  },
};

/** Distancia en metros (haversine). */
export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** ~80 m por minuto andando, sumando un 25 % por rodeos de calle. */
export const walkMinutes = (m) => Math.max(1, Math.round((m * 1.25) / 80));

/**
 * Puntuación "mejor valorado" bayesiana: un 4,9 con 8 reseñas no debe ganar
 * a un 4,6 con 3.000. m = reseñas de confianza, C = media de la ciudad.
 */
export function ratingScore(rating, reviews, m = 60, C = 4.2) {
  if (!rating) return 0;
  const v = reviews || 0;
  return (v / (v + m)) * rating + (m / (v + m)) * C;
}

export function rankPlaces(places, rank) {
  const sorted = [...places];
  if (rank === 'rating' && sorted.some((p) => p.rating)) {
    // Mezcla: valoración primero, penalizando un poco la distancia.
    sorted.sort((a, b) => (ratingScore(b.rating, b.reviews) - b.distance / 4000) - (ratingScore(a.rating, a.reviews) - a.distance / 4000));
  } else {
    sorted.sort((a, b) => a.distance - b.distance);
  }
  return sorted;
}

export function buildOverpassQuery(cat, lat, lng, radius) {
  const c = CATEGORIES[cat];
  const r = radius || c.radius;
  const parts = c.osm.map((f) => `${f}(around:${r},${lat},${lng});`).join('');
  return `[out:json][timeout:20];(${parts});out center tags 60;`;
}

export function normalizeOverpass(json, cat, origin) {
  const seen = new Set();
  return (json.elements || [])
    .map((el) => {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      const tags = el.tags || {};
      const name = tags.name || tags.brand || (cat === 'pharmacy' ? 'Farmacia' : cat === 'parking' ? 'Parking' : '');
      if (!lat || !name) return null;
      const distance = distanceM(origin, { lat, lng });
      const street = [tags['addr:street'], tags['addr:housenumber']].filter(Boolean).join(', ');
      return {
        id: `osm-${el.type}-${el.id}`,
        name, lat, lng, distance, minutes: walkMinutes(distance), cat,
        address: street,
        is24h: tags.opening_hours === '24/7',
        openingHours: tags.opening_hours || '',
        cuisine: tags.cuisine ? tags.cuisine.split(';')[0].replace(/_/g, ' ') : '',
        website: tags.website || tags['contact:website'] || '',
        phone: tags.phone || tags['contact:phone'] || '',
        rating: null, reviews: null,
        mapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`,
        source: 'osm',
      };
    })
    .filter((p) => p && !seen.has(p.name + p.address) && seen.add(p.name + p.address));
}
