// Pequeñas utilidades de DOM compartidas por la guía y el panel.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const icon = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;

export function refreshIcons() {
  window.lucide?.createIcons({ attrs: { 'aria-hidden': 'true' } });
}

/** <img> que, si falla, se convierte en un recuadro de color con emoji. */
export function photo(src, alt = '', cls = '', emoji = '📍') {
  if (!src) return `<div class="ph ${cls}" role="img" aria-label="${esc(alt)}">${emoji}</div>`;
  return `<img class="${cls}" src="${esc(src)}" alt="${esc(alt)}" loading="lazy" decoding="async"
    onerror="this.outerHTML='<div class=&quot;ph ${cls}&quot;>${emoji}</div>'">`;
}

let toastTimer;
export function toast(msg, iconName = 'check') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.innerHTML = `${icon(iconName)}<span>${esc(msg)}</span>`;
  refreshIcons();
  requestAnimationFrame(() => el.classList.add('is-visible'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/** QR como SVG (qrcode-generator, vendorizado). */
export function qrSvg(text, cellSize = 4) {
  if (!window.qrcode) return '';
  const qr = window.qrcode(0, 'M');
  qr.addData(unescape(encodeURIComponent(text))); // UTF-8
  qr.make();
  return qr.createSvgTag({ cellSize, margin: 0, scalable: true });
}

/** Rotaciones y desplazamientos "orgánicos" pero estables por índice. */
const ROT = [-2.6, 1.8, -1.2, 2.9, -3.2, 1.1, 2.4, -1.8, 3.1, -2.2, 1.5, -0.8];
export function scatter(i) {
  const r = ROT[i % ROT.length];
  const dx = ((i * 37) % 9) - 4;
  const dy = ((i * 53) % 11) - 5;
  return `--r:${r}deg;--dx:${dx}px;--dy:${dy}px;--i:${i}`;
}

export const params = new URLSearchParams(location.search);
