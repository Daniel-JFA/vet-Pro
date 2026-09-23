import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';

describe('Marketplace Web de Veterinarios (Integration Tests)', () => {
  let clinicId: string;
  let adminUserToken: string;
  let vetUserToken: string;
  let vetUserId: string;
  let createdVetProfileId: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Crear Clínica para pruebas
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica Marketplace ${timestamp}`,
        phone: '3009998877',
        email: `clinic_market_${timestamp}@test.com`,
        address: 'Carrera 7 # 72-10',
        city: 'Bogotá',
        plan: 'pro'
      }
    });
    clinicId = clinic.id;

    // 2. Crear Admin
    const adminUser = await prisma.user.create({
      data: {
        clinicId,
        firstName: 'Admin',
        lastName: 'Market',
        email: `admin_market_${timestamp}@test.com`,
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
        firstName: 'Liliana',
        lastName: 'Veterinaria',
        email: `vet_market_${timestamp}@test.com`,
        passwordHash: 'dummy_hash',
        role: 'vet'
      }
    });
    vetUserId = vetUser.id;
    vetUserToken = TokenService.signStaff({
      id: vetUser.id,
      email: vetUser.email,
      role: 'vet',
      clinicId,
      branchId: null
    });
  });

  afterAll(async () => {
    // Limpieza
    try {
      if (createdVetProfileId) {
        await prisma.vetReview.deleteMany({ where: { vetProfileId: createdVetProfileId } });
        await prisma.vetProfile.delete({ where: { id: createdVetProfileId } }).catch(() => {});
      }
      await prisma.user.deleteMany({ where: { clinicId } });
      await prisma.clinic.delete({ where: { id: clinicId } });
    } catch (e) {
      // Ignorar errores de cascada en cleanup
    }
  });

  it('1. El veterinario puede obtener y autogenerar su perfil privado', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/profile/me')
      .set('Authorization', `Bearer ${vetUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body.userId).toBe(vetUserId);
    expect(res.body.verificationStatus).toBe('pending');
    expect(res.body.isPublic).toBe(false);

    createdVetProfileId = res.body.id;
  });

  it('2. El veterinario actualiza su perfil (especialidades, tarifas, zonas, matrícula)', async () => {
    const res = await request(app)
      .put('/api/v1/marketplace/profile/me')
      .set('Authorization', `Bearer ${vetUserToken}`)
      .send({
        professionalCard: 'COMVEZCOL-98765-CO',
        bio: 'Especialista en medicina interna felina y canina con 8 años de experiencia.',
        specialties: ['Medicina Felina', 'Dermatología'],
        modalities: ['domicilio', 'consultorio'],
        consultationPrice: 60000,
        homeVisitPrice: 90000,
        city: 'Bogotá',
        coverageZones: ['Chapinero', 'Usaquén', 'Suba'],
        whatsappNumber: '+573001234567',
        isPublic: false // Aún no es público hasta ser verificado
      });

    expect(res.status).toBe(200);
    expect(res.body.professionalCard).toBe('COMVEZCOL-98765-CO');
    expect(res.body.consultationPrice).toBe(60000);
    expect(res.body.specialties).toContain('Medicina Felina');
  });

  it('3. El directorio público NO lista veterinarios no verificados o privados', async () => {
    const res = await request(app).get('/api/v1/marketplace/vets');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    const found = res.body.data.some((v: any) => v.id === createdVetProfileId);
    expect(found).toBe(false);
  });

  it('4. El administrador puede consultar perfiles pendientes de verificación', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/admin/verifications')
      .set('Authorization', `Bearer ${adminUserToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.some((v: any) => v.id === createdVetProfileId);
    expect(found).toBe(true);
  });

  it('5. El administrador aprueba la verificación COMVEZCOL del veterinario', async () => {
    const res = await request(app)
      .put(`/api/v1/marketplace/admin/verifications/${createdVetProfileId}`)
      .set('Authorization', `Bearer ${adminUserToken}`)
      .send({
        status: 'verified',
        notes: 'Matrícula COMVEZCOL verificada con éxito en el registro nacional.'
      });

    expect(res.status).toBe(200);
    expect(res.body.profile.verificationStatus).toBe('verified');
    expect(res.body.profile.isPublic).toBe(true);
  });

  it('6. El directorio público ahora muestra al veterinario verificado con filtros', async () => {
    const res = await request(app)
      .get('/api/v1/marketplace/vets')
      .query({ city: 'Bogotá', specialty: 'Medicina Felina' });

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const vet = res.body.data.find((v: any) => v.id === createdVetProfileId);
    expect(vet).toBeDefined();
    expect(vet.user.firstName).toBe('Liliana');
    expect(vet.consultationPrice).toBe(60000);
  });

  it('7. Un tutor puede ver el detalle público y calificar con estrellas y reseña', async () => {
    // 7.1 Detalle público
    const detailRes = await request(app).get(`/api/v1/marketplace/vets/${createdVetProfileId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.id).toBe(createdVetProfileId);

    // 7.2 Crear reseña
    const reviewRes = await request(app)
      .post(`/api/v1/marketplace/vets/${createdVetProfileId}/reviews`)
      .send({
        tutorName: 'Camilo Pérez',
        rating: 5,
        comment: 'Excelente atención a domicilio para mi gata Luna. Muy profesional y puntual.',
        serviceType: 'domicilio'
      });

    expect(reviewRes.status).toBe(201);
    expect(reviewRes.body.review.rating).toBe(5);
    expect(reviewRes.body.newRating).toBe(5);
    expect(reviewRes.body.newCount).toBe(1);

    // 7.3 Verificar que el detalle ahora incluye la reseña y el rating
    const updatedDetail = await request(app).get(`/api/v1/marketplace/vets/${createdVetProfileId}`);
    expect(updatedDetail.body.rating).toBe(5);
    expect(updatedDetail.body.reviewCount).toBe(1);
    expect(updatedDetail.body.reviews.length).toBe(1);
    expect(updatedDetail.body.reviews[0].tutorName).toBe('Camilo Pérez');
  });
});
