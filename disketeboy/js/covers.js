// Portadas, lomos y contraportadas dibujados en canvas: cada juego tiene su
// diseño propio (estable, sale del título) y, si es de Steam, su portada real.
import { platform, boxFor } from './platforms.js';
import { colorFor, inkFor, rng, hexToHsl, hslToHex } from './util.js';
import { statusLabel, isBoard } from './store.js';
import { steamCover } from './steam.js';
import { playersText, minutesText, lentText } from './boards.js';

const SANS = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const HEAVY = '"Arial Black", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export const gameColor = (g) => g.color || colorFor(g.title);

/** Baja el tamaño de letra hasta que la palabra más larga quepa en el ancho (para no cortar «AVENTUREROS»). */
function fitWords(ctx, text, maxWidth, size, font) {
  const longest = String(text).split(/\s+/).reduce((a, b) => (b.length > a.length ? b : a), '');
  let s = size;
  ctx.font = font(s);
  while (s > 8 && ctx.measureText(longest).width > maxWidth) ctx.font = font(--s);
  return s;
}

/** Parte un texto en líneas que caben en maxWidth; la última acaba en «…» si no cabe. */
export function wrap(ctx, text, maxWidth, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last.trimEnd()}…`;
  }
  return lines.map((l) => {
    let s = l;
    while (s.length > 1 && ctx.measureText(s).width > maxWidth) s = s.slice(0, -1);
    return s === l ? l : `${s.slice(0, -1)}…`;
  });
}

function drawArt(ctx, g, W, H, top) {
  const base = gameColor(g);
  const r = rng(g.title.toLowerCase());
  const { h, s, l } = hexToHsl(base);
  const dark = hslToHex(h, s, Math.max(7, l - 24));
  const light = hslToHex((h + 25) % 360, Math.min(85, s + 12), Math.min(80, l + 22));
  const accent = hslToHex((h + 160 + r() * 60) % 360, 75, 62);
  const bg = ctx.createLinearGradient(0, top, 0, H);
  bg.addColorStop(0, light);
  bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, top, W, H - top);
  const style = Math.floor(r() * 4);
  if (style === 0) {
    // Sol retro sobre montañas
    const cy = top + (H - top) * 0.36;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(W * (0.3 + r() * 0.4), cy, W * 0.24, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = light;
      ctx.fillRect(0, cy + i * W * 0.045, W, W * 0.011 * (i + 1));
    }
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, H * 0.64);
    let x = 0;
    while (x < W) {
      x += W * (0.1 + r() * 0.2);
      ctx.lineTo(x, H * (0.4 + r() * 0.18));
      x += W * (0.08 + r() * 0.16);
      ctx.lineTo(x, H * 0.64);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.fill();
  } else if (style === 1) {
    // Rayos y emblema
    ctx.save();
    ctx.translate(W / 2, top + (H - top) * 0.38);
    for (let i = 0; i < 18; i++) {
      ctx.rotate(Math.PI / 9);
      ctx.fillStyle = i % 2 ? '#ffffff18' : '#00000014';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(W * 1.2, -W * 0.2);
      ctx.lineTo(W * 1.2, W * 0.2);
      ctx.fill();
    }
    ctx.fillStyle = accent;
    ctx.strokeStyle = dark;
    ctx.lineWidth = W * 0.025;
    ctx.beginPath();
    const R = W * 0.2;
    for (let i = 0; i < 6; i++) ctx.lineTo(Math.cos((i / 6) * Math.PI * 2) * R, Math.sin((i / 6) * Math.PI * 2) * R);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else if (style === 2) {
    // Mosaico de píxeles
    const cell = Math.round(W / 11);
    for (let y = top + cell * 0.5; y < H * 0.72; y += cell) {
      for (let x = 0; x < W; x += cell) {
        if (r() < 0.38) {
          ctx.fillStyle = r() < 0.5 ? `${accent}cc` : `${light}99`;
          ctx.fillRect(x + 1, y + 1, cell - 3, cell - 3);
        }
      }
    }
  } else {
    // Franjas diagonales
    ctx.save();
    ctx.translate(0, top);
    ctx.rotate(-0.55);
    for (let i = -2; i < 14; i++) {
      ctx.fillStyle = i % 3 === 0 ? `${accent}88` : i % 2 ? '#ffffff16' : '#00000010';
      ctx.fillRect(i * W * 0.14 - W * 0.4, -H, W * 0.07, H * 3);
    }
    ctx.restore();
  }
  // Panel inferior con el título
  const panel = ctx.createLinearGradient(0, H * 0.55, 0, H);
  panel.addColorStop(0, '#0000');
  panel.addColorStop(1, '#000a');
  ctx.fillStyle = panel;
  ctx.fillRect(0, H * 0.55, W, H * 0.45);
  const size = fitWords(ctx, g.title.toUpperCase(), W * 0.86, Math.round(W * (g.title.length > 28 ? 0.1 : g.title.length > 14 ? 0.12 : 0.15)), (s) => `900 ${s}px ${HEAVY}`);
  const lines = wrap(ctx, g.title.toUpperCase(), W * 0.86, 4);
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  let y = H - W * 0.08 - (lines.length - 1) * size * 1.05;
  for (const line of lines) {
    ctx.lineWidth = size * 0.22;
    ctx.strokeStyle = dark;
    ctx.strokeText(line, W * 0.07, y);
    ctx.fillStyle = '#fffaf0';
    ctx.fillText(line, W * 0.07, y);
    y += size * 1.05;
  }
}

/** Silueta de meeple genérica (la ficha de persona de los juegos de mesa). */
function meeple(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y - s * 0.62, s * 0.22, 0, Math.PI * 2);
  ctx.moveTo(x - s * 0.5, y - s * 0.28);
  ctx.quadraticCurveTo(x, y - s * 0.48, x + s * 0.5, y - s * 0.28);
  ctx.lineTo(x + s * 0.42, y - s * 0.12);
  ctx.lineTo(x + s * 0.2, y - s * 0.12);
  ctx.lineTo(x + s * 0.38, y + s * 0.42);
  ctx.lineTo(x + s * 0.08, y + s * 0.42);
  ctx.lineTo(x, y + s * 0.12);
  ctx.lineTo(x - s * 0.08, y + s * 0.42);
  ctx.lineTo(x - s * 0.38, y + s * 0.42);
  ctx.lineTo(x - s * 0.2, y - s * 0.12);
  ctx.lineTo(x - s * 0.42, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
}

/** Portada de juego de mesa: marco, meeples/dados/losetas, título y jugadores·duración. */
function drawBoardCover(g) {
  const box = boxFor(g.platform);
  const W = 256;
  const H = Math.round((W * box.h) / box.w);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const base = gameColor(g);
  const { h, s, l } = hexToHsl(base);
  const dark = hslToHex(h, s, Math.max(10, l - 20));
  const light = hslToHex((h + 30) % 360, Math.min(80, s + 10), Math.min(78, l + 25));
  const r = rng(`mesa:${g.title.toLowerCase()}`);
  const bg = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.5, W * 0.8);
  bg.addColorStop(0, light);
  bg.addColorStop(1, dark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const style = Math.floor(r() * 3);
  const palette = ['#c8553d', '#3e6fb0', '#f2c14e', '#4f8a4a', '#f4efe4', '#6b4a7a'];
  if (style === 0) {
    for (let i = 0; i < 5; i++) meeple(ctx, W * (0.18 + i * 0.16), H * (0.62 + (i % 2) * 0.05), W * (0.16 + r() * 0.06), palette[i % palette.length]);
  } else if (style === 1) {
    for (let i = 0; i < 7; i++) {
      const cx = W * (0.2 + r() * 0.6);
      const cy = H * (0.45 + r() * 0.3);
      const R = W * 0.06;
      ctx.fillStyle = palette[i % palette.length];
      ctx.beginPath();
      for (let k = 0; k < 6; k++) ctx.lineTo(cx + Math.cos((k / 6) * Math.PI * 2) * R, cy + Math.sin((k / 6) * Math.PI * 2) * R);
      ctx.fill();
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = W * (0.25 + i * 0.25);
      const y = H * (0.6 + (i % 2) * 0.06);
      const S = W * 0.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((r() - 0.5) * 0.8);
      ctx.fillStyle = '#f4efe4';
      ctx.beginPath();
      ctx.roundRect(-S / 2, -S / 2, S, S, S * 0.18);
      ctx.fill();
      ctx.fillStyle = '#231e1a';
      const pips = 1 + Math.floor(r() * 6);
      const spots = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[pips];
      for (const [px, py] of spots) {
        ctx.beginPath();
        ctx.arc(px * S * 0.26, py * S * 0.26, S * 0.08, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  // Título arriba, gordo y con contorno
  const size = fitWords(ctx, g.title.toUpperCase(), W * 0.8, Math.round(W * (g.title.length > 22 ? 0.09 : g.title.length > 12 ? 0.11 : 0.14)), (s) => `900 ${s}px ${HEAVY}`);
  ctx.textAlign = 'center';
  ctx.lineJoin = 'round';
  let y = H * 0.16 + size * 0.5;
  for (const line of wrap(ctx, g.title.toUpperCase(), W * 0.8, 3)) {
    ctx.lineWidth = size * 0.25;
    ctx.strokeStyle = dark;
    ctx.strokeText(line, W / 2, y);
    ctx.fillStyle = '#fffaf0';
    ctx.fillText(line, W / 2, y);
    y += size * 1.05;
  }
  // Barra inferior: jugadores y duración
  const bar = H * 0.13;
  ctx.fillStyle = '#231e1acc';
  ctx.fillRect(0, H - bar, W, bar);
  ctx.fillStyle = '#fbf3e4';
  ctx.font = `800 ${Math.round(bar * 0.42)}px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  meeple(ctx, W * 0.1, H - bar / 2 + bar * 0.05, bar * 0.55, '#fbf3e4');
  ctx.fillText(g.minPlayers === g.maxPlayers ? `${g.minPlayers}` : `${g.minPlayers}-${g.maxPlayers}`, W * 0.17, H - bar / 2);
  ctx.beginPath();
  ctx.strokeStyle = '#fbf3e4';
  ctx.lineWidth = 3;
  ctx.arc(W * 0.58, H - bar / 2, bar * 0.24, 0, Math.PI * 2);
  ctx.moveTo(W * 0.58, H - bar / 2);
  ctx.lineTo(W * 0.58, H - bar / 2 - bar * 0.16);
  ctx.moveTo(W * 0.58, H - bar / 2);
  ctx.lineTo(W * 0.58 + bar * 0.12, H - bar / 2);
  ctx.stroke();
  ctx.fillText(`${g.minutes}'`, W * 0.65, H - bar / 2);
  // Marco clásico de caja
  ctx.strokeStyle = '#fbf3e4';
  ctx.lineWidth = W * 0.025;
  ctx.strokeRect(W * 0.03, W * 0.03, W * 0.94, H - W * 0.06);
  if (g.status === 'pendiente') {
    // Pegatina de «sin estrenar»
    ctx.save();
    ctx.translate(W * 0.8, H * 0.42);
    ctx.rotate(0.3);
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const rr = i % 2 ? W * 0.11 : W * 0.14;
      ctx.lineTo(Math.cos((i / 24) * Math.PI * 2) * rr, Math.sin((i / 24) * Math.PI * 2) * rr);
    }
    ctx.fill();
    ctx.fillStyle = '#231e1a';
    ctx.font = `900 ${Math.round(W * 0.042)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SIN', 0, -W * 0.025);
    ctx.fillText('ESTRENAR', 0, W * 0.025, W * 0.2);
    ctx.restore();
  }
  const gloss = ctx.createLinearGradient(0, 0, W, H);
  gloss.addColorStop(0, '#ffffff2e');
  gloss.addColorStop(0.5, '#ffffff00');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, W, H);
  return c;
}

/** Portada: dibujo generado o la imagen real, con la franja de la plataforma. */
export function drawCover(g, image = null) {
  if (isBoard(g)) return drawBoardCover(g);
  const box = boxFor(g.platform);
  const pl = platform(g.platform);
  const W = 256;
  const H = Math.round((W * box.h) / box.w);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const band = Math.round(Math.min(H, W) * 0.09);
  if (image) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);
    const s = Math.max(W / image.width, (H - band) / image.height);
    ctx.drawImage(image, (W - image.width * s) / 2, band + (H - band - image.height * s) / 2, image.width * s, image.height * s);
  } else {
    drawArt(ctx, g, W, H, band);
  }
  ctx.fillStyle = pl.band;
  ctx.fillRect(0, 0, W, band);
  ctx.fillStyle = inkFor(pl.band);
  ctx.font = `800 ${Math.round(band * 0.6)}px ${SANS}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(pl.short, band * 0.5, band / 2 + 1);
  const gloss = ctx.createLinearGradient(0, 0, W, H);
  gloss.addColorStop(0, '#ffffff26');
  gloss.addColorStop(0.45, '#ffffff00');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, W, H);
  return c;
}

// Bajo el lomo va una franja del color de la caja: los laterales de la caja 3D
// usan ese trozo de la textura, y así cada caja de la estantería se dibuja de una vez.
export const SPINE_STRIP = 8;

/** Tamaño del lomo en píxeles (sin la franja); `small` para colecciones grandes. */
export function spineSize(platformId, small = false) {
  const box = boxFor(platformId);
  const H = (box.h / box.d > 8 ? 512 : 256) / (small ? 2 : 1);
  return { W: Math.max(small ? 16 : 24, Math.round((H * box.d) / box.h)), H };
}

/** Lomo: color del juego, franja de plataforma, título en vertical y ★ si está terminado. */
export function drawSpine(g, { strip = '#1c1b20', small = false } = {}) {
  const pl = platform(g.platform);
  const { W, H } = spineSize(g.platform, small);
  const c = canvas(W, H + SPINE_STRIP);
  const ctx = c.getContext('2d');
  ctx.fillStyle = strip;
  ctx.fillRect(0, H, W, SPINE_STRIP);
  const color = gameColor(g);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H);
  const shade = ctx.createLinearGradient(0, 0, W, 0);
  shade.addColorStop(0, '#0000003a');
  shade.addColorStop(0.35, '#ffffff1c');
  shade.addColorStop(1, '#00000040');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, H);
  const band = Math.round(W * 1.15);
  ctx.fillStyle = pl.band;
  ctx.fillRect(0, 0, W, band);
  ctx.fillStyle = inkFor(pl.band);
  ctx.font = `800 ${Math.round(W * 0.34)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const board = isBoard(g);
  ctx.fillText(board ? (g.minPlayers === g.maxPlayers ? String(g.minPlayers) : `${g.minPlayers}-${g.maxPlayers}`) : pl.short.slice(0, 4), W / 2, band / 2 + 1, W * 0.9);
  // Título en vertical, de arriba abajo
  const ink = inkFor(color);
  const starred = g.status === 'terminado' || g.status === 'favorito';
  const foot = (starred ? W * 1.2 : W * 0.4) + (board && g.lentTo ? W * 1.3 : 0);
  const avail = H - band - foot - W * 0.4;
  let size = Math.round(W * 0.56);
  ctx.font = `800 ${size}px ${SANS}`;
  while (ctx.measureText(g.title).width > avail && size > W * 0.36) {
    size--;
    ctx.font = `800 ${size}px ${SANS}`;
  }
  const [title] = wrap(ctx, g.title, avail, 1);
  ctx.save();
  ctx.translate(W / 2, band + W * 0.25);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'left';
  ctx.fillStyle = ink;
  ctx.fillText(title, 0, 1);
  ctx.restore();
  if (starred) {
    ctx.fillStyle = '#f2c14e';
    ctx.font = `${Math.round(W * 0.8)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('★', W / 2, H - W * 0.62);
  }
  if (board && g.lentTo) {
    // Pósit amarillo: este juego no está en casa
    const y0 = H - (starred ? W * 1.2 : W * 0.4) - W * 1.25;
    ctx.fillStyle = '#f7d154';
    ctx.fillRect(W * 0.08, y0, W * 0.84, W * 1.15);
    ctx.save();
    ctx.translate(W / 2, y0 + W * 0.575);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = '#231e1a';
    ctx.font = `900 ${Math.round(W * 0.3)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText('PRESTADO', 0, 1, W * 1.05);
    ctx.restore();
  }
  return c;
}

/** Contraportada: tu reseña, tu nota y tus horas, como el texto oficial de la caja. */
export function drawBack(g) {
  const box = boxFor(g.platform);
  const W = 512;
  const H = Math.round((W * box.h) / box.w);
  const c = canvas(W, H);
  const ctx = c.getContext('2d');
  const pad = W * 0.07;
  const color = gameColor(g);
  ctx.fillStyle = '#f6efe1';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, W, H * 0.03);
  ctx.fillRect(0, H * 0.97, W, H * 0.03);
  // Título
  ctx.fillStyle = '#231e1a';
  ctx.textBaseline = 'top';
  let size = Math.round(W * 0.075);
  ctx.font = `900 ${size}px ${HEAVY}`;
  const titleLines = wrap(ctx, g.title, W - pad * 2 - (g.score !== null ? W * 0.26 : 0), 2);
  let y = H * 0.06;
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += size * 1.1;
  }
  ctx.font = `600 ${Math.round(W * 0.038)}px ${SANS}`;
  ctx.fillStyle = '#6b5f50';
  const board = isBoard(g);
  ctx.fillText(board ? `${playersText(g)} · ${minutesText(g.minutes)} · ${statusLabel(g)}` : `${platform(g.platform).name} · ${statusLabel(g)}`, pad, y + 4, W - pad * 2 - (g.score !== null ? W * 0.24 : 0));
  y += W * 0.07;
  // Nota en un círculo gordo
  if (g.score !== null) {
    const R = W * 0.1;
    const cx = W - pad - R;
    const cy = H * 0.06 + R;
    ctx.fillStyle = g.score >= 8 ? '#c8553d' : g.score >= 5 ? '#d9a33a' : '#6b5f50';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(R * 1.05)}px ${HEAVY}`;
    ctx.fillText(String(g.score), cx, cy + 2);
    ctx.font = `700 ${Math.round(R * 0.32)}px ${SANS}`;
    ctx.fillText('/10', cx, cy + R * 0.66);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }
  // Separador
  ctx.strokeStyle = '#231e1a33';
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(pad, y);
  ctx.lineTo(W - pad, y);
  ctx.stroke();
  ctx.setLineDash([]);
  y += W * 0.04;
  // Reseña
  size = Math.round(W * (g.review.length > 380 ? 0.034 : g.review.length > 160 ? 0.042 : 0.05));
  ctx.font = `italic ${size}px ${SERIF}`;
  ctx.fillStyle = '#2b2622';
  const footer = H * 0.16;
  const maxLines = Math.max(1, Math.floor((H - y - footer) / (size * 1.3)));
  const text = g.review ? `«${g.review}»` : 'Todavía no hay reseña. Escríbela desde la DisketeBoy y aparecerá aquí, como el texto de la caja.';
  if (!g.review) ctx.fillStyle = '#8a7d6c';
  for (const line of wrap(ctx, text.replace(/\n+/g, ' '), W - pad * 2, maxLines)) {
    ctx.fillText(line, pad, y);
    y += size * 1.3;
  }
  // Pie: horas, fecha y código de barras
  const fy = H - footer + H * 0.02;
  ctx.fillStyle = '#231e1a';
  ctx.font = `800 ${Math.round(W * 0.042)}px ${SANS}`;
  if (board) ctx.fillText(g.plays ? `${g.plays} partida${g.plays === 1 ? '' : 's'}` : '¡Aún sin estrenar!', pad, fy);
  else ctx.fillText(g.hours ? `${g.hours} h jugadas` : 'Sin horas apuntadas', pad, fy);
  ctx.font = `500 ${Math.round(W * 0.032)}px ${SANS}`;
  ctx.fillStyle = board && g.lentTo ? '#b3261e' : '#6b5f50';
  ctx.fillText(board && g.lentTo ? lentText(g) : `En tu colección desde ${new Date(g.addedAt).toLocaleDateString('es-ES')}`, pad, fy + W * 0.06, W * 0.6);
  const r = rng(g.id);
  let bx = W - pad - W * 0.26;
  ctx.fillStyle = '#111';
  while (bx < W - pad) {
    const w = 1 + Math.floor(r() * 4);
    ctx.fillRect(bx, fy, w, W * 0.09);
    bx += w + 1 + Math.floor(r() * 3);
  }
  ctx.font = `700 ${Math.round(W * 0.026)}px ${SANS}`;
  ctx.fillText('DisketeBoy', W - pad - W * 0.26, fy + W * 0.1);
  return c;
}

// ------------------------------------------------------------------ portadas reales
const cache = new Map();
let active = 0;
const queue = [];

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img.naturalWidth > 1 ? img : null);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function pump() {
  while (active < 4 && queue.length) {
    const job = queue.shift();
    active++;
    job().finally(() => {
      active--;
      pump();
    });
  }
}

/** Promesa con la portada real (imagen con CORS) o null. Primero directa; si falla, por nuestro servidor. */
export function loadCover(g) {
  if (!g.steamAppId && !g.cover) return Promise.resolve(null);
  const key = g.steamAppId ? `steam:${g.steamAppId}` : g.cover;
  if (!cache.has(key)) {
    cache.set(
      key,
      new Promise((resolve) => {
        queue.push(async () => {
          let img = await loadImage(g.steamAppId ? steamCover(g.steamAppId) : g.cover);
          if (!img && g.steamAppId) img = await loadImage(`api/cover?appid=${g.steamAppId}`);
          resolve(img && canRead(img) ? img : null);
        });
        pump();
      }),
    );
  }
  return cache.get(key);
}

const colorCache = new Map();

/** Color del lomo de un juego de Steam, sacado de su cápsula pequeña (5 KB) sin bajar la portada entera. */
export function loadSpineColor(g) {
  if (!g.steamAppId) return Promise.resolve(null);
  if (!colorCache.has(g.steamAppId)) {
    colorCache.set(
      g.steamAppId,
      new Promise((resolve) => {
        queue.push(async () => {
          const direct = `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.steamAppId}/capsule_sm_120.jpg`;
          let img = await loadImage(direct);
          if (!img) img = await loadImage(`api/cover?appid=${g.steamAppId}&tipo=capsula`);
          resolve(img && canRead(img) ? dominantColor(img) : null);
        });
        pump();
      }),
    );
  }
  return colorCache.get(g.steamAppId);
}

function canRead(img) {
  try {
    const c = canvas(4, 4);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 4, 4);
    ctx.getImageData(0, 0, 1, 1);
    return true;
  } catch {
    return false;
  }
}

/** Color dominante "vivo" de una imagen, para teñir el lomo como el de verdad. */
export function dominantColor(img) {
  try {
    const c = canvas(16, 24);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 16, 24);
    const { data } = ctx.getImageData(0, 0, 16, 24);
    let best = null;
    let bestScore = -1;
    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const key = ((data[i] >> 5) << 6) | ((data[i + 1] >> 5) << 3) | (data[i + 2] >> 5);
      const b = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
      b.r += data[i];
      b.g += data[i + 1];
      b.b += data[i + 2];
      b.n++;
      buckets.set(key, b);
    }
    for (const b of buckets.values()) {
      const r = b.r / b.n;
      const g = b.g / b.n;
      const bl = b.b / b.n;
      const max = Math.max(r, g, bl);
      const min = Math.min(r, g, bl);
      const sat = max ? (max - min) / max : 0;
      const score = b.n * (0.35 + sat) * (max > 30 ? 1 : 0.3);
      if (score > bestScore) {
        bestScore = score;
        best = [r, g, bl];
      }
    }
    if (!best) return null;
    return `#${best.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  } catch {
    return null;
  }
}
