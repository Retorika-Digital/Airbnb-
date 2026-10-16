// Colección de ejemplo para enseñar DisketeBoy sin tener que teclear nada.
// Los de Steam traen su portada real; los retro llevan una portada generada.
// Los textos se traducen al cargar la demo (con el idioma de quien la carga).
import { t, mark } from './i18n.js';
import { titleKey } from './util.js';

export const DEMO_GAMES = [
  { title: 'Hollow Knight', platform: 'pc', steamAppId: 367520, status: 'terminado', score: 10, hours: 62, review: mark('Precioso, difícil y con la mejor música. El Palacio Blanco casi me cuesta un mando.') },
  { title: 'Hollow Knight: Silksong', platform: 'pc', steamAppId: 1030300, status: 'jugando', score: 9, hours: 31, review: mark('Hornet se mueve como la seda. Los jefes me odian personalmente.') },
  { title: 'Stardew Valley', platform: 'pc', steamAppId: 413150, status: 'jugado', score: 9, hours: 140, review: mark('Iba a ser un ratito. Llevo cuatro años de granja.') },
  { title: 'Hades', platform: 'pc', steamAppId: 1145360, status: 'terminado', score: 10, hours: 85, review: mark('Morir nunca fue tan divertido.') },
  { title: 'Hades II', platform: 'pc', steamAppId: 1145350, status: 'jugando', score: 9, hours: 22 },
  { title: 'Celeste', platform: 'pc', steamAppId: 504230, status: 'terminado', score: 9, hours: 18, review: mark('Un plataformas durísimo que en el fondo es un abrazo.') },
  { title: 'Portal 2', platform: 'pc', steamAppId: 620, status: 'terminado', score: 10, hours: 14 },
  { title: 'The Witcher 3: Wild Hunt', platform: 'pc', steamAppId: 292030, status: 'pendiente', hours: 3, review: mark('Lo empecé en 2019. Geralt sigue esperando en el prólogo.') },
  { title: 'ELDEN RING', platform: 'pc', steamAppId: 1245620, status: 'abandonado', score: 7, hours: 26, review: mark('Margit me ganó 43 veces. Volveré… algún día.') },
  { title: "Baldur's Gate 3", platform: 'pc', steamAppId: 1086940, status: 'pendiente' },
  { title: 'Cyberpunk 2077', platform: 'pc', steamAppId: 1091500, status: 'pendiente' },
  { title: 'Disco Elysium', platform: 'pc', steamAppId: 632470, status: 'pendiente' },
  { title: 'Outer Wilds', platform: 'pc', steamAppId: 753640, status: 'terminado', score: 10, hours: 21, review: mark('No busques nada en internet. Juégalo y ya.') },
  { title: 'Balatro', platform: 'pc', steamAppId: 2379780, status: 'jugando', score: 9, hours: 74, review: mark('Solo una partida más. (Mentira.)') },
  { title: 'Slay the Spire', platform: 'pc', steamAppId: 646570, status: 'jugado', score: 9, hours: 110 },
  { title: 'Red Dead Redemption 2', platform: 'pc', steamAppId: 1174180, status: 'pendiente' },
  { title: 'Inscryption', platform: 'pc', steamAppId: 1092790, status: 'terminado', score: 9, hours: 12 },
  { title: 'Factorio', platform: 'pc', steamAppId: 427520, status: 'pendiente', review: mark('Me da miedo empezarlo: dicen que de ahí no se sale.') },
  { title: mark('Pokémon Rojo'), platform: 'gb', status: 'terminado', score: 10, hours: 90, review: mark('El cable link en el recreo. Nada lo supera.') },
  { title: 'The Legend of Zelda: Ocarina of Time', platform: 'n64', status: 'terminado', score: 10, hours: 40 },
  { title: 'Final Fantasy VII', platform: 'ps1', status: 'terminado', score: 10, hours: 70 },
  { title: 'Metal Gear Solid', platform: 'ps1', status: 'jugado', score: 9, hours: 15 },
  { title: 'Yu-Gi-Oh! The Duelists of the Roses', platform: 'ps2', status: 'jugado', score: 8, hours: 55, review: mark('Lo mejor: el tablero. Lo peor: que nadie haya hecho otro igual.') },
  { title: 'Shadow of the Colossus', platform: 'ps2', status: 'pendiente' },
  { title: 'Super Mario World', platform: 'snes', status: 'terminado', score: 10, hours: 20 },
  { title: 'Mario Kart 8 Deluxe', platform: 'switch', status: 'jugado', score: 8, hours: 60 },
];

// Juegos de mesa de ejemplo para la Kallax.
export const DEMO_BOARDS = [
  { kind: 'mesa', title: 'Catan', minPlayers: 3, maxPlayers: 4, minutes: 90, platform: 'mesa-l', status: 'jugado', score: 7, plays: 23, review: mark('Te cambio dos de trigo por una de ladrillo. ¿No? ¿Y por nuestra amistad?') },
  { kind: 'mesa', title: 'Carcassonne', minPlayers: 2, maxPlayers: 5, minutes: 40, platform: 'mesa-m', status: 'favorito', score: 9, plays: 41, review: mark('El campo más grande del mundo, conectado a una sola ciudad. Mío.') },
  { kind: 'mesa', title: mark('Aventureros al Tren'), minPlayers: 2, maxPlayers: 5, minutes: 60, platform: 'mesa-l', status: 'favorito', score: 9, plays: 30 },
  { kind: 'mesa', title: 'Dixit', minPlayers: 3, maxPlayers: 8, minutes: 30, platform: 'mesa-l', status: 'jugado', score: 8, plays: 15, lentTo: 'Pedro', lentAt: '2026-05-26T18:00:00.000Z' },
  { kind: 'mesa', title: 'Azul', minPlayers: 2, maxPlayers: 4, minutes: 45, platform: 'mesa-l', status: 'jugado', score: 8, plays: 12 },
  { kind: 'mesa', title: 'Wingspan', minPlayers: 1, maxPlayers: 5, minutes: 70, platform: 'mesa-l', status: 'jugado', score: 9, plays: 9, review: mark('Un juego de pájaros en el que la que más sabe de pájaros siempre pierde.') },
  { kind: 'mesa', title: 'Pandemic', minPlayers: 2, maxPlayers: 4, minutes: 45, platform: 'mesa-l', status: 'jugado', score: 8, plays: 11 },
  { kind: 'mesa', title: mark('Código Secreto'), minPlayers: 2, maxPlayers: 8, minutes: 15, platform: 'mesa-m', status: 'favorito', score: 9, plays: 52 },
  { kind: 'mesa', title: '7 Wonders', minPlayers: 3, maxPlayers: 7, minutes: 30, platform: 'mesa-xl', status: 'jugado', score: 8, plays: 14 },
  { kind: 'mesa', title: 'Virus!', minPlayers: 2, maxPlayers: 6, minutes: 20, platform: 'mesa-s', status: 'favorito', score: 9, plays: 67, review: mark('Diez euros de juego. Ha roto más amistades que el Monopoly.') },
  { kind: 'mesa', title: 'Love Letter', minPlayers: 2, maxPlayers: 6, minutes: 20, platform: 'mesa-s', status: 'jugado', score: 7, plays: 20, lentTo: 'Lucía', lentAt: '2026-09-30T18:00:00.000Z' },
  { kind: 'mesa', title: 'Terraforming Mars', minPlayers: 1, maxPlayers: 5, minutes: 120, platform: 'mesa-xl', status: 'jugado', score: 9, plays: 6 },
  { kind: 'mesa', title: 'Gloomhaven', minPlayers: 1, maxPlayers: 4, minutes: 120, platform: 'mesa-xl', status: 'pendiente', review: mark('Pesa diez kilos. De momento hace de mesita auxiliar.') },
  { kind: 'mesa', title: 'Dune: Imperium', minPlayers: 1, maxPlayers: 4, minutes: 120, platform: 'mesa-l', status: 'pendiente' },
  { kind: 'mesa', title: 'Brass: Birmingham', minPlayers: 2, maxPlayers: 4, minutes: 120, platform: 'mesa-l', status: 'pendiente' },
];

// Mazos y carpetas de cartas de ejemplo.
export const DEMO_CARDS = [
  { kind: 'mazo', title: mark('Atraxa Superamigos'), tcg: 'mtg', format: 'Commander', status: 'montado', score: 9, wins: 23, losses: 11, list: "1 Atraxa, Praetors' Voice\n1 Sol Ring\n1 Doubling Season\n1 Deepglow Skate\n35 Forest\n// …", review: mark('Cuando bajo a Atraxa, la mesa entera me mira mal. Con razón.') },
  { kind: 'mazo', title: mark('Rojo Burn'), tcg: 'mtg', format: 'Modern', status: 'montado', score: 7, wins: 14, losses: 16, list: '4 Lightning Bolt\n4 Lava Spike\n4 Rift Bolt\n4 Monastery Swiftspear\n4 Goblin Guide\n20 Mountain' },
  { kind: 'mazo', title: 'Charizard ex', tcg: 'pokemon', format: mark('Estándar'), status: 'montado', score: 8, wins: 8, losses: 3 },
  { kind: 'mazo', title: mark('Ojos Azules'), tcg: 'yugioh', format: 'Goat', status: 'desmontado', score: 6, wins: 5, losses: 7, review: mark('Lo desmonté para hacer otro y me arrepiento cada día.') },
  { kind: 'mazo', title: mark('Luffy Rojo'), tcg: 'onepiece', format: mark('Estándar'), status: 'construccion', wins: 6, losses: 4 },
  { kind: 'carpeta', title: 'Pokémon 151', tcg: 'pokemon', cards: 165, value: 120, status: 'progreso', review: mark('Me faltan 12. El Charizard de arte alternativo cuesta lo que un riñón.') },
  { kind: 'carpeta', title: mark('Mis brillis de Magic'), tcg: 'mtg', cards: 420, value: 850.5, status: 'progreso' },
  { kind: 'carpeta', title: mark('Yu-Gi-Oh! de 2004'), tcg: 'yugioh', cards: 300, value: 60, status: 'completa', review: mark('Encontrada en casa de mis padres. Huele a recreo.') },
];

/**
 * Toda la demo, con los títulos, reseñas y formatos en el idioma actual. Si se pasa la
 * colección, deja fuera lo que ya está (en español o traducido), para no duplicar al
 * volver a cargarla en otro idioma.
 */
export const demoCollection = (existing = []) => {
  const have = new Set(existing.map((g) => titleKey(g.title)));
  return [...DEMO_GAMES, ...DEMO_BOARDS, ...DEMO_CARDS].filter((g) => !have.has(titleKey(g.title)) && !have.has(titleKey(t(g.title)))).map((g) => ({
    ...g,
    title: t(g.title),
    ...(g.review ? { review: t(g.review) } : {}),
    ...(g.format ? { format: t(g.format) } : {}),
  }));
};
