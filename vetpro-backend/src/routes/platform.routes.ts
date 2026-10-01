import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { platformAuthMiddleware, PlatformAuthRequest } from '../middleware/platformAuth.js';
import { TokenService } from '../services/token.service.js';
import { z } from 'zod';
import { VerificationStatus } from '@prisma/client';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { listVerificationProfiles, updateVerification } from '../services/vet-verification.service.js';
import { AntifraudService } from '../services/antifraud.service.js';

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
        subscriptionStatus: true,
        billingCycle: true,
        trialEndsAt: true,
        nextBillingDate: true,
        lastPaymentDate: true,
        featureFlags: true,
        _count: {
          select: { users: true, patients: true, branches: true, tutors: true }
        }
      }
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Agrupar citas recientes por clínica para medir adopción (uso activo)
    const recentActivity = await prisma.appointment.groupBy({
      by: ['clinicId'],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: { id: true }
    });
    
    const activityMap = new Map(recentActivity.map(a => [a.clinicId, a._count.id]));

    return res.json(clinics.map(c => {
      const recentAppointments = activityMap.get(c.id) || 0;
      
      // ALGORITMO DE SALUD (Health Score 0-100)
      let score = 0;
      
      // 1. Configuración básica (Tienen usuarios y sedes) = 20 pts
      if (c._count.users > 0) score += 10;
      if (c._count.branches > 0) score += 10;
      
      // 2. Adquisición de Pacientes = 30 pts
      if (c._count.patients > 50) score += 30;
      else if (c._count.patients > 10) score += 20;
      else if (c._count.patients > 0) score += 10;

      // 3. Uso Reciente (Han creado citas en los últimos 7 días) = 30 pts
      if (recentAppointments > 10) score += 30;
      else if (recentAppointments > 0) score += 15;

      // 4. Estado de la Suscripción = 20 pts
      if (c.subscriptionStatus === 'active') score += 20;
      else if (c.subscriptionStatus === 'trial') score += 15;
      else if (c.subscriptionStatus === 'past_due') score += 5;

      // Determinar Semáforo
      let status: 'green' | 'yellow' | 'red' = 'red';
      if (score >= 70) status = 'green';
      else if (score >= 40) status = 'yellow';

      return {
        id: c.id,
        name: c.name,
        businessType: c.businessType,
        plan: c.plan,
        email: c.email,
        city: c.city,
        createdAt: c.createdAt,
        subscriptionStatus: c.subscriptionStatus,
        billingCycle: c.billingCycle,
        trialEndsAt: c.trialEndsAt,
        nextBillingDate: c.nextBillingDate,
        lastPaymentDate: c.lastPaymentDate,
        featureFlags: c.featureFlags,
        usersCount: c._count.users,
        patientsCount: c._count.patients,
        branchesCount: c._count.branches,
        tutorsCount: c._count.tutors,
        healthScore: score,
        healthStatus: status,
        recentAppointments
      };
    }));
  } catch (error) {
    console.error('Error en /platform/clinics:', error);
    return res.status(500).json({ error: 'Error al consultar los tenants de la plataforma.' });
  }
});

// GET /platform/clinics/:id/users (usuarios de un tenant, con su último acceso)
router.get('/clinics/:id/users', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { clinicId: req.params.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        branch: { select: { name: true } }
      }
    });

    return res.json(users.map(u => ({
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      active: u.active,
      lastLoginAt: u.lastLoginAt,
      branchName: u.branch?.name || null
    })));
  } catch (error) {
    console.error('Error en /platform/clinics/:id/users:', error);
    return res.status(500).json({ error: 'Error al consultar los usuarios del tenant.' });
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

// GET /platform/analytics/overview (métricas agregadas para el panel de gráficas de super-admin)
router.get('/analytics/overview', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;

    // ── Crecimiento: registros por día (últimos 30 días) ──
    const growthWindowStart = new Date(now.getTime() - 29 * dayMs);
    const recentClinics = await prisma.clinic.findMany({
      where: { createdAt: { gte: growthWindowStart } },
      select: { createdAt: true }
    });
    const growthBuckets = new Map<string, number>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(growthWindowStart.getTime() + i * dayMs);
      growthBuckets.set(d.toISOString().slice(0, 10), 0);
    }
    for (const c of recentClinics) {
      const key = c.createdAt.toISOString().slice(0, 10);
      if (growthBuckets.has(key)) growthBuckets.set(key, (growthBuckets.get(key) || 0) + 1);
    }
    const growth = Array.from(growthBuckets.entries()).map(([date, count]) => ({ date, count }));

    // ── Ingresos: MRR/ARR actuales, breakdown de plan/estado, histórico de pagos aprobados (6 meses) ──
    const allClinics = await prisma.clinic.findMany({
      select: { id: true, plan: true, subscriptionStatus: true, trialEndsAt: true, nextBillingDate: true, name: true, email: true, createdAt: true }
    });
    const priceMap: Record<string, number> = { starter: 80000, pro: 150000, enterprise: 300000 };
    const mrr = allClinics.filter(c => c.subscriptionStatus === 'active').reduce((sum, c) => sum + (priceMap[c.plan] || 0), 0);

    const subscriptionBreakdown = {
      trial: allClinics.filter(c => c.subscriptionStatus === 'trial').length,
      active: allClinics.filter(c => c.subscriptionStatus === 'active').length,
      past_due: allClinics.filter(c => c.subscriptionStatus === 'past_due').length,
      suspended: allClinics.filter(c => c.subscriptionStatus === 'suspended').length,
      cancelled: allClinics.filter(c => c.subscriptionStatus === 'cancelled').length
    };
    const planBreakdown = {
      starter: allClinics.filter(c => c.plan === 'starter').length,
      pro: allClinics.filter(c => c.plan === 'pro').length,
      enterprise: allClinics.filter(c => c.plan === 'enterprise').length
    };

    const revenueWindowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const payments = await prisma.clinicSubscriptionPayment.findMany({
      where: { status: 'APPROVED', paidAt: { gte: revenueWindowStart } },
      select: { paidAt: true, amountInCents: true }
    });
    const revenueBuckets = new Map<string, number>();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      revenueBuckets.set(d.toISOString().slice(0, 7), 0);
    }
    for (const p of payments) {
      if (!p.paidAt) continue;
      const key = p.paidAt.toISOString().slice(0, 7);
      if (revenueBuckets.has(key)) revenueBuckets.set(key, (revenueBuckets.get(key) || 0) + p.amountInCents);
    }
    const monthlyRevenue = Array.from(revenueBuckets.entries()).map(([month, amountInCents]) => ({ month, amountInCents }));

    const renewalWindowEnd = new Date(now.getTime() + 7 * dayMs);
    const renewalsDue = allClinics
      .map(c => {
        const trialDate = c.trialEndsAt && c.subscriptionStatus === 'trial' ? c.trialEndsAt : null;
        const billingDate = c.nextBillingDate && c.subscriptionStatus === 'active' ? c.nextBillingDate : null;
        const expiresAt = trialDate || billingDate;
        if (!expiresAt || expiresAt < now || expiresAt > renewalWindowEnd) return null;
        return {
          id: c.id,
          name: c.name,
          email: c.email,
          expiresAt,
          type: trialDate ? 'trial' : 'billing',
          daysLeft: Math.ceil((expiresAt.getTime() - now.getTime()) / dayMs)
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // ── Engagement: activos recientes y tenants "dormidos" (sin ningún login) ──
    const [activeLast24h, activeLast7d, activeLast30d] = await Promise.all([
      prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - dayMs) } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 7 * dayMs) } } }),
      prisma.user.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 30 * dayMs) } } })
    ]);

    const dormantCutoff = new Date(now.getTime() - 3 * dayMs);
    const dormantClinics = await prisma.clinic.findMany({
      where: {
        createdAt: { lte: dormantCutoff },
        users: { none: { lastLoginAt: { not: null } } }
      },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    // ── Uso del producto: totales y ranking de clínicas más activas ──
    const clinicsWithUsage = await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { patients: true, Appointment: true, invoices: true, notificationLogs: true } }
      }
    });
    const usageTotals = clinicsWithUsage.reduce(
      (acc, c) => ({
        appointments: acc.appointments + c._count.Appointment,
        patients: acc.patients + c._count.patients,
        invoices: acc.invoices + c._count.invoices,
        notifications: acc.notifications + c._count.notificationLogs
      }),
      { appointments: 0, patients: 0, invoices: 0, notifications: 0 }
    );
    const topClinics = clinicsWithUsage
      .map(c => ({
        id: c.id,
        name: c.name,
        appointmentsCount: c._count.Appointment,
        patientsCount: c._count.patients,
        score: c._count.Appointment + c._count.patients
      }))
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // ── Geografía: clínicas por departamento ──
    const geoGroups = await prisma.clinic.groupBy({
      by: ['departamentoCode'],
      _count: { _all: true }
    });
    const departamentos = await prisma.departamento.findMany({ select: { code: true, nombre: true } });
    const deptoNameByCode = new Map(departamentos.map(d => [d.code, d.nombre]));
    const geography = geoGroups
      .map(g => ({
        label: g.departamentoCode ? (deptoNameByCode.get(g.departamentoCode) || g.departamentoCode) : 'Sin especificar',
        count: g._count._all
      }))
      .sort((a, b) => b.count - a.count);

    return res.json({
      growth,
      revenue: { mrr, arr: mrr * 12, planBreakdown, subscriptionBreakdown, monthlyRevenue, renewalsDue },
      engagement: { activeLast24h, activeLast7d, activeLast30d, dormantClinics },
      usage: { totals: usageTotals, topClinics },
      geography
    });
  } catch (error) {
    console.error('Error en /platform/analytics/overview:', error);
    return res.status(500).json({ error: 'Error al calcular las analíticas de la plataforma.' });
  }
});

// ─────────────────────────────────────────────
// VERIFICACIÓN COMVEZCOL (exclusivo del equipo de VetPro)
// ─────────────────────────────────────────────

// GET /platform/verifications — perfiles de todas las clínicas
router.get('/verifications', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    return res.json(await listVerificationProfiles());
  } catch (error) {
    console.error('[Platform] Error listando verificaciones:', error);
    return res.status(500).json({ error: 'Error al consultar solicitudes de verificación' });
  }
});

const VerifySchema = z.object({
  status: z.nativeEnum(VerificationStatus).optional(),
  notes: z.string().optional(),
  isFeatured: z.boolean().optional()
});

// PUT /platform/verifications/:id — aprobar, rechazar o destacar
router.put('/verifications/:id', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const input = VerifySchema.parse(req.body);
    const exists = await prisma.vetProfile.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Perfil no encontrado.' });
    const profile = await updateVerification(req.params.id, input, `platform:${req.platformAdmin!.id}`);
    return res.json({ message: 'Solicitud actualizada con éxito', profile });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.issues[0]?.message });
    console.error('[Platform] Error actualizando verificación:', error);
    return res.status(500).json({ error: 'Error al actualizar estado de verificación' });
  }
});

// POST /platform/verifications/auto-verify-all — certificación automática masiva
router.post('/verifications/auto-verify-all', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    const summary = await AntifraudService.verifyAllRegisteredVets();
    return res.json({ message: 'Proceso de certificación automática COMVEZCOL completado.', summary });
  } catch (error) {
    console.error('[Platform] Error en verificación automática:', error);
    return res.status(500).json({ error: 'Error durante la verificación automática masiva.' });
  }
});

// ─────────────────────────────────────────────
// TENANT MANAGEMENT (Acciones directas del Super Admin)
// ─────────────────────────────────────────────

// POST /platform/clinics/:id/change-plan
router.post('/clinics/:id/change-plan', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { plan, status, featureFlags } = req.body;

    const data: any = {};
    if (plan) data.plan = plan;
    if (status) data.subscriptionStatus = status;
    if (featureFlags !== undefined) data.featureFlags = featureFlags;

    const updated = await prisma.clinic.update({
      where: { id },
      data
    });

    return res.json({ message: 'Clínica actualizada con éxito', clinic: updated });
  } catch (error) {
    console.error('Error actualizando clínica:', error);
    return res.status(500).json({ error: 'Error al actualizar la clínica.' });
  }
});

// ─────────────────────────────────────────────
// ANUNCIOS GLOBALES (Platform Announcements)
// ─────────────────────────────────────────────

// GET /platform/announcements
router.get('/announcements', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const announcements = await prisma.platformAnnouncement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return res.json(announcements);
  } catch (error) {
    return res.status(500).json({ error: 'Error al listar anuncios.' });
  }
});

// POST /platform/announcements
router.post('/announcements', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const { title, message, type, targetPlan } = req.body;
    const announcement = await prisma.platformAnnouncement.create({
      data: { title, message, type, targetPlan }
    });
    return res.status(201).json(announcement);
  } catch (error) {
    return res.status(500).json({ error: 'Error al crear anuncio.' });
  }
});

// PUT /platform/announcements/:id/toggle
router.put('/announcements/:id/toggle', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const updated = await prisma.platformAnnouncement.update({
      where: { id },
      data: { isActive }
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Error al actualizar anuncio.' });
  }
});

// GET /platform/public/announcements (Para los usuarios regulares - AuthRequest)
router.get('/public/announcements', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinicId }, select: { plan: true } });
    const plan = clinic?.plan || 'starter';

    const announcements = await prisma.platformAnnouncement.findMany({
      where: {
        isActive: true,
        OR: [
          { targetPlan: null },
          { targetPlan: plan }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(announcements);
  } catch (error) {
    return res.status(500).json({ error: 'Error al listar anuncios públicos.' });
  }
});

// ─────────────────────────────────────────────
// SUPPORT TICKETS (Help Desk)
// ─────────────────────────────────────────────

// GET /platform/support/tickets (Para Super Admins)
router.get('/support/tickets', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: {
        clinic: { select: { name: true, plan: true } },
        user: { select: { firstName: true, lastName: true, email: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(tickets);
  } catch (error) {
    return res.status(500).json({ error: 'Error al listar tickets.' });
  }
});

// PUT /platform/support/tickets/:id (Super Admins resolviendo ticket)
router.put('/support/tickets/:id', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updated = await prisma.supportTicket.update({
      where: { id },
      data: { 
        status, 
        resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null 
      }
    });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Error al actualizar ticket.' });
  }
});

// POST /platform/public/support/tickets (Usuarios creando ticket)
router.post('/public/support/tickets', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { subject, description, priority, screenUrl, errorLogs } = req.body;
    const ticket = await prisma.supportTicket.create({
      data: {
        clinicId: req.user!.clinicId,
        userId: req.user!.id,
        subject,
        description,
        priority: priority || 'medium',
        screenUrl,
        errorLogs: errorLogs ? JSON.parse(JSON.stringify(errorLogs)) : null
      }
    });
    return res.status(201).json(ticket);
  } catch (error) {
    return res.status(500).json({ error: 'Error al crear ticket de soporte.' });
  }
});

export const PLATFORM_ROUTES = router;
