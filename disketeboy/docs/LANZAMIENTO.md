# Plan de lanzamiento de DisketeBoy 🚀

Cómo sacarlo a Reddit para que la gente lo use, lo comparta y done. Está ordenado por pasos: primero lo que hay que tener listo, luego el lanzamiento y después lo que viene.

## 1. Antes de publicar nada

**Imprescindible**
- [ ] **Dominio y despliegue.** Un dominio corto (`disketeboy.app` o similar). Netlify ya sirve la carpeta en `/disketeboy/`, pero para el lanzamiento queda mejor en la raíz de su propio dominio y en su propio repositorio.
- [ ] **Comprobar el nombre.** Que «DisketeBoy» esté libre como dominio y como marca (EUIPO y OEPM). La terminación *Boy* recuerda a Nintendo: el diseño ya es propio, pero si el nombre diera problemas, es mejor cambiarlo **antes** de lanzar que después.
- [ ] **Clave de Steam** en las variables de entorno de Netlify (`STEAM_API_KEY`, gratis en steamcommunity.com/dev/apikey). Sin ella, la importación ofrece la demo.
- [ ] **BoardGameGeek**: la importación ya está hecha, pero no la he podido probar contra la web real, porque desde aquí no hay acceso. Pruébala con tu usuario. Si BGG pide clave (en 2025 empezó a pedir que se registren las aplicaciones), pídela en su web y ponla en `BGG_TOKEN`, en Netlify.
- [ ] **Probar en móviles de verdad**: un iPhone (Safari) y un Android de gama media (Chrome). La mitad de Reddit entra desde el móvil.
- [ ] **Página de donaciones** (Ko-fi, Buy Me a Coffee o Patreon). El botón ya está hecho: pega el enlace en `js/config.js` (`DONATE_URL`) y aparece en Créditos y bajo el ticket. Mientras esté vacío, no sale nada.
- [x] **Vista previa del enlace**: `og.jpg` (1200×630, la estantería arcoíris con el gato y el logo, sin texto en ningún idioma) y sus etiquetas en `index.html`. Así, cada enlace compartido se ve bonito en Reddit, WhatsApp y Discord. **Al publicar**, cambia `og:image` por la dirección completa (`https://tu-dominio/og.jpg`): algunas webs no entienden la dirección corta.

- [x] **Versión en inglés**: sale sola con el navegador en inglés. Para enseñarla en un post, enlaza con `?lang=en`.

**Muy recomendable**
- [ ] **Estadísticas sin cookies** (Plausible o GoatCounter), para saber de qué subreddit viene la gente. Sin cookies no hace falta banner.
- [x] **Un texto corto de privacidad** en Ajustes → Privacidad: todo se guarda en tu navegador, Steam solo lee lo que tu perfil ya tiene público, y el enlace de visita no pasa por ningún servidor. Si añades estadísticas, cuéntalo también ahí.

## 2. Qué enseñar: el vídeo de 20 segundos

**Ya está grabado**: [`docs/video/disketeboy-en.mp4`](video/disketeboy-en.mp4) y [`disketeboy-es.mp4`](video/disketeboy-es.mp4) (25 s, 720p, menos de 3 MB). Súbelo directamente a Reddit como vídeo. Para r/boardgames hay otro: [`disketeboy-mesa-en.mp4`](video/disketeboy-mesa-en.mp4), con la importación de BoardGameGeek, la Kallax llenándose y la ruleta de «¿Qué jugamos esta noche?». Para r/CozyGamers hay un tercero: [`disketeboy-cozy-en.mp4`](video/disketeboy-cozy-en.mp4), de noche y lloviendo: entrada de cine en la habitación, se apaga la luz y cae un relámpago, corazones del gato, la ola del código Konami con su logro y «Mi resumen». Si cambias algo de la web, se vuelven a grabar con `node disketeboy/tools/video.mjs [mesa|cozy] [es]`.

En Reddit gana el vídeo corto y sin voz. Guion (el grabado lo sigue casi tal cual):
1. (0–3 s) Se mete el disquete en la consola: *clic*, pantalla verde.
2. (3–8 s) «Importar de Steam» y **lluvia de cajas** cayendo en la habitación.
3. (8–12 s) Las que nunca has abierto forman la **pila de la vergüenza**, con su cartel.
4. (12–16 s) «Ordenar habitación»: las cajas vuelan y forman el **arcoíris de la estantería**.
5. (16–20 s) Coges una caja, la giras y **detrás está tu reseña**.

**Imágenes que funcionan solas:**
- El ticket de la DisketePrinter («PENDIENTE DE PAGO: 7 JUEGOS»).
- El arcoíris de 800 juegos.
- La ruleta de «¿Qué jugamos esta noche?».
- La imagen vertical de «Mi resumen» (1080×1920), con tu personalidad de jugador: pensada para historias.
- La habitación a oscuras, con lluvia en la ventana y la tele encendida.

## 3. Dónde y cómo

**Orden de publicación.** Primero lugares pequeños para pulir con críticas reales; después, los grandes.

| Semana | Subreddit | Ángulo |
|---|---|---|
| 1 | r/threejs, r/webdev (Showoff Saturday), r/SideProject | «Hecho con three.js sin assets: todo procedural». Comentarios técnicos para pulir |
| 2 | r/patientgamers, r/gamecollecting | La pila de la vergüenza |
| 2 | r/CozyGamers | Noche de lluvia, la luz apagada y el gato (con el vídeo cozy) |
| 2 | r/Steam, r/pcgaming (revisa sus normas) | «Tu biblioteca de Steam, pero física» |
| 3 | r/boardgames (normas de autopromoción) | La Kallax y la ruleta de «¿Qué jugamos esta noche?» |
| 3 | r/EDH, r/PokemonTCG, r/OnePieceTCG… | Los mazos con su récord |
| 4 | r/InternetIsBeautiful | Cuando esté pulido del todo: es el grande |
| — | En español: r/spain, Mediavida, Forocoches (sección de juegos) | Con la versión en español tal cual |

**Títulos de ejemplo** (en inglés para los subreddits grandes). Los posts completos, listos para pegar, están en [POSTS.md](POSTS.md):
- *I made a free web app that turns your game collection into a cozy 3D room — unplayed games pile up on the floor*
- *My Steam backlog, but physical: a «pile of shame» that grows on my bedroom floor*
- *I built a free tool for board gamers: your games in a virtual Kallax + a roulette that picks tonight's game*

**Normas que más cuentan:**
- Lee las normas de autopromoción de cada subreddit: algunos solo la permiten ciertos días o piden que participes antes.
- Publica en primera persona, sin anuncios y diciendo que es gratis y que no pide registro.
- Mejor de martes a jueves, entre las 15:00 y las 17:00 hora española (mañana en EE. UU.).
- **Contesta a todos los comentarios durante las primeras 3 horas.** Es lo que más pesa para que el post suba.
- Pide feedback de verdad («¿qué le añadiríais?») y apunta las ideas en público.

**Bucles para que se comparta solo:**
- **«Compartir mi habitación»**: cada enlace que alguien pega en un comentario es un anuncio.
- **El ticket**: la gente lo sube como imagen.
- En el post, anima a los comentaristas: *«share your room link below!»*.
- **«Mi resumen»**: la imagen vertical se comparte en historias de Instagram, TikTok o WhatsApp, con el nombre de la web.
- **Los logros secretos** (el gato y el código Konami) dan para comentarios del tipo «¿lo habéis encontrado?». No los desveles en el post.

**Halloween**: del 15 de octubre al 2 de noviembre la habitación sale sola con calabaza y murciélagos. Si lanzas en esas fechas, dilo en el título o en la primera línea (*spooky season edition*). En Navidad pasa lo mismo, con nieve y luces.

## 4. Donaciones sin cobrar nada

- **Todo gratis y sin muros.** Las donaciones se agradecen, no se exigen.
- **Ventajas que se pueden lucir, sin quitar nada a nadie**:
  - Temas de habitación y una mascota (el gato).
  - Carcasas de colores para la DisketeBoy.
  - Tu nombre en los créditos.
  - Votar la siguiente función.
- **Transparencia**: «el servidor cuesta X € al mes, este mes vamos por el Y %».
- **El botón de donar, después del momento «¡qué chulo!»** (tras imprimir el ticket o compartir la habitación), nunca en una ventana al entrar.
- **Hacienda**: en España las donaciones tributan. Consúltalo con un gestor antes de que lleguen en serio.

## 5. Riesgos y cómo se han tenido en cuenta

| Riesgo | Qué se ha hecho |
|---|---|
| Rechazo al arte con IA | Todo lo visible está hecho con código. Se puede decir con orgullo en el post |
| Parecerse a Nintendo | Diseño de consola propio: carcasa crema, ranura de disquete, LED «PILA». Ni la forma ni el logo de Game Boy |
| Portadas de Steam | Se cargan desde Steam, como hacen otras webs de colecciones, y se citan en Créditos |
| Juegos de cartas y de mesa | Solo los nombres, para identificarlos; los dibujos son genéricos |
| Móviles lentos | Solo dibuja cuando algo se mueve, y para colecciones grandes hay lomos ligeros y 3 veces menos dibujado |
| Datos | Todo en el navegador, con copia de seguridad en JSON. Nada se pierde si no hay cuenta |

## 6. Lo siguiente (hoja de ruta)

1. **Cuentas opcionales y sincronizar** entre móvil y ordenador (Supabase), y enlaces de visita cortos.
2. **Importar mazos de Moxfield o Archidekt** (cartas). Ya están hechas la de BoardGameGeek y la del CSV de ManaBox para las carpetas.
3. **«Mi resumen» del año** en diciembre, con lo que has terminado ese año (el resumen de siempre ya está hecho).
4. **Escanear el código de barras** con la cámara para añadir juegos físicos.
5. **Mascota y temas** como ventajas para mecenas.
