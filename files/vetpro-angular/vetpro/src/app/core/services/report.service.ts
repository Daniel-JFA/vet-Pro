import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private base = environment.apiUrl;

  // Obtener agregaciones y datasets del dashboard
  getDashboardData(): Observable<any> {
    return this.api.get<any>('/reports/dashboard');
  }

  // Descargar el reporte consolidado CSV compatible con Excel
  downloadExcelReport(): Observable<Blob> {
    return this.http.get(`${this.base}/reports/export/excel`, { responseType: 'blob' });
  }
}
