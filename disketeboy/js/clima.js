// Lluvia tras la ventana: cielo encapotado, cortinas de agua que caen, gotas en el
// cristal y, de noche, algún relámpago lejano. Todo pintado con código.
import * as THREE from 'three';

const paint = (w, h, fn) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  return c;
};
const texture = (c, repeat) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
};

/** Cortina de agua: rayas finas e inclinadas que se repiten sin costuras. */
function streaks(count, minLen, maxLen, alpha) {
  return paint(256, 256, (ctx, w, h) => {
    ctx.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const len = minLen + Math.random() * (maxLen - minLen);
      ctx.strokeStyle = `rgba(214, 228, 255, ${alpha * (0.45 + Math.random() * 0.55)})`;
      ctx.lineWidth = 0.8 + Math.random() * 0.9;
      // Se pinta tres veces (arriba, en medio y abajo) para que el patrón empalme al repetirse
      for (const dy of [-h, 0, h]) {
        ctx.beginPath();
        ctx.moveTo(x, y + dy);
        ctx.lineTo(x - len * 0.14, y + dy + len);
        ctx.stroke();
      }
    }
  });
}

/** Gotas pegadas al cristal, con su brillo y algún reguero. */
function droplets() {
  return paint(256, 224, (ctx, w, h) => {
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * w;
      const y0 = Math.random() * h * 0.6;
      const g = ctx.createLinearGradient(0, y0, 0, h);
      g.addColorStop(0, 'rgba(220, 232, 255, 0)');
      g.addColorStop(1, 'rgba(220, 232, 255, 0.16)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, y0);
      ctx.bezierCurveTo(x + 3, y0 + h * 0.3, x - 3, y0 + h * 0.5, x + 1, h);
      ctx.stroke();
    }
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 1 + Math.random() ** 2 * 4.5;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      g.addColorStop(0.35, 'rgba(200, 215, 240, 0.35)');
      g.addColorStop(1, 'rgba(40, 50, 70, 0.45)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/**
 * La lluvia de la ventana. `win` es el hueco ({x, y, w, h, z}); `onThunder` suena
 * un poco después de cada relámpago. `step(t, dt)` la anima y `setHour(h)` ajusta
 * el color del cielo encapotado (y si hay relámpagos, que solo salen de noche).
 */
export function createRain({ win, onThunder = () => {}, reduced = false }) {
  const group = new THREE.Group();
  group.name = 'lluvia';
  const plane = (z, material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), material);
    m.position.set(win.x, win.y, win.z + z);
    m.renderOrder = 1;
    group.add(m);
    return m;
  };
  const basic = (opts) => new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, ...opts });
  const cloud = plane(0.0075, basic({ color: '#7d8794', opacity: 0.6 }));
  const far = plane(0.0085, basic({ map: texture(streaks(150, 8, 18, 0.5), [2.2, 1.6]), opacity: 0.55 }));
  const near = plane(0.0095, basic({ map: texture(streaks(70, 18, 34, 0.75), [1.3, 1]), opacity: 0.8 }));
  plane(0.0105, basic({ map: texture(droplets()), opacity: 0.9 }));

  let night = false;
  let nextFlash = 6 + Math.random() * 10;
  let flashFrame = -1;
  const base = new THREE.Color();
  const white = new THREE.Color('#e6ecff');

  function setHour(hour) {
    night = hour >= 21 || hour < 7;
    const dusk = !night && (hour >= 19 || hour < 8);
    base.set(night ? '#151a26' : dusk ? '#4c5066' : '#7d8794');
    cloud.material.color.copy(base);
    cloud.material.opacity = night ? 0.72 : 0.62;
  }
  setHour(new Date().getHours());

  const api = {
    group,
    setHour,
    /** Cuántos relámpagos van (para las pruebas). */
    flashes: 0,
    /** Un relámpago en el siguiente fotograma (para el vídeo). */
    flash() {
      nextFlash = 0;
    },
    step(t, dt) {
      far.material.map.offset.y += dt * 1.1;
      near.material.map.offset.y += dt * 2.3;
      far.material.map.offset.x = Math.sin(t * 0.3) * 0.02;
      // Relámpago: dos destellos seguidos, solo dentro de la ventana, y el trueno después.
      // Con «movimiento reducido» no hay destellos.
      if (!night || reduced) return;
      if (flashFrame < 0 && t > nextFlash) {
        flashFrame = 0;
        api.flashes++;
        setTimeout(onThunder, 700 + Math.random() * 900);
      }
      if (flashFrame >= 0) {
        const on = flashFrame === 0 || flashFrame === 2;
        cloud.material.color.copy(on ? white : base);
        cloud.material.opacity = on ? 0.85 : 0.72;
        if (++flashFrame > 3) {
          flashFrame = -1;
          nextFlash = t + 18 + Math.random() * 30;
        }
      }
    },
  };
  return api;
}
