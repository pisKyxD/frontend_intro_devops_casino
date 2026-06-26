// ============================================================
// environment.prod.ts
// La app productiva habla con el backend a traves del reverse proxy
// que sirve Nginx en la misma instancia EC2 (location /api/).
// Por eso usamos ruta relativa: el navegador siempre llama al
// MISMO origen donde se descargo el HTML, evitando CORS y respetando
// la regla del Security Group (solo SG-frontend puede ver al backend).
// ============================================================
export const environment = {
  production: true,
  apiBaseUrl: '',
  bonosBaseUrl: '',
  apuestasBaseUrl: '',
  estadisticasBaseUrl: ''
};