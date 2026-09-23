import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { profileCompleteGuard } from './core/guards/profile-complete.guard';
import { platformAuthGuard } from './core/guards/platform-auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },
  {
    path: 'platform/login',
    loadComponent: () => import('./features/platform/platform-login.component').then(m => m.PlatformLoginComponent)
  },
  {
    path: 'platform/dashboard',
    canActivate: [platformAuthGuard],
    loadComponent: () => import('./features/platform/platform-dashboard.component').then(m => m.PlatformDashboardComponent)
  },
  {
    path: 'complete-profile',
    canActivate: [authGuard],
    loadComponent: () => import('./features/profile/complete-profile.component').then(m => m.CompleteProfileComponent)
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
    path: 'directorio',
    loadComponent: () => import('./features/marketplace/vet-directory/vet-directory.component').then(m => m.VetDirectoryComponent)
  },
  {
    path: 'vets',
    redirectTo: 'directorio',
    pathMatch: 'full'
  },
  {
    path: '',
    canActivate: [authGuard, profileCompleteGuard],
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
        path: 'tutors',
        loadComponent: () => import('./features/tutors/tutors-list.component').then(m => m.TutorsListComponent)
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
        canActivate: [roleGuard(['admin', 'vet'])],
        loadChildren: () => import('./features/inventory/inventory.routes').then(m => m.INVENTORY_ROUTES)
      },
      {
        path: 'billing',
        canActivate: [roleGuard(['admin', 'vet', 'receptionist'])],
        loadChildren: () => import('./features/billing/billing.routes').then(m => m.BILLING_ROUTES)
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
      },
      {
        path: 'walkers',
        canActivate: [roleGuard(['admin', 'vet', 'walker'])],
        loadChildren: () => import('./features/walkers/walkers.routes').then(m => m.WALKERS_ROUTES)
      },
      {
        path: 'hospitalization',
        canActivate: [roleGuard(['admin', 'vet', 'assistant'])],
        loadComponent: () => import('./features/medical-records/hospitalization-kardex/hospitalization-kardex.component').then(m => m.HospitalizationKardexComponent)
      },
      {
        path: 'labs',
        canActivate: [roleGuard(['admin', 'vet', 'assistant'])],
        loadComponent: () => import('./features/labs/lab-orders/lab-orders.component').then(m => m.LabOrdersComponent)
      },
      {
        path: 'crm',
        canActivate: [roleGuard(['admin', 'receptionist'])],
        loadComponent: () => import('./features/notifications/crm-reactivation/crm-reactivation.component').then(m => m.CrmReactivationComponent)
      },
      {
        path: 'notifications',
        canActivate: [roleGuard(['admin', 'receptionist', 'vet'])],
        loadChildren: () => import('./features/notifications/notifications.routes').then(m => m.NOTIFICATIONS_ROUTES)
      },
      {
        path: 'grooming',
        canActivate: [roleGuard(['admin', 'vet', 'assistant', 'receptionist', 'groomer'])],
        loadComponent: () => import('./features/grooming/grooming-kanban/grooming-kanban.component').then(m => m.GroomingKanbanComponent)
      },
      {
        path: 'users',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/users/user-list/user-list.component').then(m => m.UserListComponent)
      },
      {
        path: 'perfil-profesional',
        canActivate: [roleGuard(['admin', 'vet'])],
        loadComponent: () => import('./features/marketplace/vet-profile-edit/vet-profile-edit.component').then(m => m.VetProfileEditComponent)
      },
      {
        path: 'verificaciones',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () => import('./features/marketplace/admin-verifications/admin-verifications.component').then(m => m.AdminVerificationsComponent)
      }
    ]
  },
  { path: '**', redirectTo: '' }
];
