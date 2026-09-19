import { Component, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { GeoService, Departamento, Municipio } from '../../core/services/geo.service';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="complete-profile-page">
      <div class="profile-card">
        <div class="logo">
          <span class="logo-mark">V</span>
          <span class="logo-name">VetPro</span>
        </div>

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
              @for (d of departamentos(); track d) {
                <option [value]="d.code">{{ d.nombre }}</option>
              }
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
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
        </div>

        <div class="form-group">
          <label>Dirección Exacta</label>
          <input type="text" [(ngModel)]="address" placeholder="Ej: Calle 45 #20-30" />
        </div>

        <div class="form-group">
          <label>Fecha de Nacimiento (Opcional)</label>
          <input type="date" [(ngModel)]="birthDate" />
        </div>

        @if (errorMsg()) {
          <p class="error-msg">{{ errorMsg() }}</p>
        }

        <div class="actions">
          <button
            class="submit-btn"
            (click)="submit()"
            [disabled]="loading() || !documentNumber() || !phone() || !address() || !municipioId()"
          >
            {{ loading() ? 'Guardando...' : 'Guardar y Continuar' }}
            @if (!loading()) {
              <span class="material-symbols-outlined">arrow_forward</span>
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .complete-profile-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-ground, #f8fafc);
        font-family: 'Inter', sans-serif;
        padding: 30px 16px;
      }

      .profile-card {
        background: var(--surface-card, #ffffff);
        border: 1px solid var(--surface-border, #e2e8f0);
        border-radius: 12px;
        padding: 36px;
        width: 100%;
        max-width: 520px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 4px;
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
        margin: 0;
        color: var(--text-color, #0f172a);
      }

      .subtitle {
        font-size: 13px;
        color: var(--text-color-secondary, #64748b);
        margin: 0;
        line-height: 1.5;
      }

      .form-row {
        display: flex;
        gap: 12px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;

        label {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--text-color, #334155);
        }

        input,
        select {
          padding: 9px 12px;
          border: 1px solid var(--surface-border, #cbd5e1);
          border-radius: 7px;
          font-size: 13px;
          outline: none;
          background: var(--surface-card, #fff);
          color: var(--text-color, #0f172a);
          font-family: inherit;
          transition: border-color 0.2s;

          &:focus {
            border-color: var(--primary-color, #2563eb);
          }

          &:disabled {
            background: var(--surface-ground, #f1f5f9);
            cursor: not-allowed;
          }
        }
      }

      .error-msg {
        color: var(--red-500, #ef4444);
        font-size: 12.5px;
        margin: 0;
        text-align: center;
        background: rgba(239, 68, 68, 0.08);
        padding: 8px;
        border-radius: 6px;
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
        padding: 11px;
        background: var(--primary-color, #2563eb);
        color: #fff;
        border: none;
        border-radius: 7px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
        transition: opacity 0.2s;

        span {
          font-size: 1.1rem;
        }

        &:hover:not(:disabled) {
          filter: brightness(0.95);
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    `,
  ],
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

  submit() {
    this.errorMsg.set('');
    this.loading.set(true);

    this.auth
      .completeProfile({
        documentType: this.documentType(),
        documentNumber: this.documentNumber(),
        phone: this.phone(),
        address: this.address(),
        municipioId: this.municipioId(),
        birthDate: this.birthDate() || null,
      })
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/']);
        },
        error: (err) => {
          this.loading.set(false);
          this.errorMsg.set(
            err?.error?.error || 'No se pudo guardar tu información. Intenta de nuevo.',
          );
        },
      });
  }
}
