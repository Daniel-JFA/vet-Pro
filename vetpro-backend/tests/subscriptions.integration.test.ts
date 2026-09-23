import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { PlanType } from '@prisma/client';

describe('SaaS Subscriptions & Recurring Billing (Integration Tests)', () => {
  let clinicId: string;
  let adminToken: string;
  let platformAdminToken: string;
  let generatedReference: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Crear Clínica
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica SaaS ${timestamp}`,
        phone: '3007778899',
        email: `clinic_saas_${timestamp}@test.com`,
        address: 'Carrera 15 # 85-30',
        city: 'Bogotá',
        plan: PlanType.starter,
        subscriptionStatus: 'trial'
      }
    });
    clinicId = clinic.id;

    // 2. Crear Admin de la Clínica
    const admin = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Carlos',
        lastName: 'Director',
        email: `carlos_admin_${timestamp}@test.com`,
        passwordHash: 'dummy',
        role: 'admin'
      }
    });
    adminToken = TokenService.signStaff({
      id: admin.id,
      email: admin.email,
      role: 'admin',
      clinicId
    });

    // 3. Crear Super-Admin de Plataforma
    const platformAdmin = await prisma.platformAdmin.create({
      data: {
        firstName: 'Super',
        lastName: 'Admin',
        email: `super_saas_${timestamp}@vetpro.com`,
        passwordHash: 'dummy',
        active: true
      }
    });
    platformAdminToken = TokenService.signPlatform({
      id: platformAdmin.id,
      email: platformAdmin.email,
      role: 'platform_admin'
    });
  });

  afterAll(async () => {
    await prisma.clinicSubscriptionPayment.deleteMany({ where: { clinicId } });
    await prisma.user.deleteMany({ where: { clinicId } });
    await prisma.clinic.deleteMany({ where: { id: clinicId } });
  });

  it('1. GET /api/v1/subscriptions/current debe retornar el estado de prueba (trial) y precios de la clínica', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions/current')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.clinic).toBeDefined();
    expect(res.body.clinic.plan).toBe('starter');
    expect(res.body.clinic.subscriptionStatus).toBe('trial');
    expect(res.body.pricing).toBeDefined();
    expect(res.body.pricing.monthlyPrice).toBe(80000);
  });

  it('2. POST /api/v1/subscriptions/checkout debe generar una sesión de pago Wompi con firma SHA-256', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plan: PlanType.pro,
        billingCycle: 'monthly'
      });

    expect(res.status).toBe(201);
    expect(res.body.reference).toContain('VETPRO-SUB-');
    expect(res.body.amountInPesos).toBe(150000);
    expect(res.body.amountInCents).toBe(15000000);
    expect(res.body.signature).toBeDefined();
    expect(res.body.signature.length).toBe(64); // SHA-256 hex length
    expect(res.body.publicKey).toBeDefined();

    generatedReference = res.body.reference;
  });

  it('3. POST /api/v1/subscriptions/simulate-approval/:reference debe aprobar el pago y activar la clínica en Plan Pro', async () => {
    const res = await request(app)
      .post(`/api/v1/subscriptions/simulate-approval/${generatedReference}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('pro');
    expect(res.body.activeUntil).toBeDefined();

    // Verificar en base de datos
    const updatedClinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    expect(updatedClinic?.subscriptionStatus).toBe('active');
    expect(updatedClinic?.plan).toBe('pro');
    expect(updatedClinic?.aiMinutesLimit).toBe(300);

    const payment = await prisma.clinicSubscriptionPayment.findUnique({
      where: { wompiReference: generatedReference }
    });
    expect(payment?.status).toBe('APPROVED');
    expect(payment?.paidAt).toBeDefined();
  });

  it('4. POST /api/v1/subscriptions/checkout anual debe aplicar el 15% de descuento', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plan: PlanType.enterprise,
        billingCycle: 'annual'
      });

    expect(res.status).toBe(201);
    expect(res.body.plan).toBe('enterprise');
    expect(res.body.amountInPesos).toBe(3060000); // 300,000 * 12 * 0.85
  });

  it('5. POST /api/v1/subscriptions/webhook debe procesar un evento APPROVED de Wompi', async () => {
    // Generar un nuevo checkout
    const checkoutRes = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plan: PlanType.pro,
        billingCycle: 'monthly'
      });

    const ref = checkoutRes.body.reference;

    // Disparar Webhook
    const webhookRes = await request(app)
      .post('/api/v1/subscriptions/webhook')
      .send({
        event: 'transaction.updated',
        data: {
          transaction: {
            id: `wompi-tx-${Date.now()}`,
            reference: ref,
            status: 'APPROVED',
            amount_in_cents: 15000000,
            currency: 'COP',
            payment_method_type: 'NEQUI'
          }
        }
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.status).toBe('processed');

    const payment = await prisma.clinicSubscriptionPayment.findUnique({
      where: { wompiReference: ref }
    });
    expect(payment?.status).toBe('APPROVED');
    expect(payment?.paymentMethod).toBe('NEQUI');
  });

  it('6. GET /api/v1/platform/subscriptions/stats debe reportar MRR y conteo de suscripciones al Super-Admin', async () => {
    const res = await request(app)
      .get('/api/v1/platform/subscriptions/stats')
      .set('Authorization', `Bearer ${platformAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.mrr).toBeGreaterThanOrEqual(150000);
    expect(res.body.arr).toBe(res.body.mrr * 12);
    expect(res.body.activeCount).toBeGreaterThanOrEqual(1);
    expect(res.body.planBreakdown).toBeDefined();
  });

  it('7. POST /api/v1/platform/subscriptions/clinics/:id/grant-extension debe otorgar días de cortesía a una clínica', async () => {
    const res = await request(app)
      .post(`/api/v1/platform/subscriptions/clinics/${clinicId}/grant-extension`)
      .set('Authorization', `Bearer ${platformAdminToken}`)
      .send({ days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.clinic.subscriptionStatus).toBe('active');
    expect(new Date(res.body.clinic.nextBillingDate).getTime()).toBeGreaterThan(Date.now());
  });
});
