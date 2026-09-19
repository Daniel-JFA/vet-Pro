import { describe, it, expect, vi, beforeEach } from 'vitest';

function fakeRes() {
  const res: any = { headersSent: false, statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: unknown) => { res.body = b; return res; };
  return res;
}

async function loadHandler(nodeEnv: string) {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', nodeEnv);
  if (nodeEnv === 'production') vi.stubEnv('JWT_SECRET', 'x'.repeat(64));
  return (await import('../src/middleware/error.js')).errorHandler;
}

import { logger } from '../src/utils/logger.js';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(logger, 'error').mockImplementation(() => undefined as any);
  });

  it('en producción un 500 no expone el mensaje interno', async () => {
    const handler = await loadHandler('production');
    const res = fakeRes();
    handler(new Error('relation "invoices" does not exist'), { method: 'GET', originalUrl: '/x' } as any, res, vi.fn());
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('invoices');
  });

  it('un error de cliente (400) sí conserva su mensaje', async () => {
    const handler = await loadHandler('production');
    const res = fakeRes();
    const err: any = new Error('JSON inválido');
    err.status = 400;
    handler(err, { method: 'POST', originalUrl: '/x' } as any, res, vi.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('JSON inválido');
  });

  it('el bloqueo CORS responde 403 y no 500', async () => {
    const handler = await loadHandler('test');
    const res = fakeRes();
    handler(new Error('Bloqueado por política CORS'), { method: 'GET', originalUrl: '/x' } as any, res, vi.fn());
    expect(res.statusCode).toBe(403);
  });
});
