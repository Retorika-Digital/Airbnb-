// Servidor de desarrollo sin dependencias (Node 18+):
//   node server.mjs           → http://localhost:5173
// Sirve los ficheros estáticos y las funciones /api/* (las mismas que se
// despliegan como funciones serverless en Netlify — ver netlify/functions).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import airbnb from './api/airbnb.mjs';
import places from './api/places.mjs';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 5173;
const ROUTES = { '/api/airbnb': airbnb, '/api/places': places };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.md': 'text/markdown; charset=utf-8',
};

async function toWebRequest(req) {
  const url = `http://${req.headers.host}${req.url}`;
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://x');
  try {
    const handler = ROUTES[pathname];
    if (handler) {
      const out = await handler(await toWebRequest(req));
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(Buffer.from(await out.arrayBuffer()));
      return;
    }
    let file = normalize(join(ROOT, decodeURIComponent(pathname)));
    if (!file.startsWith(ROOT + sep) || /[\\/]\./.test(file.slice(ROOT.length))) { res.writeHead(403).end(); return; }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, 'index.html');
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (err) {
    res.writeHead(err.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(err.code === 'ENOENT' ? 'No encontrado' : String(err));
  }
}).listen(PORT, () => {
  console.log(`\n  retorika Home → http://localhost:${PORT}`);
  console.log(`  Guía demo      → http://localhost:${PORT}/?guide=granvia&g=Laura`);
  console.log(`  Panel          → http://localhost:${PORT}/panel.html`);
  console.log(`  Google Places  → ${process.env.GOOGLE_PLACES_KEY ? 'activado' : 'sin clave (se usa OpenStreetMap)'}\n`);
});
