// Dónde va cada caja en la habitación. Funciones puras (sin three.js) para
// poder probarlas en Node: mismo estado → misma habitación, siempre.
//
// Unidades en metros. Ejes: x a la derecha, y hacia arriba, z hacia la cámara.
// Rotaciones en orden 'YXZ': primero se inclina la caja y luego se gira.
import { boxFor, platform } from './platforms.js';
import { rng, colorFor, hexToHsl } from './util.js';

export const ROOM = { minX: -2.2, maxX: 2.2, minZ: -1.9, maxZ: 2.1, height: 2.6 };

export const BOOKCASE = {
  width: 0.8,
  depth: 0.32,
  height: 1.95,
  inner: 0.74,
  boards: [0.06, 0.44, 0.82, 1.2, 1.58], // altura de cada balda
  fill: [3, 2, 4, 1, 0], // se llena primero la balda a la altura de los ojos
  gap: 0.003,
};

// Huecos para estanterías: primero la pared del fondo y luego la izquierda.
export const BOOKCASE_SPOTS = [
  { x: -0.98, z: -1.74, yaw: 0 },
  { x: -1.8, z: -1.74, yaw: 0 },
  { x: -0.15, z: -1.74, yaw: 0 },
  { x: -2.04, z: -0.9, yaw: Math.PI / 2 },
  { x: -2.04, z: -0.06, yaw: Math.PI / 2 },
];

export const DESK = { x: 1.25, z: -1.6, width: 1.3, depth: 0.6, top: 0.74 };
export const PILE = { x: -0.8, z: -0.78 };
export const BIN = { x: 1.48, z: -0.98, w: 0.5, d: 0.38, h: 0.3 };

export const ZONE_OF_STATUS = {
  pendiente: 'pila',
  jugando: 'escritorio',
  jugado: 'estanteria',
  terminado: 'estanteria',
  abandonado: 'caja',
};

const PILE_COLUMNS = [
  [0, 0], [0.24, 0.1], [-0.2, 0.16], [0.08, 0.32], [0.36, 0.34], [-0.28, 0.4],
  [0.5, 0.12], [-0.42, -0.04], [0.56, 0.5], [-0.12, 0.56], [0.24, 0.62], [-0.5, 0.6], [0.7, 0.3],
];
const PILE_MAX = 5;

const gameColor = (g) => g.color || colorFor(g.title);

export function sortGames(games, key = 'plataforma') {
  const list = [...games];
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
  switch (key) {
    case 'nota':
      return list.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || byTitle(a, b));
    case 'horas':
      return list.sort((a, b) => b.hours - a.hours || byTitle(a, b));
    case 'az':
      return list.sort(byTitle);
    case 'color': {
      const tone = (g) => {
        const { h, s, l } = hexToHsl(gameColor(g));
        return s < 14 ? 1000 + (100 - l) : h; // los grises, al final
      };
      return list.sort((a, b) => tone(a) - tone(b) || byTitle(a, b));
    }
    default:
      return list.sort((a, b) => platform(a.platform).order - platform(b.platform).order || byTitle(a, b));
  }
}

function toWorld(spot, lx, lz) {
  const c = Math.cos(spot.yaw);
  const s = Math.sin(spot.yaw);
  return { x: spot.x + lx * c + lz * s, z: spot.z - lx * s + lz * c };
}

/** Coloca cajas de pie, con el lomo hacia fuera, balda a balda. */
function shelve(games, out) {
  const B = BOOKCASE;
  let spotIndex = 0;
  let fillIndex = 0;
  let cursor = 0;
  const overflow = [];
  const used = {}; // "estantería:balda" → metros ocupados
  for (const g of games) {
    const box = boxFor(g.platform);
    let placed = false;
    while (!placed && spotIndex < BOOKCASE_SPOTS.length) {
      if (cursor + box.d <= B.inner) {
        const spot = BOOKCASE_SPOTS[spotIndex];
        const board = B.fill[fillIndex];
        const lx = -B.inner / 2 + cursor + box.d / 2;
        const lz = B.depth / 2 - 0.012 - box.w / 2;
        const { x, z } = toWorld(spot, lx, lz);
        out.set(g.id, { zone: 'estanteria', x, y: B.boards[board] + 0.018 + box.h / 2, z, rx: 0, ry: spot.yaw + Math.PI / 2, rz: 0, bookcase: spotIndex });
        cursor += box.d + B.gap;
        used[`${spotIndex}:${board}`] = cursor;
        placed = true;
      } else {
        cursor = 0;
        fillIndex++;
        if (fillIndex >= B.fill.length) {
          fillIndex = 0;
          spotIndex++;
        }
      }
    }
    if (!placed) overflow.push(g);
  }
  const bookcases = Object.keys(used).reduce((n, k) => Math.max(n, Number(k.split(':')[0]) + 1), 0);
  return { overflow, bookcases, used };
}

/**
 * Lo que va en las baldas libres: decoración en las vacías y un sujetalibros al
 * final de cada fila de cajas. Se recalcula cuando la colección crece.
 */
export function shelfDecor(used, bookcases) {
  const B = BOOKCASE;
  const items = [];
  for (let s = 0; s < bookcases; s++) {
    const spot = BOOKCASE_SPOTS[s];
    B.boards.forEach((y, board) => {
      const len = used[`${s}:${board}`] || 0;
      const at = (lx, lz = 0) => ({ ...toWorld(spot, lx, lz), y: y + 0.018, yaw: spot.yaw });
      if (len > 0) {
        if (len < B.inner - 0.05) items.push({ kind: 'sujetalibros', ...at(-B.inner / 2 + len + 0.012, 0.02) });
        if (len < B.inner - 0.32) items.push({ kind: board % 2 ? 'planta' : 'dado', ...at(B.inner / 2 - 0.1) });
      } else {
        const kinds = ['libros', 'trofeo', 'libros', 'consola', 'figura'];
        items.push({ kind: kinds[(board + s * 2) % kinds.length], seed: `${s}:${board}`, ...at(-0.12) });
        if ((board + s) % 2 === 0) items.push({ kind: board === 4 ? 'planta' : 'dado', ...at(0.24) });
      }
    });
  }
  return items;
}

/** La pila de la vergüenza: columnas de cajas tumbadas, un poco torcidas. */
function pile(games, out) {
  const heights = [];
  games.forEach((g, i) => {
    const col = Math.floor(i / PILE_MAX);
    const [ox, oz] = PILE_COLUMNS[col] || [((col * 37) % 11) / 10 - 0.5, 0.7 + ((col * 13) % 5) / 10];
    const r = rng(g.id);
    const colYaw = (rng(`col${col}`)() - 0.5) * 0.9;
    const box = boxFor(g.platform);
    const base = heights[col] || 0;
    heights[col] = base + box.d;
    out.set(g.id, {
      zone: 'pila',
      x: PILE.x + ox + (r() - 0.5) * 0.03,
      y: base + box.d / 2,
      z: PILE.z + oz + (r() - 0.5) * 0.03,
      rx: -Math.PI / 2,
      ry: colYaw + (r() - 0.5) * 0.35,
      rz: 0,
    });
  });
}

/** Lo que estás jugando, en dos montoncitos sobre el escritorio. */
function desk(games, out) {
  const stacks = [
    { x: DESK.x - 0.42, z: DESK.z + 0.14, h: 0 },
    { x: DESK.x + 0.42, z: DESK.z + 0.16, h: 0 },
  ];
  games.forEach((g, i) => {
    const s = stacks[i % 2];
    const box = boxFor(g.platform);
    const r = rng(g.id);
    out.set(g.id, { zone: 'escritorio', x: s.x + (r() - 0.5) * 0.02, y: DESK.top + s.h + box.d / 2, z: s.z + (r() - 0.5) * 0.02, rx: -Math.PI / 2, ry: (r() - 0.5) * 0.5, rz: 0 });
    s.h += box.d;
  });
}

/** Los abandonados, de pie y torcidos dentro de una caja de cartón. */
function bin(games, out) {
  games.forEach((g, i) => {
    const layer = Math.floor(i / 8);
    const k = i % 8;
    const box = boxFor(g.platform);
    const r = rng(g.id);
    out.set(g.id, {
      zone: 'caja',
      x: BIN.x + ((k % 2 ? 1 : -1) * 0.08 + (r() - 0.5) * 0.08),
      y: 0.11 + layer * 0.07 + box.h / 2,
      z: BIN.z - 0.13 + k * 0.034,
      rx: 0,
      ry: (r() - 0.5) * 0.5,
      rz: (r() - 0.5) * 0.3,
    });
  });
}

/**
 * Calcula la habitación entera.
 * @returns {{ placements: Map<string, object>, bookcases: number, counts: object }}
 */
export function computeLayout(games, { tidy = false, sort = 'plataforma' } = {}) {
  const placements = new Map();
  const zones = { estanteria: [], pila: [], escritorio: [], caja: [] };
  for (const g of games) zones[tidy ? 'estanteria' : ZONE_OF_STATUS[g.status] || 'pila'].push(g);
  const byAdded = (a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id);
  const { overflow, bookcases, used } = shelve(sortGames(zones.estanteria, sort), placements);
  pile([...zones.pila.sort(byAdded), ...overflow], placements);
  desk(zones.escritorio.sort(byAdded), placements);
  bin(zones.caja.sort(byAdded), placements);
  return {
    placements,
    bookcases: Math.max(1, bookcases),
    decor: shelfDecor(used, Math.max(1, bookcases)),
    counts: { estanteria: zones.estanteria.length - overflow.length, pila: zones.pila.length + overflow.length, escritorio: zones.escritorio.length, caja: zones.caja.length },
  };
}
