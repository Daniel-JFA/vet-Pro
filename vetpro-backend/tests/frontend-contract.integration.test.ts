import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';

/**
 * Endpoints que el frontend llama y que llegaron a producción sin existir en el
 * backend (2026-09-30): registrar tutor + mascota, editar cita, historial y
 * vacunas de la ficha, y perfil del paseador. Cada caso reproduce la llamada
 * exacta del servicio Angular correspondiente.
 */
describe('Contrato frontend ↔ backend (flujos básicos de una clínica nueva)', () => {
  let clinicId: string;
  let otherClinicId: string;
  let adminToken: string;
  let otherAdminToken: string;
  let adminId: string;
  let walkerUserId: string;
  let tutorId: string;
  let patientId: string;
  let appointmentId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const clinic = await prisma.clinic.create({
      data: { name: `Contrato ${ts}`, phone: '3001112233', email: `contrato_${ts}@test.com`, address: 'Calle 1', city: 'Medellín' }
    });
    clinicId = clinic.id;
    await prisma.branch.create({ data: { clinicId, name: 'Sede', address: 'Calle 1', phone: '3001112233' } });

    const admin = await prisma.user.create({
      data: { clinicId, firstName: 'Admin', lastName: 'Contrato', email: `admin_contrato_${ts}@test.com`, passwordHash: 'x', role: 'admin' }
    });
    adminId = admin.id;
    adminToken = TokenService.signStaff({ id: admin.id, email: admin.email, role: 'admin', clinicId, branchId: null });

    const walkerUser = await prisma.user.create({
      data: { clinicId, firstName: 'Paseador', lastName: 'Contrato', email: `walker_contrato_${ts}@test.com`, passwordHash: 'x', role: 'walker' }
    });
    walkerUserId = walkerUser.id;
    await prisma.walker.create({ data: { clinicId, userId: walkerUser.id } });

    const other = await prisma.clinic.create({
      data: { name: `Otra ${ts}`, phone: '3001112234', email: `otra_${ts}@test.com`, address: 'Calle 2', city: 'Medellín' }
    });
    otherClinicId = other.id;
    const otherAdmin = await prisma.user.create({
      data: { clinicId: otherClinicId, firstName: 'Otra', lastName: 'Admin', email: `otra_admin_${ts}@test.com`, passwordHash: 'x', role: 'admin' }
    });
    otherAdminToken = TokenService.signStaff({ id: otherAdmin.id, email: otherAdmin.email, role: 'admin', clinicId: otherClinicId, branchId: null });
  });

  afterAll(async () => {
    for (const id of [clinicId, otherClinicId]) {
      try {
        await prisma.vaccine.deleteMany({ where: { patient: { clinicId: id } } });
        await prisma.appointment.deleteMany({ where: { clinicId: id } });
        await prisma.patient.deleteMany({ where: { clinicId: id } });
        await prisma.tutor.deleteMany({ where: { clinicId: id } });
        await prisma.walker.deleteMany({ where: { clinicId: id } });
        await prisma.branch.deleteMany({ where: { clinicId: id } });
        await prisma.user.deleteMany({ where: { clinicId: id } });
        await prisma.clinic.delete({ where: { id } });
      } catch {
        // Ignorar en cleanup
      }
    }
  });

  it('registra un tutor nuevo y su mascota (formulario "Nuevo paciente")', async () => {
    const tutorRes = await request(app)
      .post('/api/v1/tutors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Laura', lastName: 'Gómez', phone: '3005556677', email: '', documentId: '', address: '', notes: '', dataProcessingConsent: true, allowDuplicate: false });
    expect(tutorRes.status).toBe(201);
    tutorId = tutorRes.body.id;

    const patientRes = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Toby', species: 'dog', breed: '', birthDate: '', sex: 'male', sterilized: false, weight: null, chipId: '', photoUrl: '', allergies: '', notes: '', status: 'active', tutorId });
    expect(patientRes.status).toBe(201);
    patientId = patientRes.body.id;
  });

  it('acepta la fecha de nacimiento tal como la envía <input type="date">', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Luna', species: 'cat', breed: 'Criollo', birthDate: '2024-05-01', sex: 'female', sterilized: true, weight: 4.2, chipId: '', photoUrl: '', allergies: '', notes: '', status: 'active', tutorId });
    expect(res.status).toBe(201);
    expect(new Date(res.body.birthDate).toISOString().slice(0, 10)).toBe('2024-05-01');
  });

  it('carga historial y vacunas de la ficha de la mascota', async () => {
    await prisma.vaccine.create({
      data: { patientId, name: 'Rabia', appliedAt: new Date('2026-09-01T12:00:00Z'), vetId: adminId }
    });

    const history = await request(app)
      .get(`/api/v1/medical-records/patient/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(history.status).toBe(200);
    expect(Array.isArray(history.body)).toBe(true);

    const vaccines = await request(app)
      .get(`/api/v1/patients/${patientId}/vaccines`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(vaccines.status).toBe(200);
    expect(vaccines.body).toHaveLength(1);
    expect(vaccines.body[0].name).toBe('Rabia');
  });

  it('no expone las vacunas de una mascota de otra clínica', async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${patientId}/vaccines`)
      .set('Authorization', `Bearer ${otherAdminToken}`);
    expect(res.status).toBe(404);
  });

  it('edita una cita existente sin cambiar su estado', async () => {
    const created = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patientId, serviceType: 'consulta', scheduledAt: '2026-10-05T15:00:00.000Z', isNewPatient: false });
    expect(created.status).toBe(201);
    appointmentId = created.body.id;

    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'waiting' });

    // Igual que appointment-form: reenvía el formulario completo con status 'scheduled'
    const updated = await request(app)
      .put(`/api/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ patientId, isNewPatient: false, serviceType: 'vacunacion', scheduledAt: '2026-10-06T16:30:00.000Z', reason: 'Refuerzo', status: 'scheduled' });
    expect(updated.status).toBe(200);
    expect(updated.body.serviceType).toBe('vacunacion');
    expect(new Date(updated.body.scheduledAt).toISOString()).toBe('2026-10-06T16:30:00.000Z');
    expect(updated.body.status).toBe('waiting');
  });

  it('no permite editar una cita de otra clínica', async () => {
    const res = await request(app)
      .put(`/api/v1/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .send({ serviceType: 'hackeo' });
    expect(res.status).toBe(404);
  });

  it('registra un paseador por su correo (formulario de la clínica)', async () => {
    const res = await request(app)
      .post('/api/v1/walkers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userEmail: (await prisma.user.findUnique({ where: { id: walkerUserId } }))!.email.toUpperCase(), bio: 'x' });
    // El beforeAll ya le creó perfil: debe decirlo en vez de fallar con 400 genérico
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ya tiene un perfil/);
  });

  it('habilita de nuevo una jaula tras el alta', async () => {
    const branch = await prisma.branch.findFirst({ where: { clinicId } });
    const bed = await prisma.hospitalBed.create({
      data: { clinicId, branchId: branch!.id, code: 'J-99', name: 'Jaula prueba', status: 'cleaning' }
    });
    const ok = await request(app)
      .patch(`/api/v1/hospitalizations/beds/${bed.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'available' });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('available');

    const other = await request(app)
      .patch(`/api/v1/hospitalizations/beds/${bed.id}/status`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .send({ status: 'available' });
    expect(other.status).toBe(404);
    await prisma.hospitalBed.delete({ where: { id: bed.id } });
  });

  it('el portal no confunde tutores que solo comparten los últimos dígitos', async () => {
    // Laura (creada arriba) tiene 3005556677; este tutor comparte los últimos 7 dígitos
    await prisma.tutor.create({
      data: { clinicId, firstName: 'Otro', lastName: 'Tutor', phone: '3115556677' }
    });
    const partial = await request(app).post('/api/v1/portal/auth/magic-link').send({ phone: '300' });
    expect(partial.status).toBe(400);

    const exact = await request(app).post('/api/v1/portal/auth/magic-link').send({ phone: '+57 300 555 6677' });
    expect(exact.status).toBe(200);
    const token = new URL(exact.body.magicLink).searchParams.get('token')!;
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(payload.id).toBe(tutorId);
  });

  it('carga el perfil del paseador por su usuario', async () => {
    const res = await request(app)
      .get(`/api/v1/walkers/by-user/${walkerUserId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(walkerUserId);
  });
});
