import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface NotificationTemplate {
  id: string;
  clinicId: string;
  name: string;
  trigger: string;
  channel: 'whatsapp' | 'email' | 'push';
  subject?: string | null;
  body: string;
  active: boolean;
}

export interface NotificationLogItem {
  id: string;
  clinicId: string;
  templateId?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  recipientName?: string;
  patientName?: string;
  channel: 'whatsapp' | 'email' | 'push';
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  patientId?: string | null;
  appointmentId?: string | null;
  sentAt: string | Date;
  error?: string | null;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private api = inject(ApiService);

  getTemplates(): Observable<{ data: NotificationTemplate[]; total: number }> {
    return this.api.get<{ data: NotificationTemplate[]; total: number }>('/notifications/templates');
  }

  createTemplate(template: Partial<NotificationTemplate>): Observable<{ data: NotificationTemplate }> {
    return this.api.post<{ data: NotificationTemplate }>('/notifications/templates', template);
  }

  updateTemplate(id: string, template: Partial<NotificationTemplate>): Observable<{ data: NotificationTemplate }> {
    return this.api.put<{ data: NotificationTemplate }>(`/notifications/templates/${id}`, template);
  }

  toggleTemplate(id: string): Observable<{ data: NotificationTemplate }> {
    return this.api.patch<{ data: NotificationTemplate }>(`/notifications/templates/${id}/toggle`, {});
  }

  deleteTemplate(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/notifications/templates/${id}`);
  }

  getLogs(params?: {
    status?: string;
    channel?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<{
    data: NotificationLogItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const queryParts: string[] = [];
    if (params?.status && params.status !== 'all') queryParts.push(`status=${encodeURIComponent(params.status)}`);
    if (params?.channel && params.channel !== 'all') queryParts.push(`channel=${encodeURIComponent(params.channel)}`);
    if (params?.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params?.page) queryParts.push(`page=${params.page}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);

    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return this.api.get<{
      data: NotificationLogItem[];
      total: number;
      page: number;
      pageSize: number;
    }>(`/notifications/logs${qs}`);
  }

  dispatchReminders(): Observable<{
    message: string;
    dispatchedCount: number;
    dispatched: any[];
  }> {
    return this.api.post<{
      message: string;
      dispatchedCount: number;
      dispatched: any[];
    }>('/notifications/dispatch-reminders', {});
  }
}
