import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type DeletionAudience = 'clinic_staff' | 'tutor' | 'other';

export interface StaffDeletionResponse {
  outcome: 'account_deleted' | 'clinic_scheduled';
  message: string;
  deletionScheduledAt?: string;
}

@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private api = inject(ApiService);

  // Personal de clínica: elimina su propia cuenta (exige su contraseña)
  deleteMyStaffAccount(password: string): Observable<StaffDeletionResponse> {
    return this.api.delete<StaffDeletionResponse>('/auth/me', { password });
  }

  // Tutor: elimina sus datos de contacto y su acceso al portal
  deleteMyTutorAccount(): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>('/portal/me');
  }

  // Solicitud pública (sin sesión) desde /eliminar-cuenta
  requestDeletion(data: { email: string; audience: DeletionAudience; clinicName?: string; message?: string }): Observable<{ message: string }> {
    return this.api.post<{ message: string }>('/privacy/deletion-requests', data);
  }
}
