import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LEGAL_INFO } from '../../core/legal/legal-info';
import { DeletionAudience, PrivacyService } from '../../core/services/privacy.service';

// Página pública para eliminar la cuenta: explica cómo hacerlo desde la app y recibe
// solicitudes de quien no puede entrar. Google Play exige esta URL.
@Component({
  selector: 'app-account-deletion-info',
  standalone: true,
  imports: [FormsModule, RouterLink],
  styleUrls: ['./legal-page.scss'],
  template: `
    <main class="legal-page">
      <article class="legal-card">
        <a routerLink="/landing" class="back-link">← Volver a VetPro</a>
        <h1>Eliminar tu cuenta de VetPro</h1>
        <p class="meta">Responsable: {{ legal.controllerName }} · {{ legal.privacyEmail }}</p>

        <h2>Desde la aplicación</h2>
        <ul>
          <li>
            <strong>Clínicas y personal:</strong> inicia sesión, abre <em>Mi cuenta</em> en el menú lateral y pulsa
            <em>Eliminar mi cuenta</em>. Te pediremos tu contraseña para confirmar.
          </li>
          <li>
            <strong>Tutores:</strong> entra al Portal del Tutor, abre la pestaña <em>Cuenta</em> y pulsa
            <em>Eliminar mis datos</em>.
          </li>
        </ul>

        <h2>Qué se elimina y qué se conserva</h2>
        <ul>
          <li>Se cierra el acceso y se borran correo, teléfono, documento, dirección y documentos cargados.</li>
          <li>El personal de clínica conserva solo su nombre como autor de las historias clínicas que firmó, que la clínica debe guardar.</li>
          <li>Si eres la última persona con acceso a una clínica, toda su información se borra de forma definitiva a los 30 días.</li>
          <li>Si hay facturas a tu nombre, se conservan tu nombre y documento el tiempo que exige la ley tributaria.</li>
        </ul>
        <p>Más detalles en la <a routerLink="/privacidad">Política de Tratamiento de Datos</a>.</p>

        <h2>¿No puedes entrar a la aplicación?</h2>
        <p>Envíanos la solicitud y te responderemos al correo indicado en un máximo de 15 días hábiles.</p>

        @if (sent()) {
          <p class="notice ok" role="status">{{ sent() }}</p>
        } @else {
          <form class="deletion-form" (ngSubmit)="submit()">
            <label>
              Correo con el que te registraste
              <input type="email" name="email" [(ngModel)]="email" required autocomplete="email" />
            </label>
            <label>
              Tipo de cuenta
              <select name="audience" [(ngModel)]="audience">
                <option value="clinic_staff">Clínica o personal de una clínica</option>
                <option value="tutor">Tutor de mascota</option>
                <option value="other">Otro</option>
              </select>
            </label>
            @if (audience !== 'other') {
              <label>
                Nombre de la clínica (opcional)
                <input type="text" name="clinicName" [(ngModel)]="clinicName" maxlength="200" />
              </label>
            }
            <label>
              Detalles (opcional)
              <textarea name="message" [(ngModel)]="message" maxlength="2000"></textarea>
            </label>
            <button type="submit" [disabled]="sending() || !email">
              {{ sending() ? 'Enviando…' : 'Solicitar eliminación' }}
            </button>
            @if (error()) {
              <p class="notice error" role="alert">{{ error() }}</p>
            }
          </form>
        }
      </article>
    </main>
  `
})
export class AccountDeletionInfoComponent {
  private privacy = inject(PrivacyService);
  readonly legal = LEGAL_INFO;

  email = '';
  audience: DeletionAudience = 'clinic_staff';
  clinicName = '';
  message = '';

  sending = signal(false);
  sent = signal<string | null>(null);
  error = signal<string | null>(null);

  submit(): void {
    this.sending.set(true);
    this.error.set(null);
    this.privacy
      .requestDeletion({
        email: this.email.trim(),
        audience: this.audience,
        clinicName: this.audience !== 'other' && this.clinicName.trim() ? this.clinicName.trim() : undefined,
        message: this.message.trim() || undefined
      })
      .subscribe({
        next: (res) => {
          this.sending.set(false);
          this.sent.set(res.message);
        },
        error: (err) => {
          this.sending.set(false);
          this.error.set(err.error?.error || 'No se pudo enviar la solicitud. Intenta de nuevo.');
        }
      });
  }
}
