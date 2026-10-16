// DisketePrinter: el resumen de tu colección como un ticket de papel térmico
// (384 px de ancho, como las impresoras de 58 mm) y la foto de tu habitación
// lista para compartir.
import { stats, pileForecast } from './store.js';
import { platform } from './platforms.js';
import { hash, rng } from './util.js';
import { t, tp, mark, locale } from './i18n.js';

const MONO = '"VT323", ui-monospace, "Courier New", monospace';
const MONTHS = [mark('ENE'), mark('FEB'), mark('MAR'), mark('ABR'), mark('MAY'), mark('JUN'), mark('JUL'), mark('AGO'), mark('SEP'), mark('OCT'), mark('NOV'), mark('DIC')];
const WIDTH = 32; // caracteres por línea

const pad2 = (n) => String(n).padStart(2, '0');
const num = (n) => Math.round(n).toLocaleString(locale());
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const row = (left, right) => {
  const r = String(right);
  const l = cut(String(left), WIDTH - r.length - 1);
  return `${l}${' '.repeat(Math.max(1, WIDTH - l.length - r.length))}${r}`;
};
const center = (s) => {
  const text = cut(String(s), WIDTH);
  return ' '.repeat(Math.floor((WIDTH - text.length) / 2)) + text;
};

/** Las líneas del ticket (texto puro: así se puede probar sin navegador). */
export function ticketLines(all, now = new Date()) {
  const games = all.filter((g) => g.kind !== 'mesa');
  const st = stats(games);
  const rule = '-'.repeat(WIDTH);
  const lines = [
    { text: center('DISKETEBOY'), big: true, align: 'center' },
    { text: center(t('TIENDA DE TU COLECCIÓN')), align: 'center' },
    { text: center(t('C/ del Cartucho, 64 · 8 bits')), align: 'center' },
    { text: rule },
    { text: row(`${t('{d}/{m}/{y}', { d: pad2(now.getDate()), m: pad2(now.getMonth() + 1), y: now.getFullYear() })} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`, t('Nº {n}', { n: String(hash(games.map((g) => g.id).join()) % 1e6).padStart(6, '0') })) },
    { text: rule },
  ];
  if (st.mostPlayed.length) {
    lines.push({ text: t('LO QUE MÁS HAS JUGADO'), bold: true });
    const top = [...games].filter((g) => g.hours > 0).sort((a, b) => b.hours - a.hours).slice(0, 5);
    for (const g of top) lines.push({ text: row(g.title, `${num(g.hours)} h`) });
    lines.push({ text: rule });
  }
  const perPlatform = {};
  for (const g of games) perPlatform[g.platform] = (perPlatform[g.platform] || 0) + 1;
  const plats = Object.entries(perPlatform).sort((a, b) => b[1] - a[1]);
  if (plats.length) {
    lines.push({ text: t('POR PLATAFORMA'), bold: true });
    for (const [pid, n] of plats.slice(0, 6)) lines.push({ text: row(`${n} x ${t(platform(pid).name)}`, tp(n, 'caja', 'cajas')) });
    if (plats.length > 6) lines.push({ text: row(tp(plats.length - 6, '1 plataforma más', '{n} plataformas más'), '…') });
    lines.push({ text: rule });
  }
  lines.push({ text: row(t('JUEGOS'), num(st.total)) });
  lines.push({ text: row(t('HORAS JUGADAS'), num(st.hours)) });
  lines.push({ text: row(t('NOTA MEDIA'), st.avgScore === null ? '—' : st.avgScore.toLocaleString(locale())) });
  lines.push({ text: row(t('TERMINADOS'), `${st.by.terminado} (${st.total ? Math.round((st.by.terminado / st.total) * 100) : 0}%)`) });
  lines.push({ text: row(t('ABANDONADOS'), st.by.abandonado) });
  lines.push({ text: rule });
  lines.push({ text: row(t('PENDIENTE DE PAGO:'), tp(st.by.pendiente, '1 JUEGO', '{n} JUEGOS')), big: true });
  if (st.by.pendiente) {
    const f = pileForecast(st.by.pendiente, 1, now);
    lines.push({ text: row(t('A 1 al mes, acabas en'), `${t(MONTHS[f.month])} ${f.year}`) });
  } else {
    lines.push({ text: center(t('¡PILA DE LA VERGÜENZA A CERO!')), align: 'center' });
  }
  lines.push({ text: rule });
  lines.push({ text: center(t('GRACIAS POR JUGAR')), align: 'center' });
  lines.push({ text: center(t('No se admiten devoluciones')), align: 'center' });
  lines.push({ text: center(t('de horas jugadas')), align: 'center' });
  return lines;
}

/** Dibuja el ticket en un canvas de 384 px de ancho. */
export function renderTicket(games, now = new Date()) {
  const lines = ticketLines(games, now);
  const W = 384;
  const lh = 22;
  const top = 34;
  const H = top + lines.reduce((s, l) => s + (l.big ? lh + 8 : lh), 0) + 120;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  // Papel con bordes de sierra
  ctx.beginPath();
  const tooth = 12;
  ctx.moveTo(0, tooth / 2);
  for (let x = 0; x <= W; x += tooth) ctx.lineTo(x + tooth / 2, x % (tooth * 2) ? tooth / 2 : 0);
  ctx.lineTo(W, H - tooth / 2);
  for (let x = W; x >= 0; x -= tooth) ctx.lineTo(x - tooth / 2, x % (tooth * 2) ? H - tooth / 2 : H);
  ctx.closePath();
  const paper = ctx.createLinearGradient(0, 0, W, 0);
  paper.addColorStop(0, '#f1ece0');
  paper.addColorStop(0.5, '#fbf8f0');
  paper.addColorStop(1, '#efe9dc');
  ctx.fillStyle = paper;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const r = rng(now.toDateString());
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = '#00000008';
    ctx.fillRect(r() * W, r() * H, 1, 1);
  }
  ctx.fillStyle = '#26231f';
  ctx.textBaseline = 'top';
  // La fuente de repuesto puede ser más ancha que VT323: se ajusta al papel.
  const avail = W - 34;
  const fit = (size, text) => {
    ctx.font = `${size}px ${MONO}`;
    const w = ctx.measureText(text).width;
    if (w > avail) ctx.font = `${Math.floor((size * avail) / w)}px ${MONO}`;
  };
  ctx.font = `21px ${MONO}`;
  const base = Math.min(21, Math.floor((21 * avail) / ctx.measureText('M'.repeat(WIDTH)).width));
  let y = top;
  for (const l of lines) {
    const text = l.align === 'center' ? l.text.trim() : l.text;
    const x = l.align === 'center' ? W / 2 : 17;
    ctx.textAlign = l.align === 'center' ? 'center' : 'left';
    fit(l.big ? Math.round(base * 1.33) : base, text);
    ctx.fillText(text, x, y);
    if (l.bold) ctx.fillText(text, x + 0.6, y);
    y += l.big ? lh + 8 : lh;
  }
  // Código de barras
  y += 14;
  const br = rng(String(games.length));
  let x = 60;
  while (x < W - 60) {
    const w = 1 + Math.floor(br() * 3);
    ctx.fillRect(x, y, w, 46);
    x += w + 1 + Math.floor(br() * 3);
  }
  ctx.textAlign = 'center';
  const tagline = t('disketeboy · tu colección en tu habitación');
  fit(18, tagline);
  ctx.fillText(tagline, W / 2, y + 54);
  ctx.restore();
  return c;
}

/** La foto de tu habitación con un pie: lista para Reddit, WhatsApp o donde sea. */
export function renderSnapshot(roomCanvas, all) {
  const games = all.filter((g) => g.kind !== 'mesa');
  const boards = all.length - games.length;
  const st = stats(games);
  const W = 1200;
  const scale = W / roomCanvas.width;
  const photoH = Math.round(roomCanvas.height * scale);
  const footer = 120;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = photoH + footer;
  const ctx = c.getContext('2d');
  ctx.drawImage(roomCanvas, 0, 0, W, photoH);
  ctx.fillStyle = '#231e1a';
  ctx.fillRect(0, photoH, W, footer);
  ctx.fillStyle = '#c8553d';
  ctx.fillRect(0, photoH, W, 6);
  ctx.fillStyle = '#fbf3e4';
  ctx.font = '900 40px "Trebuchet MS", system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(t('Mi habitación en DisketeBoy'), 40, photoH + footer / 2 - 16);
  ctx.font = '500 26px system-ui, sans-serif';
  ctx.fillStyle = '#d9cbb4';
  const parts = [tp(st.total, '1 videojuego', '{n} videojuegos', { n: num(st.total) }), boards ? t('{n} de mesa', { n: boards }) : null, t('{n} h jugadas', { n: num(st.hours) }), t('{n} en la pila de la vergüenza', { n: st.by.pendiente })];
  ctx.fillText(parts.filter(Boolean).join(' · '), 40, photoH + footer / 2 + 26, W - 80);
  return c;
}
