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
