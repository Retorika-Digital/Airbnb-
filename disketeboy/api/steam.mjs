// GET /api/steam?id=<perfil> → { games: [{ appid, name, playtime_forever, playtime_2weeks }] }
// Lee la biblioteca pública de un perfil de Steam con la Web API oficial.
// Necesita STEAM_API_KEY (gratis en https://steamcommunity.com/dev/apikey).
// Sin clave responde 501 para que la consola ofrezca la demo.
const API = 'https://api.steampowered.com';

/** Acepta SteamID64, URL de perfil (/profiles/… o /id/…) o nombre personalizado. */
export function parseSteamInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const profiles = s.match(/steamcommunity\.com\/profiles\/(\d{17})/i);
  if (profiles) return { steamid: profiles[1] };
  const vanityUrl = s.match(/steamcommunity\.com\/id\/([\w-]{2,64})/i);
  if (vanityUrl) return { vanity: vanityUrl[1] };
  if (/^7656119\d{10}$/.test(s)) return { steamid: s };
  if (/^[\w-]{2,64}$/.test(s)) return { vanity: s };
  return null;
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': status === 200 ? 'private, max-age=300' : 'no-store' },
  });

async function call(path, params, key, fetchImpl) {
  const url = new URL(API + path);
  for (const [k, v] of Object.entries({ key, ...params })) url.searchParams.set(k, v);
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw Object.assign(new Error(`Steam respondió ${res.status}`), { status: res.status });
  return res.json();
}

export default async function steam(req, { fetchImpl = fetch, key = process.env.STEAM_API_KEY } = {}) {
  const input = parseSteamInput(new URL(req.url).searchParams.get('id'));
  if (!input) return json(400, { error: 'perfil', message: 'Eso no parece un perfil de Steam. Prueba con la URL de tu perfil.' });
  if (!key) {
    return json(501, {
      error: 'sin_clave',
      message: 'Este servidor aún no tiene clave de Steam, así que no puedo leer tu biblioteca. Mientras tanto, ¿cargo la colección de demo?',
    });
  }
  try {
    let steamid = input.steamid;
    if (!steamid) {
      const r = await call('/ISteamUser/ResolveVanityURL/v1/', { vanityurl: input.vanity }, key, fetchImpl);
      if (r?.response?.success !== 1) return json(404, { error: 'no_encontrado', message: `No encuentro ningún perfil llamado «${input.vanity}».` });
      steamid = r.response.steamid;
    }
    const data = await call('/IPlayerService/GetOwnedGames/v1/', { steamid, include_appinfo: '1', include_played_free_games: '1', format: 'json' }, key, fetchImpl);
    const list = data?.response?.games;
    if (!Array.isArray(list)) {
      return json(403, { error: 'privado', message: 'Tu perfil o tu lista de juegos es privada. En Steam: Perfil → Editar perfil → Privacidad → «Detalles del juego: público».' });
    }
    const games = list
      .filter((g) => Number.isInteger(g.appid) && typeof g.name === 'string')
      .map((g) => ({ appid: g.appid, name: g.name.slice(0, 120), playtime_forever: g.playtime_forever | 0, playtime_2weeks: g.playtime_2weeks | 0 }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json(200, { steamid, games });
  } catch (err) {
    return json(502, { error: 'red', message: 'Steam no responde ahora mismo. Inténtalo en un rato.', detail: String(err.message || err) });
  }
}
