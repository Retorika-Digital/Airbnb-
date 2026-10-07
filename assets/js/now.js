// "Ahora mismo": una nota del tablón que cambia según la hora, el tiempo y
// el día de la estancia. Función pura → fácil de testear.
import { getLang } from './i18n.js';

const T = {
  es: {
    breakfast: ['Buenos días ☕', 'Para desayunar cerca: {p}'],
    lunch: ['¿Hambre?', 'Te recomiendo {p}'],
    afternoon: ['Plan para esta tarde', '{p}: {d}'],
    rainy: ['Hoy llueve ☔', 'Plan a cubierto: {p}'],
    dinner: ['Hora de cenar 🍷', '{p} está a {m} min'],
    late: ['¿Volviendo tarde?', 'Pide un taxi a casa sin apps →'],
    checkout: ['Hoy es tu check-out', 'Antes de las {t}. Repasa la lista →'],
    arrival: ['¡Hoy llegas!', 'Check-in desde las {t}. Cómo entrar →'],
  },
  en: {
    breakfast: ['Good morning ☕', 'Breakfast nearby: {p}'],
    lunch: ['Hungry?', 'I recommend {p}'],
    afternoon: ['Plan for this afternoon', '{p}: {d}'],
    rainy: ['Rainy day ☔', 'Indoor plan: {p}'],
    dinner: ['Dinner time 🍷', '{p} is {m} min away'],
    late: ['Heading home late?', 'Get a taxi home, no apps →'],
    checkout: ['Check-out today', 'Before {t}. Check the list →'],
    arrival: ['You arrive today!', 'Check-in from {t}. How to get in →'],
  },
};

const fill = (s, v) => s.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * @returns {{ key, icon, title, text, action: {section?, place?, dest?} }}
 */
export function nowTip(g, { now = new Date(), rain = false, stay = null, lang = getLang() } = {}) {
  const tx = T[lang] || T.es;
  const h = now.getHours();
  const eat = g.recommendations?.eat || [];
  const todo = g.recommendations?.do || [];
  const pick = (arr, pred) => arr.find((p) => pred(p) && p.hostPick) || arr.find(pred) || arr[0];
  const make = (key, icon, vars, action) => ({ key, icon, title: tx[key][0], text: fill(tx[key][1], vars), action });
  const cat = (p, re) => re.test(String(p?.category?.es ?? p?.category ?? ''));

  if (stay && isoDay(now) === stay.out && h < 12) return make('checkout', 'luggage', { t: g.checkin?.checkoutBy }, { section: 'checkin' });
  if (stay && isoDay(now) === stay.in && h < 20) return make('arrival', 'key-round', { t: g.checkin?.from }, { section: 'checkin' });

  if (h >= 0 && h < 6) return make('late', 'car-taxi-front', {}, { section: 'move' });
  if (h < 11) {
    const p = pick(eat, (x) => cat(x, /caf/i));
    if (p) return make('breakfast', 'coffee', { p: p.name }, { place: p, kind: 'eat' });
  }
  if (h < 16) {
    const p = pick(eat, (x) => !cat(x, /caf/i));
    if (p) return make('lunch', 'utensils', { p: p.name }, { place: p, kind: 'eat' });
  }
  if (h < 20) {
    if (rain) {
      const p = pick(todo, (x) => cat(x, /cultur|muse/i));
      if (p) return make('rainy', 'umbrella', { p: p.name }, { place: p, kind: 'do' });
    }
    const p = pick(todo, () => true);
    if (p) return make('afternoon', 'sun', { p: p.name, d: String(p.desc?.es ?? p.desc ?? '').replace(/\.$/, '') }, { place: p, kind: 'do' });
  }
  const p = pick(eat, (x) => !cat(x, /caf/i));
  if (p && p.minutes) return make('dinner', 'wine', { p: p.name, m: p.minutes }, { place: p, kind: 'eat' });
  if (p) return { ...make('lunch', 'wine', { p: p.name }, { place: p, kind: 'eat' }), key: 'dinner', title: tx.dinner[0] };
  return make('late', 'car-taxi-front', {}, { section: 'move' });
}

/** Noche: de 21:00 a 7:00 (se puede forzar con ?night=1 / ?night=0). */
export function isNight(now = new Date(), force = null) {
  if (force === '1') return true;
  if (force === '0') return false;
  const h = now.getHours();
  return h >= 21 || h < 7;
}
