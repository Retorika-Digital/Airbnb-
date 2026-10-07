// Enlaces de movilidad que funcionan SIN instalar ninguna app:
// - Uber: "universal link" de m.uber.com → abre la web de Uber en el
//   navegador con origen y destino ya puestos (si la app existe, la usa).
// - Teléfono de radio-taxi (tel:) — lo más universal para un turista.
// - Google Maps: rutas a pie / transporte público por URL, sin API key.

const ll = (p) => (typeof p === 'string' ? p : `${p.lat},${p.lng}`);

export function uberLink({ pickup, dropoff }) {
  const q = new URLSearchParams({ action: 'setPickup' });
  if (pickup) {
    q.set('pickup[latitude]', pickup.lat);
    q.set('pickup[longitude]', pickup.lng);
    if (pickup.name) q.set('pickup[nickname]', pickup.name);
    if (pickup.address) q.set('pickup[formatted_address]', pickup.address);
  } else {
    q.set('pickup', 'my_location');
  }
  if (dropoff) {
    q.set('dropoff[latitude]', dropoff.lat);
    q.set('dropoff[longitude]', dropoff.lng);
    if (dropoff.name) q.set('dropoff[nickname]', dropoff.name);
    if (dropoff.address) q.set('dropoff[formatted_address]', dropoff.address);
  }
  return `https://m.uber.com/ul/?${q}`;
}

export function directionsLink({ origin, destination, mode = 'walking', waypoints = [] }) {
  const q = new URLSearchParams({ api: '1', destination: ll(destination), travelmode: mode });
  if (origin) q.set('origin', ll(origin));
  if (waypoints.length) q.set('waypoints', waypoints.map(ll).join('|'));
  return `https://www.google.com/maps/dir/?${q}`;
}

export const telLink = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;

export const whatsappLink = (number, text = '') =>
  `https://wa.me/${String(number).replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
