import { Router, Response } from 'express';
import { z } from 'zod';
import { PlanType } from '@prisma/client';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { WompiService, wompiConfig } from '../services/wompi.service.js';

export const SUBSCRIPTION_ROUTES = Router();

// ─────────────────────────────────────────────
// PRECIOS Y PLANES SAAS (EN COP)
// ─────────────────────────────────────────────
export const PLAN_PRICING: Record<PlanType, { monthly: number; annual: number; name: string; aiMinutes: number }> = {
  [PlanType.starter]: {
    name: 'Plan Starter',
    monthly: 80000,
    annual: 816000, // 15% descuento (equivale a 2 meses gratis)
    aiMinutes: 60
  },
  [PlanType.pro]: {
    name: 'Plan Pro',
    monthly: 150000,
    annual: 1530000, // 15% descuento
    aiMinutes: 300
  },
  [PlanType.clinic]: {
    name: 'Plan Clínica Estándar',
    monthly: 150000,
    annual: 1530000,
    aiMinutes: 300
  },
  [PlanType.enterprise]: {
    name: 'Plan Enterprise',
    monthly: 300000,
    annual: 3060000, // 15% descuento
    aiMinutes: 9999
  }
};

// ─────────────────────────────────────────────
// 1. CONSULTAR ESTADO DE SUSCRIPCIÓN
// ─────────────────────────────────────────────
// GET /api/v1/subscriptions/current
SUBSCRIPTION_ROUTES.get(
  '/current',
  authMiddleware as any,
  roleMiddleware(['admin']) as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    try {
      const clinic = await prisma.clinic.findUnique({
        where: { id: clinicId },
        select: {
          id: true,
          name: true,
          plan: true,
          subscriptionStatus: true,
          billingCycle: true,
          trialEndsAt: true,
          nextBillingDate: true,
          lastPaymentDate: true,
          aiMinutesUsed: true,
          aiMinutesLimit: true,
          createdAt: true
        }
      });

      if (!clinic) {
        res.status(404).json({ error: 'Clínica no encontrada.' });
        return;
      }

      // Si la clínica es nueva y no tiene trialEndsAt, inicializar 14 días de prueba
      let trialEndsAt = clinic.trialEndsAt;
      if (!trialEndsAt) {
        trialEndsAt = new Date(clinic.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
        await prisma.clinic.update({
          where: { id: clinicId },
          data: { trialEndsAt, nextBillingDate: trialEndsAt }
        });
      }

      const now = new Date();
      const daysRemaining = trialEndsAt
        ? Math.max(0, Math.ceil((new Date(clinic.nextBillingDate || trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 30;

      // Obtener historial de pagos de suscripción
      const payments = await prisma.clinicSubscriptionPayment.findMany({
        where: { clinicId },
        orderBy: { createdAt: 'desc' },
        take: 10
      });

      const currentPricing = PLAN_PRICING[clinic.plan] || PLAN_PRICING.starter;

      res.json({
        clinic: {
          ...clinic,
          trialEndsAt,
          daysRemaining
        },
        pricing: {
          plan: clinic.plan,
          monthlyPrice: currentPricing.monthly,
          annualPrice: currentPricing.annual
        },
        payments
      });
    } catch (error) {
      console.error('[Subscriptions] Error al consultar suscripción actual:', error);
      res.status(500).json({ error: 'Error interno al consultar suscripción.' });
    }
  }
);

// ─────────────────────────────────────────────
// 2. INICIAR CHECKOUT DE SUSCRIPCIÓN CON WOMPI
// ─────────────────────────────────────────────
const CheckoutSchema = z.object({
  plan: z.nativeEnum(PlanType),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly')
});

// POST /api/v1/subscriptions/checkout
SUBSCRIPTION_ROUTES.post(
  '/checkout',
  authMiddleware as any,
  roleMiddleware(['admin']) as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      res.status(401).json({ error: 'No autorizado.' });
      return;
    }

    const parsed = CheckoutSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos de suscripción inválidos' });
      return;
    }

    const { plan, billingCycle } = parsed.data;
    const planConfig = PLAN_PRICING[plan];
    const amountInPesos = billingCycle === 'annual' ? planConfig.annual : planConfig.monthly;
    const amountInCents = amountInPesos * 100;
    const currency = 'COP';

    // Referencia única de transacción
    const timestamp = Date.now();
    const reference = `VETPRO-SUB-${clinicId.slice(0, 8)}-${timestamp}`;

    // Firma de integridad SHA-256 de Wompi
    const signature = WompiService.generateIntegritySignature(reference, amountInCents, currency);

    // Calcular período de cobertura
    const periodStart = new Date();
    const durationDays = billingCycle === 'annual' ? 365 : 30;
    const periodEnd = new Date(periodStart.getTime() + durationDays * 24 * 60 * 60 * 1000);

    try {
      // Registrar pago pendiente en base de datos
      const payment = await prisma.clinicSubscriptionPayment.create({
        data: {
          clinicId,
          plan,
          amountInCents,
          currency,
          billingCycle,
          wompiReference: reference,
          status: 'PENDING',
          periodStart,
          periodEnd
        }
      });

      res.status(201).json({
        paymentId: payment.id,
        reference,
        amountInCents,
        amountInPesos,
        currency,
        plan,
        billingCycle,
        signature,
        publicKey: wompiConfig.publicKey,
        redirectUrl: `${wompiConfig.redirectUrl}?ref=${reference}&type=subscription`
      });
    } catch (error) {
      console.error('[Subscriptions] Error al crear sesión de checkout Wompi:', error);
      res.status(500).json({ error: 'Error al iniciar el checkout de suscripción.' });
    }
  }
);

// ─────────────────────────────────────────────
// 3. WEBHOOK TRANSACCIONAL DE WOMPI
// ─────────────────────────────────────────────
// POST /api/v1/subscriptions/webhook
SUBSCRIPTION_ROUTES.post('/webhook', async (req, res): Promise<void> => {
  try {
    const payload = req.body;
    const event = payload?.event;
    const data = payload?.data?.transaction;

    if (!data || !data.reference) {
      res.status(400).json({ error: 'Payload de Wompi no reconocido.' });
      return;
    }

    // Si la referencia no es de suscripción de clínica, ignorar y responder 200
    if (!data.reference.startsWith('VETPRO-SUB-')) {
      res.status(200).json({ status: 'ignored' });
      return;
    }

    const isValid = WompiService.verifyWebhookSignature(payload);
    if (!isValid && process.env.NODE_ENV === 'production') {
      console.warn('[Subscriptions Webhook] Firma de webhook de Wompi no válida.');
      res.status(400).json({ error: 'Firma de integridad no válida.' });
      return;
    }

    const { reference, status, id: transactionId, payment_method_type: paymentMethod } = data;

    // Buscar el registro de pago por referencia
    const payment = await prisma.clinicSubscriptionPayment.findUnique({
      where: { wompiReference: reference }
    });

    if (!payment) {
      console.warn(`[Subscriptions Webhook] Pago con referencia ${reference} no encontrado.`);
      res.status(404).json({ error: 'Pago no encontrado.' });
      return;
    }

    // Si la transacción fue aprobada, activar la clínica
    if (status === 'APPROVED') {
      const planConfig = PLAN_PRICING[payment.plan];

      await prisma.$transaction([
        // 1. Actualizar pago
        prisma.clinicSubscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'APPROVED',
            paidAt: new Date(),
            wompiTransactionId: transactionId,
            paymentMethod: paymentMethod || 'WOMPI'
          }
        }),
        // 2. Reactivar clínica y actualizar plan y límites
        prisma.clinic.update({
          where: { id: payment.clinicId },
          data: {
            subscriptionStatus: 'active',
            plan: payment.plan,
            billingCycle: payment.billingCycle,
            lastPaymentDate: new Date(),
            nextBillingDate: payment.periodEnd,
            aiMinutesLimit: planConfig.aiMinutes
          }
        })
      ]);

      console.log(`[Subscriptions] Clínica ${payment.clinicId} activada en ${payment.plan} hasta ${payment.periodEnd.toISOString()}`);
    } else if (status === 'DECLINED' || status === 'ERROR') {
      await prisma.clinicSubscriptionPayment.update({
        where: { id: payment.id },
        data: {
          status: 'DECLINED',
          wompiTransactionId: transactionId
        }
      });
    }

    res.json({ status: 'processed', reference, event });
  } catch (error) {
    console.error('[Subscriptions Webhook] Error al procesar webhook de Wompi:', error);
    res.status(500).json({ error: 'Error interno en webhook.' });
  }
});

// ─────────────────────────────────────────────
// 4. SIMULACIÓN DE APROBACIÓN (TEST / DEV / LOCAL)
// ─────────────────────────────────────────────
// POST /api/v1/subscriptions/simulate-approval/:reference
SUBSCRIPTION_ROUTES.post(
  '/simulate-approval/:reference',
  authMiddleware as any,
  roleMiddleware(['admin']) as any,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { reference } = req.params;
    const clinicId = req.user?.clinicId;

    try {
      const payment = await prisma.clinicSubscriptionPayment.findFirst({
        where: { wompiReference: reference, clinicId }
      });

      if (!payment) {
        res.status(404).json({ error: 'Pago no encontrado o no pertenece a su clínica.' });
        return;
      }

      const planConfig = PLAN_PRICING[payment.plan];

      await prisma.$transaction([
        prisma.clinicSubscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: 'APPROVED',
            paidAt: new Date(),
            wompiTransactionId: `SIM-${Date.now()}`,
            paymentMethod: 'CARD_TEST'
          }
        }),
        prisma.clinic.update({
          where: { id: payment.clinicId },
          data: {
            subscriptionStatus: 'active',
            plan: payment.plan,
            billingCycle: payment.billingCycle,
            lastPaymentDate: new Date(),
            nextBillingDate: payment.periodEnd,
            aiMinutesLimit: planConfig.aiMinutes
          }
        })
      ]);

      res.json({
        message: 'Pago simulado y aprobado exitosamente. Suscripción de clínica activada.',
        plan: payment.plan,
        activeUntil: payment.periodEnd
      });
    } catch (error) {
      console.error('[Subscriptions] Error al simular pago:', error);
      res.status(500).json({ error: 'Error al simular pago.' });
    }
  }
);
