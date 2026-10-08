# Diario de la noche 🌙

Qué se ha ido añadiendo mientras dormías, tanda por tanda.

## Tanda 1: "¿Tienes dudas?" de verdad
- **Buscador de respuestas dentro de la guía.** El botón "¿Tienes dudas?" ya no abre WhatsApp directamente: abre un pósit grande con un buscador.
  - Encuentra la respuesta en la propia guía al instante y sin conexión (WiFi, check-out, basura, maletas, normas, taxis…). Entiende español e inglés.
  - Si no la encuentra, ofrece escribir al anfitrión con la pregunta ya redactada.
- **El propietario ve lo que preguntan los huéspedes** en Analíticas. Las preguntas que la guía no supo responder aparecen en amarillo con el botón "Añadir a la guía".
- **Cuenta atrás en el ticket del tablón**: "Faltan 3 días ✈️", "Noche 2 de 3", "Hoy es tu check-out · antes de las 11:00"…
- **Pista de primera visita**: "Pellizca o toca aquí para ver todo tu tablón". Sale solo la primera vez.
- **Panel**: botón para cargar estadísticas de ejemplo, útil para enseñarlo en una demo.
- **Arreglos**:
  - El aviso flotante ya no asoma por el borde inferior.
  - El saludo ya no repite "bienvenida" dos veces.

## Tanda 2: ficha de cada sitio
- **Al tocar cualquier sitio** (Comer, Qué hacer, Cerca de mí, farmacias…) se abre su ficha: una polaroid grande, la **nota manuscrita del anfitrión pinchada en un pósit** ("Pide los huevos rotos" — Belén), un mini mapa de casa → sitio, la distancia a pie y los botones para ir andando, pedir un Uber o guardarlo en Mi viaje.
- El corazón se mantiene igual en todas partes: si guardas el sitio desde la ficha, también se marca en la lista.
- Se puede usar con teclado (Enter abre la ficha, Escape la cierra).

## Tanda 3: Mi viaje se puede reordenar
- **Mantén pulsada una polaroid y arrástrala** para cambiar el orden del viaje. Funciona con el dedo y con el ratón, y vibra al cogerla. El hilo rojo y la ruta del mapa siguen el nuevo orden.
- **Botón "Ordenar la ruta por cercanía"**: calcula un orden razonable empezando desde casa, para andar menos.

## Tanda 4: panel con fotos propias y recomendaciones más cuidadas
- **Subir fotos desde el móvil o el ordenador.** Se comprimen solas, se elige cuál es la portada (la polaroid del tablón) y se pueden quitar.
- **Foto del anfitrión**: aparece en Contacto en lugar de la inicial.
- **Recomendaciones**: se ordenan con flechas, se marcan como "favorito del anfitrión" (♥) y cada una lleva **tu nota para el huésped**, que luego sale en el pósit de la ficha del sitio.
- **Arreglos**:
  - Al reordenar, las notas se quedaban en la fila equivocada. Lo encontró la prueba automática y está corregido.
  - Al guardar, el editor ya no cierra las secciones que tenías abiertas.
  - Las recomendaciones automáticas ya no traen descripciones en inglés tipo "spanish".

## Tanda 5: el tablón sabe qué hora es
- **Nota "Ahora mismo"** al principio del tablón, con forma de ficha rayada. Cambia según la hora, el tiempo y el día de la estancia:
  - **Por la mañana**: desayuno cerca. **A mediodía**: dónde comer. **Por la tarde**: un plan, y si llueve uno a cubierto (un museo). **Por la noche**: dónde cenar y a cuántos minutos está. **De madrugada**: taxi a casa sin apps.
  - **El día de llegada** explica cómo entrar, y **el de salida** recuerda la lista del check-out.
  - Al tocarla se abre la ficha del sitio o la sección que toca.
- **Modo noche**: de 21:00 a 7:00 el corcho se queda en penumbra con luz cálida y aparece una **guirnalda de bombillas** que parpadean arriba del tablón.
- Para probarlo a cualquier hora: `?time=22` (hora simulada) y `?night=1` / `?night=0`.

## Tanda 6: accesibilidad (0 errores en la auditoría automática)
Pasé **axe-core** (el auditor estándar de accesibilidad) por 13 pantallas de la guía y del panel. Detectó 9 tipos de problema; ahora da **0**.
- **Contraste**: el fucsia de marca `#ff3a72` con texto blanco no llega al mínimo legal (AA), porque se queda en 3,4:1. Añadí un **fucsia "tinta" `#d81b52`** (5:1) solo para botones y textos pequeños. Chinchetas, corazones y adornos siguen con el fucsia original.
- **Grises** algo más oscuros en los textos secundarios.
- **Lectores de pantalla**:
  - Al abrir una sección, el foco va al título, así que se anuncia sola.
  - El QR del WiFi tiene descripción.
  - Los títulos van en orden correcto.
- **Teclado**: el nombre de cada sitio es un botón real que abre la ficha. Antes había botones dentro de botones.
- **Panel**: los iconos del menú en móvil tienen nombre, la sección activa se marca (`aria-current`) y todos los campos tienen su etiqueta.

## Tanda 7: guía imprimible / PDF
- **`print.html?guide=…`** es un cuaderno A4 de 4 páginas, listo para imprimir o guardar como PDF:
  1. **Portada** con la polaroid del piso, el nombre, la dirección y un QR a la guía del móvil.
  2. **WiFi** (con QR para conectarse), llegada y salida, la lista "antes de irte" para tachar, y la casa (normas, equipamiento, basura).
  3. **Dónde comer y qué hacer**: cada sitio lleva **su propio QR** para ver cómo llegar andando, y tu nota manuscrita.
  4. **Moverte** (metro, taxis, aeropuerto, la tarjeta "para el taxista") y **emergencias** con tu contacto.
- Se abre desde el panel con los botones **"Guía en PDF"** (editor) y **"Guía completa imprimible"** (Enviar al huésped).
- Lo he probado generando el PDF de verdad: salía una hoja en blanco por unos milímetros de más, así que compacté el formato de impresión y ahora son 4 páginas justas.

## Tanda 8: 5 idiomas
- La guía está ahora en **español, inglés, francés, italiano y alemán**. El botón de idioma abre un menú con banderas.
- **El idioma se elige solo según el móvil del huésped**: un alemán la ve directamente en alemán. Si falta alguna traducción, sale en inglés.
- Están traducidos también la nota "Ahora mismo", la cuenta atrás, las fechas y el tiempo.
- **"¿Tienes dudas?" entiende preguntas en los 5 idiomas** ("mot de passe wifi", "Wo ist die Apotheke?", "spazzatura"…).
- **Los textos de la guía también pueden ir en varios idiomas** (`{ es, en, fr… }`). La demo trae la frase de bienvenida en los 5, y el editor del panel edita el español sin borrar las traducciones.
- Siguiente paso natural, ya apuntado en CONCEPTO: **traducción automática con IA** al guardar la guía.

## Tanda 9: batería de tests automáticos (52 pruebas, todas en verde)
- **`npm test`**: 22 pruebas unitarias, sin navegador:
  - Cálculo de distancias y ranking de "mejor valorados".
  - Lectura del anuncio de Airbnb: formatos de hora AM/PM, avisos cuando falta un dato y **bloqueo de dominios que no son de Airbnb** (seguridad).
  - API de lugares con OpenStreetMap y con Google, comprobando que **la clave nunca se filtra**.
  - "¿Tienes dudas?" en varios idiomas, "Ahora mismo" a distintas horas y con lluvia, cuenta atrás, modo noche y enlaces de Uber, Maps, WhatsApp y teléfono.
- **`npm run test:e2e`**: 30 pruebas en un navegador real que recorren la web como lo haría una persona:
  - Huésped: tablón, levantar notas, zoom out, WiFi, check-out, Cerca de mí, guardar con ♥, Mi viaje (arrastrar y ordenar), taxi, dudas, emergencias, idiomas y modo noche.
  - Propietario: importar con error y con datos, crear la guía, editar viendo el móvil, reordenar notas, enviar al huésped, analíticas y PDF de 4 páginas.
  - **Accesibilidad sin violaciones** en 8 pantallas, y **ningún error de JavaScript**.
- La red externa se simula, así que las pruebas son estables y no dependen de internet.
- **CI en GitHub Actions** (`.github/workflows/test.yml`): las pruebas se ejecutan solas en cada push y guardan capturas de pantalla.
- Los tests me sirvieron para afinar dos cosas. Una: la nota "Ahora mismo" ya mostraba "¡Hoy llegas!" porque las fechas de prueba caían en el día de hoy; era el comportamiento correcto y lo que hubo que cambiar fue el test. Otra: el auditor de contraste daba falsos avisos si medía a mitad de una animación.

## Tanda 10: revisión final y un fallo importante encontrado por los tests
- **🐞 Fallo real corregido.** Al pasar de una sección a otra sin recargar, los clics se iban "duplicando". Después de visitar varias secciones, tocar ♥ guardaba y quitaba el sitio a la vez, así que parecía que no funcionaba. Ahora cada sección limpia lo suyo al cambiar. Añadí una **prueba de regresión** y comprobé que falla con el código antiguo y pasa con el nuevo.
- **Iconos 14 veces más ligeros**: en lugar de cargar la librería completa (355 KB), un script (`tools/build-icons.mjs`) genera un archivo solo con los iconos que se usan (25 KB). La guía carga antes con datos móviles.
- **Linter** (ESLint) pasado sobre todo el código: limpio, salvo un falso aviso de configuración.
- Tests: **22 unitarios + 31 en navegador, todos en verde**.
