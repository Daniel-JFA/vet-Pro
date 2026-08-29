import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface MedicationDose {
  id: string;
  timeSlot: string; // ej: '08:00 AM', '02:00 PM', '08:00 PM'
  drugName: string;
  dose: string;
  route: string; // 'IV', 'SC', 'Oral'
  applied: boolean;
  appliedAt?: Date;
  appliedBy?: string;
}

export interface HospitalizedPatient {
  id: string;
  cageNumber: string;
  cageType: string;
  status: 'critical' | 'stable' | 'observation' | 'ready_for_discharge';
  patientId: string;
  patientName: string;
  patientSpecies: string;
  patientBreed: string;
  weight: number;
  tutorName: string;
  tutorPhone: string;
  admittedAt: Date;
  daysHospitalized: number;
  admissionReason: string;
  fluidTherapy: string; // ej: 'Ringer Lactato 40ml/h + KCl'
  temperature: number;
  heartRate: number;
  medications: MedicationDose[];
}

@Component({
  selector: 'app-hospitalization-kardex',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="hosp-page-container">
      <!-- Header -->
      <div class="hosp-header">
        <div>
          <div class="badge-hosp">🏥 SERVICIO DE HOSPITALIZACIÓN & KARDEX</div>
          <h1 class="page-title">Pacientes Internados & Enfermería</h1>
          <p class="page-subtitle">Control de camas/jaulas, fluidoterapia, evolución horaria y administración de dosis con descarga atómica de farmacia.</p>
        </div>

        <div class="header-actions">
          <button class="btn btn-primary" (click)="openAdmitModal()">
            <span class="material-symbols-outlined">add_circle</span>
            Ingresar Paciente a Camas
          </button>
        </div>
      </div>

      <!-- Occupancy & Status KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <span class="kpi-label">Ocupación de Jaulas</span>
          <span class="kpi-val">{{ patients().length }} / 8 <span class="sub-percent">({{ (patients().length / 8 * 100).toFixed(0) }}%)</span></span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Estado Crítico / UCI</span>
          <span class="kpi-val text-red">{{ criticalCount() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">En Observación</span>
          <span class="kpi-val text-amber">{{ observationCount() }}</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Próximos al Alta</span>
          <span class="kpi-val text-green">{{ dischargeCount() }}</span>
        </div>
      </div>

      <!-- Main Hospitalization Grid -->
      <div class="hosp-grid">
        <!-- Patient Card / Cage -->
        <div
          *ngFor="let p of patients()"
          class="cage-card"
          [class.critical-border]="p.status === 'critical'"
          [class.selected-cage]="selectedPatient()?.id === p.id"
          (click)="selectPatient(p)"
        >
          <div class="cage-top">
            <div class="cage-tag">
              <span class="material-symbols-outlined">meeting_room</span>
              <strong>{{ p.cageNumber }}</strong> ({{ p.cageType }})
            </div>
            <span class="status-badge" [ngClass]="p.status">
              {{ formatStatus(p.status) }}
            </span>
          </div>

          <div class="patient-core">
            <div class="pet-icon">{{ p.patientSpecies === 'cat' ? '🐱' : '🐶' }}</div>
            <div class="pet-details">
              <h3 class="pet-title">{{ p.patientName }} <span class="breed">{{ p.patientBreed }} • {{ p.weight }} kg</span></h3>
              <p class="tutor-line">👤 {{ p.tutorName }} ({{ p.tutorPhone }})</p>
            </div>
          </div>

          <div class="diagnosis-box">
            <span class="diag-label">Motivo de Ingreso:</span>
            <p class="diag-text">{{ p.admissionReason }}</p>
          </div>

          <div class="vitals-row">
            <div class="vital-item">
              <span class="material-symbols-outlined">thermostat</span>
              <span>{{ p.temperature }} °C</span>
            </div>
            <div class="vital-item">
              <span class="material-symbols-outlined">favorite</span>
              <span>{{ p.heartRate }} lpm</span>
            </div>
            <div class="vital-item">
              <span class="material-symbols-outlined">water_drop</span>
              <span class="fluid-text" [title]="p.fluidTherapy">{{ p.fluidTherapy }}</span>
            </div>
          </div>

          <!-- Kardex Doses Mini-Checklist -->
          <div class="kardex-mini">
            <div class="kardex-title">
              <span class="material-symbols-outlined">pill</span>
              Kardex de Medicación Hoy
            </div>

            <div class="doses-list">
              <div
                *ngFor="let dose of p.medications"
                class="dose-row"
                [class.dose-done]="dose.applied"
              >
                <div class="dose-info">
                  <span class="dose-time">{{ dose.timeSlot }}</span>
                  <strong class="dose-drug">{{ dose.drugName }} ({{ dose.dose }} {{ dose.route }})</strong>
                </div>

                <button
                  class="apply-btn"
                  [disabled]="dose.applied"
                  (click)="applyDose(p.id, dose.id, $event)"
                >
                  <span class="material-symbols-outlined">{{ dose.applied ? 'check_circle' : 'radio_button_unchecked' }}</span>
                  {{ dose.applied ? 'Aplicada' : 'Administrar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .hosp-page-container {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .hosp-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }

    .badge-hosp {
      display: inline-block;
      background: #eff6ff;
      color: #1d4ed8;
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
      transition: all 0.2s ease;
    }

    .btn-primary {
      background: #2563eb;
      color: #ffffff;
      &:hover { background: #1d4ed8; }
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
      .sub-percent { font-size: 13px; font-weight: 400; color: #64748b; }
      &.text-red { color: #dc2626; }
      &.text-amber { color: #d97706; }
      &.text-green { color: #16a34a; }
    }

    .hosp-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
    }

    .cage-card {
      background: #ffffff;
      border-radius: 14px;
      border: 1px solid #e2e8f0;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);

      &:hover {
        border-color: #94a3b8;
        transform: translateY(-2px);
      }

      &.critical-border {
        border-left: 5px solid #dc2626;
      }

      &.selected-cage {
        border-color: #2563eb;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
      }
    }

    .cage-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .cage-tag {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #334155;
      span { font-size: 18px; color: #64748b; }
    }

    .status-badge {
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      &.critical { background: #fee2e2; color: #dc2626; }
      &.stable { background: #dbeafe; color: #1d4ed8; }
      &.observation { background: #fef3c7; color: #b45309; }
      &.ready_for_discharge { background: #dcfce7; color: #15803d; }
    }

    .patient-core {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .pet-icon {
      font-size: 28px;
      width: 44px;
      height: 44px;
      background: #f1f5f9;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .pet-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #0f172a;
      .breed { font-size: 12px; font-weight: 400; color: #64748b; display: block; }
    }

    .tutor-line {
      margin: 2px 0 0;
      font-size: 12px;
      color: #475569;
    }

    .diagnosis-box {
      background: #f8fafc;
      border-radius: 8px;
      padding: 10px;
    }

    .diag-label {
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      display: block;
    }

    .diag-text {
      margin: 2px 0 0;
      font-size: 13px;
      color: #1e293b;
      font-weight: 500;
    }

    .vitals-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      background: #f1f5f9;
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #334155;
    }

    .vital-item {
      display: flex;
      align-items: center;
      gap: 4px;
      span.material-symbols-outlined { font-size: 16px; color: #64748b; }
      .fluid-text {
        max-width: 140px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }

    .kardex-mini {
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .kardex-title {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 6px;
      span { font-size: 16px; color: #2563eb; }
    }

    .doses-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .dose-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      font-size: 12px;

      &.dose-done {
        background: #f0fdf4;
        border-color: #bbf7d0;
        opacity: 0.8;
      }
    }

    .dose-info {
      display: flex;
      flex-direction: column;
    }

    .dose-time {
      font-size: 10px;
      font-weight: 700;
      color: #64748b;
    }

    .dose-drug {
      color: #0f172a;
    }

    .apply-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      background: #2563eb;
      color: #ffffff;

      &:disabled {
        background: #dcfce7;
        color: #15803d;
        cursor: default;
      }

      span { font-size: 14px; }
    }
  `]
})
export class HospitalizationKardexComponent {
  selectedPatient = signal<HospitalizedPatient | null>(null);

  patients = signal<HospitalizedPatient[]>([
    {
      id: 'hosp-1',
      cageNumber: 'Jaula 01',
      cageType: 'Caninos UCI',
      status: 'critical',
      patientId: 'p1',
      patientName: 'Toby',
      patientSpecies: 'dog',
      patientBreed: 'Golden Retriever',
      weight: 28.5,
      tutorName: 'Carlos Gómez',
      tutorPhone: '3124567890',
      admittedAt: new Date(Date.now() - 2 * 86400000),
      daysHospitalized: 2,
      admissionReason: 'Gastroenteritis hemorrágica severa + deshidratación 8%',
      fluidTherapy: 'Ringer Lactato 65ml/h + KCl',
      temperature: 39.4,
      heartRate: 135,
      medications: [
        { id: 'm1', timeSlot: '08:00 AM', drugName: 'Ampicilina + Sulbactam', dose: '1.5ml', route: 'IV', applied: true, appliedAt: new Date() },
        { id: 'm2', timeSlot: '02:00 PM', drugName: 'Metoclopramida', dose: '0.8ml', route: 'IV', applied: true, appliedAt: new Date() },
        { id: 'm3', timeSlot: '08:00 PM', drugName: 'Omeprazol', dose: '2ml', route: 'IV', applied: false }
      ]
    },
    {
      id: 'hosp-2',
      cageNumber: 'Jaula 03',
      cageType: 'Felinos Aislado',
      status: 'stable',
      patientId: 'p2',
      patientName: 'Luna',
      patientSpecies: 'cat',
      patientBreed: 'Siamés',
      weight: 3.8,
      tutorName: 'María Rodríguez',
      tutorPhone: '3157891234',
      admittedAt: new Date(Date.now() - 1 * 86400000),
      daysHospitalized: 1,
      admissionReason: 'Manejo post-quirúrgico de OVH y fluidoterapia preventiva',
      fluidTherapy: 'Cloruro de Sodio 0.9% 15ml/h',
      temperature: 38.6,
      heartRate: 160,
      medications: [
        { id: 'm4', timeSlot: '08:00 AM', drugName: 'Meloxicam 0.5%', dose: '0.4ml', route: 'SC', applied: true },
        { id: 'm5', timeSlot: '06:00 PM', drugName: 'Tramadol', dose: '0.2ml', route: 'SC', applied: false }
      ]
    },
    {
      id: 'hosp-3',
      cageNumber: 'Jaula 05',
      cageType: 'Observación General',
      status: 'ready_for_discharge',
      patientId: 'p3',
      patientName: 'Simba',
      patientSpecies: 'dog',
      patientBreed: 'Bulldog Francés',
      weight: 12.1,
      tutorName: 'Andrés Morales',
      tutorPhone: '3001234567',
      admittedAt: new Date(Date.now() - 3 * 86400000),
      daysHospitalized: 3,
      admissionReason: 'Recuperación de intoxicación por chocolate. Evolución favorable.',
      fluidTherapy: 'Retirada',
      temperature: 38.5,
      heartRate: 110,
      medications: [
        { id: 'm6', timeSlot: '08:00 AM', drugName: 'Protector Hepático', dose: '1 tab', route: 'Oral', applied: true }
      ]
    }
  ]);

  criticalCount = computed(() => this.patients().filter(p => p.status === 'critical').length);
  observationCount = computed(() => this.patients().filter(p => p.status === 'observation' || p.status === 'stable').length);
  dischargeCount = computed(() => this.patients().filter(p => p.status === 'ready_for_discharge').length);

  selectPatient(patient: HospitalizedPatient) {
    this.selectedPatient.set(patient);
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'critical': return 'UCI / Crítico 🚨';
      case 'stable': return 'Estable 🩺';
      case 'observation': return 'En Observación 👁️';
      case 'ready_for_discharge': return 'Alta Médica ✅';
      default: return status;
    }
  }

  applyDose(patientId: string, doseId: string, event: Event) {
    event.stopPropagation();

    this.patients.update(list =>
      list.map(p => {
        if (p.id === patientId) {
          return {
            ...p,
            medications: p.medications.map(m =>
              m.id === doseId
                ? { ...m, applied: true, appliedAt: new Date(), appliedBy: 'Enfermería' }
                : m
            )
          };
        }
        return p;
      })
    );
  }

  openAdmitModal() {
    alert('Ingreso rápido a camas habilitado. Seleccione el paciente de la lista de consultas.');
  }
}
