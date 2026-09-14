import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface CrmCohortsResponse {
  summary: {
    totalInactive: number;
    totalOverdueVaccines: number;
    potentialRecoverableRevenue: number;
  };
  inactiveCohort: {
    patientId: string;
    patientName: string;
    species: string;
    tutorName: string;
    tutorPhone: string;
    lastVisit: string | null;
  }[];
  vaccineCohort: {
    vaccineId: string;
    vaccineName: string;
    dueDate: string;
    patientName: string;
    tutorName: string;
    tutorPhone: string;
  }[];
}

@Injectable({ providedIn: 'root' })
export class CrmService {
  private api = inject(ApiService);

  getCohorts(): Observable<CrmCohortsResponse> {
    return this.api.get<CrmCohortsResponse>('/crm/cohorts');
  }

  sendBroadcast(data: {
    name: string;
    targetType: 'inactive_180d' | 'vaccine_due' | 'deworming_due' | 'birthday';
    channel?: 'whatsapp' | 'email' | 'sms';
    templateBody: string;
    discountPercent?: number;
  }): Observable<{
    success: boolean;
    message: string;
    campaign: any;
    sampleDispatches: { phone: string; message: string; link: string }[];
  }> {
    return this.api.post('/crm/broadcast', data);
  }
}
