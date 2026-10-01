import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { prisma } from '../src/config/database.js';
import { AUTH_ROUTES } from '../src/routes/auth.routes.js';
import { MARKETPLACE_ROUTES } from '../src/routes/marketplace.routes.js';
import { PLATFORM_ROUTES } from '../src/routes/platform.routes.js';
import { TokenService } from '../src/services/token.service.js';
import { ComvezcolService } from '../src/services/comvezcol.service.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/v1/auth', AUTH_ROUTES);
app.use('/api/v1/marketplace', MARKETPLACE_ROUTES);
app.use('/api/v1/platform', PLATFORM_ROUTES);

describe('Antifraud Verification System (COMVEZCOL Registration & KYC)', () => {
  const timestamp = Date.now();
  let municipioId: string;
  let adminToken: string;
  let testClinicId: string;
  let testAdminUserId: string;

  const testCardNumber = `COMVEZCOL-${timestamp}`;

  beforeAll(async () => {
    // 1. Obtener o crear municipio
    let depto = await prisma.departamento.findFirst();
    if (!depto) {
      depto = await prisma.departamento.create({
        data: { code: '11', nombre: 'Bogotá D.C.' }
      });
    }

    let mun = await prisma.municipio.findFirst({ where: { deptoCode: depto.code } });
    if (!mun) {
      mun = await prisma.municipio.create({
        data: { id: '11001', deptoCode: depto.code, nombre: 'Bogotá, D.C.' }
      });
    }
    municipioId = mun.id;

    // 2. Crear clínica y usuario administrador para auditoría
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Auditora ${timestamp}`,
        email: `auditor_${timestamp}@vetpro.test`,
        phone: '+57 300 000 0000',
        address: 'Calle Auditoría 123',
        city: 'Bogotá'
      }
    });
    testClinicId = clinic.id;

    const adminUser = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        firstName: 'Auditor',
        lastName: 'COMVEZCOL',
        email: `auditor_${timestamp}@vetpro.test`,
        passwordHash: 'dummyhash',
        role: 'admin'
      }
    });
    testAdminUserId = adminUser.id;

    adminToken = TokenService.signStaff({
      id: adminUser.id,
      email: adminUser.email,
      role: 'admin',
      clinicId: clinic.id
    });
  });

  afterAll(async () => {
    // Limpieza
    await prisma.vetProfile.deleteMany({
      where: {
        OR: [
          { professionalCard: testCardNumber },
          { user: { email: { contains: `${timestamp}` } } }
        ]
      }
    });
    await prisma.user.deleteMany({
      where: { email: { contains: `${timestamp}` } }
    });
    await prisma.branch.deleteMany({
      where: { clinicId: testClinicId }
    });
    await prisma.clinic.deleteMany({
      where: { id: testClinicId }
    });
  });

  it('1. Registro de veterinario independiente DEBE fallar si no incluye tarjeta profesional COMVEZCOL', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        clinicName: `Dr. Vet Sin Tarjeta ${timestamp}`,
        businessType: 'independent_vet',
        firstName: 'Carlos',
        lastName: 'Pérez',
        email: `vet_sin_tp_${timestamp}@vetpro.test`,
        password: 'Password123*',
        phone: '+57 300 111 2233',
        municipioId,
        documentType: 'CC',
        documentNumber: '1020304050'
        // professionalCard omitido intencionalmente
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('tarjeta profesional');
  });

  it('2. Registro de veterinario independiente DEBE ser exitoso con tarjeta profesional y crear VetProfile pendiente de auditoría antifraude', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        clinicName: `Dr. Andrés Veterinario ${timestamp}`,
        businessType: 'independent_vet',
        firstName: 'Andrés',
        lastName: 'Gómez',
        email: `vet_andres_${timestamp}@vetpro.test`,
        password: 'Password123*',
        phone: '+57 300 222 3344',
        municipioId,
        documentType: 'CC',
        documentNumber: '1035800000',
        professionalCard: testCardNumber
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toContain('antifraude');
    expect(res.body.user).toBeDefined();
    expect(res.body.user.professionalCard).toBe(testCardNumber);
    expect(res.body.user.verificationStatus).toBe('pending');

    // Verificar en base de datos
    const profile = await prisma.vetProfile.findUnique({
      where: { userId: res.body.user.id }
    });
    expect(profile).not.toBeNull();
    expect(profile?.professionalCard).toBe(testCardNumber);
    expect(profile?.verificationStatus).toBe('pending');
    expect(profile?.isPublic).toBe(false);
  });

  it('3. Alerta antifraude: intentar registrar otro veterinario con la misma tarjeta profesional COMVEZCOL debe rechazar con 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        clinicName: `Dr. Suplantador ${timestamp}`,
        businessType: 'independent_vet',
        firstName: 'Falso',
        lastName: 'Médico',
        email: `impostor_${timestamp}@vetpro.test`,
        password: 'Password123*',
        phone: '+57 300 999 8877',
        municipioId,
        documentType: 'CC',
        documentNumber: '99887766',
        professionalCard: testCardNumber // MISMA tarjeta
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Alerta antifraude');
    expect(res.body.error).toContain('ya se encuentra registrada');
  });

  const platformToken = () => TokenService.signPlatform({ id: 'platform-test', email: 'platform@vetpro.test' } as any);

  // Admin de la clínica propia del veterinario independiente registrado en el test 2
  async function ownClinicAdminToken() {
    const profile = await prisma.vetProfile.findFirstOrThrow({ where: { professionalCard: testCardNumber } });
    return {
      profile,
      token: TokenService.signStaff({ id: profile.userId, email: 'vet_andres@test.com', role: 'admin', clinicId: profile.clinicId })
    };
  }

  it('4. El panel administrativo GET /admin/verificaciones debe incluir datos de documento y metadata antifraude COMVEZCOL', async () => {
    // Un admin de otra clínica no ve los perfiles ajenos
    const other = await request(app)
      .get('/api/v1/marketplace/admin/verifications')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(other.status).toBe(200);
    expect(other.body.find((p: any) => p.professionalCard === testCardNumber)).toBeUndefined();

    const { token } = await ownClinicAdminToken();
    const res = await request(app)
      .get('/api/v1/marketplace/admin/verifications')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const vetItem = res.body.find((p: any) => p.professionalCard === testCardNumber);
    expect(vetItem).toBeDefined();
    expect(vetItem.user.documentType).toBe('CC');
    expect(vetItem.user.documentNumber).toBe('1035800000');
    expect(vetItem.antifraud).toBeDefined();
    expect(vetItem.antifraud.hasValidCard).toBe(true);
    expect(vetItem.antifraud.hasIdNumber).toBe(true);
    expect(vetItem.antifraud.comvezcolQueryUrl).toContain('comvezcol.org');
  });

  it('5. Solo VetPro (plataforma) aprueba la verificación COMVEZCOL: perfil pasa a verificado y se hace público', async () => {
    const { profile, token } = await ownClinicAdminToken();

    // Ni la propia clínica ni otra pueden aprobar: el endpoint de clínica es solo lectura
    for (const t of [token, adminToken]) {
      const denied = await request(app)
        .put(`/api/v1/marketplace/admin/verifications/${profile.id}`)
        .set('Authorization', `Bearer ${t}`)
        .send({ status: 'verified' });
      expect(denied.status).toBe(404);
      const deniedPlatform = await request(app)
        .put(`/api/v1/platform/verifications/${profile.id}`)
        .set('Authorization', `Bearer ${t}`)
        .send({ status: 'verified' });
      expect(deniedPlatform.status).toBe(401);
    }

    const res = await request(app)
      .put(`/api/v1/platform/verifications/${profile.id}`)
      .set('Authorization', `Bearer ${platformToken()}`)
      .send({
        status: 'verified',
        notes: 'Tarjeta profesional COMVEZCOL validada exitosamente en el registro nacional.'
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.verificationStatus).toBe('verified');
    expect(res.body.profile.isPublic).toBe(true);
    expect(res.body.profile.verifiedBy).toBe('platform:platform-test');
  });

  it('6. Si el veterinario modifica su tarjeta profesional, debe reactivarse la revisión antifraude (status: pending, isPublic: false)', async () => {
    const profile = await prisma.vetProfile.findFirst({
      where: { professionalCard: testCardNumber }
    });

    const vetToken = TokenService.signStaff({
      id: profile!.userId,
      email: 'vet_andres@test.com',
      role: 'vet',
      clinicId: profile!.clinicId
    });

    const newCardNumber = `COMVEZCOL-NEW-${timestamp}`;

    const res = await request(app)
      .put('/api/v1/marketplace/profile/me')
      .set('Authorization', `Bearer ${vetToken}`)
      .send({
        professionalCard: newCardNumber
      });

    expect(res.status).toBe(200);
    expect(res.body.professionalCard).toBe(newCardNumber);
    expect(res.body.verificationStatus).toBe('pending');
    expect(res.body.isPublic).toBe(false);
  });

  it('7. Endpoint administrativo POST /admin/verifications/auto-verify-all certifica automáticamente a los veterinarios registrados con tarjeta válida', async () => {
    const spy = vi.spyOn(ComvezcolService, 'verifyCard').mockResolvedValue({
      status: 'match',
      checkedAt: new Date().toISOString(),
      message: 'Coincide con registro oficial COMVEZCOL.'
    });

    // El admin de una clínica no puede dispararlo: afecta a todas las clínicas
    const denied = await request(app)
      .post('/api/v1/platform/verifications/auto-verify-all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(denied.status).toBe(401);

    const res = await request(app)
      .post('/api/v1/platform/verifications/auto-verify-all')
      .set('Authorization', `Bearer ${platformToken()}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary.totalChecked).toBeGreaterThanOrEqual(1);

    // Verificar que el perfil que estaba pendiente ahora está verificado
    const updatedProfile = await prisma.vetProfile.findFirst({
      where: { professionalCard: `COMVEZCOL-NEW-${timestamp}` }
    });
    expect(updatedProfile).toBeDefined();
    expect(updatedProfile!.verificationStatus).toBe('verified');
    expect(updatedProfile!.isPublic).toBe(true);
    expect(updatedProfile!.verifiedBy).toBe('system_comvezcol');

    spy.mockRestore();
  });
});
