# Diario de la noche 🌙 — DisketeBoy

Lo que se ha ido haciendo mientras dormías, tanda por tanda.

> **Resumen rápido para el café ☕**
> - **Qué hay**: una consola propia (la DisketeBoy) con **3 disquetes**: videojuegos, juegos de mesa y cartas. Detrás, una **habitación 3D** donde cada juego acaba en su sitio: la pila de la vergüenza, la estantería, el escritorio, la caja de abandonados, la Kallax o las cajitas de mazo.
> - **Extras**: importar de Steam y de BoardGameGeek, el ticket de la DisketePrinter, el enlace «Visita mi habitación», la ruleta de «¿Qué jugamos esta noche?», 3 temas de habitación y un gato.
> - **Cómo verlo**: `node disketeboy/server.mjs` y abre http://localhost:5180/?demo=1. Las capturas están en el [README](../README.md), y el **vídeo para Reddit** en [`docs/video/`](video/).
> - **Idiomas**: español e inglés. Sale en el idioma del navegador y se cambia en Ajustes.
> - **Calidad**: 68 pruebas unitarias y 23 en navegador, todas verdes, y axe-core sin errores de accesibilidad.
> - **Lo que te toca a ti**: está en [LANZAMIENTO.md](LANZAMIENTO.md), en el apartado «Antes de publicar nada»: dominio, comprobar el nombre, clave de Steam y crear la página de Ko-fi. El botón de donar ya está hecho: solo hay que pegar el enlace en `js/config.js`.

## Tanda 1: la consola DisketeBoy

- **Diseño propio**, para no tener problemas con Nintendo:
  - Carcasa color crema de PC noventero y ranura de disquete arriba.
  - LED rojo con la palabra **«PILA»**, guiño a la pila de la vergüenza.
  - Botones A y B en verde azulado y mostaza, y el altavoz de puntitos.
- **Disquetes como módulos**: al meter el de **VIDEOJUEGOS** suena el clic y el disquete se queda asomando con su etiqueta escrita a mano. Los de juegos de mesa y cartas aparecen como «Próximamente».
- **Pantalla de 4 tonos** con 4 paletas: verde clásico, ámbar, hielo y gris.
- **Lo que se puede hacer desde la consola:**
  - Ver tu colección filtrando por estado.
  - Añadir juegos con plataforma, estado, nota y horas.
  - Escribir la reseña.
  - Ver la pila de la vergüenza con su cálculo: «A un juego al mes, la terminarías en … de …».
  - Estadísticas, ajustes y copia de seguridad.
  - Cargar la demo.
- **Se maneja de todas las formas:**
  - Cruceta en pantalla, flechas, Enter y Escape.
  - Ratón y dedo.
  - **Lector de pantalla**: la pantalla está hecha de botones y campos de verdad, no de un dibujo.
- **Sonidos chiptune generados con código.** Solo suenan después de que toques algo, como piden los navegadores.
- **Datos a prueba de fallos:**
  - Todo lo que entra se valida.
  - Los datos corruptos no rompen nada.
  - El texto de los usuarios nunca se interpreta como HTML.

## Tanda 2: la habitación 3D

- **Una habitación entera hecha con código**, sin un solo dibujo ajeno ni hecho con IA:
  - Suelo de madera, alfombra y paredes con textura.
  - Ventana con cortinas y una estantería con planta y libros.
  - Escritorio con **tele de tubo que pone «JUGANDO A …»** con lo que tengas en «Jugando».
  - Flexo y lámpara de techo.
  - Caja de cartón con **«ABANDONADOS»** escrito a rotulador.
  - **Pósteres de tus dos juegos mejor puntuados.**
- **Cada juego va a su sitio según su estado**: la pila de la vergüenza en el suelo, el escritorio, la estantería con el lomo hacia fuera o la caja de abandonados.
- **Cajas con el formato real de cada plataforma**, medidas en centímetros: DVD de PC y PS2, caja de CD de PS1, cartón de N64 y SNES, caja pequeña de Game Boy, Switch, Blu-ray… En la estantería se nota la variedad.
- **Portadas, lomos y contraportadas dibujados en canvas.** Cada juego tiene un diseño propio que sale de su título: sol retro, rayos, píxeles o franjas. Si es de Steam, se carga su portada real, y el lomo toma el color de la portada.
- **La hora real cuenta**:
  - **Día**: cielo azul con nubes.
  - **Atardecer**: cielo naranja.
  - **Noche**: luna, estrellas y la ciudad con ventanas encendidas.
  - Por la noche, el flexo y la lámpara dan una luz cálida.
  - Para probarlo a cualquier hora: `?hora=23`.
- **La estantería se va llenando sola**:
  - Primero la balda a la altura de los ojos, con un sujetalibros al final de la fila.
  - Las baldas libres tienen libros, una planta, un dado de 20 caras, un trofeo, una consolita o un robotito, que se retiran cuando hace falta sitio.
  - Al llenarse una estantería **se desbloquea otra** (hasta 5).
- **Solo se redibuja cuando algo se mueve**, así que con la habitación quieta no gasta batería.

## Tanda 3: las cajas cobran vida

- **Cada juego que añades cae del techo** a su sitio, rebota un poco y suena un «plof». Si importas muchos a la vez es una **lluvia de cajas**: cada una cae con un pequeño retraso y el sonido se modera para no saturar.
- **Coger una caja**: tócala, o recorre las cajas con ← → y pulsa Enter.
  - Vuela hacia ti, el fondo se oscurece y una luz te la ilumina.
  - Puedes **girarla con el dedo** o darle la vuelta con «Girar caja»: **en la contraportada está tu reseña**, con la nota en un círculo grande, tus horas, la fecha y un código de barras.
  - Mientras la tienes en la mano, ← → pasan a la caja siguiente, como si hojearas la estantería.
  - «Editar» sube la consola y te lleva a la ficha del juego.
- **Botón «Ordenar habitación»**: todas las cajas vuelan a la estantería, y al volver a pulsarlo regresan a su caos natural. Cuando cambias el estado de un juego, la caja viaja sola: si lo terminas, pasa del escritorio a la estantería.
- **Pasar el ratón** por una caja la ilumina y muestra su título.
- La consola bajada se aparta a una esquina en pantallas anchas para no tapar la pila.
- **Arreglos**:
  - La cámara se suavizaba según los fotogramas por segundo y en ordenadores lentos tardaba muchísimo en volver. Ahora va por tiempo real.
  - La consola bajada tapaba los botones de la caja que tenías en la mano.

## Tanda 4: Steam, DisketePrinter y compartir

- **Importar de Steam**:
  - Pegas tu perfil (URL, nombre o SteamID) y lee tu biblioteca pública con la API oficial.
  - Los juegos **que nunca has abierto van directos a la pila de la vergüenza**, los de las últimas 2 semanas al escritorio y el resto a la estantería, con sus horas.
  - Si un juego ya estaba, no se duplica.
  - Sin clave de Steam en el servidor, lo explica y ofrece la demo.
- **Portadas reales de Steam** con un plan B: si el navegador no puede leerlas, se piden a nuestra función `api/cover`. Esa función solo acepta ids numéricos y solo habla con Steam: no es un proxy abierto.
- **El lomo toma el color de la portada.** Para no bajar cientos de portadas, se usa la imagen pequeña de Steam (5 KB). Ese color sirve también para **ordenar la estantería por color**, el arcoíris de cajas.
- **DisketePrinter**: un **ticket de papel térmico** de 384 px de ancho, como las impresoras de 58 mm, que sale «imprimiéndose» con su sonido. Lleva:
  - Lo que más has jugado y cuántas cajas tienes por plataforma.
  - Totales y nota media.
  - **«PENDIENTE DE PAGO: 7 JUEGOS»**, y cuándo acabarías la pila a un juego al mes.
  - Se descarga o se comparte desde el móvil.
- **«Compartir»** hace una foto de tu habitación con un pie («26 juegos · 968 h jugadas · 7 en la pila de la vergüenza»), lista para Reddit o WhatsApp.
- **Arreglo**: si la fuente de terminal no había cargado, el texto del ticket se salía del papel. Ahora espera a la fuente y, si aun así no está, ajusta el tamaño al ancho.

## Tanda 5: pruebas automáticas y accesibilidad

- **32 pruebas unitarias**:
  - **Colección**: validación, datos corruptos, duplicados al importar, copia de seguridad, límites y colores.
  - **Reparto de cajas**: cada estado en su zona, que las cajas no se solapen en las baldas, que el resultado sea siempre el mismo, estanterías nuevas y ordenar por nota, color y horas.
  - **Steam**: formatos de perfil, sin clave, perfil privado, Steam caído, y que `api/cover` no se pueda usar de proxy.
  - **Ticket**: que todo quepa en 32 columnas.
- **15 pruebas en un navegador de verdad** (Chromium), con Steam y las fuentes simulados:
  - **Uso normal**:
    - Arrancar y meter el disquete.
    - Añadir un juego y que siga ahí al recargar.
    - Cambiar estado y nota con la cruceta y escribir la reseña.
    - Coger una caja con el teclado, girarla y soltarla.
    - Ordenar la habitación y deshacerlo.
  - **Steam y DisketePrinter**:
    - Importar de Steam sin duplicar.
    - Steam sin clave en el servidor.
    - El ticket de 384 px y la foto para compartir.
    - La copia de seguridad.
  - **A prueba de fallos**:
    - Título con HTML sin que se ejecute nada (XSS).
    - Datos corruptos sin romper la consola.
    - Funcionar sin 3D.
  - **Para todo el mundo**:
    - El móvil.
    - El modo de movimiento reducido.
- **Accesibilidad**: pasé **axe-core** por el menú, la lista, la ficha, el formulario, Steam, los ajustes, las estadísticas, la pila y la habitación. Encontró 2 problemas y ahora da **0**:
  - SELECT y START tenían poco contraste (4:1). Ahora pasan de 6:1.
  - La habitación no estaba dentro de ninguna zona de la página. Ahora todo va dentro de `<main>`.
- **CI propio** (`.github/workflows/disketeboy.yml`): solo se ejecuta cuando cambia algo de DisketeBoy y guarda las capturas como artefacto.
- **Arreglo**: con «movimiento reducido» activado en el sistema, las cajas ya no vuelan: se colocan en una décima de segundo y sin retrasos. Hay una prueba que lo comprueba.

## Tanda 6: «Visita mi habitación», el cartel de la pila y colecciones enormes

- **«Compartir mi habitación»** (en el menú): crea un enlace que lleva tu colección comprimida dentro, sin cuentas ni servidor.
  - Quien lo abre ve **tu habitación de visita**, con una franja: «👀 Estás de visita en la habitación de Laura · Crear la mía».
  - Puede mirarlo todo (coger cajas, leer tus reseñas, imprimir tu ticket), pero **no tocar nada**, y **su propia colección no se toca**. Hay una prueba que lo comprueba.
  - El enlace es corto: **la demo de 26 juegos, con reseñas, ocupa 1.362 caracteres**, y 300 juegos caben en menos de 8.000.
  - Los datos van tras la `#` del enlace, que nunca llega a ningún servidor.
  - En el móvil abre el menú de compartir del sistema y en el ordenador lo copia.
  - Tu nombre para las visitas se pone en Ajustes.
  - **Esto es lo que hace que la gente comparta en Reddit**: cada comentario con un enlace a una habitación es publicidad.
- **Cartel «PILA DE LA VERGÜENZA»** escrito a rotulador en un cartón clavado en un palito junto a la pila. Solo aparece si tienes algo pendiente.
- **Colecciones enormes (Steam con cientos de juegos)**:
  - Antes cada caja se dibujaba 6 veces, una por cara. Ahora **las de la estantería se dibujan de una vez**: el lomo lleva debajo una franja del color del plástico y los laterales usan esa franja.
  - Las cajas que enseñan portada usan 3 materiales, y al volver a la estantería sueltan la portada para ahorrar memoria.
  - Con más de 300 juegos, los lomos van a media resolución.
  - **Con 800 juegos: de 4.525 a 1.447 llamadas de dibujo** (3 veces menos) y ordenar la habitación pasa de 4,9 s a 2,4 s.
- 35 pruebas unitarias (antes 32) y 16 en navegador (antes 15).

## Tanda 7: el disquete azul de JUEGOS DE MESA

- **Segundo disquete**: al meterlo, la etiqueta pasa a **«JUEGOS DE MESA»** en azul. Los juegos de mesa viven en la misma colección que los videojuegos, pero cada disquete enseña lo suyo.
- **Una Kallax blanca de 4×2 en la pared derecha** (sí, la de IKEA de siempre, hecha con código):
  - Los juegos están **de pie como libros**, con el número de jugadores en el lomo («2-4») y ★ si es favorito.
  - Si está prestado, lleva un **pósit amarillo de «PRESTADO»**.
  - Los **sin estrenar van apilados encima, todavía con su plástico brillante** y una pegatina de «SIN ESTRENAR».
  - Lo que no cabe en los cubos se apila encima y luego en el suelo, al lado.
- **Portadas propias de juego de mesa**: marco clásico, título gordo, **meeples, dados o losetas hexagonales**, y abajo los jugadores y la duración. En la contraportada van tu reseña, las partidas jugadas y a quién se lo dejaste.
- **¿Qué jugamos esta noche?**:
  - Dices cuántos sois y cuánto tiempo tenéis, y salen los juegos que encajan y que están en casa: primero los favoritos, luego los sin estrenar («¡ya toca!») y después por nota.
  - Con **«¡Que elija la DisketeBoy!»** gira una **ruleta** que va frenando hasta pararse en uno.
  - Con «¡Sácalo de la Kallax!», **la caja sale volando hacia ti**.
- **«¡Hemos jugado!»** suma una partida. Si estaba sin estrenar, se estrena: el juego baja de encima de la Kallax a los cubos.
- **Préstamos**: «Prestado a Pedro» guarda la fecha, y la pantalla de préstamos te recuerda que **«Lo tiene Pedro desde hace 143 días»**.
- También tiene estadísticas (partidas, sin estrenar, el más jugado), la **demo con 15 juegos** (Catan, Carcassonne, Aventureros al Tren, Dixit, Virus!…) y entra en el enlace de visita.
- **Arreglos**:
  - Los títulos con una palabra muy larga («AVENTUREROS») se cortaban en la portada. Ahora la letra se ajusta a la palabra más larga.
  - El aviso flotante oculto asomaba como una mancha oscura bajo la habitación.
- **Pruebas**: 44 unitarias (antes 35), con el filtro de «¿Qué jugamos?», los préstamos, que los cubos de la Kallax no se desborden y el enlace con juegos de mesa. Y 17 en navegador (antes 16), con el recorrido completo del disquete azul y axe-core sin errores en sus 7 pantallas.

## Tanda 8: el disquete verde de CARTAS

- **Tercer disquete, «CARTAS»**, para cualquier juego de cartas: Magic, Pokémon, Yu-Gi-Oh!, One Piece, Lorcana, Flesh and Blood, Star Wars Unlimited, Riftbound, Digimon u otro. Solo se usan los nombres, sin logos ni arte.
- **Mazos**:
  - Cada mazo es una **cajita de mazo de pie delante de la tele de tubo**, con su etiqueta: nombre, formato y récord, por ejemplo **«23V · 11D (68%)»**. Los desmontados llevan un sello rojo de «DESMONTADO».
  - **«¡He ganado!» / «He perdido»** apuntan el resultado y llevan el porcentaje de victorias.
  - La **lista del mazo** («4 Lightning Bolt», «4x Rift Bolt», «Sol Ring»…) cuenta las cartas mientras escribes e ignora los comentarios y las cabeceras como «Sideboard:».
  - Estados: Montado, En construcción o Desmontado.
- **Carpetas**: tu colección en carpetas acolchadas, con placa, número de cartas y **valor estimado en euros**. Van **en los cubos de abajo de la Kallax, empezando por la derecha**, y no se mezclan con los juegos de mesa, que llenan desde arriba a la izquierda.
- **Estadísticas de cartas**: mazos, carpetas, cartas, valor total, récord total y **tu mejor mazo** (con al menos 3 partidas).
- La demo trae **5 mazos y 3 carpetas**, y el enlace de visita también los lleva (sin las listas, para que no sea eterno).
- **Pruebas**: 51 unitarias (antes 44), con el contador de cartas, el récord y que los mazos y las carpetas vayan a su sitio. Y 18 en navegador (antes 17), con el recorrido del disquete verde y axe-core sin errores en sus 8 pantallas.

## Tanda 9: capturas, colecciones exageradas y un fallo de verdad

- **Capturas para el README** en `docs/capturas/`: consola, habitación de día y de noche, contraportada, Kallax, ruleta, mazo, ticket, visita, móvil y **una estantería con 800 juegos ordenados por color**, como un arcoíris. Esa es la imagen para Reddit.
- **Fallo encontrado gracias a las capturas**: si se recolocaban las cajas mientras aún estaban cayendo, **se quedaban invisibles para siempre**, y la estantería salía vacía. Podía pasar de verdad: al importar de Steam llegan los colores de los lomos y, si ordenas por color, las cajas se recolocan en plena caída.
  - Arreglado: si una caja estaba esperando su turno para caer y le toca moverse, primero aparece.
  - Prueba de regresión: **sin el arreglo da 58 cajas invisibles, con el arreglo 0**. Lo comprobé quitando el arreglo a propósito.
- **Colecciones exageradas**:
  - El escritorio admite como mucho **12 juegos «jugando»** y la caja de abandonados **24**. El resto va a la estantería, en vez de levantar torres hasta el techo.
  - Las pilas de la vergüenza enormes **crecen en altura** en vez de invadir toda la habitación.
- **Pruebas**: 53 unitarias y 19 en navegador, todas verdes.

## Tanda 10: plan de lanzamiento, temas de habitación y un gato

- **Plan de lanzamiento** en [LANZAMIENTO.md](LANZAMIENTO.md):
  - Qué tener listo antes de publicar.
  - El guion del vídeo de 20 segundos.
  - Qué subreddits, en qué orden y con qué títulos.
  - Cómo pedir donaciones sin muros.
  - Riesgos y la hoja de ruta.
- **Temas de habitación** (Ajustes → Habitación):
  - **Crema**, el de siempre.
  - **Gamer RGB**: paredes moradas y una **tira LED** detrás de la tele que tiñe la pared de morado, rosa y cian.
  - **Retro 90**: pared verde menta y paredes salmón.
  - Las luces del tema Gamer se apagan del todo con los otros temas, para que no gasten.
- **Un gato** (Ajustes → Gato):
  - Es atigrado y duerme hecho un ovillo en la alfombra, con la cola rodeándolo y sus «zzz».
  - Si lo tocas, ronronea («Prrr… mejor no despertarlo»), con un maullido hecho con código.
  - **Se aparta solo** si la pila de la vergüenza crece hasta su sitio. Lo descubrí en la captura de 800 juegos, donde estaba tumbado encima de las cajas.
  - La primera versión parecía un pan con una raja, así que lo rehíce: rayas pintadas alrededor del lomo, orejas con el interior rosa, hocico blanco y nariz.
- **El tema y el gato viajan en el enlace de visita**: quien visita tu habitación la ve como la tienes tú. Al salir, vuelve a la suya. Los enlaces antiguos siguen funcionando.
- Los temas y el gato están pensados como **ventajas para mecenas** («cosas que se lucen, sin quitar nada a nadie»). De momento son gratis para todos.
- **Capturas nuevas**: tema Gamer, tema Retro y el gato de cerca. Las demás se han rehecho para que salga el gato.
- **Pruebas**: 56 unitarias (antes 53) y 20 en navegador (antes 19), todas verdes:
  - El tema y el gato se guardan, y un tema inventado se ignora.
  - Viajan en el enlace de visita sin pisar los tuyos.
  - Los botones de Ajustes encienden la tira LED y esconden al gato.

## Tanda 11: lista para publicar

- **Vista previa de los enlaces**: al pegar el enlace en Reddit, WhatsApp o Discord sale `og.jpg`, con la estantería arcoíris de 800 juegos, la pila, el gato y el logo de DisketeBoy.
  - La imagen no lleva texto en ningún idioma, así que sirve para la versión en español y para la inglesa.
  - Al publicar hay que poner su dirección completa en `index.html`. Está apuntado en la lista de lanzamiento.
- **Botón de donar, listo y escondido**:
  - Pegas tu enlace de Ko-fi (o similar) en `js/config.js` y aparece en dos sitios: en Créditos («☕ Invítame a un café») y bajo el ticket de la DisketePrinter, justo en el momento «¡qué chulo!».
  - Nunca sale en una ventana al entrar.
  - Solo acepta enlaces `https://`, y se abren aparte.
  - Mientras esté vacío, no sale nada.
- **Ajustes → Privacidad**: cinco frases claras.
  - Todo se guarda en tu navegador: sin cuentas, sin cookies y sin anuncios.
  - Steam solo lee lo que tu perfil ya enseña en público, y no se guarda.
  - Las portadas vienen de Steam.
  - El enlace de visita no pasa por ningún servidor.
  - Conviene guardar copias de seguridad.
- La descripción de la página ya habla también de juegos de mesa y cartas.
- **Pruebas**: 58 unitarias (antes 56) y 21 en navegador (antes 20):
  - El botón de donar no sale sin enlace.
  - Con enlace, sale en Créditos y bajo el ticket.
  - Un enlace que no es `https://` se ignora.
  - axe-core revisa también Privacidad y Créditos.

## Tanda 12: DisketeBoy en inglés

Los subreddits grandes del plan de lanzamiento son en inglés, así que tocaba.

- **Sale en el idioma del navegador**:
  - Español para quien lo tenga en español, catalán, gallego o euskera.
  - Inglés para todos los demás.
  - Se cambia en **Ajustes → Idioma**, y para probar basta con `?lang=en`.
- **Se traduce todo, no solo los menús**:
  - Los carteles de la habitación: «PILE OF SHAME», la caja «DROPPED» y la tele, que pone «NOW PLAYING».
  - Las pegatinas y lomos: «NEVER PLAYED», «LENT OUT» y «TAKEN APART».
  - Las contraportadas y el ticket, con la fecha a la americana y «BALANCE DUE: 7 GAMES».
  - Los textos para lector de pantalla y las etiquetas de los disquetes.
  - Hasta **las reseñas de la demo**: *«Margit beat me 43 times. I'll be back… someday.»*.
- **Cómo está hecho**, para que añadir idiomas sea fácil:
  - El código sigue en español y cada texto va dentro de `t('…')`.
  - El diccionario inglés (`js/lang/en.js`) traduce de español a inglés.
  - Si algún día falta una traducción, sale en español en vez de romperse.
- **Una prueba vigila el diccionario**: lee todo el código y el HTML y falla si un texto no tiene traducción, si sobra alguna o si una traducción pierde un hueco como `{name}`. Ahora mismo hay **más de 420 textos** y no falta ninguno.
- **Fallo evitado por el camino**: en dos fichas había una función que se llamaba igual que la de los números. La de las carpetas se habría roto al abrirla. Ahora se llaman distinto.
- **Pruebas**: 62 unitarias (antes 58) y 22 en navegador (antes 21):
  - Un navegador en inglés lo ve todo en inglés, con la demo traducida.
  - Se cambia a español desde Ajustes, y se recuerda.
  - axe-core revisa los Ajustes en inglés.

## Tanda 13: el vídeo para Reddit

- **Un vídeo de 25 segundos**, en inglés y en español (`docs/video/`, 720p, menos de 3 MB cada uno):
  1. En la consola: «Importar de Steam», se escribe el perfil y salen 109 juegos.
  2. **¡Lluvia de cajas!** La consola baja y las cajas caen en la habitación.
  3. La cámara va a la **pila de la vergüenza**, con su cartel y el gato.
  4. «Ordenar habitación»: todo vuela a la **estantería por colores**.
  5. Se coge Hollow Knight, se gira y, con un zoom, se lee **la reseña de detrás**.
  6. Cartel final: *DisketeBoy · Video games · Board games · Cards · Free, no sign-up*.
- En el README, arriba del todo, va un **GIF** de la versión en español.
- **Cómo está grabado**: el navegador de este entorno dibuja el 3D muy despacio, así que grabar la pantalla habría salido a tirones. En vez de eso, el reloj de la página es de mentira y solo avanza 1/30 de segundo entre foto y foto, incluidas las animaciones CSS de la consola. Salen 756 fotos perfectas que ffmpeg convierte en vídeo.
- La herramienta se queda en `tools/video.mjs`: si cambias la web, `node disketeboy/tools/video.mjs` (o `… es`) lo vuelve a grabar en unos 3 minutos.
- Los juegos de Steam del vídeo son de mentira (nombres conocidos, sin portadas), igual que en las pruebas. Las portadas que se ven están dibujadas con código.

## Tanda 14: importar de BoardGameGeek

Para r/boardgames es el gancho: casi todo el mundo tiene allí su colección apuntada.

- **Disquete azul → «Importar de BoardGameGeek»**: escribes tu usuario (o pegas la URL de tu colección) y se importa lo que tienes marcado como «Own», sin expansiones.
- **Cómo se colocan**:
  - Los jugadores y la duración vienen de BGG.
  - El **tamaño de la caja** se calcula por la duración: las partidas cortas van en caja pequeña y las de dos horas, en caja enorme.
  - Con un 9 o más de nota, el juego va a **favoritos**.
  - **Sin partidas → encima de la Kallax, aún con su plástico.** Pero solo si apuntas partidas en BGG: si no apuntas ninguna, no se da nada por «sin estrenar».
- **No duplica**: cada juego guarda su id de BGG. Además, un juego de mesa con el mismo título ya no entra dos veces aunque tenga otro tamaño de caja.
- **El servidor** (`api/bgg.mjs`, también como función de Netlify):
  - BGG tarda en preparar una colección la primera vez y responde «202, vuelve luego»; se reintenta solo 3 veces.
  - Si BGG pide clave (`BGG_TOKEN`), si el usuario no existe o si está saturado, la consola lo explica en tu idioma.
- **Ojo**: desde este entorno no se puede llegar a boardgamegeek.com, así que está probado con respuestas simuladas, no con la web real. Está apuntado en la lista de lanzamiento para probarlo con tu usuario.
- **Pruebas**: 68 unitarias (antes 62) y 23 en navegador (antes 22):
  - Leer el XML de BGG, con entidades, notas «N/A» y errores.
  - Los reintentos del 202 y la clave.
  - Cómo se colocan los juegos y que no se dupliquen.
  - El recorrido completo, simulado, con axe-core en la pantalla nueva.
