// Netlify Functions v2 usan la firma Request → Response: reutilizamos el handler.
export { default } from '../../api/airbnb.mjs';
export const config = { path: '/api/airbnb' };
