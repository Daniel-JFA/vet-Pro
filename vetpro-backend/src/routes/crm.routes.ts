import { Router, Response } from 'express';
import { z } from 'zod';
import { AppointmentStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

export const CRM_ROUTES = Router();

CRM_ROUTES.use(authMiddleware as any);
CRM_ROUTES.use(roleMiddleware(['admin', 'receptionist', 'vet']) as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────

const SendCampaignSchema = z.object({
  name: z.string().min(3, 'El nombre de la campaña es obligatorio'),
  // 'deworming_due' se retiró: no hay ningún dato estructurado en el sistema
  // (sin modelo de desparasitación) para calcular esa cohorte con precisión.
  targetType: z.enum(['inactive_180d', 'vaccine_due', 'birthday']),
  channel: z.enum(['whatsapp', 'email', 'sms']).default('whatsapp'),
  templateBody: z.string().min(10, 'El cuerpo del mensaje es obligatorio'),
  discountPercent: z.number().min(0).max(100).default(10)
});

// ─────────────────────────────────────────────
// ENVÍO REAL VÍA WHATSAPP CLOUD API (META)
// ─────────────────────────────────────────────

async function sendWhatsAppMessage(phone: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: text }
      })
    });
    return response.ok;
  } catch (error) {
    console.error('[CRM] Error al enviar mensaje de WhatsApp:', error);
    return false;
  }
}

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
    } else if (data.targetType === 'birthday') {
      // Cumpleaños en los próximos 30 días (sin importar el año de nacimiento)
      const patients = await prisma.patient.findMany({
        where: { clinicId, status: 'active', deletedAt: null, birthDate: { not: null } },
        include: { tutor: true },
        take: 500
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const isUpcoming = (birthDate: Date, windowDays: number) => {
        const next = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        if (next < today) next.setFullYear(today.getFullYear() + 1);
        const diffDays = (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= windowDays;
      };

      targets = patients
        .filter(p => p.birthDate && isUpcoming(new Date(p.birthDate), 30))
        .map(p => ({
          patientName: p.name,
          tutorName: p.tutor.firstName,
          phone: p.tutor.phone.replace(/[^0-9]/g, '')
        }));
    } else {
      // vaccine_due
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

    const buildMessage = (t: { patientName: string; tutorName: string }) =>
      data.templateBody
        .replace(/{nombre_tutor}/gi, t.tutorName)
        .replace(/{nombre_mascota}/gi, t.patientName)
        .replace(/{nombre_clinica}/gi, clinic.name)
        .replace(/{descuento}/gi, `${data.discountPercent}%`);

    const whatsappConfigured = !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
    const autoSend = data.channel === 'whatsapp' && whatsappConfigured;

    let messagesSent = 0;
    let messagesDelivered = 0;

    if (autoSend) {
      // Envío real, uno por uno, respetando resultados individuales (sin fingir éxito)
      for (const t of targets) {
        const ok = await sendWhatsAppMessage(t.phone, buildMessage(t));
        if (ok) {
          messagesSent += 1;
          messagesDelivered += 1;
        }
      }
    }

    // Enlaces de respaldo para envío manual (siempre disponibles, se usen o no)
    const sampleMessages = targets.slice(0, 10).map(t => {
      const text = buildMessage(t);
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
        messagesSent,
        messagesDelivered,
        responsesReceived: 0,
        appointmentsBooked: 0
      }
    });

    const message = autoSend
      ? `Campaña '${campaign.name}' enviada automáticamente: ${messagesDelivered} de ${targets.length} mensajes entregados vía WhatsApp Cloud API.`
      : `Campaña '${campaign.name}' generada para ${targets.length} destinatarios. WhatsApp Business API no está configurado (WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID): use los enlaces de envío manual generados a continuación.`;

    return res.status(201).json({
      success: true,
      autoSent: autoSend,
      message,
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

// ─────────────────────────────────────────────
// ⏰ RECORDATORIOS AUTOMÁTICOS & WHATSAPP
// ─────────────────────────────────────────────

// GET /api/v1/crm/reminders/upcoming (Citas de mañana y vacunas próximas)
CRM_ROUTES.get('/reminders/upcoming', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    const clinicName = clinic?.name || 'VetPro';

    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);
    const nextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);

    // 1. Citas programadas para mañana
    const tomorrowAppointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { in: [AppointmentStatus.scheduled, AppointmentStatus.waiting] }
      },
      include: {
        patient: { include: { tutor: true } },
        vet: { select: { firstName: true, lastName: true } }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    // 2. Vacunas que vencen en los próximos 7 días
    const upcomingVaccines = await prisma.vaccine.findMany({
      where: {
        patient: { clinicId, status: 'active', deletedAt: null },
        nextDueAt: { gte: now, lte: nextWeek }
      },
      include: {
        patient: { include: { tutor: true } }
      },
      orderBy: { nextDueAt: 'asc' }
    });

    const appointmentReminders = tomorrowAppointments
      .filter(a => a.patient?.tutor?.phone || a.prospectPhone)
      .map(a => {
        const tutorName = a.patient?.tutor?.firstName || a.prospectName || 'Tutor';
        const petName = a.patient?.name || 'su mascota';
        const rawPhone = (a.patient?.tutor?.phone || a.prospectPhone || '').replace(/[^0-9]/g, '');
        const timeStr = a.scheduledAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
        const vetStr = a.vet ? ` con Dr(a). ${a.vet.firstName} ${a.vet.lastName}` : '';
        const modalityStr = a.modality === 'home_visit' ? 'a domicilio' : 'en consultorio';

        const text = `🐾 *¡Hola ${tutorName}!* Le recordamos que mañana tiene una cita médica para *${petName}* (${modalityStr}${vetStr}) a las *${timeStr}* en *${clinicName}*.\n\nPor favor confirme su asistencia respondiendo a este mensaje. ¡Muchas gracias!`;
        const phoneWithCode = rawPhone.length === 10 && !rawPhone.startsWith('57') ? '57' + rawPhone : rawPhone;

        return {
          id: a.id,
          type: 'appointment',
          scheduledAt: a.scheduledAt,
          patientName: petName,
          tutorName,
          phone: phoneWithCode,
          message: text,
          whatsappUrl: `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(text)}`
        };
      });

    const vaccineReminders = upcomingVaccines
      .filter(v => v.patient.tutor?.phone)
      .map(v => {
        const tutorName = v.patient.tutor.firstName;
        const petName = v.patient.name;
        const rawPhone = (v.patient.tutor.phone || '').replace(/[^0-9]/g, '');
        const dateStr = v.nextDueAt ? v.nextDueAt.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' }) : 'próximamente';

        const text = `🐾 *¡Hola ${tutorName}!* Le recordamos desde *${clinicName}* que a *${petName}* le corresponde el refuerzo de la vacuna *${v.name}* el *${dateStr}*.\n\nProteja a su mascota agendando su consulta preventiva. ¡Estamos atentos para atenderlos!`;
        const phoneWithCode = rawPhone.length === 10 && !rawPhone.startsWith('57') ? '57' + rawPhone : rawPhone;

        return {
          id: v.id,
          type: 'vaccine',
          dueDate: v.nextDueAt,
          vaccineName: v.name,
          patientName: petName,
          tutorName,
          phone: phoneWithCode,
          message: text,
          whatsappUrl: `https://wa.me/${phoneWithCode}?text=${encodeURIComponent(text)}`
        };
      });

    return res.json({
      summary: {
        appointmentsTomorrowCount: appointmentReminders.length,
        vaccinesUpcomingCount: vaccineReminders.length,
        totalReminders: appointmentReminders.length + vaccineReminders.length
      },
      appointments: appointmentReminders,
      vaccines: vaccineReminders
    });
  } catch (error: any) {
    console.error('[CRM] Error al consultar recordatorios:', error);
    return res.status(500).json({ error: 'Error al consultar recordatorios programados.' });
  }
});
