import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TutorAuthService } from '../services/tutor-auth.service';
import { PlatformAuthService } from '../services/platform-auth.service';
import { ToastService } from '../services/toast.service';

// Aviso de suscripción vencida (402): una vez por minuto como máximo, para no
// repetirlo en cada petición bloqueada.
const EXPIRED_NOTICE_INTERVAL_MS = 60_000;
let lastExpiredNoticeAt = 0;

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const tutorAuth = inject(TutorAuthService);
  const platformAuth = inject(PlatformAuthService);
  const toast = inject(ToastService);

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
      if (err.status === 402 && err.error?.code === 'SUBSCRIPTION_EXPIRED') {
        const now = Date.now();
        if (now - lastExpiredNoticeAt > EXPIRED_NOTICE_INTERVAL_MS) {
          lastExpiredNoticeAt = now;
          toast.warning('La suscripción de la clínica está vencida: puedes consultar y exportar, pero no crear ni modificar. Un administrador puede renovarla en Suscripción.', 10000);
        }
        return throwError(() => err);
      }

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
