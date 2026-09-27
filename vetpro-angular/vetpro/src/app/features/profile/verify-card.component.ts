import { Component, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/**
 * Se muestra al iniciar sesión a los médicos veterinarios cuya matrícula profesional
 * aún no está confirmada en el registro de COMVEZCOL. Si ya está verificada, no se muestra.
 * "Recordármelo después" deja entrar y se vuelve a pedir en el próximo inicio de sesión.
 */
@Component({
  selector: 'app-verify-card',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="verify-card-page">
      <div class="profile-card">
        <div class="logo">
          <span class="logo-mark">V</span>
          <span class="logo-name">VetPro</span>
        </div>

        @if (verified()) {
          <h2>Matrícula verificada</h2>
          <p class="ok-msg">{{ message() }}</p>
          <div class="actions">
            <button class="submit-btn" (click)="continue()">Continuar</button>
          </div>
        } @else {
          <h2>No hemos podido verificar tu matrícula profesional</h2>
          <p class="subtitle">
            Para ejercer en VetPro (recetas, firmas médicas y directorio público) necesitamos confirmar tu
            Tarjeta / Matrícula Profesional en el registro oficial de COMVEZCOL. Ingresa el número tal como
            aparece en tu tarjeta.
          </p>
          <p class="warn">
            Mientras tu matrícula no esté verificada, <strong>no aparecerás como disponible en el directorio
            público de VetPro</strong> y los tutores no podrán reservar citas contigo. Los tutores verán que tu
            matrícula está sin verificar.
          </p>

          @if (auth.currentUser?.verificationNotes) {
            <p class="note">{{ auth.currentUser?.verificationNotes }}</p>
          }

          <div class="form-group">
            <label>Número de matrícula profesional (COMVEZCOL)</label>
            <input
              type="text"
              [(ngModel)]="professionalCard"
              placeholder="Ej. 12345"
              maxlength="30"
              [disabled]="loading()"
              (keyup.enter)="submit()"
            />
          </div>

          @if (message()) {
            <p class="error-msg">{{ message() }}</p>
          }

          <div class="actions">
            <button class="submit-btn" (click)="submit()" [disabled]="loading()">
              {{ loading() ? 'Consultando COMVEZCOL…' : 'Verificar matrícula' }}
            </button>
            <button class="later-btn" (click)="continue()" [disabled]="loading()">Recordármelo después</button>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .verify-card-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--surface-ground, #f1f5f9);
        padding: 24px 16px;
      }
      .profile-card {
        width: 100%;
        max-width: 460px;
        background: var(--surface-card, #fff);
        border-radius: 14px;
        box-shadow: 0 8px 30px rgba(15, 23, 42, 0.08);
        padding: 28px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .logo {
        display: flex;
        align-items: center;
        gap: 10px;
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
      .subtitle,
      .note {
        font-size: 13px;
        color: var(--text-color-secondary, #64748b);
        margin: 0;
        line-height: 1.5;
      }
      .warn {
        font-size: 12.5px;
        line-height: 1.5;
        margin: 0;
        padding: 10px 12px;
        border-radius: 8px;
        color: #92400e;
        background: rgba(245, 158, 11, 0.12);
        border: 1px solid rgba(245, 158, 11, 0.35);
      }
      .note {
        background: var(--surface-ground, #f1f5f9);
        padding: 8px 10px;
        border-radius: 6px;
        font-size: 12px;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .form-group label {
        font-size: 12.5px;
        font-weight: 500;
        color: var(--text-color, #334155);
      }
      .form-group input {
        padding: 9px 12px;
        border: 1px solid var(--surface-border, #cbd5e1);
        border-radius: 7px;
        font-size: 13px;
        outline: none;
        background: var(--surface-card, #fff);
        color: var(--text-color, #0f172a);
        font-family: inherit;
      }
      .form-group input:focus {
        border-color: var(--primary-color, #2563eb);
      }
      .error-msg,
      .ok-msg {
        font-size: 12.5px;
        margin: 0;
        padding: 8px;
        border-radius: 6px;
        text-align: center;
      }
      .error-msg {
        color: var(--red-500, #ef4444);
        background: rgba(239, 68, 68, 0.08);
      }
      .ok-msg {
        color: #15803d;
        background: rgba(22, 163, 74, 0.08);
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 4px;
      }
      .submit-btn,
      .later-btn {
        width: 100%;
        padding: 11px;
        border-radius: 7px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        font-family: inherit;
      }
      .submit-btn {
        background: var(--primary-color, #2563eb);
        color: #fff;
        border: none;
      }
      .later-btn {
        background: transparent;
        color: var(--text-color-secondary, #64748b);
        border: 1px solid var(--surface-border, #cbd5e1);
      }
      .submit-btn:disabled,
      .later-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ],
})
export class VerifyCardComponent {
  auth = inject(AuthService);
  private router = inject(Router);

  professionalCard = signal(this.auth.currentUser?.professionalCard || '');
  loading = signal(false);
  verified = signal(false);
  message = signal('');

  constructor() {
    // Si ya tiene la matrícula verificada (o no es veterinario), no hay nada que pedir
    if (!this.auth.currentUser?.requiresCardVerification) {
      this.router.navigate(['/']);
    }
  }

  submit() {
    const card = this.professionalCard().trim();
    if (!card) {
      this.message.set('Ingresa el número de tu matrícula profesional.');
      return;
    }
    this.loading.set(true);
    this.message.set('');

    this.auth.submitProfessionalCard(card).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.verified.set(res.verified);
        this.message.set(res.message);
      },
      error: (err) => {
        this.loading.set(false);
        this.message.set(err?.error?.error || 'No se pudo verificar la matrícula. Intenta de nuevo.');
      },
    });
  }

  continue() {
    this.router.navigate(['/']);
  }
}
