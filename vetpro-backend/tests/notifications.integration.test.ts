import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { PatientSpecies, PatientSex, ServiceModality, AppointmentStatus } from '@prisma/client';

describe('Notifications & Automated Templates (Integration Tests)', () => {
  let clinicId: string;
  let otherClinicId: string;
  let branchId: string;
  let adminToken: string;
  let otherAdminToken: string;
  let patientId: string;
  let tutorId: string;
  let appointmentId: string;
  let createdTemplateId: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Crear Clínica Principal
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Notif ${timestamp}`,
        phone: '3008889900',
        email: `clinic_notif_${timestamp}@test.com`,
        address: 'Calle 100 # 15-20',
        city: 'Bogotá',
        plan: 'pro'
      }
    });
    clinicId = clinic.id;

    // 2. Crear Otra Clínica (Tenant Secundario)
    const otherClinic = await prisma.clinic.create({
      data: {
        name: `Clínica Rival Notif ${timestamp}`,
        phone: '3110002233',
        email: `rival_notif_${timestamp}@test.com`,
        address: 'Carrera 7 # 45-10',
        city: 'Medellín',
        plan: 'starter'
      }
    });
    otherClinicId = otherClinic.id;

    // 3. Crear Sede
    const branch = await prisma.branch.create({
      data: {
        clinicId,
        name: 'Sede Notif Central',
        address: 'Calle 100 # 15-20',
        phone: '3008889900'
      }
    });
    branchId = branch.id;

    // 4. Crear Tokens
    const admin = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Admin',
        lastName: 'Notificaciones',
        email: `admin_notif_${timestamp}@test.com`,
        passwordHash: 'dummy',
        role: 'admin'
      }
    });
    adminToken = TokenService.signStaff({
      id: admin.id,
      email: admin.email,
      role: 'admin',
      clinicId,
      branchId
    });

    const otherAdmin = await prisma.user.create({
      data: {
        clinicId: otherClinicId,
        firstName: 'Admin',
        lastName: 'Rival',
        email: `rival_admin_${timestamp}@test.com`,
        passwordHash: 'dummy',
        role: 'admin'
      }
    });
    otherAdminToken = TokenService.signStaff({
      id: otherAdmin.id,
      email: otherAdmin.email,
      role: 'admin',
      clinicId: otherClinicId
    });

    // 5. Crear Tutor y Paciente
    const tutor = await prisma.tutor.create({
      data: {
        clinicId,
        firstName: 'Mariana',
        lastName: 'Pérez',
        phone: '3109998877',
        email: `mariana_${timestamp}@test.com`,
        address: 'Calle 100 # 15-20'
      }
    });
    tutorId = tutor.id;

    const patient = await prisma.patient.create({
      data: {
        clinicId,
        tutorId,
        name: 'Zeus',
        species: PatientSpecies.dog,
        breed: 'Husky',
        sex: PatientSex.male,
        birthDate: new Date('2022-01-10')
      }
    });
    patientId = patient.id;

    // 6. Crear Cita programada para mañana
    const now = new Date();
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0, 0);

    const appt = await prisma.appointment.create({
      data: {
        clinicId,
        branchId,
        patientId,
        vetId: admin.id,
        serviceType: 'Consulta General',
        modality: ServiceModality.clinic,
        scheduledAt: tomorrow,
        durationMinutes: 30,
        status: AppointmentStatus.scheduled,
        reason: 'Chequeo anual y desparasitación'
      }
    });
    appointmentId = appt.id;
  });

  afterAll(async () => {
    await prisma.notificationLog.deleteMany({ where: { clinicId } });
    await prisma.notificationTemplate.deleteMany({ where: { clinicId } });
    await prisma.notificationTemplate.deleteMany({ where: { clinicId: otherClinicId } });
    await prisma.appointment.deleteMany({ where: { clinicId } });
    await prisma.patient.deleteMany({ where: { clinicId } });
    await prisma.tutor.deleteMany({ where: { clinicId } });
    await prisma.user.deleteMany({ where: { clinicId } });
    await prisma.user.deleteMany({ where: { clinicId: otherClinicId } });
    await prisma.branch.deleteMany({ where: { clinicId } });
    await prisma.clinic.deleteMany({ where: { id: { in: [clinicId, otherClinicId] } } });
  });

  it('1. GET /api/v1/notifications/templates debe autosembrar plantillas por defecto si la clínica es nueva', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.data.length).toBeGreaterThanOrEqual(4);
    expect(res.body.data.some((t: any) => t.trigger === 'appointment_reminder_24h')).toBe(true);
  });

  it('2. POST /api/v1/notifications/templates debe crear una plantilla personalizada', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/templates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Recordatorio VIP Especial',
        trigger: 'custom',
        channel: 'whatsapp',
        body: 'Hola {{nombre_tutor}}, recordatorio VIP para {{nombre_mascota}}.',
        active: true
      });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Recordatorio VIP Especial');
    expect(res.body.data.clinicId).toBe(clinicId);
    createdTemplateId = res.body.data.id;
  });

  it('3. PUT /api/v1/notifications/templates/:id debe editar el contenido de una plantilla', async () => {
    const res = await request(app)
      .put(`/api/v1/notifications/templates/${createdTemplateId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Recordatorio VIP Actualizado',
        body: 'Nuevo texto para {{nombre_tutor}} y {{nombre_mascota}}.'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Recordatorio VIP Actualizado');
    expect(res.body.data.body).toContain('Nuevo texto');
  });

  it('4. PATCH /api/v1/notifications/templates/:id/toggle debe alternar el estado activo/inactivo', async () => {
    const res = await request(app)
      .patch(`/api/v1/notifications/templates/${createdTemplateId}/toggle`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.active).toBe(false);
  });

  it('5. POST /api/v1/notifications/dispatch-reminders debe procesar citas de mañana y registrar logs en PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/dispatch-reminders')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.dispatchedCount).toBeGreaterThanOrEqual(1);
    expect(res.body.dispatched.some((d: any) => d.appointmentId === appointmentId)).toBe(true);

    // Verificar persistencia en base de datos
    const dbLog = await prisma.notificationLog.findFirst({
      where: { clinicId, appointmentId }
    });
    expect(dbLog).toBeDefined();
    expect(dbLog?.recipientPhone).toBe('3109998877');
    expect(dbLog?.status).toBe('delivered');
  });

  it('6. GET /api/v1/notifications/logs debe listar el historial enriquecido con nombre de paciente y tutor', async () => {
    const res = await request(app)
      .get('/api/v1/notifications/logs')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    const logEntry = res.body.data.find((l: any) => l.appointmentId === appointmentId);
    expect(logEntry).toBeDefined();
    expect(logEntry.patientName).toBe('Zeus');
    expect(logEntry.recipientName).toContain('Mariana Pérez');
  });

  it('7. Aislamiento Multi-Tenant: otra clínica no debe ver los logs ni editar plantillas de esta clínica', async () => {
    // Otra clínica consultando sus logs (debe tener 0)
    const logsRes = await request(app)
      .get('/api/v1/notifications/logs')
      .set('Authorization', `Bearer ${otherAdminToken}`);

    expect(logsRes.status).toBe(200);
    expect(logsRes.body.total).toBe(0);

    // Otra clínica intentando editar la plantilla de la primera clínica
    const editRes = await request(app)
      .put(`/api/v1/notifications/templates/${createdTemplateId}`)
      .set('Authorization', `Bearer ${otherAdminToken}`)
      .send({ name: 'Hack intento' });

    expect(editRes.status).toBe(404);
  });

  it('8. DELETE /api/v1/notifications/templates/:id debe eliminar la plantilla personalizada', async () => {
    const res = await request(app)
      .delete(`/api/v1/notifications/templates/${createdTemplateId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const deleted = await prisma.notificationTemplate.findUnique({
      where: { id: createdTemplateId }
    });
    expect(deleted).toBeNull();
  });
});
