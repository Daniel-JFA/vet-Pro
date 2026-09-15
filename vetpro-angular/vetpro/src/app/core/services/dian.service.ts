import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface DianResolution {
  id: string;
  prefix: string;
  resolutionNumber: string;
  fromNumber: number;
  toNumber: number;
  currentNumber: number;
  startDate: string;
  endDate: string;
  environment: 'test' | 'production';
  active: boolean;
}

export interface CashRegisterShift {
  id: string;
  branchId: string;
  openedAt: string;
  closedAt?: string;
  openingBalance: number;
  cashSales: number;
  electronicSales: number;
  expectedBalance: number;
  actualBalance?: number;
  difference?: number;
  status: 'open' | 'closed';
  notes?: string;
}

@Injectable({ providedIn: 'root' })
export class DianService {
  private api = inject(ApiService);

  getResolutions(): Observable<DianResolution[]> {
    return this.api.get<DianResolution[]>('/billing/dian/resolutions');
  }

  createResolution(data: {
    prefix: string;
    resolutionNumber: string;
    fromNumber: number;
    toNumber: number;
    startDate: string;
    endDate: string;
    technicalKey: string;
    environment: 'test' | 'production';
  }): Observable<DianResolution> {
    return this.api.post<DianResolution>('/billing/dian/resolutions', data);
  }

  issueInvoiceDian(invoiceId: string): Observable<{
    success: boolean;
    transmittedToDian: boolean;
    message: string;
    invoice: any;
    dianDetails: {
      cufe: string;
      qrCodeUrl: string;
      xmlUblUrl: string | null;
      resolutionNumber: string;
      prefix: string;
      environment: string;
      transmittedToDian: boolean;
      validatedAt: Date | null;
    };
  }> {
    return this.api.post(`/billing/dian/invoices/${invoiceId}/issue`, {});
  }

  getCurrentShift(): Observable<CashRegisterShift | null> {
    return this.api.get<CashRegisterShift | null>('/billing/dian/pos/current-shift');
  }

  openShift(data: { branchId: string; openingBalance: number; notes?: string }): Observable<CashRegisterShift> {
    return this.api.post<CashRegisterShift>('/billing/dian/pos/shift-open', data);
  }

  closeShift(data: { shiftId: string; actualBalance: number; notes?: string }): Observable<any> {
    return this.api.post('/billing/dian/pos/shift-close', data);
  }
}
