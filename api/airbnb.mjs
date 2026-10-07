// POST/GET /api/airbnb?url=<enlace del anuncio>
//
// Importa los datos PÚBLICOS de un anuncio de Airbnb para autocompletar la
// guía: título, tipo, ciudad, coordenadas aproximadas, fotos, anfitrión,
// horas de check-in/out, comodidades y nº de huéspedes.
//
// ⚠️  Airbnb no tiene API pública para esto. Leemos el HTML público del
// anuncio (lo mismo que ve cualquier navegador) y extraemos lo que podemos.
// - Es "best effort": si Airbnb cambia su HTML, algunos campos llegarán vacíos
//   y el propietario los completa a mano (el panel lo marca).
// - Solo se importa el anuncio del propio propietario, a petición suya, una
//   vez (no hay rastreo masivo ni periódico). Revisar los Términos de Airbnb
//   antes de producción; alternativa robusta: integración vía channel manager
//   (Hostaway, Smoobu, Lodgify...) que sí tienen API oficial con Airbnb.
// - Las coordenadas públicas de Airbnb están desplazadas unos cientos de
//   metros por privacidad: el panel pide confirmar la dirección exacta.
//
// Firma web estándar (Request → Response): funciona en Node 18+, Netlify
// Functions v2, Vercel y Cloudflare Workers sin cambios.

const ALLOWED_HOST = /(^|\.)airbnb\.(com|es|co\.uk|fr|de|it|pt|mx|com\.ar|com\.co|cl|ca|com\.au|ie|nl|be|ch|at)$/i;
const SHORT_HOST = /^(abnb\.me|airbnb\.app\.link)$/i;

const json = (status, data) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'public, max-age=3600' : 'no-store' },
});

const decode = (s = '') => s
  .replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\\"/g, '"').trim();

const meta = (html, prop) => {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]*)"`, 'i'))
    || html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="${prop}"`, 'i'));
  return m ? decode(m[1]) : '';
};

const AMENITIES = {
  Wifi: 'Wifi', 'Wi-Fi': 'Wifi', Cocina: 'Cocina', Kitchen: 'Cocina', Lavadora: 'Lavadora', Washer: 'Lavadora',
  'Aire acondicionado': 'Aire acondicionado', 'Air conditioning': 'Aire acondicionado', Calefacción: 'Calefacción', Heating: 'Calefacción',
  'Secador de pelo': 'Secador de pelo', 'Hair dryer': 'Secador de pelo', Plancha: 'Plancha', Iron: 'Plancha',
  Televisión: 'Televisión', TV: 'Televisión', Ascensor: 'Ascensor', Elevator: 'Ascensor', Cafetera: 'Cafetera', 'Coffee maker': 'Cafetera',
  Microondas: 'Microondas', Microwave: 'Microondas', Lavavajillas: 'Lavavajillas', Dishwasher: 'Lavavajillas',
  'Zona de trabajo': 'Zona de trabajo', 'Dedicated workspace': 'Zona de trabajo', Cuna: 'Cuna', Crib: 'Cuna',
  'Aparcamiento gratuito en las instalaciones': 'Parking gratuito', 'Free parking on premises': 'Parking gratuito',
  Balcón: 'Balcón', Balcony: 'Balcón', Piscina: 'Piscina', Pool: 'Piscina',
};

function to24h(s) {
  if (!s) return '';
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([AP]M)?$/i);
  if (!m) return s.trim();
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
}

export function parseListing(html, id) {
  const warnings = [];
  const ogTitle = meta(html, 'og:title');
  const ogDesc = meta(html, 'og:description');
  const description = meta(html, 'description') || ogDesc;

  // og:title → "Apartamento en Madrid · ★4,87 · 1 habitación · 1 cama · 1 baño"
  const parts = ogTitle.split('·').map((s) => s.trim());
  const typeCity = parts[0]?.match(/^(.+?)\s+(?:en|in)\s+(.+)$/i);
  const rating = Number((ogTitle.match(/★\s*([\d.,]+)/) || [])[1]?.replace(',', '.')) || null;

  const lat = Number((html.match(/"lat(?:itude)?"\s*:\s*(-?\d+\.\d+)/) || [])[1]) || null;
  const lng = Number((html.match(/"(?:lng|longitude)"\s*:\s*(-?\d+\.\d+)/) || [])[1]) || null;
  if (!lat || !lng) warnings.push('coords');

  const photos = [...new Set((html.match(/https:\/\/a0\.muscache\.com\/im\/pictures\/[^"'\s?\\]+\.(?:jpe?g|webp|png)/gi) || []))]
    .filter((u) => !/user|profile|avatar/i.test(u))
    .slice(0, 8)
    .map((u) => `${u}?im_w=960`);
  const ogImage = meta(html, 'og:image');
  if (!photos.length && ogImage) photos.push(ogImage);
  if (!photos.length) warnings.push('photos');

  const hostName = decode(
    (html.match(/"hostName"\s*:\s*"([^"]+)"/) || html.match(/(?:Anfitri[oó]n|Hosted by|Alojamiento ofrecido por|Anfitrión:)\s*:?\s*([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+)/) || [])[1] || '',
  );
  if (!hostName) warnings.push('host');

  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const checkIn = to24h(
    (text.match(/(?:Llegada|Check-in)[^0-9]{0,30}?(\d{1,2}(?::\d{2})?\s*(?:[AP]M)?)/i) || [])[1],
  );
  const checkOut = to24h(
    (text.match(/(?:Salida|Checkout|Check-out)[^0-9]{0,30}?(\d{1,2}(?::\d{2})?\s*(?:[AP]M)?)/i) || [])[1],
  );
  if (!checkIn) warnings.push('checkin');

  const amenities = [...new Set(
    [...html.matchAll(/"title"\s*:\s*"([^"]{2,45})"/g)].map((m) => AMENITIES[decode(m[1])]).filter(Boolean),
  )];

  const maxGuests = Number((text.match(/(\d+)\s+(?:huéspedes|hu[eé]sped|guests?)/i) || [])[1]) || null;

  return {
    ok: true,
    id,
    name: description && description.length < 90 ? description : (typeCity ? `${typeCity[1]} en ${typeCity[2]}` : ogTitle),
    type: typeCity?.[1] || '',
    city: typeCity?.[2] || '',
    rating,
    summary: parts.slice(1).filter((p) => !p.startsWith('★')).join(' · '),
    lat, lng,
    photos,
    hostName,
    checkIn, checkOut,
    amenities,
    maxGuests,
    warnings,
  };
}

export async function resolveListingId(raw) {
  let url;
  try { url = new URL(String(raw).trim()); } catch { return null; }
  if (SHORT_HOST.test(url.hostname)) {
    // Enlace corto de la app: lo resolvemos siguiendo la redirección.
    const r = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
    url = new URL(r.url);
  }
  if (!ALLOWED_HOST.test(url.hostname)) return null;
  const m = url.pathname.match(/\/rooms\/(?:plus\/)?(\d+)/);
  return m ? m[1] : null;
}

export default async function handler(request) {
  const reqUrl = new URL(request.url);
  let listingUrl = reqUrl.searchParams.get('url');
  if (!listingUrl && request.method === 'POST') {
    try { listingUrl = (await request.json()).url; } catch { /* body vacío */ }
  }
  if (!listingUrl) return json(400, { ok: false, error: 'Falta el parámetro url' });

  let id;
  try { id = await resolveListingId(listingUrl); } catch { id = null; }
  if (!id) return json(400, { ok: false, error: 'Eso no parece un enlace de anuncio de Airbnb (…airbnb.es/rooms/123…)' });

  try {
    const res = await fetch(`https://www.airbnb.es/rooms/${id}?locale=es`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9',
        Accept: 'text/html',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return json(502, { ok: false, id, error: `Airbnb respondió ${res.status}` });
    const html = await res.text();
    const data = parseListing(html, id);
    data.url = `https://www.airbnb.es/rooms/${id}`;
    return json(200, data);
  } catch (err) {
    return json(502, { ok: false, id, error: `No se pudo leer el anuncio (${err.name === 'TimeoutError' ? 'tiempo agotado' : err.message})` });
  }
}
