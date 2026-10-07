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
