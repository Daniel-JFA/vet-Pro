import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PrivacyService } from '../../core/services/privacy.service';

// "Mi cuenta" del personal de clínica: datos de la sesión y eliminación de la cuenta
// (requisito de App Store y Google Play).
@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="account-page">
      <h1>Mi cuenta</h1>

      @if (auth.currentUser; as user) {
        <div class="card">
          <p><strong>{{ user.firstName }} {{ user.lastName }}</strong></p>
          <p class="muted">{{ user.email }}</p>
        </div>
      }

      <div class="card">
        <h2>Privacidad</h2>
        <p>
          Consulta cómo tratamos tus datos en la <a routerLink="/privacidad" target="_blank">Política de Tratamiento de Datos</a>.
        </p>
      </div>

      <div class="card danger">
        <h2>Eliminar mi cuenta</h2>
        <p>
          Se cerrará tu acceso y se borrarán tu correo, teléfono, documento, dirección y documentos cargados. Tu nombre se
          conserva solo como autor de las historias clínicas que firmaste.
        </p>
        <p>
          Si eres la última persona con acceso a la clínica, <strong>toda la información de la clínica se borrará de forma
          definitiva en 30 días</strong>. Si eres el único administrador y hay más personas en el equipo, primero asigna el
          rol de administrador a alguien más.
        </p>

        @if (done(); as message) {
          <p class="done" role="status">{{ message }}</p>
          <button class="btn-danger" (click)="auth.logout()">Salir</button>
        } @else if (!confirming()) {
          <button class="btn-danger" (click)="confirming.set(true)">Eliminar mi cuenta</button>
        } @else {
          <form (ngSubmit)="deleteAccount()" class="confirm-form">
            <label>
              Escribe tu contraseña para confirmar
              <input type="password" name="password" [(ngModel)]="password" autocomplete="current-password" required />
            </label>
            <div class="actions">
              <button type="button" class="btn-ghost" (click)="cancel()" [disabled]="deleting()">Cancelar</button>
              <button type="submit" class="btn-danger" [disabled]="deleting() || !password">
                {{ deleting() ? 'Eliminando…' : 'Eliminar definitivamente' }}
              </button>
            </div>
            @if (error()) {
              <p class="error" role="alert">{{ error() }}</p>
            }
          </form>
        }
      </div>
    </section>
  `,
  styles: [`
    .account-page { max-width: 720px; display: grid; gap: 16px; }
    h1 { margin: 0; font-size: 24px; }
    h2 { margin: 0 0 8px; font-size: 17px; }
    .card { background: var(--surface-card, #fff); border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; }
    .card p { margin: 0 0 10px; line-height: 1.5; }
    .card p:last-child { margin-bottom: 0; }
    .muted { color: #64748b; }
    .danger { border-color: #fecaca; }
    .danger h2 { color: #b91c1c; }
    .confirm-form { display: grid; gap: 12px; margin-top: 8px; }
    .confirm-form label { display: grid; gap: 6px; font-weight: 600; font-size: 14px; }
    .confirm-form input { font: inherit; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 8px; max-width: 360px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .btn-danger { background: #dc2626; color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-weight: 700; cursor: pointer; }
    .btn-danger:disabled { opacity: 0.6; cursor: default; }
    .btn-ghost { background: transparent; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 18px; cursor: pointer; }
    .error { color: #b91c1c; margin: 0; }
    .done { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 8px; padding: 10px 14px; }
  `]
})
export class MyAccountComponent {
  auth = inject(AuthService);
  private privacy = inject(PrivacyService);

  confirming = signal(false);
  deleting = signal(false);
  error = signal<string | null>(null);
  done = signal<string | null>(null);
  password = '';

  cancel(): void {
    this.confirming.set(false);
    this.password = '';
    this.error.set(null);
  }

  deleteAccount(): void {
    this.deleting.set(true);
    this.error.set(null);
    this.privacy.deleteMyStaffAccount(this.password).subscribe({
      // El aviso de éxito se muestra aquí: al salir se pierde el contenedor de toasts
      next: (res) => {
        this.deleting.set(false);
        this.done.set(res.message);
      },
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err.error?.error || 'No se pudo eliminar la cuenta. Intenta de nuevo.');
      }
    });
  }
}
