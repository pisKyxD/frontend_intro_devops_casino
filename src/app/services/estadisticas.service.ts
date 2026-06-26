/**
 * estadisticas.service.ts — Cliente del microservicio estadisticas-service (8006).
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface PorTipo { tipo: string; total: number; count: number; }
export interface PuntoSaldo { fecha: string; saldo_post: number; }
export interface TopJugador { username: string; saldo: number; }

export interface MisEstadisticas {
  resumen: {
    total_apostado: number; total_premios: number; total_depositos: number;
    neto: number; n_apuestas: number; saldo_actual: number;
  };
  por_tipo: PorTipo[];
  linea_saldo: PuntoSaldo[];
}

export interface EstadisticasGlobales {
  usuarios_total: number;
  saldo_total: number;
  ggr: number;
  por_tipo: PorTipo[];
  top_jugadores: TopJugador[];
  apuestas: { total: number; ganadas: number; perdidas: number; pendientes: number; win_rate: number; };
}

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private readonly api = environment.estadisticasBaseUrl;

  constructor(private http: HttpClient) {}

  mias() {
    return this.http.get<MisEstadisticas>(`${this.api}/api/estadisticas/mias`);
  }

  globales() {
    return this.http.get<EstadisticasGlobales>(`${this.api}/api/estadisticas/globales`);
  }
}
