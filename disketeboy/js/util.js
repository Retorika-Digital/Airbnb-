// Utilidades sin dependencias: funcionan en el navegador y en Node (tests).

/** Hash FNV-1a de 32 bits: el mismo texto da siempre el mismo número. */
export function hash(str) {
  let h = 0x811c9dc5;
  const s = String(str);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pseudoaleatorio determinista (mulberry32): la pila sale igual en cada visita. */
export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return { r: 0, g: 0, b: 0 };
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function hexToHsl(hex) {
  const { r: R, g: G, b: B } = hexToRgb(hex);
  const r = R / 255, g = G / 255, b = B / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: l * 100 };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

/** Luminancia relativa (WCAG) de un color #rrggbb. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Tinta legible (oscura o clara) sobre un fondo. */
export const inkFor = (hex) => (luminance(hex) > 0.28 ? '#1d1a16' : '#fdf6e3');

/** Color estable y agradable para un título (portadas y lomos generados). */
export function colorFor(text) {
  const h = hash(String(text).toLowerCase());
  const hue = h % 360;
  const sat = 42 + ((h >>> 9) % 30);
  const lig = 30 + ((h >>> 17) % 24);
  return hslToHex(hue, sat, lig);
}

/** Normaliza un título para comparar duplicados ("The Witcher 3" ≈ "the witcher 3"). */
export function titleKey(title) {
  return String(title)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
