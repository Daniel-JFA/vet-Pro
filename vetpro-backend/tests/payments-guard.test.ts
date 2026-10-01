import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * En producción sin credenciales de Wompi, los pagos en línea y la simulación de
 * pagos deben estar cerrados (2026-09-30: se podía activar un plan pago o marcar
 * una reserva como pagada sin cobrar).
 */
const envMock = vi.hoisted(() => ({
  env: { isProduction: true, JWT_SECRET: 'x', onlinePaymentsEnabled: false, paymentSimulationAllowed: false }
}));
vi.mock('../src/config/env.js', () => envMock);

import { requireOnlinePayments, requirePaymentSimulation } from '../src/middleware/payments.js';

function run(mw: any) {
  const res: any = { statusCode: 200, body: null };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: any) => ((res.body = b), res);
  const next = vi.fn();
  mw({} as any, res, next);
  return { res, next };
}

describe('Bloqueo de pagos en producción', () => {
  beforeEach(() => {
    envMock.env.onlinePaymentsEnabled = false;
    envMock.env.paymentSimulationAllowed = false;
  });

  it('rechaza checkouts y webhooks si Wompi no está configurado', () => {
    const { res, next } = run(requireOnlinePayments);
    expect(res.statusCode).toBe(503);
    expect(res.body.code).toBe('ONLINE_PAYMENTS_DISABLED');
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza la aprobación simulada de pagos', () => {
    const { res, next } = run(requirePaymentSimulation);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('deja pasar cuando están habilitados', () => {
    envMock.env.onlinePaymentsEnabled = true;
    envMock.env.paymentSimulationAllowed = true;
    expect(run(requireOnlinePayments).next).toHaveBeenCalled();
    expect(run(requirePaymentSimulation).next).toHaveBeenCalled();
  });
});
