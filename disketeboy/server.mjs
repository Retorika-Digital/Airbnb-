// Servidor de desarrollo de DisketeBoy, sin dependencias (Node 18+):
//   node disketeboy/server.mjs                         → http://localhost:5180
//   STEAM_API_KEY=xxxx node disketeboy/server.mjs      → con importación real de Steam
//   BGG_TOKEN=xxxx node disketeboy/server.mjs          → si BoardGameGeek pide clave para su API
// Las mismas funciones /api/* se despliegan en Netlify (ver netlify/functions/disketeboy-*.mjs).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import steam from './api/steam.mjs';
import cover from './api/cover.mjs';
import bgg from './api/bgg.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 5180;
const ROUTES = { '/api/steam': steam, '/api/cover': cover, '/api/bgg': bgg };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.md': 'text/markdown; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
  '.gif': 'image/gif',
};

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    const handler = ROUTES[pathname];
    if (handler) {
      const out = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers }));
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }
    let file = normalize(join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT + sep) && file !== ROOT) {
      res.writeHead(403).end();
      return;
    }
    if (/[\\/]\./.test(file.slice(ROOT.length))) {
      res.writeHead(403).end();
      return;
    }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(err.code === 'ENOENT' ? 'No encontrado' : String(err));
  }
}).listen(PORT, () => {
  console.log(`\n  DisketeBoy → http://localhost:${PORT}`);
  console.log(`  Con demo   → http://localhost:${PORT}/?demo=1`);
  console.log(`  Steam      → ${process.env.STEAM_API_KEY ? 'activado' : 'sin clave (se ofrece la demo)'}\n`);
});
