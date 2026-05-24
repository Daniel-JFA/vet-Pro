import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, switchMap, of } from 'rxjs';
import { ApiService } from './api.service';
import { User, Clinic } from '../models';

export interface Branch {
  id: string;
  clinicId: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  active: boolean;
}

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

  // Sucursal activa seleccionada por el usuario (persiste en localStorage)
  readonly activeBranchId = signal<string | null>(localStorage.getItem('vetpro_active_branch_id'));
  
  // Listado de sucursales de la clínica
  readonly clinicBranches = signal<Branch[]>([]);

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
      }),
      // Cargar sucursales inmediatamente tras iniciar sesión
      switchMap(res => {
        return this.loadBranches().pipe(
          tap(branches => {
            // Asignar sucursal activa por defecto
            const defaultBranch = res.user.branchId || (branches.length > 0 ? branches[0].id : null);
            if (defaultBranch && !this.activeBranchId()) {
              this.changeActiveBranch(defaultBranch);
            }
          }),
          switchMap(() => of(res))
        );
      })
    );
  }

  logout(): void {
    localStorage.removeItem('vetpro_token');
    localStorage.removeItem('vetpro_active_branch_id');
    this.state.set({ user: null, clinic: null, token: null });
    this.activeBranchId.set(null);
    this.clinicBranches.set([]);
    this.router.navigate(['/auth/login']);
  }

  loadSession(): Observable<{ user: User; clinic: Clinic }> {
    return this.api.get<{ user: User; clinic: Clinic }>('/auth/me').pipe(
      tap(res => {
        this.state.update(s => ({ ...s, user: res.user, clinic: res.clinic }));
      }),
      // Cargar sucursales de la clínica activa
      switchMap(res => {
        return this.loadBranches().pipe(
          tap(branches => {
            const defaultBranch = res.user.branchId || (branches.length > 0 ? branches[0].id : null);
            if (defaultBranch && !this.activeBranchId()) {
              this.changeActiveBranch(defaultBranch);
            }
          }),
          switchMap(() => of(res))
        );
      })
    );
  }

  // Cargar sedes físicas asociadas de la API
  loadBranches(): Observable<Branch[]> {
    return this.api.get<Branch[]>('/branches').pipe(
      tap(branches => {
        this.clinicBranches.set(branches);
      })
    );
  }

  // Cambiar sucursal activa actual
  changeActiveBranch(branchId: string): void {
    localStorage.setItem('vetpro_active_branch_id', branchId);
    this.activeBranchId.set(branchId);
    // Disparar recargas en componentes o avisos según sea necesario
    console.log(`🏢 Sucursal activa cambiada a: ${branchId}`);
  }
}
