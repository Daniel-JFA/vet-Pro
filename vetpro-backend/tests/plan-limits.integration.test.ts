import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';
import { PlanType } from '@prisma/client';

// Sprint 14.4: máximo de usuarios y sedes según el plan de la clínica.
describe('Límites por plan (Sprint 14.4)', () => {
  const clinicIds: string[] = [];

  async function createClinic(plan: PlanType, extraUsers: number) {
    const ts = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const clinic = await prisma.clinic.create({
      data: {
        name: `Clínica ${plan} ${ts}`,
        phone: '3100000000',
        email: `clinic_limits_${ts}@test.com`,
        address: 'Calle 1 # 2-3',
        city: 'Bogotá',
        plan
      }
    });
    clinicIds.push(clinic.id);
    await prisma.branch.create({ data: { clinicId: clinic.id, name: 'Sede Principal', address: 'Calle 1', phone: '3100000000' } });

    const admin = await prisma.user.create({
      data: { clinicId: clinic.id, firstName: 'Ana', lastName: 'Admin', email: `admin_limits_${ts}@test.com`, passwordHash: 'x', role: 'admin' }
    });
    for (let i = 0; i < extraUsers; i++) {
      await prisma.user.create({
        data: { clinicId: clinic.id, firstName: 'Aux', lastName: `${i}`, email: `aux${i}_limits_${ts}@test.com`, passwordHash: 'x', role: 'assistant' }
      });
    }
    const token = TokenService.signStaff({ id: admin.id, email: admin.email, role: 'admin', clinicId: clinic.id });
    return { clinic, token, ts };
  }

  const newUser = (ts: string, n: string) => ({
    firstName: 'Nuevo',
    lastName: 'Usuario',
    email: `nuevo_${n}_${ts}@test.com`,
    role: 'receptionist'
  });

  afterAll(async () => {
    try {
      await prisma.user.deleteMany({ where: { clinicId: { in: clinicIds } } });
      await prisma.branch.deleteMany({ where: { clinicId: { in: clinicIds } } });
      await prisma.clinic.deleteMany({ where: { id: { in: clinicIds } } });
    } catch {
      // Ignorar errores de cascada en cleanup
    }
  });

  it('crear el usuario 7 en el plan Clínica devuelve un mensaje de mejora de plan', async () => {
    const { token, ts } = await createClinic(PlanType.clinic, 5); // admin + 5 = 6 activos

    const res = await request(app).post('/api/v1/auth/users').set('Authorization', `Bearer ${token}`).send(newUser(ts, '7'));
    expect(res.status).toBe(403);
    expect(res.body.error).toContain('mejora el plan');
  });

  it('con cupo disponible el usuario se crea', async () => {
    const { token, ts } = await createClinic(PlanType.clinic, 4); // 5 activos

    const res = await request(app).post('/api/v1/auth/users').set('Authorization', `Bearer ${token}`).send(newUser(ts, '6'));
    expect(res.status).toBe(201);
  });

  it('reactivar un usuario también respeta el cupo', async () => {
    const { clinic, token } = await createClinic(PlanType.starter, 0); // solo el admin
    const inactive = await prisma.user.create({
      data: { clinicId: clinic.id, firstName: 'Ex', lastName: 'Usuario', email: `ex_${clinic.id}@test.com`, passwordHash: 'x', role: 'vet', active: false }
    });

    const res = await request(app).patch(`/api/v1/auth/users/${inactive.id}`).set('Authorization', `Bearer ${token}`).send({ active: true });
    expect(res.status).toBe(403);
  });

  it('Enterprise no tiene límite de usuarios', async () => {
    const { token, ts } = await createClinic(PlanType.enterprise, 8);

    const res = await request(app).post('/api/v1/auth/users').set('Authorization', `Bearer ${token}`).send(newUser(ts, 'ent'));
    expect(res.status).toBe(201);
  });

  it('el plan Pro permite 2 sedes y bloquea la tercera', async () => {
    const { token } = await createClinic(PlanType.pro, 0);
    const branch = { name: 'Sede Norte', address: 'Calle 170', phone: '3100000001' };

    const second = await request(app).post('/api/v1/branches').set('Authorization', `Bearer ${token}`).send(branch);
    expect(second.status).toBe(201);

    const third = await request(app).post('/api/v1/branches').set('Authorization', `Bearer ${token}`).send({ ...branch, name: 'Sede Sur' });
    expect(third.status).toBe(403);
    expect(third.body.error).toContain('2 sedes');
  });
});
