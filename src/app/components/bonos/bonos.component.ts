/**
 * bonos.component.ts — Vista de Bonos (consume bonos-service).
 *
 * Lista el catálogo de bonos, permite reclamarlos y muestra los ya reclamados.
 * Los bonos por porcentaje piden un "monto base" sobre el cual calcular.
 */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BonosService, Bono, BonoReclamado } from '../../services/bonos.service';

@Component({
  selector: 'app-bonos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="tarjeta b-cont">
      <h2 class="titulo-juego">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             style="vertical-align:-3px;margin-right:8px">
          <rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/>
          <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>
          <path d="M12 8C12 8 11 3 8.5 3S5 6 12 8zM12 8s1-5 3.5-5S19 6 12 8z"/>
        </svg>Bonos y Promociones</h2>
      <p *ngIf="mensaje" class="ok">{{ mensaje }}</p>
      <p *ngIf="error" class="error">{{ error }}</p>

      <div class="grid">
        <div class="bono" *ngFor="let b of bonos">
          <div class="bono-cab">
            <h3>{{ b.nombre }}</h3>
            <span class="etq">{{ b.tipo === 'monto_fijo' ? '$ ' + (b.valor | number:'1.0-0') : (b.valor) + '%' }}</span>
          </div>
          <p class="desc">{{ b.descripcion }}</p>

          <div class="monto-base" *ngIf="b.tipo === 'porcentaje'">
            <label>Monto base</label>
            <input type="number" min="1" [(ngModel)]="montoBase[b.codigo]" placeholder="Ej: 10000" />
          </div>

          <button class="btn btn-primario" [disabled]="cargando" (click)="reclamar(b)">
            Reclamar
          </button>
        </div>
      </div>

      <h3 class="sub">Mis bonos reclamados</h3>
      <p *ngIf="reclamados.length === 0">Aún no has reclamado bonos.</p>
      <table *ngIf="reclamados.length">
        <thead><tr><th>Fecha</th><th>Bono</th><th>Monto otorgado</th></tr></thead>
        <tbody>
          <tr *ngFor="let r of reclamados">
            <td>{{ formato(r.reclamado_en) }}</td>
            <td>{{ r.nombre }}</td>
            <td>+ $ {{ r.monto_otorgado | number:'1.0-0' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  `,
  styles: [`
    .b-cont { max-width: 960px; margin: 30px auto; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
    .bono {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(212,175,55,0.22);
      border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 10px;
    }
    .bono-cab { display: flex; justify-content: space-between; align-items: center; }
    .bono-cab h3 { margin: 0; font-size: 15px; color: #e8e0c8; }
    .etq { font-size: 13px; font-weight: 700; color: #d4af37; }
    .desc { font-size: 13px; color: #9ab8b0; flex: 1; }
    .monto-base { display: flex; flex-direction: column; gap: 4px; }
    .monto-base label { font-size: 11px; color: #c8b988; }
    .monto-base input { padding: 6px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: #fff; }
    .sub { margin-top: 28px; color: #c8b988; font-size: 14px; }
    .ok { color: #aef0a8; }
  `]
})
export class BonosComponent implements OnInit {
  bonos: Bono[] = [];
  reclamados: BonoReclamado[] = [];
  montoBase: Record<string, number> = {};
  cargando = false;
  mensaje = '';
  error = '';

  constructor(private bonosSvc: BonosService) {}

  ngOnInit() {
    this.cargar();
  }

  cargar() {
    this.bonosSvc.listar().subscribe({
      next: (r) => (this.bonos = r.bonos),
      error: (e) => (this.error = e.error?.detail || 'No se pudo cargar el catálogo')
    });
    this.bonosSvc.misBonos().subscribe({
      next: (r) => (this.reclamados = r.reclamados),
      error: () => {}
    });
  }

  reclamar(b: Bono) {
    this.mensaje = '';
    this.error = '';
    this.cargando = true;
    const base = b.tipo === 'porcentaje' ? Number(this.montoBase[b.codigo] || 0) : 0;
    this.bonosSvc.reclamar(b.codigo, base).subscribe({
      next: (r) => {
        this.cargando = false;
        this.mensaje = `¡Bono "${b.nombre}" reclamado! +$${r.monto_otorgado.toLocaleString('es-CL')}`;
        this.cargar();
      },
      error: (e) => {
        this.cargando = false;
        this.error = e.error?.detail || 'No se pudo reclamar el bono';
      }
    });
  }

  formato(iso: string) {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  }
}
