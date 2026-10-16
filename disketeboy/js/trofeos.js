// Trofeos 3D para los logros: copas torneadas de oro, plata o bronce con una placa
// con el icono del logro. Van en el alféizar de la ventana, a contraluz.
import * as THREE from 'three';

const METAL = { oro: '#e8b93a', plata: '#c3c8d2', bronce: '#c27a43' };
const SIZE = { oro: 1.5, plata: 1.28, bronce: 1.12 };

// Perfil de la copa (radio, altura) en metros: peana, pie, copa y borde
const PROFILE = [
  [0, 0], [0.021, 0], [0.021, 0.004], [0.014, 0.007], [0.005, 0.011], [0.004, 0.03],
  [0.006, 0.036], [0.013, 0.042], [0.02, 0.054], [0.024, 0.07], [0.025, 0.075], [0.022, 0.075], [0.001, 0.05],
].map(([r, y]) => new THREE.Vector2(r, y));

let cupGeo = null;
let handleGeo = null;
let baseGeo = null;
const metals = {};
const plaques = new Map();

function metal(tier) {
  metals[tier] ??= new THREE.MeshStandardMaterial({ color: METAL[tier], metalness: 0.55, roughness: 0.28, emissive: METAL[tier], emissiveIntensity: 0.12 });
  return metals[tier];
}

function plaque(icon) {
  if (!plaques.has(icon)) {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 48;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(0, 0, 96, 48);
    ctx.fillStyle = '#c9a15a';
    ctx.fillRect(14, 6, 68, 36);
    ctx.font = '28px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, 48, 26);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const wood = new THREE.MeshStandardMaterial({ color: '#3a2a1c', roughness: 0.7 });
    plaques.set(icon, [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }), wood]);
  }
  return plaques.get(icon);
}

/** Un trofeo: peana de madera con placa, copa de metal y, en oro y plata, asas. */
export function makeTrophy({ tier = 'bronce', icon = '🏆' } = {}) {
  cupGeo ??= new THREE.LatheGeometry(PROFILE, 20);
  handleGeo ??= new THREE.TorusGeometry(0.011, 0.0022, 6, 14, Math.PI);
  baseGeo ??= new THREE.BoxGeometry(0.05, 0.02, 0.038);
  const g = new THREE.Group();
  const base = new THREE.Mesh(baseGeo, plaque(icon));
  base.position.y = 0.01;
  const cup = new THREE.Mesh(cupGeo, metal(tier));
  cup.position.y = 0.02;
  g.add(base, cup);
  if (tier !== 'bronce') {
    for (const side of [-1, 1]) {
      const h = new THREE.Mesh(handleGeo, metal(tier));
      h.position.set(side * 0.022, 0.078, 0);
      h.rotation.set(0, 0, side * -Math.PI / 2);
      g.add(h);
    }
  }
  g.scale.setScalar(SIZE[tier] || 1);
  g.userData = { tier, icon };
  return g;
}
