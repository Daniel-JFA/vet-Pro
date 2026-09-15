import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GeoService, Departamento, Municipio } from '../../core/services/geo.service';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="complete-profile-page">
      <div class="profile-card glass-effect animate-fade-in">
        <div class="card-glow"></div>

        <h2>Completa tus Datos</h2>
        <p class="subtitle">
          Antes de continuar, necesitamos algunos datos tuyos para terminar de configurar tu cuenta
          en {{ auth.currentClinic?.name || 'VetPro' }}.
        </p>

        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>Tipo de Documento</label>
            <select [(ngModel)]="documentType">
              <option value="CC">Cédula de Ciudadanía</option>
              <option value="CE">Cédula de Extranjería</option>
              <option value="TI">Tarjeta de Identidad</option>
              <option value="PA">Pasaporte</option>
            </select>
          </div>
          <div class="form-group" style="flex: 2;">
            <label>Número de Documento</label>
            <input type="text" [(ngModel)]="documentNumber" placeholder="Ej: 1035800000" />
          </div>
        </div>

        <div class="form-group">
          <label>Teléfono de Contacto</label>
          <input type="tel" [(ngModel)]="phone" placeholder="Ej: +57 312 456 7890" />
        </div>

        <div class="form-row">
          <div class="form-group" style="flex: 1;">
            <label>Departamento</label>
            <select [(ngModel)]="departamentoCode" (ngModelChange)="onDepartamentoChange()">
              <option value="" disabled selected>Selecciona...</option>
              <option *ngFor="let d of departamentos()" [value]="d.code">{{ d.nombre }}</option>
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label>Municipio / Ciudad</label>
            <select [(ngModel)]="municipioId" [disabled]="!departamentoCode() || loadingMunicipios()">
              <option value="" disabled selected>{{ loadingMunicipios() ? 'Cargando...' : 'Selecciona...' }}</option>
              <option *ngFor="let m of municipios()" [value]="m.id">{{ m.nombre }}</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Dirección Exacta</label>
          <input type="text" [(ngModel)]="address" placeholder="Ej: Calle 45 #20-30" />
        </div>

        <div class="form-group">
          <label>Fecha de Nacimiento (Opcional)</label>
          <input type="date" [(ngModel)]="birthDate" />
        </div>

        <p class="error-msg" *ngIf="errorMsg()">{{ errorMsg() }}</p>

        <div class="actions">
          <button
            class="submit-btn"
            (click)="submit()"
            [disabled]="loading() || !documentNumber() || !phone() || !address() || !municipioId()"
          >
            {{ loading() ? 'Guardando...' : 'Guardar y Continuar' }}
            <span class="material-symbols-outlined" *ngIf="!loading()">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .complete-profile-page {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: radial-gradient(circle at 50% 0%, hsl(162, 70%, 10%) 0%, hsl(220, 25%, 5%) 100%);
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

    .profile-card {
      position: relative;
      width: 100%;
      max-width: 480px;
      border-radius: 28px;
      padding: 40px;
      overflow: hidden;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      gap: 18px;

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
      margin: -8px 0 4px;
    }

    .form-row {
      display: flex;
      gap: 12px;
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

      input, select {
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
      }

      select option {
        background: #111827;
        color: #ffffff;
      }
    }

    .error-msg {
      margin: 0;
      font-size: 0.85rem;
      color: #f87171;
    }

    .actions {
      margin-top: 4px;
    }

    .submit-btn {
      width: 100%;
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
      background: linear-gradient(135deg, #059669 0%, #10b981 100%);
      border: none;
      color: #ffffff;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);

      span { font-size: 1.2rem; }

      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #047857 0%, #059669 100%);
        transform: translateY(-1px);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .animate-fade-in {
      animation: fadeIn 0.4s ease-out both;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `]
})
export class CompleteProfileComponent implements OnInit {
  private router = inject(Router);
  private geo = inject(GeoService);
  auth = inject(AuthService);

  documentType = signal<'CC' | 'CE' | 'TI' | 'PA'>('CC');
  documentNumber = signal('');
  phone = signal('');
  address = signal('');
  birthDate = signal('');
  loading = signal(false);
  errorMsg = signal('');

  departamentoCode = signal('');
  municipioId = signal('');
  departamentos = signal<Departamento[]>([]);
  municipios = signal<Municipio[]>([]);
  loadingMunicipios = signal(false);

  constructor() {
    // Si ya completó su perfil, no tiene nada que hacer aquí
    if (this.auth.currentUser?.profileCompleted) {
      this.router.navigate(['/']);
    }
  }

  ngOnInit() {
    this.geo.getDepartamentos().subscribe(list => this.departamentos.set(list));
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
      error: () => this.loadingMunicipios.set(false)
    });
  }

  submit() {
    this.errorMsg.set('');
    this.loading.set(true);

    this.auth.completeProfile({
      documentType: this.documentType(),
      documentNumber: this.documentNumber(),
      phone: this.phone(),
      address: this.address(),
      municipioId: this.municipioId(),
      birthDate: this.birthDate() || null
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.error || 'No se pudo guardar tu información. Intenta de nuevo.');
      }
    });
  }
}
