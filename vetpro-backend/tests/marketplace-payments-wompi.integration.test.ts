import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { WompiService, wompiConfig } from '../src/services/wompi.service.js';
import crypto from 'crypto';

describe('Marketplace Payments & Wompi Gateway (Sprint 9 Integration Tests)', () => {
  let clinicId: string;
  let branchId: string;
  let vetUserToken: string;
  let vetUserId: string;
  let vetProfileId: string;
  let tutorId: string;
  let patientId: string;
  let testAppointmentId: string;
  let testCheckoutReference: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Crear Clínica
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Wompi ${timestamp}`,
        phone: '3105559988',
        email: `clinic_wompi_${timestamp}@test.com`,
        address: 'Calle 100 # 15-20',
        city: 'Bogotá',
        nit: '900.123.456-7',
        plan: 'pro'
      }
    });
    clinicId = clinic.id;

    // 2. Crear Sede
    const branch = await prisma.branch.create({
      data: {
        clinicId,
        name: 'Sede Chicó',
        address: 'Calle 100 # 15-20',
        phone: '3105559988'
      }
    });
    branchId = branch.id;

    // 3. Crear Veterinario
    const vetUser = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Carlos',
        lastName: 'Montoya',
        email: `dr_montoya_${timestamp}@test.com`,
        passwordHash: 'dummy_hash',
        phone: '3012223344',
        role: 'vet'
      }
    });
    vetUserId = vetUser.id;
    vetUserToken = TokenService.signStaff({
      id: vetUser.id,
      email: vetUser.email,
      role: 'vet',
      clinicId,
      branchId
    });

    // 4. Crear Perfil de Veterinario
    const vetProfile = await prisma.vetProfile.create({
      data: {
        userId: vetUserId,
        clinicId,
        professionalCard: 'COMVEZCOL-77889',
        verificationStatus: 'verified',
        isPublic: true,
        isFeatured: false,
        consultationPrice: 60000,
        homeVisitPrice: 90000,
        city: 'Bogotá',
        specialties: ['Dermatología', 'Medicina Felina']
      }
    });
    vetProfileId = vetProfile.id;

    // 5. Crear Tutor y Paciente
    const tutor = await prisma.tutor.create({
      data: {
        clinicId,
        firstName: 'Andrea',
        lastName: 'Gómez',
        phone: '3157778899',
        email: 'andrea.gomez@test.com',
        documentId: '1020304050',
        address: 'Carrera 11 # 93-45'
      }
    });
    tutorId = tutor.id;

    const patient = await prisma.patient.create({
      data: {
        clinicId,
        tutorId,
        name: 'Simba',
        species: 'cat',
        breed: 'Siamés',
        sex: 'male'
      }
    });
    patientId = patient.id;

    // 6. Crear Cita Médica
    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        branchId,
        vetId: vetUserId,
        patientId,
        scheduledAt: new Date(Date.now() + 86400000), // Mañana
        serviceType: 'Consulta General Felina',
        modality: 'clinic',
        amountCharged: 60000,
        reason: 'Chequeo preventivo anual'
      }
    });
    testAppointmentId = appointment.id;
  });

  afterAll(async () => {
    try {
      await prisma.marketplacePayment.deleteMany({ where: { clinicId } });
      await prisma.appointment.deleteMany({ where: { clinicId } });
      await prisma.patient.deleteMany({ where: { clinicId } });
      await prisma.tutor.deleteMany({ where: { clinicId } });
      await prisma.vetProfile.deleteMany({ where: { clinicId } });
      await prisma.branch.deleteMany({ where: { clinicId } });
      await prisma.user.deleteMany({ where: { clinicId } });
      await prisma.clinic.delete({ where: { id: clinicId } });
    } catch {
      // Ignorar errores de cascada en cleanup
    }
  });

  it('1. WompiService genera firma de integridad SHA256 criptográficamente correcta', () => {
    const reference = 'VP-TEST-REF-001';
    const amountInCents = 6000000;
    const currency = 'COP';

    const signature = WompiService.generateIntegritySignature(reference, amountInCents, currency);
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.length).toBe(64); // Longitud de hash SHA-256 en hexadecimal

    // Comprobación manual
    const expected = crypto
      .createHash('sha256')
      .update(`${reference}${amountInCents}${currency}${wompiConfig.integritySecret}`)
      .digest('hex');
    expect(signature).toBe(expected);
  });

  it('2. POST /api/v1/marketplace/appointments/:id/checkout genera sesión de pago Wompi', async () => {
    const res = await request(app)
      .post(`/api/v1/marketplace/appointments/${testAppointmentId}/checkout`)
      .send();

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('paymentId');
    expect(res.body).toHaveProperty('publicKey');
    expect(res.body.currency).toBe('COP');
    expect(res.body.amount).toBe(60000);
    expect(res.body.amountInCents).toBe(6000000);
    expect(res.body.platformFee).toBe(9000); // 15% de 60.000 = 9.000
    expect(res.body.vetAmount).toBe(51000);   // 85% de 60.000 = 51.000
    expect(res.body.reference).toMatch(/^VP-APT-/);
    expect(res.body.signatureIntegrity).toBeDefined();
    expect(res.body.redirectUrl).toContain('marketplace/payment-result');
    expect(res.body.customerData.fullName).toBe('Andrea Gómez');
    expect(res.body.appointment.patientName).toBe('Simba');

    testCheckoutReference = res.body.reference;

    // Verificar en BD que el registro MarketplacePayment fue creado en estado 'pending'
    const dbPayment = await prisma.marketplacePayment.findUnique({
      where: { wompiReference: testCheckoutReference }
    });
    expect(dbPayment).not.toBeNull();
    expect(dbPayment?.status).toBe('pending');
    expect(dbPayment?.amount).toBe(60000);
    expect(dbPayment?.platformFee).toBe(9000);
    expect(dbPayment?.vetAmount).toBe(51000);
  });

  it('3. POST /api/v1/marketplace/payments/webhook procesa evento APPROVED y actualiza cita a pagada', async () => {
    const mockTransactionId = `WOMPI-TX-${Date.now()}`;

    // Estructura oficial del evento webhook de Wompi
    const webhookPayload = {
      event: 'transaction.updated',
      data: {
        transaction: {
          id: mockTransactionId,
          reference: testCheckoutReference,
          status: 'APPROVED',
          amount_in_cents: 6000000,
          currency: 'COP',
          payment_method_type: 'CARD',
          payment_method: {
            type: 'CARD',
            extra: { brand: 'MASTERCARD', last_four: '9876' }
          },
          finalized_at: new Date().toISOString()
        }
      },
      sent_at: new Date().toISOString(),
      timestamp: Math.floor(Date.now() / 1000)
    };

    const res = await request(app)
      .post('/api/v1/marketplace/payments/webhook')
      .send(webhookPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.processed).toBe(true);

    // Verificar que MarketplacePayment se actualizó a 'approved'
    const updatedPayment = await prisma.marketplacePayment.findUnique({
      where: { wompiReference: testCheckoutReference }
    });
    expect(updatedPayment?.status).toBe('approved');
    expect(updatedPayment?.wompiTransactionId).toBe(mockTransactionId);
    expect(updatedPayment?.paidAt).not.toBeNull();

    // Verificar que la cita médica asociada se marcó como 'paid'
    const updatedAppointment = await prisma.appointment.findUnique({
      where: { id: testAppointmentId }
    });
    expect(updatedAppointment?.paymentStatus).toBe('paid');
    expect(updatedAppointment?.paymentMethod).toBe('CARD');
    expect(updatedAppointment?.paymentReference).toBe(testCheckoutReference);
  });

  it('4. GET /api/v1/marketplace/appointments/:id/voucher retorna comprobante digital completo', async () => {
    const res = await request(app)
      .get(`/api/v1/marketplace/appointments/${testAppointmentId}/voucher`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('voucherId');
    expect(res.body).toHaveProperty('reservationCode');
    expect(res.body.appointmentId).toBe(testAppointmentId);
    expect(res.body.pricing.totalAmount).toBe(60000);
    expect(res.body.pricing.paymentStatus).toBe('paid');
    expect(res.body.pricing.paymentReference).toBe(testCheckoutReference);
    expect(res.body.patient.name).toBe('Simba');
    expect(res.body.patient.species).toBe('cat');
    expect(res.body.tutor.name).toBe('Andrea Gómez');
    expect(res.body.tutor.phone).toBe('3157778899');
    expect(res.body.vet.professionalCard).toBe('COMVEZCOL-77889');
    expect(res.body.clinic.name).toContain('Clínica Wompi');
    expect(res.body.security.voucherHash).toBeDefined();
    expect(res.body.security.voucherHash.length).toBe(16);
  });

  it('5. POST /api/v1/marketplace/payments/mock-simulate permite simulación directa en sandbox', async () => {
    // Crear otra cita para simular por mock
    const apt2 = await prisma.appointment.create({
      data: {
        clinicId,
        branchId,
        vetId: vetUserId,
        patientId,
        scheduledAt: new Date(Date.now() + 172800000),
        serviceType: 'Vacunación',
        amountCharged: 45000,
        reason: 'Triple Felina'
      }
    });

    const checkoutRes = await request(app)
      .post(`/api/v1/marketplace/appointments/${apt2.id}/checkout`)
      .send();

    const ref = checkoutRes.body.reference;

    // Simular aprobación
    const simRes = await request(app)
      .post('/api/v1/marketplace/payments/mock-simulate')
      .send({
        reference: ref,
        status: 'APPROVED',
        paymentMethod: 'PSE'
      });

    expect(simRes.status).toBe(200);
    expect(simRes.body.success).toBe(true);
    expect(simRes.body.simulated).toBe(true);

    const apt2Updated = await prisma.appointment.findUnique({
      where: { id: apt2.id }
    });
    expect(apt2Updated?.paymentStatus).toBe('paid');
    expect(apt2Updated?.paymentMethod).toBe('PSE');
  });

  it('6. POST /api/v1/marketplace/profile/subscription suscribe al veterinario a Pro Vet ⭐ ($49.000 COP)', async () => {
    // Estado inicial: no es destacado
    const initialProfile = await prisma.vetProfile.findUnique({
      where: { id: vetProfileId }
    });
    expect(initialProfile?.isFeatured).toBe(false);

    // Activar membresía con instantActivate: true
    const res = await request(app)
      .post('/api/v1/marketplace/profile/subscription')
      .set('Authorization', `Bearer ${vetUserToken}`)
      .send({ instantActivate: true });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.checkout.amount).toBe(49000);
    expect(res.body.checkout.plan.name).toContain('Pro Vet');

    // Verificar que el veterinario ahora es destacado ⭐ y tiene suscripción activa
    const updatedProfile = await prisma.vetProfile.findUnique({
      where: { id: vetProfileId }
    });
    expect(updatedProfile?.isFeatured).toBe(true);
    expect(updatedProfile?.subscriptionStatus).toBe('active');
    expect(updatedProfile?.subscriptionExpiresAt).not.toBeNull();
  });

  it('7. GET /api/v1/marketplace/profile/subscription consulta estado activo y beneficios de membresía', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/profile/subscription')
      .set('Authorization', `Bearer ${vetUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body.isFeatured).toBe(true);
    expect(res.body.subscriptionStatus).toBe('active');
    expect(res.body.isActive).toBe(true);
    expect(res.body.pricePerMonth).toBe(49000);
    expect(res.body.currency).toBe('COP');
    expect(Array.isArray(res.body.payments)).toBe(true);
    expect(res.body.payments.length).toBeGreaterThanOrEqual(1);
    expect(res.body.payments[0].paymentType).toBe('subscription_pro_vet');
  });
});
