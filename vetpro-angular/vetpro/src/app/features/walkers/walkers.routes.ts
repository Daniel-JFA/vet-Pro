import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';

export const WALKERS_ROUTES: Routes = [
  {
    path: '',
    canActivate: [roleGuard(['admin', 'vet'])],
    loadComponent: () => import('./walkers-list/walkers-list.component').then(m => m.WalkersListComponent)
  },
  {
    path: 'mis-paseos',
    canActivate: [roleGuard(['walker'])],
    loadComponent: () => import('./walker-schedule/walker-schedule.component').then(m => m.WalkerScheduleComponent)
  },
  {
    path: 'perfil',
    canActivate: [roleGuard(['walker'])],
    loadComponent: () => import('./walker-profile/walker-profile.component').then(m => m.WalkerProfileComponent)
  }
];
