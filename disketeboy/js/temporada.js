// Decoración de temporada, sin pedir nada: calabaza y murciélagos en Halloween;
// nieve tras la ventana y luces en la barra de la cortina en Navidad.
import * as THREE from 'three';
export { seasonOf } from './util.js';

const paint = (w, h, fn) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

/** Calabaza tallada con su vela, y tres murciélagos colgando. */
export function createHalloween({ pumpkinAt, batsAt }) {
  const group = new THREE.Group();
  // Calabaza: una esfera con gajos (el radio sube y baja 8 veces alrededor)
  const geo = new THREE.SphereGeometry(0.085, 32, 18);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const k = 1 + 0.07 * Math.cos(a * 8);
    pos.setXYZ(i, v.x * k, v.y * 0.8, v.z * k);
  }
  geo.computeVertexNormals();
  // La cara mira a +z: en la textura de la esfera eso es u = 0,25
  const face = (glow) =>
    paint(512, 256, (ctx, w, h) => {
      ctx.fillStyle = glow ? '#000' : '#e2711d';
      ctx.fillRect(0, 0, w, h);
      if (!glow) {
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = i % 2 ? '#d0631a' : '#e98a2f';
          ctx.fillRect((i * w) / 16, 0, w / 16, h);
        }
      }
      ctx.fillStyle = glow ? '#ffd27a' : '#2a1406';
      const cx = w * 0.25;
      const eye = (x) => {
        ctx.beginPath();
        ctx.moveTo(x - 22, h * 0.48);
        ctx.lineTo(x, h * 0.3);
        ctx.lineTo(x + 22, h * 0.48);
        ctx.fill();
      };
      eye(cx - 34);
      eye(cx + 34);
      ctx.beginPath();
      ctx.moveTo(cx - 48, h * 0.6);
      for (let i = 0; i <= 6; i++) ctx.lineTo(cx - 48 + i * 16, h * (i % 2 ? 0.66 : 0.6));
      ctx.lineTo(cx + 48, h * 0.6);
      ctx.quadraticCurveTo(cx, h * 0.86, cx - 48, h * 0.6);
      ctx.fill();
    });
  const pumpkin = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: face(false), emissiveMap: face(true), emissive: '#ffffff', emissiveIntensity: 1, roughness: 0.78, color: '#d8d0c8' }));
  pumpkin.castShadow = true;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.014, 0.035, 8), new THREE.MeshStandardMaterial({ color: '#5a6b2a', roughness: 0.8 }));
  stem.position.y = 0.074;
  stem.rotation.z = 0.25;
  const candle = new THREE.PointLight('#ff9a3c', 0.9, 1.4, 2);
  candle.position.y = 0.01;
  const pk = new THREE.Group();
  pk.add(pumpkin, stem, candle);
  pk.position.copy(pumpkinAt.pos);
  pk.position.y += 0.068;
  pk.rotation.y = pumpkinAt.yaw;
  group.add(pk);
  // Murciélagos: siluetas que se balancean y aletean
  const batTex = paint(128, 64, (ctx, w) => {
    ctx.fillStyle = '#16121a';
    ctx.beginPath();
    ctx.moveTo(w / 2, 22);
    ctx.quadraticCurveTo(w / 2 - 20, 6, 4, 14);
    ctx.quadraticCurveTo(26, 22, 20, 40);
    ctx.quadraticCurveTo(40, 30, 50, 46);
    ctx.quadraticCurveTo(w / 2, 34, w - 50, 46);
    ctx.quadraticCurveTo(w - 40, 30, w - 20, 40);
    ctx.quadraticCurveTo(w - 26, 22, w - 4, 14);
    ctx.quadraticCurveTo(w / 2 + 20, 6, w / 2, 22);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w / 2, 26, 9, 0, Math.PI * 2);
    ctx.fill();
  });
  const bats = batsAt.map((p, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: batTex, transparent: true, depthWrite: false }));
    s.scale.set(0.2, 0.1, 1);
    s.position.copy(p);
    s.userData = { y: p.y, phase: i * 2.1 };
    group.add(s);
    return s;
  });
  return {
    group,
    step(t) {
      candle.intensity = 0.75 + Math.sin(t * 13) * 0.08 + Math.sin(t * 7.3) * 0.07;
      pumpkin.material.emissiveIntensity = 0.85 + Math.sin(t * 11) * 0.1;
      for (const b of bats) {
        b.position.y = b.userData.y + Math.sin(t * 1.3 + b.userData.phase) * 0.025;
        b.scale.x = 0.2 * (0.75 + Math.abs(Math.sin(t * 6 + b.userData.phase)) * 0.25);
      }
    },
  };
}

/** Nieve tras la ventana y una tira de luces de colores en la barra de la cortina. */
export function createChristmas({ window: win, rod }) {
  const group = new THREE.Group();
  const count = 120;
  const snowPos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    snowPos[i * 3] = win.x + (Math.random() - 0.5) * win.w;
    snowPos[i * 3 + 1] = win.y + (Math.random() - 0.5) * win.h;
    snowPos[i * 3 + 2] = win.z + 0.004 + Math.random() * 0.01;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.012, transparent: true, opacity: 0.9, depthWrite: false }));
  snow.frustumCulled = false;
  group.add(snow);
  const colors = ['#ff4040', '#ffd23f', '#3fbfff', '#4fe36a', '#ff7ad9'];
  const bulbs = [];
  const n = 16;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: colors[i % colors.length], toneMapped: false }));
    m.position.set(rod.x0 + (rod.x1 - rod.x0) * k, rod.y - 0.03 - Math.sin(k * Math.PI * 3) ** 2 * 0.05, rod.z);
    m.userData.base = new THREE.Color(colors[i % colors.length]);
    group.add(m);
    bulbs.push(m);
  }
  return {
    group,
    step(t, dt) {
      for (let i = 0; i < count; i++) {
        const k = i * 3;
        snowPos[k + 1] -= (0.05 + (i % 5) * 0.012) * dt;
        snowPos[k] += Math.sin(t + i) * 0.0004;
        if (snowPos[k + 1] < win.y - win.h / 2) snowPos[k + 1] = win.y + win.h / 2;
      }
      snowGeo.attributes.position.needsUpdate = true;
      bulbs.forEach((b, i) => {
        const on = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7);
        b.material.color.copy(b.userData.base).multiplyScalar(0.35 + on * 0.65);
      });
    },
  };
}
