import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TutorAuthService } from '../../../core/services/tutor-auth.service';
import { PrivacyService } from '../../../core/services/privacy.service';

// Cuenta del tutor: política de privacidad y eliminación de sus datos
// (requisito de App Store y Google Play; derecho de supresión, Ley 1581).
@Component({
  selector: 'app-portal-account',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="portal-account">
      <h1>Mi cuenta</h1>

      @if (authSvc.tutor(); as tutor) {
        <div class="card">
          <p><strong>{{ tutor.firstName }} {{ tutor.lastName }}</strong></p>
          <p class="muted">{{ tutor.phone }}</p>
        </div>
      }

      <div class="card">
        <h2>Privacidad</h2>
        <p>Consulta cómo se tratan tus datos en la <a routerLink="/privacidad">Política de Tratamiento de Datos</a>.</p>
      </div>

      <div class="card danger">
        <h2>Eliminar mis datos</h2>
        <p>
          Se cerrará tu acceso al portal y se borrarán tu correo, teléfono y dirección. La historia clínica de tus mascotas
          sigue en poder de la clínica, que debe conservarla. Si tienes facturas, la clínica conserva tu nombre y documento
          por obligación tributaria.
        </p>

        @if (!confirming()) {
          <button class="btn-danger" (click)="confirming.set(true)">Eliminar mis datos</button>
        } @else {
          <p><strong>¿Seguro? Esta acción no se puede deshacer.</strong></p>
          <div class="actions">
            <button class="btn-ghost" (click)="confirming.set(false)" [disabled]="deleting()">Cancelar</button>
            <button class="btn-danger" (click)="deleteData()" [disabled]="deleting()">
              {{ deleting() ? 'Eliminando…' : 'Sí, eliminar mis datos' }}
            </button>
          </div>
          @if (error()) {
            <p class="error" role="alert">{{ error() }}</p>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    .portal-account { display: grid; gap: 14px; padding-bottom: 24px; }
    h1 { margin: 0; font-size: 22px; }
    h2 { margin: 0 0 8px; font-size: 16px; }
    .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 18px; }
    .card p { margin: 0 0 10px; line-height: 1.5; }
    .card p:last-child { margin-bottom: 0; }
    .muted { color: #64748b; }
    .danger { border-color: #fecaca; }
    .danger h2 { color: #b91c1c; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
    .btn-danger { background: #dc2626; color: #fff; border: none; border-radius: 10px; padding: 10px 16px; font-weight: 700; cursor: pointer; }
    .btn-danger:disabled { opacity: 0.6; cursor: default; }
    .btn-ghost { background: transparent; border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 16px; cursor: pointer; }
    .error { color: #b91c1c; }
  `]
})
export class PortalAccountComponent {
  authSvc = inject(TutorAuthService);
  private privacy = inject(PrivacyService);

  confirming = signal(false);
  deleting = signal(false);
  error = signal<string | null>(null);

  deleteData(): void {
    this.deleting.set(true);
    this.error.set(null);
    this.privacy.deleteMyTutorAccount().subscribe({
      next: () => this.authSvc.logout(),
      error: (err) => {
        this.deleting.set(false);
        this.error.set(err.error?.error || 'No se pudieron eliminar tus datos. Intenta de nuevo.');
      }
    });
  }
}
