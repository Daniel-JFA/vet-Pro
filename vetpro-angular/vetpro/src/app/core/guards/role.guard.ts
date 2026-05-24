import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Guardia funcional en Angular 21 para proteger rutas basadas en Roles
export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const user = auth.currentUser;

    if (user && allowedRoles.includes(user.role)) {
      return true;
    }

    console.warn(`🔒 Acceso denegado a ruta. Rol '${user?.role}' no posee permisos adecuados.`);
    return router.createUrlTree(['/dashboard']);
  };
};
