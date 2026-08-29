import { Routes } from '@angular/router';
import { DemoShellComponent } from './demo-shell.component';
import { DemoDashboardComponent } from './demo-dashboard/demo-dashboard.component';
import { DemoPatientsComponent } from './demo-patients/demo-patients.component';
import { DemoWalkersComponent } from './demo-walkers/demo-walkers.component';

export const DEMO_ROUTES: Routes = [
  {
    path: '',
    component: DemoShellComponent,
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DemoDashboardComponent },
      { path: 'patients', component: DemoPatientsComponent },
      { path: 'walkers', component: DemoWalkersComponent },
    ]
  }
];
