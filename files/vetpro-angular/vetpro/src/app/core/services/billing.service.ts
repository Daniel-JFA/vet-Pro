import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Invoice, PagedResult, QueryParams } from '../models';

@Injectable({ providedIn: 'root' })
export class BillingService {
  private api = inject(ApiService);

  getInvoices(params?: QueryParams): Observable<PagedResult<Invoice>> {
    return this.api.getPaged<Invoice>('/billing/invoices', params);
  }

  getInvoice(id: string): Observable<Invoice> {
    return this.api.get<Invoice>(`/billing/invoices/${id}`);
  }

  createInvoice(data: Partial<Invoice>): Observable<Invoice> {
    return this.api.post<Invoice>('/billing/invoices', data);
  }

  issueInvoice(id: string): Observable<Invoice> {
    return this.api.patch<Invoice>(`/billing/invoices/${id}/issue`, {});
  }

  registerPayment(id: string, amount: number, method: string): Observable<Invoice> {
    return this.api.patch<Invoice>(`/billing/invoices/${id}/pay`, { amount, method });
  }

  voidInvoice(id: string, reason: string): Observable<Invoice> {
    return this.api.patch<Invoice>(`/billing/invoices/${id}/void`, { reason });
  }

  getRevenueSummary(from: Date, to: Date): Observable<any> {
    return this.api.get('/billing/summary', {
      from: from.toISOString(),
      to: to.toISOString()
    });
  }
}
