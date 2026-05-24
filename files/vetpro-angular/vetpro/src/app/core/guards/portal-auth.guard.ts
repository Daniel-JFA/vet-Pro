import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TutorAuthService } from '../services/tutor-auth.service';

export const portalAuthGuard: CanActivateFn = () => {
  const auth = inject(TutorAuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) return true;
  return router.createUrlTree(['/portal/login']);
};
