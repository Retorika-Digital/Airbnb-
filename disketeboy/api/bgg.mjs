// GET /api/bgg?user=<usuario> → { user, games: [{ id, name, minPlayers, maxPlayers, minutes, plays, rating }] }
// Lee la colección pública de BoardGameGeek: solo lo que tienes (own=1) y sin expansiones.
// BGG pide registrar las aplicaciones que usan su API: si hay BGG_TOKEN se manda como
// «Authorization: Bearer». La primera vez que se pide una colección BGG responde 202
// («la estoy preparando»), así que se reintenta unas cuantas veces.
const API = 'https://boardgamegeek.com/xmlapi2/collection';

/** Acepta el nombre de usuario o la URL de su perfil o de su colección. */
export function parseBggInput(raw) {
  const s = String(raw || '').trim();
  const url = s.match(/boardgamegeek\.com\/(?:collection\/)?user\/([^/?#]{2,40})/i);
  let name = s;
  if (url) {
    try {
      name = decodeURIComponent(url[1]);
    } catch {
      return null;
    }
  }
  name = name.trim();
  return /^[\p{L}\p{N}_. -]{2,40}$/u.test(name) ? name : null;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s) =>
  String(s || '').replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
const num = (v) => (v !== undefined && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Convierte el XML de una colección de BGG en una lista sencilla (o en un error). */
export function parseCollection(xml) {
  const text = String(xml || '');
  if (/<errors?\b/i.test(text)) {
    const message = decode(text.match(/<message>([\s\S]*?)<\/message>/i)?.[1] || '').trim();
    return { error: /invalid username/i.test(message) ? 'no_encontrado' : 'bgg', message };
  }
  const games = [];
  for (const m of text.matchAll(/<item\b([^>]*)>([\s\S]*?)<\/item>/g)) {
    const [, head, body] = m;
    const id = num(attr(head, 'objectid'));
    const name = decode(body.match(/<name\b[^>]*>([\s\S]*?)<\/name>/)?.[1]).trim();
    if (!id || !name) continue;
    const stats = body.match(/<stats\b([^>]*)>/)?.[1] || '';
    const rating = num(body.match(/<rating\b[^>]*\bvalue="([^"]*)"/)?.[1]);
    games.push({
      id,
      name: name.slice(0, 120),
      minPlayers: num(attr(stats, 'minplayers')),
      maxPlayers: num(attr(stats, 'maxplayers')),
      minutes: num(attr(stats, 'playingtime')) || num(attr(stats, 'maxplaytime')),
      plays: num(body.match(/<numplays>\s*(\d+)\s*<\/numplays>/)?.[1]) || 0,
      rating,
    });
  }
  return { games };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'private, max-age=300' : 'no-store' },
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function bgg(req, { fetchImpl = fetch, token = process.env.BGG_TOKEN, wait = sleep } = {}) {
  const user = parseBggInput(new URL(req.url).searchParams.get('user'));
  if (!user) return json(400, { error: 'usuario', message: 'Eso no parece un usuario de BoardGameGeek.' });
  const url = new URL(API);
  for (const [k, v] of Object.entries({ username: user, own: '1', subtype: 'boardgame', excludesubtype: 'boardgameexpansion', stats: '1' })) url.searchParams.set(k, v);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  try {
    // BGG prepara la colección en segundo plano: 202 significa «vuelve en un momento»
    for (const pause of [1200, 2000, 2800, 0]) {
      // Plazos cortos: en Netlify la función entera tiene 10 s
      const res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(3500) });
      if (res.status === 202) {
        if (pause) await wait(pause);
        continue;
      }
      if (res.status === 401 || res.status === 403) return json(501, { error: 'bgg_clave', message: 'BoardGameGeek pide una clave para usar su API y este servidor aún no la tiene.' });
      if (res.status === 429) return json(503, { error: 'bgg_ocupado', message: 'BoardGameGeek está saturado. Inténtalo en un minuto.' });
      if (!res.ok) throw new Error(`BGG respondió ${res.status}`);
      const out = parseCollection(await res.text());
      if (out.error === 'no_encontrado') return json(404, { error: 'bgg_no_encontrado', message: `No encuentro a «${user}» en BoardGameGeek.` });
      if (out.error) throw new Error(out.message || 'BGG devolvió un error');
      out.games.sort((a, b) => a.name.localeCompare(b.name));
      return json(200, { user, games: out.games });
    }
    return json(503, { error: 'bgg_en_cola', message: 'BoardGameGeek está preparando tu colección. Vuelve a intentarlo en unos segundos.' });
  } catch (err) {
    return json(502, { error: 'bgg_red', message: 'BoardGameGeek no responde ahora mismo. Inténtalo en un rato.', detail: String(err.message || err) });
  }
}
