# Diario de la noche 🌙 — DisketeBoy

Lo que se ha ido haciendo mientras dormías, tanda por tanda.

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
