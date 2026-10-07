# retorika Home: el concepto a fondo

> **Tu estancia. Todo en un clic.**
> Una guía digital del alojamiento que no parece un PDF ni un listado. Parece el tablón de corcho donde un viajero va pinchando su viaje.

---

## 1. La idea central: "explora tu viaje como en un tablón"

Las guías de bienvenida que hay en el mercado (Touch Stay, Hostfully, Enso...) son listas de apartados muy correctas y bastante frías. Nosotros proponemos otra cosa:

1. **El anfitrión deja un tablón montado**: notas adhesivas con la información de la casa, una polaroid del piso, el ticket con las fechas de la estancia y una postal con el tiempo de hoy.
2. **El huésped lo hace suyo**: cada sitio que le gusta (♥) **sale volando y se pincha en "Mi viaje"**, su propio tablón personal. Ahí un **hilo rojo** une los sitios en orden, como en los tablones de viaje (o de detective), y lo puede repartir por días.

La metáfora no es solo decoración, porque también organiza cómo se usa la guía:

| Gesto en un corcho real | En la app |
|---|---|
| Ver todo el tablón de un vistazo | Tablón inicial: cada nota enseña un dato útil (WiFi, "Desde las 15:00", "5 planes"…) |
| Seguir el camino de la información | Un **camino punteado** une las notas en orden de uso |
| Despegar una nota para leerla | **La nota se levanta** (sube, se endereza, la chincheta salta) y se **expande** hasta convertirse en la hoja de detalle |
| Alejarse para ver todo | **Pellizcar o botón 🔍 → vista general** con "Estás aquí ↓"; tocas una nota y el tablón te lleva a ella |
| Pinchar tus propias cosas | ♥ en cualquier sitio = **chincheta en Mi viaje**, con su número y el hilo rojo |
| Escribir un pósit | Notas libres del huésped ("Comprar turrón para mamá") |
| Las cosas se mueven un poco | De vez en cuando una nota **se balancea**, como si hubiera corriente |

### Identidad visual
- **Paleta Retorika**: Azul `#156fe7`, Azul oscuro `#105cb1`, Blanco, Fucsia y Verde `#03d26e`.
  - ⚠️ El fucsia viene escrito como `#ff3aa72`, con 7 dígitos, así que no es válido. He usado **`#ff3a72`**, que es el que coincide con la muestra de color de la imagen. Si el bueno es `#ff3aa7`, se cambia en una sola línea (`--fucsia` en `assets/css/base.css`).
- **Notas**: versiones "papel" pastel de esa paleta, más amarillo pósit y kraft.
- **Chinchetas** con brillo y sombra de aguja, en los colores de marca. Las mismas chinchetas sirven de **marcadores del mapa**.
- **Tipografías**: *Caveat* para lo manuscrito (títulos de notas, polaroids) y *Nunito* para el texto de interfaz, que es redondeada y amable.
- **El corcho está hecho con CSS y ruido SVG**, sin imágenes, así que pesa muy poco y se ve nítido en cualquier pantalla.
- **Se respeta `prefers-reduced-motion`**: si el móvil tiene reducidas las animaciones, la guía funciona sin ellas.

---

## 2. Recorrido del huésped

1. Recibe un **WhatsApp del anfitrión** con su enlace personalizado (`?g=Laura&in=…&out=…`). También puede escanear el **cartel QR** del piso.
2. **Tablón**: "¡Hola, Laura! 👋", la polaroid del piso, el ticket "8 oct → 11 oct · 3 noches", la postal con el tiempo y las 10 notas.
3. **Las secciones** (cada una es una nota):

| Sección | Qué tiene | Extra |
|---|---|---|
| **La casa** | Cómo funciona, normas, equipamiento, basura, manual | Botón **"Tengo un problema"**, que abre un WhatsApp ya redactado |
| **WiFi** | Red y contraseña grandes, botón de copiar | **QR que conecta el móvil solo** (formato estándar `WIFI:`) |
| **Check-in / out** | Horarios, portal, llaves, equipaje | **Checklist interactivo** para la salida y recordatorio `.ics` en el calendario |
| **Cerca de mí** | Mapa con chinchetas y lista: súper, farmacias, cafés, metro, parking | Datos **en vivo** según la ubicación; las farmacias 24 h aparecen primero |
| **Comer / Qué hacer** | Los favoritos del anfitrión, con foto y distancia a pie | Filtro **"Mejor valorados cerca"**, automático; ♥ para guardar |
| **Moverme** | Taxi sin apps, estaciones, aeropuerto, BiciMAD | Ver §4 |
| **Emergencias** | 112, 091, 092, bomberos y ambulancias en un toque | Hospital más cercano y farmacia de guardia en vivo |
| **Contacto** | WhatsApp, llamada, email, horario de respuesta | |
| **Mi viaje** | Tablón personal con polaroids numeradas, hilo rojo, días y notas | Mapa con la ruta, **"Abrir ruta en Google Maps"** con paradas, compartir |

4. **ES/EN** con un toque: la interfaz se traduce y el idioma se recuerda.
5. **Funciona sin datos móviles**: un *service worker* guarda la app y la guía, pensado para turistas en roaming.

---

## 3. Recorrido del propietario: "pega tu enlace y listo"

**Panel → Conectar anuncio:**

1. **Pega el enlace de Airbnb** y el servidor lee el anuncio público. Mientras tanto, a la derecha, **el tablón se va montando en directo**: cada dato que encuentra se pincha como una nota. Saca:
   - título, tipo y ciudad (de `og:title`, p. ej. "Apartamento en Madrid · ★4,87 · …")
   - coordenadas, fotos (`muscache.com`), anfitrión, horas de llegada y salida, comodidades y nº de huéspedes
   - lo que no encuentra queda marcado en amarillo como **"Complétalo tú"**
2. **Confirmar la ubicación exacta**: Airbnb desplaza las coordenadas públicas por privacidad, así que el panel pide la dirección (geocodificación) o que el propietario **arrastre la chincheta** hasta su portal.
3. **Recomendaciones automáticas** alrededor de esa ubicación:
   - **Restaurantes y cafeterías mejor valorados**, ordenados con una **media bayesiana** (rating + nº de reseñas) y una ligera penalización por distancia. Así un 4,9 con 8 reseñas no le gana a un 4,6 con 3.000.
   - **Qué ver** (museos, monumentos, miradores).
   - **Metro y tren** más cercanos, que se convierten en "Estaciones cercanas".
   - **Hospital** más cercano.
   - Farmacias y supermercados no se guardan: se consultan **en vivo** cuando el huésped abre "Cerca de mí", así nunca quedan desactualizados.
   - El propietario marca lo que quiere "chinchetar". Los primeros ya vienen preseleccionados.
4. **Lo que Airbnb no sabe**: WiFi, códigos de acceso, llaves y WhatsApp.
5. **Crear guía**. Después:
   - **Editor** con **vista previa en un móvil** que se actualiza al guardar.
   - **Enviar al huésped**: nombre y fechas, y se generan el enlace, el mensaje de WhatsApp y el QR.
   - **Cartel QR imprimible** con estética de pósit para la entrada o la nevera.
   - **Analíticas**: aperturas, secciones más vistas, sitios guardados y contactos. Si "WiFi" es lo más consultado, igual hay que ponerlo más visible en el piso.

---

## 4. Taxis sin descargar ninguna app

Lo investigado y lo implementado:

| Opción | Cómo | Sin app | Estado |
|---|---|---|---|
| **Uber web** | Enlace universal `m.uber.com/ul/?action=setPickup&pickup[…]&dropoff[…]`. Abre la **web** de Uber con origen y destino rellenos; si la app está instalada, usa la app | ✅ (pide iniciar sesión en la web) | **Implementado** |
| **Radio-taxi por teléfono** | Enlaces `tel:` (Radio Taxi Madrid, Tele Taxi, Radio-Teléfono Taxi) | ✅ | **Implementado** (los números se editan en el panel; ⚠️ verificarlos antes de publicar) |
| **"Enséñale esto al taxista"** | Tarjeta con la dirección de destino en letras grandes. Cuando el huésped no habla español, funciona siempre | ✅ | **Implementado** |
| **Transporte público** | Google Maps por URL (`/maps/dir/?api=1&travelmode=transit`), sin API key | ✅ | **Implementado** |
| **Cabify / FreeNow** | No tienen un enlace web público fiable para pedir sin app. Cabify ofrece API a empresas | ❌ hoy | Futuro: acuerdo B2B |
| **Pedir taxi dentro de la guía** | Integración con una API de flota (p. ej. la de las cooperativas de radio-taxi o un agregador) | ✅ | Futuro, con acuerdo comercial |

El selector de destino incluye **"Volver a casa"**, que pone la dirección del piso como destino y la ubicación actual como recogida. Es justo lo que necesita un turista a las 2 de la mañana.

> Las tarifas de aeropuerto cambian, así que la guía dice "consulta el importe vigente" en vez de poner un precio fijo que se quede viejo.

---

## 5. Arquitectura técnica (prototipo)

```
index.html                 Guía del huésped (SPA, rutas #/ y #/s/<sección>)
panel.html                 Panel del propietario (#/, #/nuevo, #/editar/<id>, #/huesped/<id>, #/analiticas)
assets/css/                base (marca, chinchetas, cinta) · guide (corcho, notas) · panel
assets/js/
  app.js                   arranque + router de la guía
  board.js                 tablón: camino punteado, vista general, pellizco, "levantar nota"
  sections.js              las 10 secciones (render + montaje)
  places-config.js         categorías → OpenStreetMap / Google (compartido con el servidor)
  places.js                lugares cercanos, geocodificación, tiempo
  mobility.js              Uber, Google Maps, tel:, WhatsApp
  map.js                   Leaflet con marcadores-chincheta e hilo rojo
  store.js                 guías, "Mi viaje" y estadísticas (localStorage en el prototipo)
  panel.js                 panel completo
api/airbnb.mjs             importador del anuncio (Request → Response)
api/places.mjs             proxy de lugares: Google Places si hay clave, si no OpenStreetMap
server.mjs                 servidor local sin dependencias
netlify/                   las mismas funciones como serverless
data/guides/granvia.json   guía de demostración
sw.js                      modo sin conexión
```

**Decisiones:**
- **Sin build ni frameworks**: HTML, CSS y JS modernos con módulos. Cualquier hosting estático lo sirve. Las librerías (Leaflet, Lucide, qrcode-generator) están **dentro del repo**, sin depender de CDNs.
- **Proveedores intercambiables**:
  - Sin servidor, la guía consulta OpenStreetMap directamente desde el navegador, gratis.
  - Con servidor y `GOOGLE_PLACES_KEY`, usa Google Places con valoraciones. La clave nunca llega al navegador.
- **Datos abiertos y gratuitos** por defecto: OpenStreetMap (Overpass y Nominatim), Open-Meteo para el tiempo y mapas CARTO.

### Importar desde Airbnb: aspectos legales y técnicos
- **Airbnb no tiene API pública** para leer anuncios. El importador lee el HTML público del anuncio **del propio propietario, a petición suya y una sola vez**. No rastrea de forma masiva ni periódica.
- Aun así, **hay que revisar los Términos de Airbnb antes de lanzarlo**. Sus selectores cambian, así que el importador es "best effort" y el panel siempre deja completar a mano.
- **Alternativa sólida para escalar**: integrarse con *channel managers* que sí tienen API oficial con Airbnb (Hostaway, Smoobu, Lodgify, Guesty). Con eso se importarían también **las reservas**: nombre del huésped y fechas, para enviar la guía automáticamente X días antes de la llegada.
- El servidor solo acepta dominios de Airbnb, para que no se pueda usar como proxy hacia cualquier sitio (SSRF).

---

## 6. Hoja de ruta propuesta

**Fase 1 · MVP real (lo que falta para tener clientes)**
- Base de datos y cuentas: Supabase (Postgres + Auth + Storage). Las tablas serían `guides`, `bookings`, `events`, `trips` y `recommendations`.
- Subir fotos propias, ahora mismo se usan URLs.
- Analíticas en el servidor, que sustituyan a las del navegador.
- Dominio y enlaces cortos (`home.retorika.es/granvia`).
- Pasar la guía y el panel por una auditoría de accesibilidad.

**Fase 2 · Diferenciales**
- **Asistente "¿Tienes dudas?" con IA**: responde al huésped usando la información de la guía, 24/7, y solo pasa a WhatsApp lo que no sabe. Es la forma más directa de cumplir "menos mensajes, más tiempo".
- **Traducción automática** de la guía a los idiomas del huésped (EN/FR/DE/IT/PT) al guardar.
- **Mi viaje compartido** entre los acompañantes del grupo, con un enlace de tablón colaborativo.
- **Sugerencias según el momento**: según la hora y el tiempo (si llueve, planes de interior; a las 21:00, cenas cerca).
- **Ofertas de negocios locales** (Promociones en el panel): comisiones o acuerdos con restaurantes recomendados.

**Fase 3 · Escala**
- Integración con channel managers (reservas automáticas).
- Plantillas por ciudad: transporte, emergencias y aeropuerto rellenados solos.
- Marca blanca para gestoras con muchos pisos.

---

## 7. Modelo de negocio (idea)
- **Gratis**: 1 alojamiento, con marca retorika Home.
- **Pro**: alojamientos ilimitados, IA, traducciones, analíticas y sin marca. Una cuota mensual por alojamiento.
- **Gestoras**: marca blanca + integración con su channel manager.
- **Ingresos extra**: afiliación (Uber, actividades, restaurantes) y partners locales.
