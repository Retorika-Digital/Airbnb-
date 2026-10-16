// Idiomas. El texto en español es la clave y cada diccionario lo traduce, así el
// código se sigue leyendo en español. Si faltara una traducción saldría en
// español, y una prueba se encarga de que no falte ninguna.
import EN from './lang/en.js';

export const LANGS = ['es', 'en'];
export const LANG_NAME = { es: 'Español', en: 'English' };
const DICTS = { en: EN };
let lang = 'es';

/** Idioma del navegador: español para es, ca, gl y eu; si no, inglés. */
export function detectLang(list = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]) {
  for (const l of list) {
    const base = String(l || '').toLowerCase().split('-')[0];
    if (['es', 'ca', 'gl', 'eu'].includes(base)) return 'es';
    if (base === 'en') return 'en';
  }
  return list.length ? 'en' : 'es';
}

export function setLang(l) {
  lang = LANGS.includes(l) ? l : 'es';
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

export const getLang = () => lang;
export const locale = () => (lang === 'en' ? 'en-US' : 'es-ES');

/** Traduce un texto en español. Las {llaves} se rellenan con vars. */
export function t(text, vars) {
  let s = (lang !== 'es' && DICTS[lang]?.[text]) || text;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}

/** Singular o plural (en español y en inglés la regla es la misma): {n} es el número. */
export const tp = (n, one, other, vars) => t(n === 1 ? one : other, { n, ...vars });

/** Marca un texto para traducirlo más tarde, con t() (para tablas de etiquetas). */
export const mark = (text) => text;

/** Número con los separadores del idioma. */
export const num = (n, opts) => Number(n || 0).toLocaleString(locale(), opts);
