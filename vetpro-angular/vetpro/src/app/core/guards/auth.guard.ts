import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

import { of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated) {
    return router.createUrlTree(['/landing']);
  }

  // Si está autenticado con token en localStorage pero no se ha cargado el perfil (ej: tras recargar navegador)
  if (auth.isAuthenticated && !auth.currentUser) {
    return auth.loadSession().pipe(
      map(() => true),
      catchError(() => {
        auth.logout();
        return of(router.createUrlTree(['/landing']));
      })
    );
  }

  return true;
};
