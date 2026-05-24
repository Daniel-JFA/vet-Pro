import { Routes } from '@angular/router';
export const INVENTORY_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./inventory-list/inventory-list.component').then(m => m.InventoryListComponent) },
  { path: 'new', loadComponent: () => import('./inventory-form/inventory-form.component').then(m => m.InventoryFormComponent) },
  { path: 'alerts', loadComponent: () => import('./inventory-alerts/inventory-alerts.component').then(m => m.InventoryAlertsComponent) },
  { path: 'movements', loadComponent: () => import('./inventory-movements/inventory-movements.component').then(m => m.InventoryMovementsComponent) },
  { path: ':id/edit', loadComponent: () => import('./inventory-form/inventory-form.component').then(m => m.InventoryFormComponent) }
];
