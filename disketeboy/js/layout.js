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

// Kallax de 4×2 cubos en la pared derecha para los juegos de mesa.
export const KALLAX = { x: ROOM.maxX - 0.2, z: -0.42, yaw: -Math.PI / 2, cols: 4, rows: 2, cell: 0.335, wall: 0.016, depth: 0.39 };
KALLAX.width = KALLAX.cols * KALLAX.cell + (KALLAX.cols + 1) * KALLAX.wall;
KALLAX.height = KALLAX.rows * KALLAX.cell + (KALLAX.rows + 1) * KALLAX.wall;

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
 * Juegos de mesa: de pie en los cubos de la Kallax (fila de arriba primero) y,
 * encima, en montones, los que siguen con el plástico y los que ya no caben.
 */
function kallax(games, binders, out, tidy) {
  const K = KALLAX;
  const byTitle = (a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
  const inCubes = games.filter((g) => tidy || g.status !== 'pendiente').sort(byTitle);
  const onTop = games.filter((g) => !tidy && g.status === 'pendiente').sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
  const spot = { x: K.x, z: K.z, yaw: K.yaw };
  const cells = [];
  for (let r = K.rows - 1; r >= 0; r--) for (let c = 0; c < K.cols; c++) cells.push({ c, r, used: 0, owner: null });
  const put = (g, cell) => {
    const box = boxFor(g.platform);
    const { c, r } = cell;
    const lx = -K.width / 2 + K.wall + c * (K.cell + K.wall) + cell.used + box.d / 2;
    const lz = K.depth / 2 - 0.015 - box.w / 2;
    const { x, z } = toWorld(spot, lx, lz);
    out.set(g.id, { zone: 'kallax', x, y: K.wall + r * (K.cell + K.wall) + box.h / 2, z, rx: 0, ry: K.yaw + Math.PI / 2, rz: 0 });
    cell.used += box.d + 0.004;
  };
  // Las carpetas de cartas, en los cubos de abajo empezando por la derecha
  let back = cells.length - 1;
  const extraBinders = [];
  for (const b of [...binders].sort(byTitle)) {
    const d = boxFor(b.platform).d;
    while (back >= 0 && (cells[back].owner === 'mesa' || cells[back].used + d > K.cell)) back--;
    if (back < 0) {
      extraBinders.push(b);
      continue;
    }
    cells[back].owner = 'carpeta';
    put(b, cells[back]);
  }
  // Los juegos de mesa, desde arriba a la izquierda
  let cell = 0;
  for (const g of inCubes) {
    const box = boxFor(g.platform);
    while (cell < cells.length && (cells[cell].owner === 'carpeta' || cells[cell].used + box.d > K.cell)) cell++;
    if (cell >= cells.length) {
      onTop.push(g);
      continue;
    }
    cells[cell].owner = 'mesa';
    put(g, cells[cell]);
  }
  onTop.push(...extraBinders);
  // Montones encima de la Kallax (y, si no caben, en el suelo a su lado)
  const stacks = [-0.48, 0, 0.48].map((lx) => ({ lx, lz: 0, y: K.height }));
  for (let i = 0; i < 6; i++) stacks.push({ lx: K.width / 2 + 0.25 + (i % 2) * 0.36, lz: 0.05 + Math.floor(i / 2) * 0.36, y: 0 });
  onTop.forEach((g, i) => {
    const box = boxFor(g.platform);
    const s = stacks.find((st) => st.y + box.d < (st.lx > K.width / 2 ? 0.9 : K.height + 0.55)) || stacks[i % stacks.length];
    const r = rng(g.id);
    const { x, z } = toWorld(spot, s.lx + (r() - 0.5) * 0.02, s.lz + (r() - 0.5) * 0.02);
    out.set(g.id, { zone: 'encima', x, y: s.y + box.d / 2, z, rx: -Math.PI / 2, ry: K.yaw + (r() - 0.5) * 0.3, rz: 0 });
    s.y += box.d;
  });
}

/**
 * Calcula la habitación entera.
 * @returns {{ placements: Map<string, object>, bookcases: number, counts: object }}
 */
/** Los mazos, en su cajita y de pie delante de la tele, con la etiqueta hacia ti. */
function decks(list, out) {
  const perRow = 7;
  const x0 = DESK.x - 0.27;
  const z = DESK.z + DESK.depth / 2 - 0.07;
  [...list].sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id)).forEach((g, i) => {
    const box = boxFor(g.platform);
    const tier = Math.floor(i / perRow);
    const r = rng(g.id);
    out.set(g.id, { zone: 'mazos', x: x0 + (i % perRow) * (box.w + 0.012), y: DESK.top + tier * box.h + box.h / 2, z: z - (tier % 2) * 0.004, rx: 0, ry: (r() - 0.5) * 0.12, rz: 0 });
  });
}

export function computeLayout(all, { tidy = false, sort = 'plataforma' } = {}) {
  const placements = new Map();
  const games = all.filter((g) => g.kind !== 'mesa' && g.kind !== 'mazo' && g.kind !== 'carpeta');
  const boards = all.filter((g) => g.kind === 'mesa');
  const zones = { estanteria: [], pila: [], escritorio: [], caja: [] };
  for (const g of games) zones[tidy ? 'estanteria' : ZONE_OF_STATUS[g.status] || 'pila'].push(g);
  const byAdded = (a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id);
  const { overflow, bookcases, used } = shelve(sortGames(zones.estanteria, sort), placements);
  pile([...zones.pila.sort(byAdded), ...overflow], placements);
  desk(zones.escritorio.sort(byAdded), placements);
  bin(zones.caja.sort(byAdded), placements);
  kallax(boards, all.filter((g) => g.kind === 'carpeta'), placements, tidy);
  decks(all.filter((g) => g.kind === 'mazo'), placements);
  const inZone = (z) => [...placements.values()].filter((p) => p.zone === z).length;
  return {
    placements,
    bookcases: Math.max(1, bookcases),
    decor: shelfDecor(used, Math.max(1, bookcases)),
    counts: {
      estanteria: zones.estanteria.length - overflow.length,
      pila: zones.pila.length + overflow.length,
      escritorio: zones.escritorio.length,
      caja: zones.caja.length,
      kallax: inZone('kallax'),
      encima: inZone('encima'),
      mazos: inZone('mazos'),
    },
  };
}
