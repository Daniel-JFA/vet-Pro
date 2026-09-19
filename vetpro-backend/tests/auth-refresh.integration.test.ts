import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';

describe('Auth: Refresh Token y Logout (Sprint 3.4)', () => {
  let clinicId: string;
  let userId: string;
  let userEmail: string;
  let validRefreshToken: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Refresh ${timestamp}`,
        phone: '3001239999',
        email: `refresh_${timestamp}@test.com`,
        address: 'Calle 50 # 20-10',
        city: 'Bogotá',
        plan: 'starter'
      }
    });
    clinicId = clinic.id;

    userEmail = `user_rf_${timestamp}@test.com`;
    const user = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Test',
        lastName: 'Refresh',
        email: userEmail,
        passwordHash: 'hashed_password_test',
        role: 'vet',
        active: true
      }
    });
    userId = user.id;

    validRefreshToken = TokenService.signRefreshToken({ id: userId, clinicId });
  });

  afterAll(async () => {
    if (clinicId) await prisma.clinic.delete({ where: { id: clinicId } }).catch(() => null);
  });

  it('POST /api/v1/auth/refresh sin token responde 401', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toContain('Refresh token no proporcionado');
  });

  it('POST /api/v1/auth/refresh con token corrupto responde 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['vetpro_refresh_token=token_invalido']);

    expect(res.status).toBe(401);
    expect(res.body.error).toContain('inválido o expirado');
  });

  it('POST /api/v1/auth/refresh con cookie válida devuelve nuevo token y rota la cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`vetpro_refresh_token=${validRefreshToken}`]);

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.id).toBe(userId);

    // Verificar que la cookie fue rotada y enviada con httpOnly
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const refreshCookie = cookies.find((c) => c.startsWith('vetpro_refresh_token='));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('POST /api/v1/auth/logout elimina la cookie de sesión', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('cerrada exitosamente');

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const clearedCookie = cookies.find((c) => c.startsWith('vetpro_refresh_token='));
    expect(clearedCookie).toBeDefined();
    // Debe expirar o estar vacío para borrarlo
    expect(clearedCookie).toMatch(/Expires=|Max-Age=0/);
  });
});
