import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PlatformAuthService,
  PlatformStats,
  PlatformClinic,
  PlatformClinicUser,
  PlatformAnnouncement,
  SupportTicket,
  AuditLog
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
  imports: [CommonModule, RouterLink, FormsModule],
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

      <div class="main-tabs">
        <button [class.active]="mainTab() === 'clinics'" (click)="mainTab.set('clinics')">
          <span class="material-symbols-outlined">domain</span> Tenants
        </button>
        <button [class.active]="mainTab() === 'announcements'" (click)="mainTab.set('announcements')">
          <span class="material-symbols-outlined">campaign</span> Anuncios
        </button>
        <button [class.active]="mainTab() === 'tickets'" (click)="mainTab.set('tickets')">
          <span class="material-symbols-outlined">support_agent</span> Tickets de Soporte
        </button>
        <button [class.active]="mainTab() === 'audit'" (click)="mainTab.set('audit')">
          <span class="material-symbols-outlined">security</span> Auditoría
        </button>
      </div>

      @if (mainTab() === 'clinics') {
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
          
          <div class="quick-tabs">
            <button [class.active]="statusFilter() === ''" (click)="statusFilter.set('')">Todos</button>
            <button [class.active]="statusFilter() === 'active'" (click)="statusFilter.set('active')">Activos</button>
            <button [class.active]="statusFilter() === 'trial'" (click)="statusFilter.set('trial')">En Prueba</button>
            <button [class.active]="statusFilter() === 'past_due'" (click)="statusFilter.set('past_due')">En Riesgo</button>
          </div>

          <div class="filters">
            <input
              type="text"
              placeholder="Buscar por nombre, correo o ciudad..."
              [value]="searchTerm()"
              (input)="searchTerm.set($any($event.target).value)"
            />
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
                <th>Salud</th>
                <th>Usuarios</th>
                <th>Pacientes</th>
                <th>Acciones</th>
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
                  <td>
                    <div class="health-indicator" [title]="'Score: ' + c.healthScore">
                      <div class="health-dot" [class]="'health-' + c.healthStatus"></div>
                      <span>{{ c.healthScore }}%</span>
                    </div>
                  </td>
                  <td>{{ c.usersCount }}</td>
                  <td>{{ c.patientsCount }}</td>
                  <td class="actions-cell" (click)="$event.stopPropagation()">
                    <button class="action-btn" title="Gestionar Plan" (click)="openPlanModal(c)">
                      <span class="material-symbols-outlined">settings</span>
                    </button>
                  </td>
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
                                <th>Acciones</th>
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
                                  <td>
                                    @if (u.lastLoginAt) {
                                      {{ u.lastLoginAt | date: 'dd/MM/yyyy HH:mm' }}
                                    } @else {
                                      <span style="color: #ef4444;">Nunca ha iniciado</span>
                                    }
                                  </td>
                                  <td class="actions-cell">
                                    @if (!u.lastLoginAt) {
                                      <div style="display: flex; gap: 6px;">
                                        <a [href]="'mailto:' + u.email + '?subject=Acceso a VetPro'" title="Enviar Correo" class="contact-btn mail">
                                          <span class="material-symbols-outlined" style="font-size: 18px;">mail</span>
                                        </a>
                                        <a [href]="'https://wa.me/' + cleanPhone(c.phone) + '?text=Hola, notamos que el usuario ' + u.firstName + ' no ha iniciado sesión en VetPro. ¿Podemos ayudarles?'" target="_blank" title="Enviar WhatsApp" class="contact-btn wa">
                                          <span class="material-symbols-outlined" style="font-size: 18px;">chat</span>
                                        </a>
                                      </div>
                                    }
                                  </td>
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

      <!-- Modal para Gestionar Plan -->
      @if (selectedClinicForPlan()) {
        <div class="modal-overlay" (click)="closePlanModal()">
          <div class="modal-content glass-effect" (click)="$event.stopPropagation()">
            <div class="modal-header">
              <h2>Gestionar: {{ selectedClinicForPlan()?.name }}</h2>
              <button class="close-btn" (click)="closePlanModal()">&times;</button>
            </div>
            
            <div class="form-group">
              <label>Plan de Suscripción</label>
              <select [(ngModel)]="editPlan">
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>

            <div class="form-group">
              <label>Estado de la Cuenta</label>
              <select [(ngModel)]="editStatus">
                <option value="active">Activa</option>
                <option value="trial">En Prueba</option>
                <option value="past_due">Pago Pendiente (En Riesgo)</option>
                <option value="suspended">Suspendida / Bloqueada</option>
              </select>
            </div>

            <div class="form-group">
              <label>Módulos a la carta (Feature Flags)</label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editFeatureFlags.ai_assistant" />
                Asistente IA (Doru)
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editFeatureFlags.dian_billing" />
                Facturación Electrónica DIAN
              </label>
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="editFeatureFlags.whatsapp_crm" />
                CRM Marketing WhatsApp
              </label>
            </div>

            <div class="modal-actions">
              <button class="cancel-btn" (click)="closePlanModal()">Cancelar</button>
              <button class="save-btn" (click)="savePlanChanges()">Guardar Cambios</button>
            </div>
          </div>
        </div>
      }
      } <!-- End Clinics Tab -->

      @if (mainTab() === 'announcements') {
        <section class="clinics-table-wrapper">
          <div class="table-header">
            <h2>Anuncios Globales</h2>
            <button class="save-btn" (click)="openAnnouncementModal()">
              <span class="material-symbols-outlined">add</span> Crear Anuncio
            </button>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Tipo</th>
                  <th>Plan Destino</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (a of announcements(); track a.id) {
                  <tr>
                    <td><strong>{{ a.title }}</strong></td>
                    <td><span class="badge" [class]="'badge-' + a.type">{{ a.type }}</span></td>
                    <td>{{ a.targetPlan || 'Todos' }}</td>
                    <td>
                      <span class="badge" [class]="a.isActive ? 'badge-active' : 'badge-suspended'">
                        {{ a.isActive ? 'Activo' : 'Inactivo' }}
                      </span>
                    </td>
                    <td>{{ a.createdAt | date:'short' }}</td>
                    <td class="actions-cell">
                      <button class="action-btn" (click)="toggleAnnouncement(a)">
                        <span class="material-symbols-outlined">{{ a.isActive ? 'visibility_off' : 'visibility' }}</span>
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (showAnnouncementModal()) {
          <div class="modal-overlay" (click)="showAnnouncementModal.set(false)">
            <div class="modal-content glass-effect" (click)="$event.stopPropagation()">
              <div class="modal-header">
                <h2>Nuevo Anuncio Global</h2>
                <button class="close-btn" (click)="showAnnouncementModal.set(false)">&times;</button>
              </div>
              <div class="form-group">
                <label>Título</label>
                <input type="text" [(ngModel)]="newAnnouncement.title" placeholder="Ej: Nuevo Asistente de IA" class="basic-input" />
              </div>
              <div class="form-group">
                <label>Mensaje</label>
                <textarea [(ngModel)]="newAnnouncement.message" rows="4" class="basic-input" placeholder="Detalles del anuncio..."></textarea>
              </div>
              <div class="form-group">
                <label>Tipo</label>
                <select [(ngModel)]="newAnnouncement.type">
                  <option value="info">Info</option>
                  <option value="success">Éxito</option>
                  <option value="warning">Advertencia</option>
                  <option value="error">Alerta Roja</option>
                </select>
              </div>
              <div class="form-group">
                <label>Público Objetivo (Plan)</label>
                <select [(ngModel)]="newAnnouncement.targetPlan">
                  <option [ngValue]="null">Todos los planes</option>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              <div class="modal-actions">
                <button class="cancel-btn" (click)="showAnnouncementModal.set(false)">Cancelar</button>
                <button class="save-btn" (click)="saveAnnouncement()">Publicar</button>
              </div>
            </div>
          </div>
        }
      }

      @if (mainTab() === 'tickets') {
        <section class="clinics-table-wrapper">
          <div class="table-header">
            <h2>Tickets de Soporte (Help Desk)</h2>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Clínica</th>
                  <th>Usuario</th>
                  <th>Asunto</th>
                  <th>Prioridad</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (t of tickets(); track t.id) {
                  <tr>
                    <td>
                      <strong>{{ t.clinic?.name }}</strong>
                      <small>{{ t.clinic?.plan }}</small>
                    </td>
                    <td>
                      {{ t.user?.firstName }} {{ t.user?.lastName }}
                      <small>{{ t.user?.email }}</small>
                    </td>
                    <td>
                      <strong>{{ t.subject }}</strong>
                      <small>{{ t.description | slice:0:50 }}...</small>
                    </td>
                    <td><span class="badge" [class]="'badge-' + t.priority">{{ t.priority }}</span></td>
                    <td><span class="badge" [class]="'badge-' + t.status">{{ t.status }}</span></td>
                    <td>{{ t.createdAt | date:'short' }}</td>
                    <td class="actions-cell">
                      @if (t.status !== 'resolved' && t.status !== 'closed') {
                        <button class="action-btn" title="Marcar Resuelto" (click)="resolveTicket(t)">
                          <span class="material-symbols-outlined">check_circle</span>
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }

      @if (mainTab() === 'audit') {
        <section class="clinics-table-wrapper">
          <div class="table-header">
            <h2>Registro de Auditoría (Security Logs)</h2>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Acción</th>
                  <th>Entidad</th>
                  <th>ID Entidad</th>
                  <th>Usuario Autor</th>
                </tr>
              </thead>
              <tbody>
                @for (log of auditLogs(); track log.id) {
                  <tr>
                    <td>{{ log.createdAt | date:'short' }}</td>
                    <td><span class="badge badge-info">{{ log.action }}</span></td>
                    <td>{{ log.entity }}</td>
                    <td><small style="color: #9ca3af;">{{ log.entityId || 'N/A' }}</small></td>
                    <td>{{ log.userId || 'Sistema' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
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
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        gap: 24px;
        margin-bottom: 32px;
      }
      .stat-card {
        background: linear-gradient(145deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 28px 24px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        position: relative;
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        &:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 24px -10px rgba(167, 139, 250, 0.25);
          border-color: rgba(167, 139, 250, 0.3);
        }
        span.material-symbols-outlined {
          font-size: 32px;
          color: #a78bfa;
          margin-bottom: 8px;
        }
        strong {
          font-size: 2.5rem;
          font-weight: 800;
          line-height: 1.1;
        }
        small {
          font-size: 0.85rem;
          color: #cbd5e1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
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
          padding: 12px 16px;
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 0.7rem;
          letter-spacing: 0.4px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        td {
          padding: 18px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          vertical-align: top;
          strong {
            display: block;
            color: #f3f4f6;
            font-size: 0.9rem;
          }
          small {
            color: #9ca3af;
            font-size: 0.8rem;
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
        .contact-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          color: #fff;
          text-decoration: none;
          transition: transform 0.2s;
          &:hover {
            transform: scale(1.1);
          }
          &.mail { background: #3b82f6; }
          &.wa { background: #25D366; }
        }
      }

      /* Health Indicator */
      .health-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        span {
          font-size: 0.75rem;
        }
      }
      .health-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        box-shadow: 0 0 8px currentColor;
      }
      .health-green { color: #22c55e; background: #22c55e; }
      .health-yellow { color: #f59e0b; background: #f59e0b; }
      .health-red { color: #ef4444; background: #ef4444; }

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
      .badge-info { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
      .badge-success { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
      .badge-warning { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
      .badge-error { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
      .badge-high, .badge-critical { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
      .badge-medium { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
      .badge-low { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
      .badge-open { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
      .badge-in_progress { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
      .badge-resolved, .badge-closed { background: rgba(34, 197, 94, 0.15); color: #22c55e; }

      /* Main Tabs */
      .main-tabs {
        display: flex;
        gap: 16px;
        margin-bottom: 24px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 12px;
        button {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 1.05rem;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 8px;
          transition: all 0.2s;
          &:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.05);
          }
          &.active {
            color: #a78bfa;
            background: rgba(167, 139, 250, 0.15);
          }
        }
      }
      
      /* Quick Tabs */
      .quick-tabs {
        display: flex;
        gap: 8px;
        button {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #9ca3af;
          padding: 8px 18px; /* 👈 Más amplio */
          border-radius: 20px; /* 👈 Pill shape */
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
          &:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #fff;
          }
          &.active {
            background: rgba(167, 139, 250, 0.2);
            border-color: rgba(167, 139, 250, 0.5);
            color: #a78bfa;
            font-weight: 600;
          }
        }
      }

      /* Actions Cell */
      .actions-cell {
        display: flex;
        gap: 6px;
      }
      .action-btn {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: #cbd5e1;
        width: 32px;
        height: 32px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        span {
          font-size: 16px;
        }
        &:hover {
          background: rgba(167, 139, 250, 0.2);
          color: #a78bfa;
          border-color: rgba(167, 139, 250, 0.4);
        }
      }

      /* Modal Overlay */
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      .modal-content {
        background: hsl(220, 25%, 10%);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        width: 400px;
        padding: 24px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        h2 {
          margin: 0;
          font-size: 1.1rem;
          color: #fff;
        }
        .close-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 24px;
          cursor: pointer;
          &:hover { color: #fff; }
        }
      }
      .form-group {
        margin-bottom: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        label {
          font-size: 0.8rem;
          color: #cbd5e1;
          font-weight: 600;
        }
        select, .basic-input {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 10px;
          border-radius: 8px;
          font-family: inherit;
          outline: none;
          &:focus {
            border-color: #a78bfa;
          }
        }
        textarea.basic-input {
          resize: vertical;
        }
      }
      .checkbox-label {
        display: flex;
        align-items: center;
        flex-direction: row;
        gap: 8px;
        font-size: 0.85rem;
        color: #f3f4f6;
        font-weight: normal;
        cursor: pointer;
        input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
      }
      .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 24px;
        .cancel-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #cbd5e1;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
          &:hover { background: rgba(255, 255, 255, 0.05); }
        }
        .save-btn {
          background: #7c3aed;
          border: none;
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          &:hover { background: #6d28d9; }
        }
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
  statusFilter = signal('');

  expandedClinicId = signal<string | null>(null);
  loadingUsersFor = signal<string | null>(null);
  clinicUsersCache = signal<Map<string, PlatformClinicUser[]>>(new Map());

  // Modal State
  selectedClinicForPlan = signal<any | null>(null);
  editPlan = '';
  editStatus = '';
  editFeatureFlags: any = { ai_assistant: false, dian_billing: false, whatsapp_crm: false };

  mainTab = signal<'clinics'|'announcements'|'tickets'|'audit'>('clinics');
  announcements = signal<PlatformAnnouncement[]>([]);
  tickets = signal<SupportTicket[]>([]);
  auditLogs = signal<AuditLog[]>([]);

  showAnnouncementModal = signal(false);
  newAnnouncement: Partial<PlatformAnnouncement> = {
    title: '', message: '', type: 'info', targetPlan: null
  };

  filteredClinics = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const type = this.businessTypeFilter();
    const plan = this.planFilter();
    const status = this.statusFilter();

    return this.clinics().filter((c) => {
      const matchesTerm =
        !term ||
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.city.toLowerCase().includes(term);
      const matchesType = !type || c.businessType === type;
      const matchesPlan = !plan || c.plan === plan;
      const matchesStatus = !status || c.subscriptionStatus === status;
      return matchesTerm && matchesType && matchesPlan && matchesStatus;
    });
  });

  ngOnInit() {
    this.auth.getStats().subscribe((s) => this.stats.set(s));
    this.auth.getClinics().subscribe((c) => this.clinics.set(c));
    this.auth.getAnnouncements().subscribe((a) => this.announcements.set(a));
    this.auth.getTickets().subscribe((t) => this.tickets.set(t));
    this.auth.getAuditLogs().subscribe((l) => this.auditLogs.set(l));
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

  cleanPhone(phone: string | undefined): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  }

  // Tenant Management Actions
  openPlanModal(clinic: any) {
    this.selectedClinicForPlan.set(clinic);
    this.editPlan = clinic.plan;
    this.editStatus = clinic.subscriptionStatus;
    this.editFeatureFlags = clinic.featureFlags ? { ...clinic.featureFlags } : { ai_assistant: false, dian_billing: false, whatsapp_crm: false };
  }

  closePlanModal() {
    this.selectedClinicForPlan.set(null);
  }

  savePlanChanges() {
    const clinic = this.selectedClinicForPlan();
    if (!clinic) return;

    this.auth.changeClinicPlan(clinic.id, { 
      plan: this.editPlan, 
      status: this.editStatus,
      featureFlags: this.editFeatureFlags 
    }).subscribe({
      next: (res) => {
        // Actualizar la lista en local para reflejar cambios de inmediato
        this.clinics.update(list => list.map(c => c.id === clinic.id ? { 
          ...c, 
          plan: this.editPlan, 
          subscriptionStatus: this.editStatus,
          featureFlags: { ...this.editFeatureFlags }
        } : c));
        this.closePlanModal();
      },
      error: (err) => alert(err?.error?.error || 'Error al cambiar plan.')
    });
  }

  // ─────────────────────────────────────────
  // Anuncios
  // ─────────────────────────────────────────
  openAnnouncementModal() {
    this.newAnnouncement = { title: '', message: '', type: 'info', targetPlan: null };
    this.showAnnouncementModal.set(true);
  }

  saveAnnouncement() {
    this.auth.createAnnouncement(this.newAnnouncement).subscribe({
      next: (ann) => {
        this.announcements.update(list => [ann, ...list]);
        this.showAnnouncementModal.set(false);
      },
      error: (err) => alert('Error al crear anuncio')
    });
  }

  toggleAnnouncement(a: PlatformAnnouncement) {
    this.auth.toggleAnnouncement(a.id, !a.isActive).subscribe({
      next: (res) => {
        this.announcements.update(list => list.map(item => item.id === res.id ? res : item));
      },
      error: (err) => alert('Error al cambiar estado del anuncio')
    });
  }

  // ─────────────────────────────────────────
  // Tickets
  // ─────────────────────────────────────────
  resolveTicket(t: SupportTicket) {
    if (confirm(`¿Marcar el ticket "${t.subject}" como resuelto?`)) {
      this.auth.resolveTicket(t.id, 'resolved').subscribe({
        next: (res) => {
          this.tickets.update(list => list.map(item => item.id === res.id ? { ...item, status: 'resolved' } : item));
        },
        error: (err) => alert('Error al resolver el ticket')
      });
    }
  }
}
