import { Routes } from '@angular/router';
export const BILLING_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./billing-list/billing-list.component').then(m => m.BillingListComponent) },
  { path: 'new', loadComponent: () => import('./billing-form/billing-form.component').then(m => m.BillingFormComponent) },
  { path: ':id', loadComponent: () => import('./billing-receipt/billing-receipt.component').then(m => m.BillingReceiptComponent) }
];
