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
  phone: string;
  city: string;
  createdAt: string;
  subscriptionStatus: string;
  billingCycle: string;
  trialEndsAt: string | null;
  nextBillingDate: string | null;
  lastPaymentDate: string | null;
  usersCount: number;
  patientsCount: number;
  branchesCount: number;
  tutorsCount: number;
  healthScore?: number;
  healthStatus?: 'green' | 'yellow' | 'red';
  recentAppointments?: number;
}

export interface PlatformAnalyticsOverview {
  growth: { date: string; count: number }[];
  revenue: {
    mrr: number;
    arr: number;
    planBreakdown: { starter: number; pro: number; enterprise: number };
    subscriptionBreakdown: { trial: number; active: number; past_due: number; suspended: number; cancelled: number };
    monthlyRevenue: { month: string; amountInCents: number }[];
    renewalsDue: { id: string; name: string; email: string; expiresAt: string; type: 'trial' | 'billing'; daysLeft: number }[];
  };
  engagement: {
    activeLast24h: number;
    activeLast7d: number;
    activeLast30d: number;
    dormantClinics: { id: string; name: string; email: string; createdAt: string }[];
  };
  usage: {
    totals: { appointments: number; patients: number; invoices: number; notifications: number };
    topClinics: { id: string; name: string; appointmentsCount: number; patientsCount: number; score: number }[];
  };
  geography: { label: string; count: number }[];
}

export interface PlatformClinicUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  active: boolean;
  lastLoginAt: string | null;
  branchName: string | null;
}

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  type: string;
  isActive: boolean;
  targetPlan: string | null;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  clinicId: string;
  userId: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  screenUrl: string | null;
  errorLogs: any;
  createdAt: string;
  resolvedAt: string | null;
  clinic?: { name: string; plan: string };
  user?: { firstName: string; lastName: string; email: string };
}

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: any;
  userId: string | null;
  clinicId: string | null;
  ipAddress: string | null;
  createdAt: string;
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

  getClinicUsers(clinicId: string): Observable<PlatformClinicUser[]> {
    return this.api.get<PlatformClinicUser[]>(`/platform/clinics/${clinicId}/users`);
  }

  getAnalyticsOverview(): Observable<PlatformAnalyticsOverview> {
    return this.api.get<PlatformAnalyticsOverview>('/platform/analytics/overview');
  }

  // Verificación COMVEZCOL de veterinarios de todas las clínicas
  getVerifications(): Observable<any[]> {
    return this.api.get<any[]>('/platform/verifications');
  }

  updateVerification(id: string, body: { status?: 'verified' | 'rejected' | 'pending'; notes?: string; isFeatured?: boolean }): Observable<any> {
    return this.api.put<any>(`/platform/verifications/${id}`, body);
  }

  // Tenant Management Actions
  changeClinicPlan(clinicId: string, payload: { plan?: string; status?: string; featureFlags?: any }): Observable<any> {
    return this.api.post<any>(`/platform/clinics/${clinicId}/change-plan`, payload);
  }

  // Announcements
  getAnnouncements(): Observable<PlatformAnnouncement[]> {
    return this.api.get<PlatformAnnouncement[]>('/platform/announcements');
  }

  createAnnouncement(payload: Partial<PlatformAnnouncement>): Observable<PlatformAnnouncement> {
    return this.api.post<PlatformAnnouncement>('/platform/announcements', payload);
  }

  toggleAnnouncement(id: string, isActive: boolean): Observable<PlatformAnnouncement> {
    return this.api.put<PlatformAnnouncement>(`/platform/announcements/${id}/toggle`, { isActive });
  }

  // Support Tickets
  getTickets(): Observable<SupportTicket[]> {
    return this.api.get<SupportTicket[]>('/platform/support/tickets');
  }

  resolveTicket(id: string, status: string): Observable<SupportTicket> {
    return this.api.put<SupportTicket>(`/platform/support/tickets/${id}`, { status });
  }

  // Audit Logs
  getAuditLogs(): Observable<AuditLog[]> {
    return this.api.get<AuditLog[]>('/platform/audit-logs');
  }
}
