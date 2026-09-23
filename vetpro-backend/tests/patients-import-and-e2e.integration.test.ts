import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';

describe('Sprint 5 & End-to-End Workflow Integration Tests', () => {
  let clinicId: string;
  let adminUserToken: string;
  let vetUserToken: string;
  let walkerUserToken: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Crear Clínica para pruebas
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Test E2E ${timestamp}`,
        phone: '3001112233',
        email: `clinic_e2e_${timestamp}@test.com`,
        address: 'Calle 100 # 15-20',
        city: 'Bogotá',
        plan: 'pro'
      }
    });
    clinicId = clinic.id;

    // 1.1 Crear Sucursal para la clínica
    await prisma.branch.create({
      data: {
        clinicId,
        name: 'Sede Principal',
        address: 'Calle 100 # 15-20',
        phone: '3001112233'
      }
    });

    // 2. Crear Admin
    const adminUser = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Admin',
        lastName: 'E2E',
        email: `admin_e2e_${timestamp}@test.com`,
        passwordHash: 'dummy_hash',
        role: 'admin'
      }
    });
    adminUserToken = TokenService.signStaff({
      id: adminUser.id,
      email: adminUser.email,
      role: 'admin',
      clinicId,
      branchId: null
    });

    // 3. Crear Vet
    const vetUser = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Veterinario',
        lastName: 'E2E',
        email: `vet_e2e_${timestamp}@test.com`,
        passwordHash: 'dummy_hash',
        role: 'vet'
      }
    });
    vetUserToken = TokenService.signStaff({
      id: vetUser.id,
      email: vetUser.email,
      role: 'vet',
      clinicId,
      branchId: null
    });

    // 4. Crear Walker (Paseador - no tiene permisos front-desk ni de facturación)
    const walkerUser = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Paseador',
        lastName: 'E2E',
        email: `walker_e2e_${timestamp}@test.com`,
        passwordHash: 'dummy_hash',
        role: 'walker'
      }
    });
    walkerUserToken = TokenService.signStaff({
      id: walkerUser.id,
      email: walkerUser.email,
      role: 'walker',
      clinicId,
      branchId: null
    });
  });

  afterAll(async () => {
    try {
      await prisma.invoiceItem.deleteMany({ where: { invoice: { clinicId } } });
      await prisma.payment.deleteMany({ where: { clinicId } });
      await prisma.invoice.deleteMany({ where: { clinicId } });
      await prisma.medicalRecord.deleteMany({ where: { clinicId } });
      await prisma.appointment.deleteMany({ where: { clinicId } });
      await prisma.patient.deleteMany({ where: { clinicId } });
      await prisma.tutor.deleteMany({ where: { clinicId } });
      await prisma.user.deleteMany({ where: { clinicId } });
      await prisma.clinic.delete({ where: { id: clinicId } });
    } catch (e) {
      // Ignorar en cleanup
    }
  });

  describe('1. Importador Masivo de Pacientes y Tutores (Sprint 5.2)', () => {
    it('debe rechazar la importación si el rol no tiene permisos (ej. walker)', async () => {
      const res = await request(app)
        .post('/api/v1/patients/import')
        .set('Authorization', `Bearer ${walkerUserToken}`)
        .send({
          items: [
            {
              name: 'Firulais',
              species: 'perro',
              tutorFirstName: 'Juan',
              tutorPhone: '3001234567'
            }
          ]
        });

      expect(res.status).toBe(403);
    });

    it('debe rechazar un payload vacío o sin pacientes requeridos', async () => {
      const res = await request(app)
        .post('/api/v1/patients/import')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send({ items: [] });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('debe importar pacientes normalizando especies/sexos y deduplicando tutores por documento', async () => {
      const batchPayload = {
        items: [
          {
            name: 'Rocky',
            species: 'canino',
            breed: 'Bulldog Francés',
            sex: 'macho',
            sterilized: true,
            weight: 12.5,
            tutorFirstName: 'Carlos',
            tutorLastName: 'Pérez',
            tutorPhone: '3105551122',
            tutorDocument: 'CC-10203040',
            tutorEmail: 'carlos.perez@example.com',
            tutorAddress: 'Calle 123 # 45-67'
          },
          {
            name: 'Mishi',
            species: 'felino',
            breed: 'Siamés',
            sex: 'hembra',
            sterilized: false,
            weight: 3.8,
            // Mismo tutor (mismo documento CC-10203040): debe asociarse al mismo Tutor
            tutorFirstName: 'Carlos',
            tutorLastName: 'Pérez',
            tutorPhone: '3105551122',
            tutorDocument: 'CC-10203040',
            tutorEmail: 'carlos.perez@example.com'
          },
          {
            name: 'Tambor',
            species: 'conejo',
            breed: 'Cabeza de León',
            sex: 'macho',
            tutorFirstName: 'Lucía',
            tutorLastName: 'Gómez',
            tutorPhone: '3209876543',
            tutorDocument: 'CC-90807060',
            tutorEmail: 'lucia.gomez@example.com'
          }
        ]
      };

      const res = await request(app)
        .post('/api/v1/patients/import')
        .set('Authorization', `Bearer ${adminUserToken}`)
        .send(batchPayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(3);
      expect(res.body.data.imported).toBe(3);
      expect(res.body.data.errors.length).toBe(0);

      // Verificar en base de datos: Deben existir exactamente 2 tutores y 3 pacientes en esta clínica
      const tutorsInClinic = await prisma.tutor.findMany({ where: { clinicId } });
      expect(tutorsInClinic.length).toBe(2);

      const carlosTutor = tutorsInClinic.find(t => t.documentId === 'CC-10203040');
      expect(carlosTutor).toBeDefined();

      const luciaTutor = tutorsInClinic.find(t => t.documentId === 'CC-90807060');
      expect(luciaTutor).toBeDefined();

      const patientsInClinic = await prisma.patient.findMany({ where: { clinicId } });
      expect(patientsInClinic.length).toBe(3);

      const rocky = patientsInClinic.find(p => p.name === 'Rocky');
      expect(rocky?.species).toBe('dog');
      expect(rocky?.sex).toBe('male');
      expect(rocky?.tutorId).toBe(carlosTutor?.id);

      const mishi = patientsInClinic.find(p => p.name === 'Mishi');
      expect(mishi?.species).toBe('cat');
      expect(mishi?.sex).toBe('female');
      expect(mishi?.tutorId).toBe(carlosTutor?.id);

      const tambor = patientsInClinic.find(p => p.name === 'Tambor');
      expect(tambor?.species).toBe('rabbit');
      expect(tambor?.tutorId).toBe(luciaTutor?.id);
    });
  });

  describe('2. Flujo Completo Consulta Clínica → Facturación en 1 Clic', () => {
    let patientId: string;
    let tutorId: string;
    let appointmentId: string;

    it('2.1 Agenda una cita para el paciente importado', async () => {
      const patient = await prisma.patient.findFirst({ where: { clinicId, name: 'Rocky' } });
      expect(patient).toBeDefined();
      patientId = patient!.id;
      tutorId = patient!.tutorId;

      const res = await request(app)
        .post('/api/v1/appointments')
        .set('Authorization', `Bearer ${vetUserToken}`)
        .send({
          patientId,
          serviceType: 'Consulta General Canina',
          scheduledAt: new Date(Date.now() + 3600000).toISOString(),
          durationMinutes: 30,
          reason: 'Chequeo preventivo semestral',
          modality: 'clinic'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      appointmentId = res.body.id;
    });

    it('2.2 Registra historia clínica y nota SOAP para la consulta', async () => {
      const res = await request(app)
        .post('/api/v1/medical-records')
        .set('Authorization', `Bearer ${vetUserToken}`)
        .send({
          patientId,
          appointmentId,
          title: 'Consulta General Preventiva',
          subjective: 'Tutor refiere que el perro está activo y come con apetito normal.',
          objective: 'FC: 110 lpm, FR: 24 rpm, T: 38.5°C, Mucosas rosadas.',
          assessment: 'Paciente sano en excelente condición corporal (3/5).',
          plan: 'Continuar con dieta habitual y desparasitación cada 3 meses.',
          diagnosis: 'Paciente sano / Control de rutina'
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
    });

    it('2.3 Genera factura pre-poblada con ítem de consulta y abono total', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${vetUserToken}`)
        .send({
          tutorId,
          appointmentId,
          notes: 'Facturación directa de consulta clínica',
          items: [
            {
              description: 'Consulta Médica General Canina',
              quantity: 1,
              unitPrice: 65000,
              taxRate: 0
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.total).toBe(65000);
      expect(res.body.balance).toBe(65000);
      expect(res.body.status).toBe('draft');

      // Registrar pago directo de la factura
      const payRes = await request(app)
        .patch(`/api/v1/billing/invoices/${res.body.id}/pay`)
        .set('Authorization', `Bearer ${vetUserToken}`)
        .send({
          amount: 65000,
          method: 'Efectivo',
          reference: 'PAGO-EFECTIVO-001'
        });

      expect(payRes.status).toBe(200);
      expect(payRes.body.status).toBe('paid');
      expect(payRes.body.amountPaid).toBe(65000);
      expect(payRes.body.balance).toBe(0);
    });
  });
});
