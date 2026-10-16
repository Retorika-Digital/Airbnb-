// Plataformas y el formato de caja de cada una, con sus medidas reales en metros
// (ancho × alto × grosor). Así una estantería con juegos de N64, PS1 y Switch
// se ve tan variada como una de verdad.

export const BOXES = {
  dvd: { w: 0.135, h: 0.19, d: 0.014 },
  bluray: { w: 0.135, h: 0.17, d: 0.012 },
  switch: { w: 0.105, h: 0.17, d: 0.011 },
  jewel: { w: 0.142, h: 0.125, d: 0.01 },
  carton: { w: 0.18, h: 0.128, d: 0.032 },
  cartonV: { w: 0.128, h: 0.18, d: 0.032 },
  pocket: { w: 0.125, h: 0.125, d: 0.028 },
  ds: { w: 0.125, h: 0.137, d: 0.014 },
  estuche: { w: 0.135, h: 0.185, d: 0.022 },
  umd: { w: 0.104, h: 0.178, d: 0.014 },
  // Juegos de mesa, de pie en la Kallax como libros
  mesaS: { w: 0.13, h: 0.095, d: 0.035 },
  mesaM: { w: 0.25, h: 0.25, d: 0.06 },
  mesaL: { w: 0.297, h: 0.297, d: 0.072 },
  mesaXL: { w: 0.31, h: 0.31, d: 0.11 },
};

// Tamaños de caja de juego de mesa (se eligen al añadirlo).
export const BOARD_SIZES = [
  { id: 'mesa-s', name: 'Pequeña (de cartas)' },
  { id: 'mesa-m', name: 'Mediana' },
  { id: 'mesa-l', name: 'Estándar' },
  { id: 'mesa-xl', name: 'Enorme' },
];

// band: color de la franja superior de la portada (genérica, sin logos).
export const PLATFORMS = [
  { id: 'pc', name: 'PC', short: 'PC', box: 'dvd', band: '#1b2838' },
  { id: 'ps5', name: 'PlayStation 5', short: 'PS5', box: 'bluray', band: '#f4f4f4' },
  { id: 'ps4', name: 'PlayStation 4', short: 'PS4', box: 'bluray', band: '#1f4fb0' },
  { id: 'ps3', name: 'PlayStation 3', short: 'PS3', box: 'bluray', band: '#111111' },
  { id: 'ps2', name: 'PlayStation 2', short: 'PS2', box: 'dvd', band: '#121212' },
  { id: 'ps1', name: 'PlayStation', short: 'PS1', box: 'jewel', band: '#1a1a1a' },
  { id: 'psp', name: 'PSP', short: 'PSP', box: 'umd', band: '#202020' },
  { id: 'vita', name: 'PS Vita', short: 'VITA', box: 'ds', band: '#2a5aa8' },
  { id: 'switch2', name: 'Nintendo Switch 2', short: 'SW2', box: 'switch', band: '#d8262c' },
  { id: 'switch', name: 'Nintendo Switch', short: 'SW', box: 'switch', band: '#e60012' },
  { id: 'wiiu', name: 'Wii U', short: 'WIIU', box: 'dvd', band: '#1d8fd1' },
  { id: 'wii', name: 'Wii', short: 'WII', box: 'dvd', band: '#e8e8e8' },
  { id: 'gc', name: 'GameCube', short: 'GC', box: 'estuche', band: '#4b3d8f' },
  { id: 'n64', name: 'Nintendo 64', short: 'N64', box: 'carton', band: '#1c1c1c' },
  { id: 'snes', name: 'Super Nintendo', short: 'SNES', box: 'carton', band: '#8c8c96' },
  { id: 'nes', name: 'NES', short: 'NES', box: 'cartonV', band: '#151515' },
  { id: '3ds', name: 'Nintendo 3DS', short: '3DS', box: 'ds', band: '#c4161c' },
  { id: 'ds', name: 'Nintendo DS', short: 'DS', box: 'ds', band: '#f0f0f0' },
  { id: 'gba', name: 'Game Boy Advance', short: 'GBA', box: 'pocket', band: '#4a3a8c' },
  { id: 'gbc', name: 'Game Boy Color', short: 'GBC', box: 'pocket', band: '#7a3fa0' },
  { id: 'gb', name: 'Game Boy', short: 'GB', box: 'pocket', band: '#9a9a9a' },
  { id: 'xsx', name: 'Xbox Series', short: 'XSX', box: 'bluray', band: '#107c10' },
  { id: 'xone', name: 'Xbox One', short: 'XONE', box: 'bluray', band: '#107c10' },
  { id: 'x360', name: 'Xbox 360', short: 'X360', box: 'dvd', band: '#5c9e2f' },
  { id: 'xbox', name: 'Xbox', short: 'XBOX', box: 'dvd', band: '#2a6a14' },
  { id: 'md', name: 'Mega Drive', short: 'MD', box: 'estuche', band: '#151515' },
  { id: 'dc', name: 'Dreamcast', short: 'DC', box: 'jewel', band: '#e8e8e8' },
  { id: 'saturn', name: 'Saturn', short: 'SAT', box: 'jewel', band: '#2b2b2b' },
  { id: 'otra', name: 'Otra', short: '???', box: 'dvd', band: '#5a5246' },
];

// "Plataformas" internas de los juegos de mesa: no salen en los formularios de videojuegos.
const BOARD_PLATFORMS = [
  { id: 'mesa-s', name: 'Juego de mesa', short: 'MESA', box: 'mesaS', band: '#2f5d62', board: true },
  { id: 'mesa-m', name: 'Juego de mesa', short: 'MESA', box: 'mesaM', band: '#2f5d62', board: true },
  { id: 'mesa-l', name: 'Juego de mesa', short: 'MESA', box: 'mesaL', band: '#2f5d62', board: true },
  { id: 'mesa-xl', name: 'Juego de mesa', short: 'MESA', box: 'mesaXL', band: '#2f5d62', board: true },
];

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);
export const BOARD_IDS = BOARD_PLATFORMS.map((p) => p.id);
const BY_ID = Object.fromEntries([...PLATFORMS, ...BOARD_PLATFORMS].map((p, i) => [p.id, { ...p, order: i }]));

export const platform = (id) => BY_ID[id] || BY_ID.otra;
export const boxFor = (id) => BOXES[platform(id).box];
