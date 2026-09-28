import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';

// Sprint 14.1: ningún atajo puede activar un plan o aprobar un pago en producción.
describe('Atajos de pago bloqueados en producción (Sprint 14.1)', () => {
  let clinicId: string;
  let adminToken: string;
  let vetToken: string;
  let vetProfileId: string;
  let platformToken: string;

  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ENABLE_PAYMENT_SIMULATION;

  const setProduction = () => {
    process.env.NODE_ENV = 'production';
    process.env.ENABLE_PAYMENT_SIMULATION = 'true';
  };

  beforeAll(async () => {
    const timestamp = Date.now();

    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Guard ${timestamp}`,
        phone: '3100000000',
        email: `clinic_guard_${timestamp}@test.com`,
        address: 'Calle 1 # 2-3',
        city: 'Bogotá',
        nit: '900.000.000-1',
        plan: 'starter'
      }
    });
    clinicId = clinic.id;

    const admin = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Ana',
        lastName: 'Admin',
        email: `admin_guard_${timestamp}@test.com`,
        passwordHash: 'dummy_hash',
        role: 'admin'
      }
    });
    adminToken = TokenService.signStaff({ id: admin.id, email: admin.email, role: 'admin', clinicId });

    const vet = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Victor',
        lastName: 'Vet',
        email: `vet_guard_${timestamp}@test.com`,
        passwordHash: 'dummy_hash',
        role: 'vet'
      }
    });
    vetToken = TokenService.signStaff({ id: vet.id, email: vet.email, role: 'vet', clinicId });

    const profile = await prisma.vetProfile.create({
      data: {
        userId: vet.id,
        clinicId,
        professionalCard: `COMVEZCOL-G${timestamp}`,
        verificationStatus: 'verified',
        isPublic: true,
        isFeatured: false,
        consultationPrice: 50000,
        city: 'Bogotá'
      }
    });
    vetProfileId = profile.id;

    platformToken = TokenService.signPlatform({
      id: 'platform-guard-test',
      email: 'platform@vetpro.test',
      role: 'platform_admin'
    });
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.ENABLE_PAYMENT_SIMULATION = originalFlag;
  });

  afterAll(async () => {
    try {
      await prisma.marketplacePayment.deleteMany({ where: { vetProfileId } });
      await prisma.clinicSubscriptionPayment.deleteMany({ where: { clinicId } });
      await prisma.vetProfile.deleteMany({ where: { clinicId } });
      await prisma.user.deleteMany({ where: { clinicId } });
      await prisma.clinic.delete({ where: { id: clinicId } });
    } catch {
      // Ignorar errores de cascada en cleanup
    }
  });

  it('simulate-approval responde 404 en producción aunque el flag esté activo', async () => {
    setProduction();
    const res = await request(app)
      .post('/api/v1/subscriptions/simulate-approval/VP-CUALQUIERA')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(404);

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    expect(clinic?.plan).toBe('starter');
  });

  it('simulate-approval responde 404 fuera de producción si el flag no está activo', async () => {
    delete process.env.ENABLE_PAYMENT_SIMULATION;
    const res = await request(app)
      .post('/api/v1/subscriptions/simulate-approval/VP-CUALQUIERA')
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    expect(res.status).toBe(404);
  });

  it('mock-simulate responde 404 en producción, incluso con token de plataforma', async () => {
    setProduction();
    const res = await request(app)
      .post('/api/v1/marketplace/payments/mock-simulate')
      .set('Authorization', `Bearer ${platformToken}`)
      .send({ reference: 'VP-CUALQUIERA', status: 'APPROVED' });
    expect(res.status).toBe(404);
  });

  it('mock-simulate exige token de plataforma cuando la simulación está habilitada', async () => {
    const res = await request(app)
      .post('/api/v1/marketplace/payments/mock-simulate')
      .send({ reference: 'VP-CUALQUIERA', status: 'APPROVED' });
    expect(res.status).toBe(401);
  });

  it('instantActivate se ignora en producción: devuelve checkout pero no activa Pro Vet', async () => {
    setProduction();
    const res = await request(app)
      .post('/api/v1/marketplace/profile/subscription')
      .set('Authorization', `Bearer ${vetToken}`)
      .send({ instantActivate: true });

    expect(res.status).toBe(201);
    expect(res.body.simulated).toBeUndefined();
    expect(res.body.checkout.reference).toBeDefined();

    const profile = await prisma.vetProfile.findUnique({ where: { id: vetProfileId } });
    expect(profile?.isFeatured).toBe(false);
    expect(profile?.subscriptionStatus).not.toBe('active');

    // La página de retorno de Wompi ve el pago como pendiente hasta que llegue el webhook
    const statusRes = await request(app)
      .get(`/api/v1/marketplace/payments/status/${res.body.checkout.reference}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status).toBe('PENDING');
    expect(statusRes.body.paymentType).toBe('subscription_pro_vet');
  });

  it('el estado de un pago inexistente responde 404', async () => {
    const res = await request(app).get('/api/v1/marketplace/payments/status/VP-NO-EXISTE');
    expect(res.status).toBe(404);
  });
});
