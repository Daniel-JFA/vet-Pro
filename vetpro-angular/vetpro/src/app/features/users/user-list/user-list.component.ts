import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

export interface UserItem {
  id: string;
  clinicId: string;
  branchId?: string | null;
  branchName: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'admin' | 'vet' | 'assistant' | 'receptionist' | 'walker' | 'groomer';
  active: boolean;
  createdAt: string;
}

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="users-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <div class="badge-role">👥 EQUIPO & PERMISOS DE ACCESO</div>
          <h1 class="page-title">Gestión de Usuarios y Roles Clínicos</h1>
          <p class="page-subtitle">
            Administra el personal de la clínica, asigna sedes de trabajo y controla los roles de acceso granular según la especialidad.
          </p>
        </div>

        <div class="header-actions">
          <button class="btn btn-outline" (click)="openSmtpModal()" title="Diagnóstico de Correo SMTP">
            <span class="material-symbols-outlined">forward_to_inbox</span>
            Servidor SMTP
          </button>
          <button class="btn btn-primary" (click)="openCreateModal()">
            <span class="material-symbols-outlined">person_add</span>
            Nuevo Usuario
          </button>
        </div>
      </div>

      <!-- Modalidad de Operación: Sede Física vs Veterinario Independiente -->
      <div class="business-mode-card" [class.independent]="isIndependentVet()">
        <div class="mode-info">
          <div class="mode-badge">
            <span class="material-symbols-outlined">{{ isIndependentVet() ? 'two_wheeler' : 'domain' }}</span>
            <span>{{ isIndependentVet() ? 'MODALIDAD: VETERINARIO INDEPENDIENTE' : 'MODALIDAD: CLÍNICA CON SEDES FÍSICAS' }}</span>
          </div>
          <div class="mode-text">
            <p *ngIf="isIndependentVet()">
              Tu cuenta opera como <strong>Práctica Independiente / Móvil</strong>. No requiere sucursales comerciales. Todos los usuarios tienen alcance móvil centralizado y gestionan pacientes sin atarse a una sede física.
            </p>
            <p *ngIf="!isIndependentVet()">
              Tu cuenta opera como <strong>Clínica con Sedes Físicas</strong>. Puedes organizar tu equipo asignándolos a sus respectivas sucursales o consultorios, o dejarlos como flotantes globales.
            </p>
          </div>
        </div>

        <div class="mode-toggle-action" *ngIf="auth.currentUser?.role === 'admin'">
          <button class="btn-toggle-mode" (click)="toggleBusinessType()">
            <span class="material-symbols-outlined">sync_alt</span>
            Cambiar a {{ isIndependentVet() ? 'Clínica con Sedes' : 'Vet Independiente' }}
          </button>
        </div>
      </div>

      <!-- Roles Breakdown Cards -->
      <div class="roles-guide-grid">
        <div class="role-guide-card admin">
          <div class="role-guide-header">
            <span class="role-icon">🛡️</span>
            <strong>Administrador</strong>
          </div>
          <p class="role-desc">Acceso total: finanzas, facturación electrónica DIAN, inventario, reportes y configuración de sedes.</p>
        </div>

        <div class="role-guide-card vet">
          <div class="role-guide-header">
            <span class="role-icon">🩺</span>
            <strong>Veterinario</strong>
          </div>
          <p class="role-desc">Consultas, Bitácora IA por voz (SOAP), recetas, hospitalización médica y órdenes de laboratorio.</p>
        </div>

        <div class="role-guide-card assistant">
          <div class="role-guide-header">
            <span class="role-icon">💉</span>
            <strong>Auxiliar / Enfermero</strong>
          </div>
          <p class="role-desc">Kardex horario de hospitalización, administración de dosis con descarga de stock y constantes vitales.</p>
        </div>

        <div class="role-guide-card receptionist">
          <div class="role-guide-header">
            <span class="role-icon">💼</span>
            <strong>Recepcionista / Caja</strong>
          </div>
          <p class="role-desc">Agenda, caja POS (apertura/cierre), registro de tutores/pacientes, facturas y avisos por WhatsApp.</p>
        </div>

        <div class="role-guide-card groomer">
          <div class="role-guide-header">
            <span class="role-icon">✂️</span>
            <strong>Peluquero / Estilista</strong>
          </div>
          <p class="role-desc">Kanban de Spa & Peluquería, baño medicado, corte de raza y aviso automático de recogida por WhatsApp.</p>
        </div>

        <div class="role-guide-card walker">
          <div class="role-guide-header">
            <span class="role-icon">🐕</span>
            <strong>Paseador (Walker)</strong>
          </div>
          <p class="role-desc">Gestión de rutas de paseo, fotos del recorrido y bitácora de actividad para los dueños.</p>
        </div>
      </div>

      <!-- KPI Numbers -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Total Empleados</span>
          <span class="kpi-val">{{ users().length }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Veterinarios Activos</span>
          <span class="kpi-val text-blue">{{ vetCount() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Auxiliares & Enfermería</span>
          <span class="kpi-val text-purple">{{ assistantCount() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Recepción & Servicios</span>
          <span class="kpi-val text-green">{{ otherCount() }}</span>
        </div>
      </div>

      <!-- Main Users Table Box -->
      <div class="table-card">
        <div class="table-top">
          <div class="search-box">
            <span class="material-symbols-outlined">search</span>
            <input
              type="text"
              [(ngModel)]="searchFilter"
              placeholder="Buscar por nombre, correo o rol..."
            />
          </div>
          <div class="filter-pills">
            <button class="pill" [class.active]="roleFilter() === 'all'" (click)="roleFilter.set('all')">Todos</button>
            <button class="pill" [class.active]="roleFilter() === 'vet'" (click)="roleFilter.set('vet')">Veterinarios</button>
            <button class="pill" [class.active]="roleFilter() === 'assistant'" (click)="roleFilter.set('assistant')">Auxiliares</button>
            <button class="pill" [class.active]="roleFilter() === 'receptionist'" (click)="roleFilter.set('receptionist')">Recepción</button>
            <button class="pill" [class.active]="roleFilter() === 'groomer'" (click)="roleFilter.set('groomer')">Peluqueros</button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Usuario / Profesional</th>
                <th>Correo de Acceso</th>
                <th>Rol / Perfil</th>
                <th>Sede de Operación</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of filteredUsers()">
                <td>
                  <div class="user-cell">
                    <div class="avatar-circle" [ngClass]="u.role">
                      {{ u.firstName.charAt(0) }}{{ u.lastName.charAt(0) }}
                    </div>
                    <div>
                      <strong class="user-name">{{ u.firstName }} {{ u.lastName }}</strong>
                      <span class="user-date">Registrado el {{ u.createdAt | date:'dd/MM/yyyy' }}</span>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="user-email">{{ u.email }}</span>
                </td>
                <td>
                  <span class="role-badge" [ngClass]="u.role">
                    {{ formatRoleName(u.role) }}
                  </span>
                </td>
                <td>
                  <span class="branch-pill" [class.independent]="isIndependentVet()">
                    <span class="material-symbols-outlined icon-small">{{ isIndependentVet() ? 'two_wheeler' : 'location_on' }}</span>
                    {{ isIndependentVet() ? 'Atención Móvil / Global' : u.branchName }}
                  </span>
                </td>
                <td>
                  <button
                    class="status-toggle"
                    [class.active]="u.active"
                    (click)="toggleUserStatus(u)"
                    title="Clic para cambiar estado"
                  >
                    <span class="status-dot"></span>
                    {{ u.active ? 'Activo' : 'Inactivo' }}
                  </button>
                </td>
                <td>
                  <div class="action-buttons">
                    <button class="btn-icon" (click)="openEditModal(u)" title="Editar Rol o Sede">
                      <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="btn-icon" (click)="openResetPasswordModal(u)" title="Restablecer Contraseña">
                      <span class="material-symbols-outlined">key</span>
                    </button>
                  </div>
                </td>
              </tr>
              <tr *ngIf="filteredUsers().length === 0">
                <td colspan="6" class="text-center py-6 text-muted">
                  No se encontraron usuarios que coincidan con la búsqueda.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- MODAL: CREAR USUARIO -->
      <div *ngIf="showCreateModal()" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Nuevo Usuario del Equipo</h3>
            <button class="close-btn" (click)="showCreateModal.set(false)">✕</button>
          </div>

          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre *</label>
                <input type="text" [(ngModel)]="newForm.firstName" placeholder="Ej: Santiago" class="form-input" />
              </div>
              <div class="form-group">
                <label>Apellido *</label>
                <input type="text" [(ngModel)]="newForm.lastName" placeholder="Ej: Gómez" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label>Correo Electrónico *</label>
              <input type="email" [(ngModel)]="newForm.email" placeholder="correo@vetpro.co" class="form-input" />
              <small class="field-hint">Se generará una contraseña temporal segura y se enviará a este correo.</small>
            </div>

            <div class="form-group">
              <label>Rol de Usuario *</label>
              <select [(ngModel)]="newForm.role" class="form-input select-role">
                <option value="vet">🩺 Médico Veterinario (Consultas, IA SOAP, Recetas)</option>
                <option value="assistant">💉 Auxiliar Veterinario (Kardex, Fluidoterapia, Dosis)</option>
                <option value="receptionist">💼 Recepcionista / Caja (Citas, POS, Facturación, WhatsApp)</option>
                <option value="groomer">✂️ Peluquero / Estilista (Spa, Baño Medicado, Kanban)</option>
                <option value="walker">🐕 Paseador (Rutas y Paseos)</option>
                <option value="admin">🛡️ Administrador (Acceso Total & Finanzas)</option>
              </select>
            </div>

            <div class="form-group" *ngIf="!isIndependentVet()">
              <label>Sede Física Asignada</label>
              <select [(ngModel)]="newForm.branchId" class="form-input">
                <option [ngValue]="null">Todas las Sedes / Flotante (Global)</option>
                <option *ngFor="let b of auth.clinicBranches()" [value]="b.id">{{ b.name }}</option>
              </select>
              <small class="field-hint">Si el usuario rota entre clínicas, déjalo en "Todas las sedes".</small>
            </div>

            <div class="form-group alert-independent" *ngIf="isIndependentVet()">
              <div class="independent-chip">
                <span class="material-symbols-outlined">two_wheeler</span>
                <div>
                  <strong>Alcance Global / Atención Móvil</strong>
                  <p>En modalidad de Veterinario Independiente, los usuarios no requieren sede física y operan en toda la cuenta profesional.</p>
                </div>
              </div>
            </div>

            <div class="smtp-alert-badge">
              <span class="material-symbols-outlined">forward_to_inbox</span>
              <div>
                <strong>Envío Automático de Credenciales</strong>
                <p>Al guardar, el sistema enviará un correo con el usuario, contraseña inicial y enlace de acceso al email registrado.</p>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showCreateModal.set(false)">Cancelar</button>
            <button class="btn btn-primary" (click)="submitCreateUser()">Crear Usuario</button>
          </div>
        </div>
      </div>

      <!-- MODAL: EDITAR USUARIO -->
      <div *ngIf="editingUser()" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <h3>Editar Usuario: {{ editingUser()?.firstName }} {{ editingUser()?.lastName }}</h3>
            <button class="close-btn" (click)="editingUser.set(null)">✕</button>
          </div>

          <div class="modal-body" *ngIf="editingUser() as user">
            <div class="form-row">
              <div class="form-group">
                <label>Nombre</label>
                <input type="text" [(ngModel)]="user.firstName" class="form-input" />
              </div>
              <div class="form-group">
                <label>Apellido</label>
                <input type="text" [(ngModel)]="user.lastName" class="form-input" />
              </div>
            </div>

            <div class="form-group">
              <label>Rol de Usuario</label>
              <select [(ngModel)]="user.role" class="form-input">
                <option value="admin">🛡️ Administrador</option>
                <option value="vet">🩺 Médico Veterinario</option>
                <option value="assistant">💉 Auxiliar Veterinario</option>
                <option value="receptionist">💼 Recepcionista / Caja</option>
                <option value="groomer">✂️ Peluquero / Estilista</option>
                <option value="walker">🐕 Paseador</option>
              </select>
            </div>

            <div class="form-group" *ngIf="!isIndependentVet()">
              <label>Sede Asignada</label>
              <select [(ngModel)]="user.branchId" class="form-input">
                <option [ngValue]="null">Todas las Sedes (Global)</option>
                <option *ngFor="let b of auth.clinicBranches()" [value]="b.id">{{ b.name }}</option>
              </select>
            </div>

            <div class="form-group alert-independent" *ngIf="isIndependentVet()">
              <div class="independent-chip">
                <span class="material-symbols-outlined">two_wheeler</span>
                <div>
                  <strong>Alcance Global / Atención Móvil</strong>
                  <p>Modalidad independiente activa: este usuario opera a nivel global.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="editingUser.set(null)">Cancelar</button>
            <button class="btn btn-primary" (click)="submitEditUser()">Guardar Cambios</button>
          </div>
        </div>
      </div>

      <!-- MODAL: DIAGNÓSTICO SMTP -->
      <div *ngIf="showSmtpModal()" class="modal-backdrop">
        <div class="modal-box">
          <div class="modal-header">
            <h3>⚙️ Servidor SMTP & Notificaciones</h3>
            <button class="close-btn" (click)="showSmtpModal.set(false)">✕</button>
          </div>

          <div class="modal-body">
            <p class="smtp-desc">
              VetPro envía automáticamente las credenciales de acceso a cada nuevo usuario registrado por la administración.
            </p>

            <div *ngIf="loadingSmtp()" class="smtp-loading">
              <span class="material-symbols-outlined spin">sync</span>
              Consultando estado del servidor SMTP...
            </div>

            <div *ngIf="!loadingSmtp() && smtpInfo()" class="smtp-card" [class.verified]="smtpInfo()?.verified" [class.error]="!smtpInfo()?.verified">
              <div class="smtp-status-title">
                <span class="material-symbols-outlined">{{ smtpInfo()?.verified ? 'check_circle' : 'warning' }}</span>
                <strong>{{ smtpInfo()?.verified ? 'Servidor de Correo Conectado y Listo' : 'Atención: Credenciales Pendientes de Configuración' }}</strong>
              </div>

              <div class="smtp-rows">
                <div class="smtp-row"><span>Host SMTP:</span> <strong>{{ smtpInfo()?.smtpHost }}</strong></div>
                <div class="smtp-row"><span>Cuenta Emisora:</span> <strong>{{ smtpInfo()?.smtpUser || 'No configurada' }}</strong></div>
                <div class="smtp-row" *ngIf="smtpInfo()?.message">
                  <span>Diagnóstico:</span> 
                  <code class="smtp-code">{{ smtpInfo()?.message }}</code>
                </div>
              </div>
            </div>

            <div class="test-email-section">
              <label>Enviar correo de prueba a:</label>
              <div class="test-input-group">
                <input type="email" [(ngModel)]="testRecipient" placeholder="correo@ejemplo.com" class="form-input" />
                <button class="btn btn-primary" [disabled]="testingSmtp() || !testRecipient" (click)="sendTestEmail()">
                  {{ testingSmtp() ? 'Enviando...' : 'Enviar Prueba' }}
                </button>
              </div>
              <p *ngIf="testResult()" class="test-msg" [class.success]="testResultSuccess()" [class.error]="!testResultSuccess()">
                {{ testResult() }}
              </p>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="showSmtpModal.set(false)">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .users-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .badge-role { font-size: 11px; font-weight: 700; color: #4338ca; background: #e0e7ff; padding: 4px 10px; border-radius: 20px; display: inline-block; margin-bottom: 6px; }
    .page-title { margin: 0 0 6px; font-size: 24px; font-weight: 800; color: #0f172a; }
    .page-subtitle { margin: 0; font-size: 13px; color: #64748b; max-width: 750px; }
    .btn { display: flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; }
    .btn-primary { background: #4338ca; color: #fff; &:hover { background: #3730a3; } }
    .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
    
    .roles-guide-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .role-guide-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; font-size: 12px; border-left: 4px solid #cbd5e1; }
    .role-guide-card.admin { border-left-color: #ef4444; }
    .role-guide-card.vet { border-left-color: #3b82f6; }
    .role-guide-card.assistant { border-left-color: #8b5cf6; }
    .role-guide-card.receptionist { border-left-color: #10b981; }
    .role-guide-card.groomer { border-left-color: #f59e0b; }
    .role-guide-card.walker { border-left-color: #06b6d4; }
    .role-guide-header { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
    .role-desc { margin: 0; color: #64748b; line-height: 1.4; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
    .kpi-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
    .kpi-label { font-size: 12px; font-weight: 600; color: #64748b; }
    .kpi-val { font-size: 22px; font-weight: 800; color: #0f172a; }
    .text-blue { color: #2563eb; }
    .text-purple { color: #7c3aed; }
    .text-green { color: #16a34a; }

    .table-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
    .table-top { padding: 16px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
    .search-box { display: flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 6px 12px; width: 320px; span { color: #64748b; } input { border: none; outline: none; width: 100%; font-size: 13px; } }
    .filter-pills { display: flex; gap: 8px; }
    .pill { background: #f1f5f9; border: none; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #475569; cursor: pointer; }
    .pill.active { background: #4338ca; color: #fff; }

    .table-responsive { overflow-x: auto; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .data-table th { background: #f8fafc; padding: 12px 16px; text-align: left; font-weight: 700; color: #475569; border-bottom: 1px solid #e2e8f0; }
    .data-table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; color: #334155; }
    
    .user-cell { display: flex; align-items: center; gap: 12px; }
    .avatar-circle { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #fff; background: #64748b; }
    .avatar-circle.admin { background: #ef4444; }
    .avatar-circle.vet { background: #3b82f6; }
    .avatar-circle.assistant { background: #8b5cf6; }
    .avatar-circle.receptionist { background: #10b981; }
    .avatar-circle.groomer { background: #f59e0b; }
    .avatar-circle.walker { background: #06b6d4; }
    .user-name { font-size: 14px; color: #0f172a; display: block; }
    .user-date { font-size: 11px; color: #64748b; }
    .user-email { font-family: monospace; font-size: 12px; color: #475569; }

    .role-badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 12px; display: inline-block; }
    .role-badge.admin { background: #fee2e2; color: #dc2626; }
    .role-badge.vet { background: #dbeafe; color: #1d4ed8; }
    .role-badge.assistant { background: #f3e8ff; color: #7e22ce; }
    .role-badge.receptionist { background: #d1fae5; color: #065f46; }
    .role-badge.groomer { background: #fef3c7; color: #b45309; }
    .role-badge.walker { background: #cffafe; color: #155e75; }

    .branch-pill { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #475569; background: #f1f5f9; padding: 4px 8px; border-radius: 6px; width: fit-content; }
    .icon-small { font-size: 16px; color: #64748b; }

    .status-toggle { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; border: 1px solid #cbd5e1; background: #f8fafc; color: #64748b; cursor: pointer; }
    .status-toggle.active { background: #dcfce7; color: #15803d; border-color: #bbf7d0; }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #94a3b8; }
    .status-toggle.active .status-dot { background: #16a34a; }

    .action-buttons { display: flex; gap: 6px; }
    .btn-icon { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px; cursor: pointer; color: #475569; display: flex; align-items: center; justify-content: center; span { font-size: 18px; } &:hover { background: #e2e8f0; } }

    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal-box { background: #fff; border-radius: 12px; max-width: 550px; width: 95%; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; }
    .modal-body { padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; }
    .modal-footer { padding: 14px 20px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 10px; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-group { display: flex; flex-direction: column; gap: 4px; label { font-size: 12px; font-weight: 700; color: #334155; } }
    .form-input { padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 13px; }
    .select-role { font-weight: 600; }
    .business-mode-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px 20px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);

      &.independent {
        background: #f0fdf4;
        border-color: #bbf7d0;
        .mode-badge {
          background: #dcfce7;
          color: #166534;
        }
      }
    }

    .mode-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      background: #e0e7ff;
      color: #3730a3;
      margin-bottom: 6px;
      span { font-size: 16px; }
    }

    .mode-text p {
      margin: 0;
      font-size: 13px;
      color: #475569;
      line-height: 1.4;
    }

    .btn-toggle-mode {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.2s;
      span { font-size: 16px; }
      &:hover { background: #f1f5f9; border-color: #94a3b8; }
    }

    .branch-pill.independent {
      background: #ecfdf5;
      color: #065f46;
      border: 1px solid #a7f3d0;
      .icon-small { color: #059669; }
    }

    .independent-chip {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 12px;
      span { font-size: 22px; color: #16a34a; }
      strong { font-size: 12px; color: #166534; display: block; }
      p { font-size: 11px; color: #475569; margin: 2px 0 0; }
    }

    .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; }

    .smtp-alert-badge {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 8px;
      padding: 10px 12px;
      margin-top: 14px;
      span { font-size: 22px; color: #2563eb; }
      strong { font-size: 12px; color: #1e40af; display: block; }
      p { font-size: 11px; color: #475569; margin: 2px 0 0; line-height: 1.4; }
    }

    .smtp-desc { font-size: 13px; color: #64748b; margin: 0 0 16px; line-height: 1.45; }
    .smtp-loading { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #2563eb; padding: 20px; justify-content: center; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    .smtp-card {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
      background: #f8fafc;
      &.verified { border-color: #86efac; background: #f0fdf4; .smtp-status-title { color: #166534; } }
      &.error { border-color: #fca5a5; background: #fef2f2; .smtp-status-title { color: #991b1b; } }
    }
    .smtp-status-title { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 700; margin-bottom: 12px; span { font-size: 20px; } }
    .smtp-rows { display: flex; flex-direction: column; gap: 6px; font-size: 12.5px; color: #334155; }
    .smtp-row span { color: #64748b; margin-right: 6px; }
    .smtp-code { display: block; font-family: monospace; font-size: 11px; background: rgba(0,0,0,0.04); padding: 6px 8px; border-radius: 4px; margin-top: 4px; word-break: break-all; }

    .test-email-section {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px;
      label { font-size: 12.5px; font-weight: 600; color: #334155; display: block; margin-bottom: 8px; }
    }
    .test-input-group { display: flex; gap: 8px; }
    .test-msg {
      margin: 10px 0 0;
      font-size: 12px;
      padding: 8px 10px;
      border-radius: 6px;
      &.success { background: #dcfce7; color: #166534; }
      &.error { background: #fee2e2; color: #991b1b; }
    }
  `]
})
export class UserListComponent implements OnInit {
  auth = inject(AuthService);

  clinic = signal<any>(null);
  isIndependentVet = computed(() => this.clinic()?.businessType === 'independent_vet');

  users = signal<UserItem[]>([]);
  searchFilter = '';
  roleFilter = signal<'all' | 'vet' | 'assistant' | 'receptionist' | 'groomer'>('all');

  showCreateModal = signal(false);
  editingUser = signal<UserItem | null>(null);

  // Estado del modal de diagnóstico SMTP
  showSmtpModal = signal(false);
  loadingSmtp = signal(false);
  smtpInfo = signal<any>(null);
  testRecipient = '';
  testingSmtp = signal(false);
  testResult = signal('');
  testResultSuccess = signal(false);

  newForm = {
    firstName: '',
    lastName: '',
    email: '',
    role: 'vet',
    branchId: null as string | null
  };

  vetCount = computed(() => this.users().filter(u => u.role === 'vet').length);
  assistantCount = computed(() => this.users().filter(u => u.role === 'assistant').length);
  otherCount = computed(() => this.users().filter(u => u.role !== 'vet' && u.role !== 'assistant').length);

  filteredUsers = computed(() => {
    let list = this.users();
    const query = this.searchFilter.toLowerCase().trim();
    const role = this.roleFilter();

    if (role !== 'all') {
      list = list.filter(u => u.role === role);
    }

    if (query) {
      list = list.filter(u =>
        u.firstName.toLowerCase().includes(query) ||
        u.lastName.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.role.toLowerCase().includes(query)
      );
    }

    return list;
  });

  ngOnInit() {
    this.loadUsers();
    this.loadClinic();
  }

  loadClinic() {
    this.auth.getClinic().subscribe({
      next: (data) => {
        this.clinic.set(data);
      },
      error: (err) => {
        console.warn('[Users] Error al cargar empresa:', err);
      }
    });
    this.auth.loadBranches().subscribe();
  }

  toggleBusinessType() {
    const nextType = this.isIndependentVet() ? 'clinic' : 'independent_vet';
    const label = nextType === 'independent_vet' 
      ? 'Veterinario Independiente (Móvil / Domiciliario)' 
      : 'Clínica con Sedes Físicas';

    const confirmMsg = nextType === 'independent_vet'
      ? '¿Deseas cambiar a modalidad "Veterinario Independiente"? Los usuarios operarán de forma centralizada sin requerir asignación a sedes físicas.'
      : '¿Deseas cambiar a modalidad "Clínica con Sedes"? Podrás organizar tu equipo por sucursales y consultorios físicos.';

    if (!confirm(confirmMsg)) return;

    this.auth.updateClinic({ businessType: nextType }).subscribe({
      next: (res) => {
        this.clinic.set(res.clinic);
        alert(`Modalidad de empresa actualizada a: ${label}`);
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.error || 'No se pudo actualizar la modalidad de la empresa.');
      }
    });
  }

  loadUsers() {
    this.auth.getUsers().subscribe({
      next: (data) => {
        this.users.set(data);
      },
      error: (err) => {
        console.warn('[Users] Error al cargar usuarios:', err);
      }
    });
  }

  formatRoleName(role: string): string {
    switch (role) {
      case 'admin': return '🛡️ Administrador';
      case 'vet': return '🩺 Médico Veterinario';
      case 'assistant': return '💉 Auxiliar / Enfermero';
      case 'receptionist': return '💼 Recepción / Caja';
      case 'groomer': return '✂️ Peluquero / Spa';
      case 'walker': return '🐕 Paseador (Walker)';
      default: return role;
    }
  }

  openCreateModal() {
    this.newForm = {
      firstName: '',
      lastName: '',
      email: '',
      role: 'vet',
      branchId: this.auth.activeBranchId() || null
    };
    this.showCreateModal.set(true);
  }

  submitCreateUser() {
    if (!this.newForm.firstName || !this.newForm.lastName || !this.newForm.email) {
      alert('Por favor complete todos los campos obligatorios.');
      return;
    }

    this.auth.createUser(this.newForm).subscribe({
      next: (res) => {
        // El correo falló al enviarse: es la única vez que el enlace se expone,
        // para que el admin pueda entregarlo manualmente al empleado.
        if (!res.emailSent && res.activationLink) {
          alert(
            `${res.message}\n\nEnlace de activación: ${res.activationLink}\n\n` +
            `Compártelo de forma segura con el usuario — expira en 7 días.`
          );
        } else {
          alert(res.message || 'Usuario creado exitosamente.');
        }
        this.showCreateModal.set(false);
        this.loadUsers();
      },
      error: (err) => {
        alert(err.error?.error || 'Error al crear usuario.');
      }
    });
  }

  toggleUserStatus(user: UserItem) {
    const newStatus = !user.active;
    this.auth.updateUser(user.id, { active: newStatus }).subscribe({
      next: () => {
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, active: newStatus } : u));
      },
      error: (err) => {
        alert(err.error?.error || 'No se pudo cambiar el estado del usuario.');
      }
    });
  }

  openEditModal(user: UserItem) {
    this.editingUser.set({ ...user });
  }

  submitEditUser() {
    const user = this.editingUser();
    if (!user) return;

    this.auth.updateUser(user.id, {
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      branchId: user.branchId
    }).subscribe({
      next: () => {
        alert('Usuario actualizado exitosamente.');
        this.editingUser.set(null);
        this.loadUsers();
      },
      error: (err) => alert(err.error?.error || 'Error al actualizar.')
    });
  }

  openResetPasswordModal(user: UserItem) {
    const newPass = prompt(`Ingrese la nueva contraseña para ${user.firstName} ${user.lastName} (mínimo 6 caracteres):`);
    if (!newPass) return;

    if (newPass.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    this.auth.resetUserPassword(user.id, newPass).subscribe({
      next: (res) => alert(res.message || 'Contraseña actualizada con éxito.'),
      error: (err) => alert(err.error?.error || 'Error al restablecer contraseña.')
    });
  }

  openSmtpModal() {
    this.showSmtpModal.set(true);
    this.loadingSmtp.set(true);
    this.testResult.set('');
    this.testRecipient = this.auth.currentUser?.email || '';

    this.auth.getSmtpStatus().subscribe({
      next: (res) => {
        this.smtpInfo.set(res);
        this.loadingSmtp.set(false);
      },
      error: (err) => {
        this.smtpInfo.set({ verified: false, message: err.error?.message || 'Error al verificar conexión SMTP' });
        this.loadingSmtp.set(false);
      }
    });
  }

  sendTestEmail() {
    if (!this.testRecipient) return;
    this.testingSmtp.set(true);
    this.testResult.set('');

    this.auth.testSmtp(this.testRecipient).subscribe({
      next: (res) => {
        this.testResult.set(res.message || 'Correo de prueba enviado con éxito.');
        this.testResultSuccess.set(true);
        this.testingSmtp.set(false);
      },
      error: (err) => {
        this.testResult.set(err.error?.error || 'No se pudo enviar el correo de prueba. Verifica el servidor SMTP.');
        this.testResultSuccess.set(false);
        this.testingSmtp.set(false);
      }
    });
  }
}
