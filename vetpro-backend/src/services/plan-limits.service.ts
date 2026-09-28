import { PlanType } from '@prisma/client';
import { prisma } from '../config/database.js';

// Máximo de usuarios activos y sedes activas por plan (Sprint 14.4). null = ilimitado.
// Refleja lo que prometen hoy los planes en /suscripcion; el reempaque de planes
// (historia 14.5) debe actualizar esta tabla junto con PLAN_PRICING.
export const PLAN_LIMITS: Record<PlanType, { users: number | null; branches: number | null }> = {
  [PlanType.starter]: { users: 1, branches: 1 },
  [PlanType.pro]: { users: 6, branches: 2 },
  [PlanType.clinic]: { users: 6, branches: 1 },
  [PlanType.enterprise]: { users: null, branches: null }
};

const PLAN_NAMES: Record<PlanType, string> = {
  [PlanType.starter]: 'Starter',
  [PlanType.pro]: 'Pro',
  [PlanType.clinic]: 'Clínica',
  [PlanType.enterprise]: 'Enterprise'
};

async function getPlan(clinicId: string): Promise<PlanType> {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { plan: true } });
  if (!clinic) throw { status: 404, message: 'Clínica no encontrada.' };
  return clinic.plan;
}

export class PlanLimitsService {
  // Antes de crear o reactivar un usuario
  static async assertCanAddUser(clinicId: string): Promise<void> {
    const plan = await getPlan(clinicId);
    const max = PLAN_LIMITS[plan].users;
    if (max === null) return;

    const active = await prisma.user.count({ where: { clinicId, active: true } });
    if (active >= max) {
      throw {
        status: 403,
        message: `El plan ${PLAN_NAMES[plan]} permite hasta ${max} ${max === 1 ? 'usuario activo' : 'usuarios activos'}. Desactiva un usuario o mejora el plan en Suscripción para agregar más.`
      };
    }
  }

  // Antes de crear una sede
  static async assertCanAddBranch(clinicId: string): Promise<void> {
    const plan = await getPlan(clinicId);
    const max = PLAN_LIMITS[plan].branches;
    if (max === null) return;

    const active = await prisma.branch.count({ where: { clinicId, active: true } });
    if (active >= max) {
      throw {
        status: 403,
        message: `El plan ${PLAN_NAMES[plan]} permite hasta ${max} ${max === 1 ? 'sede' : 'sedes'}. Mejora el plan en Suscripción para abrir otra.`
      };
    }
  }
}
