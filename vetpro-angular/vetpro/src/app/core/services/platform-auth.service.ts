import { Injectable, inject, signal, computed } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Router } from '@angular/router';

export interface PlatformAdminSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface PlatformStats {
  clinicsCount: number;
  usersCount: number;
  patientsCount: number;
  appointmentsCount: number;
}

export interface PlatformClinic {
  id: string;
  name: string;
  businessType: string;
  plan: string;
  email: string;
  city: string;
  createdAt: string;
  usersCount: number;
  patientsCount: number;
  branchesCount: number;
  tutorsCount: number;
}

@Injectable({ providedIn: 'root' })
export class PlatformAuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  token = signal<string | null>(localStorage.getItem('vetpro_platform_token'));
  admin = signal<PlatformAdminSession | null>(
    localStorage.getItem('vetpro_platform_admin') ? JSON.parse(localStorage.getItem('vetpro_platform_admin')!) : null
  );

  isAuthenticated = computed(() => !!this.token());

  login(email: string, password: string): Observable<{ token: string; admin: PlatformAdminSession }> {
    return this.api.post<{ token: string; admin: PlatformAdminSession }>(
      '/platform/auth/login', { email, password }
    ).pipe(
      tap(res => {
        localStorage.setItem('vetpro_platform_token', res.token);
        localStorage.setItem('vetpro_platform_admin', JSON.stringify(res.admin));
        this.token.set(res.token);
        this.admin.set(res.admin);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('vetpro_platform_token');
    localStorage.removeItem('vetpro_platform_admin');
    this.token.set(null);
    this.admin.set(null);
    this.router.navigate(['/platform/login']);
  }

  getStats(): Observable<PlatformStats> {
    return this.api.get<PlatformStats>('/platform/stats');
  }

  getClinics(): Observable<PlatformClinic[]> {
    return this.api.get<PlatformClinic[]>('/platform/clinics');
  }
}
