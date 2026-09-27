import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { PlatformAuthService, PlatformAnalyticsOverview } from '../../core/services/platform-auth.service';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  trial: { label: 'En prueba', color: '#3987e5' },
  active: { label: 'Activa', color: '#0ca30c' },
  past_due: { label: 'Pago pendiente', color: '#fab219' },
  suspended: { label: 'Suspendida', color: '#d03b3b' },
  cancelled: { label: 'Cancelada', color: '#898781' },
};

interface Point {
  x: number;
  y: number;
}

@Component({
  selector: 'app-platform-analytics',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="analytics">
      <header>
        <div>
          <a routerLink="/platform/dashboard" class="back-link">
            <span class="material-symbols-outlined">arrow_back</span> Volver
          </a>
          <h1>Analíticas de la Plataforma</h1>
        </div>
        <button class="logout-btn" (click)="auth.logout()">Cerrar sesión</button>
      </header>

      @if (loading()) {
        <p class="loading">Cargando analíticas...</p>
      } @else if (overview(); as o) {
        <!-- KPIs -->
        <section class="stats-grid">
          <div class="stat-card">
            <span class="material-symbols-outlined">payments</span>
            <strong>{{ formatCOP(o.revenue.mrr) }}</strong>
            <small>MRR (Ingreso Mensual Recurrente)</small>
          </div>
          <div class="stat-card">
            <span class="material-symbols-outlined">trending_up</span>
            <strong>{{ formatCOP(o.revenue.arr) }}</strong>
            <small>ARR Proyectado</small>
          </div>
          <div class="stat-card">
            <span class="material-symbols-outlined">bolt</span>
            <strong>{{ o.engagement.activeLast24h }}</strong>
            <small>Usuarios activos (24h)</small>
          </div>
          <div class="stat-card">
            <span class="material-symbols-outlined">groups</span>
            <strong>{{ o.engagement.activeLast7d }}</strong>
            <small>Usuarios activos (7 días)</small>
          </div>
          <div class="stat-card">
            <span class="material-symbols-outlined">calendar_month</span>
            <strong>{{ o.engagement.activeLast30d }}</strong>
            <small>Usuarios activos (30 días)</small>
          </div>
        </section>

        <div class="chart-grid">
          <!-- Crecimiento -->
          <section class="panel">
            <h2>Registros de clínicas (últimos 30 días)</h2>
            @if (hasData(o.growth, 'count')) {
              <svg [attr.viewBox]="'0 0 620 180'" class="chart-svg" role="img" aria-label="Registros diarios">
                @for (gy of gridLines; track gy) {
                  <line [attr.x1]="40" [attr.x2]="600" [attr.y1]="gy" [attr.y2]="gy" class="gridline" />
                }
                <path [attr.d]="areaPath(growthPoints(o.growth))" class="area-fill" />
                <path [attr.d]="linePath(growthPoints(o.growth))" class="line-stroke" />
                @for (p of growthLabelPoints(o.growth); track p.date) {
                  <circle [attr.cx]="p.point.x" [attr.cy]="p.point.y" r="3.5" class="dot">
                    <title>{{ p.date }}: {{ p.count }} registro(s)</title>
                  </circle>
                }
                <text [attr.x]="growthPoints(o.growth).at(-1)!.x" [attr.y]="growthPoints(o.growth).at(-1)!.y - 10" class="direct-label" text-anchor="end">
                  {{ o.growth.at(-1)!.count }}
                </text>
              </svg>
              <div class="axis-labels">
                <span>{{ formatShortDate(o.growth[0].date) }}</span>
                <span>{{ formatShortDate(o.growth.at(-1)!.date) }}</span>
              </div>
            } @else {
              <p class="empty">Sin registros en este período.</p>
            }
          </section>

          <!-- Ingresos mensuales -->
          <section class="panel">
            <h2>Ingresos por pagos aprobados (6 meses)</h2>
            @if (hasData(o.revenue.monthlyRevenue, 'amountInCents')) {
              <svg [attr.viewBox]="'0 0 620 180'" class="chart-svg" role="img" aria-label="Ingresos mensuales">
                @for (b of revenueBars(o.revenue.monthlyRevenue); track b.month) {
                  <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.width" [attr.height]="b.height" rx="3" class="bar-fill">
                    <title>{{ b.label }}: {{ formatCOP(b.amount) }}</title>
                  </rect>
                  @if (b.amount > 0) {
                    <text [attr.x]="b.x + b.width / 2" [attr.y]="b.y - 6" text-anchor="middle" class="direct-label small">
                      {{ formatCOPShort(b.amount) }}
                    </text>
                  }
                  <text [attr.x]="b.x + b.width / 2" [attr.y]="168" text-anchor="middle" class="axis-tick">{{ b.label }}</text>
                }
              </svg>
            } @else {
              <p class="empty">Todavía no hay pagos aprobados registrados.</p>
            }
          </section>

          <!-- Estado de suscripciones -->
          <section class="panel">
            <h2>Estado de suscripciones</h2>
            <svg [attr.viewBox]="'0 0 620 46'" class="chart-svg stacked-bar" role="img" aria-label="Distribución de estados de suscripción">
              @for (seg of subscriptionSegments(o.revenue.subscriptionBreakdown); track seg.key) {
                @if (seg.width > 0) {
                  <rect [attr.x]="seg.x" y="8" [attr.width]="seg.width" height="30" [attr.fill]="seg.color" rx="3">
                    <title>{{ seg.label }}: {{ seg.count }}</title>
                  </rect>
                }
              }
            </svg>
            <div class="legend-row">
              @for (seg of subscriptionSegments(o.revenue.subscriptionBreakdown); track seg.key) {
                <span class="legend-item">
                  <span class="legend-dot" [style.background]="seg.color"></span>
                  {{ seg.label }}: <strong>{{ seg.count }}</strong>
                </span>
              }
            </div>
          </section>

          <!-- Plan breakdown -->
          <section class="panel">
            <h2>Distribución por plan</h2>
            <div class="hbar-list">
              @for (p of planBars(o.revenue.planBreakdown); track p.label) {
                <div class="hbar-row">
                  <span class="hbar-label">{{ p.label }}</span>
                  <div class="hbar-track">
                    <div class="hbar-fill" [style.width.%]="p.pct">
                      <title>{{ p.label }}: {{ p.count }}</title>
                    </div>
                  </div>
                  <span class="hbar-value">{{ p.count }}</span>
                </div>
              }
            </div>
          </section>

          <!-- Renovaciones próximas -->
          <section class="panel">
            <h2>Renovaciones / vencimientos próximos (7 días)</h2>
            @if (o.revenue.renewalsDue.length) {
              <table class="mini-table">
                <thead>
                  <tr><th>Clínica</th><th>Tipo</th><th>Vence</th><th>Días</th></tr>
                </thead>
                <tbody>
                  @for (r of o.revenue.renewalsDue; track r.id) {
                    <tr>
                      <td>{{ r.name }}</td>
                      <td>{{ r.type === 'trial' ? 'Fin de prueba' : 'Cobro recurrente' }}</td>
                      <td>{{ r.expiresAt | date: 'dd/MM/yyyy' }}</td>
                      <td>
                        <span class="badge" [class.badge-critical]="r.daysLeft <= 2" [class.badge-warning]="r.daysLeft > 2">
                          {{ r.daysLeft }}d
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="empty">Nada vence en los próximos 7 días.</p>
            }
          </section>

          <!-- Uso del producto -->
          <section class="panel">
            <h2>Uso total del producto</h2>
            <div class="usage-grid">
              <div class="usage-tile"><strong>{{ o.usage.totals.appointments }}</strong><small>Citas</small></div>
              <div class="usage-tile"><strong>{{ o.usage.totals.patients }}</strong><small>Pacientes</small></div>
              <div class="usage-tile"><strong>{{ o.usage.totals.invoices }}</strong><small>Facturas</small></div>
              <div class="usage-tile"><strong>{{ o.usage.totals.notifications }}</strong><small>Notificaciones</small></div>
            </div>
          </section>

          <!-- Ranking de clínicas -->
          <section class="panel">
            <h2>Clínicas más activas</h2>
            @if (o.usage.topClinics.length) {
              <div class="hbar-list">
                @for (c of topClinicBars(o.usage.topClinics); track c.id) {
                  <div class="hbar-row">
                    <span class="hbar-label" [title]="c.name">{{ c.name }}</span>
                    <div class="hbar-track">
                      <div class="hbar-fill" [style.width.%]="c.pct">
                        <title>{{ c.name }}: {{ c.score }} (citas + pacientes)</title>
                      </div>
                    </div>
                    <span class="hbar-value">{{ c.score }}</span>
                  </div>
                }
              </div>
            } @else {
              <p class="empty">Todavía no hay actividad clínica registrada.</p>
            }
          </section>

          <!-- Geografía -->
          <section class="panel">
            <h2>Clínicas por departamento</h2>
            <div class="hbar-list">
              @for (g of geoBars(o.geography); track g.label) {
                <div class="hbar-row">
                  <span class="hbar-label">{{ g.label }}</span>
                  <div class="hbar-track">
                    <div class="hbar-fill" [style.width.%]="g.pct">
                      <title>{{ g.label }}: {{ g.count }}</title>
                    </div>
                  </div>
                  <span class="hbar-value">{{ g.count }}</span>
                </div>
              }
            </div>
          </section>

          <!-- Tenants dormidos -->
          <section class="panel">
            <h2>Tenants sin ningún acceso</h2>
            @if (o.engagement.dormantClinics.length) {
              <table class="mini-table">
                <thead>
                  <tr><th>Clínica</th><th>Correo</th><th>Registrada</th></tr>
                </thead>
                <tbody>
                  @for (d of o.engagement.dormantClinics; track d.id) {
                    <tr>
                      <td>{{ d.name }}</td>
                      <td>{{ d.email }}</td>
                      <td>{{ d.createdAt | date: 'dd/MM/yyyy' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="empty">Todos los tenants registrados hace más de 3 días ya iniciaron sesión al menos una vez.</p>
            }
          </section>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .analytics {
        min-height: 100vh;
        background: hsl(220, 25%, 6%);
        color: #f3f4f6;
        font-family: 'Inter', sans-serif;
        padding: 32px;
        box-sizing: border-box;
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
        h1 {
          font-size: 1.4rem;
          font-weight: 800;
          margin: 6px 0 0;
        }
      }
      .back-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #9ca3af;
        text-decoration: none;
        font-size: 0.82rem;
        span {
          font-size: 18px;
        }
        &:hover {
          color: #f3f4f6;
        }
      }
      .logout-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #cbd5e1;
        padding: 10px 18px;
        border-radius: 10px;
        cursor: pointer;
        font-family: inherit;
        &:hover {
          background: rgba(255, 255, 255, 0.06);
        }
      }
      .loading,
      .empty {
        color: #9ca3af;
        font-size: 0.85rem;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 28px;
      }
      .stat-card {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        span {
          font-size: 22px;
          color: #a78bfa;
        }
        strong {
          font-size: 1.5rem;
          font-weight: 800;
        }
        small {
          font-size: 0.75rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
      }
      .chart-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
        gap: 16px;
      }
      .panel {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 20px;
        h2 {
          font-size: 0.95rem;
          margin: 0 0 14px;
          font-weight: 700;
        }
      }
      .chart-svg {
        width: 100%;
        height: auto;
        overflow: visible;
      }
      .gridline {
        stroke: #2c2c2a;
        stroke-width: 1;
      }
      .area-fill {
        fill: rgba(57, 135, 229, 0.12);
        stroke: none;
      }
      .line-stroke {
        fill: none;
        stroke: #3987e5;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .dot {
        fill: #1a1a19;
        stroke: #3987e5;
        stroke-width: 2;
      }
      .bar-fill {
        fill: #3987e5;
      }
      .direct-label {
        fill: #f3f4f6;
        font-size: 11px;
        font-weight: 600;
        &.small {
          font-size: 9px;
        }
      }
      .axis-tick {
        fill: #898781;
        font-size: 9px;
      }
      .axis-labels {
        display: flex;
        justify-content: space-between;
        color: #898781;
        font-size: 0.72rem;
        margin-top: 4px;
      }
      .stacked-bar {
        margin-bottom: 12px;
      }
      .legend-row {
        display: flex;
        flex-wrap: wrap;
        gap: 14px;
      }
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        color: #c3c2b7;
        strong {
          color: #f3f4f6;
        }
      }
      .legend-dot {
        width: 10px;
        height: 10px;
        border-radius: 3px;
        display: inline-block;
      }
      .hbar-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .hbar-row {
        display: grid;
        grid-template-columns: 140px 1fr 40px;
        align-items: center;
        gap: 10px;
      }
      .hbar-label {
        font-size: 0.78rem;
        color: #c3c2b7;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .hbar-track {
        background: rgba(255, 255, 255, 0.06);
        border-radius: 6px;
        height: 14px;
        overflow: hidden;
      }
      .hbar-fill {
        background: #3987e5;
        height: 100%;
        border-radius: 6px;
        min-width: 3px;
      }
      .hbar-value {
        font-size: 0.78rem;
        color: #f3f4f6;
        font-weight: 700;
        text-align: right;
      }
      .usage-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
        gap: 12px;
      }
      .usage-tile {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 10px;
        padding: 14px;
        text-align: center;
        strong {
          display: block;
          font-size: 1.3rem;
          font-weight: 800;
        }
        small {
          color: #9ca3af;
          font-size: 0.7rem;
          text-transform: uppercase;
        }
      }
      .mini-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
        th {
          text-align: left;
          color: #9ca3af;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          padding: 6px 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        td {
          padding: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 999px;
        font-size: 0.7rem;
        font-weight: 700;
      }
      .badge-warning {
        background: rgba(250, 178, 25, 0.18);
        color: #fab219;
      }
      .badge-critical {
        background: rgba(208, 59, 59, 0.18);
        color: #f87171;
      }
    `,
  ],
})
export class PlatformAnalyticsComponent implements OnInit {
  auth = inject(PlatformAuthService);

  loading = signal(true);
  overview = signal<PlatformAnalyticsOverview | null>(null);

  readonly gridLines = [20, 60, 100, 140];

  ngOnInit() {
    this.auth.getAnalyticsOverview().subscribe({
      next: (o) => {
        this.overview.set(o);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  hasData(arr: any[], key: string): boolean {
    return arr.length > 0 && arr.some((item) => item[key] > 0);
  }

  // ── Crecimiento (line chart) ──
  growthPoints(growth: { date: string; count: number }[]): Point[] {
    const max = Math.max(1, ...growth.map((g) => g.count));
    const stepX = 560 / Math.max(1, growth.length - 1);
    return growth.map((g, i) => ({
      x: 40 + i * stepX,
      y: 150 - (g.count / max) * 120,
    }));
  }

  growthLabelPoints(growth: { date: string; count: number }[]) {
    const points = this.growthPoints(growth);
    return growth.map((g, i) => ({ point: points[i], date: this.formatShortDate(g.date), count: g.count })).filter((_, i) => growth[i].count > 0);
  }

  linePath(points: Point[]): string {
    if (!points.length) return '';
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  }

  areaPath(points: Point[]): string {
    if (!points.length) return '';
    const line = this.linePath(points);
    const last = points[points.length - 1];
    const first = points[0];
    return `${line} L ${last.x.toFixed(1)} 150 L ${first.x.toFixed(1)} 150 Z`;
  }

  // ── Ingresos mensuales (bar chart) ──
  revenueBars(monthly: { month: string; amountInCents: number }[]) {
    const max = Math.max(1, ...monthly.map((m) => m.amountInCents));
    const barWidth = 60;
    const gap = (560 - barWidth * monthly.length) / Math.max(1, monthly.length - 1);
    return monthly.map((m, i) => {
      const height = (m.amountInCents / max) * 120;
      const [year, month] = m.month.split('-');
      return {
        month: m.month,
        amount: m.amountInCents,
        label: MONTH_LABELS[parseInt(month, 10) - 1],
        x: 40 + i * (barWidth + gap),
        width: barWidth,
        height,
        y: 150 - height,
      };
    });
  }

  formatCOP(cents: number): string {
    const pesos = Math.round(cents / 100);
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(pesos);
  }

  formatCOPShort(cents: number): string {
    const pesos = cents / 100;
    if (pesos >= 1_000_000) return `${(pesos / 1_000_000).toFixed(1)}M`;
    if (pesos >= 1_000) return `${Math.round(pesos / 1000)}K`;
    return `${Math.round(pesos)}`;
  }

  formatShortDate(iso: string): string {
    const d = new Date(iso + 'T00:00:00');
    return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
  }

  // ── Suscripciones (stacked bar) ──
  subscriptionSegments(breakdown: Record<string, number>) {
    const total = Object.values(breakdown).reduce((a, b) => a + b, 0) || 1;
    let cursor = 0;
    return Object.entries(breakdown).map(([key, count]) => {
      const width = (count / total) * 620;
      const seg = { key, count, label: STATUS_META[key]?.label || key, color: STATUS_META[key]?.color || '#898781', x: cursor, width };
      cursor += width;
      return seg;
    });
  }

  // ── Barras horizontales genéricas ──
  planBars(breakdown: { starter: number; pro: number; enterprise: number }) {
    const entries = [
      { label: 'Starter', count: breakdown.starter },
      { label: 'Pro', count: breakdown.pro },
      { label: 'Enterprise', count: breakdown.enterprise },
    ];
    const max = Math.max(1, ...entries.map((e) => e.count));
    return entries.map((e) => ({ ...e, pct: (e.count / max) * 100 }));
  }

  topClinicBars(clinics: { id: string; name: string; score: number }[]) {
    const max = Math.max(1, ...clinics.map((c) => c.score));
    return clinics.map((c) => ({ ...c, pct: (c.score / max) * 100 }));
  }

  geoBars(geography: { label: string; count: number }[]) {
    const max = Math.max(1, ...geography.map((g) => g.count));
    return geography.map((g) => ({ ...g, pct: (g.count / max) * 100 }));
  }
}
