/**
 * apuestas.component.ts — Vista de Apuestas Deportivas (consume apuestas-service).
 *
 * Lista eventos abiertos con escudos reales (thesportsdb) y cuotas 1X2. El
 * jugador elige selección + monto y apuesta; luego pulsa "Simular partido" para
 * ver la mini-cancha animada que decide el resultado y liquida las apuestas.
 * Sin emojis: escudos, glifos tipográficos y formas.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApuestasService, EventoDeportivo, Apuesta, Seleccion, ResultadoSimulacion
} from '../../services/apuestas.service';
import { CasinoService } from '../../services/casino.service';
import { MiniCanchaComponent } from '../mini-cancha/mini-cancha.component';

@Component({
  selector: 'app-apuestas',
  standalone: true,
  imports: [CommonModule, FormsModule, MiniCanchaComponent],
  template: `
    <section class="a-cont">
      <header class="a-head">
        <span class="a-eyebrow">En vivo</span>
        <h2 class="a-titulo">Apuestas Deportivas</h2>
        <p class="a-sub">Apuesta, simula el partido y mira la cancha decidir el resultado.</p>
        <button class="btn-reiniciar" [disabled]="reiniciando" (click)="reiniciar()"
                aria-label="Reiniciar cartelera de apuestas">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
          </svg>
          {{ reiniciando ? 'Reiniciando...' : 'Reiniciar cartelera' }}
        </button>
      </header>

      <p *ngIf="mensaje" class="ok">{{ mensaje }}</p>
      <p *ngIf="error" class="error">{{ error }}</p>

      <div class="grilla">
        <article class="evento" *ngFor="let e of eventos">
          <div class="liga">{{ e.liga || e.deporte }}</div>

          <div class="enfrentamiento">
            <div class="lado">
              <div class="escudo">
                <img *ngIf="e.badge_local" [src]="e.badge_local" alt="" />
                <span *ngIf="!e.badge_local" class="ini">{{ inicial(e.equipo_local) }}</span>
              </div>
              <span class="equipo">{{ e.equipo_local }}</span>
            </div>
            <span class="vs">VS</span>
            <div class="lado der">
              <div class="escudo">
                <img *ngIf="e.badge_visita" [src]="e.badge_visita" alt="" />
                <span *ngIf="!e.badge_visita" class="ini">{{ inicial(e.equipo_visita) }}</span>
              </div>
              <span class="equipo">{{ e.equipo_visita }}</span>
            </div>
          </div>

          <div class="cuotas">
            <button class="cuota" [class.sel]="sel[e.id] === 'local'" (click)="elegir(e.id, 'local')">
              <span class="et">Local</span><b>{{ e.cuota_local }}</b>
            </button>
            <button class="cuota" [class.sel]="sel[e.id] === 'empate'" (click)="elegir(e.id, 'empate')">
              <span class="et">Empate</span><b>{{ e.cuota_empate }}</b>
            </button>
            <button class="cuota" [class.sel]="sel[e.id] === 'visita'" (click)="elegir(e.id, 'visita')">
              <span class="et">Visita</span><b>{{ e.cuota_visita }}</b>
            </button>
          </div>

          <div class="acciones">
            <input type="number" inputmode="numeric" min="1" [(ngModel)]="monto[e.id]"
                   placeholder="Monto $" [attr.aria-label]="'Monto para ' + e.equipo_local + ' vs ' + e.equipo_visita" />
            <button class="btn apostar" [disabled]="cargando || !sel[e.id]" (click)="apostar(e)"
                    aria-label="Apostar">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 9V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/>
                <path d="M9 8v8"/>
              </svg>
              Apostar
            </button>
            <button class="btn simular" [disabled]="simulandoId === e.id" (click)="simular(e)"
                    aria-label="Simular partido">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z"/>
              </svg>
              {{ simulandoId === e.id ? 'Simulando...' : 'Simular partido' }}
            </button>
          </div>
        </article>
      </div>

      <div *ngIf="eventos.length === 0 && !error" class="sin-eventos">
        <p class="vacio">No hay partidos abiertos. Reinicia la cartelera para seguir apostando.</p>
        <button class="btn simular" [disabled]="reiniciando" (click)="reiniciar()">
          {{ reiniciando ? 'Reiniciando...' : 'Reiniciar cartelera' }}
        </button>
      </div>

      <h3 class="sub">Mis apuestas</h3>
      <p *ngIf="apuestas.length === 0" class="vacio">Aún no has realizado apuestas.</p>
      <div class="tabla-wrap" *ngIf="apuestas.length">
        <table>
          <thead>
            <tr><th>Partido</th><th>Selección</th><th>Monto</th><th>Cuota</th><th>Posible</th><th>Marcador</th><th>Estado</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let a of apuestas" [class.gano]="a.estado === 'ganada'" [class.perdio]="a.estado === 'perdida'">
              <td class="part">
                <img *ngIf="a.badge_local" [src]="a.badge_local" alt="" class="mini-badge" />
                {{ a.equipo_local }} <span class="x">v</span> {{ a.equipo_visita }}
                <img *ngIf="a.badge_visita" [src]="a.badge_visita" alt="" class="mini-badge" />
              </td>
              <td>{{ traducir(a.seleccion) }}</td>
              <td>$ {{ a.monto | number:'1.0-0' }}</td>
              <td>{{ a.cuota }}</td>
              <td>$ {{ a.ganancia_potencial | number:'1.0-0' }}</td>
              <td>{{ a.goles_local !== null ? a.goles_local + ' - ' + a.goles_visita : '—' }}</td>
              <td><span class="badge-estado" [class.gano]="a.estado === 'ganada'" [class.perdio]="a.estado === 'perdida'">{{ a.estado }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <app-mini-cancha
      *ngIf="simResultado"
      [data]="simResultado"
      [seleccionUsuario]="simSeleccion"
      (terminado)="onSimTerminado()"
    ></app-mini-cancha>
  `,
  styles: [`
    .a-cont { max-width: 980px; margin: 30px auto; padding: 0 16px; }
    .a-head { text-align: center; margin-bottom: 26px; }
    .a-eyebrow { display: inline-block; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;
      color: #0a3; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.4);
      padding: 3px 12px; border-radius: 20px; color: #4fd99b; }
    .a-titulo { font-size: 34px; margin: 12px 0 6px; color: #f0e6c8; letter-spacing: 1px;
      font-family: Georgia, 'Times New Roman', serif; }
    .a-sub { color: #8aa79c; font-size: 14px; }
    .btn-reiniciar { margin-top: 14px; display: inline-flex; align-items: center; gap: 7px;
      padding: 8px 18px; border-radius: 9px; cursor: pointer; font-weight: 700; font-size: 13px;
      background: rgba(212,175,55,0.12); color: #d4af37; border: 1px solid rgba(212,175,55,0.45);
      transition: filter .15s, transform .12s; }
    .btn-reiniciar:hover:not(:disabled) { filter: brightness(1.15); background: rgba(212,175,55,0.2); }
    .btn-reiniciar:active:not(:disabled) { transform: scale(0.97); }
    .btn-reiniciar:disabled { opacity: .5; cursor: not-allowed; }
    .btn-reiniciar:focus-visible { outline: 3px solid #d4af37; outline-offset: 2px; }
    .sin-eventos { display: flex; flex-direction: column; align-items: center; gap: 14px; padding: 24px 0; }

    .grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 16px; }
    .evento {
      position: relative; background: linear-gradient(165deg, rgba(20,40,32,0.6), rgba(8,16,12,0.6));
      border: 1px solid rgba(16,185,129,0.18); border-radius: 16px; padding: 16px 18px;
      transition: border-color .25s, transform .25s; overflow: hidden;
    }
    .evento::before { content: ''; position: absolute; inset: 0 0 auto 0; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(212,175,55,0.6), transparent); }
    .evento:hover { border-color: rgba(16,185,129,0.45); transform: translateY(-2px); }
    .liga { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: #6a8a7a; margin-bottom: 12px; }

    .enfrentamiento { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 10px; margin-bottom: 16px; }
    .lado { display: flex; flex-direction: column; align-items: center; gap: 8px; min-width: 0; }
    .escudo { width: 52px; height: 52px; border-radius: 12px; background: rgba(255,255,255,0.05);
      display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.08); }
    .escudo img { width: 42px; height: 42px; object-fit: contain; }
    .escudo .ini { font-size: 20px; font-weight: 800; color: #d4af37; }
    .equipo { font-size: 13px; color: #e8e0c8; text-align: center; font-weight: 600;
      max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .vs { font-size: 13px; font-weight: 800; color: #6a8a7a; letter-spacing: 1px; }

    .cuotas { display: flex; gap: 8px; margin-bottom: 12px; }
    .cuota { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
      padding: 9px 6px; border-radius: 10px; cursor: pointer; background: rgba(0,0,0,0.28);
      color: #9ab8b0; border: 1px solid rgba(255,255,255,0.1); transition: all .18s; }
    .cuota:hover { border-color: rgba(212,175,55,0.5); }
    .cuota .et { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .cuota b { color: #d4af37; font-size: 17px; }
    .cuota.sel { border-color: #10b981; background: rgba(16,185,129,0.14); color: #fff; box-shadow: 0 0 0 1px rgba(16,185,129,0.4) inset; }
    .cuota.sel b { color: #fff; }

    .acciones { display: flex; gap: 8px; }
    .acciones input { flex: 1; min-width: 0; padding: 9px 11px; border-radius: 9px;
      border: 1px solid rgba(255,255,255,0.14); background: rgba(0,0,0,0.3); color: #fff; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; min-height: 40px;
      border-radius: 9px; border: none; cursor: pointer; font-weight: 700; font-size: 13px;
      white-space: nowrap; transition: filter .15s, transform .12s; }
    .btn:disabled { opacity: .5; cursor: not-allowed; }
    .btn:hover:not(:disabled) { filter: brightness(1.1); }
    .btn:active:not(:disabled) { transform: scale(0.97); }
    .btn:focus-visible, .cuota:focus-visible { outline: 3px solid #d4af37; outline-offset: 2px; }
    .apostar { background: linear-gradient(135deg, #d4af37, #b8902a); color: #1a1207; }
    .simular { background: linear-gradient(135deg, #10b981, #059669); color: #fff; }

    .sub { margin: 34px 0 14px; color: #c8b988; font-size: 15px; letter-spacing: 1px; text-transform: uppercase; }
    .vacio { color: #6a8a7a; font-size: 13px; }
    .tabla-wrap { overflow-x: auto; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 10px 12px; color: #6a8a7a; font-size: 10px; letter-spacing: 1px;
      text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.08); }
    td { padding: 10px 12px; color: #cfe3da; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .part { display: flex; align-items: center; gap: 6px; }
    .mini-badge { width: 18px; height: 18px; object-fit: contain; }
    .x { color: #6a8a7a; }
    .badge-estado { font-size: 11px; padding: 2px 9px; border-radius: 20px; text-transform: capitalize;
      background: rgba(255,255,255,0.08); color: #cfe3da; }
    .badge-estado.gano { background: rgba(16,185,129,0.18); color: #aef0a8; }
    .badge-estado.perdio { background: rgba(255,90,90,0.15); color: #ffb1b1; }
    tr.gano td { color: #cdeccb; }
    tr.perdio td { color: #e8c4c4; }
    .ok { color: #aef0a8; text-align: center; }
    .error { color: #ffb1b1; text-align: center; }

    @media (max-width: 520px) { .grilla { grid-template-columns: 1fr; } }
  `]
})
export class ApuestasComponent implements OnInit {
  eventos: EventoDeportivo[] = [];
  apuestas: Apuesta[] = [];
  sel: Record<number, Seleccion> = {};
  monto: Record<number, number> = {};
  cargando = false;
  simulandoId: number | null = null;
  reiniciando = false;
  mensaje = '';
  error = '';

  simResultado: ResultadoSimulacion | null = null;
  simSeleccion: Seleccion | null = null;

  constructor(private apuestasSvc: ApuestasService, private casinoSvc: CasinoService) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.apuestasSvc.eventos().subscribe({
      next: (r) => (this.eventos = r.eventos),
      error: (e) => (this.error = e.error?.detail || 'No se pudieron cargar los eventos')
    });
    this.apuestasSvc.misApuestas().subscribe({
      next: (r) => (this.apuestas = r.apuestas),
      error: () => {}
    });
  }

  inicial(nombre: string): string {
    return (nombre || '?').trim().charAt(0).toUpperCase();
  }

  traducir(s: Seleccion): string {
    return { local: 'Local', empate: 'Empate', visita: 'Visita' }[s];
  }

  elegir(eventoId: number, seleccion: Seleccion) {
    this.sel[eventoId] = seleccion;
  }

  apostar(e: EventoDeportivo) {
    this.mensaje = '';
    this.error = '';
    const seleccion = this.sel[e.id];
    const monto = Number(this.monto[e.id] || 0);
    if (!seleccion || monto <= 0) {
      this.error = 'Elige una selección y un monto válido';
      return;
    }
    this.cargando = true;
    this.apuestasSvc.apostar(e.id, seleccion, monto).subscribe({
      next: (r) => {
        this.cargando = false;
        this.mensaje = `Apuesta registrada. Ganancia posible: $${r.ganancia_potencial.toLocaleString('es-CL')}`;
        this.cargar();
      },
      error: (err) => {
        this.cargando = false;
        this.error = err.error?.detail || 'No se pudo registrar la apuesta';
      }
    });
  }

  simular(e: EventoDeportivo) {
    this.mensaje = '';
    this.error = '';
    this.simulandoId = e.id;
    this.simSeleccion = this.sel[e.id] ?? null;
    this.apuestasSvc.simular(e.id).subscribe({
      next: (r) => {
        this.simulandoId = null;
        this.simResultado = r;   // abre la mini-cancha
      },
      error: (err) => {
        this.simulandoId = null;
        this.error = err.error?.detail || 'No se pudo simular el partido';
      }
    });
  }

  onSimTerminado() {
    this.simResultado = null;
    this.cargar();                         // refresca eventos + apuestas
    this.casinoSvc.miPerfil().subscribe(); // refresca saldo del header
  }

  reiniciar() {
    this.mensaje = '';
    this.error = '';
    this.reiniciando = true;
    this.apuestasSvc.reiniciar().subscribe({
      next: (r) => {
        this.reiniciando = false;
        this.mensaje = `Cartelera reiniciada: ${r.sembrados} partidos disponibles.`;
        this.cargar();
      },
      error: (err) => {
        this.reiniciando = false;
        this.error = err.error?.detail || 'No se pudo reiniciar la cartelera';
      }
    });
  }
}
