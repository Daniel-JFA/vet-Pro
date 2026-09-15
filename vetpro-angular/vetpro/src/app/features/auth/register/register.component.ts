import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { GeoService, Departamento, Municipio } from '../../../core/services/geo.service';
import { PrivacyModalComponent } from '../../../shared/components/privacy-modal/privacy-modal.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, PrivacyModalComponent],
  template: `
    <div class="register-page">
      <div class="register-card">
        <div class="logo">
          <span class="logo-mark">V</span>
          <span class="logo-name">VetPro</span>
        </div>
        
        <h2>Crear cuenta en VetPro</h2>
        <p class="subtitle">Comienza a gestionar tu práctica veterinaria hoy mismo</p>

        <form [formGroup]="form" (ngSubmit)="submit()">
          <!-- Selector de Modalidad (Clínica vs Independiente) -->
          <div class="mode-selector">
            <button
              type="button"
              class="mode-btn"
              [class.active]="selectedType() === 'clinic'"
              (click)="setType('clinic')"
            >
              <span class="mode-icon">🏥</span>
              <div class="mode-info">
                <strong>Clínica Veterinaria</strong>
                <span>Con sede física o multicentro</span>
              </div>
            </button>
            <button
              type="button"
              class="mode-btn"
              [class.active]="selectedType() === 'independent_vet'"
              (click)="setType('independent_vet')"
            >
              <span class="mode-icon">🩺</span>
              <div class="mode-info">
                <strong>Vet Independiente</strong>
                <span>Atención a domicilio / móvil</span>
              </div>
            </button>
          </div>

          <div class="field">
            <label>{{ selectedType() === 'clinic' ? 'Nombre de la Clínica / Centro Veterinario' : 'Nombre Profesional o Marca Comercial' }} *</label>
            <input
              type="text"
              formControlName="clinicName"
              [placeholder]="selectedType() === 'clinic' ? 'Ej. Clínica San Miguel' : 'Ej. Dr. Andrés Flórez - Vet Domicilios'"
            />
          </div>

          <div class="row-2">
            <div class="field">
              <label>Tu Nombre *</label>
              <input type="text" formControlName="firstName" placeholder="Nombre" />
            </div>
            <div class="field">
              <label>Tu Apellido *</label>
              <input type="text" formControlName="lastName" placeholder="Apellido" />
            </div>
          </div>

          <div class="field">
            <label>Correo electrónico (Usuario Administrador) *</label>
            <input type="email" formControlName="email" placeholder="admin@tuveterinaria.com" autocomplete="username" />
          </div>

          <div class="field">
            <label>Contraseña segura *</label>
            <input type="password" formControlName="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password" />
          </div>

          <div class="field">
            <label>Teléfono móvil *</label>
            <input type="tel" formControlName="phone" placeholder="+57 300 123 4567" />
          </div>

          <div class="row-2">
            <div class="field">
              <label>Departamento *</label>
              <select formControlName="departamentoCode" (change)="onDepartamentoChange()">
                <option value="" disabled selected>Selecciona...</option>
                <option *ngFor="let d of departamentos()" [value]="d.code">{{ d.nombre }}</option>
              </select>
            </div>
            <div class="field">
              <label>Municipio / Ciudad *</label>
              <select formControlName="municipioId" [disabled]="!form.value.departamentoCode || loadingMunicipios()">
                <option value="" disabled selected>{{ loadingMunicipios() ? 'Cargando...' : 'Selecciona...' }}</option>
                <option *ngFor="let m of municipios()" [value]="m.id">{{ m.nombre }}</option>
              </select>
            </div>
          </div>

          <!-- Clínica: NIT obligatorio -->
          <div class="field" *ngIf="selectedType() === 'clinic'">
            <label>NIT *</label>
            <input type="text" formControlName="nit" placeholder="900.123.456-1" />
          </div>

          <!-- Vet Independiente: documento de identidad personal obligatorio -->
          <div class="row-2" *ngIf="selectedType() === 'independent_vet'">
            <div class="field" style="flex: 1;">
              <label>Tipo Doc. *</label>
              <select formControlName="documentType">
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="TI">TI</option>
                <option value="PA">Pasaporte</option>
              </select>
            </div>
            <div class="field" style="flex: 2;">
              <label>Número de Documento *</label>
              <input type="text" formControlName="documentNumber" placeholder="Ej: 1035800000" />
            </div>
          </div>

          <button type="submit" class="btn-register" [disabled]="loading() || form.invalid">
            {{ loading() ? 'Creando cuenta…' : 'Comenzar Ahora' }}
          </button>

          <p class="error" *ngIf="error()">{{ error() }}</p>

          <div class="login-link">
            ¿Ya tienes una cuenta? <a routerLink="/auth/login">Inicia sesión aquí</a>
          </div>

          <div class="privacy-legal-text">
            Al registrarte, aceptas nuestros términos de servicio y la <a href="javascript:void(0)" (click)="isPrivacyOpen.set(true)">Política de Privacidad y Tratamiento de Datos (Ley 1581/2012)</a>.
          </div>
        </form>
      </div>

      <!-- Modal de Privacidad (Habeas Data) -->
      <app-privacy-modal [(isOpen)]="isPrivacyOpen"></app-privacy-modal>
    </div>
  `,
  styles: [`
    .register-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--surface-ground, #f8fafc);
      font-family: 'Inter', sans-serif;
      padding: 30px 16px;
    }
    .register-card {
      background: var(--surface-card, #ffffff);
      border: 1px solid var(--surface-border, #e2e8f0);
      border-radius: 12px;
      padding: 36px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .logo {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 20px;
    }
    .logo-mark {
      width: 36px;
      height: 36px;
      background: var(--primary-color, #2563eb);
      color: #fff;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 18px;
    }
    .logo-name {
      font-size: 18px;
      font-weight: 600;
      color: var(--text-color, #1e293b);
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 4px;
      color: var(--text-color, #0f172a);
    }
    .subtitle {
      font-size: 13px;
      color: var(--text-color-secondary, #64748b);
      margin: 0 0 20px;
    }
    .mode-selector {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    .mode-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px;
      background: var(--surface-ground, #f8fafc);
      border: 2px solid var(--surface-border, #e2e8f0);
      border-radius: 8px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
    }
    .mode-btn.active {
      border-color: var(--primary-color, #2563eb);
      background: rgba(37, 99, 235, 0.04);
    }
    .mode-icon {
      font-size: 24px;
    }
    .mode-info {
      display: flex;
      flex-direction: column;
    }
    .mode-info strong {
      font-size: 12.5px;
      color: var(--text-color, #0f172a);
    }
    .mode-info span {
      font-size: 11px;
      color: var(--text-color-secondary, #64748b);
    }
    .row-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 14px;
    }
    label {
      font-size: 12.5px;
      font-weight: 500;
      color: var(--text-color, #334155);
    }
    input, select {
      padding: 9px 12px;
      border: 1px solid var(--surface-border, #cbd5e1);
      border-radius: 7px;
      font-size: 13px;
      outline: none;
      background: var(--surface-card, #fff);
      color: var(--text-color, #0f172a);
      transition: border-color 0.2s;
      font-family: inherit;
      &:focus {
        border-color: var(--primary-color, #2563eb);
      }
      &:disabled {
        background: var(--surface-ground, #f1f5f9);
        cursor: not-allowed;
      }
    }
    .btn-register {
      width: 100%;
      padding: 11px;
      background: var(--primary-color, #2563eb);
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: opacity 0.2s;
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      &:hover:not(:disabled) {
        filter: brightness(0.95);
      }
    }
    .error {
      color: var(--red-500, #ef4444);
      font-size: 12.5px;
      margin-top: 10px;
      text-align: center;
      background: rgba(239, 68, 68, 0.08);
      padding: 8px;
      border-radius: 6px;
    }
    .login-link {
      font-size: 13px;
      text-align: center;
      margin-top: 16px;
      color: var(--text-color-secondary, #64748b);
      a {
        color: var(--primary-color, #2563eb);
        text-decoration: none;
        font-weight: 600;
        &:hover {
          text-decoration: underline;
        }
      }
    }
    .privacy-legal-text {
      font-size: 11px;
      color: var(--text-color-secondary, #94a3b8);
      margin-top: 18px;
      text-align: center;
      line-height: 1.45;
      a {
        color: var(--primary-color, #2563eb);
        text-decoration: none;
        font-weight: 500;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  `]
})
export class RegisterComponent implements OnInit {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private geo = inject(GeoService);
  private router = inject(Router);

  isPrivacyOpen = signal(false);
  loading = signal(false);
  error = signal('');
  selectedType = signal<'clinic' | 'independent_vet'>('clinic');

  departamentos = signal<Departamento[]>([]);
  municipios = signal<Municipio[]>([]);
  loadingMunicipios = signal(false);

  form = this.fb.group({
    clinicName: ['', [Validators.required, Validators.minLength(2)]],
    firstName: ['', [Validators.required, Validators.minLength(2)]],
    lastName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: ['', [Validators.required]],
    departamentoCode: ['', [Validators.required]],
    municipioId: ['', [Validators.required]],
    nit: [''],
    documentType: ['CC'],
    documentNumber: ['']
  });

  ngOnInit() {
    this.geo.getDepartamentos().subscribe(list => this.departamentos.set(list));
    this.applyTypeValidators('clinic');
  }

  setType(type: 'clinic' | 'independent_vet') {
    this.selectedType.set(type);
    this.applyTypeValidators(type);
  }

  private applyTypeValidators(type: 'clinic' | 'independent_vet') {
    const nitCtrl = this.form.get('nit');
    const docNumberCtrl = this.form.get('documentNumber');

    if (type === 'clinic') {
      nitCtrl?.setValidators([Validators.required]);
      docNumberCtrl?.clearValidators();
    } else {
      nitCtrl?.clearValidators();
      docNumberCtrl?.setValidators([Validators.required]);
    }
    nitCtrl?.updateValueAndValidity();
    docNumberCtrl?.updateValueAndValidity();
  }

  onDepartamentoChange() {
    const code = this.form.value.departamentoCode;
    this.form.patchValue({ municipioId: '' });
    this.municipios.set([]);
    if (!code) return;

    this.loadingMunicipios.set(true);
    this.geo.getMunicipios(code).subscribe({
      next: (list) => {
        this.municipios.set(list);
        this.loadingMunicipios.set(false);
      },
      error: () => this.loadingMunicipios.set(false)
    });
  }

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    const val = this.form.value;

    this.auth.register({
      clinicName: val.clinicName!.trim(),
      businessType: this.selectedType(),
      firstName: val.firstName!.trim(),
      lastName: val.lastName!.trim(),
      email: val.email!.trim().toLowerCase(),
      password: val.password!,
      phone: val.phone?.trim(),
      municipioId: val.municipioId!,
      nit: val.nit?.trim() || undefined,
      documentType: this.selectedType() === 'independent_vet' ? (val.documentType as 'CC' | 'CE' | 'TI' | 'PA' | undefined) : undefined,
      documentNumber: this.selectedType() === 'independent_vet' ? val.documentNumber?.trim() || undefined : undefined
    }).subscribe({
      next: () => {
        // Redirigir al inicio del sistema
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'Ocurrió un error al registrar la cuenta.');
      }
    });
  }
}
