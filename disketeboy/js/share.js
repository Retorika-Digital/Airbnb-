// «Visita mi habitación»: la colección viaja comprimida dentro del enlace
// (después de la #, que nunca llega a ningún servidor). Sin cuentas ni base de
// datos: quien abre el enlace ve tu habitación en modo visita, sin tocar la suya.
import { ALL_STATUSES, cleanGame } from './store.js';

const REVIEW_MAX = 140;
export const LONG_URL = 8000;

function toBase64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes, stream) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * Empaqueta la colección: [título, plataforma, estado, nota, horas, steam, reseña, color]
 * y además, según lo que sea:
 *   juego de mesa → [«m», jugadores mín., máx., minutos, partidas, prestado a]
 *   mazo          → [«k», juego de cartas, formato, victorias, derrotas] (la lista no viaja)
 *   carpeta       → [«c», juego de cartas, cartas, valor]
 */
export async function encodeRoom(games, { name = '' } = {}) {
  const rows = (withReviews) =>
    games.map((g) => {
      const row = [g.title, g.platform, ALL_STATUSES.indexOf(g.status), g.score ?? -1, g.hours, g.steamAppId || 0, withReviews ? (g.review || '').slice(0, REVIEW_MAX) : '', g.color || ''];
      if (g.kind === 'mesa') row.push('m', g.minPlayers, g.maxPlayers, g.minutes, g.plays, g.lentTo || '');
      if (g.kind === 'mazo') row.push('k', g.tcg, g.format || '', g.wins, g.losses);
      if (g.kind === 'carpeta') row.push('c', g.tcg, g.cards, g.value);
      return row;
    });
  let json = JSON.stringify({ v: 1, n: String(name).slice(0, 30), g: rows(true) });
  if (json.length > 60000) json = JSON.stringify({ v: 1, n: String(name).slice(0, 30), g: rows(false) });
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

/** Desempaqueta un enlace de visita. Lanza un error si está roto o manipulado. */
export async function decodeRoom(text) {
  let data;
  try {
    const bytes = await pipe(fromBase64Url(String(text || '')), new DecompressionStream('deflate-raw'));
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('Este enlace de visita está roto o incompleto');
  }
  if (!data || data.v !== 1 || !Array.isArray(data.g)) throw new Error('Este enlace de visita está roto o incompleto');
  const games = data.g
    .slice(0, 2000)
    .map((r, i) =>
      Array.isArray(r)
        ? cleanGame({
            id: `v${i}`,
            title: r[0],
            platform: r[1],
            status: ALL_STATUSES[r[2]],
            score: r[3] === -1 ? null : r[3],
            hours: r[4],
            steamAppId: r[5] || null,
            review: r[6],
            color: r[7] || null,
            addedAt: new Date(Date.UTC(2020, 0, 1, 0, 0, i)).toISOString(),
            ...(r[8] === 'm' ? { kind: 'mesa', minPlayers: r[9], maxPlayers: r[10], minutes: r[11], plays: r[12], lentTo: r[13] } : {}),
            ...(r[8] === 'k' ? { kind: 'mazo', tcg: r[9], format: r[10], wins: r[11], losses: r[12] } : {}),
            ...(r[8] === 'c' ? { kind: 'carpeta', tcg: r[9], cards: r[10], value: r[11] } : {}),
          })
        : null,
    )
    .filter(Boolean);
  return { name: typeof data.n === 'string' ? data.n.slice(0, 30) : '', games };
}

export const visitUrl = (base, data) => `${base}#visita=${data}`;
