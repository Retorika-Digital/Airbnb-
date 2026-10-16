// Ajustes del proyecto que se cambian a mano antes de publicar.

/**
 * Tu página de donaciones (Ko-fi, Buy Me a Coffee, Patreon…), con https://.
 * Mientras esté vacía no sale ningún botón de donar.
 */
export const DONATE_URL = '';

/** Solo se usa si es un enlace https:// de verdad. */
export const donateUrl = (url = DONATE_URL) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' ? u.href : '';
  } catch {
    return '';
  }
};
