// Celebraciones en 2D, por encima de todo: confeti que no bloquea ningún clic.
// El canvas solo está en la página mientras hay papelitos en el aire (si se quedara,
// el navegador lo tendría que componer en cada fotograma) y va a resolución normal:
// al confeti no le hace falta más.
const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = ['#c8553d', '#f2c14e', '#3a6ea5', '#4f8a3b', '#fbf3e4', '#e86f9a', '#9b5de5'];
let canvas = null;
let ctx = null;
let parts = [];
let raf = 0;
let last = 0;

function ensure() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-layer';
  canvas.setAttribute('aria-hidden', 'true');
  ctx = canvas.getContext('2d');
}

function show() {
  ensure();
  if (canvas.width !== innerWidth || canvas.height !== innerHeight) {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
  }
  if (!canvas.isConnected) document.body.append(canvas);
}

/** Lanza confeti desde un punto de la pantalla (por defecto, arriba en el centro). */
export function confetti({ x = innerWidth / 2, y = innerHeight * 0.3, count = 90, power = 1 } = {}) {
  if (REDUCED || typeof document === 'undefined') return;
  show();
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.95;
    const speed = (5 + Math.random() * 8) * power;
    parts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.35,
      w: 5 + Math.random() * 6,
      h: 3 + Math.random() * 4,
      color: COLORS[i % COLORS.length],
      age: 0,
      ttl: 1.8 + Math.random() * 1.1,
    });
  }
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(step);
  }
}

function step(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  const k = dt * 60;
  parts = parts.filter((p) => {
    p.age += dt;
    p.vy += 0.32 * k;
    p.vx *= 0.985 ** k;
    p.vy *= 0.985 ** k;
    p.x += (p.vx + Math.sin(p.age * 9 + p.rot) * 0.8) * k;
    p.y += p.vy * k;
    p.rot += p.spin * k;
    if (p.age > p.ttl || p.y > innerHeight + 30) return false;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (p.ttl - p.age) * 2.5);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    // Girando sobre sí mismo: el ancho aparente cambia como un papelito de verdad
    ctx.scale(1, Math.abs(Math.cos(p.age * 7 + p.rot)) * 0.8 + 0.2);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
    return true;
  });
  if (parts.length) raf = requestAnimationFrame(step);
  else {
    raf = 0;
    canvas.remove();
  }
}

/** Para las pruebas: cuántos papelitos hay en el aire. */
export const confettiCount = () => parts.length;
