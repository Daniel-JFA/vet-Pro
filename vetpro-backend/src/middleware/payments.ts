import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

/** Rechaza checkouts y webhooks de Wompi si la pasarela no está configurada en producción. */
export function requireOnlinePayments(_req: Request, res: Response, next: NextFunction) {
  if (!env.onlinePaymentsEnabled) {
    res.status(503).json({
      error: 'Los pagos en línea no están habilitados en este servidor.',
      code: 'ONLINE_PAYMENTS_DISABLED'
    });
    return;
  }
  next();
}

/** Rechaza la aprobación simulada de pagos (solo desarrollo / sandbox). */
export function requirePaymentSimulation(_req: Request, res: Response, next: NextFunction) {
  if (!env.paymentSimulationAllowed) {
    res.status(403).json({
      error: 'La simulación de pagos no está permitida en producción.',
      code: 'PAYMENT_SIMULATION_DISABLED'
    });
    return;
  }
  next();
}
