import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { platformAuthMiddleware, PlatformAuthRequest } from '../middleware/platformAuth.js';
import { TokenService } from '../services/token.service.js';

const router = Router();

// POST /platform/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }

  try {
    const admin = await prisma.platformAdmin.findUnique({ where: { email } });

    if (!admin || !admin.active) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = TokenService.signPlatform({ id: admin.id, email: admin.email, role: 'platform_admin' });

    return res.json({
      token,
      admin: { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName }
    });
  } catch (error) {
    console.error('Error en /platform/auth/login:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /platform/auth/me
router.get('/auth/me', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdmin!.id } });
  if (!admin) return res.status(404).json({ error: 'Super-administrador no encontrado.' });
  return res.json({ id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName });
});

// GET /platform/stats (totales agregados de toda la plataforma)
router.get('/stats', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    const [clinicsCount, usersCount, patientsCount, appointmentsCount] = await Promise.all([
      prisma.clinic.count(),
      prisma.user.count(),
      prisma.patient.count(),
      prisma.appointment.count()
    ]);

    return res.json({ clinicsCount, usersCount, patientsCount, appointmentsCount });
  } catch (error) {
    console.error('Error en /platform/stats:', error);
    return res.status(500).json({ error: 'Error al calcular estadísticas de la plataforma.' });
  }
});

// GET /platform/clinics (lista de tenants con conteo de usuarios y pacientes, sin data clínica)
router.get('/clinics', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        businessType: true,
        plan: true,
        email: true,
        city: true,
        createdAt: true,
        _count: {
          select: { users: true, patients: true, branches: true, tutors: true }
        }
      }
    });

    return res.json(clinics.map(c => ({
      id: c.id,
      name: c.name,
      businessType: c.businessType,
      plan: c.plan,
      email: c.email,
      city: c.city,
      createdAt: c.createdAt,
      usersCount: c._count.users,
      patientsCount: c._count.patients,
      branchesCount: c._count.branches,
      tutorsCount: c._count.tutors
    })));
  } catch (error) {
    console.error('Error en /platform/clinics:', error);
    return res.status(500).json({ error: 'Error al consultar los tenants de la plataforma.' });
  }
});

// GET /platform/subscriptions/stats (Métricas SaaS: MRR, ARR, conteo de planes y estados)
router.get('/subscriptions/stats', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    const clinics = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        subscriptionStatus: true,
        billingCycle: true,
        nextBillingDate: true,
        createdAt: true
      }
    });

    const activeCount = clinics.filter(c => c.subscriptionStatus === 'active').length;
    const trialCount = clinics.filter(c => c.subscriptionStatus === 'trial').length;
    const pastDueCount = clinics.filter(c => c.subscriptionStatus === 'past_due').length;
    const suspendedCount = clinics.filter(c => c.subscriptionStatus === 'suspended').length;

    // Precios mensuales base
    const priceMap: Record<string, number> = {
      starter: 80000,
      pro: 150000,
      enterprise: 300000
    };

    // Calcular MRR (Monthly Recurring Revenue) de clínicas activas
    const mrr = clinics
      .filter(c => c.subscriptionStatus === 'active')
      .reduce((sum, c) => sum + (priceMap[c.plan] || 0), 0);

    const arr = mrr * 12;

    return res.json({
      mrr,
      arr,
      totalClinics: clinics.length,
      activeCount,
      trialCount,
      pastDueCount,
      suspendedCount,
      planBreakdown: {
        starter: clinics.filter(c => c.plan === 'starter').length,
        pro: clinics.filter(c => c.plan === 'pro').length,
        enterprise: clinics.filter(c => c.plan === 'enterprise').length
      }
    });
  } catch (error) {
    console.error('Error en /platform/subscriptions/stats:', error);
    return res.status(500).json({ error: 'Error al calcular métricas de suscripciones.' });
  }
});

// POST /platform/subscriptions/clinics/:id/grant-extension (Extender días de prueba o cortesía)
router.post('/subscriptions/clinics/:id/grant-extension', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  const { id } = req.params;
  const { days = 14, notes } = req.body;

  try {
    const clinic = await prisma.clinic.findUnique({ where: { id } });
    if (!clinic) return res.status(404).json({ error: 'Clínica no encontrada.' });

    const currentExpiry = clinic.nextBillingDate || clinic.trialEndsAt || new Date();
    const newExpiry = new Date(currentExpiry.getTime() + (parseInt(days, 10) || 14) * 24 * 60 * 60 * 1000);

    const updated = await prisma.clinic.update({
      where: { id },
      data: {
        subscriptionStatus: 'active',
        nextBillingDate: newExpiry,
        trialEndsAt: newExpiry
      }
    });

    console.log(`[Platform Admin] Extensión de ${days} días concedida a clínica ${clinic.name}. Nueva fecha: ${newExpiry.toISOString()}`);
    return res.json({
      message: `Extensión de ${days} días otorgada exitosamente.`,
      clinic: updated
    });
  } catch (error) {
    console.error('Error en /platform/subscriptions/grant-extension:', error);
    return res.status(500).json({ error: 'Error al otorgar extensión de suscripción.' });
  }
});

export const PLATFORM_ROUTES = router;
