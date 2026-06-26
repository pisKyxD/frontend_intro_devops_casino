/**
 * app.routes.ts — Definición de rutas con lazy loading
 *
 * loadComponent: en lugar de importar el componente directamente,
 * usamos una función que devuelve un import() dinámico. Angular genera
 * un chunk JS separado por componente y solo lo descarga cuando el
 * usuario navega a esa ruta. Esto reduce el bundle inicial.
 *
 * canActivate: [authGuard] — protege las rutas privadas. Si el usuario
 * no tiene sesión, authGuard lo redirige a /login.
 *
 * path: '**' — catch-all: cualquier ruta desconocida va al lobby.
 * Importante: Nginx también debe tener el "SPA fallback" configurado
 * (try_files $uri /index.html) para que el servidor no devuelva 404
 * cuando el usuario recarga la página directamente en /lobby o /slots.
 */
import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const rutas: Routes = [
  { path: '', redirectTo: 'lobby', pathMatch: 'full' },

  // Rutas públicas (sin sesión)
  { path: 'login',    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent) },

  // Rutas privadas (requieren JWT válido)
  { path: 'lobby',     canActivate: [authGuard], loadComponent: () => import('./components/lobby/lobby.component').then(m => m.LobbyComponent) },
  { path: 'slots',     canActivate: [authGuard], loadComponent: () => import('./components/slots/slots.component').then(m => m.SlotsComponent) },
  { path: 'roulette',  canActivate: [authGuard], loadComponent: () => import('./components/roulette/roulette.component').then(m => m.RouletteComponent) },
  { path: 'blackjack', canActivate: [authGuard], loadComponent: () => import('./components/blackjack/blackjack.component').then(m => m.BlackjackComponent) },
  { path: 'bonos',     canActivate: [authGuard], loadComponent: () => import('./components/bonos/bonos.component').then(m => m.BonosComponent) },
  { path: 'apuestas',  canActivate: [authGuard], loadComponent: () => import('./components/apuestas/apuestas.component').then(m => m.ApuestasComponent) },
  { path: 'profile',   canActivate: [authGuard], loadComponent: () => import('./components/profile/profile.component').then(m => m.ProfileComponent) },
  { path: 'history',   canActivate: [authGuard], loadComponent: () => import('./components/history/history.component').then(m => m.HistoryComponent) },
  { path: 'estadisticas', canActivate: [authGuard], loadComponent: () => import('./components/estadisticas/estadisticas.component').then(m => m.EstadisticasComponent) },

  { path: '**', redirectTo: 'lobby' }
];