import { Routes } from '@angular/router';
import { portalAuthGuard } from '../../core/guards/portal-auth.guard';

export const PORTAL_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./portal-login/portal-login.component').then(m => m.PortalLoginComponent)
  },
  {
    path: 'auth',
    loadComponent: () => import('./portal-auth/portal-auth.component').then(m => m.PortalAuthComponent)
  },
  {
    path: '',
    canActivate: [portalAuthGuard],
    loadComponent: () => import('./portal-shell.component').then(m => m.PortalShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./portal-dashboard/portal-dashboard.component').then(m => m.PortalDashboardComponent)
      },
      {
        path: 'patient/:id',
        loadComponent: () => import('./portal-history/portal-history.component').then(m => m.PortalHistoryComponent)
      },
      {
        path: 'booking',
        loadComponent: () => import('./portal-booking/portal-booking.component').then(m => m.PortalBookingComponent)
      }
    ]
  }
];
