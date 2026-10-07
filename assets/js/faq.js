// "¿Tienes dudas?" — buscador de respuestas sobre la propia guía.
// Funciona sin conexión y sin IA: indexa la guía con palabras clave ES/EN y
// devuelve las mejores respuestas. Si no encuentra nada, ofrece escribir al
// anfitrión con la pregunta ya redactada. (En producción: asistente con IA
// alimentado con esta misma guía — ver docs/CONCEPTO.md.)
import { loc } from './i18n.js';

export const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ\s]/g, ' ');

const STOP = new Set('a al como con cual cuando de del donde el en es esta hay la las lo los me mi para por puedo que se si su tengo un una y the a an is to of in my i can do how what where when it at on for'.split(' '));
const tokens = (s) => norm(s).split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

/** Construye el índice de respuestas a partir de la guía. */
export function buildIndex(g) {
  const c = g.checkin || {};
  const h = g.house || {};
  const w = g.wifi || {};
  const E = [];
  const add = (section, keys, title, text) => { if (text) E.push({ section, keys: tokens(keys.join(' ')), title, text: loc(text), all: tokens(`${title} ${loc(text)}`) }); };

  add('wifi', ['wifi', 'wi-fi', 'internet', 'contrasena', 'clave', 'password', 'red', 'network', 'conexion', 'router'], 'WiFi', `Red: ${w.ssid} · Contraseña: ${w.password}${w.notes ? `. ${loc(w.notes)}` : ''}`);
  add('checkin', ['salida', 'checkout', 'check-out', 'irme', 'marcho', 'leave', 'departure', 'hora', 'salir'], 'Check-out', `Antes de las ${c.checkoutBy}.${(c.checkoutSteps || []).length ? ` Antes de irte: ${c.checkoutSteps.map(loc).join(' · ')}.` : ''}`);
  add('checkin', ['llegada', 'llegar', 'entrada', 'checkin', 'check-in', 'arrive', 'arrival', 'hora', 'temprano', 'early'], 'Check-in', `Desde las ${c.from}${c.to ? ` hasta las ${c.to}` : ''}.`);
  add('checkin', ['portal', 'codigo', 'code', 'edificio', 'building', 'puerta', 'door', 'ascensor', 'piso', 'planta', 'entrar'], 'Acceso al edificio', c.building);
  add('checkin', ['llave', 'llaves', 'keys', 'key', 'caja', 'cerradura', 'lockbox', 'codigo'], 'Llaves', c.keys);
  add('checkin', ['maleta', 'maletas', 'equipaje', 'luggage', 'bags', 'consigna', 'storage', 'dejar'], 'Equipaje', c.luggage);
  add('house', ['basura', 'reciclaje', 'contenedor', 'trash', 'garbage', 'recycling', 'bin', 'residuos'], 'Basura y reciclaje', h.trash);
  add('house', ['luz', 'electricidad', 'salta', 'cuadro', 'fusible', 'power', 'electricity', 'manual'], 'Manual rápido', h.manual);
  if ((h.rules || []).length) add('house', ['norma', 'normas', 'rules', 'fumar', 'smoke', 'ruido', 'noise', 'fiesta', 'party', 'mascota', 'mascotas', 'pet', 'perro', 'dog', 'silencio', 'permitido', 'allowed'], 'Normas de la casa', h.rules.map(loc).join(' · '));
  (h.howItWorks || []).forEach((x) => add('house', [loc(x.title), 'como funciona', 'how'], loc(x.title), x.text));
  if ((h.equipment || []).length) add('house', ['hay', 'tiene', 'equipamiento', 'plancha', 'secador', 'lavadora', 'cafetera', 'cuna', 'iron', 'hairdryer', 'washer', 'coffee', 'crib', 'toallas', 'towels'], 'Equipamiento', (h.equipment || []).map(loc).join(' · '));

  add('emergency', ['urgencia', 'urgencias', 'emergencia', 'emergency', 'policia', 'police', 'ambulancia', 'ambulance', 'medico', 'doctor', 'hospital', 'fuego', 'fire', 'robo'], 'Emergencias', `Llama al 112 (gratis, atienden en inglés).${g.hospital ? ` Hospital más cercano: ${g.hospital.name}.` : ''}`);
  add('nearby', ['farmacia', 'pharmacy', 'medicina', 'medicine', 'supermercado', 'super', 'supermarket', 'comprar', 'groceries', 'cajero', 'atm', 'parking', 'aparcar'], 'Cerca de mí', 'En "Cerca de mí" tienes un mapa en vivo con farmacias (las 24 h primero), supermercados, cafeterías, metro y parking.');
  add('move', ['taxi', 'uber', 'cabify', 'aeropuerto', 'airport', 'metro', 'bus', 'autobus', 'tren', 'train', 'transporte', 'moverme', 'llegar'], 'Moverme', `Taxi sin apps (Uber web o radio-taxi), metro más cercano: ${(g.transport?.nearestStations || []).map((s) => s.name).join(', ') || 'ver sección'}. También cómo ir al aeropuerto.`);
  add('eat', ['comer', 'cenar', 'desayunar', 'restaurante', 'restaurant', 'eat', 'food', 'dinner', 'lunch', 'breakfast', 'tapas', 'cafe', 'recomiendas'], 'Comer', `Mis favoritos: ${(g.recommendations?.eat || []).slice(0, 4).map((p) => p.name).join(', ')}.`);
  add('do', ['ver', 'visitar', 'hacer', 'museo', 'planes', 'do', 'visit', 'see', 'museum', 'turismo'], 'Qué hacer', `Imprescindibles: ${(g.recommendations?.do || []).slice(0, 4).map((p) => p.name).join(', ')}.`);
  add('contact', ['anfitrion', 'anfitriona', 'host', 'contacto', 'contact', 'telefono', 'phone', 'whatsapp', 'llamar', 'hablar'], 'Contacto', `${g.host?.name} responde de ${g.host?.responseHours} (${loc(g.host?.responseDays)}).`);
  return E;
}

/** Devuelve las mejores respuestas (máx. 3) para la pregunta. */
export function ask(index, question) {
  const q = tokens(question);
  if (!q.length) return [];
  const scored = index.map((e) => {
    let score = 0;
    q.forEach((w) => {
      if (e.keys.includes(w)) score += 3;
      else if (e.keys.some((k) => k.length > 3 && (k.startsWith(w) || w.startsWith(k)))) score += 2;
      if (e.all.includes(w)) score += 1;
    });
    return { ...e, score };
  }).filter((e) => e.score >= 2);
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.score || 0;
  return scored.filter((e) => e.score >= best * 0.5).slice(0, 3);
}
