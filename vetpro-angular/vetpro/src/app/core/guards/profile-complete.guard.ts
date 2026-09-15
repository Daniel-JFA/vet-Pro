import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Fuerza a completar el perfil (documento, teléfono, dirección) antes de usar el resto de la app
export const profileCompleteGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.currentUser;

  if (user && !user.profileCompleted) {
    return router.createUrlTree(['/complete-profile']);
  }

  return true;
};
