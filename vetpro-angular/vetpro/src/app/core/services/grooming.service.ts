import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface GroomingItem {
  id: string;
  patientId: string;
  patient: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    tutor: { id: string; firstName: string; lastName: string; phone: string; email?: string };
  };
  branch: { id: string; name: string };
  groomer?: { id: string; firstName: string; lastName: string };
  serviceType: string;
  coatCondition?: string;
  skinObservations?: string;
  medicatedShampoo?: string;
  behaviorNotes?: string;
  status: 'checked_in' | 'bathing' | 'drying_styling' | 'ready_for_pickup' | 'delivered' | 'cancelled';
  price: number;
  checkedInAt: string;
  readyAt?: string;
  deliveredAt?: string;
  tutorNotifiedAt?: string;
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class GroomingService {
  private api = inject(ApiService);

  getServices(params?: { branchId?: string; status?: string }): Observable<GroomingItem[]> {
    return this.api.get<GroomingItem[]>('/grooming', params as any);
  }

  checkIn(data: {
    patientId: string;
    branchId: string;
    groomerId?: string;
    serviceType: string;
    coatCondition?: string;
    skinObservations?: string;
    medicatedShampoo?: string;
    behaviorNotes?: string;
    price?: number;
    notes?: string;
  }): Observable<GroomingItem> {
    return this.api.post<GroomingItem>('/grooming', data);
  }

  updateStatus(id: string, data: {
    status: 'checked_in' | 'bathing' | 'drying_styling' | 'ready_for_pickup' | 'delivered' | 'cancelled';
    groomerId?: string;
  }): Observable<{
    success: boolean;
    service: GroomingItem;
    whatsappNotification?: { phone: string; message: string; waLink: string } | null;
  }> {
    return this.api.patch(`/grooming/${id}/status`, data);
  }
}
