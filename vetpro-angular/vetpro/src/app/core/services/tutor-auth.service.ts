import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Router } from '@angular/router';

export interface TutorSession {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  address?: string;
}

export interface ClinicSession {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  logoUrl?: string;
}

export interface VerifyResponse {
  token: string;
  tutor: TutorSession;
  clinic: ClinicSession;
}

@Injectable({ providedIn: 'root' })
export class TutorAuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  token = signal<string | null>(localStorage.getItem('vetpro_tutor_token'));
  tutor = signal<TutorSession | null>(
    localStorage.getItem('vetpro_tutor') ? JSON.parse(localStorage.getItem('vetpro_tutor')!) : null
  );
  clinic = signal<ClinicSession | null>(
    localStorage.getItem('vetpro_tutor_clinic') ? JSON.parse(localStorage.getItem('vetpro_tutor_clinic')!) : null
  );

  isAuthenticated = computed(() => !!this.token());

  // Solicitar Magic Link
  requestMagicLink(phone: string): Observable<{ success: boolean; message: string; magicLink?: string }> {
    return this.api.post<{ success: boolean; message: string; magicLink?: string }>('/portal/auth/magic-link', { phone });
  }

  // Verificar Token de Magic Link
  verifyMagicLink(token: string): Observable<VerifyResponse> {
    return this.api.post<VerifyResponse>('/portal/auth/verify', { token }).pipe(
      tap(res => {
        localStorage.setItem('vetpro_tutor_token', res.token);
        localStorage.setItem('vetpro_tutor', JSON.stringify(res.tutor));
        localStorage.setItem('vetpro_tutor_clinic', JSON.stringify(res.clinic));

        this.token.set(res.token);
        this.tutor.set(res.tutor);
        this.clinic.set(res.clinic);
      })
    );
  }

  // Cerrar Sesión del Tutor
  logout() {
    localStorage.removeItem('vetpro_tutor_token');
    localStorage.removeItem('vetpro_tutor');
    localStorage.removeItem('vetpro_tutor_clinic');

    this.token.set(null);
    this.tutor.set(null);
    this.clinic.set(null);

    this.router.navigate(['/portal/login']);
  }
}
