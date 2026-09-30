import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  HospitalizationService,
  HospitalizedPatient,
  MedicationDose,
  Bed,
} from '../../../core/services/hospitalization.service';
import { PatientService } from '../../../core/services/patient.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { Patient } from '../../../core/models';

type KardexModal = 'admit' | 'medication' | 'evolution' | 'discharge';

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
          <p class="page-subtitle">
            Control de camas/jaulas, fluidoterapia, evolución horaria y administración de dosis con
            descarga atómica de farmacia.
          </p>
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
          <span class="kpi-val"
            >{{ patients().length }} / {{ beds().length }}
            @if (beds().length) {
              <span class="sub-percent"
                >({{ ((patients().length / beds().length) * 100).toFixed(0) }}%)</span
              >
            }
          </span>
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
        @for (p of patients(); track p) {
          <div
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
                <h3 class="pet-title">
                  {{ p.patientName }}
                  <span class="breed">{{ p.patientBreed }} • {{ p.weight }} kg</span>
                </h3>
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
                @for (dose of p.medications; track dose) {
                  <div class="dose-row" [class.dose-done]="dose.applied">
                    <div class="dose-info">
                      <span class="dose-time">{{ dose.timeSlot }}</span>
                      <strong class="dose-drug"
                        >{{ dose.drugName }} ({{ dose.dose }} {{ dose.route }})</strong
                      >
                    </div>
                    <button
                      class="apply-btn"
                      [disabled]="dose.applied"
                      (click)="applyDose(p.id, dose.id, $event)"
                    >
                      <span class="material-symbols-outlined">{{
                        dose.applied ? 'check_circle' : 'radio_button_unchecked'
                      }}</span>
                      {{ dose.applied ? 'Aplicada' : 'Administrar' }}
                    </button>
                  </div>
                }
              </div>
            </div>
            <div class="card-actions" (click)="$event.stopPropagation()">
              <button class="btn-mini" (click)="openMedicationModal(p)">
                <span class="material-symbols-outlined">medication</span> Medicamento
              </button>
              <button class="btn-mini" (click)="openEvolutionModal(p)">
                <span class="material-symbols-outlined">monitor_heart</span> Evolución
              </button>
              <button class="btn-mini btn-mini-green" (click)="openDischargeModal(p)">
                <span class="material-symbols-outlined">logout</span> Dar de alta
              </button>
            </div>
          </div>
        } @empty {
          @if (!isLoading()) {
            <div class="empty-state">
              <span class="material-symbols-outlined">bed</span>
              <p>No hay pacientes hospitalizados.</p>
              <button class="btn btn-primary" (click)="openAdmitModal()">Ingresar paciente</button>
            </div>
          }
        }
      </div>
    </div>

    @if (modal(); as m) {
      <div class="modal-backdrop" (click)="closeModal()">
        <div class="modal-box" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3>
              @switch (m) {
                @case ('admit') { Ingresar paciente a hospitalización }
                @case ('medication') { Agregar medicamento — {{ modalPatient()?.patientName }} }
                @case ('evolution') { Registrar evolución — {{ modalPatient()?.patientName }} }
                @case ('discharge') { Alta médica — {{ modalPatient()?.patientName }} }
              }
            </h3>
            <button class="close-btn" (click)="closeModal()">✕</button>
          </div>

          <div class="modal-body">
            @if (m === 'admit') {
              <label class="field">
                <span>Paciente *</span>
                <select name="admitPatient" [(ngModel)]="admitForm.patientId">
                  <option value="">Selecciona una mascota…</option>
                  @for (pt of availablePatients(); track pt.id) {
                    <option [value]="pt.id">{{ pt.name }} — {{ pt.tutor?.firstName }} {{ pt.tutor?.lastName }}</option>
                  }
                </select>
              </label>

              <label class="field">
                <span>Jaula / cama *</span>
                <select name="admitBed" [(ngModel)]="admitForm.bedId">
                  <option value="">Selecciona una jaula disponible…</option>
                  @for (b of availableBeds(); track b.id) {
                    <option [value]="b.id">{{ b.code }} — {{ b.name }}</option>
                  }
                </select>
              </label>
              @for (b of cleaningBeds(); track b.id) {
                <div class="inline-box row">
                  <span class="hint">Jaula {{ b.code }} en limpieza desde el último alta.</span>
                  <button class="btn-mini" [disabled]="saving()" (click)="markBedReady(b)">Marcar como lista</button>
                </div>
              }
              @if (!availableBeds().length) {
                <div class="inline-box">
                  <p class="hint">No hay jaulas disponibles. Registra una:</p>
                  <div class="row">
                    <input name="newBedCode" placeholder="Código (ej. J-01)" [(ngModel)]="newBed.code" />
                    <input name="newBedName" placeholder="Nombre (ej. Jaula perros grande)" [(ngModel)]="newBed.name" />
                    <button class="btn-mini" [disabled]="saving()" (click)="createBed()">Crear jaula</button>
                  </div>
                </div>
              }

              <label class="field">
                <span>Motivo de ingreso *</span>
                <textarea name="admitReason" rows="2" [(ngModel)]="admitForm.admissionReason"></textarea>
              </label>
              <label class="field">
                <span>Diagnóstico</span>
                <input name="admitDiagnosis" [(ngModel)]="admitForm.diagnosis" />
              </label>
              <label class="field">
                <span>Fluidoterapia</span>
                <input name="admitFluids" placeholder="Ej. Lactato de Ringer 10 ml/kg/h" [(ngModel)]="admitForm.fluidTherapy" />
              </label>
              <div class="row">
                <label class="field"><span>Temp. (°C)</span><input name="admitTemp" type="number" step="0.1" [(ngModel)]="admitForm.temperature" /></label>
                <label class="field"><span>FC (lpm)</span><input name="admitHr" type="number" [(ngModel)]="admitForm.heartRate" /></label>
                <label class="field"><span>FR (rpm)</span><input name="admitRr" type="number" [(ngModel)]="admitForm.respiratoryRate" /></label>
              </div>
              <p class="hint">Medicación inicial (opcional)</p>
              <ng-container *ngTemplateOutlet="medFields" />
            }

            @if (m === 'medication') {
              <ng-container *ngTemplateOutlet="medFields" />
            }

            @if (m === 'evolution') {
              <div class="row">
                <label class="field"><span>Temp. (°C)</span><input name="evoTemp" type="number" step="0.1" [(ngModel)]="evoForm.temperature" /></label>
                <label class="field"><span>FC (lpm)</span><input name="evoHr" type="number" [(ngModel)]="evoForm.heartRate" /></label>
                <label class="field"><span>FR (rpm)</span><input name="evoRr" type="number" [(ngModel)]="evoForm.respiratoryRate" /></label>
              </div>
              <label class="field">
                <span>Nota de evolución *</span>
                <textarea name="evoNotes" rows="3" [(ngModel)]="evoForm.notes"></textarea>
              </label>
            }

            @if (m === 'discharge') {
              <label class="field">
                <span>Resumen de alta / epicrisis *</span>
                <textarea name="dischargeSummary" rows="4" [(ngModel)]="dischargeSummary"></textarea>
              </label>
            }

            <ng-template #medFields>
              <div class="row">
                <label class="field"><span>Fármaco</span><input name="medDrug" placeholder="Ej. Meloxicam" [(ngModel)]="medForm.drugName" /></label>
                <label class="field"><span>Dosis</span><input name="medDose" placeholder="Ej. 0.1 mg/kg" [(ngModel)]="medForm.dose" /></label>
              </div>
              <div class="row">
                <label class="field">
                  <span>Vía</span>
                  <select name="medRoute" [(ngModel)]="medForm.route">
                    <option>IV</option><option>IM</option><option>SC</option><option>VO</option><option>Tópica</option>
                  </select>
                </label>
                <label class="field">
                  <span>Frecuencia</span>
                  <select name="medFreq" [(ngModel)]="medForm.frequencyHours">
                    <option [ngValue]="6">Cada 6 h</option>
                    <option [ngValue]="8">Cada 8 h</option>
                    <option [ngValue]="12">Cada 12 h</option>
                    <option [ngValue]="24">Cada 24 h</option>
                  </select>
                </label>
              </div>
              <p class="hint">Horarios: {{ timeSlotsFor(medForm.frequencyHours).join(', ') }}</p>
            </ng-template>
          </div>

          <div class="modal-footer">
            <button class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()" (click)="submitModal()">
              {{ saving() ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
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
        &:hover {
          background: #1d4ed8;
        }
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
        .sub-percent {
          font-size: 13px;
          font-weight: 400;
          color: #64748b;
        }
        &.text-red {
          color: #dc2626;
        }
        &.text-amber {
          color: #d97706;
        }
        &.text-green {
          color: #16a34a;
        }
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
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);

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
        span {
          font-size: 18px;
          color: #64748b;
        }
      }

      .status-badge {
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        border-radius: 10px;
        &.critical {
          background: #fee2e2;
          color: #dc2626;
        }
        &.stable {
          background: #dbeafe;
          color: #1d4ed8;
        }
        &.observation {
          background: #fef3c7;
          color: #b45309;
        }
        &.ready_for_discharge {
          background: #dcfce7;
          color: #15803d;
        }
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
        .breed {
          font-size: 12px;
          font-weight: 400;
          color: #64748b;
          display: block;
        }
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
        span.material-symbols-outlined {
          font-size: 16px;
          color: #64748b;
        }
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
        span {
          font-size: 16px;
          color: #2563eb;
        }
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

        span {
          font-size: 14px;
        }
      }

      .card-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #e2e8f0;
      }
      .btn-mini {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid #cbd5e1;
        background: #fff;
        color: #334155;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        .material-symbols-outlined { font-size: 16px; }
        &:disabled { opacity: 0.6; cursor: not-allowed; }
      }
      .btn-mini-green { border-color: #86efac; color: #15803d; }
      .btn-secondary { background: #f1f5f9; color: #334155; }
      .empty-state {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 40px 16px;
        color: #64748b;
        border: 2px dashed #e2e8f0;
        border-radius: 12px;
        .material-symbols-outlined { font-size: 40px; }
      }
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 16px;
      }
      .modal-box {
        background: #fff;
        border-radius: 12px;
        width: 100%;
        max-width: 560px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
      }
      .modal-header, .modal-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 20px;
      }
      .modal-header { border-bottom: 1px solid #e2e8f0; h3 { margin: 0; font-size: 17px; } }
      .modal-footer { border-top: 1px solid #e2e8f0; justify-content: flex-end; }
      .close-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #64748b; }
      .modal-body {
        padding: 16px 20px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        flex: 1;
        min-width: 0;
        span { font-size: 12px; font-weight: 600; color: #475569; }
        input, select, textarea {
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          font: inherit;
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
        }
      }
      .row { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
      .row input { padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 6px; flex: 1; min-width: 120px; }
      .hint { font-size: 12px; color: #64748b; margin: 0; }
      .inline-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 10px; }
    `,
  ],
})
export class HospitalizationKardexComponent implements OnInit {
  private hospitalizationService = inject(HospitalizationService);
  private patientService = inject(PatientService);
  private auth = inject(AuthService);
  private toast = inject(ToastService);

  selectedPatient = signal<HospitalizedPatient | null>(null);
  isLoading = signal<boolean>(false);

  patients = signal<HospitalizedPatient[]>([]);
  beds = signal<Bed[]>([]);
  clinicPatients = signal<Patient[]>([]);

  modal = signal<KardexModal | null>(null);
  modalPatient = signal<HospitalizedPatient | null>(null);
  saving = signal(false);

  admitForm = this.emptyAdmitForm();
  medForm = this.emptyMedForm();
  evoForm: { temperature?: number; heartRate?: number; respiratoryRate?: number; notes: string } = { notes: '' };
  dischargeSummary = '';
  newBed = { code: '', name: '' };

  availableBeds = computed(() => this.beds().filter((b) => b.status === 'available'));
  cleaningBeds = computed(() => this.beds().filter((b) => b.status === 'cleaning'));
  // Mascotas que no están hospitalizadas en este momento
  availablePatients = computed(() => {
    const admitted = new Set(this.patients().map((p) => p.patientId));
    return this.clinicPatients().filter((p) => !admitted.has(p.id));
  });

  criticalCount = computed(() => this.patients().filter((p) => p.status === 'critical').length);
  observationCount = computed(
    () => this.patients().filter((p) => p.status === 'admitted' || p.status === 'stable').length,
  );
  dischargeCount = computed(
    () => this.patients().filter((p) => p.status === 'ready_for_discharge').length,
  );

  ngOnInit() {
    this.loadHospitalizations();
    this.loadBeds();
  }

  loadBeds() {
    this.hospitalizationService.getBeds().subscribe({
      next: (beds) => this.beds.set(beds || []),
      error: () => this.beds.set([]),
    });
  }

  loadHospitalizations() {
    this.isLoading.set(true);
    this.hospitalizationService.getActiveHospitalizations().subscribe({
      next: (data) => {
        this.patients.set(data || []);
        this.selectedPatient.set(data && data.length > 0 ? data[0] : null);
        this.isLoading.set(false);
      },
      error: (err) => {
        console.error('[Kardex] No se pudo cargar la lista de hospitalizaciones:', err);
        this.patients.set([]);
        this.selectedPatient.set(null);
        this.isLoading.set(false);
      },
    });
  }

  selectPatient(patient: HospitalizedPatient) {
    this.selectedPatient.set(patient);
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'critical':
        return 'UCI / Crítico 🚨';
      case 'stable':
        return 'Estable 🩺';
      case 'observation':
        return 'En Observación 👁️';
      case 'ready_for_discharge':
        return 'Alta Médica ✅';
      default:
        return status;
    }
  }

  applyDose(patientId: string, doseId: string, event: Event) {
    event.stopPropagation();

    const patient = this.patients().find((p) => p.id === patientId);
    const med = patient?.medications.find((m) => m.id === doseId);

    if (!patient || !med?.medicationId) {
      this.toast.error('No se encontró la medicación de esta dosis. Recarga la página.');
      return;
    }

    // Solo se marca como aplicada cuando el servidor la registró: antes se
    // marcaba también si fallaba, y el kardex mostraba dosis no registradas.
    this.hospitalizationService
      .administerDose(patient.id, {
        medicationId: med.medicationId,
        timeSlot: med.timeSlot,
        deductStock: true,
      })
      .subscribe({
        next: () => this.markLocalDoseApplied(patientId, doseId),
        error: (err) =>
          this.toast.error(err?.error?.error || 'No se pudo registrar la dosis. Intenta de nuevo.'),
      });
  }

  private markLocalDoseApplied(patientId: string, doseId: string) {
    this.patients.update((list) =>
      list.map((p) => {
        if (p.id === patientId) {
          return {
            ...p,
            medications: p.medications.map((m) =>
              m.id === doseId
                ? { ...m, applied: true, appliedAt: new Date(), appliedBy: 'Enfermería' }
                : m,
            ),
          };
        }
        return p;
      }),
    );
  }

  // ─── Modales: ingreso, medicación, evolución y alta ───────────────

  openAdmitModal() {
    this.admitForm = this.emptyAdmitForm();
    this.medForm = this.emptyMedForm();
    this.newBed = { code: '', name: '' };
    this.loadBeds();
    this.patientService.getPatients({ pageSize: 500 }).subscribe({
      next: (res) => this.clinicPatients.set(res.data || []),
      error: () => this.toast.error('No se pudo cargar el listado de pacientes.'),
    });
    this.modalPatient.set(null);
    this.modal.set('admit');
  }

  openMedicationModal(patient: HospitalizedPatient) {
    this.medForm = this.emptyMedForm();
    this.modalPatient.set(patient);
    this.modal.set('medication');
  }

  openEvolutionModal(patient: HospitalizedPatient) {
    this.evoForm = {
      temperature: patient.temperature,
      heartRate: patient.heartRate,
      respiratoryRate: patient.respiratoryRate,
      notes: '',
    };
    this.modalPatient.set(patient);
    this.modal.set('evolution');
  }

  openDischargeModal(patient: HospitalizedPatient) {
    this.dischargeSummary = '';
    this.modalPatient.set(patient);
    this.modal.set('discharge');
  }

  closeModal() {
    if (this.saving()) return;
    this.modal.set(null);
    this.modalPatient.set(null);
  }

  createBed() {
    const code = this.newBed.code.trim();
    const name = this.newBed.name.trim();
    const branchId = this.currentBranchId();
    if (!code || !name) {
      this.toast.error('Escribe el código y el nombre de la jaula.');
      return;
    }
    if (!branchId) {
      this.toast.error('La clínica no tiene una sede configurada.');
      return;
    }
    this.saving.set(true);
    this.hospitalizationService.createBed({ branchId, code, name }).subscribe({
      next: (bed) => {
        this.saving.set(false);
        this.beds.update((list) => [...list, bed]);
        this.admitForm.bedId = bed.id;
        this.newBed = { code: '', name: '' };
        this.toast.success(`Jaula ${bed.code} creada.`);
      },
      error: (err) => {
        this.saving.set(false);
        this.toast.error(err?.error?.error || 'No se pudo crear la jaula.');
      },
    });
  }

  markBedReady(bed: Bed) {
    this.saving.set(true);
    this.hospitalizationService.setBedStatus(bed.id, 'available').subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.beds.update((list) => list.map((b) => (b.id === updated.id ? { ...b, status: updated.status } : b)));
        this.admitForm.bedId = updated.id;
      },
      error: (err) => this.onSaveError(err, 'No se pudo actualizar la jaula.'),
    });
  }

  submitModal() {
    switch (this.modal()) {
      case 'admit':
        return this.submitAdmit();
      case 'medication':
        return this.submitMedication();
      case 'evolution':
        return this.submitEvolution();
      case 'discharge':
        return this.submitDischarge();
    }
  }

  private submitAdmit() {
    const f = this.admitForm;
    const bed = this.beds().find((b) => b.id === f.bedId);
    const branchId = bed?.branch?.id || this.currentBranchId();
    if (!f.patientId || !f.bedId || f.admissionReason.trim().length < 3) {
      this.toast.error('Selecciona paciente, jaula y escribe el motivo de ingreso.');
      return;
    }
    if (!branchId) {
      this.toast.error('La clínica no tiene una sede configurada.');
      return;
    }
    const med = this.medPayload();
    if (med === 'incomplete') return;

    this.saving.set(true);
    this.hospitalizationService
      .admitPatient({
        patientId: f.patientId,
        branchId,
        bedId: f.bedId,
        admissionReason: f.admissionReason.trim(),
        diagnosis: f.diagnosis.trim() || undefined,
        fluidTherapy: f.fluidTherapy.trim() || undefined,
        temperature: this.num(f.temperature),
        heartRate: this.int(f.heartRate),
        respiratoryRate: this.int(f.respiratoryRate),
        medications: med ? [med] : undefined,
      })
      .subscribe({
        next: () => this.afterSave('Paciente ingresado a hospitalización.'),
        error: (err) => this.onSaveError(err, 'No se pudo ingresar al paciente.'),
      });
  }

  private submitMedication() {
    const patient = this.modalPatient();
    const med = this.medPayload();
    if (!patient || med === 'incomplete') return;
    if (!med) {
      this.toast.error('Escribe el fármaco y la dosis.');
      return;
    }
    this.saving.set(true);
    this.hospitalizationService.addMedication(patient.id, med).subscribe({
      next: () => this.afterSave('Medicamento agregado al kardex.'),
      error: (err) => this.onSaveError(err, 'No se pudo agregar el medicamento.'),
    });
  }

  private submitEvolution() {
    const patient = this.modalPatient();
    const f = this.evoForm;
    if (!patient) return;
    if (!f.notes.trim()) {
      this.toast.error('Escribe la nota de evolución.');
      return;
    }
    this.saving.set(true);
    this.hospitalizationService
      .addEvolution(patient.id, {
        temperature: this.num(f.temperature),
        heartRate: this.int(f.heartRate),
        respiratoryRate: this.int(f.respiratoryRate),
        notes: f.notes.trim(),
      })
      .subscribe({
        next: () => this.afterSave('Evolución registrada.'),
        error: (err) => this.onSaveError(err, 'No se pudo registrar la evolución.'),
      });
  }

  private submitDischarge() {
    const patient = this.modalPatient();
    if (!patient) return;
    if (this.dischargeSummary.trim().length < 3) {
      this.toast.error('Escribe el resumen de alta (epicrisis).');
      return;
    }
    this.saving.set(true);
    this.hospitalizationService
      .dischargePatient(patient.id, { dischargeSummary: this.dischargeSummary.trim() })
      .subscribe({
        next: (res) => this.afterSave(res?.message || 'Paciente dado de alta.'),
        error: (err) => this.onSaveError(err, 'No se pudo procesar el alta médica.'),
      });
  }

  /** Horarios del día según la frecuencia, empezando a las 8:00 a. m. */
  timeSlotsFor(frequencyHours: number): string[] {
    const slots: string[] = [];
    for (let h = 8; h < 8 + 24; h += frequencyHours || 24) {
      const hour = h % 24;
      const suffix = hour < 12 ? 'AM' : 'PM';
      const h12 = hour % 12 === 0 ? 12 : hour % 12;
      slots.push(`${String(h12).padStart(2, '0')}:00 ${suffix}`);
    }
    return slots;
  }

  /** null si no se llenó la medicación; 'incomplete' si quedó a medias */
  private medPayload() {
    const drugName = this.medForm.drugName.trim();
    const dose = this.medForm.dose.trim();
    if (!drugName && !dose) return null;
    if (!drugName || !dose) {
      this.toast.error('Para la medicación escribe el fármaco y la dosis.');
      return 'incomplete' as const;
    }
    return {
      drugName,
      dose,
      route: this.medForm.route,
      frequencyHours: this.medForm.frequencyHours,
      timeSlots: this.timeSlotsFor(this.medForm.frequencyHours),
    };
  }

  private afterSave(message: string) {
    this.saving.set(false);
    this.modal.set(null);
    this.modalPatient.set(null);
    this.toast.success(message);
    this.loadHospitalizations();
    this.loadBeds();
  }

  private onSaveError(err: any, fallback: string) {
    this.saving.set(false);
    this.toast.error(err?.error?.error || fallback);
  }

  private currentBranchId(): string | null {
    return this.auth.activeBranchId() || this.auth.clinicBranches()[0]?.id || this.beds()[0]?.branch?.id || null;
  }

  private num(v: unknown): number | undefined {
    return v === null || v === undefined || v === '' || isNaN(Number(v)) ? undefined : Number(v);
  }

  private int(v: unknown): number | undefined {
    const n = this.num(v);
    return n === undefined ? undefined : Math.round(n);
  }

  private emptyAdmitForm() {
    return {
      patientId: '',
      bedId: '',
      admissionReason: '',
      diagnosis: '',
      fluidTherapy: '',
      temperature: undefined as number | undefined,
      heartRate: undefined as number | undefined,
      respiratoryRate: undefined as number | undefined,
    };
  }

  private emptyMedForm() {
    return { drugName: '', dose: '', route: 'IV', frequencyHours: 8 };
  }
}
