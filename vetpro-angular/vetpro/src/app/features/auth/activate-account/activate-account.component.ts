import { Component, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-activate-account',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="activate-page">
      <div class="activate-card">
        <div class="logo">
          <span class="logo-mark">V</span>
          <span class="logo-name">VetPro</span>
        </div>

        @if (checking()) {
          <div class="state-msg">Verificando tu enlace...</div>
        }

        @if (!checking() && invalidLink()) {
          <div class="state-msg error">
            <p>{{ invalidLinkMsg() }}</p>
            <a routerLink="/auth/forgot-password">Solicitar un enlace nuevo</a>
            <a routerLink="/auth/login">Volver al inicio de sesión</a>
          </div>
        }

        @if (!checking() && !invalidLink()) {
          <h2>{{ isReset ? 'Restablece tu Contraseña' : 'Activa tu Cuenta' }}</h2>
          <p class="subtitle">
            Hola{{ firstName() ? ', ' + firstName() : '' }} —
            {{
              isReset
                ? 'define tu nueva contraseña para volver a ingresar a VetPro.'
                : 'define tu contraseña para empezar a usar VetPro.'
            }}
          </p>
          <div class="field">
            <label>Correo</label>
            <input type="email" [value]="email()" disabled />
          </div>
          <div class="field">
            <label>Nueva Contraseña</label>
            <input
              type="password"
              [(ngModel)]="password"
              placeholder="Mínimo 6 caracteres"
              autocomplete="new-password"
            />
          </div>
          <div class="field">
            <label>Confirmar Contraseña</label>
            <input
              type="password"
              [(ngModel)]="confirmPassword"
              placeholder="Repite tu contraseña"
              autocomplete="new-password"
              (keyup.enter)="submit()"
            />
          </div>
          @if (error()) {
            <p class="error">{{ error() }}</p>
          }
          <button class="btn-activate" (click)="submit()" [disabled]="loading()">
            @if (isReset) {
              {{ loading() ? 'Guardando...' : 'Guardar Contraseña e Ingresar' }}
            } @else {
              {{ loading() ? 'Activando...' : 'Activar Cuenta e Ingresar' }}
            }
          </button>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .activate-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-ground, #f8fafc);
        font-family: 'Inter', sans-serif;
        padding: 30px 16px;
      }
      .activate-card {
        background: var(--surface-card, #ffffff);
        border: 1px solid var(--surface-border, #e2e8f0);
        border-radius: 12px;
        padding: 36px;
        width: 100%;
        max-width: 440px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        box-sizing: border-box;
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
      .state-msg {
        font-size: 14px;
        color: var(--text-color-secondary, #64748b);
        text-align: center;
        padding: 20px 0;

        &.error {
          color: #ef4444;
          display: flex;
          flex-direction: column;
          gap: 12px;

          a {
            color: var(--primary-color, #2563eb);
            text-decoration: none;
            font-weight: 600;
            &:hover {
              text-decoration: underline;
            }
          }
        }
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 14px;

        label {
          font-size: 12.5px;
          font-weight: 500;
          color: var(--text-color, #334155);
        }
        input {
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
            color: var(--text-color-secondary, #94a3b8);
          }
        }
      }
      .error {
        color: #ef4444;
        font-size: 12.5px;
        margin: 0 0 14px;
        text-align: center;
        background: rgba(239, 68, 68, 0.08);
        padding: 8px;
        border-radius: 6px;
      }
      .btn-activate {
        width: 100%;
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
export class ActivateAccountComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);

  checking = signal(true);
  invalidLink = signal(false);
  invalidLinkMsg = signal('');
  firstName = signal('');
  email = signal('');

  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');

  private token = '';
  readonly isReset = this.route.snapshot.data['mode'] === 'reset';

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') || '';
    if (!this.token) {
      this.checking.set(false);
      this.invalidLink.set(true);
      this.invalidLinkMsg.set('Enlace no válido: falta el token.');
      return;
    }

    this.auth.getActivationInfo(this.token).subscribe({
      next: (res) => {
        this.checking.set(false);
        this.firstName.set(res.firstName);
        this.email.set(res.email);
      },
      error: (err) => {
        this.checking.set(false);
        this.invalidLink.set(true);
        this.invalidLinkMsg.set(
          err?.error?.error || 'Este enlace no es válido o ya expiró.',
        );
      },
    });
  }

  submit() {
    this.error.set('');

    if (!this.password || this.password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.error.set('Las contraseñas no coinciden.');
      return;
    }

    this.loading.set(true);
    this.auth.activateAccount(this.token, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'No se pudo guardar la contraseña. Intenta de nuevo.');
      },
    });
  }
}
