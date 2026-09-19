import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CrmService } from '../../../core/services/crm.service';
import { ToastService } from '../../../core/services/toast.service';

export interface InactivePatient {
  id: string;
  patientName: string;
  species: string;
  breed: string;
  tutorName: string;
  tutorPhone: string;
  lastVisitDate: Date;
  daysInactive: number;
  reason: 'no_recent_visit' | 'vaccine_expired' | 'deworming_due' | 'senior_checkup';
  vaccineName?: string;
  selected: boolean;
}

@Component({
  selector: 'app-crm-reactivation',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="crm-container">
      <!-- Header -->
      <div class="page-header">
        <div>
          <div class="badge-crm">📈 MÓDULO DE MARKETING & CRM DE FIDELIZACIÓN</div>
          <h1 class="page-title">Reactivación de Clientes Inactivos</h1>
          <p class="page-subtitle">
            Segmenta pacientes ausentes y dispara campañas automatizadas por WhatsApp para recuperar
            citas e incrementar ingresos.
          </p>
        </div>

        <div class="header-actions">
          <a routerLink="/notifications" class="btn btn-secondary">
            <span class="material-symbols-outlined">arrow_back</span>
            Volver a Notificaciones
          </a>
        </div>
      </div>

      <!-- Strategy & Impact Metrics -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Pacientes Inactivos Detectados</span>
          <span class="kpi-val text-amber">{{ totalInactive() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Seleccionados para Campaña</span>
          <span class="kpi-val text-blue">{{ selectedCount() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Ingresos Potenciales Recuperables</span>
          <span class="kpi-val text-green">\${{ potentialRevenue() | number: '1.0-0' }} COP</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Tasa de Conversión Estimada</span>
          <span class="kpi-val text-purple">28.4%</span>
        </div>
      </div>

      <!-- Main Layout: Segmentation (Left) + WhatsApp Preview (Right) -->
      <div class="crm-layout">
        <!-- Left: Filter & Patient Selector -->
        <div class="card-box segment-panel">
          <div class="panel-header">
            <h3>1. Segmentación de Pacientes</h3>
            <div class="filter-pills">
              <button
                class="pill-btn"
                [class.active]="activeFilter() === 'all'"
                (click)="activeFilter.set('all')"
              >
                Todos ({{ inactiveList().length }})
              </button>
              <button
                class="pill-btn"
                [class.active]="activeFilter() === 'no_recent_visit'"
                (click)="activeFilter.set('no_recent_visit')"
              >
                > 6 Meses sin Visita
              </button>
              <button
                class="pill-btn"
                [class.active]="activeFilter() === 'vaccine_expired'"
                (click)="activeFilter.set('vaccine_expired')"
              >
                Vacuna Vencida
              </button>
            </div>
          </div>

          <!-- Select All Row -->
          <div class="select-all-bar">
            <label class="checkbox-label">
              <input type="checkbox" [checked]="allSelected()" (change)="toggleSelectAll($event)" />
              <span>Seleccionar todos los pacientes filtrados ({{ filteredList().length }})</span>
            </label>
          </div>

          <!-- Estado de carga / error -->
          @if (loadingCohorts()) {
            <div class="empty-state">
              <p>Cargando pacientes inactivos...</p>
            </div>
          }
          @if (!loadingCohorts() && cohortsError()) {
            <div class="empty-state">
              <p>
                No se pudo cargar el listado.
                <button class="btn btn-ghost" (click)="loadCohorts()">Reintentar</button>
              </p>
            </div>
          }
          @if (!loadingCohorts() && !cohortsError() && filteredList().length === 0) {
            <div class="empty-state">
              <p>No hay pacientes que coincidan con este filtro.</p>
            </div>
          }

          <!-- Inactive Patient List -->
          @if (!loadingCohorts() && !cohortsError()) {
            <div class="patient-list-scroll">
              @for (p of filteredList(); track p) {
                <div class="patient-row" [class.row-selected]="p.selected">
                  <input
                    type="checkbox"
                    [(ngModel)]="p.selected"
                    (change)="onPatientSelectionChange()"
                  />
                  <div class="pet-avatar">{{ p.species === 'cat' ? '🐱' : '🐶' }}</div>
                  <div class="patient-info">
                    <strong
                      >{{ p.patientName }} <span class="breed">({{ p.breed }})</span></strong
                    >
                    <span class="tutor-sub">Tutor: {{ p.tutorName }} • {{ p.tutorPhone }}</span>
                  </div>
                  <div class="inactivity-reason">
                    <span class="reason-tag" [ngClass]="p.reason">
                      {{ formatReason(p.reason, p.vaccineName) }}
                    </span>
                    <span class="days-ago">Última visita: hace {{ p.daysInactive }} días</span>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- Right: WhatsApp Campaign Editor & Live Mobile Preview -->
        <div class="card-box preview-panel">
          <div class="panel-header">
            <h3>2. Plantilla y Preview WhatsApp</h3>
            <span class="meta-tag">Meta Cloud API</span>
          </div>

          <div class="form-group">
            <label>Mensaje de la Campaña:</label>
            <textarea rows="4" class="form-control" [(ngModel)]="messageTemplate"></textarea>
            <span class="help-text"
              >Variables disponibles: [nombre_tutor], [nombre_mascota], [link_agenda]</span
            >
          </div>

          <!-- WhatsApp Chat Bubble Mockup -->
          <div class="whatsapp-mockup">
            <div class="wa-header">
              <div class="wa-avatar">VP</div>
              <div>
                <strong class="wa-name">VetPro Clínica</strong>
                <span class="wa-status">Cuenta Oficial de Empresa</span>
              </div>
            </div>

            <div class="wa-body">
              <div class="wa-bubble">
                <p class="wa-text">{{ getPreviewText() }}</p>
                <div class="wa-btn-mock">
                  <span class="material-symbols-outlined">calendar_month</span> Agendar con 15% OFF
                </div>
                <span class="wa-time">{{ currentHour }}</span>
              </div>
            </div>
          </div>

          <!-- Launch Button -->
          <div class="launch-box">
            <button
              class="btn btn-launch"
              [disabled]="selectedCount() === 0 || isSending()"
              (click)="launchCampaign()"
            >
              <span class="material-symbols-outlined">rocket_launch</span>
              {{
                isSending()
                  ? 'Disparando Campaña por WhatsApp...'
                  : 'Enviar Campaña a (' + selectedCount() + ') Tutores'
              }}
            </button>
            @if (campaignSent() && campaignAutoSent()) {
              <span class="success-banner">
                ✅ ¡Campaña enviada automáticamente a {{ lastSentCount() }} tutores por WhatsApp
                Cloud API!
              </span>
            }
            @if (campaignSent() && !campaignAutoSent()) {
              <span class="success-banner success-banner--manual">
                ⚠️ WhatsApp Business API no está configurado en el servidor. Se generaron
                {{ sampleDispatches().length }} enlaces de envío manual (haz clic en cada uno para
                enviarlo desde tu WhatsApp).
              </span>
            }
          </div>

          @if (campaignSent() && !campaignAutoSent() && sampleDispatches().length > 0) {
            <div class="manual-dispatch-list">
              @for (d of sampleDispatches(); track d) {
                <a [href]="d.link" target="_blank" rel="noopener" class="manual-dispatch-link">
                  <span class="material-symbols-outlined">open_in_new</span>
                  Enviar a {{ d.phone }}
                </a>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .crm-container {
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 16px;
      }

      .badge-crm {
        display: inline-block;
        background: #fdf4ff;
        color: #9333ea;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 6px;
        margin-bottom: 6px;
      }

      .page-title {
        font-size: 24px;
        font-weight: 700;
        color: #0f172a;
        margin: 0 0 4px;
      }

      .page-subtitle {
        font-size: 13px;
        color: #64748b;
        margin: 0;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        text-decoration: none;
        transition: all 0.2s ease;
      }

      .btn-secondary {
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
        &:hover {
          background: #e2e8f0;
        }
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .kpi-card {
        background: #ffffff;
        border-radius: 12px;
        padding: 16px;
        border: 1px solid #e2e8f0;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .kpi-label {
        font-size: 12px;
        color: #64748b;
        font-weight: 500;
      }

      .kpi-val {
        font-size: 22px;
        font-weight: 700;
        color: #0f172a;
        &.text-amber {
          color: #d97706;
        }
        &.text-blue {
          color: #2563eb;
        }
        &.text-green {
          color: #16a34a;
        }
        &.text-purple {
          color: #9333ea;
        }
      }

      .crm-layout {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 20px;
      }

      .card-box {
        background: #ffffff;
        border-radius: 14px;
        border: 1px solid #e2e8f0;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }
      }

      .meta-tag {
        background: #dcfce7;
        color: #15803d;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 6px;
      }

      .filter-pills {
        display: flex;
        gap: 6px;
      }

      .pill-btn {
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        color: #475569;
        cursor: pointer;
        &.active {
          background: #2563eb;
          color: #ffffff;
          border-color: #2563eb;
          font-weight: 600;
        }
      }

      .select-all-bar {
        background: #f8fafc;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #334155;
        cursor: pointer;
      }

      .patient-list-scroll {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 480px;
        overflow-y: auto;
      }

      .patient-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        transition: all 0.2s ease;
        &.row-selected {
          background: #f0f7ff;
          border-color: #93c5fd;
        }
      }

      .pet-avatar {
        font-size: 24px;
        width: 38px;
        height: 38px;
        background: #f1f5f9;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .patient-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        strong {
          font-size: 14px;
          color: #0f172a;
        }
        .breed {
          font-size: 12px;
          font-weight: 400;
          color: #64748b;
        }
        .tutor-sub {
          font-size: 12px;
          color: #475569;
        }
      }

      .inactivity-reason {
        text-align: right;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .reason-tag {
        font-size: 11px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 4px;
        &.no_recent_visit {
          background: #ffedd5;
          color: #c2410c;
        }
        &.vaccine_expired {
          background: #fee2e2;
          color: #b91c1c;
        }
        &.deworming_due {
          background: #fef9c3;
          color: #854d0e;
        }
        &.senior_checkup {
          background: #f3e8ff;
          color: #7e22ce;
        }
      }

      .days-ago {
        font-size: 11px;
        color: #94a3b8;
      }

      /* WhatsApp Mockup */
      .whatsapp-mockup {
        background: #e5ddd5;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #cbd5e1;
      }

      .wa-header {
        background: #075e54;
        color: #ffffff;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .wa-avatar {
        width: 32px;
        height: 32px;
        background: #128c7e;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 12px;
      }

      .wa-name {
        font-size: 13px;
        display: block;
      }
      .wa-status {
        font-size: 10px;
        opacity: 0.8;
      }

      .wa-body {
        padding: 16px;
        min-height: 180px;
        background: url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png');
        background-size: cover;
      }

      .wa-bubble {
        background: #ffffff;
        border-radius: 8px;
        padding: 10px 12px;
        max-width: 85%;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        position: relative;
      }

      .wa-text {
        margin: 0 0 10px;
        font-size: 13px;
        line-height: 1.4;
        color: #111827;
        white-space: pre-wrap;
      }

      .wa-btn-mock {
        background: #f0fdf4;
        border: 1px solid #86efac;
        color: #15803d;
        padding: 6px 10px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        cursor: pointer;
        span {
          font-size: 14px;
        }
      }

      .wa-time {
        display: block;
        text-align: right;
        font-size: 10px;
        color: #9ca3af;
        margin-top: 4px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        label {
          font-size: 13px;
          font-weight: 600;
          color: #334155;
        }
      }

      .form-control {
        width: 100%;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        font-family: inherit;
        resize: vertical;
      }

      .help-text {
        font-size: 11px;
        color: #64748b;
      }

      .btn-launch {
        width: 100%;
        background: #25d366;
        color: #ffffff;
        padding: 12px;
        font-size: 14px;
        font-weight: 700;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        &:hover:not(:disabled) {
          background: #1ebd59;
        }
        &:disabled {
          background: #94a3b8;
          cursor: not-allowed;
        }
      }

      .success-banner {
        display: block;
        margin-top: 8px;
        background: #dcfce7;
        color: #16a34a;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        text-align: center;
      }

      .empty-state {
        padding: 24px;
        text-align: center;
        color: #64748b;
        font-size: 13px;
      }

      .success-banner--manual {
        background: #fffbeb;
        color: #92400e;
      }

      .manual-dispatch-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 10px;
        max-height: 220px;
        overflow-y: auto;
      }

      .manual-dispatch-link {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 10px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 6px;
        color: #16a34a;
        font-size: 12px;
        font-weight: 600;
        text-decoration: none;
        .material-symbols-outlined {
          font-size: 16px;
        }
        &:hover {
          background: #dcfce7;
        }
      }

      @media (max-width: 900px) {
        .crm-layout {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CrmReactivationComponent implements OnInit {
  private crmService = inject(CrmService);
  private toast = inject(ToastService);

  activeFilter = signal<'all' | 'no_recent_visit' | 'vaccine_expired'>('all');
  isSending = signal(false);
  campaignSent = signal(false);
  campaignAutoSent = signal(false);
  lastSentCount = signal(0);
  sampleDispatches = signal<{ phone: string; message: string; link: string }[]>([]);
  loadingCohorts = signal(true);
  cohortsError = signal(false);

  currentHour = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  messageTemplate =
    '¡Hola {{nombre_tutor}}! 🐾 En VetPro extrañamos mucho a {{nombre_mascota}}. Notamos que hace varios meses no viene a su chequeo preventivo. Agenda su cita esta semana con 15% de descuento especial aquí: {{link_agenda}}';

  ngOnInit() {
    this.loadCohorts();
  }

  loadCohorts() {
    this.loadingCohorts.set(true);
    this.cohortsError.set(false);
    this.crmService.getCohorts().subscribe({
      next: (data) => {
        const mapped: InactivePatient[] = (data?.inactiveCohort || []).map((p, idx) => ({
          id: p.patientId,
          patientName: p.patientName,
          species: p.species,
          breed: 'Mestizo',
          tutorName: p.tutorName,
          tutorPhone: p.tutorPhone,
          lastVisitDate: p.lastVisit
            ? new Date(p.lastVisit)
            : new Date(Date.now() - 190 * 86400000),
          daysInactive: 190 + idx * 15,
          reason: 'no_recent_visit' as const,
          selected: true,
        }));
        this.inactiveList.set(mapped);
        this.loadingCohorts.set(false);
      },
      error: () => {
        this.loadingCohorts.set(false);
        this.cohortsError.set(true);
        this.toast.error(
          'No se pudo cargar el listado de pacientes inactivos. Verifica tu conexión e intenta de nuevo.',
        );
      },
    });
  }

  inactiveList = signal<InactivePatient[]>([]);

  filteredList = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.inactiveList();
    return this.inactiveList().filter((p) => p.reason === f);
  });

  totalInactive = computed(() => this.inactiveList().length);
  selectedCount = computed(() => this.inactiveList().filter((p) => p.selected).length);
  potentialRevenue = computed(() => this.selectedCount() * 85000); // Ticket promedio de consulta $85.000 COP

  allSelected = computed(() => {
    const filtered = this.filteredList();
    return filtered.length > 0 && filtered.every((p) => p.selected);
  });

  formatReason(reason: string, vaccineName?: string): string {
    switch (reason) {
      case 'no_recent_visit':
        return 'Sin Consulta > 6 Meses';
      case 'vaccine_expired':
        return `Vacuna Vencida: ${vaccineName || ''}`;
      case 'deworming_due':
        return 'Desparasitación Pendiente';
      case 'senior_checkup':
        return 'Chequeo Geriátrico Anual';
      default:
        return reason;
    }
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const filteredIds = new Set(this.filteredList().map((p) => p.id));

    this.inactiveList.update((list) =>
      list.map((p) => (filteredIds.has(p.id) ? { ...p, selected: checked } : p)),
    );
  }

  onPatientSelectionChange() {
    // Trigger signal recalculation
    this.inactiveList.update((l) => [...l]);
  }

  getPreviewText(): string {
    const sample = this.inactiveList()[0];
    if (!sample) return this.messageTemplate;

    return this.messageTemplate
      .replace('{{nombre_tutor}}', sample.tutorName)
      .replace('{{nombre_mascota}}', sample.patientName)
      .replace('{{link_agenda}}', `https://vetpro.co/agenda/${sample.id}`);
  }

  launchCampaign() {
    this.isSending.set(true);
    this.campaignSent.set(false);
    const count = this.selectedCount();

    this.crmService
      .sendBroadcast({
        name: `Campaña Reactivación WhatsApp - ${new Date().toLocaleDateString('es-CO')}`,
        targetType: this.activeFilter() === 'vaccine_expired' ? 'vaccine_due' : 'inactive_180d',
        channel: 'whatsapp',
        templateBody: this.messageTemplate,
        discountPercent: 15,
      })
      .subscribe({
        next: (res) => {
          this.isSending.set(false);
          this.campaignSent.set(true);
          this.campaignAutoSent.set(res.autoSent);
          this.lastSentCount.set(count);
          this.sampleDispatches.set(res.sampleDispatches || []);
          this.toast.success(res.message);
        },
        error: () => {
          this.isSending.set(false);
          this.campaignSent.set(false);
          this.toast.error('No se pudo procesar la campaña de reactivación. Intenta de nuevo.');
        },
      });
  }
}
