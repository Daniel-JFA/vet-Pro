import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Sentry } from '../utils/sentry.js';

// Asigna un ID a cada petición para poder cruzar el error que ve el usuario con el log del servidor
export const requestId = (req: Request, res: Response, next: NextFunction) => {
  const id = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  (req as Request & { id?: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const id = (req as Request & { id?: string }).id;
  logger.error(
    { err, requestId: id, method: req.method, url: req.originalUrl },
    `💥 [${id}] ${req.method} ${req.originalUrl}: ${err?.message || err}`
  );

  // Errores de CORS y de payload (JSON inválido, cuerpo demasiado grande) son del cliente, no del servidor
  const status: number =
    err.status || err.statusCode || (err.message === 'Bloqueado por política CORS' ? 403 : 500);

  // Enviar a Sentry si es un error 500 o no controlado
  if (status >= 500) {
    Sentry.captureException(err, {
      extra: {
        requestId: id,
        method: req.method,
        url: req.originalUrl
      }
    });
  }

  // En producción un 500 nunca expone el mensaje interno (puede filtrar rutas, SQL o nombres de tablas)
  const message =
    status >= 500 && env.isProduction
      ? 'Ocurrió un error interno en el servidor.'
      : err.message || 'Ocurrió un error interno en el servidor.';

  if (res.headersSent) return next(err);

  res.status(status).json({
    error: message,
    requestId: id,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
