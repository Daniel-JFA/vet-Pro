import { describe, it, expect, afterAll, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { MailerService } from '../src/services/mailer.service.js';
import { AccountDeletionService } from '../src/services/account-deletion.service.js';

// Eliminación de cuenta exigida por App Store y Google Play (y Ley 1581).
describe('Eliminación de cuenta', () => {
  vi.spyOn(MailerService, 'sendAccountDeletedEmail').mockResolvedValue(true);
  vi.spyOn(MailerService, 'sendDataDeletionRequestNotice').mockResolvedValue(true);

  const clinicIds: string[] = [];
  const PASSWORD = 'Clave-Segura-123';
  let passwordHash: string;

  async function createClinic(label: string) {
    passwordHash ??= await bcrypt.hash(PASSWORD, 4);
    const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica ${label} ${ts}`,
        phone: '3100000000',
        email: `clinic_del_${ts}@test.com`,
        address: 'Calle 1 # 2-3',
        city: 'Bogotá',
        plan: 'enterprise'
      }
    });
    clinicIds.push(clinic.id);
    const branch = await prisma.branch.create({ data: { clinicId: clinic.id, name: 'Sede', address: 'Calle 1', phone: '3100000000' } });

    const makeUser = async (role: 'admin' | 'vet' | 'receptionist', n: string) => {
      const user = await prisma.user.create({
        data: {
          clinicId: clinic.id,
          firstName: 'Laura',
          lastName: `Pérez ${n}`,
          email: `${role}_${n}_${ts}@test.com`,
          passwordHash,
          role,
          phone: '3001112233',
          documentNumber: '1020304050'
        }
      });
      const token = TokenService.signStaff({ id: user.id, email: user.email, role, clinicId: clinic.id });
      return { user, token };
    };

    return { clinic, branch, makeUser, ts };
  }

  afterAll(async () => {
    vi.restoreAllMocks();
    for (const id of clinicIds) {
      await AccountDeletionService.purgeClinic(id).catch(() => undefined);
    }
  });

  it('un usuario elimina su cuenta: pierde el acceso y sus datos personales, conserva el nombre', async () => {
    const { makeUser } = await createClinic('staff');
    await makeUser('admin', 'a');
    const { user, token } = await makeUser('vet', 'v');
    await prisma.vetProfile.create({
      data: { userId: user.id, clinicId: user.clinicId, professionalCard: 'COMVEZCOL-DEL-1', isPublic: true, whatsappNumber: '3001112233' }
    });

    const res = await request(app).delete('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('account_deleted');

    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { vetProfile: true } });
    expect(after.active).toBe(false);
    expect(after.anonymizedAt).not.toBeNull();
    expect(after.email).not.toBe(user.email);
    expect(after.phone).toBeNull();
    expect(after.documentNumber).toBeNull();
    expect(after.firstName).toBe('Laura');
    expect(after.vetProfile?.isPublic).toBe(false);
    expect(after.vetProfile?.professionalCard).toBeNull();

    // Ya no puede iniciar sesión con su correo anterior
    const login = await request(app).post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
    expect(login.status).not.toBe(200);
  });

  it('exige la contraseña correcta', async () => {
    const { makeUser } = await createClinic('clave');
    await makeUser('admin', 'a');
    const { token } = await makeUser('receptionist', 'r');

    const res = await request(app).delete('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send({ password: 'otra' });
    expect(res.status).toBe(401);
  });

  it('el único administrador de una clínica con equipo debe ceder el rol primero', async () => {
    const { makeUser } = await createClinic('admin');
    const { token } = await makeUser('admin', 'a');
    await makeUser('vet', 'v');

    const res = await request(app).delete('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send({ password: PASSWORD });
    expect(res.status).toBe(409);
  });

  it('un administrador no puede reactivar a quien eliminó su cuenta', async () => {
    const { makeUser } = await createClinic('reactivar');
    const { token: adminToken } = await makeUser('admin', 'a');
    const { user, token } = await makeUser('vet', 'v');
    await request(app).delete('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send({ password: PASSWORD });

    const res = await request(app).patch(`/api/v1/auth/users/${user.id}`).set('Authorization', `Bearer ${adminToken}`).send({ active: true });
    expect(res.status).toBe(409);
  });

  it('si es el último usuario, se programa el borrado de la clínica y luego se borra todo', async () => {
    const { clinic, branch, makeUser } = await createClinic('cierre');
    const { user, token } = await makeUser('admin', 'a');

    // Datos con referencias protegidas (RESTRICT) para comprobar que el borrado no falla
    const tutor = await prisma.tutor.create({ data: { clinicId: clinic.id, firstName: 'Carlos', lastName: 'Ruiz', phone: '3009998877' } });
    const patient = await prisma.patient.create({ data: { clinicId: clinic.id, tutorId: tutor.id, name: 'Toby', species: 'dog', sex: 'male' } });
    await prisma.appointment.create({
      data: { clinicId: clinic.id, branchId: branch.id, patientId: patient.id, vetId: user.id, serviceType: 'Consulta', scheduledAt: new Date() }
    });
    const record = await prisma.medicalRecord.create({ data: { clinicId: clinic.id, patientId: patient.id, vetId: user.id, title: 'Control' } });
    await prisma.prescription.create({ data: { recordId: record.id, patientId: patient.id, vetId: user.id } });
    await prisma.vaccine.create({ data: { patientId: patient.id, vetId: user.id, name: 'Rabia', appliedAt: new Date() } });
    await prisma.invoice.create({ data: { clinicId: clinic.id, invoiceNumber: 'F-1', tutorId: tutor.id, subtotal: 1000, total: 1000, balance: 0 } });
    await prisma.cashRegisterShift.create({ data: { clinicId: clinic.id, branchId: branch.id, userId: user.id } });

    const res = await request(app).delete('/api/v1/auth/me').set('Authorization', `Bearer ${token}`).send({ password: PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.outcome).toBe('clinic_scheduled');

    const scheduled = await prisma.clinic.findUniqueOrThrow({ where: { id: clinic.id } });
    expect(scheduled.deletionScheduledAt).not.toBeNull();
    expect(scheduled.subscriptionStatus).toBe('cancelled');

    // Antes de la fecha no se borra nada
    expect(await AccountDeletionService.purgeScheduledClinics(new Date(), [clinic.id])).toBe(0);

    // Cumplidos los 30 días se borra la clínica completa
    const in31Days = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(await AccountDeletionService.purgeScheduledClinics(in31Days, [clinic.id])).toBe(1);
    expect(await prisma.clinic.findUnique({ where: { id: clinic.id } })).toBeNull();
    expect(await prisma.tutor.count({ where: { clinicId: clinic.id } })).toBe(0);
    expect(await prisma.user.count({ where: { clinicId: clinic.id } })).toBe(0);
  });

  it('un tutor elimina sus datos desde el portal y su sesión deja de funcionar', async () => {
    const { clinic } = await createClinic('tutor');
    const tutor = await prisma.tutor.create({
      data: { clinicId: clinic.id, firstName: 'Marta', lastName: 'Gil', phone: '3015556677', email: 'marta@test.com', documentId: '52000000', address: 'Cra 1' }
    });
    await prisma.invoice.create({ data: { clinicId: clinic.id, invoiceNumber: 'F-9', tutorId: tutor.id, subtotal: 1000, total: 1000, balance: 0 } });
    const token = TokenService.signTutorSession({ id: tutor.id, phone: tutor.phone, clinicId: clinic.id, role: 'tutor' });

    const res = await request(app).delete('/api/v1/portal/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const after = await prisma.tutor.findUniqueOrThrow({ where: { id: tutor.id } });
    expect(after.email).toBeNull();
    expect(after.phone).toBe('');
    expect(after.address).toBeNull();
    // Tiene facturas: se conservan nombre y documento por obligación tributaria
    expect(after.firstName).toBe('Marta');
    expect(after.documentId).toBe('52000000');

    const again = await request(app).get('/api/v1/portal/patients').set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(401);
  });

  it('un tutor sin facturas queda sin nombre ni documento', async () => {
    const { clinic } = await createClinic('tutor2');
    const tutor = await prisma.tutor.create({ data: { clinicId: clinic.id, firstName: 'Pedro', lastName: 'Sanz', phone: '3015550000', documentId: '80000000' } });

    await AccountDeletionService.deleteTutorAccount(tutor.id);
    const after = await prisma.tutor.findUniqueOrThrow({ where: { id: tutor.id } });
    expect(after.firstName).toBe('Tutor');
    expect(after.documentId).toBeNull();
  });

  it('la web pública registra solicitudes de eliminación y valida el correo', async () => {
    const email = `solicitud_${Date.now()}@test.com`;
    const ok = await request(app).post('/api/v1/privacy/deletion-requests').send({ email, audience: 'tutor', message: 'Borren mis datos' });
    expect(ok.status).toBe(201);
    expect(await prisma.dataDeletionRequest.count({ where: { email } })).toBe(1);
    await prisma.dataDeletionRequest.deleteMany({ where: { email } });

    const bad = await request(app).post('/api/v1/privacy/deletion-requests').send({ email: 'no-es-correo', audience: 'tutor' });
    expect(bad.status).toBe(400);
  });
});
