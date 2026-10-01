import { Request, Response, NextFunction } from 'express';

// Las rutas que aprueban pagos sin pasar por Wompi solo existen fuera de producción
// y con ENABLE_PAYMENT_SIMULATION=true. Se lee en cada petición para que los tests
// puedan comprobar el comportamiento de producción.
export const isPaymentSimulationEnabled = (): boolean =>
  process.env.NODE_ENV !== 'production' && process.env.ENABLE_PAYMENT_SIMULATION === 'true';

// Responde 404 (no 403) para no revelar que la ruta existe.
export const paymentSimulationGuard = (_req: Request, res: Response, next: NextFunction) => {
  if (!isPaymentSimulationEnabled()) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  next();
};
