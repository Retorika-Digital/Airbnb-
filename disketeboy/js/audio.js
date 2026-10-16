// Sonidos chiptune generados al vuelo con WebAudio: ni archivos ni samples ajenos.
let ctx = null;
let enabled = true;
let unlocked = false;
let lastThud = 0;

export function setSound(on) {
  enabled = !!on;
  syncRain();
}

// Los navegadores no dejan sonar nada hasta que la persona toca o pulsa algo.
if (typeof window !== 'undefined') {
  const unlock = () => {
    unlocked = true;
    syncRain();
    window.removeEventListener('pointerdown', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('keydown', unlock, true);
}

function ac() {
  if (!enabled || !unlocked || typeof window === 'undefined') return null;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq, start, dur, { type = 'square', vol = 0.06, slide = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(start, dur, vol = 0.15, cutoff = 600) {
  const c = ac();
  if (!c) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = c.createGain();
  gain.gain.value = vol;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(c.currentTime + start);
}

// Lluvia de fondo: ruido rosa en bucle, filtrado, que entra y sale con suavidad.
// Solo suena con el sonido activado, después de tocar algo y con la pestaña a la vista.
let rainWanted = false;
let rainNode = null;
export function setRain(on) {
  rainWanted = !!on;
  syncRain();
}
function syncRain() {
  const want = rainWanted && enabled && unlocked && !(typeof document !== 'undefined' && document.hidden);
  if (want && !rainNode) {
    const c = ac();
    if (!c) return;
    const len = c.sampleRate * 4;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
      }
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 2600;
    const high = c.createBiquadFilter();
    high.type = 'highpass';
    high.frequency.value = 280;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 2.5);
    src.connect(low).connect(high).connect(gain).connect(c.destination);
    src.start();
    rainNode = { src, gain };
  } else if (!want && rainNode && ctx) {
    const { src, gain } = rainNode;
    rainNode = null;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.stop(t + 0.85);
  }
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', syncRain);

export const sfx = {
  move: () => tone(880, 0, 0.03, { vol: 0.025 }),
  select: () => {
    tone(988, 0, 0.05, { vol: 0.04 });
    tone(1319, 0.05, 0.08, { vol: 0.04 });
  },
  back: () => {
    tone(660, 0, 0.05, { vol: 0.04 });
    tone(440, 0.05, 0.08, { vol: 0.04 });
  },
  save: () => {
    tone(1047, 0, 0.04, { vol: 0.03 });
    tone(1568, 0.04, 0.08, { vol: 0.03 });
  },
  error: () => tone(150, 0, 0.18, { type: 'sawtooth', vol: 0.04 }),
  boot: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.14, { vol: 0.04 }));
    tone(1568, 0.38, 0.45, { vol: 0.035, type: 'triangle' });
  },
  insert: () => {
    noise(0, 0.05, 0.22, 2500);
    tone(110, 0.06, 0.28, { type: 'triangle', vol: 0.05, slide: 40 });
    noise(0.14, 0.4, 0.04, 900);
  },
  eject: () => {
    noise(0, 0.06, 0.2, 2000);
    tone(180, 0.02, 0.12, { type: 'triangle', vol: 0.05, slide: -60 });
  },
  /** Una caja que cae. Limitado para que una lluvia de cajas no sature. */
  thud: (strength = 1) => {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastThud < 45) return;
    lastThud = now;
    noise(0, 0.12, 0.16 * strength, 380);
    tone(75, 0, 0.12, { type: 'sine', vol: 0.1 * strength, slide: -30 });
  },
  meow: () => {
    const c = ac();
    if (!c) return;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.linearRampToValueAtTime(880, t + 0.12);
    osc.frequency.linearRampToValueAtTime(600, t + 0.45);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.55);
  },
  /** Fanfarria corta para los logros y las celebraciones. */
  fanfare: () => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.1, { vol: 0.045 }));
    tone(1047, 0.24, 0.16, { vol: 0.05 });
    tone(784, 0.4, 0.08, { vol: 0.04 });
    tone(1047, 0.48, 0.42, { vol: 0.05, type: 'triangle' });
    tone(1319, 0.48, 0.42, { vol: 0.03, type: 'triangle' });
  },
  /** Arpegio de «power-up» para el código Konami. */
  powerup: () => {
    [392, 523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, i * 0.045, 0.07, { vol: 0.035 }));
    tone(2093, 0.33, 0.3, { vol: 0.03, type: 'triangle' });
  },
  /** Trueno lejano, después del relámpago. */
  thunder: () => {
    noise(0, 2.4, 0.3, 140);
    noise(0.15, 1.2, 0.12, 420);
    tone(46, 0, 1.8, { type: 'sine', vol: 0.09, slide: -12 });
  },
  /** El interruptor de la luz. */
  click: () => {
    noise(0, 0.02, 0.3, 3200);
    tone(2200, 0, 0.012, { vol: 0.02 });
  },
  print: () => {
    for (let i = 0; i < 12; i++) noise(i * 0.055, 0.04, 0.045, 4200);
  },
};
