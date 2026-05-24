import { Routes } from '@angular/router';
export const NOTIFICATIONS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./notification-center/notification-center.component').then(m => m.NotificationCenterComponent) },
  { path: 'templates', loadComponent: () => import('./notification-templates/notification-templates.component').then(m => m.NotificationTemplatesComponent) }
];
