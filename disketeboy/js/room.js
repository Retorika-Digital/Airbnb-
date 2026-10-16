// La habitación 3D: estantería, escritorio con tele de tubo, la pila de la
// vergüenza y la caja de abandonados. Todo hecho con código (geometría simple y
// texturas pintadas en canvas): ni modelos ni dibujos ajenos.
// Solo se redibuja cuando algo cambia o se mueve, para no gastar batería.
import * as THREE from 'three';
import { computeLayout, BOOKCASE, BOOKCASE_SPOTS, DESK, PILE, BIN, ROOM, KALLAX } from './layout.js';
import { boxFor, platform } from './platforms.js';
import { drawCover, drawSpine, drawBack, loadCover, loadSpineColor, dominantColor, gameColor, wrap, spineSize, SPINE_STRIP } from './covers.js';
import { sfx } from './audio.js';
import { rng, hexToHsl, hslToHex } from './util.js';
import { isBoard } from './store.js';
import { t } from './i18n.js';
import { createDust, createDeskClock, animateCat } from './ambiente.js';
import { makeTrophy } from './trofeos.js';
import { createHalloween, createChristmas } from './temporada.js';
import { createRain } from './clima.js';
import { weatherOf } from './util.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  out: (t) => 1 - (1 - t) ** 3,
  fall: (t) => t * t,
  back: (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2,
};
const ZONE_CENTER = {
  pila: new THREE.Vector3(PILE.x + 0.05, 0.1, PILE.z + 0.2),
  estanteria: new THREE.Vector3(BOOKCASE_SPOTS[0].x + 0.4, 1.1, BOOKCASE_SPOTS[0].z),
  escritorio: new THREE.Vector3(DESK.x, DESK.top + 0.1, DESK.z),
  caja: new THREE.Vector3(BIN.x, 0.2, BIN.z),
  ventana: new THREE.Vector3(DESK.x, 1.32, DESK.z),
  kallax: new THREE.Vector3(KALLAX.x - 0.1, 0.45, KALLAX.z),
  mazos: new THREE.Vector3(DESK.x, DESK.top + 0.08, DESK.z + 0.24),
  encima: new THREE.Vector3(KALLAX.x - 0.1, 0.85, KALLAX.z),
};
const PLASTIC = {
  ps5: '#ececef', ps4: '#1f3f8f', wii: '#f1f1f1', wiiu: '#2a86c8', switch: '#b3141a', switch2: '#b81d22',
  xsx: '#16612a', xone: '#16612a', x360: '#4f8f28', ds: '#e6e6e6', '3ds': '#b5121b', vita: '#2b5aa6', dc: '#e2e2e2',
};
const CARDBOARD = new Set(['carton', 'cartonV', 'pocket', 'mesaS', 'mesaM', 'mesaL', 'mesaXL']);
// En la estantería y en la Kallax las cajas están de pie: solo se ve el lomo.
const showsFront = (zone) => zone !== 'estanteria' && zone !== 'kallax';

// ------------------------------------------------------------------ texturas de la habitación
function paint(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  fn(c.getContext('2d'), w, h);
  return c;
}

function woodFloor() {
  return paint(512, 512, (ctx, w, h) => {
    const r = rng('suelo');
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 200;
      while (x < w) {
        const len = 160 + r() * 220;
        const l = 34 + r() * 10;
        ctx.fillStyle = hslToHex(26 + r() * 6, 38 + r() * 10, l);
        ctx.fillRect(x, (i * h) / rows, len, h / rows);
        ctx.strokeStyle = '#0000001a';
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          const y = (i * h) / rows + 6 + r() * (h / rows - 12);
          ctx.moveTo(x + 4, y);
          ctx.bezierCurveTo(x + len * 0.3, y + r() * 6 - 3, x + len * 0.6, y + r() * 6 - 3, x + len - 4, y);
          ctx.stroke();
        }
        ctx.fillStyle = '#00000055';
        ctx.fillRect(x, (i * h) / rows, 2, h / rows);
        x += len;
      }
      ctx.fillStyle = '#00000066';
      ctx.fillRect(0, (i * h) / rows, w, 2);
    }
  });
}

function wallPaint(base) {
  return paint(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    const r = rng(base);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = r() < 0.5 ? '#ffffff0a' : '#0000000a';
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

function rugPaint() {
  return paint(512, 384, (ctx, w, h) => {
    ctx.fillStyle = '#7d2f2a';
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, 26);
    ctx.fill();
    ctx.strokeStyle = '#e8c98f';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(26, 26, w - 52, h - 52, 18);
    ctx.stroke();
    ctx.strokeStyle = '#2f5d62';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(44, 44, w - 88, h - 88, 12);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const x = w * (0.2 + i * 0.15);
      ctx.fillStyle = i % 2 ? '#e8c98f' : '#2f5d62';
      ctx.beginPath();
      ctx.moveTo(x, h / 2 - 50);
      ctx.lineTo(x + 34, h / 2);
      ctx.lineTo(x, h / 2 + 50);
      ctx.lineTo(x - 34, h / 2);
      ctx.fill();
    }
    const r = rng('alfombra');
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = r() < 0.5 ? '#ffffff0d' : '#0000000f';
      ctx.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

function cardboardPaint(label) {
  return paint(512, 320, (ctx, w, h) => {
    ctx.fillStyle = '#b98b55';
    ctx.fillRect(0, 0, w, h);
    const r = rng('carton');
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = r() < 0.5 ? '#ffffff10' : '#00000010';
      ctx.fillRect(r() * w, r() * h, 3, 1);
    }
    ctx.fillStyle = '#d9c39acc';
    ctx.fillRect(w * 0.42, 0, w * 0.16, h * 0.22);
    if (label) {
      ctx.save();
      ctx.translate(w / 2, h * 0.6);
      ctx.rotate(-0.06);
      ctx.fillStyle = '#1d1a16';
      ctx.font = '900 64px "Comic Sans MS", "Segoe Print", "Marker Felt", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, 0, w * 0.9);
      ctx.restore();
    }
  });
}

function signPaint() {
  return paint(384, 224, (ctx, w, h) => {
    ctx.fillStyle = '#c99a62';
    ctx.fillRect(0, 0, w, h);
    const r = rng('cartel');
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = r() < 0.5 ? '#ffffff12' : '#00000012';
      ctx.fillRect(r() * w, r() * h, 3, 1);
    }
    ctx.strokeStyle = '#7a5a36';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#1d1a16';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 54px "Comic Sans MS", "Segoe Print", "Marker Felt", cursive';
    ctx.fillText(t('PILA DE LA'), w / 2, h * 0.36, w - 40);
    ctx.fillStyle = '#b3261e';
    ctx.fillText(t('VERGÜENZA'), w / 2, h * 0.7, w - 40);
  });
}

function skyPaint(hour) {
  const night = hour >= 21 || hour < 7;
  const dusk = !night && (hour >= 19 || hour < 8);
  return paint(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if (night) {
      g.addColorStop(0, '#0b1230');
      g.addColorStop(1, '#2a2f5a');
    } else if (dusk) {
      g.addColorStop(0, '#3b4a8c');
      g.addColorStop(0.6, '#f08a5d');
      g.addColorStop(1, '#ffd29a');
    } else {
      g.addColorStop(0, '#5fa8e8');
      g.addColorStop(1, '#cfe9ff');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const r = rng(`cielo${night}`);
    if (night) {
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = `rgba(255,255,240,${0.4 + r() * 0.6})`;
        ctx.fillRect(r() * w, r() * h * 0.6, 1.5, 1.5);
      }
      ctx.fillStyle = '#f4f1d9';
      ctx.beginPath();
      ctx.arc(w * 0.74, h * 0.22, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#0b1230';
      ctx.beginPath();
      ctx.arc(w * 0.74 + 8, h * 0.2, 16, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ffffffcc';
      for (let i = 0; i < 4; i++) {
        const cx = r() * w;
        const cy = 30 + r() * 80;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.ellipse(cx + k * 14, cy + (k % 2) * 4, 18, 10, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // Tejados de la ciudad, con ventanas encendidas de noche
    let x = 0;
    while (x < w) {
      const bw = 20 + r() * 34;
      const bh = 40 + r() * 70;
      ctx.fillStyle = night ? '#141629' : dusk ? '#5a3b4f' : '#8a9bb3';
      ctx.fillRect(x, h - bh, bw, bh);
      if (night || dusk) {
        for (let wy = h - bh + 8; wy < h - 6; wy += 11) {
          for (let wx = x + 5; wx < x + bw - 6; wx += 9) {
            if (r() < 0.35) {
              ctx.fillStyle = '#ffd27a';
              ctx.fillRect(wx, wy, 4, 5);
            }
          }
        }
      }
      x += bw + 2;
    }
  });
}

function crtPaint(game) {
  return paint(256, 192, (ctx, w, h) => {
    ctx.fillStyle = '#0d1f12';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
    g.addColorStop(0, '#1f4a2a');
    g.addColorStop(1, '#0a160d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#9bf2a7';
    ctx.textAlign = 'center';
    if (game) {
      ctx.font = '16px "VT323", ui-monospace, monospace';
      ctx.fillText(t('JUGANDO A'), w / 2, 52);
      ctx.font = 'bold 26px "VT323", ui-monospace, monospace';
      const lines = wrap(ctx, game.title.toUpperCase(), w - 30, 3);
      lines.forEach((l, i) => ctx.fillText(l, w / 2, 92 + i * 28));
    } else {
      ctx.font = 'bold 30px "VT323", ui-monospace, monospace';
      ctx.fillText('DISKETEBOY', w / 2, 92);
      ctx.font = '18px "VT323", ui-monospace, monospace';
      ctx.fillText(t('> nada en juego_'), w / 2, 124);
    }
    for (let y = 0; y < h; y += 3) {
      ctx.fillStyle = '#0000002e';
      ctx.fillRect(0, y, w, 1);
    }
  });
}

function posterPaint(game, image) {
  const cover = drawCover(game, image);
  return paint(300, 420, (ctx, w, h) => {
    ctx.fillStyle = '#f6efe1';
    ctx.fillRect(0, 0, w, h);
    const s = Math.min((w - 30) / cover.width, (h - 70) / cover.height);
    ctx.drawImage(cover, (w - cover.width * s) / 2, 15, cover.width * s, cover.height * s);
    ctx.fillStyle = '#231e1a';
    ctx.font = '900 22px "Arial Black", "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.score === null ? t('FAVORITO') : `${game.score}/10`, w / 2, h - 22);
  });
}

// ------------------------------------------------------------------ la habitación
export function createRoom(canvas, { hour = null, onInspect = () => {}, onRelease = () => {}, onColors = () => {}, onNotice = () => {}, onPet = () => {}, season = null, weather = null, onWeather = () => {}, onLights = () => {} } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
  } catch (err) {
    console.warn('Sin WebGL:', err);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const toTexture = (c, { repeat } = {}) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    if (repeat) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(...repeat);
    }
    return t;
  };
  const mat = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...opts });
  const solid = (geo, material, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
  };
  const boxMesh = (w, h, d, material, x, y, z, opts) => {
    const m = solid(new THREE.BoxGeometry(w, h, d), material, opts);
    m.position.set(x, y, z);
    return m;
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#1d1814');
  const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 40);
  scene.add(camera);

  // ---------------------------------------------------------------- cámara
  // Vista desde la cama: en horizontal se ve toda la pared; en vertical (móvil),
  // la cámara se centra en la estantería y la pila.
  const BASE = { pos: new THREE.Vector3(-0.55, 1.3, 1.05), target: new THREE.Vector3(-0.05, 0.62, -1.45) };
  const PORTRAIT_TARGET = new THREE.Vector3(-0.42, 0.66, -1.45);
  let yaw0 = 0;
  let pitch0 = 0;
  function setBase(target) {
    const d = target.clone().sub(BASE.pos).normalize();
    yaw0 = Math.atan2(d.x, -d.z);
    pitch0 = Math.asin(d.y);
  }
  setBase(BASE.target);
  const view = { yaw: 0, pitch: 0, dolly: 0, tYaw: 0, tPitch: 0, tDolly: 0 };
  const LIM = { yaw: [-0.7, 0.8], pitch: [-0.5, 0.4], dolly: [0, 1.6] };
  const clampView = () => {
    view.tYaw = THREE.MathUtils.clamp(view.tYaw, ...LIM.yaw);
    view.tPitch = THREE.MathUtils.clamp(view.tPitch, ...LIM.pitch);
    view.tDolly = THREE.MathUtils.clamp(view.tDolly, ...LIM.dolly);
  };
  const dirFor = (yaw, pitch) => new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  let lastFrame = 0;
  let introUntil = 0;
  let introDone = false;
  /** Suaviza la cámara según el tiempo real (igual de rápida a 20 que a 120 fps). */
  function updateCamera(now = 0, instant = false) {
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 1 / 60;
    lastFrame = now;
    // Durante la entrada de cine la cámara se desliza despacio; luego responde rápido
    const k = instant || REDUCED ? 1 : 1 - Math.exp(-dt * (now < introUntil ? 1.9 : 11));
    view.yaw += (view.tYaw - view.yaw) * k;
    view.pitch += (view.tPitch - view.pitch) * k;
    view.dolly += (view.tDolly - view.dolly) * k;
    const dir = dirFor(yaw0 + view.yaw, pitch0 + view.pitch);
    camera.position.copy(BASE.pos).addScaledVector(dir, view.dolly);
    camera.lookAt(camera.position.clone().add(dir));
  }
  const cameraMoving = () => Math.abs(view.tYaw - view.yaw) + Math.abs(view.tPitch - view.pitch) + Math.abs(view.tDolly - view.dolly) > 1e-4;

  // ---------------------------------------------------------------- luces
  const hemi = new THREE.HemisphereLight('#fff1dc', '#5a4636', 1);
  const sun = new THREE.DirectionalLight('#ffe7c4', 2);
  sun.position.set(1.3, 2.9, -4.4);
  sun.target.position.set(0.1, 0.2, 0.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3.2, right: 3.2, top: 3, bottom: -3, near: 0.5, far: 11 });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  const lamp = new THREE.PointLight('#ffb066', 3, 7, 2);
  lamp.position.set(1.62, 1.08, -1.6);
  const fill = new THREE.PointLight('#ffe2bd', 1.5, 9, 2);
  fill.position.set(-0.3, 2.28, -0.5);
  // Foco de museo sobre la estantería: tu colección, bien iluminada.
  const shelfLight = new THREE.SpotLight('#ffe1b0', 10, 6, 0.62, 0.75, 1.6);
  shelfLight.position.set(BOOKCASE_SPOTS[0].x + 0.1, 2.5, -0.75);
  shelfLight.target.position.set(BOOKCASE_SPOTS[0].x, 1.0, BOOKCASE_SPOTS[0].z);
  scene.add(hemi, sun, sun.target, lamp, fill, shelfLight, shelfLight.target);

  // ---------------------------------------------------------------- paredes y suelo
  const W = ROOM.maxX - ROOM.minX;
  const D = ROOM.maxZ - ROOM.minZ;
  const H = ROOM.height;
  const cx = (ROOM.minX + ROOM.maxX) / 2;
  const cz = (ROOM.minZ + ROOM.maxZ) / 2;
  const floor = solid(new THREE.PlaneGeometry(W, D), mat({ map: toTexture(woodFloor(), { repeat: [2.2, 2] }), roughness: 0.7 }), { cast: false });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  const wallMat = mat({ map: toTexture(wallPaint('#d9c7a8'), { repeat: [3, 2] }), roughness: 0.95 });
  const sideMat = mat({ map: toTexture(wallPaint('#cdb79a'), { repeat: [3, 2] }), roughness: 0.95 });
  const walls = [
    [new THREE.PlaneGeometry(W, H), wallMat, [cx, H / 2, ROOM.minZ], 0],
    [new THREE.PlaneGeometry(D, H), sideMat, [ROOM.minX, H / 2, cz], Math.PI / 2],
    [new THREE.PlaneGeometry(D, H), sideMat, [ROOM.maxX, H / 2, cz], -Math.PI / 2],
    [new THREE.PlaneGeometry(W, H), wallMat, [cx, H / 2, ROOM.maxZ], Math.PI],
  ].map(([geo, m, pos, ry]) => {
    const wall = solid(geo, m, { cast: false });
    wall.position.set(...pos);
    wall.rotation.y = ry;
    return wall;
  });
  const ceiling = solid(new THREE.PlaneGeometry(W, D), mat({ color: '#efe6d6' }), { cast: false });
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, H, cz);
  scene.add(floor, ceiling, ...walls);
  const trim = mat({ color: '#f1e7d6', roughness: 0.6 });
  scene.add(
    boxMesh(W, 0.09, 0.02, trim, cx, 0.045, ROOM.minZ + 0.01, { cast: false }),
    boxMesh(0.02, 0.09, D, trim, ROOM.minX + 0.01, 0.045, cz, { cast: false }),
    boxMesh(0.02, 0.09, D, trim, ROOM.maxX - 0.01, 0.045, cz, { cast: false }),
  );

  // Alfombra
  const rug = solid(new THREE.PlaneGeometry(2.2, 1.6), mat({ map: toTexture(rugPaint()), roughness: 1 }), { cast: false });
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(PILE.x, 0.004, PILE.z + 0.25);
  scene.add(rug);

  // Lámpara de techo: pantalla roja con un difusor que brilla por debajo
  const pendant = new THREE.Group();
  pendant.add(boxMesh(0.01, 0.42, 0.01, mat({ color: '#2b2622' }), 0, -0.21, 0, { cast: false }));
  const pendantShade = solid(new THREE.ConeGeometry(0.15, 0.15, 24, 1, true), mat({ color: '#c8553d', roughness: 0.5 }), { cast: false });
  pendantShade.position.y = -0.495;
  pendant.add(pendantShade);
  const diffuserMat = new THREE.MeshBasicMaterial({ color: '#ffe2b0', toneMapped: false });
  const diffuser = new THREE.Mesh(new THREE.CircleGeometry(0.146, 24), diffuserMat);
  diffuser.rotation.x = Math.PI / 2;
  diffuser.position.y = -0.568;
  pendant.add(diffuser);
  pendant.position.set(fill.position.x, ROOM.height, fill.position.z);
  scene.add(pendant);
  fill.position.y = ROOM.height - 0.66;

  // Luz que acompaña a la cámara: ilumina la caja que tienes en la mano.
  const handLight = new THREE.PointLight('#fff3e2', 0, 3, 2);
  handLight.position.set(0.25, 0.3, 0.15);
  camera.add(handLight);

  // Ventana con cielo según la hora
  const win = { x: DESK.x, y: 1.62, w: 1.0, h: 0.86 };
  const skyMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(win.w, win.h), skyMat);
  sky.position.set(win.x, win.y, ROOM.minZ + 0.006);
  const frameMat = mat({ color: '#f4ecdf', roughness: 0.5 });
  scene.add(
    sky,
    boxMesh(win.w + 0.1, 0.05, 0.06, frameMat, win.x, win.y + win.h / 2, ROOM.minZ + 0.03),
    boxMesh(win.w + 0.1, 0.05, 0.06, frameMat, win.x, win.y - win.h / 2, ROOM.minZ + 0.03),
    boxMesh(0.05, win.h, 0.06, frameMat, win.x - win.w / 2, win.y, ROOM.minZ + 0.03),
    boxMesh(0.05, win.h, 0.06, frameMat, win.x + win.w / 2, win.y, ROOM.minZ + 0.03),
    boxMesh(0.03, win.h, 0.04, frameMat, win.x, win.y, ROOM.minZ + 0.025),
    boxMesh(win.w, 0.03, 0.04, frameMat, win.x, win.y + 0.08, ROOM.minZ + 0.025),
    boxMesh(win.w + 0.24, 0.03, 0.14, frameMat, win.x, win.y - win.h / 2 - 0.035, ROOM.minZ + 0.07),
  );
  const curtainMat = mat({
    map: toTexture(paint(128, 32, (ctx, w, h) => {
      for (let x = 0; x < w; x++) {
        const k = 0.5 + 0.5 * Math.sin((x / w) * Math.PI * 10);
        ctx.fillStyle = hslToHex(42, 62, 44 + k * 14);
        ctx.fillRect(x, 0, 1, h);
      }
    })),
    roughness: 1,
    side: THREE.DoubleSide,
  });
  for (const side of [-1, 1]) {
    const curtain = solid(new THREE.PlaneGeometry(0.34, 1.32), curtainMat, { cast: false });
    curtain.position.set(win.x + side * (win.w / 2 + 0.12), win.y - 0.12, ROOM.minZ + 0.1);
    scene.add(curtain);
  }
  scene.add(boxMesh(win.w + 0.9, 0.025, 0.025, mat({ color: '#6b4a2f' }), win.x, win.y + win.h / 2 + 0.12, ROOM.minZ + 0.1));

  // ---------------------------------------------------------------- muebles
  const woodTex = toTexture(woodFloor(), { repeat: [0.6, 0.6] });
  const wood = mat({ map: woodTex, color: '#b38a62', roughness: 0.65 });
  const woodDark = mat({ map: woodTex, color: '#7a5638', roughness: 0.7 });

  function makeBookcase() {
    const B = BOOKCASE;
    const g = new THREE.Group();
    g.add(boxMesh(0.02, B.height, B.depth, wood, -B.width / 2 + 0.01, B.height / 2, 0));
    g.add(boxMesh(0.02, B.height, B.depth, wood, B.width / 2 - 0.01, B.height / 2, 0));
    g.add(boxMesh(B.width, 0.02, B.depth, wood, 0, B.height - 0.01, 0));
    g.add(boxMesh(B.width, B.height, 0.012, woodDark, 0, B.height / 2, -B.depth / 2 + 0.006));
    for (const y of B.boards) g.add(boxMesh(B.width - 0.04, 0.018, B.depth - 0.02, wood, 0, y + 0.009, 0.005));
    g.add(boxMesh(B.width - 0.04, 0.06, 0.015, woodDark, 0, 0.03, B.depth / 2 - 0.01));
    return g;
  }
  const bookcases = BOOKCASE_SPOTS.map((spot, i) => {
    const b = makeBookcase();
    b.position.set(spot.x, 0, spot.z);
    b.rotation.y = spot.yaw;
    b.visible = i === 0;
    scene.add(b);
    return b;
  });

  // Planta y libros encima de la primera estantería
  const leaf = mat({ color: '#3f7a3a', roughness: 0.6 });
  const terracotta = mat({ color: '#c46a3c' });
  function makePlant(size = 1) {
    const g = new THREE.Group();
    const pot = solid(new THREE.CylinderGeometry(0.07, 0.055, 0.12, 16), terracotta);
    pot.position.y = 0.06;
    g.add(pot);
    for (let i = 0; i < 7; i++) {
      const l = solid(new THREE.SphereGeometry(0.06, 10, 8), leaf);
      l.scale.set(0.45, 1.6, 0.35);
      l.position.set(Math.cos(i * 0.9) * 0.04, 0.2, Math.sin(i * 0.9) * 0.04);
      l.rotation.set(Math.sin(i) * 0.6, i, Math.cos(i) * 0.6);
      g.add(l);
    }
    g.scale.setScalar(size);
    return g;
  }
  const plant = makePlant();
  plant.position.set(BOOKCASE_SPOTS[0].x - 0.24, BOOKCASE.height, BOOKCASE_SPOTS[0].z);
  scene.add(plant);

  // Decoración de las baldas libres (se recoloca cuando la colección crece)
  const decorGroup = new THREE.Group();
  scene.add(decorGroup);
  let decorKey = '';
  const BOOK_COLORS = ['#2f5d62', '#c8553d', '#e8c98f', '#3e6fb0', '#6b4a7a', '#d9a33a', '#4f8a4a', '#8c3b3b', '#f1e7d6'];
  const metalDark = mat({ color: '#2b2a2e', roughness: 0.35, metalness: 0.6 });
  const gold = mat({ color: '#d9a740', roughness: 0.28, metalness: 0.85 });
  function makeDecor(item) {
    const g = new THREE.Group();
    const r = rng(item.seed || `${item.kind}:${item.x.toFixed(2)}:${item.y.toFixed(2)}`);
    switch (item.kind) {
      case 'libros': {
        let x = -0.17;
        const n = 7 + Math.floor(r() * 5);
        for (let i = 0; i < n; i++) {
          const t = 0.022 + r() * 0.02;
          const h = 0.15 + r() * 0.09;
          const d = 0.13 + r() * 0.05;
          const b = boxMesh(t, h, d, mat({ color: BOOK_COLORS[Math.floor(r() * BOOK_COLORS.length)], roughness: 0.75 }), x + t / 2, h / 2, -0.02);
          if (i === n - 1) {
            b.rotation.z = -0.3;
            b.position.x += 0.03;
            b.position.y -= 0.01;
          }
          g.add(b);
          x += t + 0.002;
        }
        break;
      }
      case 'sujetalibros':
        g.add(boxMesh(0.07, 0.004, 0.1, metalDark, 0.03, 0.002, 0));
        g.add(boxMesh(0.004, 0.12, 0.1, metalDark, 0, 0.06, 0));
        break;
      case 'planta':
        g.add(makePlant(0.75));
        break;
      case 'dado': {
        const d20 = solid(new THREE.IcosahedronGeometry(0.034), mat({ color: r() < 0.5 ? '#c8553d' : '#3e6fb0', roughness: 0.3, flatShading: true }));
        d20.position.y = 0.03;
        d20.rotation.set(r() * 3, r() * 3, r() * 3);
        g.add(d20);
        break;
      }
      case 'trofeo': {
        g.add(boxMesh(0.08, 0.03, 0.08, woodDark, 0, 0.015, 0));
        const stem = solid(new THREE.CylinderGeometry(0.008, 0.012, 0.05, 10), gold);
        stem.position.y = 0.055;
        const cup = solid(new THREE.CylinderGeometry(0.04, 0.018, 0.06, 16, 1, true), gold);
        cup.position.y = 0.11;
        const handle = solid(new THREE.TorusGeometry(0.03, 0.005, 6, 16, Math.PI), gold);
        handle.position.y = 0.11;
        handle.rotation.z = -Math.PI / 2;
        g.add(stem, cup, handle);
        break;
      }
      case 'consola': {
        g.add(boxMesh(0.22, 0.05, 0.16, mat({ color: '#8f8a93', roughness: 0.5 }), 0, 0.025, 0));
        g.add(boxMesh(0.07, 0.012, 0.05, mat({ color: '#c8553d', roughness: 0.4 }), -0.05, 0.056, 0.02));
        g.add(boxMesh(0.1, 0.02, 0.045, metalDark, 0.04, 0.06, 0.03));
        break;
      }
      default: {
        // Un robotito genérico
        const body = mat({ color: hslToHex(r() * 360, 45, 55), roughness: 0.5 });
        g.add(boxMesh(0.06, 0.07, 0.045, body, 0, 0.035, 0));
        g.add(boxMesh(0.07, 0.055, 0.055, body, 0, 0.1, 0));
        const eye = new THREE.MeshBasicMaterial({ color: '#ffe9a8', toneMapped: false });
        for (const sx of [-0.016, 0.016]) {
          const e = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), eye);
          e.position.set(sx, 0.105, 0.028);
          g.add(e);
        }
      }
    }
    g.position.set(item.x, item.y, item.z);
    g.rotation.y = item.yaw;
    return g;
  }
  function updateDecor(items) {
    const key = items.map((i) => `${i.kind}:${i.x.toFixed(3)}:${i.y.toFixed(3)}:${i.z.toFixed(3)}`).join('|');
    if (key === decorKey) return;
    decorKey = key;
    for (const child of [...decorGroup.children]) {
      child.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        if (![metalDark, gold, woodDark, leaf, terracotta].includes(o.material)) o.material.dispose();
      });
      decorGroup.remove(child);
    }
    for (const item of items) decorGroup.add(makeDecor(item));
  }
  const books = new THREE.Group();
  ['#2f5d62', '#c8553d', '#e8c98f', '#3e6fb0'].forEach((c, i) => {
    books.add(boxMesh(0.2 - i * 0.02, 0.035, 0.15, mat({ color: c, roughness: 0.7 }), 0, 0.0175 + i * 0.035, 0));
    books.children[i].rotation.y = (i % 2 ? 1 : -1) * 0.12;
  });
  books.position.set(BOOKCASE_SPOTS[0].x + 0.2, BOOKCASE.height, BOOKCASE_SPOTS[0].z);
  scene.add(books);

  // Escritorio, tele de tubo, consola y flexo
  const desk = new THREE.Group();
  desk.add(boxMesh(DESK.width, 0.04, DESK.depth, wood, 0, DESK.top - 0.02, 0));
  for (const sx of [-1, 1]) desk.add(boxMesh(0.04, DESK.top - 0.04, DESK.depth - 0.06, woodDark, sx * (DESK.width / 2 - 0.05), (DESK.top - 0.04) / 2, 0));
  desk.add(boxMesh(DESK.width - 0.1, 0.18, 0.02, woodDark, 0, DESK.top - 0.13, -DESK.depth / 2 + 0.04));
  desk.position.set(DESK.x, 0, DESK.z);
  scene.add(desk);
  const beige = mat({ color: '#d8cfbd', roughness: 0.55 });
  const crt = new THREE.Group();
  crt.add(boxMesh(0.44, 0.36, 0.3, beige, 0, 0.18, 0));
  crt.add(boxMesh(0.32, 0.26, 0.16, beige, 0, 0.17, -0.2));
  const crtMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.255), crtMat);
  screenMesh.position.set(0, 0.19, 0.151);
  crt.add(screenMesh);
  crt.position.set(DESK.x, DESK.top, DESK.z - 0.08);
  scene.add(crt);
  const tvGlow = new THREE.PointLight('#8fd0ff', 0, 3.2, 2);
  tvGlow.position.set(DESK.x, DESK.top + 0.2, DESK.z + 0.3);
  scene.add(tvGlow);
  const consoleMesh = boxMesh(0.26, 0.055, 0.19, mat({ color: '#5e5a63', roughness: 0.5 }), DESK.x - 0.45, DESK.top + 0.0275, DESK.z - 0.13);
  scene.add(consoleMesh);
  const lampGroup = new THREE.Group();
  const metal = mat({ color: '#2f4f8f', roughness: 0.35, metalness: 0.4 });
  lampGroup.add(boxMesh(0.14, 0.02, 0.14, metal, 0, 0.01, 0));
  const arm = boxMesh(0.02, 0.38, 0.02, metal, 0, 0.2, 0);
  arm.rotation.z = 0.22;
  lampGroup.add(arm);
  const shade = solid(new THREE.ConeGeometry(0.1, 0.13, 20, 1, true), mat({ color: '#2f4f8f', roughness: 0.4, side: THREE.DoubleSide }));
  shade.position.set(-0.07, 0.38, 0.02);
  shade.rotation.z = 0.5;
  lampGroup.add(shade);
  const bulbMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', toneMapped: false });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), bulbMat);
  bulb.position.set(-0.08, 0.345, 0.02);
  lampGroup.add(bulb);
  lampGroup.position.set(DESK.x + 0.5, DESK.top, DESK.z - 0.12);
  lampGroup.name = 'flexo';
  scene.add(lampGroup);

  // Caja de cartón de los abandonados
  const binGroup = new THREE.Group();
  const kraft = mat({ map: toTexture(cardboardPaint('')), roughness: 0.95 });
  const kraftLabel = mat({ map: toTexture(cardboardPaint(t('ABANDONADOS'))), roughness: 0.95 });
  binGroup.add(boxMesh(BIN.w, 0.012, BIN.d, kraft, 0, 0.006, 0));
  binGroup.add(boxMesh(BIN.w, BIN.h, 0.012, kraftLabel, 0, BIN.h / 2, BIN.d / 2));
  binGroup.add(boxMesh(BIN.w, BIN.h, 0.012, kraft, 0, BIN.h / 2, -BIN.d / 2));
  binGroup.add(boxMesh(0.012, BIN.h, BIN.d, kraft, -BIN.w / 2, BIN.h / 2, 0));
  binGroup.add(boxMesh(0.012, BIN.h, BIN.d, kraft, BIN.w / 2, BIN.h / 2, 0));
  for (const [x, z, rx, rz, w, d] of [[0, BIN.d / 2 + 0.07, 0.9, 0, BIN.w, 0.15], [-BIN.w / 2 - 0.07, 0, 0, -0.9, 0.15, BIN.d]]) {
    const flap = boxMesh(w, 0.008, d, kraft, x, BIN.h + 0.02, z);
    flap.rotation.set(rx, 0, rz);
    binGroup.add(flap);
  }
  binGroup.position.set(BIN.x, 0, BIN.z);
  binGroup.rotation.y = -0.18;
  scene.add(binGroup);

  // Kallax blanca para los juegos de mesa
  const kallaxGroup = new THREE.Group();
  const birch = mat({ color: '#f1ece2', roughness: 0.6 });
  {
    const K = KALLAX;
    kallaxGroup.add(boxMesh(K.width, K.wall, K.depth, birch, 0, K.wall / 2, 0));
    kallaxGroup.add(boxMesh(K.width, K.wall, K.depth, birch, 0, K.height - K.wall / 2, 0));
    for (const sx of [-1, 1]) kallaxGroup.add(boxMesh(K.wall, K.height, K.depth, birch, sx * (K.width / 2 - K.wall / 2), K.height / 2, 0));
    for (let c = 1; c < K.cols; c++) kallaxGroup.add(boxMesh(K.wall, K.height - 2 * K.wall, K.depth, birch, -K.width / 2 + K.wall / 2 + c * (K.cell + K.wall), K.height / 2, 0));
    for (let r = 1; r < K.rows; r++) kallaxGroup.add(boxMesh(K.width - 2 * K.wall, K.wall, K.depth, birch, 0, r * (K.cell + K.wall) + K.wall / 2, 0));
  }
  kallaxGroup.position.set(KALLAX.x, 0, KALLAX.z);
  kallaxGroup.rotation.y = KALLAX.yaw;
  scene.add(kallaxGroup);

  // Cartel clavado junto a la pila de la vergüenza
  const pileSign = new THREE.Group();
  pileSign.add(boxMesh(0.016, 0.46, 0.016, woodDark, 0, 0.23, -0.006));
  const signBoard = boxMesh(0.34, 0.2, 0.008, [kraft, kraft, kraft, kraft, mat({ map: toTexture(signPaint()), roughness: 0.95 }), kraft], 0, 0.44, 0.006);
  signBoard.rotation.z = -0.06;
  pileSign.add(signBoard);
  pileSign.position.set(PILE.x - 0.34, 0, PILE.z - 0.16);
  pileSign.rotation.set(0, 0.32, 0.05);
  pileSign.visible = false;
  scene.add(pileSign);

  // ---------------------------------------------------------------- cosméticos: temas y gato
  // (pensados como futuras ventajas para quien apoye el proyecto; aquí, gratis en Ajustes)
  const ledGroup = new THREE.Group();
  ledGroup.name = 'led';
  const ledLights = [new THREE.PointLight('#a24bff', 2.4, 6, 2), new THREE.PointLight('#22d3ee', 2.4, 6, 2)];
  for (const l of ledLights) l.visible = false;
  ledLights[0].position.set(-1.3, ROOM.height - 0.25, -1.1);
  ledLights[1].position.set(1.5, ROOM.height - 0.25, -1.1);
  {
    const strip = (len, x, z, ry, color) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.014, 0.014), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
      m.position.set(x, ROOM.height - 0.04, z);
      m.rotation.y = ry;
      ledGroup.add(m);
    };
    strip(W - 0.1, cx, ROOM.minZ + 0.02, 0, '#b061ff');
    strip(D - 0.1, ROOM.minX + 0.02, cz, Math.PI / 2, '#ff4fd8');
    strip(D - 0.1, ROOM.maxX - 0.02, cz, Math.PI / 2, '#22d3ee');
    // La tira de verdad: detrás del escritorio, con su halo en la pared
    const rgb = (ctx, w) => {
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, '#a24bff');
      g.addColorStop(0.5, '#ff4fd8');
      g.addColorStop(1, '#22d3ee');
      return g;
    };
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(1.24, 0.012, 0.01),
      new THREE.MeshBasicMaterial({ map: toTexture(paint(256, 4, (ctx, w, h) => { ctx.fillStyle = rgb(ctx, w); ctx.fillRect(0, 0, w, h); })), toneMapped: false }),
    );
    tube.position.set(DESK.x, DESK.top + 0.3, ROOM.minZ + 0.008);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.5),
      new THREE.MeshBasicMaterial({
        map: toTexture(paint(256, 64, (ctx, w, h) => {
          ctx.fillStyle = rgb(ctx, w);
          ctx.fillRect(0, 0, w, h);
          ctx.globalCompositeOperation = 'destination-in';
          const v = ctx.createLinearGradient(0, 0, 0, h);
          v.addColorStop(0, 'rgba(0,0,0,0)');
          v.addColorStop(0.5, 'rgba(0,0,0,0.75)');
          v.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = v;
          ctx.fillRect(0, 0, w, h);
          const u = ctx.createLinearGradient(0, 0, w, 0);
          u.addColorStop(0, 'rgba(0,0,0,0)');
          u.addColorStop(0.18, 'rgba(0,0,0,1)');
          u.addColorStop(0.82, 'rgba(0,0,0,1)');
          u.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = u;
          ctx.fillRect(0, 0, w, h);
        })),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    halo.position.set(DESK.x, DESK.top + 0.3, ROOM.minZ + 0.004);
    ledGroup.add(tube, halo);
  }
  ledGroup.visible = false;
  scene.add(ledGroup, ...ledLights);
  const THEME_LOOK = {
    crema: { wall: '#ffffff', side: '#ffffff', led: false },
    gamer: { wall: '#5d6290', side: '#4b5079', led: true },
    retro: { wall: '#a6e6dd', side: '#ffbfcd', led: false },
  };
  let themeName = null;
  function applyTheme(name) {
    if (name === themeName) return;
    themeName = name;
    const t = THEME_LOOK[name] || THEME_LOOK.crema;
    wallMat.color.set(t.wall);
    sideMat.color.set(t.side);
    ledGroup.visible = t.led;
    // Apagadas del todo (no a intensidad 0) para que el resto de temas no pague su coste
    for (const l of ledLights) l.visible = t.led;
    invalidate();
  }

  // El gato: duerme hecho un ovillo en la alfombra, junto a tu pila de la vergüenza
  const cat = new THREE.Group();
  cat.name = 'gato';
  {
    const fur = mat({ color: '#e0913f', roughness: 0.9 });
    const furDark = mat({ color: '#a95e22', roughness: 0.9 });
    // Lomo atigrado: rayas que dan la vuelta al cuerpo, solo por arriba y por los lados
    const tabby = mat({
      roughness: 0.9,
      map: toTexture(paint(256, 128, (ctx, w, h) => {
        ctx.fillStyle = '#e0913f';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#a95e22';
        for (let i = 0; i < 6; i++) {
          const y0 = h * (0.27 + i * 0.095);
          for (let x = 0; x < w; x += 2) {
            const t = Math.max(0, Math.sin((x / w) * Math.PI) - 0.25) * 9;
            ctx.fillRect(x, y0 + Math.sin(x * 0.07 + i) * 2 - t / 2, 2, t);
          }
        }
      })),
    });
    const bodyGeo = new THREE.SphereGeometry(0.1, 24, 16);
    bodyGeo.rotateZ(Math.PI / 2); // los polos a lo largo del lomo: las rayas quedan de lado a lado
    const body = solid(bodyGeo, tabby);
    body.scale.set(1.5, 0.72, 1.12);
    body.position.y = 0.07;
    // Cola rodeando el cuerpo hasta la nariz
    const tail = solid(new THREE.TorusGeometry(0.125, 0.02, 8, 28, Math.PI * 0.95), furDark);
    tail.rotation.x = Math.PI / 2;
    tail.scale.set(1.2, 1.05, 1);
    tail.position.y = 0.022;
    // Cabeza apoyada delante, de lado hacia ti
    const headG = new THREE.Group();
    headG.position.set(0.15, 0.085, 0.07);
    headG.rotation.set(0, -0.55, -0.12);
    const head = solid(new THREE.SphereGeometry(0.064, 20, 14), fur);
    head.scale.set(1, 0.88, 1.06);
    const muzzle = solid(new THREE.SphereGeometry(0.03, 14, 10), mat({ color: '#f6e3c8', roughness: 0.9 }));
    muzzle.scale.set(0.75, 0.62, 1.2);
    muzzle.position.set(0.05, -0.016, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), new THREE.MeshBasicMaterial({ color: '#d9737a' }));
    nose.position.set(0.072, -0.006, 0);
    headG.add(head, muzzle, nose);
    const lineMat = new THREE.MeshBasicMaterial({ color: '#3a2618' });
    const pink = mat({ color: '#f0a0a6', roughness: 0.8 });
    for (const side of [-1, 1]) {
      const ear = solid(new THREE.ConeGeometry(0.03, 0.06, 4), fur);
      ear.position.set(-0.008, 0.062, side * 0.036);
      ear.rotation.set(side * 0.42, Math.PI / 4, 0);
      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.036, 3), pink);
      inner.position.set(0.012, 0.056, side * 0.034);
      inner.rotation.set(side * 0.42, 0, -0.2);
      // Ojos cerrados: dos rayitas pegadas a la cara
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), lineMat);
      eye.scale.set(0.45, 0.4, 1.9);
      eye.position.set(0.0588, 0.014, side * 0.024);
      eye.rotation.set(side * 0.25, -side * 0.35, 0);
      headG.add(ear, inner, eye);
    }
    cat.add(body, tail, headG);
    const zzz = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: toTexture(paint(128, 128, (ctx) => {
          ctx.fillStyle = '#fbf3e4';
          ctx.strokeStyle = '#2b2622';
          ctx.lineWidth = 4;
          const font = '"Comic Sans MS", "Segoe Print", cursive';
          for (const [size, x, y] of [[46, 14, 112], [34, 58, 70], [26, 94, 38]]) {
            ctx.font = `900 ${size}px ${font}`;
            ctx.strokeText('z', x, y);
            ctx.fillText('z', x, y);
          }
        })),
        transparent: true,
        depthWrite: false,
      }),
    );
    zzz.scale.set(0.15, 0.15, 1);
    zzz.position.set(0.2, 0.27, 0.07);
    cat.add(zzz);
    cat.userData = { body, tail, zzz, bodyY: body.scale.y, zzzY: zzz.position.y };
  }
  cat.position.set(0.12, 0.004, -0.62);
  cat.rotation.y = -1.1;
  scene.add(cat);
  const catHit = (x, y) => {
    if (!cat.visible) return false;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(cat, true).length > 0;
  };

  // Pósteres de tus favoritos en la pared derecha
  const posters = [-1.58, -0.9].map((z) => {
    const frame = boxMesh(0.02, 0.62, 0.45, mat({ color: '#1d1a16', roughness: 0.4 }), ROOM.maxX - 0.012, 1.55, z, { cast: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.41, 0.58), mat({ color: '#f6efe1', roughness: 0.6 }));
    face.position.set(ROOM.maxX - 0.025, 1.55, z);
    face.rotation.y = -Math.PI / 2;
    scene.add(frame, face);
    return { face, key: '' };
  });

  // Velo para enfocar la caja que coges
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0, depthWrite: false }));
  dim.position.z = -1.2;
  dim.visible = false;
  camera.add(dim);

  // ---------------------------------------------------------------- cajas
  // Las cajas de la estantería se dibujan de un trazo: un solo material (el lomo,
  // con una franja de color que usan los laterales). Las que enseñan la portada
  // usan tres: lomo y laterales, portada y contraportada.
  const boxesGroup = new THREE.Group();
  scene.add(boxesGroup);
  const entries = new Map();
  const geometries = new Map();
  const placeholder = mat({ color: '#2a2622', roughness: 0.5 });
  const colorQueue = {};
  let colorTimer = 0;
  let order = [];
  let small = false; // lomos a media resolución en colecciones grandes

  function geometryFor(pid, full) {
    const type = platform(pid).box;
    const key = `${type}:${small}:${full}`;
    if (!geometries.has(key)) {
      const b = boxFor(pid);
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const { H } = spineSize(pid, small);
      const s = SPINE_STRIP / (H + SPINE_STRIP);
      const uv = geo.attributes.uv;
      // Caras: 0 +x, 1 -x (lomo), 2 +y, 3 -y, 4 +z (portada), 5 -z (contraportada)
      for (const f of full ? [0, 2, 3] : [0, 2, 3, 4, 5]) for (let v = 0; v < 4; v++) uv.setXY(f * 4 + v, 0.5, s / 2);
      for (let v = 4; v < 8; v++) uv.setY(v, s + uv.getY(v) * (1 - s));
      uv.needsUpdate = true;
      geo.clearGroups();
      if (full) {
        geo.addGroup(0, 24, 0);
        geo.addGroup(24, 6, 1);
        geo.addGroup(30, 6, 2);
      } else {
        geo.addGroup(0, 36, 0);
      }
      geometries.set(key, geo);
    }
    return geometries.get(key);
  }

  const stripColor = (g) => {
    if (CARDBOARD.has(platform(g.platform).box)) {
      const { h, s, l } = hexToHsl(gameColor(g));
      return hslToHex(h, s, Math.max(10, l - 12));
    }
    return PLASTIC[g.platform] || '#1c1b20';
  };
  const spineMaterial = (g) => mat({ map: toTexture(drawSpine(g, { strip: stripColor(g), small })), roughness: 0.45 });
  const owns = (m) => Boolean(m) && m !== placeholder;

  function setSlot(e, slot, material) {
    const old = e.mesh.material[slot];
    e.mesh.material[slot] = material;
    if (owns(old) && old !== material && !e.mesh.material.includes(old)) {
      old.map?.dispose();
      old.dispose();
    }
  }

  function buildMaterials(e) {
    e.mesh.geometry = geometryFor(e.game.platform, false);
    e.mesh.material = [spineMaterial(e.game), placeholder, placeholder];
    e.front = 'none';
    e.back = false;
  }

  function disposeEntry(e) {
    for (const m of new Set(e.mesh.material)) {
      if (!owns(m)) continue;
      m.map?.dispose();
      m.dispose();
    }
    boxesGroup.remove(e.mesh);
  }

  /** Al quedarse en la estantería vuelve a dibujarse de un trazo y suelta portada y contraportada. */
  function slim(e) {
    if (!entries.has(e.id) || showsFront(e.zone) || inspected === e || (e.front === 'none' && !e.back)) return;
    e.version++;
    e.front = 'none';
    e.back = false;
    setSlot(e, 1, placeholder);
    setSlot(e, 2, placeholder);
    e.mesh.geometry = geometryFor(e.game.platform, false);
  }

  /** Portada visible: primero la dibujada y, si es de Steam, luego la real. */
  function ensureFront(e) {
    if (e.front !== 'none') return;
    e.front = 'art';
    e.mesh.geometry = geometryFor(e.game.platform, true);
    // Los juegos de mesa sin estrenar brillan: aún llevan el plástico
    const wrapped = isBoard(e.game) && e.game.status === 'pendiente';
    setSlot(e, 1, mat({ map: toTexture(drawCover(e.game)), roughness: wrapped ? 0.12 : 0.42, metalness: wrapped ? 0.05 : 0 }));
    const version = e.version;
    loadCover(e.game).then((img) => {
      if (!img || !entries.has(e.id) || e.version !== version || e.front === 'none') return;
      e.front = 'real';
      setSlot(e, 1, mat({ map: toTexture(drawCover(e.game, img)), roughness: 0.42 }));
      if (!e.game.color) queueColor(e.id, dominantColor(img));
      invalidate();
    });
    invalidate();
  }

  function ensureBack(e) {
    if (e.back) return;
    ensureFront(e);
    e.back = true;
    setSlot(e, 2, mat({ map: toTexture(drawBack(e.game)), roughness: 0.5 }));
  }

  function queueColor(id, color) {
    if (!color) return;
    colorQueue[id] = color;
    clearTimeout(colorTimer);
    colorTimer = setTimeout(() => {
      const batch = { ...colorQueue };
      for (const k of Object.keys(colorQueue)) delete colorQueue[k];
      onColors(batch);
    }, 900);
  }

  function placementQuat(p) {
    return new THREE.Quaternion().setFromEuler(new THREE.Euler(p.rx, p.ry, p.rz, 'YXZ'));
  }

  // ---------------------------------------------------------------- animaciones
  const tweens = new Map();
  function tweenTo(key, obj, { pos, quat, scale, dur = 0.8, delay = 0, arc = 0, fn = ease.inOut, onStart, onDone }) {
    if (REDUCED) {
      dur = Math.min(dur, 0.12);
      delay = 0;
      arc = 0;
    }
    // Si sustituimos una animación que aún no había empezado (una caja esperando
    // su turno para caer), ejecutamos su arranque: si no, la caja se quedaría invisible.
    const prev = tweens.get(key);
    if (prev && !prev.began) prev.onStart?.();
    tweens.set(key, { obj, pos, quat, scale, dur: dur * 1000, start: performance.now() + delay * 1000, arc, fn, onStart, onDone, began: false });
    kick();
  }
  function stepTweens(now) {
    for (const [key, t] of tweens) {
      if (now < t.start) continue;
      if (!t.began) {
        t.began = true;
        t.p0 = t.obj.position.clone();
        t.q0 = t.obj.quaternion.clone();
        t.s0 = t.obj.scale.x;
        t.onStart?.();
      }
      const p = Math.min(1, (now - t.start) / t.dur);
      const k = t.fn(p);
      if (t.pos) {
        t.obj.position.lerpVectors(t.p0, t.pos, k);
        if (t.arc) t.obj.position.y += Math.sin(Math.PI * p) * t.arc;
      }
      if (t.quat) t.obj.quaternion.slerpQuaternions(t.q0, t.quat, k);
      if (t.scale !== undefined) t.obj.scale.setScalar(t.s0 + (t.scale - t.s0) * k);
      if (p >= 1) {
        tweens.delete(key);
        t.onDone?.();
      }
    }
  }

  // Brillo al pasar por encima / al señalar una zona
  function setGlow(e, amount) {
    if (!e) return;
    for (const m of new Set(e.mesh.material)) {
      if (!owns(m)) continue;
      m.emissive?.set('#ffcf7a');
      m.emissiveIntensity = amount;
    }
    invalidate();
  }
  let pulseUntil = 0;
  let pulseZone = null;
  function stepPulse(now) {
    if (!pulseZone) return false;
    const left = pulseUntil - now;
    const amount = left > 0 ? 0.35 * (0.5 + 0.5 * Math.sin(now / 120)) : 0;
    for (const e of entries.values()) if (e.zone === pulseZone) setGlow(e, amount);
    if (left <= 0) pulseZone = null;
    return left > 0;
  }

  // ---------------------------------------------------------------- vida ambiental
  // Polvo en la luz, el despertador, el gato que respira y la tele que parpadea.
  // Solo con la habitación a la vista (consola bajada), la pestaña visible y sin
  // «movimiento reducido»; y a pocos fotogramas por segundo, que la batería importa.
  const dust = createDust({ min: new THREE.Vector3(0.15, 0.85, -1.8), max: new THREE.Vector3(2.05, 2.2, -0.75), count: 70 });
  scene.add(dust.points);
  const deskClock = createDeskClock();
  deskClock.group.position.set(DESK.x - 0.53, DESK.top, DESK.z + 0.13);
  deskClock.group.rotation.y = 0.38;
  deskClock.group.scale.setScalar(1.4);
  scene.add(deskClock.group);
  deskClock.update();
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  let ambientOn = !REDUCED;
  let ambientTimer = 0;
  let lastAmbient = 0;
  // La luz del cuarto (el flexo la apaga y la enciende) y la lluvia de la ventana
  let lightsOn = true;
  let raining = false;
  let rain = null;
  let lastInput = performance.now();
  for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown']) window.addEventListener(type, () => (lastInput = performance.now()), { passive: true });
  function ambientTick() {
    ambientTimer = 0;
    if (!ambientOn || !active) return;
    if (!document.hidden) {
      const now = performance.now();
      const dt = lastAmbient ? Math.min(0.2, (now - lastAmbient) / 1000) : 0.05;
      lastAmbient = now;
      const secs = now / 1000;
      dust.step(secs, dt);
      if (cat.visible) animateCat(cat, secs);
      seasonDecor?.step(secs, dt);
      if (raining) rain.step(secs, dt);
      crtMat.color.setScalar(0.94 + Math.random() * 0.06);
      deskClock.update();
      invalidate();
    }
    // Si nadie toca nada en un minuto, el ambiente va al ralentí (6 fotogramas por segundo)
    const idle = performance.now() - lastInput > 60000;
    ambientTimer = setTimeout(ambientTick, 1000 / (idle ? 6 : coarse ? 15 : 24));
  }
  function startAmbient() {
    lastAmbient = 0;
    if (!ambientTimer && ambientOn) ambientTimer = setTimeout(ambientTick, 0);
  }

  // ---------------------------------------------------------------- temporada
  // Halloween: calabaza con vela en el escritorio y murciélagos ante la ventana.
  // Navidad: nieve tras el cristal y luces de colores en la barra de la cortina.
  let seasonDecor = null;
  if (season === 'halloween') {
    seasonDecor = createHalloween({
      pumpkinAt: { pos: new THREE.Vector3(DESK.x + 0.5, DESK.top, DESK.z + 0.2), yaw: -0.75 },
      batsAt: [new THREE.Vector3(win.x - 0.34, 1.84, ROOM.minZ + 0.2), new THREE.Vector3(win.x + 0.06, 1.93, ROOM.minZ + 0.22), new THREE.Vector3(win.x + 0.38, 1.8, ROOM.minZ + 0.2)],
    });
  } else if (season === 'navidad') {
    seasonDecor = createChristmas({
      window: { x: win.x, y: win.y, w: win.w - 0.08, h: win.h - 0.08, z: ROOM.minZ },
      rod: { x0: win.x - 0.6, x1: win.x + 0.6, y: win.y + win.h / 2 + 0.12, z: ROOM.minZ + 0.12 },
    });
  }
  if (seasonDecor) {
    scene.add(seasonDecor.group);
    seasonDecor.step(0, 0);
  }

  // ---------------------------------------------------------------- corazones y ola
  // Al acariciar al gato salen corazones; con el código Konami, las cajas hacen la ola.
  const heartTex = toTexture(paint(64, 64, (ctx) => {
    ctx.fillStyle = '#ff5c8a';
    ctx.strokeStyle = '#fff4f6';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(32, 56);
    ctx.bezierCurveTo(4, 36, 4, 8, 21, 8);
    ctx.bezierCurveTo(28, 8, 32, 14, 32, 19);
    ctx.bezierCurveTo(32, 14, 36, 8, 43, 8);
    ctx.bezierCurveTo(60, 8, 60, 36, 32, 56);
    ctx.fill();
    ctx.stroke();
  }));
  const floaters = [];
  function floatHearts(at, n = 3) {
    const t0 = performance.now();
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, opacity: 0 }));
      s.scale.set(0.085, 0.085, 1);
      s.position.copy(at);
      scene.add(s);
      floaters.push({ s, t0: t0 + i * 220, x0: at.x + (i - 1) * 0.05, y0: at.y, z0: at.z, phase: i * 2 });
    }
    kick();
  }
  function stepFloaters(now) {
    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      const k = (now - f.t0) / (REDUCED ? 900 : 1500);
      if (k < 0) continue;
      if (k >= 1) {
        scene.remove(f.s);
        f.s.material.dispose();
        floaters.splice(i, 1);
        continue;
      }
      const move = REDUCED ? 0 : 1;
      f.s.position.set(f.x0 + Math.sin(k * 7 + f.phase) * 0.02 * move, f.y0 + k * 0.26 * move, f.z0);
      f.s.material.opacity = Math.min(1, k * 6) * (1 - k * k);
      f.s.scale.setScalar(0.085 * (0.7 + 0.3 * Math.min(1, k * 4)));
    }
    return floaters.length > 0;
  }
  function wave() {
    const list = [...entries.values()].filter((e) => e !== inspected && e.mesh.visible && !tweens.has(e.id));
    list.sort((a, b) => a.mesh.position.x - b.mesh.position.x || a.mesh.position.z - b.mesh.position.z);
    list.forEach((e, i) => {
      // En las baldas hay poco hueco encima (y en la Kallax, casi nada): ahí saltan menos
      const arc = e.zone === 'kallax' ? 0.025 : e.zone === 'estanteria' ? 0.1 : 0.16;
      tweenTo(e.id, e.mesh, { pos: e.mesh.position.clone(), dur: 0.55, delay: (i / Math.max(1, list.length)) * 1.6, arc, fn: ease.inOut });
    });
    return list.length;
  }

  // ---------------------------------------------------------------- trofeos
  // Los logros conseguidos, en el alféizar de la ventana (los mejores, hasta 8).
  const SILL = { y: 1.62 - 0.43 - 0.035 + 0.015, z: ROOM.minZ + 0.07, x0: DESK.x - 0.41, step: 0.117 };
  const trophyGroup = new THREE.Group();
  scene.add(trophyGroup);
  const trophies = new Map();
  let trophiesReady = false;
  function setTrophies(list) {
    const want = new Set(list.map((l) => l.id));
    for (const [id, obj] of trophies) {
      if (want.has(id)) continue;
      trophyGroup.remove(obj);
      trophies.delete(id);
    }
    list.forEach((l, i) => {
      let obj = trophies.get(l.id);
      const x = SILL.x0 + i * SILL.step;
      if (!obj) {
        obj = makeTrophy(l);
        obj.userData.title = l.title;
        obj.position.set(x, SILL.y, SILL.z);
        obj.rotation.y = 0.28;
        trophyGroup.add(obj);
        trophies.set(l.id, obj);
        if (trophiesReady) {
          // Uno nuevo: aparece con un saltito
          const size = obj.scale.x;
          obj.scale.setScalar(0.001);
          tweenTo(`trofeo:${l.id}`, obj, { scale: size, dur: 0.9, delay: 0.25, fn: ease.back });
        }
      } else obj.position.x = x;
    });
    trophiesReady = true;
    invalidate();
  }
  function trophyAt(x, y) {
    if (!trophies.size) return null;
    const rect = canvas.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObject(trophyGroup, true)[0];
    let o = hit?.object;
    while (o && o.parent !== trophyGroup) o = o.parent;
    return o || null;
  }

  // ---------------------------------------------------------------- bucle de dibujo
  let needsRender = true;
  let raf = 0;
  function invalidate() {
    needsRender = true;
    kick();
  }
  function kick() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    raf = 0;
    stepTweens(now);
    const moving = cameraMoving();
    updateCamera(now);
    if (inspected && !tweens.has(inspected.id)) holdInFront();
    const pulsing = stepPulse(now);
    const dimming = stepDim();
    const floating = stepFloaters(now);
    if (needsRender || tweens.size || moving || pulsing || dimming || floating) {
      renderer.render(scene, camera);
      needsRender = false;
    }
    if (tweens.size || cameraMoving() || pulsing || dimming || floating) kick();
    else lastFrame = 0;
  }

  // ---------------------------------------------------------------- sincronizar con la colección
  let settingsCache = { tidy: false, sort: 'plataforma' };
  let shownBookcases = 1;
  const sameLook = (a, b) =>
    a.title === b.title && a.platform === b.platform && a.status === b.status && a.color === b.color && a.steamAppId === b.steamAppId &&
    a.minPlayers === b.minPlayers && a.maxPlayers === b.maxPlayers && a.minutes === b.minutes && a.lentTo === b.lentTo &&
    a.tcg === b.tcg && a.format === b.format && a.wins === b.wins && a.losses === b.losses && a.cards === b.cards;
  const sameBack = (a, b) => sameLook(a, b) && a.score === b.score && a.review === b.review && a.hours === b.hours && a.plays === b.plays && a.lentAt === b.lentAt && a.value === b.value && a.list === b.list;

  function sync(games, settings, change = {}) {
    settingsCache = settings;
    applyTheme(settings.theme);
    cat.visible = settings.pet !== false;
    applyWeather(settings.weather);
    const layout = computeLayout(games, settings);
    // El gato se aparta si la pila de la vergüenza crece hasta su sitio
    let pileEdge = -Infinity;
    for (const p of layout.placements.values()) if (p.zone === 'pila') pileEdge = Math.max(pileEdge, p.x);
    cat.position.x = Math.min(0.95, Math.max(0.12, pileEdge + 0.34));
    const fresh = new Set(change.type === 'add' || change.type === 'import' ? change.ids : []);
    const ids = new Set(games.map((g) => g.id));

    // Estanterías nuevas
    if (layout.bookcases !== shownBookcases) {
      bookcases.forEach((b, i) => {
        const show = i < layout.bookcases;
        if (show && !b.visible) {
          b.visible = true;
          b.scale.set(1, 0.01, 1);
          tweenTo(`bookcase${i}`, b, { scale: 1, dur: 0.7, fn: ease.back, onDone: () => b.scale.set(1, 1, 1) });
          if (change.type !== 'init') onNotice(t('¡Nueva estantería desbloqueada! 📚'));
        } else if (!show) b.visible = false;
      });
      shownBookcases = layout.bookcases;
    }

    // Juegos que ya no están
    for (const [id, e] of entries) {
      if (ids.has(id)) continue;
      entries.delete(id);
      if (inspected === e) dropInspect();
      tweenTo(id, e.mesh, { scale: 0.001, dur: 0.35, fn: ease.out, onDone: () => disposeEntry(e) });
    }

    // Colecciones grandes: lomos a media resolución (menos memoria de vídeo)
    const wantSmall = games.length > 300;
    if (wantSmall !== small) {
      small = wantSmall;
      for (const e of entries.values()) {
        const old = e.mesh.material;
        e.version++;
        buildMaterials(e);
        for (const m of new Set(old)) if (owns(m)) (m.map?.dispose(), m.dispose());
        if (showsFront(e.zone) || inspected === e) ensureFront(e);
      }
    }

    let fallIndex = 0;
    let moveIndex = 0;
    const fewShadows = games.length > 600;
    for (const g of games) {
      const p = layout.placements.get(g.id);
      if (!p) continue;
      const pos = new THREE.Vector3(p.x, p.y, p.z);
      const quat = placementQuat(p);
      let e = entries.get(g.id);
      if (!e) {
        const mesh = new THREE.Mesh(geometryFor(g.platform, false), []);
        mesh.castShadow = !fewShadows;
        mesh.receiveShadow = true;
        mesh.userData.id = g.id;
        e = { id: g.id, game: g, mesh, zone: p.zone, home: { pos, quat }, version: 0 };
        buildMaterials(e);
        entries.set(g.id, e);
        boxesGroup.add(mesh);
        if (showsFront(p.zone)) ensureFront(e);
        if (fresh.has(g.id) && !REDUCED) {
          const r = rng(g.id);
          const delay = Math.min(2.6, fallIndex++ * (fresh.size > 30 ? 0.035 : 0.12));
          mesh.position.set(p.x + (r() - 0.5) * 0.2, p.y + 1.4 + r() * 0.5, p.z + (r() - 0.5) * 0.2);
          mesh.quaternion.copy(quat).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(r() - 0.5, r() * 2, r() - 0.5)));
          mesh.visible = false;
          tweenTo(g.id, mesh, {
            pos,
            quat,
            dur: 0.55,
            delay,
            fn: ease.fall,
            onStart: () => (mesh.visible = true),
            onDone: () => {
              sfx.thud(fresh.size > 10 ? 0.5 : 1);
              tweenTo(g.id, mesh, { pos, dur: 0.18, arc: 0.03, fn: ease.out });
            },
          });
        } else {
          mesh.position.copy(pos);
          mesh.quaternion.copy(quat);
        }
        if (!g.color && g.steamAppId) loadSpineColor(g).then((c) => queueColor(g.id, c));
        continue;
      }

      // Juego que ya estaba: ¿ha cambiado su aspecto o su sitio?
      const prev = e.game;
      e.game = g;
      if (prev.platform !== g.platform) {
        e.version++;
        const old = e.mesh.material;
        buildMaterials(e);
        for (const m of new Set(old)) if (owns(m)) (m.map?.dispose(), m.dispose());
        if (showsFront(p.zone) || inspected === e) ensureFront(e);
      } else if (!sameLook(prev, g)) {
        e.version++;
        setSlot(e, 0, spineMaterial(g));
        if (e.front !== 'none' && (prev.title !== g.title || isBoard(g) || (e.front === 'art' && prev.color !== g.color))) {
          e.front = 'none';
          ensureFront(e);
        }
      }
      if (!sameBack(prev, g) && e.back) {
        e.back = false;
        if (inspected === e) ensureBack(e);
        else setSlot(e, 2, placeholder);
      }
      if (showsFront(p.zone)) ensureFront(e);

      const moved = e.home.pos.distanceToSquared(pos) > 1e-6 || e.home.quat.angleTo(quat) > 1e-3;
      e.home = { pos, quat };
      const zoneChanged = e.zone !== p.zone;
      e.zone = p.zone;
      if (moved && inspected !== e) {
        const far = zoneChanged || e.mesh.position.distanceTo(pos) > 0.35;
        const entry = e;
        tweenTo(g.id, e.mesh, {
          pos,
          quat,
          dur: far ? 0.9 : 0.35,
          delay: far ? Math.min(1.4, moveIndex++ * 0.025) : 0,
          arc: far ? 0.35 : 0,
          fn: ease.inOut,
          onDone: () => {
            if (far) sfx.thud(0.4);
            slim(entry);
          },
        });
      }
    }
    order = [...layout.placements.keys()].filter((id) => entries.has(id));
    pileSign.visible = layout.counts.pila > 0;
    updateDecor(layout.decor);
    updatePosters(games);
    crtMat.map?.dispose();
    crtMat.map = toTexture(crtPaint(games.find((g) => g.status === 'jugando')));
    crtMat.needsUpdate = true;
    invalidate();
  }

  function updatePosters(games) {
    const favs = games
      .filter((g) => g.score !== null)
      .sort((a, b) => b.score - a.score || b.hours - a.hours || a.title.localeCompare(b.title))
      .slice(0, posters.length);
    posters.forEach((poster, i) => {
      const g = favs[i];
      const key = g ? `${g.id}:${g.updatedAt}` : '';
      if (poster.key === key) return;
      poster.key = key;
      const m = poster.face.material;
      m.map?.dispose();
      m.map = g ? toTexture(posterPaint(g)) : null;
      m.needsUpdate = true;
      if (g) {
        loadCover(g).then((img) => {
          if (!img || poster.key !== key) return;
          m.map?.dispose();
          m.map = toTexture(posterPaint(g, img));
          m.needsUpdate = true;
          invalidate();
        });
      }
    });
  }

  // ---------------------------------------------------------------- coger una caja
  let inspected = null;
  let flipped = false;
  let spin = 0;
  let dimTarget = 0;
  function stepDim() {
    const m = dim.material;
    const diff = dimTarget - m.opacity;
    handLight.intensity = (m.opacity / 0.55) * 2.6;
    if (Math.abs(diff) < 0.005) {
      m.opacity = dimTarget;
      dim.visible = dimTarget > 0;
      handLight.intensity = (dimTarget / 0.55) * 2.6;
      return false;
    }
    dim.visible = true;
    m.opacity += diff * (REDUCED ? 1 : 0.18);
    return true;
  }

  function inspectPose(e) {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const box = boxFor(e.game.platform);
    const scale = 0.25 / Math.max(box.h, box.w * 0.85);
    const pos = camera.position.clone().addScaledVector(dir, 0.75);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    pos.addScaledVector(up, window.innerWidth < 700 ? 0.06 : 0.03);
    const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin + (flipped ? Math.PI : 0));
    const quat = camera.quaternion.clone().multiply(turn);
    return { pos, quat, scale };
  }

  function holdInFront() {
    const { pos, quat } = inspectPose(inspected);
    inspected.mesh.position.lerp(pos, 0.3);
    inspected.mesh.quaternion.slerp(quat, 0.3);
    if (inspected.mesh.position.distanceToSquared(pos) > 1e-7) kick();
  }

  function inspect(id) {
    const e = entries.get(id);
    if (!e) return false;
    if (inspected && inspected !== e) putBack(inspected);
    inspected = e;
    flipped = false;
    spin = 0;
    ensureFront(e);
    ensureBack(e);
    setGlow(e, 0);
    const pose = inspectPose(e);
    tweenTo(e.id, e.mesh, { ...pose, dur: 0.75, arc: 0.12, fn: ease.inOut });
    dimTarget = 0.55;
    hideTip();
    onInspect(e.game);
    sfx.select();
    return true;
  }

  function putBack(e) {
    tweenTo(e.id, e.mesh, {
      pos: e.home.pos,
      quat: e.home.quat,
      scale: 1,
      dur: 0.6,
      arc: 0.1,
      fn: ease.inOut,
      onDone: () => {
        sfx.thud(0.35);
        slim(e);
      },
    });
  }

  function dropInspect() {
    inspected = null;
    dimTarget = 0;
    onRelease();
    kick();
  }

  function release() {
    if (!inspected) return;
    putBack(inspected);
    dropInspect();
    sfx.back();
  }

  function flip() {
    if (!inspected) return;
    flipped = !flipped;
    spin = 0;
    tweenTo(inspected.id, inspected.mesh, { quat: inspectPose(inspected).quat, dur: 0.55, fn: ease.inOut });
    sfx.move();
  }

  // ---------------------------------------------------------------- ratón, dedo y teclado
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tip = document.createElement('div');
  tip.className = 'room-tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);
  let active = false;
  let hovered = null;
  let selected = -1;

  function pick(x, y) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(boxesGroup.children, false)[0];
    return hit ? entries.get(hit.object.userData.id) : null;
  }

  function showTip(e, x, y) {
    tip.textContent = e.game.title;
    tip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    tip.classList.add('is-on');
  }
  function hideTip() {
    tip.classList.remove('is-on');
  }
  function hover(e, x, y) {
    if (hovered !== e) {
      if (hovered && hovered !== inspected) setGlow(hovered, 0);
      hovered = e;
      if (e && e !== inspected) setGlow(e, 0.28);
    }
    canvas.style.cursor = e ? 'pointer' : '';
    if (e && e !== inspected) showTip(e, x, y);
    else hideTip();
  }

  const pointers = new Map();
  let drag = null;
  let pinch = null;
  canvas.addEventListener('pointerdown', (ev) => {
    if (!active) return;
    canvas.setPointerCapture?.(ev.pointerId);
    pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dolly: view.tDolly };
      drag = null;
    } else {
      drag = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0, yaw: view.tYaw, pitch: view.tPitch, spin };
    }
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!active) return;
    if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      view.tDolly = pinch.dolly + (Math.hypot(a.x - b.x, a.y - b.y) - pinch.d) * 0.005;
      clampView();
      kick();
      return;
    }
    if (drag) {
      const dx = ev.clientX - drag.x;
      const dy = ev.clientY - drag.y;
      drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
      if (drag.moved < 4) return;
      hideTip();
      if (inspected) {
        spin = drag.spin + dx * 0.012;
        kick();
      } else {
        view.tYaw = drag.yaw - dx * 0.0032;
        view.tPitch = drag.pitch + dy * 0.0026;
        clampView();
        kick();
      }
      return;
    }
    if (ev.pointerType === 'mouse') {
      const e = pick(ev.clientX, ev.clientY);
      hover(e, ev.clientX, ev.clientY);
      if (!e) canvas.style.cursor = catHit(ev.clientX, ev.clientY) || lampHit(ev.clientX, ev.clientY) || trophyAt(ev.clientX, ev.clientY) ? 'pointer' : '';
    }
  });
  const endPointer = (ev) => {
    pointers.delete(ev.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!drag) return;
    const click = drag.moved < 6 && performance.now() - drag.t < 600;
    drag = null;
    if (!click || !active) return;
    const e = pick(ev.clientX, ev.clientY);
    if (e && e === inspected) flip();
    else if (e) inspect(e.id);
    else if (inspected) release();
    else if (catHit(ev.clientX, ev.clientY)) {
      sfx.meow();
      onNotice(t('Prrr… 🐱 (mejor no despertarlo)'));
      onPet();
      floatHearts(cat.localToWorld(new THREE.Vector3(0.15, 0.19, 0.07)));
    } else if (lampHit(ev.clientX, ev.clientY)) {
      toggleLights();
    } else {
      const trophy = trophyAt(ev.clientX, ev.clientY);
      if (trophy) {
        sfx.select();
        onNotice(`🏆 ${trophy.userData.title}`);
      }
    }
  };
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', (ev) => {
    pointers.delete(ev.pointerId);
    drag = null;
    pinch = null;
  });
  canvas.addEventListener('pointerleave', () => hover(null));
  canvas.addEventListener(
    'wheel',
    (ev) => {
      if (!active) return;
      ev.preventDefault();
      view.tDolly -= ev.deltaY * 0.0012;
      clampView();
      kick();
    },
    { passive: false },
  );

  function project(e) {
    const v = e.mesh.getWorldPosition(new THREE.Vector3()).project(camera);
    const rect = canvas.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  function select(delta) {
    if (!order.length) return;
    const prev = entries.get(order[selected]);
    if (prev) setGlow(prev, 0);
    selected = (selected + delta + order.length) % order.length;
    const e = entries.get(order[selected]);
    lookAt(e.mesh.position, false);
    setGlow(e, 0.35);
    setTimeout(() => {
      const { x, y } = project(e);
      showTip(e, x, y);
    }, 260);
  }

  function lookAt(point, closer = true) {
    const d = point.clone().sub(BASE.pos).normalize();
    view.tYaw = Math.atan2(d.x, -d.z) - yaw0;
    view.tPitch = Math.asin(d.y) - pitch0;
    if (closer) view.tDolly = 0.7;
    clampView();
    kick();
  }

  function handleKey(ev) {
    if (!active) return false;
    if (inspected) {
      if (ev.key === 'Escape') return ev.preventDefault(), release(), true;
      if (ev.key === 'Enter' || ev.key === ' ' || ev.key.toLowerCase() === 'f') return ev.preventDefault(), flip(), true;
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowLeft') {
        ev.preventDefault();
        const i = order.indexOf(inspected.id);
        const next = order[(i + (ev.key === 'ArrowRight' ? 1 : -1) + order.length) % order.length];
        selected = order.indexOf(next);
        inspect(next);
        return true;
      }
      return false;
    }
    switch (ev.key) {
      case 'ArrowRight':
      case 'ArrowLeft':
        ev.preventDefault();
        select(ev.key === 'ArrowRight' ? 1 : -1);
        return true;
      case 'ArrowUp':
      case 'ArrowDown':
        ev.preventDefault();
        view.tPitch += ev.key === 'ArrowUp' ? 0.12 : -0.12;
        clampView();
        kick();
        return true;
      case 'Enter':
      case ' ':
        if (selected >= 0 && order[selected]) {
          ev.preventDefault();
          inspect(order[selected]);
          return true;
        }
        return false;
      case '+':
      case '-':
        view.tDolly += ev.key === '+' ? 0.3 : -0.3;
        clampView();
        kick();
        return true;
      default:
        return false;
    }
  }

  // ---------------------------------------------------------------- hora del día
  function applyTime() {
    const h = Number.isFinite(hour) && hour !== null ? hour : new Date().getHours() + new Date().getMinutes() / 60;
    const night = h >= 21 || h < 7;
    const dusk = !night && (h >= 19 || h < 8);
    skyMat.map?.dispose();
    skyMat.map = toTexture(skyPaint(h));
    skyMat.needsUpdate = true;
    hemi.intensity = night ? 0.5 : dusk ? 0.8 : 1.1;
    hemi.color.set(night ? '#c9d2ff' : '#fff1dc');
    sun.intensity = night ? 0.35 : dusk ? 1.3 : 2.1;
    sun.color.set(night ? '#9fb4ff' : dusk ? '#ff9f5a' : '#ffe7c4');
    lamp.intensity = night ? 7 : dusk ? 4 : 1;
    fill.intensity = night ? 4 : dusk ? 3 : 1.6;
    shelfLight.intensity = night ? 14 : dusk ? 10 : 5;
    bulbMat.color.set(night || dusk ? '#ffd9a0' : '#c9b48f');
    scene.background.set(night ? '#0f0d14' : '#1d1814');
    // Día de lluvia: menos sol y una luz más fría
    if (raining) {
      sun.intensity *= 0.45;
      hemi.intensity *= 0.85;
      hemi.color.set(night ? '#b9c4ef' : '#e4e9f2');
      rain.setHour(h);
    }
    // Luz apagada: queda la luna (o el día), el brillo de la tele y lo que tengas encendido
    if (!lightsOn) {
      lamp.intensity = 0;
      fill.intensity = 0;
      shelfLight.intensity = 0;
      hemi.intensity *= night ? 0.4 : 0.85;
      bulbMat.color.set('#4a4236');
    }
    tvGlow.intensity = lightsOn ? 0 : night ? 2.6 : 0.6;
    diffuserMat.color.set(lightsOn ? '#ffe2b0' : '#3b342b');
    invalidate();
  }
  function lampHit(x, y) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObject(lampGroup, true).length > 0;
  }
  function setLights(on) {
    if (lightsOn === !!on) return;
    lightsOn = !!on;
    applyTime();
    onLights(lightsOn);
  }
  function toggleLights() {
    sfx.click();
    setLights(!lightsOn);
  }
  /** Llueve según el ajuste (o ?tiempo= en la dirección) y el día. */
  function applyWeather(setting) {
    const want = weatherOf(new Date(), weather || setting || 'auto', season) === 'lluvia';
    if (want === raining) return;
    raining = want;
    if (want && !rain) {
      rain = createRain({
        win: { x: win.x, y: win.y, w: win.w - 0.04, h: win.h - 0.04, z: ROOM.minZ },
        onThunder: () => active && sfx.thunder(),
        reduced: REDUCED,
      });
      scene.add(rain.group);
      rain.step(0, 0);
    }
    if (rain) rain.group.visible = want;
    applyTime();
    onWeather(want);
  }
  applyTime();
  const clock = setInterval(applyTime, 10 * 60 * 1000);

  // ---------------------------------------------------------------- tamaño
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 1 ? THREE.MathUtils.clamp((55 / camera.aspect) * 0.66, 58, 80) : 55;
    camera.updateProjectionMatrix();
    setBase(camera.aspect < 1 ? PORTRAIT_TARGET : BASE.target);
    invalidate();
  }
  window.addEventListener('resize', resize);
  resize();
  updateCamera(0, true);

  return {
    sync,
    inspect,
    release,
    flip,
    handleKey,
    invalidate,
    focusZone(zone) {
      // El gato no tiene sitio fijo: duerme junto a la pila, que crece
      const c = zone === 'gato' ? cat.getWorldPosition(new THREE.Vector3()).setY(0.1) : ZONE_CENTER[zone];
      if (!c) return;
      lookAt(c);
      pulseZone = zone;
      pulseUntil = performance.now() + 1600;
      kick();
    },
    setActive(on) {
      active = !!on;
      if (active && !introDone && !REDUCED) {
        // Entrada de cine la primera vez que bajas la consola
        introDone = true;
        view.yaw = -0.32;
        view.pitch = 0.3;
        view.dolly = -0.8;
        introUntil = performance.now() + 2600;
      }
      if (active) startAmbient();
      if (!active) {
        hover(null);
        hideTip();
        if (selected >= 0) setGlow(entries.get(order[selected]), 0);
        selected = -1;
        view.tYaw = 0;
        view.tPitch = 0;
        view.tDolly = 0;
        kick();
      }
    },
    snapshot() {
      renderer.render(scene, camera);
      return canvas;
    },
    get count() {
      return entries.size;
    },
    /** true mientras haya cajas en movimiento (lo usan las pruebas para esperar). */
    get busy() {
      return tweens.size > 0 || cameraMoving();
    },
    setTrophies,
    wave,
    setLights,
    toggleLights,
    get lightsOn() {
      return lightsOn;
    },
    get raining() {
      return raining;
    },
    /** Cuántos relámpagos lleva la tormenta (para las pruebas). */
    get flashes() {
      return rain ? rain.flashes : 0;
    },
    setAmbient(on) {
      ambientOn = !!on && !REDUCED;
      if (ambientOn && active) startAmbient();
    },
    debug: { scene, camera, renderer, entries, view, tweens, trophies, rain: () => rain },
    dispose() {
      clearInterval(clock);
      clearTimeout(ambientTimer);
      window.removeEventListener('resize', resize);
      tip.remove();
      renderer.dispose();
    },
  };
}
