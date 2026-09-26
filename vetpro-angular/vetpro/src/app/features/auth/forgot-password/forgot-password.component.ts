import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="forgot-page">
      <div class="forgot-card">
        <div class="logo">
          <span class="logo-mark">V</span>
          <span class="logo-name">VetPro</span>
        </div>

        @if (sentMessage()) {
          <h2>Revisa tu correo</h2>
          <p class="subtitle">{{ sentMessage() }}</p>
          <p class="hint">
            El enlace expira en 1 hora. Si no lo ves, revisa la carpeta de spam o solicita otro.
          </p>
          <a routerLink="/auth/login" class="btn-primary">Volver al inicio de sesión</a>
        } @else {
          <h2>¿Olvidaste tu contraseña?</h2>
          <p class="subtitle">
            Escribe el correo con el que ingresas y te enviaremos un enlace para definir una nueva.
          </p>

          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="field">
              <label>Correo electrónico</label>
              <input
                type="email"
                formControlName="email"
                placeholder="vet@clinica.com"
                autocomplete="username"
              />
            </div>

            @if (error()) {
              <p class="error">{{ error() }}</p>
            }

            <button type="submit" class="btn-primary" [disabled]="loading() || form.invalid">
              {{ loading() ? 'Enviando…' : 'Enviar enlace' }}
            </button>
          </form>

          <div class="back-link">
            <a routerLink="/auth/login">Volver al inicio de sesión</a>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .forgot-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-ground);
        font-family: 'Inter', sans-serif;
        padding: 30px 16px;
      }
      .forgot-card {
        background: var(--surface-card);
        border: 1px solid var(--surface-border);
        border-radius: 12px;
        padding: 40px;
        width: 100%;
        max-width: 380px;
        box-sizing: border-box;
      }
      .logo {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 24px;
      }
      .logo-mark {
        width: 36px;
        height: 36px;
        background: var(--primary-color);
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
      }
      h2 {
        font-size: 18px;
        margin: 0 0 6px;
      }
      .subtitle {
        font-size: 12.5px;
        color: var(--text-color-secondary, #64748b);
        margin: 0 0 20px;
        line-height: 1.5;
      }
      .hint {
        font-size: 12px;
        color: var(--text-color-secondary, #64748b);
        margin: 0 0 20px;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        margin-bottom: 14px;
      }
      label {
        font-size: 13px;
        font-weight: 500;
      }
      input {
        padding: 9px 12px;
        border: 1px solid var(--surface-border);
        border-radius: 7px;
        font-size: 13px;
        outline: none;
        &:focus {
          border-color: var(--primary-color);
        }
      }
      .btn-primary {
        display: block;
        width: 100%;
        padding: 10px;
        background: var(--primary-color);
        color: #fff;
        border: none;
        border-radius: 7px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        box-sizing: border-box;
        &:disabled {
          opacity: 0.6;
        }
      }
      .error {
        color: var(--red-500);
        font-size: 12px;
        margin: 0 0 10px;
        text-align: center;
      }
      .back-link {
        font-size: 12.5px;
        text-align: center;
        margin-top: 16px;
        a {
          color: var(--primary-color);
          text-decoration: none;
          font-weight: 600;
          &:hover {
            text-decoration: underline;
          }
        }
      }
    `,
  ],
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);

  loading = signal(false);
  error = signal('');
  sentMessage = signal('');
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  submit() {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');

    this.auth.requestPasswordReset(this.form.value.email!.trim()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.sentMessage.set(res.message);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.error || 'No se pudo enviar el enlace. Intenta de nuevo.');
      },
    });
  }
}
