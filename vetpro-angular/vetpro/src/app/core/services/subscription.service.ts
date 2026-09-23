import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface ClinicSubscriptionInfo {
  clinic: {
    id: string;
    name: string;
    plan: 'starter' | 'pro' | 'enterprise' | 'clinic';
    subscriptionStatus: 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
    billingCycle: 'monthly' | 'annual';
    trialEndsAt: string | null;
    nextBillingDate: string | null;
    lastPaymentDate: string | null;
    aiMinutesUsed: number;
    aiMinutesLimit: number;
    daysRemaining: number;
  };
  pricing: {
    plan: string;
    monthlyPrice: number;
    annualPrice: number;
  };
  payments: {
    id: string;
    plan: string;
    amountInCents: number;
    currency: string;
    billingCycle: string;
    paymentMethod: string | null;
    wompiReference: string;
    status: string;
    paidAt: string | null;
    periodStart: string;
    periodEnd: string;
    createdAt: string;
  }[];
}

export interface CheckoutResponse {
  paymentId: string;
  reference: string;
  amountInCents: number;
  amountInPesos: number;
  currency: string;
  plan: string;
  billingCycle: string;
  signature: string;
  publicKey: string;
  redirectUrl: string;
}

export interface PlatformSubscriptionStats {
  mrr: number;
  arr: number;
  totalClinics: number;
  activeCount: number;
  trialCount: number;
  pastDueCount: number;
  suspendedCount: number;
  planBreakdown: {
    starter: number;
    pro: number;
    enterprise: number;
  };
}

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private api = inject(ApiService);

  getCurrentSubscription(): Observable<ClinicSubscriptionInfo> {
    return this.api.get<ClinicSubscriptionInfo>('/subscriptions/current');
  }

  initiateCheckout(plan: string, billingCycle: 'monthly' | 'annual' = 'monthly'): Observable<CheckoutResponse> {
    return this.api.post<CheckoutResponse>('/subscriptions/checkout', { plan, billingCycle });
  }

  simulateApproval(reference: string): Observable<{ message: string; plan: string; activeUntil: string }> {
    return this.api.post<{ message: string; plan: string; activeUntil: string }>(`/subscriptions/simulate-approval/${reference}`, {});
  }

  getPlatformStats(): Observable<PlatformSubscriptionStats> {
    return this.api.get<PlatformSubscriptionStats>('/platform/subscriptions/stats');
  }

  grantExtension(clinicId: string, days: number): Observable<{ message: string; clinic: any }> {
    return this.api.post<{ message: string; clinic: any }>(`/platform/subscriptions/clinics/${clinicId}/grant-extension`, { days });
  }
}
