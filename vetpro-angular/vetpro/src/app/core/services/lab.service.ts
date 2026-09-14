import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface LabTestCatalogItem {
  id: string;
  code: string;
  name: string;
  category: 'hematology' | 'biochemistry' | 'urinalysis' | 'parasitology' | 'imaging' | 'cytology' | 'other';
  unit?: string;
  canineRefMin?: number;
  canineRefMax?: number;
  canineRefText?: string;
  felineRefMin?: number;
  felineRefMax?: number;
  felineRefText?: string;
  salePrice: number;
  active: boolean;
}

export interface LabResultItem {
  id?: string;
  labTestCatalogId?: string;
  testName: string;
  valueMeasured: string;
  unit?: string;
  refRangeText?: string;
  flag?: 'normal' | 'low' | 'high' | 'critical';
  interpretation?: string;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  patientId: string;
  patient: {
    id: string;
    name: string;
    species: string;
    breed?: string;
    tutor?: { firstName: string; lastName: string; phone: string };
  };
  vet: { id: string; firstName: string; lastName: string };
  status: 'pending' | 'sample_taken' | 'in_analysis' | 'completed' | 'cancelled';
  sampleType?: string;
  clinicalNotes?: string;
  orderedAt: string;
  completedAt?: string;
  results: LabResultItem[];
}

@Injectable({ providedIn: 'root' })
export class LabService {
  private api = inject(ApiService);

  getCatalog(): Observable<LabTestCatalogItem[]> {
    return this.api.get<LabTestCatalogItem[]>('/labs/catalog');
  }

  createCatalogTest(data: Partial<LabTestCatalogItem>): Observable<LabTestCatalogItem> {
    return this.api.post<LabTestCatalogItem>('/labs/catalog', data);
  }

  getOrders(params?: { status?: string; patientId?: string }): Observable<LabOrder[]> {
    return this.api.get<LabOrder[]>('/labs/orders', params as any);
  }

  getOrderById(id: string): Observable<LabOrder> {
    return this.api.get<LabOrder>(`/labs/orders/${id}`);
  }

  createOrder(data: {
    patientId: string;
    appointmentId?: string;
    sampleType: string;
    clinicalNotes?: string;
    testCatalogIds: string[];
  }): Observable<LabOrder> {
    return this.api.post<LabOrder>('/labs/orders', data);
  }

  saveResults(orderId: string, data: {
    status?: string;
    results: {
      labTestCatalogId?: string;
      testName: string;
      valueMeasured: string;
      unit?: string;
      interpretation?: string;
    }[];
  }): Observable<{ success: boolean; message: string; order: LabOrder }> {
    return this.api.patch(`/labs/orders/${orderId}/results`, data);
  }
}
