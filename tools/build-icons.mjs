// Genera assets/vendor/icons.js: solo los iconos Lucide que usa la web
// (~20 KB en vez de los 355 KB de la librería completa).
//   node tools/build-icons.mjs   (requiere `npm i` para tener lucide en node_modules)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { icons } = require('lucide');
const ROOT = new URL('../', import.meta.url);
const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([a-zA-Z])(\d)/g, '$1-$2').toLowerCase();
const byKebab = Object.fromEntries(Object.entries(icons).map(([k, v]) => [kebab(k), v]));

const files = [
  ...readdirSync(new URL('assets/js/', ROOT)).filter((f) => f.endsWith('.js')).map((f) => `assets/js/${f}`),
  'index.html', 'panel.html', 'print.html',
];
const used = new Set();
for (const f of files) {
  const src = readFileSync(new URL(f, ROOT), 'utf8');
  for (const [, name] of src.matchAll(/['"`]([a-z][a-z0-9-]{1,30})['"`]/g)) if (byKebab[name]) used.add(name);
  for (const [, name] of src.matchAll(/data-lucide="([a-z0-9-]+)"/g)) if (byKebab[name]) used.add(name);
}
const missing = [...new Set([...readFileSync(new URL('assets/js/sections.js', ROOT), 'utf8').matchAll(/icon\('([a-z0-9-]+)'/g)].map((m) => m[1]))].filter((n) => !byKebab[n]);
if (missing.length) console.warn('Iconos inexistentes:', missing);

const children = (v) => (v[0] === "svg" ? v[2] : v); // lucide >= 0.4: ["svg", attrs, hijos]
const subset = Object.fromEntries([...used].sort().map((n) => [n, children(byKebab[n])]));
const out = `/* Lucide (ISC) — subconjunto generado por tools/build-icons.mjs. No editar a mano. */
(() => {
  const ICONS = ${JSON.stringify(subset)};
  const NS = 'http://www.w3.org/2000/svg';
  const BASE = { xmlns: NS, width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  function createIcons({ attrs = {} } = {}) {
    document.querySelectorAll('[data-lucide]').forEach((el) => {
      const name = el.getAttribute('data-lucide');
      const node = ICONS[name];
      if (!node) return;
      const svg = document.createElementNS(NS, 'svg');
      Object.entries({ ...BASE, ...attrs }).forEach(([k, v]) => svg.setAttribute(k, v));
      svg.setAttribute('class', ['lucide', 'lucide-' + name, el.getAttribute('class') || ''].join(' ').trim());
      node.forEach(([tag, a]) => {
        const child = document.createElementNS(NS, tag);
        Object.entries(a).forEach(([k, v]) => child.setAttribute(k, v));
        svg.append(child);
      });
      el.replaceWith(svg);
    });
  }
  window.lucide = { createIcons, icons: ICONS };
})();
`;
writeFileSync(new URL('assets/vendor/icons.js', ROOT), out);
console.log(`${used.size} iconos → assets/vendor/icons.js (${(out.length / 1024).toFixed(1)} KB)`);
