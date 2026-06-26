/**
 * apuestas.service.ts — Cliente del microservicio apuestas-service.
 *
 * Apunta a environment.apuestasBaseUrl:
 *   dev  → http://localhost:8005
 *   prod → '' (relativo; nginx enruta /api/apuestas al servicio)
 *
 * El authInterceptor adjunta el JWT automáticamente. Tras apostar se actualiza
 * el saldo en AuthService (tap) para que el header lo refleje al instante.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type Seleccion = 'local' | 'empate' | 'visita';

export interface EventoDeportivo {
  id: number;
  deporte: string;
  liga: string | null;
  equipo_local: string;
  equipo_visita: string;
  badge_local: string | null;
  badge_visita: string | null;
  inicio: string | null;
  cuota_local: number;
  cuota_empate: number;
  cuota_visita: number;
  estado: string;
}

export interface Apuesta {
  id: number;
  seleccion: Seleccion;
  monto: number;
  cuota: number;
  ganancia_potencial: number;
  estado: 'pendiente' | 'ganada' | 'perdida';
  creada_en: string;
  resuelta_en: string | null;
  deporte: string;
  liga: string | null;
  equipo_local: string;
  equipo_visita: string;
  badge_local: string | null;
  badge_visita: string | null;
  resultado: Seleccion | null;
  goles_local: number | null;
  goles_visita: number | null;
}

/** Un gol en la crónica de la simulación. */
export interface Gol {
  minuto: number;
  equipo: 'local' | 'visita';
}

/** Respuesta del endpoint de simulación: alimenta la mini-cancha. */
export interface ResultadoSimulacion {
  evento_id: number;
  evento: {
    equipo_local: string;
    equipo_visita: string;
    badge_local: string | null;
    badge_visita: string | null;
    liga: string | null;
  };
  marcador: { local: number; visita: number };
  resultado: Seleccion;
  goles: Gol[];
  apuestas_ganadoras: number;
  apuestas_perdedoras: number;
}

@Injectable({ providedIn: 'root' })
export class ApuestasService {
  private readonly api = environment.apuestasBaseUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  eventos() {
    return this.http.get<{ eventos: EventoDeportivo[] }>(`${this.api}/api/apuestas/eventos`);
  }

  misApuestas() {
    return this.http.get<{ apuestas: Apuesta[] }>(`${this.api}/api/apuestas/mis-apuestas`);
  }

  apostar(eventoId: number, seleccion: Seleccion, monto: number) {
    return this.http
      .post<{ saldo: number; ganancia_potencial: number }>(`${this.api}/api/apuestas`, {
        evento_id: eventoId,
        seleccion,
        monto
      })
      .pipe(tap((r) => this.auth.setSaldo(r.saldo)));
  }

  /** Simula el partido (probabilístico) y liquida las apuestas del evento. */
  simular(eventoId: number) {
    return this.http.post<ResultadoSimulacion>(
      `${this.api}/api/apuestas/eventos/${eventoId}/simular`,
      {}
    );
  }

  /** Regenera la cartelera de partidos para poder seguir apostando. */
  reiniciar() {
    return this.http.post<{ sembrados: number; fuente: string }>(
      `${this.api}/api/apuestas/reiniciar`, {}
    );
  }
}
