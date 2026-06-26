/**
 * mini-cancha.component.ts — Simulación de fútbol (Phaser para loop+render, IA propia).
 *
 * Reproduce el ResultadoSimulacion (marcador + minutos del backend) como un
 * partido. Para evitar los glitches de la física Arcade, el movimiento es propio:
 * steering proporcional con frenado (llegada suave, sin saltos ni jitter), balón
 * que sigue al poseedor por interpolación y, suelto, integra con fricción.
 * Cada jugador tiene su objetivo individual (su zona sesgada hacia el balón) →
 * movimiento en X e Y, no en bloque. Al pitazo, todo se congela.
 */
import {
  AfterViewInit, ChangeDetectorRef, Component, ElementRef, EventEmitter, Input,
  NgZone, OnDestroy, Output, ViewChild, inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import Phaser from 'phaser';
import { ResultadoSimulacion, Seleccion } from '../../services/apuestas.service';

type Equipo = 'local' | 'visita';
interface Jug { team: Equipo; x: number; y: number; vx: number; vy: number; hx: number; hy: number; gk: boolean; arc: Phaser.GameObjects.Arc; }

const DURACION = 30;
const COL_LOCAL = 0x33a1e0, GLOW_LOCAL = 0x8fd6ff;
const COL_VISITA = 0xe5982b, GLOW_VISITA = 0xffd591;

class PartidoScene extends Phaser.Scene {
  private sim: ResultadoSimulacion;
  private onEnd: () => void;

  private W = 0; private H = 0; private pr = 8; private br = 6;
  private jugs: Jug[] = [];
  private ball = { x: 0, y: 0, vx: 0, vy: 0, arc: null as unknown as Phaser.GameObjects.Arc };
  private holder = -1;                 // índice del poseedor (-1 = balón suelto)
  private gameTime = 0; private minuto = 0; private t0 = 0;
  private golIdx = 0; private golL = 0; private golV = 0;
  private passTimer = 1;
  private flight = 0;                  // balón "en vuelo" tras un pase: nadie lo controla aún
  private shoot = { active: false, team: 'local' as Equipo, timer: 0 };
  private finished = false;

  private scoreText!: Phaser.GameObjects.Text;
  private minText!: Phaser.GameObjects.Text;
  private flashRect!: Phaser.GameObjects.Rectangle;
  private golText!: Phaser.GameObjects.Text;
  private golTeamText!: Phaser.GameObjects.Text;
  private flashTimer = 0;

  constructor(cfg: { data: ResultadoSimulacion; onEnd: () => void }) {
    super('partido');
    this.sim = cfg.data;
    this.onEnd = cfg.onEnd;
  }

  create() {
    this.W = this.scale.width; this.H = this.scale.height;
    this.pr = Math.max(7, this.H * 0.03);
    this.br = Math.max(5, this.H * 0.02);

    this.dibujarCancha();

    const filas = [[0.5], [0.22, 0.4, 0.6, 0.78], [0.3, 0.5, 0.7], [0.28, 0.5, 0.72]];
    const crear = (team: Equipo, cols: number[]) => {
      let n = 0;
      for (let c = 0; c < filas.length; c++) for (const yf of filas[c]) {
        if (n >= 11) break;
        const gk = n === 0;                       // el primero (atrás, centro) es el arquero
        // el arquero arranca pegado a SU línea de gol
        const x = (gk ? (team === 'local' ? 0.025 : 0.975) : cols[c]) * this.W;
        const y = yf * this.H;
        const col = gk ? 0xeaeaea : (team === 'local' ? COL_LOCAL : COL_VISITA);
        const arc = this.add.circle(x, y, gk ? this.pr * 0.95 : this.pr, col)
          .setStrokeStyle(gk ? 3 : 2, gk ? (team === 'local' ? COL_LOCAL : COL_VISITA) : 0x06140d).setDepth(3);
        this.jugs.push({ team, x, y, vx: 0, vy: 0, hx: x, hy: y, gk, arc });
        n++;
      }
    };
    crear('local', [0.07, 0.2, 0.32, 0.43]);
    crear('visita', [0.93, 0.8, 0.68, 0.57]);

    this.ball.arc = this.add.circle(this.W / 2, this.H / 2, this.br, 0xffffff).setStrokeStyle(1.5, 0x888888).setDepth(6);
    this.ball.x = this.W / 2; this.ball.y = this.H / 2;

    const f = { fontFamily: 'Manrope, sans-serif' };
    this.add.rectangle(this.W / 2, 22, 92, 40, 0x000000, 0.45).setDepth(9);
    this.scoreText = this.add.text(this.W / 2, 16, '0 : 0', { ...f, fontSize: '24px', fontStyle: 'bold', color: '#fff' }).setOrigin(0.5, 0).setDepth(10);
    this.minText = this.add.text(this.W / 2, 40, "0'", { ...f, fontSize: '11px', fontStyle: 'bold', color: '#d4af37' }).setOrigin(0.5, 0).setDepth(10);
    this.flashRect = this.add.rectangle(this.W / 2, this.H / 2, this.W, this.H, 0x10b981, 0).setDepth(20);
    this.golText = this.add.text(this.W / 2, this.H / 2 - 6, 'GOL', { ...f, fontSize: '52px', fontStyle: '900', color: '#fff' }).setOrigin(0.5).setDepth(21).setVisible(false);
    this.golTeamText = this.add.text(this.W / 2, this.H / 2 + 28, '', { ...f, fontSize: '15px', fontStyle: 'bold', color: '#d4af37' }).setOrigin(0.5).setDepth(21).setVisible(false);

    this.saque('local');
    this.t0 = performance.now();   // reloj anclado a tiempo real → 30s exactos
  }

  private dibujarCancha() {
    const g = this.add.graphics().setDepth(0);
    const b = 6;
    for (let i = 0; i < b; i++) { g.fillStyle(i % 2 ? 0x1a7049 : 0x15613f, 1); g.fillRect((i / b) * this.W, 0, this.W / b + 1, this.H); }
    g.lineStyle(2, 0xffffff, 0.32);
    g.lineBetween(this.W / 2, 0, this.W / 2, this.H);
    g.strokeCircle(this.W / 2, this.H / 2, this.H * 0.14);
    const ah = this.H * 0.4, aw = this.W * 0.11, ay = (this.H - ah) / 2;
    g.strokeRect(0, ay, aw, ah); g.strokeRect(this.W - aw, ay, aw, ah);
    g.fillStyle(0xffffff, 0.16);
    g.fillRect(0, this.H * 0.36, 4, this.H * 0.28); g.fillRect(this.W - 4, this.H * 0.36, 4, this.H * 0.28);
  }

  override update(_t: number, dms: number) {
    if (this.finished) return;
    const dt = Math.min(0.05, dms / 1000);          // delta para el movimiento
    this.gameTime = (performance.now() - this.t0) / 1000;  // reloj = tiempo real
    this.minuto = Math.min(90, Math.floor((this.gameTime / DURACION) * 90));
    if (this.gameTime >= DURACION) { this.terminar(); return; }

    const goles = this.sim.goles;
    if (this.golIdx < goles.length && !this.shoot.active
        && this.gameTime >= (goles[this.golIdx].minuto / 90) * DURACION) {
      this.rematar(goles[this.golIdx].equipo);
    }

    this.ia(dt);
    this.render();
  }

  private ia(dt: number) {
    const MAX = this.H * 0.95, CHASE = this.H * 1.1, DRIB = this.H * 0.8;
    if (this.flight > 0) this.flight -= dt;

    // ---- balón / posesión ----
    if (this.shoot.active) {
      this.integrarBalon(dt);
      this.shoot.timer += dt;
      const cruzo = this.shoot.team === 'local' ? this.ball.x >= this.W - 4 : this.ball.x <= 4;
      if (cruzo || this.shoot.timer > 1.3) this.gol(this.shoot.team);
    } else if (this.holder >= 0) {
      const h = this.jugs[this.holder];
      const gx = h.team === 'local' ? this.W * 0.96 : this.W * 0.04;
      const gy = this.H / 2 + Math.sin(this.gameTime * 2.4 + this.holder) * this.H * 0.36;
      this.steer(h, gx, gy, DRIB, dt);
      // balón a los pies (interpolado, suave)
      const ang = Math.atan2(gy - h.y, gx - h.x);
      const fx = h.x + Math.cos(ang) * (this.pr + this.br), fy = h.y + Math.sin(ang) * (this.pr + this.br);
      this.ball.x += (fx - this.ball.x) * Math.min(1, 20 * dt);
      this.ball.y += (fy - this.ball.y) * Math.min(1, 20 * dt);
      this.ball.vx = this.ball.vy = 0;
      // pase
      this.passTimer -= dt;
      if (this.passTimer <= 0) {
        this.passTimer = 0.6 + Math.random() * 0.8;
        const c = this.companeroLibre(h);
        if (c) {
          // física del pase: se lidera al receptor (a donde irá) y la velocidad
          // crece con la distancia → pases cortos suaves, largos más fuertes.
          const tx = c.x + c.vx * 0.18, ty = c.y + c.vy * 0.18;
          const d = Math.hypot(tx - this.ball.x, ty - this.ball.y) || 1;
          const v = Phaser.Math.Clamp(d * 2.3, this.H * 1.2, this.H * 3.2);
          this.ball.vx = (tx - this.ball.x) / d * v; this.ball.vy = (ty - this.ball.y) / d * v;
          this.holder = -1;
          this.flight = 0.32;   // en vuelo: el pasador no la recupera al instante
        }
      } else {
        // robo del rival de campo más cercano (el arquero no roba)
        const r = this.masCercanoCampo(this.rival(h.team), this.ball.x, this.ball.y);
        if (r >= 0 && this.distXY(this.jugs[r], this.ball) < this.pr + 8 && Math.random() < 1.2 * dt) this.holder = r;
      }
    } else {
      this.integrarBalon(dt);
      // el balón "en vuelo" (recién pasado) no puede controlarse aún → el pase llega
      if (this.flight <= 0) {
        const c = this.masCercanoCampo(null, this.ball.x, this.ball.y);  // el arquero no conduce
        if (c >= 0 && this.distXY(this.jugs[c], this.ball) < this.pr + this.br + 4) this.holder = c;
      }
    }

    // ---- jugadores sin balón ----
    const teamBalon: Equipo | null = this.holder >= 0 ? this.jugs[this.holder].team : null;
    const persiguen = new Set<number>([
      ...this.nCercanos('local', this.ball.x, this.ball.y, 2),
      ...this.nCercanos('visita', this.ball.x, this.ball.y, 2),
    ]);
    const gmin = this.H * 0.36, gmax = this.H * 0.64;   // ancho del arco
    for (let i = 0; i < this.jugs.length; i++) {
      if (i === this.holder) continue;
      const p = this.jugs[i];
      if (p.gk) {
        // EL ARQUERO NO SALE DEL ARCO: se queda en su línea y solo cubre el ancho
        // del arco siguiendo la altura del balón.
        const lx = p.team === 'local' ? this.W * 0.03 : this.W * 0.97;
        const ly = Phaser.Math.Clamp(this.ball.y, gmin, gmax);
        this.steer(p, lx, ly, MAX * 0.7, dt);
        continue;
      }
      if (persiguen.has(i)) {
        this.steer(p, this.ball.x, this.ball.y, CHASE, dt);
      } else {
        // su zona, sesgada hacia el balón (X e Y) + empuje según ataque/defensa
        const empuje = teamBalon ? (p.team === teamBalon
          ? (p.team === 'local' ? 1 : -1) * this.W * 0.05
          : (p.team === 'local' ? -1 : 1) * this.W * 0.03) : 0;
        const tx = p.hx + (this.ball.x - p.hx) * 0.28 + empuje;
        const ty = p.hy + (this.ball.y - p.hy) * 0.55;
        this.steer(p, tx, ty, MAX * 0.85, dt);
      }
    }
    this.separar();
  }

  /** Steering proporcional con frenado: llegada suave, sin sobrepasar ni vibrar. */
  private steer(p: Jug, tx: number, ty: number, maxSpeed: number, dt: number) {
    const dx = tx - p.x, dy = ty - p.y;
    const d = Math.hypot(dx, dy);
    const vel = Math.min(maxSpeed, d * 3.5);     // frena al acercarse
    const dvx = d > 0.001 ? (dx / d) * vel : 0;
    const dvy = d > 0.001 ? (dy / d) * vel : 0;
    const a = Math.min(1, 9 * dt);               // suaviza la aceleración
    p.vx += (dvx - p.vx) * a; p.vy += (dvy - p.vy) * a;
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.x = Phaser.Math.Clamp(p.x, this.pr, this.W - this.pr);
    p.y = Phaser.Math.Clamp(p.y, this.pr, this.H - this.pr);
  }

  private integrarBalon(dt: number) {
    this.ball.x += this.ball.vx * dt; this.ball.y += this.ball.vy * dt;
    const f = Math.exp(-1.1 * dt); this.ball.vx *= f; this.ball.vy *= f;
    if (this.ball.y < this.br) { this.ball.y = this.br; this.ball.vy = Math.abs(this.ball.vy) * 0.6; }
    if (this.ball.y > this.H - this.br) { this.ball.y = this.H - this.br; this.ball.vy = -Math.abs(this.ball.vy) * 0.6; }
  }

  /** Empuja jugadores solapados (separación suave, 2 pasadas para estabilidad). */
  private separar() {
    const min = this.pr * 2.5;
    for (let pasada = 0; pasada < 2; pasada++)
      for (let i = 0; i < this.jugs.length; i++) for (let k = i + 1; k < this.jugs.length; k++) {
        const a = this.jugs[i], b = this.jugs[k];
        const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1;
        if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push; }
      }
  }

  private rematar(equipo: Equipo) {
    this.shoot = { active: true, team: equipo, timer: 0 };
    this.holder = -1;
    const gx = equipo === 'local' ? this.W : 0;
    const t = this.masCercanoCampo(equipo, gx, this.H / 2);
    if (t >= 0) { this.ball.x = this.jugs[t].x; this.ball.y = this.jugs[t].y; }
    const d = Math.hypot(gx - this.ball.x, this.H / 2 - this.ball.y) || 1;
    const v = Math.max(this.W, this.H) * 1.8;
    this.ball.vx = (gx - this.ball.x) / d * v; this.ball.vy = (this.H / 2 - this.ball.y) / d * v;
  }

  private gol(equipo: Equipo) {
    if (equipo === 'local') this.golL++; else this.golV++;
    this.flashTimer = 1; this.shoot.active = false;
    this.golTeamText.setText((equipo === 'local' ? this.sim.evento.equipo_local : this.sim.evento.equipo_visita).toUpperCase());
    this.golIdx++;
    this.saque(this.rival(equipo));
  }

  private saque(equipo: Equipo) {
    for (const p of this.jugs) { p.x = p.hx; p.y = p.hy; p.vx = 0; p.vy = 0; }
    this.ball.x = this.W / 2; this.ball.y = this.H / 2; this.ball.vx = 0; this.ball.vy = 0;
    this.holder = this.masCercanoCampo(equipo, this.W / 2, this.H / 2);
    this.passTimer = 0.8;
  }

  private render() {
    for (let i = 0; i < this.jugs.length; i++) {
      const p = this.jugs[i];
      p.arc.setPosition(p.x, p.y);
      p.arc.setStrokeStyle(i === this.holder ? 3 : 2, i === this.holder ? 0xd4af37 : 0x06140d);
    }
    this.ball.arc.setPosition(this.ball.x, this.ball.y);
    this.scoreText.setText(`${this.golL} : ${this.golV}`);
    this.minText.setText(`${this.minuto}'`);
    if (this.flashTimer > 0) {
      this.flashTimer -= 1 / 60;
      this.flashRect.setFillStyle(0x10b981, Math.min(0.32, this.flashTimer * 0.4));
      this.golText.setVisible(true); this.golTeamText.setVisible(true);
      if (this.flashTimer <= 0) { this.flashRect.setFillStyle(0x10b981, 0); this.golText.setVisible(false); this.golTeamText.setVisible(false); }
    }
    (window as any).__mc = {
      min: this.minuto, gl: this.golL, gv: this.golV, holder: this.holder,
      ball: { x: Math.round(this.ball.x), y: Math.round(this.ball.y) },
      players: this.jugs.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y), team: p.team, gk: p.gk })),
    };
  }

  private terminar() {
    if (this.finished) return;
    this.finished = true;
    this.golL = this.sim.marcador.local; this.golV = this.sim.marcador.visita;
    this.scoreText.setText(`${this.golL} : ${this.golV}`); this.minText.setText("90'");
    for (const p of this.jugs) { p.vx = 0; p.vy = 0; }
    this.ball.vx = 0; this.ball.vy = 0;
    const mc = (window as any).__mc; if (mc) { mc.min = 90; mc.gl = this.golL; mc.gv = this.golV; }
    this.onEnd();
  }
  saltar() { this.terminar(); }

  // helpers
  private masCercano(team: Equipo | null, x: number, y: number): number {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < this.jugs.length; i++) {
      if (team && this.jugs[i].team !== team) continue;
      const d = Math.hypot(this.jugs[i].x - x, this.jugs[i].y - y);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }
  /** Jugador de CAMPO (no arquero) más cercano al punto. */
  private masCercanoCampo(team: Equipo | null, x: number, y: number): number {
    let bi = -1, bd = Infinity;
    for (let i = 0; i < this.jugs.length; i++) {
      const j = this.jugs[i];
      if (j.gk) continue;
      if (team && j.team !== team) continue;
      const d = Math.hypot(j.x - x, j.y - y);
      if (d < bd) { bd = d; bi = i; }
    }
    return bi;
  }
  private nCercanos(team: Equipo, x: number, y: number, n: number): number[] {
    return this.jugs.map((p, i) => ({ i, d: Math.hypot(p.x - x, p.y - y), t: p.team, gk: p.gk }))
      .filter((o) => o.t === team && !o.gk).sort((a, b) => a.d - b.d).slice(0, n).map((o) => o.i);
  }
  private companeroLibre(h: Jug): Jug | null {
    const der = h.team === 'local';
    const cand = this.jugs.filter((j) => j !== h && j.team === h.team && !j.gk
      && this.distXY(j, h) > this.pr * 3 && this.distXY(j, h) < this.W * 0.5);
    let best: Jug | null = null, bs = -Infinity;
    for (const j of cand) {
      const ri = this.masCercano(this.rival(h.team), j.x, j.y);
      const libre = ri >= 0 ? this.distXY(this.jugs[ri], j) : 999;
      const avance = der ? (j.x - h.x) : (h.x - j.x);
      const s = libre + avance * 0.6 + Math.random() * 25;
      if (s > bs) { bs = s; best = j; }
    }
    return best;
  }
  private distXY(a: { x: number; y: number }, b: { x: number; y: number }) { return Math.hypot(a.x - b.x, a.y - b.y); }
  private rival(t: Equipo): Equipo { return t === 'local' ? 'visita' : 'local'; }
}

@Component({
  selector: 'app-mini-cancha',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mc-overlay" #overlay role="dialog" aria-modal="true"
         [attr.aria-label]="'Simulación: ' + data.evento.equipo_local + ' contra ' + data.evento.equipo_visita">
      <div class="mc-panel">
        <div class="mc-marcador">
          <div class="mc-equipo">
            <img *ngIf="data.evento.badge_local" [src]="data.evento.badge_local" alt="" class="mc-badge" />
            <span class="mc-nombre">{{ data.evento.equipo_local }}</span>
          </div>
          <div class="mc-vs">VS</div>
          <div class="mc-equipo der">
            <span class="mc-nombre">{{ data.evento.equipo_visita }}</span>
            <img *ngIf="data.evento.badge_visita" [src]="data.evento.badge_visita" alt="" class="mc-badge" />
          </div>
        </div>
        <div #pitch class="mc-pitch"></div>
        <div class="mc-pie">
          <div *ngIf="!terminadoFlag" class="mc-jugando">
            <span>En juego<span class="mc-puntos"></span></span>
            <button class="mc-saltar" (click)="saltar()">Saltar al resultado ›</button>
          </div>
          <div *ngIf="terminadoFlag" class="mc-final">
            <p class="mc-resultado" [class.gano]="usuarioGano===true" [class.perdio]="usuarioGano===false">{{ textoFinal }}</p>
            <button class="mc-cerrar" #btnCerrar (click)="cerrar()">Continuar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .mc-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(3,8,6,0.82); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; padding: 20px; }
    .mc-panel { width: min(760px, 96vw); max-height: 94vh; overflow-y: auto;
      background: linear-gradient(160deg, #0c1512, #060b09); border: 1px solid rgba(16,185,129,0.35);
      border-radius: 18px; padding: 20px; box-shadow: 0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.08); }
    .mc-marcador { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 14px; margin-bottom: 14px; }
    .mc-equipo { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .mc-equipo.der { justify-content: flex-end; }
    .mc-badge { width: 34px; height: 34px; object-fit: contain; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5)); }
    .mc-nombre { color: #e8e0c8; font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mc-vs { font-size: 12px; font-weight: 800; color: #6a8a7a; letter-spacing: 1px; }
    .mc-pitch { width: 100%; border-radius: 12px; overflow: hidden; border: 2px solid rgba(255,255,255,0.18); line-height: 0; }
    .mc-pitch canvas { display: block; width: 100% !important; height: auto !important; border-radius: 10px; }
    .mc-pie { text-align: center; margin-top: 14px; min-height: 56px; }
    .mc-jugando { color: #9ab8b0; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 16px; }
    .mc-saltar { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #cfe3da;
      border-radius: 8px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .mc-saltar:hover { border-color: rgba(212,175,55,0.5); color: #fff; }
    .mc-saltar:focus-visible { outline: 3px solid #d4af37; outline-offset: 2px; }
    .mc-puntos::after { content: '...'; animation: mc-dots 1.2s steps(4,end) infinite; }
    @keyframes mc-dots { 0%{content:'';} 25%{content:'.';} 50%{content:'..';} 75%{content:'...';} }
    .mc-resultado { font-size: 20px; font-weight: 800; margin-bottom: 10px; color: #e8e0c8; }
    .mc-resultado.gano { color: #aef0a8; text-shadow: 0 0 16px rgba(16,185,129,0.5); }
    .mc-resultado.perdio { color: #ffb1b1; }
    .mc-cerrar { padding: 9px 28px; border-radius: 8px; border: none; cursor: pointer;
      background: linear-gradient(135deg, #10b981, #059669); color: #fff; font-weight: 700; font-size: 14px; }
    .mc-cerrar:hover { filter: brightness(1.08); }
    .mc-cerrar:focus-visible { outline: 3px solid #d4af37; outline-offset: 2px; }
    @media (prefers-reduced-motion: reduce) { .mc-puntos::after { animation: none; } }
  `]
})
export class MiniCanchaComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) data!: ResultadoSimulacion;
  @Input() seleccionUsuario: Seleccion | null = null;
  @Output() terminado = new EventEmitter<void>();

  @ViewChild('pitch') pitch!: ElementRef<HTMLElement>;
  @ViewChild('btnCerrar') btnCerrar?: ElementRef<HTMLButtonElement>;
  @ViewChild('overlay') overlay!: ElementRef<HTMLElement>;

  terminadoFlag = false;
  usuarioGano: boolean | null = null;
  textoFinal = '';

  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private game?: Phaser.Game;
  private scene?: PartidoScene;

  ngAfterViewInit() {
    document.body.appendChild(this.overlay.nativeElement);
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reducido) { this.finalizar(); return; }
    const cssW = this.pitch.nativeElement.clientWidth || 700;
    const W = Math.round(cssW);
    const H = Math.min(Math.round(cssW * 0.56), Math.round(window.innerHeight * 0.46));
    this.scene = new PartidoScene({ data: this.data, onEnd: () => this.zone.run(() => this.finalizar()) });
    this.zone.runOutsideAngular(() => {
      this.game = new Phaser.Game({
        type: Phaser.AUTO, parent: this.pitch.nativeElement, width: W, height: H,
        transparent: true, banner: false, audio: { noAudio: true }, scene: this.scene,
      });
    });
  }

  ngOnDestroy() {
    this.game?.destroy(true);
    this.overlay?.nativeElement.remove();
    delete (window as any).__mc;
  }

  saltar() { this.scene?.saltar(); }

  private finalizar() {
    if (this.terminadoFlag) return;
    this.terminadoFlag = true;
    const r = this.data.resultado;
    if (this.seleccionUsuario) {
      this.usuarioGano = this.seleccionUsuario === r;
      this.textoFinal = this.usuarioGano ? '¡Ganaste tu apuesta!' : 'Esta vez no fue. Tu apuesta no acertó.';
    } else {
      const nombre = r === 'local' ? this.data.evento.equipo_local : r === 'visita' ? this.data.evento.equipo_visita : 'Empate';
      this.textoFinal = r === 'empate' ? 'Terminó en empate.' : `Ganó ${nombre}.`;
    }
    this.cdr.detectChanges();
    requestAnimationFrame(() => this.btnCerrar?.nativeElement.focus());
  }

  cerrar() { this.terminado.emit(); }
}
