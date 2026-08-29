import { Routes } from '@angular/router';

export const APPOINTMENTS_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./appointment-list/appointment-list.component').then(m => m.AppointmentListComponent) },
  { path: 'calendar', loadComponent: () => import('./appointment-calendar/appointment-calendar.component').then(m => m.AppointmentCalendarComponent) },
  { path: 'on-demand', loadComponent: () => import('./ondemand-route/ondemand-route.component').then(m => m.OndemandRouteComponent) },
  { path: 'new', loadComponent: () => import('./appointment-form/appointment-form.component').then(m => m.AppointmentFormComponent) },
  { path: ':id/edit', loadComponent: () => import('./appointment-form/appointment-form.component').then(m => m.AppointmentFormComponent) }
];
