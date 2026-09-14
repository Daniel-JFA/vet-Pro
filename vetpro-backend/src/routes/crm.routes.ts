import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

export const CRM_ROUTES = Router();

CRM_ROUTES.use(authMiddleware as any);
CRM_ROUTES.use(roleMiddleware(['admin', 'receptionist']) as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────

const SendCampaignSchema = z.object({
  name: z.string().min(3, 'El nombre de la campaña es obligatorio'),
  targetType: z.enum(['inactive_180d', 'vaccine_due', 'deworming_due', 'birthday']),
  channel: z.enum(['whatsapp', 'email', 'sms']).default('whatsapp'),
  templateBody: z.string().min(10, 'El cuerpo del mensaje es obligatorio'),
  discountPercent: z.number().min(0).max(100).default(10)
});

// ─────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/v1/crm/cohorts (Segmentación y cálculo de ingresos potenciales)
CRM_ROUTES.get('/cohorts', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    const today = new Date();

    // 1. Pacientes inactivos (> 180 días sin citas ni consultas)
    const inactivePatients = await prisma.patient.findMany({
      where: {
        clinicId,
        status: 'active',
        deletedAt: null,
        appointments: {
          every: {
            scheduledAt: { lt: sixMonthsAgo }
          }
        }
      },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, phone: true } },
        appointments: { orderBy: { scheduledAt: 'desc' }, take: 1 }
      },
      take: 100
    });

    // 2. Vacunas vencidas
    const overdueVaccines = await prisma.vaccine.findMany({
      where: {
        nextDueAt: { lt: today },
        patient: { clinicId, status: 'active', deletedAt: null }
      },
      include: {
        patient: {
          include: { tutor: { select: { id: true, firstName: true, lastName: true, phone: true } } }
        }
      },
      take: 100
    });

    // Ticket promedio estimado en Colombia (COP)
    const averageTicket = 85000;
    const potentialRevenueInactive = inactivePatients.length * averageTicket;
    const potentialRevenueVaccines = overdueVaccines.length * 45000;

    return res.json({
      summary: {
        totalInactive: inactivePatients.length,
        totalOverdueVaccines: overdueVaccines.length,
        potentialRecoverableRevenue: potentialRevenueInactive + potentialRevenueVaccines
      },
      inactiveCohort: inactivePatients.map(p => ({
        patientId: p.id,
        patientName: p.name,
        species: p.species,
        tutorName: `${p.tutor.firstName} ${p.tutor.lastName}`,
        tutorPhone: p.tutor.phone,
        lastVisit: p.appointments[0]?.scheduledAt || null
      })),
      vaccineCohort: overdueVaccines.map(v => ({
        vaccineId: v.id,
        vaccineName: v.name,
        dueDate: v.nextDueAt,
        patientName: v.patient.name,
        tutorName: `${v.patient.tutor.firstName} ${v.patient.tutor.lastName}`,
        tutorPhone: v.patient.tutor.phone
      }))
    });
  } catch (error: any) {
    console.error('[CRM] Error al calcular cohortes:', error);
    return res.status(500).json({ error: 'Error al consultar cohortes de CRM.' });
  }
});

// POST /api/v1/crm/broadcast (Lanzamiento de campaña masiva de WhatsApp)
CRM_ROUTES.post('/broadcast', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = SendCampaignSchema.parse(req.body);

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!clinic) return res.status(404).json({ error: 'Clínica no encontrada.' });

    // Obtener destinatarios según el tipo de público objetivo
    let targets: { patientName: string; tutorName: string; phone: string }[] = [];

    if (data.targetType === 'inactive_180d') {
      const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
      const patients = await prisma.patient.findMany({
        where: {
          clinicId,
          status: 'active',
          deletedAt: null,
          appointments: { every: { scheduledAt: { lt: sixMonthsAgo } } }
        },
        include: { tutor: true },
        take: 200
      });
      targets = patients.map(p => ({
        patientName: p.name,
        tutorName: p.tutor.firstName,
        phone: p.tutor.phone.replace(/[^0-9]/g, '')
      }));
    } else {
      const vaccines = await prisma.vaccine.findMany({
        where: { nextDueAt: { lt: new Date() }, patient: { clinicId, status: 'active' } },
        include: { patient: { include: { tutor: true } } },
        take: 200
      });
      targets = vaccines.map(v => ({
        patientName: v.patient.name,
        tutorName: v.patient.tutor.firstName,
        phone: v.patient.tutor.phone.replace(/[^0-9]/g, '')
      }));
    }

    const potentialRevenue = targets.length * 85000;

    // Generar enlaces individuales para despacho WhatsApp
    const sampleMessages = targets.slice(0, 10).map(t => {
      let text = data.templateBody
        .replace(/{nombre_tutor}/gi, t.tutorName)
        .replace(/{nombre_mascota}/gi, t.patientName)
        .replace(/{nombre_clinica}/gi, clinic.name)
        .replace(/{descuento}/gi, `${data.discountPercent}%`);

      return {
        phone: t.phone,
        message: text,
        link: `https://wa.me/${t.phone}?text=${encodeURIComponent(text)}`
      };
    });

    const campaign = await prisma.crmCampaign.create({
      data: {
        clinicId,
        name: data.name,
        targetType: data.targetType,
        channel: data.channel,
        templateBody: data.templateBody,
        potentialRevenue,
        patientsTargeted: targets.length,
        messagesSent: targets.length,
        messagesDelivered: targets.length,
        responsesReceived: 0,
        appointmentsBooked: 0
      }
    });

    return res.status(201).json({
      success: true,
      message: `Campaña '${campaign.name}' procesada para ${targets.length} destinatarios.`,
      campaign,
      sampleDispatches: sampleMessages
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[CRM] Error al enviar campaña:', error);
    return res.status(500).json({ error: 'Error al procesar campaña masiva de reactivación.' });
  }
});
