import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private api = inject(ApiService);

  getConsentForms(): Observable<any[]> {
    return this.api.get<any[]>('/consent-forms');
  }

  getConsentForm(id: string): Observable<any> {
    return this.api.get<any>(`/consent-forms/${id}`);
  }

  createConsentForm(data: any): Observable<any> {
    return this.api.post<any>('/consent-forms', data);
  }

  signConsentForm(id: string, signature: string): Observable<any> {
    return this.api.patch<any>(`/consent-forms/${id}/sign`, { signature });
  }
}
