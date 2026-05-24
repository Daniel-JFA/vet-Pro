import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TutorAuthService } from '../services/tutor-auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const tutorAuth = inject(TutorAuthService);
  
  // Utilizar token de Staff si existe, de lo contrario utilizar token de Tutor
  const token = auth.state().token || tutorAuth.token();

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        if (auth.state().token) {
          auth.logout();
        } else if (tutorAuth.token()) {
          tutorAuth.logout();
        }
      }
      return throwError(() => err);
    })
  );
};
