import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

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
          <p class="page-subtitle">Segmenta pacientes ausentes y dispara campañas automatizadas por WhatsApp para recuperar citas e incrementar ingresos.</p>
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
          <span class="kpi-val text-green">\${{ potentialRevenue() | number:'1.0-0' }} COP</span>
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
              <input
                type="checkbox"
                [checked]="allSelected()"
                (change)="toggleSelectAll($event)"
              />
              <span>Seleccionar todos los pacientes filtrados ({{ filteredList().length }})</span>
            </label>
          </div>

          <!-- Inactive Patient List -->
          <div class="patient-list-scroll">
            <div
              *ngFor="let p of filteredList()"
              class="patient-row"
              [class.row-selected]="p.selected"
            >
              <input
                type="checkbox"
                [(ngModel)]="p.selected"
                (change)="onPatientSelectionChange()"
              />

              <div class="pet-avatar">{{ p.species === 'cat' ? '🐱' : '🐶' }}</div>

              <div class="patient-info">
                <strong>{{ p.patientName }} <span class="breed">({{ p.breed }})</span></strong>
                <span class="tutor-sub">Tutor: {{ p.tutorName }} • {{ p.tutorPhone }}</span>
              </div>

              <div class="inactivity-reason">
                <span class="reason-tag" [ngClass]="p.reason">
                  {{ formatReason(p.reason, p.vaccineName) }}
                </span>
                <span class="days-ago">Última visita: hace {{ p.daysInactive }} días</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: WhatsApp Campaign Editor & Live Mobile Preview -->
        <div class="card-box preview-panel">
          <div class="panel-header">
            <h3>2. Plantilla y Preview WhatsApp</h3>
            <span class="meta-tag">Meta Cloud API</span>
          </div>

          <div class="form-group">
            <label>Mensaje de la Campaña:</label>
            <textarea
              rows="4"
              class="form-control"
              [(ngModel)]="messageTemplate"
            ></textarea>
            <span class="help-text">Variables disponibles: [nombre_tutor], [nombre_mascota], [link_agenda]</span>
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
              {{ isSending() ? 'Disparando Campaña por WhatsApp...' : 'Enviar Campaña a (' + selectedCount() + ') Tutores' }}
            </button>
            <span *ngIf="campaignSent()" class="success-banner">
              ✅ ¡Campaña enviada exitosamente a {{ lastSentCount() }} tutores por WhatsApp Business API!
            </span>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
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
      &:hover { background: #e2e8f0; }
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
      &.text-amber { color: #d97706; }
      &.text-blue { color: #2563eb; }
      &.text-green { color: #16a34a; }
      &.text-purple { color: #9333ea; }
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
      h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
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
      strong { font-size: 14px; color: #0f172a; }
      .breed { font-size: 12px; font-weight: 400; color: #64748b; }
      .tutor-sub { font-size: 12px; color: #475569; }
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
      &.no_recent_visit { background: #ffedd5; color: #c2410c; }
      &.vaccine_expired { background: #fee2e2; color: #b91c1c; }
      &.deworming_due { background: #fef9c3; color: #854d0e; }
      &.senior_checkup { background: #f3e8ff; color: #7e22ce; }
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

    .wa-name { font-size: 13px; display: block; }
    .wa-status { font-size: 10px; opacity: 0.8; }

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
      box-shadow: 0 1px 2px rgba(0,0,0,0.15);
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
      span { font-size: 14px; }
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
      label { font-size: 13px; font-weight: 600; color: #334155; }
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

    .help-text { font-size: 11px; color: #64748b; }

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
      &:hover:not(:disabled) { background: #1ebd59; }
      &:disabled { background: #94a3b8; cursor: not-allowed; }
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

    @media (max-width: 900px) {
      .crm-layout { grid-template-columns: 1fr; }
    }
  `]
})
export class CrmReactivationComponent {
  activeFilter = signal<'all' | 'no_recent_visit' | 'vaccine_expired'>('all');
  isSending = signal(false);
  campaignSent = signal(false);
  lastSentCount = signal(0);

  currentHour = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  messageTemplate = '¡Hola {{nombre_tutor}}! 🐾 En VetPro extrañamos mucho a {{nombre_mascota}}. Notamos que hace varios meses no viene a su chequeo preventivo. Agenda su cita esta semana con 15% de descuento especial aquí: {{link_agenda}}';

  inactiveList = signal<InactivePatient[]>([
    {
      id: 'p-inact-1',
      patientName: 'Rocky',
      species: 'dog',
      breed: 'Beagle',
      tutorName: 'Javier Morales',
      tutorPhone: '3104561234',
      lastVisitDate: new Date(Date.now() - 210 * 86400000),
      daysInactive: 210,
      reason: 'no_recent_visit',
      selected: true
    },
    {
      id: 'p-inact-2',
      patientName: 'Milo',
      species: 'cat',
      breed: 'Persa',
      tutorName: 'Carolina Duque',
      tutorPhone: '3187654321',
      lastVisitDate: new Date(Date.now() - 365 * 86400000),
      daysInactive: 365,
      reason: 'vaccine_expired',
      vaccineName: 'Triple Felina',
      selected: true
    },
    {
      id: 'p-inact-3',
      patientName: 'Kira',
      species: 'dog',
      breed: 'Pastor Alemán',
      tutorName: 'Gustavo Petroff',
      tutorPhone: '3019876543',
      lastVisitDate: new Date(Date.now() - 195 * 86400000),
      daysInactive: 195,
      reason: 'no_recent_visit',
      selected: true
    },
    {
      id: 'p-inact-4',
      patientName: 'Pelusa',
      species: 'cat',
      breed: 'Criollo',
      tutorName: 'Ana María Orozco',
      tutorPhone: '3145558899',
      lastVisitDate: new Date(Date.now() - 180 * 86400000),
      daysInactive: 180,
      reason: 'vaccine_expired',
      vaccineName: 'Antirrábica',
      selected: false
    }
  ]);

  filteredList = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.inactiveList();
    return this.inactiveList().filter(p => p.reason === f);
  });

  totalInactive = computed(() => this.inactiveList().length);
  selectedCount = computed(() => this.inactiveList().filter(p => p.selected).length);
  potentialRevenue = computed(() => this.selectedCount() * 85000); // Ticket promedio de consulta $85.000 COP

  allSelected = computed(() => {
    const filtered = this.filteredList();
    return filtered.length > 0 && filtered.every(p => p.selected);
  });

  formatReason(reason: string, vaccineName?: string): string {
    switch (reason) {
      case 'no_recent_visit': return 'Sin Consulta > 6 Meses';
      case 'vaccine_expired': return `Vacuna Vencida: ${vaccineName || ''}`;
      case 'deworming_due': return 'Desparasitación Pendiente';
      case 'senior_checkup': return 'Chequeo Geriátrico Anual';
      default: return reason;
    }
  }

  toggleSelectAll(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const filteredIds = new Set(this.filteredList().map(p => p.id));

    this.inactiveList.update(list =>
      list.map(p => filteredIds.has(p.id) ? { ...p, selected: checked } : p)
    );
  }

  onPatientSelectionChange() {
    // Trigger signal recalculation
    this.inactiveList.update(l => [...l]);
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

    setTimeout(() => {
      this.isSending.set(false);
      this.campaignSent.set(true);
      this.lastSentCount.set(count);
    }, 1500);
  }
}
