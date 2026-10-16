// Vida en la habitación: motas de polvo en la luz, un despertador con la hora real
// y el gato que respira. Todo es barato: unas pocas mallas que se actualizan a pocos
// fotogramas por segundo, y nada de esto se mueve con «movimiento reducido».
import * as THREE from 'three';

const rand = (a, b) => a + Math.random() * (b - a);

/** Motas de polvo flotando en un volumen (caja) de la habitación. */
export function createDust({ min, max, count = 70 } = {}) {
  const pos = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(min.x, max.x);
    pos[i * 3 + 1] = rand(min.y, max.y);
    pos[i * 3 + 2] = rand(min.z, max.z);
    seeds[i * 3] = rand(0, 100);
    seeds[i * 3 + 1] = rand(0.004, 0.012); // velocidad de caída
    seeds[i * 3 + 2] = rand(0.5, 1.5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,240,210,1)');
  g.addColorStop(0.4, 'rgba(255,240,210,0.5)');
  g.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const material = new THREE.PointsMaterial({
    size: 0.012,
    map: new THREE.CanvasTexture(c),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  return {
    points,
    /** t en segundos. Caen muy despacio, con un vaivén, y vuelven a aparecer arriba. */
    step(t, dt) {
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        const s = seeds[k];
        pos[k] += Math.sin(t * 0.3 * seeds[k + 2] + s) * 0.0009 * dt * 60;
        pos[k + 1] -= seeds[k + 1] * dt;
        pos[k + 2] += Math.cos(t * 0.25 * seeds[k + 2] + s) * 0.0009 * dt * 60;
        if (pos[k + 1] < min.y) {
          pos[k + 1] = max.y;
          pos[k] = rand(min.x, max.x);
          pos[k + 2] = rand(min.z, max.z);
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
    setStrength(v) {
      material.opacity = 0.55 * v;
      points.visible = v > 0.02;
    },
  };
}

/** Despertador digital retro con la hora real (los dos puntos parpadean). */
export function createDeskClock() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.052, 0.045), new THREE.MeshStandardMaterial({ color: '#2b2622', roughness: 0.45 }));
  body.position.y = 0.026;
  body.castShadow = true;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 48;
  const ctx = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.034), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
  face.position.set(0, 0.027, 0.0226);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.03), body.material);
    foot.position.set(side * 0.04, 0.003, 0);
    group.add(foot);
  }
  body.position.y += 0.006;
  face.position.y += 0.006;
  group.add(body, face);
  let shown = '';
  return {
    group,
    /** Repinta solo si cambia lo que se ve. Devuelve true si ha cambiado. */
    update(date = new Date()) {
      const hh = String(date.getHours()).padStart(2, '0');
      const mm = String(date.getMinutes()).padStart(2, '0');
      const colon = date.getSeconds() % 2 === 0;
      const text = `${hh}${colon ? ':' : ' '}${mm}`;
      if (text === shown) return false;
      shown = text;
      ctx.fillStyle = '#120806';
      ctx.fillRect(0, 0, 128, 48);
      ctx.font = 'bold 34px "VT323", ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#3a0d08';
      ctx.fillText('88:88', 64, 26);
      ctx.shadowColor = '#ff3b24';
      ctx.shadowBlur = 8;
      ctx.fillStyle = '#ff5a3c';
      ctx.fillText(text, 64, 26);
      ctx.shadowBlur = 0;
      tex.needsUpdate = true;
      return true;
    },
  };
}

/** El gato respira, mueve la punta de la cola y sus «zzz» suben y se desvanecen. */
export function animateCat(cat, t) {
  const body = cat.userData.body;
  const tail = cat.userData.tail;
  const zzz = cat.userData.zzz;
  if (body) body.scale.y = cat.userData.bodyY * (1 + Math.sin(t * 1.6) * 0.035);
  if (tail) tail.rotation.z = Math.sin(t * 0.9) * 0.05;
  if (zzz) {
    const k = (t * 0.35) % 1;
    zzz.position.y = cat.userData.zzzY + k * 0.08;
    zzz.material.opacity = Math.min(1, k * 4) * (1 - k);
  }
}
