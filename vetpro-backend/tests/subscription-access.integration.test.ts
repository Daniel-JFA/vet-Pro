import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { MailerService } from '../src/services/mailer.service.js';
import { getClinicAccess } from '../src/services/subscription-access.service.js';
import { SubscriptionReminderService } from '../src/services/subscription-reminder.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const daysFromNow = (days: number) => new Date(Date.now() + days * DAY_MS);

// Sprint 14.3: vencimiento de suscripción con 5 días de gracia y luego solo lectura.
describe('Vencimiento de suscripción (Sprint 14.3)', () => {
  const clinicIds: string[] = [];

  async function createClinic(label: string, data: { subscriptionStatus?: string; trialEndsAt?: Date; nextBillingDate?: Date }) {
    const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica ${label} ${ts}`,
        phone: '3100000000',
        email: `clinic_${label}_${ts}@test.com`,
        address: 'Calle 1 # 2-3',
        city: 'Bogotá',
        ...data
      }
    });
    clinicIds.push(clinic.id);
    const admin = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        firstName: 'Ana',
        lastName: 'Admin',
        email: `admin_${label}_${ts}@test.com`,
        passwordHash: 'dummy_hash',
        role: 'admin'
      }
    });
    const token = TokenService.signStaff({ id: admin.id, email: admin.email, role: 'admin', clinicId: clinic.id });
    return { clinic, token };
  }

  let expiredToken: string;
  let graceToken: string;
  let suspendedToken: string;

  beforeAll(async () => {
    expiredToken = (await createClinic('vencida', { subscriptionStatus: 'trial', trialEndsAt: daysFromNow(-6) })).token;
    graceToken = (await createClinic('gracia', { subscriptionStatus: 'trial', trialEndsAt: daysFromNow(-3) })).token;
    suspendedToken = (await createClinic('suspendida', { subscriptionStatus: 'suspended', nextBillingDate: daysFromNow(20) })).token;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    try {
      await prisma.subscriptionNotice.deleteMany({ where: { clinicId: { in: clinicIds } } });
      await prisma.clinicSubscriptionPayment.deleteMany({ where: { clinicId: { in: clinicIds } } });
      await prisma.user.deleteMany({ where: { clinicId: { in: clinicIds } } });
      await prisma.clinic.deleteMany({ where: { id: { in: clinicIds } } });
    } catch {
      // Ignorar errores de cascada en cleanup
    }
  });

  describe('getClinicAccess', () => {
    const base = { trialEndsAt: null, nextBillingDate: null, createdAt: new Date() };

    it('una prueba nueva dura 6 meses', () => {
      const access = getClinicAccess({ ...base, subscriptionStatus: 'trial' });
      expect(access.readOnly).toBe(false);
      expect(access.daysUntilExpiry).toBe(180);
    });

    it('un plan activo usa nextBillingDate', () => {
      const access = getClinicAccess({ ...base, subscriptionStatus: 'active', trialEndsAt: daysFromNow(-60), nextBillingDate: daysFromNow(10) });
      expect(access.readOnly).toBe(false);
      expect(access.daysUntilExpiry).toBe(10);
    });

    it('queda en solo lectura pasados los 5 días de gracia', () => {
      expect(getClinicAccess({ ...base, subscriptionStatus: 'active', nextBillingDate: daysFromNow(-4) }).readOnly).toBe(false);
      expect(getClinicAccess({ ...base, subscriptionStatus: 'active', nextBillingDate: daysFromNow(-6) }).readOnly).toBe(true);
    });
  });

  it('una clínica con la prueba vencida hace 6 días recibe 402 al crear una cita', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({});
    expect(res.status).toBe(402);
    expect(res.body.code).toBe('SUBSCRIPTION_EXPIRED');
  });

  it('la misma clínica puede seguir consultando', async () => {
    const res = await request(app)
      .get('/api/v1/patients')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(200);
  });

  it('la misma clínica puede iniciar el pago de la renovación', async () => {
    const res = await request(app)
      .post('/api/v1/subscriptions/checkout')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({ plan: 'pro', billingCycle: 'monthly' });
    expect(res.status).toBe(201);
  });

  it('dentro de la gracia se puede seguir creando', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${graceToken}`)
      .send({});
    expect(res.status).not.toBe(402);
  });

  it('una clínica suspendida queda en solo lectura de inmediato', async () => {
    const res = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${suspendedToken}`)
      .send({});
    expect(res.status).toBe(402);
  });

  it('/subscriptions/current informa el estado de solo lectura', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions/current')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(200);
    expect(res.body.clinic.readOnly).toBe(true);
  });

  it('envía el aviso de 7 días y el de 1 día una sola vez cada uno', async () => {
    const sendSpy = vi.spyOn(MailerService, 'sendSubscriptionExpiryNotice').mockResolvedValue(true);
    const { clinic } = await createClinic('aviso', { subscriptionStatus: 'active', nextBillingDate: daysFromNow(6.5) });

    expect(await SubscriptionReminderService.sendDueNotices(new Date(), [clinic.id])).toBe(1);
    // Repetir la revisión no reenvía el aviso
    expect(await SubscriptionReminderService.sendDueNotices(new Date(), [clinic.id])).toBe(0);

    // Un día antes del vencimiento sale el aviso de 1 día
    expect(await SubscriptionReminderService.sendDueNotices(daysFromNow(6), [clinic.id])).toBe(1);

    const notices = await prisma.subscriptionNotice.findMany({ where: { clinicId: clinic.id } });
    expect(notices.map((n) => n.kind).sort()).toEqual(['1d', '7d']);
    expect(sendSpy).toHaveBeenCalledTimes(2);
  });

  it('no registra el aviso si el correo no salió, para reintentarlo', async () => {
    vi.spyOn(MailerService, 'sendSubscriptionExpiryNotice').mockResolvedValue(false);
    const { clinic } = await createClinic('smtp', { subscriptionStatus: 'active', nextBillingDate: daysFromNow(3) });

    expect(await SubscriptionReminderService.sendDueNotices(new Date(), [clinic.id])).toBe(0);
    expect(await prisma.subscriptionNotice.count({ where: { clinicId: clinic.id } })).toBe(0);
  });
});
