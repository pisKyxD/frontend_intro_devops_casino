/**
 * environment.ts — Configuración para desarrollo local
 *
 * Este archivo se usa con `ng serve` (ng build --configuration development).
 * En producción Angular lo reemplaza por environment.prod.ts automáticamente
 * gracias a la sección "fileReplacements" de angular.json.
 *
 * apiBaseUrl apunta al backend Node corriendo localmente en el puerto 3000.
 * Ambos procesos deben estar corriendo en la misma máquina durante el desarrollo.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:3000',
  // Microservicios nuevos (FastAPI). En desarrollo el navegador los alcanza
  // por sus puertos publicados; cada servicio habilita CORS para localhost:4200.
  bonosBaseUrl: 'http://localhost:8004',
  apuestasBaseUrl: 'http://localhost:8005',
  estadisticasBaseUrl: 'http://localhost:8006'
};
