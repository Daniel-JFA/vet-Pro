import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TutorAuthService } from '../services/tutor-auth.service';
import { PlatformAuthService } from '../services/platform-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const tutorAuth = inject(TutorAuthService);
  const platformAuth = inject(PlatformAuthService);

  // El endpoint decide qué token corresponde: plataforma, tutor o staff de clínica
  const isPlatformRequest = req.url.includes('/platform');
  const isPortalRequest = req.url.includes('/portal');

  const token = isPlatformRequest
    ? platformAuth.token()
    : isPortalRequest
      ? tutorAuth.token()
      : (auth.state().token || tutorAuth.token());

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        if (isPlatformRequest) {
          platformAuth.logout();
        } else if (auth.state().token) {
          auth.logout();
        } else if (tutorAuth.token()) {
          tutorAuth.logout();
        }
      }
      return throwError(() => err);
    })
  );
};
