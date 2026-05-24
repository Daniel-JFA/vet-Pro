import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('💥 Error detectado en el servidor:', err);

  const status = err.status || 500;
  const message = err.message || 'Ocurrió un error interno en el servidor.';

  res.status(status).json({
    error: message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
