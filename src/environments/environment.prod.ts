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
<<<<<<< HEAD
  apiBaseUrl: ''   // ruta relativa: /api/... y /health
=======
  apiBaseUrl: '',        // ruta relativa: /api/... y /health
  // Rutas relativas también para los microservicios: nginx enruta por prefijo
  // /api/bonos → bonos-service y /api/apuestas → apuestas-service.
  bonosBaseUrl: '',
  apuestasBaseUrl: '',
  estadisticasBaseUrl: ''
>>>>>>> upstream/main
};
