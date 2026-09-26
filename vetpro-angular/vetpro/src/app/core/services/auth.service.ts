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

  register(data: {
    clinicName: string;
    businessType: 'clinic' | 'independent_vet';
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    municipioId: string;
    nit?: string;
    documentType?: 'CC' | 'CE' | 'TI' | 'PA';
    documentNumber?: string;
  }): Observable<{ token: string; user: User; clinic: Clinic }> {
    return this.api.post<{ token: string; user: User; clinic: Clinic }>(
      '/auth/register', data
    ).pipe(
      tap(res => {
        localStorage.setItem('vetpro_token', res.token);
        this.state.set({ token: res.token, user: res.user, clinic: res.clinic });
      }),
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

  createBranch(data: { name: string; address: string; phone: string; email?: string }): Observable<Branch> {
    return this.api.post<Branch>('/branches', data);
  }

  // Cambiar sucursal activa actual
  changeActiveBranch(branchId: string): void {
    localStorage.setItem('vetpro_active_branch_id', branchId);
    this.activeBranchId.set(branchId);
    console.log(`🏢 Sucursal activa cambiada a: ${branchId}`);
  }

  // Gestión de usuarios y equipo (Admin)
  getUsers(): Observable<any[]> {
    return this.api.get<any[]>('/auth/users');
  }

  createUser(data: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    branchId?: string | null;
  }): Observable<{ message: string; emailSent: boolean; activationLink?: string; user: any }> {
    return this.api.post<{ message: string; emailSent: boolean; activationLink?: string; user: any }>('/auth/users', data);
  }

  // Activación de cuenta (el usuario define su propia contraseña vía un enlace enviado por correo)
  getActivationInfo(token: string): Observable<{ firstName: string; lastName: string; email: string }> {
    return this.api.get<{ firstName: string; lastName: string; email: string }>(`/auth/activation/${token}`);
  }

  // Recuperación de contraseña: envía un enlace al correo si la cuenta existe
  requestPasswordReset(email: string): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/auth/forgot-password', { email });
  }

  activateAccount(token: string, password: string): Observable<{ token: string; user: User; clinic: Clinic }> {
    return this.api.post<{ token: string; user: User; clinic: Clinic }>('/auth/activate', { token, password }).pipe(
      tap(res => {
        localStorage.setItem('vetpro_token', res.token);
        this.state.set({ token: res.token, user: res.user, clinic: res.clinic });
      })
    );
  }

  updateUser(id: string, data: {
    firstName?: string;
    lastName?: string;
    role?: string;
    branchId?: string | null;
    active?: boolean;
  }): Observable<any> {
    return this.api.patch<any>(`/auth/users/${id}`, data);
  }

  resetUserPassword(id: string, newPassword: string): Observable<any> {
    return this.api.patch<any>(`/auth/users/${id}/reset-password`, { newPassword });
  }

  // El propio usuario termina de ingresar sus datos tras el primer login
  completeProfile(data: {
    documentType: 'CC' | 'CE' | 'PA' | 'TI';
    documentNumber: string;
    phone: string;
    address: string;
    municipioId: string;
    birthDate?: string | null;
  }): Observable<{ message: string; user: User }> {
    return this.api.patch<{ message: string; user: User }>('/auth/complete-profile', data).pipe(
      tap(res => {
        this.state.update(s => ({ ...s, user: res.user }));
      })
    );
  }

  // Consulta y actualización de configuración de empresa (Clínica vs Vet Independiente)
  getClinic(): Observable<Clinic> {
    return this.api.get<Clinic>('/auth/clinic');
  }

  updateClinic(data: {
    name?: string;
    businessType?: 'clinic' | 'independent_vet';
    nit?: string;
    phone?: string;
    address?: string;
    municipioId?: string;
  }): Observable<{ message: string; clinic: Clinic }> {
    return this.api.patch<{ message: string; clinic: Clinic }>('/auth/clinic', data).pipe(
      tap(res => {
        if (res.clinic) {
          this.state.update(s => ({ ...s, clinic: res.clinic }));
        }
      })
    );
  }

  // Diagnóstico y pruebas de correo SMTP (Credenciales automáticas de usuarios)
  getSmtpStatus(): Observable<{
    smtpConfigured: boolean;
    smtpHost: string;
    smtpUser: string | null;
    verified: boolean;
    message?: string;
  }> {
    return this.api.get<{
      smtpConfigured: boolean;
      smtpHost: string;
      smtpUser: string | null;
      verified: boolean;
      message?: string;
    }>('/auth/smtp-status');
  }

  testSmtp(recipient?: string): Observable<{ success: boolean; message: string }> {
    return this.api.post<{ success: boolean; message: string }>('/auth/smtp-test', { recipient });
  }
}
