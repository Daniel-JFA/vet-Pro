import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { PatientSpecies, PatientSex, ServiceModality, AppointmentStatus, GroomingStatus, RecordType } from '@prisma/client';

describe('Comprehensive System Verification — Full Stack End-to-End Audit', () => {
  let clinicId: string;
  let branchId: string;
  let adminToken: string;
  let vetToken: string;
  let vetUserId: string;
  let tutorId: string;
  let patientId: string;
  let appointmentId: string;
  let invoiceId: string;
  let groomingId: string;
  let vetProfileId: string;

  const timestamp = Date.now();

  beforeAll(async () => {
    // 1. Crear Clínica y Sede en PostgreSQL
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Auditoría Total ${timestamp}`,
        phone: '3007778899',
        email: `audit_${timestamp}@vetpro.test`,
        address: 'Carrera 43A # 1-50',
        city: 'Medellín',
        plan: 'pro'
      }
    });
    clinicId = clinic.id;

    const branch = await prisma.branch.create({
      data: {
        clinicId,
        name: 'Sede Poblado',
        address: 'Carrera 43A # 1-50',
        phone: '3007778899'
      }
    });
    branchId = branch.id;

    // 2. Crear Usuarios (Admin y Vet)
    const admin = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Doctora',
        lastName: 'Liliana',
        email: `liliana_admin_${timestamp}@vetpro.test`,
        passwordHash: 'hashed_secret_test',
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

    const vet = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Andrés',
        lastName: 'Veterinario',
        email: `vet_andres_${timestamp}@vetpro.test`,
        passwordHash: 'hashed_secret_test',
        role: 'vet'
      }
    });
    vetUserId = vet.id;
    vetToken = TokenService.signStaff({
      id: vet.id,
      email: vet.email,
      role: 'vet',
      clinicId,
      branchId
    });

    // 3. Crear Tutor y Paciente base en PostgreSQL
    const tutor = await prisma.tutor.create({
      data: {
        clinicId,
        firstName: 'Carlos',
        lastName: 'Gómez',
        documentId: `CC-${timestamp}`,
        phone: '3015551234',
        email: `carlos_${timestamp}@gmail.com`,
        address: 'Calle 10 # 20-30, Medellín'
      }
    });
    tutorId = tutor.id;

    const patient = await prisma.patient.create({
      data: {
        clinicId,
        tutorId,
        name: 'Max',
        species: PatientSpecies.dog,
        breed: 'Golden Retriever',
        sex: PatientSex.male,
        birthDate: new Date('2023-01-15T00:00:00.000Z'),
        weight: 28.5
      }
    });
    patientId = patient.id;
  });

  afterAll(async () => {
    try {
      if (clinicId) {
        await prisma.vaccine.deleteMany({ where: { patient: { clinicId } } });
        await prisma.marketplacePayment.deleteMany({ where: { clinicId } });
        await prisma.vetReview.deleteMany({ where: { vetProfile: { clinicId } } });
        await prisma.vetProfile.deleteMany({ where: { clinicId } });
        await prisma.invoicePayment.deleteMany({ where: { invoice: { clinicId } } });
        await prisma.invoiceItem.deleteMany({ where: { invoice: { clinicId } } });
        await prisma.invoice.deleteMany({ where: { clinicId } });
        await prisma.groomingService.deleteMany({ where: { clinicId } });
        await prisma.medicalRecord.deleteMany({ where: { clinicId } });
        await prisma.appointment.deleteMany({ where: { clinicId } });
        await prisma.patient.deleteMany({ where: { clinicId } });
        await prisma.tutor.deleteMany({ where: { clinicId } });
        await prisma.user.deleteMany({ where: { clinicId } });
        await prisma.branch.deleteMany({ where: { clinicId } });
        await prisma.clinic.delete({ where: { id: clinicId } });
      }
    } catch {
      // Ignorar si hay cascada
    }
  });

  // ─────────────────────────────────────────────
  // 1. HEALTH & INFRAESTRUCTURA
  // ─────────────────────────────────────────────
  it('1. Endpoint de Salud (/api/health) responde 200 y servicio activo', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('VetPro SaaS API');
  });

  // ─────────────────────────────────────────────
  // 2. TUTORES Y PACIENTES
  // ─────────────────────────────────────────────
  it('2. Creación y persistencia de Paciente vía API en PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/v1/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tutorId,
        name: 'Toby',
        species: PatientSpecies.cat,
        breed: 'Criollo',
        sex: PatientSex.male,
        birthDate: '2024-02-10T00:00:00.000Z',
        weight: 4.5
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();

    // Verificación directa en base de datos PostgreSQL
    const dbPatient = await prisma.patient.findUnique({
      where: { id: res.body.id },
      include: { tutor: true }
    });
    expect(dbPatient).not.toBeNull();
    expect(dbPatient?.name).toBe('Toby');
    expect(dbPatient?.species).toBe(PatientSpecies.cat);
    expect(dbPatient?.tutor.firstName).toBe('Carlos');
  });

  // ─────────────────────────────────────────────
  // 3. CITAS & CICLO KANBAN
  // ─────────────────────────────────────────────
  it('3. Agendamiento y ciclo de estados de Cita en PostgreSQL (scheduled -> waiting -> in_progress -> done)', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);

    const createRes = await request(app)
      .post('/api/v1/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId,
        branchId,
        vetId: vetUserId,
        scheduledAt: tomorrow.toISOString(),
        modality: ServiceModality.home_visit,
        serviceType: 'Consulta Médica General Domiciliaria',
        amountCharged: 85000,
        notes: 'Paciente presenta decaimiento'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    appointmentId = createRes.body.id;

    // Verificar en BD estado inicial
    let dbApp = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(dbApp?.status).toBe(AppointmentStatus.scheduled);
    expect(dbApp?.modality).toBe(ServiceModality.home_visit);

    // Transición: en espera / en camino
    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${vetToken}`)
      .send({ status: 'waiting' });

    dbApp = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(dbApp?.status).toBe(AppointmentStatus.waiting);

    // Transición: en atención
    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${vetToken}`)
      .send({ status: 'in-progress' });

    dbApp = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(dbApp?.status).toBe(AppointmentStatus.in_progress);

    // Transición: completada
    await request(app)
      .patch(`/api/v1/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${vetToken}`)
      .send({ status: 'done' });

    dbApp = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    expect(dbApp?.status).toBe(AppointmentStatus.done);
  });

  // ─────────────────────────────────────────────
  // 4. NÚCLEO CLÍNICO: BITÁCORA SOAP
  // ─────────────────────────────────────────────
  it('4. Creación y persistencia de Historia Clínica SOAP en PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/v1/medical-records')
      .set('Authorization', `Bearer ${vetToken}`)
      .send({
        patientId,
        appointmentId,
        type: RecordType.consultation,
        title: 'Consulta Médica Domiciliaria - Valoración General',
        anamnesis: 'Tutor refiere inapetencia desde hace 24 horas',
        physicalExam: 'Temperatura: 38.6°C, mucosas rosadas, ganglios normales',
        diagnosis: 'Gastroenteritis leve autolimitada',
        treatment: 'Hidratación oral + Probióticos por 5 días',
        observations: 'Control en caso de persistir vómito',
        weight: 28.5
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();

    // Verificación en PostgreSQL
    const dbRecord = await prisma.medicalRecord.findFirst({
      where: { appointmentId }
    });
    expect(dbRecord).not.toBeNull();
    expect(dbRecord?.diagnosis).toBe('Gastroenteritis leve autolimitada');
    expect(dbRecord?.patientId).toBe(patientId);
  });

  // ─────────────────────────────────────────────
  // 5. FACTURACIÓN & PAGOS POS
  // ─────────────────────────────────────────────
  it('5. Facturación de Cita y Registro de Pagos con balance en PostgreSQL', async () => {
    // Factura vinculada a la cita
    const invRes = await request(app)
      .post('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        tutorId,
        branchId,
        appointmentId,
        items: [
          {
            description: 'Consulta Domiciliaria Veterinaria',
            quantity: 1,
            unitPrice: 85000,
            taxRate: 0, // Exenta de IVA
            discount: 0
          }
        ],
        notes: 'Factura generada en 1 clic desde Kanban'
      });

    expect(invRes.status).toBe(201);
    expect(invRes.body.id).toBeDefined();
    invoiceId = invRes.body.id;

    // Verificar en BD factura pendiente
    let dbInvoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(dbInvoice?.total).toBe(85000);
    expect(dbInvoice?.status).toBe('draft');

    // Registrar Pago Total vía Nequi
    const payRes = await request(app)
      .patch(`/api/v1/billing/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 85000,
        method: 'Nequi'
      });

    expect(payRes.status).toBe(200);

    // Verificar en BD factura pagada
    dbInvoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true }
    });
    expect(dbInvoice?.status).toBe('paid');
    expect(dbInvoice?.amountPaid).toBe(85000);
    expect(dbInvoice?.payments.length).toBe(1);
    expect(dbInvoice?.payments[0].method).toBe('Nequi');
  });

  // ─────────────────────────────────────────────
  // 6. PELUQUERÍA & SPA (GROOMING)
  // ─────────────────────────────────────────────
  it('6. Módulo de Grooming & Spa guardando en PostgreSQL', async () => {
    const createRes = await request(app)
      .post('/api/v1/grooming')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId,
        branchId,
        serviceType: 'Baño medicado e hidratación de pelaje',
        coatCondition: 'Bueno',
        price: 55000,
        notes: 'Mascota dócil'
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    groomingId = createRes.body.id;

    // Verificar en BD
    let dbGrooming = await prisma.groomingService.findUnique({ where: { id: groomingId } });
    expect(dbGrooming?.status).toBe(GroomingStatus.checked_in);
    expect(dbGrooming?.price).toBe(55000);

    // Actualizar estado a Listo para entrega
    const updateRes = await request(app)
      .patch(`/api/v1/grooming/${groomingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: GroomingStatus.ready_for_pickup });

    expect(updateRes.status).toBe(200);
    dbGrooming = await prisma.groomingService.findUnique({ where: { id: groomingId } });
    expect(dbGrooming?.status).toBe(GroomingStatus.ready_for_pickup);
  });

  // ─────────────────────────────────────────────
  // 7. IMPORTADOR MASIVO CSV / EXCEL
  // ─────────────────────────────────────────────
  it('7. Importación masiva CSV creando pacientes y deduplicando tutores en PostgreSQL', async () => {
    const res = await request(app)
      .post('/api/v1/patients/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          {
            name: 'Rocky',
            species: 'dog',
            breed: 'Bulldog',
            sex: 'male',
            weight: 22.0,
            tutorFirstName: 'Carlos',
            tutorLastName: 'Gómez',
            tutorPhone: '3015551234',
            tutorEmail: `carlos_${timestamp}@gmail.com`,
            tutorDocument: `CC-${timestamp}`,
            tutorAddress: 'Calle 10 # 20-30'
          },
          {
            name: 'Luna',
            species: 'cat',
            breed: 'Siamés',
            sex: 'female',
            weight: 4.2,
            tutorFirstName: 'María',
            tutorLastName: 'Pérez',
            tutorPhone: '3108889900',
            tutorEmail: `maria_${timestamp}@gmail.com`,
            tutorDocument: `CC-MAR-${timestamp}`,
            tutorAddress: 'Carrera 70 # 30-10'
          }
        ]
      });

    expect(res.status).toBe(200);
    expect(res.body.data.imported).toBe(2);

    // Verificar persistencia de Luna y Rocky en PostgreSQL
    const luna = await prisma.patient.findFirst({
      where: { clinicId, name: 'Luna' },
      include: { tutor: true }
    });
    expect(luna).not.toBeNull();
    expect(luna?.species).toBe(PatientSpecies.cat);
    expect(luna?.tutor.firstName).toBe('María');
  });

  // ─────────────────────────────────────────────
  // 8. MARKETPLACE: ONBOARDING & PERFIL DEL VETERINARIO
  // ─────────────────────────────────────────────
  it('8. Creación y actualización de VetProfile en PostgreSQL con comisiones y dispersión', async () => {
    const res = await request(app)
      .put('/api/v1/marketplace/profile/me')
      .set('Authorization', `Bearer ${vetToken}`)
      .send({
        professionalCard: 'COMVEZCOL-98765',
        bio: 'Especialista en medicina canina y felina con más de 8 años de experiencia en atención domiciliaria.',
        consultationPrice: 60000,
        homeVisitPrice: 85000,
        city: 'Medellín',
        whatsappNumber: '573007778899',
        payoutBank: 'Bancolombia',
        payoutAccount: '123-456789-01',
        isPublic: true,
        specialties: ['Medicina General', 'Medicina Felina', 'Dermatología'],
        modalities: ['domicilio', 'consultorio'],
        coverageZones: ['El Poblado', 'Laureles', 'Envigado']
      });

    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
    vetProfileId = res.body.id;

    // Verificar en PostgreSQL
    const dbProfile = await prisma.vetProfile.findUnique({ where: { id: vetProfileId } });
    expect(dbProfile).not.toBeNull();
    expect(dbProfile?.professionalCard).toBe('COMVEZCOL-98765');
    expect(dbProfile?.payoutBank).toBe('Bancolombia');
    expect(dbProfile?.verificationStatus).toBe('pending');
  });

  // ─────────────────────────────────────────────
  // 9. MARKETPLACE: VERIFICACIÓN KYC COMVEZCOL (ADMIN)
  // ─────────────────────────────────────────────
  it('9. Auditoría y Aprobación COMVEZCOL por el Administrador guardando en PostgreSQL', async () => {
    const res = await request(app)
      .put(`/api/v1/marketplace/admin/verifications/${vetProfileId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'verified',
        notes: 'Tarjeta profesional validada exitosamente en registro nacional COMVEZCOL'
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.verificationStatus).toBe('verified');

    // Verificar en PostgreSQL
    const dbProfile = await prisma.vetProfile.findUnique({ where: { id: vetProfileId } });
    expect(dbProfile?.verificationStatus).toBe('verified');
  });

  // ─────────────────────────────────────────────
  // 10. MARKETPLACE: DIRECTORIO PÚBLICO
  // ─────────────────────────────────────────────
  it('10. Búsqueda pública en Directorio Web (/api/v1/marketplace/vets) sin autenticación', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/vets')
      .query({ city: 'Medellín' });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    const foundVet = res.body.data.find((v: any) => v.id === vetProfileId);
    expect(foundVet).toBeDefined();
    expect(foundVet.user.firstName).toBe('Andrés');
    expect(foundVet.verificationStatus).toBe('verified');
  });

  // ─────────────────────────────────────────────
  // 11. MARKETPLACE: AGENDAMIENTO WEB ÁGIL (TUTOR NO REGISTRADO)
  // ─────────────────────────────────────────────
  it('11. Solicitud de Cita Web por Tutor creando registros automáticos en PostgreSQL', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const res = await request(app)
      .post(`/api/v1/marketplace/vets/${vetProfileId}/appointments`)
      .send({
        tutorName: 'Santiago Vélez',
        tutorPhone: '3124445566',
        tutorEmail: `santiago_${timestamp}@gmail.com`,
        patientName: 'Kira',
        patientSpecies: 'dog',
        modality: 'home_visit',
        scheduledAt: `${dateStr}T15:00:00.000Z`,
        address: 'Calle 10 sur # 20-30, Medellín',
        reason: 'Vacunación y chequeo general'
      });

    expect(res.status).toBe(201);
    expect(res.body.appointmentId).toBeDefined();
    expect(res.body.whatsappUrl).toContain('https://wa.me/');
    expect(res.body.amountCharged).toBe(85000); // Tarifa de domicilio configurada

    // Verificar en PostgreSQL que se crearon Tutor, Paciente y Cita vinculados
    const dbApp = await prisma.appointment.findUnique({
      where: { id: res.body.appointmentId },
      include: { patient: { include: { tutor: true } } }
    });

    expect(dbApp).not.toBeNull();
    expect(dbApp?.patient?.name).toBe('Kira');
    expect(dbApp?.patient?.tutor.firstName).toBe('Santiago');
    expect(dbApp?.status).toBe(AppointmentStatus.scheduled);
  });

  // ─────────────────────────────────────────────
  // 12. MARKETPLACE: RESEÑAS CON ESTRELLAS & RECÁLCULO
  // ─────────────────────────────────────────────
  it('12. Envío de Reseña y recálculo transaccional de promedio en PostgreSQL', async () => {
    const res = await request(app)
      .post(`/api/v1/marketplace/vets/${vetProfileId}/reviews`)
      .send({
        tutorName: 'Santiago Vélez',
        rating: 5,
        comment: 'Excelente médico, puntual y muy cariñoso con Kira.',
        serviceType: 'Consulta a Domicilio'
      });

    expect(res.status).toBe(201);
    expect(res.body.newRating).toBe(5);
    expect(res.body.newCount).toBe(1);

    // Verificar en PostgreSQL
    const dbReview = await prisma.vetReview.findFirst({
      where: { vetProfileId }
    });
    expect(dbReview).not.toBeNull();
    expect(dbReview?.rating).toBe(5);

    const dbProfile = await prisma.vetProfile.findUnique({ where: { id: vetProfileId } });
    expect(dbProfile?.rating).toBe(5);
    expect(dbProfile?.reviewCount).toBe(1);
  });

  // ─────────────────────────────────────────────
  // 13. MARKETPLACE: BALANCE DE INGRESOS Y COMISIÓN 15%
  // ─────────────────────────────────────────────
  it('13. Cálculo exacto de ingresos brutos, comisión VetPro (15%) e ingresos netos (85%)', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/profile/earnings')
      .set('Authorization', `Bearer ${vetToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalAppointments).toBeGreaterThanOrEqual(1);
    expect(res.body.grossRevenue).toBeGreaterThanOrEqual(85000);
    expect(res.body.platformFeeRate).toBe(0.15);
    expect(res.body.platformFee).toBe(Math.round(res.body.grossRevenue * 0.15));
    expect(res.body.netEarnings).toBe(res.body.grossRevenue - res.body.platformFee);
  });

  // ─────────────────────────────────────────────
  // 14. CRM: RECORDATORIOS AUTOMÁTICOS WHATSAPP
  // ─────────────────────────────────────────────
  it('14. Detección de Citas de Mañana y Vacunas en CRM (/api/v1/crm/reminders/upcoming)', async () => {
    // Agregar cita para mañana
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    tomorrowDate.setHours(11, 0, 0, 0);

    await prisma.appointment.create({
      data: {
        clinicId,
        branchId,
        patientId,
        vetId: vetUserId,
        scheduledAt: tomorrowDate,
        status: AppointmentStatus.scheduled,
        serviceType: 'Control Post-Operatorio',
        modality: ServiceModality.clinic
      }
    });

    // Agregar una vacuna por vencer en 3 días para Max
    const inThreeDays = new Date();
    inThreeDays.setDate(inThreeDays.getDate() + 3);

    await prisma.vaccine.create({
      data: {
        patientId,
        vetId: vetUserId,
        name: 'Rabia Anual',
        appliedAt: new Date(),
        nextDueAt: inThreeDays,
        batch: 'LOTE-RB-2026'
      }
    });

    const res = await request(app)
      .get('/api/v1/crm/reminders/upcoming')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.appointmentsTomorrowCount).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.vaccinesUpcomingCount).toBeGreaterThanOrEqual(1);

    // Verificar estructura de mensajes WhatsApp
    const appReminder = res.body.appointments[0];
    expect(appReminder.whatsappUrl).toContain('https://wa.me/');
    expect(appReminder.message).toContain('🐾 *¡Hola');

    const vacReminder = res.body.vaccines[0];
    expect(vacReminder.whatsappUrl).toContain('https://wa.me/');
    expect(vacReminder.message).toContain('Rabia Anual');
  });

  // ─────────────────────────────────────────────
  // 15. PASARELA WOMPI, COMPROBANTE (VOUCHER) Y PRO VET
  // ─────────────────────────────────────────────
  it('15. Flujo integral Wompi Colombia: Checkout, Webhook, Comprobante Digital y Membresía Pro Vet', async () => {
    // 1. Iniciar checkout Wompi para la cita del marketplace
    const checkoutRes = await request(app)
      .post(`/api/v1/marketplace/appointments/${appointmentId}/checkout`);

    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.publicKey).toBeDefined();
    expect(checkoutRes.body.reference).toMatch(/^VP-APT-/);
    expect(checkoutRes.body.amount).toBe(85000);
    expect(checkoutRes.body.platformFee).toBe(12750); // 15% de 85.000 = 12.750
    expect(checkoutRes.body.vetAmount).toBe(72250);   // 85% de 85.000 = 72.250
    expect(checkoutRes.body.signatureIntegrity).toBeDefined();

    const paymentRef = checkoutRes.body.reference;

    // 2. Procesar evento de pago aprobado vía webhook Wompi
    const webhookRes = await request(app)
      .post('/api/v1/marketplace/payments/webhook')
      .send({
        event: 'transaction.updated',
        data: {
          transaction: {
            id: `WOMPI-VERIF-${Date.now()}`,
            reference: paymentRef,
            status: 'APPROVED',
            amount_in_cents: 8500000,
            currency: 'COP',
            payment_method_type: 'PSE'
          }
        },
        sent_at: new Date().toISOString(),
        timestamp: Math.floor(Date.now() / 1000)
      });

    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body.success).toBe(true);
    expect(webhookRes.body.processed).toBe(true);

    // 3. Consultar Comprobante Digital Oficial (Voucher)
    const voucherRes = await request(app)
      .get(`/api/v1/marketplace/appointments/${appointmentId}/voucher`);

    expect(voucherRes.status).toBe(200);
    expect(voucherRes.body.pricing.paymentStatus).toBe('paid');
    expect(voucherRes.body.pricing.paymentMethod).toBe('PSE');
    expect(voucherRes.body.pricing.totalAmount).toBe(85000);
    expect(voucherRes.body.security.voucherHash).toBeDefined();

    // 4. Activar Membresía Pro Vet ($49.000 COP) para el veterinario
    const subRes = await request(app)
      .post('/api/v1/marketplace/profile/subscription')
      .set('Authorization', `Bearer ${vetToken}`)
      .send({ instantActivate: true });

    expect(subRes.status).toBe(201);
    expect(subRes.body.success).toBe(true);
    expect(subRes.body.checkout.amount).toBe(49000);

    // 5. Verificar que el perfil ahora cuenta con el distintivo ⭐ Pro Vet activo
    const mySubRes = await request(app)
      .get('/api/v1/marketplace/profile/subscription')
      .set('Authorization', `Bearer ${vetToken}`);

    expect(mySubRes.status).toBe(200);
    expect(mySubRes.body.isFeatured).toBe(true);
    expect(mySubRes.body.isActive).toBe(true);
    expect(mySubRes.body.subscriptionStatus).toBe('active');
  });
});
