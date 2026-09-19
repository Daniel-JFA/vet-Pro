import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  PlatformAuthService,
  PlatformStats,
  PlatformClinic,
} from '../../core/services/platform-auth.service';

@Component({
  selector: 'app-platform-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="platform-dashboard">
      <header>
        <div>
          <h1>Super Administración VetPro</h1>
          <p>
            {{ auth.admin()?.firstName }} {{ auth.admin()?.lastName }} — visión general de la
            plataforma
          </p>
        </div>
        <button class="logout-btn" (click)="auth.logout()">Cerrar sesión</button>
      </header>

      @if (stats(); as s) {
        <section class="stats-grid">
          <div class="stat-card">
            <span class="material-symbols-outlined">domain</span>
            <strong>{{ s.clinicsCount }}</strong>
            <small>Clínicas / Tenants</small>
          </div>
          <div class="stat-card">
            <span class="material-symbols-outlined">group</span>
            <strong>{{ s.usersCount }}</strong>
            <small>Usuarios Totales</small>
          </div>
          <div class="stat-card">
            <span class="material-symbols-outlined">pets</span>
            <strong>{{ s.patientsCount }}</strong>
            <small>Pacientes Totales</small>
          </div>
          <div class="stat-card">
            <span class="material-symbols-outlined">event</span>
            <strong>{{ s.appointmentsCount }}</strong>
            <small>Citas Totales</small>
          </div>
        </section>
      }

      <section class="clinics-table-wrapper">
        <h2>Tenants Registrados</h2>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Clínica</th>
                <th>Tipo</th>
                <th>Plan</th>
                <th>Ciudad</th>
                <th>Usuarios</th>
                <th>Pacientes</th>
                <th>Sedes</th>
                <th>Tutores</th>
                <th>Registrada</th>
              </tr>
            </thead>
            <tbody>
              @for (c of clinics(); track c) {
                <tr>
                  <td>
                    <strong>{{ c.name }}</strong>
                    <small>{{ c.email }}</small>
                  </td>
                  <td>
                    {{ c.businessType === 'independent_vet' ? 'Vet Independiente' : 'Clínica' }}
                  </td>
                  <td>{{ c.plan }}</td>
                  <td>{{ c.city }}</td>
                  <td>{{ c.usersCount }}</td>
                  <td>{{ c.patientsCount }}</td>
                  <td>{{ c.branchesCount }}</td>
                  <td>{{ c.tutorsCount }}</td>
                  <td>{{ c.createdAt | date: 'dd/MM/yyyy' }}</td>
                </tr>
              }
              @if (!clinics().length) {
                <tr>
                  <td colspan="9" class="empty-row">No hay tenants registrados todavía.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .platform-dashboard {
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
          font-size: 1.5rem;
          font-weight: 800;
          margin: 0;
        }
        p {
          font-size: 0.85rem;
          color: #9ca3af;
          margin: 4px 0 0;
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
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
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
          font-size: 24px;
          color: #a78bfa;
        }
        strong {
          font-size: 1.8rem;
          font-weight: 800;
        }
        small {
          font-size: 0.78rem;
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
      }
      .clinics-table-wrapper {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 20px;
        h2 {
          font-size: 1.05rem;
          margin: 0 0 14px;
        }
      }
      .table-scroll {
        overflow-x: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
        th {
          text-align: left;
          padding: 10px 12px;
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        td {
          padding: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          vertical-align: top;
          strong {
            display: block;
          }
          small {
            color: #9ca3af;
            font-size: 0.75rem;
          }
        }
        .empty-row {
          text-align: center;
          color: #9ca3af;
          padding: 24px;
        }
      }
    `,
  ],
})
export class PlatformDashboardComponent implements OnInit {
  auth = inject(PlatformAuthService);

  stats = signal<PlatformStats | null>(null);
  clinics = signal<PlatformClinic[]>([]);

  ngOnInit() {
    this.auth.getStats().subscribe((s) => this.stats.set(s));
    this.auth.getClinics().subscribe((c) => this.clinics.set(c));
  }
}
