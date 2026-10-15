// GET /api/cover?appid=<n> → la carátula vertical de Steam, con CORS abierto.
// Solo acepta un id numérico y solo pide a Steam: no es un proxy abierto.
// Se usa como plan B si el navegador no puede leer la imagen directamente
// (WebGL necesita CORS para pegar la portada en la caja 3D).
const FILES = { portada: 'library_600x900.jpg', capsula: 'capsule_sm_120.jpg' };

export default async function cover(req, { fetchImpl = fetch } = {}) {
  const params = new URL(req.url).searchParams;
  const appid = params.get('appid') || '';
  const file = FILES[params.get('tipo') || 'portada'];
  if (!/^\d{1,8}$/.test(appid) || !file) return new Response('Petición no válida', { status: 400 });
  try {
    const res = await fetchImpl(`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${file}`, { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) return new Response('Sin portada', { status: 404 });
    return new Response(await res.arrayBuffer(), {
      status: 200,
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=604800, immutable', 'Access-Control-Allow-Origin': '*' },
    });
  } catch {
    return new Response('Steam no responde', { status: 502 });
  }
}
