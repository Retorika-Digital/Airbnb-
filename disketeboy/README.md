# DisketeBoy 💾

**Apunta tus videojuegos en una consola retro y míralos amontonarse en tu habitación 3D.**

Gestionas la colección desde la DisketeBoy, una consola de diseño propio con un disquete por colección. Detrás está tu habitación, y cada juego aparece en ella según su estado:

| Estado | Dónde acaba la caja |
|---|---|
| Pendiente | En la **pila de la vergüenza**, en el suelo |
| Jugando | En el **escritorio**, junto a la tele de tubo, que muestra a qué juegas |
| Jugado / Terminado | En la **estantería**, con el lomo hacia fuera (★ si lo has terminado) |
| Abandonado | En la **caja de cartón de ABANDONADOS** |

Coges una caja, la giras y **en la contraportada está tu reseña**, con tu nota y tus horas.

> Prototipo en desarrollo. Está en esta carpeta para no mezclarlo con retorika Home; cuando guste, se pasa a su propio repositorio.

## Arrancar

```bash
node disketeboy/server.mjs                      # http://localhost:5180
# con importación real de Steam (clave gratis en https://steamcommunity.com/dev/apikey):
STEAM_API_KEY=xxxx node disketeboy/server.mjs
```

| | URL |
|---|---|
| Con la colección de demo | http://localhost:5180/?demo=1 |
| Probar otra hora (día, tarde, noche) | añade `&hora=12`, `&hora=20` o `&hora=23` |
| Solo la consola, sin 3D | añade `&sin3d=1` |

En Netlify se sirve en `/disketeboy/`, con sus funciones en `netlify/functions/disketeboy-*.mjs`.

## Controles

- **Consola:** cruceta o flechas, **A** o Enter para aceptar, **B** o Escape para volver. **SELECT** baja la consola para ver la habitación y **START** vuelve al menú. También funciona con ratón, con el dedo y con lector de pantalla.
- **Habitación:**
  - Arrastra para mirar alrededor y usa la rueda o pellizca para acercarte.
  - Toca una caja para cogerla y vuelve a tocarla para darle la vuelta.
  - Con el teclado, ← y → recorren las cajas.

## Cómo está hecho

- Sin frameworks ni paso de compilación: HTML, CSS y módulos JS. Lo único de fuera es [three.js](https://threejs.org) (MIT), copiado en `vendor/three`.
- **Todo lo que se ve está hecho con código**: muebles con geometría simple y portadas, lomos, alfombra, cielo y ventana pintados en canvas. Nada de dibujos con IA ni assets ajenos. Las portadas reales de Steam son de sus autores.
- La habitación **solo se redibuja cuando algo se mueve**, para no gastar batería.
- La colección se guarda en el navegador (`localStorage`) y se valida al leerla. Se puede exportar e importar como copia de seguridad.

| Archivo | Qué hace |
|---|---|
| `js/device.js` | La consola: pantallas, cruceta, teclado |
| `js/room.js` | La habitación 3D, las animaciones y coger cajas |
| `js/layout.js` | Dónde va cada caja (funciones puras, con tests) |
| `js/covers.js` | Portadas, lomos y contraportadas en canvas |
| `js/store.js` | La colección guardada y validada |
| `js/ticket.js` | DisketePrinter: el ticket y la foto para compartir |
| `api/steam.mjs` | Lee tu biblioteca pública de Steam |
| `api/cover.mjs` | Plan B para las portadas de Steam (solo admite ids numéricos) |

Lo que se ha hecho cada noche está en [docs/DIARIO-NOCHE.md](docs/DIARIO-NOCHE.md).
