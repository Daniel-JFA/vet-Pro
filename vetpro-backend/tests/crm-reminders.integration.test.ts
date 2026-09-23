import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { PatientSpecies, PatientSex, ServiceModality, AppointmentStatus } from '@prisma/client';

describe('CRM & WhatsApp Automated Reminders (Integration Tests)', () => {
  let clinicId: string;
  let branchId: string;
  let adminToken: string;
  let vetToken: string;
  let patientId: string;
  let tutorId: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Crear Clínica
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica CRM ${timestamp}`,
        phone: '3009990011',
        email: `clinic_crm_${timestamp}@test.com`,
        address: 'Calle 53 # 10-20',
        city: 'Bogotá',
        plan: 'pro'
      }
    });
    clinicId = clinic.id;

    // 2. Crear Sede
    const branch = await prisma.branch.create({
      data: {
        clinicId,
        name: 'Sede CRM Norte',
        address: 'Calle 53 # 10-20',
        phone: '3009990011'
      }
    });
    branchId = branch.id;

    // 3. Crear Admin
    const admin = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Admin',
        lastName: 'CRM',
        email: `admin_crm_${timestamp}@test.com`,
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

    // 4. Crear Vet
    const vet = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Dra. Liliana',
        lastName: 'Gómez',
        email: `vet_crm_${timestamp}@test.com`,
        passwordHash: 'dummy',
        role: 'vet'
      }
    });
    vetToken = TokenService.signStaff({
      id: vet.id,
      email: vet.email,
      role: 'vet',
      clinicId,
      branchId
    });

    // 5. Crear Tutor y Paciente
    const tutor = await prisma.tutor.create({
      data: {
        clinicId,
        firstName: 'Andrés',
        lastName: 'Giraldo',
        phone: '3112233445',
        email: `tutor_${timestamp}@example.com`
      }
    });
    tutorId = tutor.id;

    const patient = await prisma.patient.create({
      data: {
        clinicId,
        tutorId: tutor.id,
        name: 'Zeus',
        species: PatientSpecies.dog,
        sex: PatientSex.male
      }
    });
    patientId = patient.id;

    // 6. Crear Cita programada para MAÑANA (para probar recordatorios de mañana)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 30, 0, 0);

    await prisma.appointment.create({
      data: {
        clinicId,
        branchId,
        patientId: patient.id,
        vetId: vet.id,
        serviceType: 'Consulta Preventiva Canina',
        modality: ServiceModality.clinic,
        scheduledAt: tomorrow,
        status: AppointmentStatus.scheduled,
        reason: 'Control anual y refuerzo'
      }
    });

    // 7. Crear Vacuna con fecha próxima en 3 días (para probar recordatorio de vacunas)
    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 3);

    await prisma.vaccine.create({
      data: {
        patientId: patient.id,
        vetId: vet.id,
        name: 'Rabia Canina Anual',
        appliedAt: new Date(Date.now() - 360 * 24 * 60 * 60 * 1000),
        nextDueAt: nextDue,
        batch: 'LOTE-2026-X'
      }
    });
  });

  afterAll(async () => {
    try {
      await prisma.crmCampaign.deleteMany({ where: { clinicId } });
      await prisma.vaccine.deleteMany({ where: { patientId } });
      await prisma.appointment.deleteMany({ where: { clinicId } });
      await prisma.patient.deleteMany({ where: { clinicId } });
      await prisma.tutor.deleteMany({ where: { clinicId } });
      await prisma.branch.deleteMany({ where: { clinicId } });
      await prisma.user.deleteMany({ where: { clinicId } });
      await prisma.clinic.delete({ where: { id: clinicId } });
    } catch (e) {
      // Ignorar en cleanup
    }
  });

  describe('1. Consulta de Cohortes y Segmentación CRM', () => {
    it('debe calcular cohortes de CRM con resumen de ingresos potenciales', async () => {
      const res = await request(app)
        .get('/api/v1/crm/cohorts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary).toHaveProperty('totalInactive');
      expect(res.body.summary).toHaveProperty('potentialRecoverableRevenue');
      expect(Array.isArray(res.body.inactiveCohort)).toBe(true);
      expect(Array.isArray(res.body.vaccineCohort)).toBe(true);
    });
  });

  describe('2. Lanzamiento de Campañas de Reactivación', () => {
    it('debe generar campaña masiva con enlaces de WhatsApp para los tutores objetivo', async () => {
      const res = await request(app)
        .post('/api/v1/crm/broadcast')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Campaña Reactivación Preventiva 2026',
          targetType: 'birthday',
          channel: 'whatsapp',
          templateBody: 'Hola {nombre_tutor}, feliz mes de cumpleaños para {nombre_mascota}! En {nombre_clinica} tenemos {descuento} en su chequeo.',
          discountPercent: 15
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('campaign');
      expect(res.body.campaign.name).toBe('Campaña Reactivación Preventiva 2026');
      expect(Array.isArray(res.body.sampleDispatches)).toBe(true);
    });
  });

  describe('3. Recordatorios Automáticos de WhatsApp (Citas de Mañana y Vacunas)', () => {
    it('debe detectar la cita de mañana y generar el enlace de WhatsApp estructurado', async () => {
      const res = await request(app)
        .get('/api/v1/crm/reminders/upcoming')
        .set('Authorization', `Bearer ${vetToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body.summary.appointmentsTomorrowCount).toBeGreaterThanOrEqual(1);
      expect(res.body.summary.vaccinesUpcomingCount).toBeGreaterThanOrEqual(1);

      // Validar recordatorio de cita
      const appointmentReminder = res.body.appointments.find((a: any) => a.patientName === 'Zeus');
      expect(appointmentReminder).toBeDefined();
      expect(appointmentReminder.tutorName).toBe('Andrés');
      expect(appointmentReminder.phone).toBe('573112233445');
      expect(appointmentReminder.whatsappUrl).toContain('wa.me');
      expect(decodeURIComponent(appointmentReminder.whatsappUrl)).toContain('Zeus');
      expect(decodeURIComponent(appointmentReminder.whatsappUrl)).toContain('10:30');

      // Validar recordatorio de vacuna
      const vaccineReminder = res.body.vaccines.find((v: any) => v.patientName === 'Zeus');
      expect(vaccineReminder).toBeDefined();
      expect(vaccineReminder.vaccineName).toBe('Rabia Canina Anual');
      expect(vaccineReminder.whatsappUrl).toContain('wa.me');
      expect(decodeURIComponent(vaccineReminder.whatsappUrl)).toContain('Rabia Canina Anual');
    });

    it('debe rechazar la consulta de recordatorios si no hay token de autenticación', async () => {
      const res = await request(app).get('/api/v1/crm/reminders/upcoming');
      expect(res.status).toBe(401);
    });
  });
});
