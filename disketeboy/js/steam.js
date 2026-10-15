// Traduce la biblioteca de Steam a juegos de DisketeBoy (función pura, testeable).
//   · Sin jugar nunca          → pendiente (¡a la pila de la vergüenza!)
//   · Jugado estas 2 semanas   → jugando (al escritorio)
//   · Jugado alguna vez        → jugado (a la estantería)
export function mapSteamGames(list) {
  return (Array.isArray(list) ? list : [])
    .filter((g) => g && Number.isInteger(g.appid) && g.name)
    .map((g) => {
      const minutes = Number(g.playtime_forever) || 0;
      const recent = Number(g.playtime_2weeks) || 0;
      return {
        title: g.name,
        platform: 'pc',
        steamAppId: g.appid,
        hours: Math.round((minutes / 60) * 10) / 10,
        status: recent > 0 ? 'jugando' : minutes > 0 ? 'jugado' : 'pendiente',
      };
    });
}

export const steamCover = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
