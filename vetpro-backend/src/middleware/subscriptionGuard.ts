import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database.js';
import { TokenService } from '../services/token.service.js';
import { getClinicAccess } from '../services/subscription-access.service.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Rutas que deben seguir funcionando con la suscripción vencida: iniciar sesión,
// pagar la suscripción, la plataforma, el portal del tutor y el marketplace
// (el perfil Pro Vet tiene su propia membresía).
const EXEMPT_PREFIXES = ['/auth', '/subscriptions', '/platform', '/portal', '/marketplace', '/geo'];

/**
 * Deja en solo lectura a las clínicas con la suscripción vencida más allá de la gracia.
 * Se monta en /api/v1 antes de las rutas. Si no hay token de staff válido no hace nada:
 * la autenticación de cada ruta decide.
 */
export const subscriptionGuard = async (req: Request, res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method) || EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next();
  }

  let clinicId: string;
  try {
    clinicId = TokenService.verifyStaff(authHeader.split(' ')[1]).clinicId;
  } catch {
    return next();
  }

  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { subscriptionStatus: true, trialEndsAt: true, nextBillingDate: true, createdAt: true }
    });
    if (!clinic) {
      return next();
    }

    const access = getClinicAccess(clinic);
    if (access.readOnly) {
      return res.status(402).json({
        error: 'La suscripción de la clínica está vencida. Puedes consultar y exportar tu información; para crear o modificar registros, renueva el plan.',
        code: 'SUBSCRIPTION_EXPIRED',
        expiresAt: access.expiresAt
      });
    }
    next();
  } catch (error) {
    next(error);
  }
};
