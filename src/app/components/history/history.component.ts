import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CasinoService } from '../../services/casino.service';
import { Transaccion } from '../../models/casino.models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="tarjeta h-cont">
<<<<<<< HEAD
      <h2 class="titulo-juego">📋 Historial</h2>
=======
      <h2 class="titulo-juego">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
             style="vertical-align:-3px;margin-right:8px">
          <path d="M9 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 12h6"/><path d="M9 16h6"/>
        </svg>Historial</h2>
>>>>>>> upstream/main
      <p *ngIf="!cargando && tx.length === 0">Aún no hay movimientos. ¡Anda al lobby a jugar!</p>

      <table *ngIf="tx.length">
        <thead>
          <tr>
            <th>Fecha</th><th>Tipo</th><th>Juego</th>
            <th>Monto</th><th>Saldo después</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let t of tx" [class.gano]="esCredito(t)" [class.perdio]="esDebito(t)">
            <td>{{ formato(t.creada_en) }}</td>
            <td>{{ t.tipo }}</td>
            <td>{{ t.juego || '—' }}</td>
            <td>{{ esDebito(t) ? '-' : '+' }} $ {{ t.monto | number:'1.0-0' }}</td>
            <td>$ {{ t.saldo_post | number:'1.0-0' }}</td>
          </tr>
        </tbody>
      </table>

      <p *ngIf="error" class="error">{{ error }}</p>
    </section>
  `,
  styles: [`
    .h-cont { max-width: 920px; margin: 30px auto; }
    tr.gano td   { color: #aef0a8; }
    tr.perdio td { color: #ffb1b1; }
    td:first-child { font-size: 13px; color: #c8b988; }
  `]
})
export class HistoryComponent implements OnInit {
  tx: Transaccion[] = [];
  cargando = true;
  error = '';

  constructor(private casino: CasinoService) {}

  ngOnInit() {
    this.casino.historial(100).subscribe({
      next: (t) => { this.tx = t; this.cargando = false; },
      error: (e) => { this.cargando = false; this.error = e.error?.error || 'No se pudo cargar el historial'; }
    });
  }

  esCredito(t: Transaccion) { return t.tipo === 'premio' || t.tipo === 'deposito'; }
  esDebito(t: Transaccion)  { return t.tipo === 'apuesta' || t.tipo === 'retiro'; }

  formato(iso: string) {
    return new Date(iso).toLocaleString('es-CL', {
      dateStyle: 'short', timeStyle: 'short'
    });
  }
}
