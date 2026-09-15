import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ServiceCatalogItem {
  id: string;
  clinicId: string;
  name: string;
  salePrice: number;
  taxRate: number;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class ServiceCatalogService {
  private api = inject(ApiService);

  getServices(): Observable<ServiceCatalogItem[]> {
    return this.api.get<ServiceCatalogItem[]>('/service-catalog');
  }

  createService(data: { name: string; salePrice: number; taxRate: number }): Observable<ServiceCatalogItem> {
    return this.api.post<ServiceCatalogItem>('/service-catalog', data);
  }

  deleteService(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/service-catalog/${id}`);
  }
}
