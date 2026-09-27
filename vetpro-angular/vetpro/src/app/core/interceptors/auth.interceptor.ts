import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
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
  const isAuthEndpoint = req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/refresh');

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
      if (err.status !== 401) {
        return throwError(() => err);
      }

      // El access token del staff de clínica dura solo 15 minutos — antes de
      // sacar al usuario, intenta renovarlo en silencio con el refresh token
      // (cookie httpOnly) y reintenta la petición original una sola vez.
      if (!isPlatformRequest && !isPortalRequest && !isAuthEndpoint && auth.state().token) {
        return auth.getFreshToken().pipe(
          switchMap((newToken) => next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }))),
          catchError((refreshErr) => {
            auth.logout();
            return throwError(() => refreshErr);
          })
        );
      }

      if (isPlatformRequest) {
        platformAuth.logout();
      } else if (auth.state().token) {
        auth.logout();
      } else if (tutorAuth.token()) {
        tutorAuth.logout();
      }
      return throwError(() => err);
    })
  );
};
