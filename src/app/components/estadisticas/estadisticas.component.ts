/**
 * estadisticas.component.ts — Dashboard de estadísticas (consume estadisticas-service).
 *
 * Charts SVG hechos a mano (sin librerías): KPI cards, donut por tipo, barras de
 * top jugadores y línea de evolución de saldo. Entrada animada con GSAP. Sin emojis.
 */
import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { gsap } from 'gsap';
import {
  EstadisticasService, MisEstadisticas, EstadisticasGlobales, PorTipo
} from '../../services/estadisticas.service';

interface Segmento { tipo: string; total: number; pct: number; dash: number; offset: number; color: string; }
interface Barra { label: string; valor: number; pct: number; }

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="e-cont" #cont>
      <header class="e-head">
        <span class="e-eyebrow">Panel</span>
        <h2 class="e-titulo">Estadísticas</h2>
        <p class="e-sub">Tus métricas y el pulso de la plataforma, en vivo.</p>
      </header>

      <p *ngIf="error" class="error">{{ error }}</p>

      <ng-container *ngIf="mias as m">
        <!-- KPI cards -->
        <div class="kpis">
          <div class="kpi card-anim"><span class="k-lbl">Saldo actual</span><span class="k-val gold">$ {{ m.resumen.saldo_actual | number:'1.0-0' }}</span></div>
          <div class="kpi card-anim"><span class="k-lbl">Resultado neto</span><span class="k-val" [class.pos]="m.resumen.neto >= 0" [class.neg]="m.resumen.neto < 0">{{ m.resumen.neto >= 0 ? '+' : '' }}$ {{ m.resumen.neto | number:'1.0-0' }}</span></div>
          <div class="kpi card-anim"><span class="k-lbl">Total apostado</span><span class="k-val">$ {{ m.resumen.total_apostado | number:'1.0-0' }}</span></div>
          <div class="kpi card-anim"><span class="k-lbl">Total premios</span><span class="k-val">$ {{ m.resumen.total_premios | number:'1.0-0' }}</span></div>
          <div class="kpi card-anim"><span class="k-lbl">Apuestas</span><span class="k-val">{{ m.resumen.n_apuestas }}</span></div>
        </div>

        <div class="grid-2">
          <!-- Donut por tipo -->
          <div class="panel card-anim">
            <h3 class="p-titulo">Movimientos por tipo</h3>
            <div class="donut-wrap" *ngIf="segmentos.length">
              <svg viewBox="0 0 120 120" class="donut" role="img" aria-label="Distribución de movimientos por tipo">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="16"/>
                <circle *ngFor="let s of segmentos" cx="60" cy="60" r="50" fill="none"
                        [attr.stroke]="s.color" stroke-width="16" stroke-linecap="butt"
                        [attr.stroke-dasharray]="s.dash + ' ' + (circ - s.dash)"
                        [attr.stroke-dashoffset]="-s.offset"
                        transform="rotate(-90 60 60)"/>
                <text x="60" y="56" text-anchor="middle" class="d-num">{{ totalMovs }}</text>
                <text x="60" y="72" text-anchor="middle" class="d-lbl">movs</text>
              </svg>
              <ul class="leyenda">
                <li *ngFor="let s of segmentos">
                  <span class="punto" [style.background]="s.color"></span>
                  <span class="l-tipo">{{ traducir(s.tipo) }}</span>
                  <span class="l-pct">{{ s.pct | number:'1.0-0' }}%</span>
                  <span class="l-tot">$ {{ s.total | number:'1.0-0' }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Línea de saldo -->
          <div class="panel card-anim">
            <h3 class="p-titulo">Evolución de tu saldo</h3>
            <svg *ngIf="linePts" viewBox="0 0 600 200" class="linea" preserveAspectRatio="none"
                 role="img" aria-label="Evolución del saldo en el tiempo">
              <defs>
                <linearGradient id="areaG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="rgba(16,185,129,0.35)"/>
                  <stop offset="100%" stop-color="rgba(16,185,129,0)"/>
                </linearGradient>
              </defs>
              <path [attr.d]="areaPath" fill="url(#areaG)"/>
              <polyline [attr.points]="linePts" fill="none" stroke="#10b981" stroke-width="2.5" vector-effect="non-scaling-stroke"/>
            </svg>
            <p class="rango" *ngIf="mias">Mín $ {{ minSaldo | number:'1.0-0' }} · Máx $ {{ maxSaldo | number:'1.0-0' }}</p>
          </div>
        </div>
      </ng-container>

      <ng-container *ngIf="globales as g">
        <h3 class="seccion">Plataforma</h3>
        <div class="kpis">
          <div class="kpi card-anim"><span class="k-lbl">Usuarios</span><span class="k-val">{{ g.usuarios_total }}</span></div>
          <div class="kpi card-anim"><span class="k-lbl">Saldo en juego</span><span class="k-val gold">$ {{ g.saldo_total | number:'1.0-0' }}</span></div>
          <div class="kpi card-anim"><span class="k-lbl">GGR (casa)</span><span class="k-val" [class.pos]="g.ggr >= 0" [class.neg]="g.ggr < 0">{{ g.ggr >= 0 ? '+' : '' }}$ {{ g.ggr | number:'1.0-0' }}</span></div>
          <div class="kpi card-anim"><span class="k-lbl">Win rate apuestas</span><span class="k-val">{{ g.apuestas.win_rate }}%</span></div>
        </div>

        <div class="grid-2">
          <!-- Top jugadores -->
          <div class="panel card-anim">
            <h3 class="p-titulo">Top jugadores por saldo</h3>
            <div class="barras">
              <div class="barra" *ngFor="let b of barras">
                <span class="b-lbl">{{ b.label }}</span>
                <div class="b-track"><div class="b-fill" [style.width.%]="b.pct"></div></div>
                <span class="b-val">$ {{ b.valor | number:'1.0-0' }}</span>
              </div>
            </div>
          </div>

          <!-- Apuestas estado -->
          <div class="panel card-anim">
            <h3 class="p-titulo">Apuestas de la plataforma</h3>
            <div class="estado-grid">
              <div class="est"><span class="e-num">{{ g.apuestas.total }}</span><span class="e-lbl">Total</span></div>
              <div class="est"><span class="e-num pos">{{ g.apuestas.ganadas }}</span><span class="e-lbl">Ganadas</span></div>
              <div class="est"><span class="e-num neg">{{ g.apuestas.perdidas }}</span><span class="e-lbl">Perdidas</span></div>
              <div class="est"><span class="e-num">{{ g.apuestas.pendientes }}</span><span class="e-lbl">Pendientes</span></div>
            </div>
          </div>
        </div>
      </ng-container>
    </section>
  `,
  styles: [`
    .e-cont { max-width: 1040px; margin: 30px auto; padding: 0 16px; }
    .e-head { text-align: center; margin-bottom: 26px; }
    .e-eyebrow { display: inline-block; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;
      color: #4fd99b; background: rgba(16,185,129,0.12); border: 1px solid rgba(16,185,129,0.4);
      padding: 3px 12px; border-radius: 20px; }
    .e-titulo { font-family: 'Playfair Display', serif; font-size: 34px; margin: 12px 0 6px; color: #f0e6c8; }
    .e-sub { color: #8aa79c; font-size: 14px; }
    .seccion { font-family: 'Playfair Display', serif; color: #c8b988; font-size: 22px; margin: 34px 0 14px; }

    .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 16px; }
    .kpi { background: linear-gradient(165deg, rgba(20,40,32,0.5), rgba(8,16,12,0.55));
      border: 1px solid rgba(16,185,129,0.18); border-radius: 14px; padding: 16px 18px;
      display: flex; flex-direction: column; gap: 6px; }
    .k-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6a8a7a; }
    .k-val { font-size: 24px; font-weight: 800; color: #e8e0c8; font-variant-numeric: tabular-nums; }
    .k-val.gold { color: #d4af37; } .k-val.pos { color: #aef0a8; } .k-val.neg { color: #ffb1b1; }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 720px) { .grid-2 { grid-template-columns: 1fr; } }
    .panel { background: linear-gradient(165deg, rgba(20,40,32,0.45), rgba(8,16,12,0.5));
      border: 1px solid rgba(16,185,129,0.16); border-radius: 16px; padding: 18px 20px; }
    .p-titulo { font-family: 'Playfair Display', serif; color: #d4af37; font-size: 17px; margin: 0 0 16px; }

    .donut-wrap { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
    .donut { width: 150px; height: 150px; flex-shrink: 0; }
    .d-num { fill: #fff; font-size: 22px; font-weight: 800; font-family: 'Manrope', sans-serif; }
    .d-lbl { fill: #6a8a7a; font-size: 9px; text-transform: uppercase; letter-spacing: 1px; }
    .leyenda { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 150px; }
    .leyenda li { display: grid; grid-template-columns: 14px 1fr auto auto; align-items: center; gap: 8px; padding: 5px 0; font-size: 13px; }
    .punto { width: 11px; height: 11px; border-radius: 3px; }
    .l-tipo { color: #cfe3da; } .l-pct { color: #8aa79c; } .l-tot { color: #d4af37; font-variant-numeric: tabular-nums; }

    .linea { width: 100%; height: 200px; }
    .rango { text-align: center; color: #6a8a7a; font-size: 12px; margin: 8px 0 0; font-variant-numeric: tabular-nums; }

    .barras { display: flex; flex-direction: column; gap: 12px; }
    .barra { display: grid; grid-template-columns: 90px 1fr auto; align-items: center; gap: 10px; }
    .b-lbl { font-size: 13px; color: #cfe3da; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .b-track { background: rgba(255,255,255,0.06); border-radius: 6px; height: 14px; overflow: hidden; }
    .b-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #0d7a56, #d4af37); transition: width .6s ease; }
    .b-val { font-size: 12px; color: #d4af37; font-variant-numeric: tabular-nums; }

    .estado-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .est { background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px;
      padding: 16px; text-align: center; display: flex; flex-direction: column; gap: 4px; }
    .e-num { font-size: 28px; font-weight: 800; color: #e8e0c8; font-variant-numeric: tabular-nums; }
    .e-num.pos { color: #aef0a8; } .e-num.neg { color: #ffb1b1; }
    .e-lbl { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #6a8a7a; }
    .error { color: #ffb1b1; text-align: center; }
  `]
})
export class EstadisticasComponent implements OnInit, AfterViewInit {
  @ViewChild('cont') cont!: ElementRef<HTMLElement>;

  mias: MisEstadisticas | null = null;
  globales: EstadisticasGlobales | null = null;
  error = '';

  readonly circ = 2 * Math.PI * 50;  // circunferencia del donut (r=50)
  segmentos: Segmento[] = [];
  totalMovs = 0;
  barras: Barra[] = [];
  linePts = '';
  areaPath = '';
  minSaldo = 0;
  maxSaldo = 0;

  private readonly colores: Record<string, string> = {
    apuesta: '#ef6b6b', premio: '#10b981', deposito: '#d4af37',
    retiro: '#7aa2ff', ajuste: '#9aa0a6',
  };

  constructor(private svc: EstadisticasService) {}

  ngOnInit() {
    this.svc.mias().subscribe({
      next: (m) => { this.mias = m; this.construirDonut(m.por_tipo); this.construirLinea(m.linea_saldo); this.animar(); },
      error: (e) => (this.error = e.error?.detail || 'No se pudieron cargar tus estadísticas'),
    });
    this.svc.globales().subscribe({
      next: (g) => {
        this.globales = g;
        const max = Math.max(1, ...g.top_jugadores.map((t) => t.saldo));
        this.barras = g.top_jugadores.map((t) => ({ label: t.username, valor: t.saldo, pct: (t.saldo / max) * 100 }));
        this.animar();
      },
      error: () => {},
    });
  }

  ngAfterViewInit() { this.animar(); }

  traducir(tipo: string): string {
    return ({ apuesta: 'Apuestas', premio: 'Premios', deposito: 'Depósitos', retiro: 'Retiros', ajuste: 'Ajustes' } as Record<string, string>)[tipo] || tipo;
  }

  private construirDonut(porTipo: PorTipo[]) {
    this.totalMovs = porTipo.reduce((s, p) => s + p.count, 0);
    const totalMonto = porTipo.reduce((s, p) => s + p.total, 0) || 1;
    let offset = 0;
    this.segmentos = porTipo.map((p) => {
      const pct = (p.total / totalMonto) * 100;
      const dash = (p.total / totalMonto) * this.circ;
      const seg: Segmento = { tipo: p.tipo, total: p.total, pct, dash, offset, color: this.colores[p.tipo] || '#9aa0a6' };
      offset += dash;
      return seg;
    });
  }

  private construirLinea(puntos: { fecha: string; saldo_post: number }[]) {
    if (!puntos.length) return;
    const W = 600, H = 200, pad = 10;
    const vals = puntos.map((p) => p.saldo_post);
    this.minSaldo = Math.min(...vals);
    this.maxSaldo = Math.max(...vals);
    const span = this.maxSaldo - this.minSaldo || 1;
    const n = puntos.length;
    const xy = puntos.map((p, i) => {
      const x = n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad);
      const y = H - pad - ((p.saldo_post - this.minSaldo) / span) * (H - 2 * pad);
      return [x, y] as const;
    });
    this.linePts = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const first = xy[0], last = xy[xy.length - 1];
    this.areaPath = `M ${first[0].toFixed(1)},${(H - pad).toFixed(1)} `
      + xy.map(([x, y]) => `L ${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
      + ` L ${last[0].toFixed(1)},${(H - pad).toFixed(1)} Z`;
  }

  private animar() {
    const nodos = this.cont?.nativeElement.querySelectorAll('.card-anim');
    if (nodos?.length) {
      gsap.fromTo(nodos, { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: 'power2.out', overwrite: 'auto' });
    }
  }
}
