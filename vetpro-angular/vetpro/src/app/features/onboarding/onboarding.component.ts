import { Component, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GeoService, Departamento, Municipio } from '../../core/services/geo.service';

@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="onboarding-page">
      <div class="onboarding-card glass-effect animate-fade-in">
        <div class="card-glow"></div>

        <!-- Barra de Progreso -->
        @if (currentStep() <= 3) {
          <div class="progress-bar">
            <div
              class="step"
              [class.active]="currentStep() >= 1"
              [class.current]="currentStep() === 1"
            >
              1
            </div>
            <div class="line" [class.active]="currentStep() >= 2"></div>
            <div
              class="step"
              [class.active]="currentStep() >= 2"
              [class.current]="currentStep() === 2"
            >
              2
            </div>
            <div class="line" [class.active]="currentStep() >= 3"></div>
            <div
              class="step"
              [class.active]="currentStep() >= 3"
              [class.current]="currentStep() === 3"
            >
              3
            </div>
          </div>
        }

        <!-- PASO 1: INFORMACIÓN DE LA CLÍNICA -->
        @if (currentStep() === 1) {
          <div class="step-content animate-slide-up">
            <h2>Configuración de la Clínica</h2>
            <p class="subtitle">
              Completa los datos de identidad corporativa de tu centro veterinario.
            </p>
            <div class="form-group">
              <label>Tipo de Práctica / Modalidad de Operación</label>
              <div class="modality-cards">
                <div
                  class="modality-card"
                  [class.selected]="businessType() === 'clinic'"
                  (click)="businessType.set('clinic')"
                >
                  <span class="material-symbols-outlined">domain</span>
                  <div class="mod-info">
                    <strong>Clínica con Sedes</strong>
                    <small>Consultorios fijos, hospitalización y múltiples sucursales.</small>
                  </div>
                </div>
                <div
                  class="modality-card"
                  [class.selected]="businessType() === 'independent_vet'"
                  (click)="businessType.set('independent_vet')"
                >
                  <span class="material-symbols-outlined">two_wheeler</span>
                  <div class="mod-info">
                    <strong>Veterinario Independiente</strong>
                    <small
                      >Atención a domicilio, maletín móvil y sin local físico obligatorio.</small
                    >
                  </div>
                </div>
              </div>
            </div>
            <div class="form-group">
              <label>NIT / Identificación Fiscal</label>
              <input type="text" [(ngModel)]="nit" placeholder="Ej: 900.123.456-7" />
            </div>
            <div class="form-group">
              <label>Teléfono de Atención</label>
              <input type="tel" [(ngModel)]="phone" placeholder="Ej: +57 312 456 7890" />
            </div>
            <div class="form-group">
              <label>Departamento</label>
              <select [(ngModel)]="departamentoCode" (ngModelChange)="onDepartamentoChange()">
                <option value="" disabled selected>Selecciona...</option>
                @for (d of departamentos(); track d) {
                  <option [value]="d.code">{{ d.nombre }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label>Municipio / Ciudad</label>
              <select
                [(ngModel)]="municipioId"
                [disabled]="!departamentoCode() || loadingMunicipios()"
              >
                <option value="" disabled selected>
                  {{ loadingMunicipios() ? 'Cargando...' : 'Selecciona...' }}
                </option>
                @for (m of municipios(); track m) {
                  <option [value]="m.id">{{ m.nombre }}</option>
                }
              </select>
            </div>
            <div class="actions">
              <button
                class="next-btn"
                (click)="goToStep(2)"
                [disabled]="!nit() || !phone() || !municipioId()"
              >
                Siguiente Paso
                <span class="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        }

        <!-- PASO 2: SEDE FÍSICA O ZONA DE COBERTURA MÓVIL -->
        @if (currentStep() === 2) {
          <div class="step-content animate-slide-up">
            @if (businessType() === 'clinic') {
              <div>
                <h2>Crear Sede Principal</h2>
                <p class="subtitle">Define la ubicación de tu primer consultorio clínico físico.</p>
                <div class="form-group">
                  <label>Nombre de la Sede</label>
                  <input
                    type="text"
                    [(ngModel)]="branchName"
                    placeholder="Ej: Sede Principal Norte"
                  />
                </div>
                <div class="form-group">
                  <label>Dirección Física del Local</label>
                  <input
                    type="text"
                    [(ngModel)]="branchAddress"
                    placeholder="Ej: Calle 100 #15-30"
                  />
                </div>
              </div>
            }
            @if (businessType() === 'independent_vet') {
              <div>
                <h2>Zona de Cobertura Domiciliaria</h2>
                <p class="subtitle">
                  Como profesional independiente, no necesitas local comercial. Indica tu zona
                  habitual.
                </p>
                <div class="form-group">
                  <label>Nombre de tu Práctica / Marca</label>
                  <input
                    type="text"
                    [(ngModel)]="branchName"
                    placeholder="Ej: Dr. Domicilios & Urgencias"
                  />
                </div>
                <div class="form-group">
                  <label>Zona Principal de Desplazamiento</label>
                  <input
                    type="text"
                    [(ngModel)]="branchAddress"
                    placeholder="Ej: Medellín y Área Metropolitana"
                  />
                </div>
              </div>
            }
            <div class="actions">
              <button class="back-btn" (click)="goToStep(1)">Atrás</button>
              <button
                class="next-btn"
                (click)="goToStep(3)"
                [disabled]="!branchName() || !branchAddress()"
              >
                Siguiente Paso
                <span class="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        }

        <!-- PASO 3: PROFESIONAL COMPLEMENTARIO -->
        @if (currentStep() === 3) {
          <div class="step-content animate-slide-up">
            <h2>Registrar Médico Veterinario</h2>
            <p class="subtitle">Agrega un profesional adicional a tu equipo de trabajo clínico.</p>
            <div class="form-group">
              <label>Nombre Completo</label>
              <input type="text" [(ngModel)]="vetName" placeholder="Ej: Dra. Laura Cardona" />
            </div>
            <div class="form-group">
              <label>Correo Electrónico Corporativo</label>
              <input type="email" [(ngModel)]="vetEmail" placeholder="Ej: laura@clinica.co" />
            </div>
            @if (errorMsg()) {
              <p class="error-inline">{{ errorMsg() }}</p>
            }
            <div class="actions">
              <button class="back-btn" (click)="goToStep(2)" [disabled]="submitting()">
                Atrás
              </button>
              <button class="next-btn" (click)="finishOnboarding()" [disabled]="submitting()">
                {{ submitting() ? 'Guardando...' : 'Finalizar Configuración' }}
                @if (!submitting()) {
                  <span class="material-symbols-outlined">check</span>
                }
              </button>
            </div>
          </div>
        }

        <!-- PASO 4: ÉXITO -->
        @if (currentStep() === 4) {
          <div class="step-content success-pane animate-fade-in">
            <div class="success-icon-wrapper">
              <span class="material-symbols-outlined">check_circle</span>
            </div>
            <h2>¡Clínica Lista para Operar!</h2>
            <p class="success-desc">
              Los datos corporativos, la sede principal y el equipo clínico se han configurado con
              éxito. Ya puedes acceder al panel de mandos principal.
            </p>
            <button (click)="navigateToDashboard()" class="launch-btn">
              Comenzar a usar VetPro
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .onboarding-page {
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: radial-gradient(
          circle at 50% 0%,
          hsl(162, 70%, 10%) 0%,
          hsl(220, 25%, 5%) 100%
        );
        font-family: 'Inter', sans-serif;
        padding: 24px;
        box-sizing: border-box;
        color: #f3f4f6;
      }

      .glass-effect {
        background: rgba(17, 24, 39, 0.65);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.5);
      }

      .onboarding-card {
        position: relative;
        width: 100%;
        max-width: 480px;
        border-radius: 28px;
        padding: 40px;
        overflow: hidden;
        box-sizing: border-box;

        .card-glow {
          position: absolute;
          top: -60px;
          left: 50%;
          transform: translateX(-50%);
          width: 250px;
          height: 120px;
          background: radial-gradient(circle, hsla(162, 72%, 46%, 0.2) 0%, transparent 70%);
          pointer-events: none;
        }
      }

      /* Barra de Progreso */
      .progress-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 32px;

        .step {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.1);
          color: #6b7280;
          display: flex;
          justify-content: center;
          align-items: center;
          font-size: 0.85rem;
          font-weight: 700;
          transition: all 0.3s ease;

          &.active {
            border-color: #10b981;
            color: #34d399;
            background: rgba(16, 185, 129, 0.1);
          }

          &.current {
            background: #10b981;
            color: #ffffff;
            border-color: #10b981;
            box-shadow: 0 0 12px rgba(16, 185, 129, 0.35);
          }
        }

        .line {
          flex: 1;
          height: 2px;
          background: rgba(255, 255, 255, 0.08);
          margin-inline: 12px;

          &.active {
            background: #10b981;
          }
        }
      }

      /* Contenidos */
      .step-content {
        display: flex;
        flex-direction: column;
        gap: 20px;

        h2 {
          font-size: 1.5rem;
          font-weight: 800;
          color: #ffffff;
          margin: 0;
          letter-spacing: -0.3px;
        }

        .subtitle {
          font-size: 0.88rem;
          line-height: 1.45;
          color: #9ca3af;
          margin: -10px 0 8px;
        }
      }

      .error-inline {
        font-size: 0.85rem;
        color: #f87171;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 8px;
        padding: 10px 12px;
        margin: 0;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;

        label {
          font-size: 0.8rem;
          font-weight: 700;
          color: #cbd5e1;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        select option {
          background: #111827;
          color: #ffffff;
        }

        input,
        select {
          background: rgba(10, 15, 26, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px 16px;
          color: #ffffff;
          font-size: 0.95rem;
          font-family: inherit;
          outline: none;
          transition: all 0.3s ease;

          &:focus {
            border-color: #10b981;
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15);
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }

      /* Acciones */
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 12px;

        button {
          flex: 1;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 14px;
          border-radius: 12px;
          font-size: 0.92rem;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.3s ease;
        }

        .back-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.15);
          color: #cbd5e1;

          &:hover {
            background: rgba(255, 255, 255, 0.05);
            color: #ffffff;
          }
        }

        .next-btn {
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          border: none;
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);

          span {
            font-size: 1.2rem;
          }

          &:hover:not(:disabled) {
            background: linear-gradient(135deg, #047857 0%, #059669 100%);
            transform: translateY(-1px);
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }

      /* Éxito */
      .success-pane {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;

        .success-icon-wrapper {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid rgba(16, 185, 129, 0.25);
          display: flex;
          justify-content: center;
          align-items: center;
          margin-bottom: 16px;

          span {
            font-size: 3rem;
            color: #10b981;
          }
        }

        .success-desc {
          font-size: 0.9rem;
          line-height: 1.5;
          color: #cbd5e1;
          margin-bottom: 24px;
        }

        .launch-btn {
          width: 100%;
          background: linear-gradient(135deg, #059669 0%, #10b981 100%);
          border: none;
          border-radius: 12px;
          padding: 14px;
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(5, 150, 105, 0.3);
          transition: all 0.3s ease;

          &:hover {
            background: linear-gradient(135deg, #047857 0%, #059669 100%);
            transform: translateY(-1px);
          }
        }
      }

      .modality-cards {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-top: 4px;
      }

      .modality-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 8px;
        padding: 14px 10px;
        border-radius: 14px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        background: rgba(255, 255, 255, 0.04);
        cursor: pointer;
        transition: all 0.25s ease;

        span {
          font-size: 30px;
          color: #94a3b8;
        }
        .mod-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        strong {
          font-size: 0.82rem;
          color: #f8fafc;
          font-weight: 700;
        }
        small {
          font-size: 0.7rem;
          color: #94a3b8;
          line-height: 1.3;
        }

        &:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        &.selected {
          border-color: #10b981;
          background: rgba(16, 185, 129, 0.14);
          box-shadow: 0 0 16px rgba(16, 185, 129, 0.3);
          span {
            color: #34d399;
          }
          strong {
            color: #34d399;
          }
        }
      }

      .animate-fade-in {
        animation: fadeIn 0.4s ease-out both;
      }

      .animate-slide-up {
        animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
      }

      @keyframes fadeIn {
        from {
          opacity: 0;
        }
        to {
          opacity: 1;
        }
      }

      @keyframes slideUp {
        from {
          opacity: 0;
          transform: translateY(16px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class OnboardingComponent implements OnInit {
  private router = inject(Router);
  private geo = inject(GeoService);
  auth = inject(AuthService);

  currentStep = signal(1);

  // Paso 1: Tipo de práctica y datos
  businessType = signal<'clinic' | 'independent_vet'>('clinic');
  nit = signal('');
  phone = signal('');
  departamentoCode = signal('');
  municipioId = signal('');
  departamentos = signal<Departamento[]>([]);
  municipios = signal<Municipio[]>([]);
  loadingMunicipios = signal(false);

  ngOnInit() {
    this.geo.getDepartamentos().subscribe((list) => this.departamentos.set(list));
  }

  onDepartamentoChange() {
    const code = this.departamentoCode();
    this.municipioId.set('');
    this.municipios.set([]);
    if (!code) return;

    this.loadingMunicipios.set(true);
    this.geo.getMunicipios(code).subscribe({
      next: (list) => {
        this.municipios.set(list);
        this.loadingMunicipios.set(false);
      },
      error: () => this.loadingMunicipios.set(false),
    });
  }

  // Paso 2
  branchName = signal('');
  branchAddress = signal('');

  // Paso 3
  vetName = signal('');
  vetEmail = signal('');

  submitting = signal(false);
  errorMsg = signal('');

  goToStep(step: number) {
    this.currentStep.set(step);
  }

  finishOnboarding() {
    this.errorMsg.set('');
    this.submitting.set(true);

    this.auth
      .updateClinic({
        businessType: this.businessType(),
        phone: this.phone(),
        municipioId: this.municipioId(),
        nit: this.nit(),
      })
      .subscribe({
        next: () => this.createBranchThenVet(),
        error: (err) => {
          this.submitting.set(false);
          this.errorMsg.set(
            err?.error?.error ||
              'No se pudo guardar la configuración de la empresa. Intenta de nuevo.',
          );
        },
      });
  }

  // Pasos 2 y 3 son complementarios: si fallan, no bloquean el acceso al sistema
  // (ya se puede operar), pero avisamos en vez de fingir que se crearon.
  private createBranchThenVet() {
    if (!this.branchName() || !this.branchAddress()) {
      this.createVetIfProvided();
      return;
    }

    this.auth
      .createBranch({
        name: this.branchName(),
        address: this.branchAddress(),
        phone: this.phone() || '+57 300 000 0000',
      })
      .subscribe({
        next: () => this.createVetIfProvided(),
        error: () => {
          alert(
            'No se pudo crear la sede/zona de cobertura. Podrás agregarla luego desde Configuración de Sedes.',
          );
          this.createVetIfProvided();
        },
      });
  }

  private createVetIfProvided() {
    if (!this.vetName() || !this.vetEmail()) {
      this.finish();
      return;
    }

    const [firstName, ...rest] = this.vetName().trim().split(' ');
    this.auth
      .createUser({
        firstName: firstName || this.vetName(),
        lastName: rest.join(' ') || '-',
        email: this.vetEmail().trim().toLowerCase(),
        role: 'vet',
      })
      .subscribe({
        next: () => this.finish(),
        error: (err) => {
          alert(
            err?.error?.error ||
              'No se pudo registrar al veterinario adicional. Podrás agregarlo luego desde Gestión de Equipo.',
          );
          this.finish();
        },
      });
  }

  private finish() {
    this.submitting.set(false);
    localStorage.setItem('vetpro_clinic_onboarded', 'true');
    this.currentStep.set(4);
  }

  navigateToDashboard() {
    this.router.navigate(['/']);
  }
}
