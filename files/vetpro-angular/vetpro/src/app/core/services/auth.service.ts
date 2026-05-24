import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';
import { User, Clinic } from '../models';

export interface AuthState {
  user: User | null;
  clinic: Clinic | null;
  token: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);

  readonly state = signal<AuthState>({
    user: null,
    clinic: null,
    token: localStorage.getItem('vetpro_token')
  });

  get currentUser() { return this.state().user; }
  get currentClinic() { return this.state().clinic; }
  get isAuthenticated() { return !!this.state().token; }

  login(email: string, password: string): Observable<{ token: string; user: User; clinic: Clinic }> {
    return this.api.post<{ token: string; user: User; clinic: Clinic }>(
      '/auth/login', { email, password }
    ).pipe(
      tap(res => {
        localStorage.setItem('vetpro_token', res.token);
        this.state.set({ token: res.token, user: res.user, clinic: res.clinic });
      })
    );
  }

  logout(): void {
    localStorage.removeItem('vetpro_token');
    this.state.set({ user: null, clinic: null, token: null });
    this.router.navigate(['/auth/login']);
  }

  loadSession(): Observable<{ user: User; clinic: Clinic }> {
    return this.api.get<{ user: User; clinic: Clinic }>('/auth/me').pipe(
      tap(res => this.state.update(s => ({ ...s, user: res.user, clinic: res.clinic })))
    );
  }
}
