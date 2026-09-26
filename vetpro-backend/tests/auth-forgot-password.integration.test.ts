import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';

describe('Auth: Recuperación de contraseña', () => {
  let clinicId: string;
  let userId: string;
  let userEmail: string;

  beforeAll(async () => {
    const timestamp = Date.now();
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Forgot ${timestamp}`,
        phone: '3001238888',
        email: `forgot_${timestamp}@test.com`,
        address: 'Calle 10 # 5-20',
        city: 'Bogotá',
        plan: 'starter'
      }
    });
    clinicId = clinic.id;

    userEmail = `user_fp_${timestamp}@test.com`;
    const user = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Test',
        lastName: 'Forgot',
        email: userEmail,
        passwordHash: await bcrypt.hash('vieja123', 10),
        role: 'vet',
        active: true
      }
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (clinicId) await prisma.clinic.delete({ where: { id: clinicId } }).catch(() => null);
  });

  it('POST /forgot-password sin correo responde 400', async () => {
    const res = await request(app).post('/api/v1/auth/forgot-password').send({});
    expect(res.status).toBe(400);
  });

  it('POST /forgot-password responde igual para un correo inexistente', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `no_existe_${Date.now()}@test.com` });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Si el correo está registrado');
  });

  it('flujo completo: solicita enlace, define nueva contraseña e ingresa', async () => {
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: `  ${userEmail.toUpperCase()} ` });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Si el correo está registrado');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.activationToken).toBeTruthy();
    const expiresInMs = user!.activationTokenExpiresAt!.getTime() - Date.now();
    expect(expiresInMs).toBeGreaterThan(0);
    expect(expiresInMs).toBeLessThanOrEqual(60 * 60 * 1000);

    const token = user!.activationToken!;
    const info = await request(app).get(`/api/v1/auth/activation/${token}`);
    expect(info.status).toBe(200);
    expect(info.body.email).toBe(userEmail);

    const reset = await request(app)
      .post('/api/v1/auth/activate')
      .send({ token, password: 'nueva456' });
    expect(reset.status).toBe(200);
    expect(reset.body.token).toBeDefined();

    // El enlace es de un solo uso
    const reuse = await request(app)
      .post('/api/v1/auth/activate')
      .send({ token, password: 'otra789' });
    expect(reuse.status).toBe(404);

    const oldLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password: 'vieja123' });
    expect(oldLogin.status).toBe(401);

    const newLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password: 'nueva456' });
    expect(newLogin.status).toBe(200);
  });

  it('no genera enlace para usuarios inactivos', async () => {
    await prisma.user.update({
      where: { id: userId },
      data: { active: false, activationToken: null, activationTokenExpiresAt: null }
    });

    const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: userEmail });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.activationToken).toBeNull();
  });
});
