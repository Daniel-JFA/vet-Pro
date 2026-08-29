import { Routes } from '@angular/router';

export const MEDICAL_RECORDS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./record-list/record-list.component').then(m => m.RecordListComponent) },
  { path: 'hospitalization', loadComponent: () => import('./hospitalization-kardex/hospitalization-kardex.component').then(m => m.HospitalizationKardexComponent) },
  { path: 'new/:patientId', loadComponent: () => import('./bitacora-ai/bitacora-ai.component').then(m => m.BitacoraAiComponent) },
  { path: ':id', loadComponent: () => import('./record-detail/record-detail.component').then(m => m.RecordDetailComponent) }
];
