import { Component, inject } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { DemoDataService } from '../demo-data.service';

@Component({
  selector: 'app-demo-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  template: `
    <div class="dashboard">
      <h1 class="dashboard__title">Dashboard</h1>
      <p class="dashboard__subtitle">Bienvenido a VetPro — Vista de demostración</p>

      <!-- Stat cards -->
      <div class="stats-grid">
        <div class="stat-card stat-card--blue">
          <div class="stat-card__icon">🐾</div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ demoData.stats().totalPatients }}</div>
            <div class="stat-card__label">Pacientes</div>
          </div>
        </div>

        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">📅</div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ demoData.stats().appointmentsToday }}</div>
            <div class="stat-card__label">Citas hoy</div>
          </div>
        </div>

        <div class="stat-card stat-card--amber">
          <div class="stat-card__icon">💳</div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ demoData.stats().pendingInvoices }}</div>
            <div class="stat-card__label">Facturas pendientes</div>
          </div>
        </div>

        <div class="stat-card stat-card--purple">
          <div class="stat-card__icon">💰</div>
          <div class="stat-card__body">
            <div class="stat-card__value">{{ demoData.stats().monthlyRevenue | currency:'COP':'symbol-narrow':'1.0-0' }}</div>
            <div class="stat-card__label">Ingresos del mes</div>
          </div>
        </div>
      </div>

      <!-- Today's appointments -->
      <section class="section">
        <h2 class="section__title">Citas de hoy</h2>
        <div class="appointments-list">
          @for (appt of demoData.appointments; track appt.id) {
            <div class="appt-row">
              <div class="appt-row__patient">
                <span class="appt-row__species">{{ appt.patient.species === 'dog' ? '🐕' : '🐈' }}</span>
                <div>
                  <div class="appt-row__name">{{ appt.patient.name }}</div>
                  <div class="appt-row__tutor">{{ appt.patient.tutor.firstName }} {{ appt.patient.tutor.lastName }}</div>
                </div>
              </div>
              <div class="appt-row__service">{{ appt.serviceType }}</div>
              <div>
                <span class="badge" [class]="getStatusClass(appt.status)">{{ getStatusLabel(appt.status) }}</span>
              </div>
              @if (appt.amountCharged) {
                <div class="appt-row__amount">{{ appt.amountCharged | currency:'COP':'symbol-narrow':'1.0-0' }}</div>
              } @else {
                <div class="appt-row__amount appt-row__amount--empty">—</div>
              }
            </div>
          }
        </div>
      </section>

      <!-- Upcoming vaccines -->
      <section class="section">
        <h2 class="section__title">Vacunas próximas</h2>
        <div class="vaccines-list">
          @for (v of demoData.upcomingVaccines; track v.vaccineName + v.patientName) {
            <div class="vaccine-row">
              <span class="vaccine-row__icon">💉</span>
              <div class="vaccine-row__body">
                <div class="vaccine-row__name">{{ v.patientName }}</div>
                <div class="vaccine-row__vaccine">{{ v.vaccineName }}</div>
              </div>
              <div class="vaccine-row__date">{{ v.dueDate | date:'d MMM' }}</div>
            </div>
          }
        </div>
      </section>
    </div>
  `,
  styles: [`
    .dashboard__title { font-size: 24px; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
    .dashboard__subtitle { color: #64748b; font-size: 14px; margin: 0 0 24px; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
      border-left: 4px solid transparent;
    }
    .stat-card--blue { border-left-color: #3b82f6; }
    .stat-card--green { border-left-color: #22c55e; }
    .stat-card--amber { border-left-color: #f59e0b; }
    .stat-card--purple { border-left-color: #a855f7; }
    .stat-card__icon { font-size: 32px; }
    .stat-card__value { font-size: 26px; font-weight: 700; color: #1e293b; }
    .stat-card__label { font-size: 13px; color: #64748b; font-weight: 500; }

    /* Section */
    .section { margin-bottom: 28px; }
    .section__title { font-size: 16px; font-weight: 700; color: #1e293b; margin: 0 0 12px; }

    /* Appointments list */
    .appointments-list { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); overflow: hidden; }
    .appt-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .appt-row:last-child { border-bottom: none; }
    .appt-row__patient { display: flex; align-items: center; gap: 10px; }
    .appt-row__species { font-size: 22px; }
    .appt-row__name { font-weight: 600; color: #1e293b; font-size: 14px; }
    .appt-row__tutor { font-size: 12px; color: #94a3b8; }
    .appt-row__service { font-size: 13px; color: #475569; }
    .appt-row__amount { font-size: 13px; font-weight: 600; color: #22c55e; text-align: right; min-width: 80px; }
    .appt-row__amount--empty { color: #cbd5e1; }

    /* Badges */
    .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; }
    .badge--waiting { background: #fef9c3; color: #854d0e; }
    .badge--in-progress { background: #dbeafe; color: #1d4ed8; }
    .badge--scheduled { background: #f0fdf4; color: #166534; }
    .badge--done { background: #f0fdf4; color: #15803d; }
    .badge--cancelled { background: #fee2e2; color: #991b1b; }

    /* Vaccines */
    .vaccines-list { background: #fff; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.07); overflow: hidden; }
    .vaccine-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; border-bottom: 1px solid #f1f5f9; }
    .vaccine-row:last-child { border-bottom: none; }
    .vaccine-row__icon { font-size: 20px; }
    .vaccine-row__body { flex: 1; }
    .vaccine-row__name { font-weight: 600; color: #1e293b; font-size: 14px; }
    .vaccine-row__vaccine { font-size: 12px; color: #64748b; }
    .vaccine-row__date { font-size: 13px; font-weight: 600; color: #f59e0b; }
  `]
})
export class DemoDashboardComponent {
  demoData = inject(DemoDataService);

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      waiting: 'Esperando',
      'in-progress': 'En consulta',
      scheduled: 'Programada',
      done: 'Completada',
      cancelled: 'Cancelada',
      'no-show': 'No asistió',
    };
    return labels[status] ?? status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      waiting: 'badge badge--waiting',
      'in-progress': 'badge badge--in-progress',
      scheduled: 'badge badge--scheduled',
      done: 'badge badge--done',
      cancelled: 'badge badge--cancelled',
    };
    return classes[status] ?? 'badge';
  }
}
