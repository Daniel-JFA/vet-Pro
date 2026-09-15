import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PlatformAuthService } from '../../core/services/platform-auth.service';

@Component({
  selector: 'app-platform-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="platform-login-page">
      <div class="login-card glass-effect animate-fade-in">
        <div class="card-glow"></div>
        <span class="material-symbols-outlined shield-icon">shield_person</span>
        <h2>Super Administración</h2>
        <p class="subtitle">Panel de plataforma VetPro — visión general de todos los tenants.</p>

        <div class="form-group">
          <label>Correo</label>
          <input type="email" [(ngModel)]="email" placeholder="admin@vetpro.dev" (keyup.enter)="submit()" />
        </div>

        <div class="form-group">
          <label>Contraseña</label>
          <input type="password" [(ngModel)]="password" placeholder="••••••••" (keyup.enter)="submit()" />
        </div>

        <p class="error-msg" *ngIf="errorMsg()">{{ errorMsg() }}</p>

        <button class="submit-btn" (click)="submit()" [disabled]="loading() || !email() || !password()">
          {{ loading() ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .platform-login-page {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: radial-gradient(circle at 50% 0%, hsl(255, 60%, 12%) 0%, hsl(220, 25%, 5%) 100%);
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
    .login-card {
      position: relative;
      width: 100%;
      max-width: 400px;
      border-radius: 28px;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      box-sizing: border-box;

      .card-glow {
        position: absolute;
        top: -60px;
        left: 50%;
        transform: translateX(-50%);
        width: 250px;
        height: 120px;
        background: radial-gradient(circle, hsla(255, 70%, 60%, 0.25) 0%, transparent 70%);
        pointer-events: none;
      }
    }
    .shield-icon {
      font-size: 40px;
      color: #a78bfa;
    }
    h2 { font-size: 1.4rem; font-weight: 800; color: #fff; margin: 0; }
    .subtitle { font-size: 0.85rem; color: #9ca3af; margin: -8px 0 4px; }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
      label { font-size: 0.75rem; font-weight: 700; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.5px; }
      input {
        background: rgba(10, 15, 26, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 12px 16px;
        color: #fff;
        font-size: 0.95rem;
        font-family: inherit;
        outline: none;
        &:focus { border-color: #a78bfa; box-shadow: 0 0 0 4px rgba(167, 139, 250, 0.15); }
      }
    }
    .error-msg { margin: 0; font-size: 0.85rem; color: #f87171; }
    .submit-btn {
      padding: 14px;
      border-radius: 12px;
      font-size: 0.92rem;
      font-weight: 700;
      cursor: pointer;
      border: none;
      color: #fff;
      background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
      box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);
      &:hover:not(:disabled) { transform: translateY(-1px); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .animate-fade-in { animation: fadeIn 0.4s ease-out both; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  `]
})
export class PlatformLoginComponent {
  private router = inject(Router);
  private auth = inject(PlatformAuthService);

  email = signal('');
  password = signal('');
  loading = signal(false);
  errorMsg = signal('');

  submit() {
    this.loading.set(true);
    this.errorMsg.set('');
    this.auth.login(this.email(), this.password()).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/platform/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.errorMsg.set(err?.error?.error || 'Credenciales incorrectas.');
      }
    });
  }
}
