import { Routes } from '@angular/router';
export const CONSENT_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./consent-list/consent-list.component').then(m => m.ConsentListComponent) },
  { path: 'new', loadComponent: () => import('./consent-form/consent-form.component').then(m => m.ConsentFormComponent) },
  { path: ':id', loadComponent: () => import('./consent-detail/consent-detail.component').then(m => m.ConsentDetailComponent) }
];
