import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'consent/sign/:id',
    loadComponent: () => import('./features/consent/consent-sign/consent-sign.component').then(m => m.ConsentSignComponent)
  },
  {
    path: 'portal',
    loadChildren: () => import('./features/portal/portal.routes').then(m => m.PORTAL_ROUTES)
  },
  {
    path: 'onboarding',
    loadComponent: () => import('./features/onboarding/onboarding.component').then(m => m.OnboardingComponent)
  },
  {
    path: 'landing',
    loadComponent: () => import('./features/landing/landing.component').then(m => m.LandingComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'patients',
        loadChildren: () => import('./features/patients/patients.routes').then(m => m.PATIENTS_ROUTES)
      },
      {
        path: 'appointments',
        loadChildren: () => import('./features/appointments/appointments.routes').then(m => m.APPOINTMENTS_ROUTES)
      },
      {
        path: 'medical-records',
        canActivate: [roleGuard(['admin', 'vet', 'assistant'])],
        loadChildren: () => import('./features/medical-records/medical-records.routes').then(m => m.MEDICAL_RECORDS_ROUTES)
      },
      {
        path: 'inventory',
        canActivate: [roleGuard(['admin'])],
        loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
      },
      {
        path: 'billing',
        canActivate: [roleGuard(['admin', 'receptionist'])],
        loadChildren: () => import('./features/billing/billing.routes').then(m => m.BILLING_ROUTES)
      },
      {
        path: 'notifications',
        canActivate: [roleGuard(['admin', 'receptionist'])],
        loadChildren: () => import('./features/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES)
      },
      {
        path: 'consent',
        canActivate: [roleGuard(['admin', 'vet'])],
        loadChildren: () => import('./features/consent/consent.routes').then(m => m.CONSENT_ROUTES)
      },
      {
        path: 'reports',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
