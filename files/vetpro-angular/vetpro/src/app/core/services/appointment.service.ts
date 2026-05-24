import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Appointment, PagedResult, QueryParams } from '../models';

@Injectable({ providedIn: 'root' })
export class AppointmentService {
  private api = inject(ApiService);

  getAppointments(params?: QueryParams): Observable<PagedResult<Appointment>> {
    return this.api.getPaged<Appointment>('/appointments', params);
  }

  getTodayAppointments(): Observable<Appointment[]> {
    return this.api.get<Appointment[]>('/appointments/today');
  }

  getAppointment(id: string): Observable<Appointment> {
    return this.api.get<Appointment>(`/appointments/${id}`);
  }

  createAppointment(data: Partial<Appointment>): Observable<Appointment> {
    return this.api.post<Appointment>('/appointments', data);
  }

  updateAppointment(id: string, data: Partial<Appointment>): Observable<Appointment> {
    return this.api.put<Appointment>(`/appointments/${id}`, data);
  }

  updateStatus(id: string, status: Appointment['status']): Observable<Appointment> {
    return this.api.patch<Appointment>(`/appointments/${id}/status`, { status });
  }

  cancel(id: string, reason?: string): Observable<void> {
    return this.api.patch<void>(`/appointments/${id}/cancel`, { reason });
  }
}
