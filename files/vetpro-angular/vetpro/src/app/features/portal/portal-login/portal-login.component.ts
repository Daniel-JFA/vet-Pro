import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TutorAuthService } from '../../../core/services/tutor-auth.service';

@Component({
  selector: 'app-portal-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './portal-login.component.html',
  styleUrl: './portal-login.component.scss'
})
export class PortalLoginComponent {
  private authSvc = inject(TutorAuthService);
  private router = inject(Router);

  phone = signal('');
  loading = signal(false);
  error = signal('');
  success = signal(false);
  magicLink = signal<string | null>(null);

  demoNumbers = [
    { number: '3124567890', label: 'Carlos Gómez (Perros)' },
    { number: '3157891234', label: 'María Rodríguez (Gatos)' },
    { number: '3209876543', label: 'Diana Pérez (Conenejo)' }
  ];

  onSubmit() {
    const rawPhone = this.phone().trim();
    if (!rawPhone) {
      this.error.set('Por favor ingresa tu número telefónico.');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.success.set(false);
    this.magicLink.set(null);

    this.authSvc.requestMagicLink(rawPhone).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.success.set(true);
        if (res.magicLink) {
          this.magicLink.set(res.magicLink);
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || 'No se pudo enviar el enlace. Verifica el número e intenta nuevamente.');
      }
    });
  }

  useDemoNumber(num: string) {
    this.phone.set(num);
    this.onSubmit();
  }

  navigateToMagicLink() {
    if (this.magicLink()) {
      const url = new URL(this.magicLink()!);
      const token = url.searchParams.get('token');
      if (token) {
        this.router.navigate(['/portal/auth'], { queryParams: { token } });
      }
    }
  }
}
