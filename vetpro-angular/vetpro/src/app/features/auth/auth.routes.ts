import { Routes } from '@angular/router';
export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'activate',
    loadComponent: () => import('./activate-account/activate-account.component').then(m => m.ActivateAccountComponent)
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    // Mismo formulario que la activación: define contraseña a partir de un token de un solo uso
    path: 'reset-password',
    loadComponent: () => import('./activate-account/activate-account.component').then(m => m.ActivateAccountComponent),
    data: { mode: 'reset' }
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
