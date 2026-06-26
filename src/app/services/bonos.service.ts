/**
 * bonos.service.ts — Cliente del microservicio bonos-service.
 *
 * Apunta a environment.bonosBaseUrl:
 *   dev  → http://localhost:8004
 *   prod → '' (relativo; nginx enruta /api/bonos al servicio)
 *
 * El authInterceptor adjunta el JWT automáticamente, así que el mismo login
 * del casino-backend sirve para este servicio (BD y secreto compartidos).
 * Tras reclamar un bono se actualiza el saldo en AuthService (tap) para que
 * el header lo refleje al instante.
 */
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface Bono {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string;
  tipo: 'monto_fijo' | 'porcentaje';
  valor: number;
  un_solo_uso: boolean;
}

export interface BonoReclamado {
  id: number;
  codigo: string;
  nombre: string;
  monto_otorgado: number;
  reclamado_en: string;
}

@Injectable({ providedIn: 'root' })
export class BonosService {
  private readonly api = environment.bonosBaseUrl;

  constructor(private http: HttpClient, private auth: AuthService) {}

  listar() {
    return this.http.get<{ bonos: Bono[] }>(`${this.api}/api/bonos`);
  }

  misBonos() {
    return this.http.get<{ reclamados: BonoReclamado[] }>(`${this.api}/api/bonos/mis-bonos`);
  }

  reclamar(codigo: string, montoBase = 0) {
    return this.http
      .post<{ bono: string; monto_otorgado: number; saldo: number }>(
        `${this.api}/api/bonos/${codigo}/reclamar`,
        { monto_base: montoBase }
      )
      .pipe(tap((r) => this.auth.setSaldo(r.saldo)));
  }
}
