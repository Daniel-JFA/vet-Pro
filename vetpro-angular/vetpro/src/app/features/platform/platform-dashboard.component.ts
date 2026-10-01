import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  PlatformAuthService,
  PlatformStats,
  PlatformClinic,
  PlatformClinicUser,
} from '../../core/services/platform-auth.service';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  vet: 'Médico Veterinario',
  assistant: 'Auxiliar',
  receptionist: 'Recepcionista',
  groomer: 'Estilista',
  walker: 'Paseador',
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trial: 'En prueba',
  active: 'Activa',
  past_due: 'Pago pendiente',
  suspended: 'Suspendida',
  cancelled: 'Cancelada',
};

@Component({
  selector: 'app-platform-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
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
        <div class="header-actions">
          <a routerLink="/platform/verifications" class="analytics-link">
            <span class="material-symbols-outlined">verified</span> Verificaciones COMVEZCOL
          </a>
          <a routerLink="/platform/analytics" class="analytics-link">
            <span class="material-symbols-outlined">monitoring</span> Analíticas
          </a>
          <button class="logout-btn" (click)="auth.logout()">Cerrar sesión</button>
        </div>
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
        <div class="table-header">
          <h2>Tenants Registrados</h2>
          <div class="filters">
            <input
              type="text"
              placeholder="Buscar por nombre, correo o ciudad..."
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
            />
            <select [value]="businessTypeFilter()" (change)="businessTypeFilter.set($any($event.target).value)">
              <option value="">Todos los tipos</option>
              <option value="clinic">Clínica</option>
              <option value="independent_vet">Vet Independiente</option>
            </select>
            <select [value]="planFilter()" (change)="planFilter.set($any($event.target).value)">
              <option value="">Todos los planes</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Clínica</th>
                <th>Tipo</th>
                <th>Plan</th>
                <th>Suscripción</th>
                <th>Ciudad</th>
                <th>Usuarios</th>
                <th>Pacientes</th>
                <th>Sedes</th>
                <th>Tutores</th>
                <th>Registrada</th>
              </tr>
            </thead>
            <tbody>
              @for (c of filteredClinics(); track c.id) {
                <tr class="clinic-row" (click)="toggleExpand(c.id)">
                  <td class="expand-cell">
                    <span class="material-symbols-outlined expand-icon" [class.open]="expandedClinicId() === c.id">
                      chevron_right
                    </span>
                  </td>
                  <td>
                    <strong>{{ c.name }}</strong>
                    <small>{{ c.email }}</small>
                  </td>
                  <td>
                    {{ c.businessType === 'independent_vet' ? 'Vet Independiente' : 'Clínica' }}
                  </td>
                  <td>{{ c.plan }}</td>
                  <td>
                    <span class="badge" [class]="'badge-' + c.subscriptionStatus">
                      {{ subscriptionLabel(c.subscriptionStatus) }}
                    </span>
                  </td>
                  <td>{{ c.city }}</td>
                  <td>{{ c.usersCount }}</td>
                  <td>{{ c.patientsCount }}</td>
                  <td>{{ c.branchesCount }}</td>
                  <td>{{ c.tutorsCount }}</td>
                  <td>{{ c.createdAt | date: 'dd/MM/yyyy' }}</td>
                </tr>
                @if (expandedClinicId() === c.id) {
                  <tr class="expanded-row">
                    <td [attr.colspan]="11">
                      @if (loadingUsersFor() === c.id) {
                        <p class="users-status">Cargando usuarios...</p>
                      } @else if (clinicUsersCache().get(c.id); as users) {
                        @if (users.length) {
                          <table class="users-subtable">
                            <thead>
                              <tr>
                                <th>Nombre</th>
                                <th>Correo</th>
                                <th>Rol</th>
                                <th>Sede</th>
                                <th>Estado</th>
                                <th>Último acceso</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (u of users; track u.id) {
                                <tr>
                                  <td>{{ u.firstName }} {{ u.lastName }}</td>
                                  <td>{{ u.email }}</td>
                                  <td>{{ roleLabel(u.role) }}</td>
                                  <td>{{ u.branchName || 'Global' }}</td>
                                  <td>
                                    <span class="badge" [class]="u.active ? 'badge-active' : 'badge-suspended'">
                                      {{ u.active ? 'Activo' : 'Inactivo' }}
                                    </span>
                                  </td>
                                  <td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'dd/MM/yyyy HH:mm') : 'Nunca ha iniciado sesión' }}</td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        } @else {
                          <p class="users-status">Este tenant no tiene usuarios registrados.</p>
                        }
                      }
                    </td>
                  </tr>
                }
              }
              @if (!filteredClinics().length) {
                <tr>
                  <td colspan="11" class="empty-row">No hay tenants que coincidan con el filtro.</td>
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
      .header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .analytics-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: #a78bfa;
        text-decoration: none;
        font-size: 0.85rem;
        font-weight: 600;
        border: 1px solid rgba(167, 139, 250, 0.3);
        padding: 9px 16px;
        border-radius: 10px;
        span {
          font-size: 18px;
        }
        &:hover {
          background: rgba(167, 139, 250, 0.1);
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
      }
      .table-header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 14px;
        h2 {
          font-size: 1.05rem;
          margin: 0;
        }
      }
      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        input,
        select {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #f3f4f6;
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 0.82rem;
          font-family: inherit;
          &:focus {
            outline: none;
            border-color: #a78bfa;
          }
        }
        input {
          min-width: 220px;
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
      .clinic-row {
        cursor: pointer;
        &:hover {
          background: rgba(255, 255, 255, 0.03);
        }
      }
      .expand-cell {
        width: 28px;
      }
      .expand-icon {
        font-size: 18px;
        color: #9ca3af;
        display: inline-block;
        transition: transform 0.15s ease;
        &.open {
          transform: rotate(90deg);
        }
      }
      .expanded-row td {
        background: rgba(255, 255, 255, 0.02);
        padding: 16px 20px;
      }
      .users-status {
        color: #9ca3af;
        font-size: 0.82rem;
        margin: 0;
      }
      .users-subtable {
        font-size: 0.8rem;
        th {
          font-size: 0.65rem;
        }
      }
      .badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 999px;
        font-size: 0.72rem;
        font-weight: 600;
        white-space: nowrap;
      }
      .badge-trial {
        background: rgba(167, 139, 250, 0.15);
        color: #a78bfa;
      }
      .badge-active {
        background: rgba(34, 197, 94, 0.15);
        color: #22c55e;
      }
      .badge-past_due {
        background: rgba(251, 191, 36, 0.15);
        color: #fbbf24;
      }
      .badge-suspended,
      .badge-cancelled {
        background: rgba(248, 113, 113, 0.15);
        color: #f87171;
      }
    `,
  ],
})
export class PlatformDashboardComponent implements OnInit {
  auth = inject(PlatformAuthService);

  stats = signal<PlatformStats | null>(null);
  clinics = signal<PlatformClinic[]>([]);

  searchTerm = signal('');
  businessTypeFilter = signal('');
  planFilter = signal('');

  expandedClinicId = signal<string | null>(null);
  loadingUsersFor = signal<string | null>(null);
  clinicUsersCache = signal<Map<string, PlatformClinicUser[]>>(new Map());

  filteredClinics = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const type = this.businessTypeFilter();
    const plan = this.planFilter();

    return this.clinics().filter((c) => {
      const matchesTerm =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term);
      const matchesType = !type || c.businessType === type;
      const matchesPlan = !plan || c.plan === plan;
      return matchesTerm && matchesType && matchesPlan;
    });
  });

  ngOnInit() {
    this.auth.getStats().subscribe((s) => this.stats.set(s));
    this.auth.getClinics().subscribe((c) => this.clinics.set(c));
  }

  toggleExpand(clinicId: string) {
    if (this.expandedClinicId() === clinicId) {
      this.expandedClinicId.set(null);
      return;
    }

    this.expandedClinicId.set(clinicId);

    if (this.clinicUsersCache().has(clinicId)) {
      return;
    }

    this.loadingUsersFor.set(clinicId);
    this.auth.getClinicUsers(clinicId).subscribe({
      next: (users) => {
        const next = new Map(this.clinicUsersCache());
        next.set(clinicId, users);
        this.clinicUsersCache.set(next);
        this.loadingUsersFor.set(null);
      },
      error: () => {
        const next = new Map(this.clinicUsersCache());
        next.set(clinicId, []);
        this.clinicUsersCache.set(next);
        this.loadingUsersFor.set(null);
      },
    });
  }

  roleLabel(role: string): string {
    return ROLE_LABELS[role] || role;
  }

  subscriptionLabel(status: string): string {
    return SUBSCRIPTION_LABELS[status] || status;
  }
}
