import { Router, Response } from 'express';
import { z } from 'zod';
import {
  NotificationChannel,
  NotificationTrigger,
  DeliveryStatus,
  AppointmentStatus
} from '@prisma/client';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

export const NOTIFICATION_ROUTES = Router();

NOTIFICATION_ROUTES.use(authMiddleware as any);
NOTIFICATION_ROUTES.use(roleMiddleware(['admin', 'receptionist', 'vet']) as any);

// ─────────────────────────────────────────────
// PLANTILLAS PREDETERMINADAS POR DEFECTO
// ─────────────────────────────────────────────

const DEFAULT_TEMPLATES = [
  {
    name: 'Recordatorio de Cita (24h antes)',
    trigger: NotificationTrigger.appointment_reminder_24h,
    channel: NotificationChannel.whatsapp,
    body: 'Hola {{nombre_tutor}}, te recordamos que mañana {{fecha_cita}} a las {{hora_cita}} tienes una cita programada para tu mascota {{nombre_mascota}} con el profesional {{veterinario}}. ¡Te esperamos en VetPro!',
    active: true
  },
  {
    name: 'Aviso de Turno en Sala (2h antes)',
    trigger: NotificationTrigger.appointment_reminder_2h,
    channel: NotificationChannel.whatsapp,
    body: 'Hola {{nombre_tutor}}, tu turno para {{nombre_mascota}} en VetPro es en 2 horas ({{hora_cita}}). Por favor llega con 10 minutos de antelación.',
    active: true
  },
  {
    name: 'Alerta de Refuerzo de Vacuna',
    trigger: NotificationTrigger.vaccine_due,
    channel: NotificationChannel.whatsapp,
    body: '¡Hola {{nombre_tutor}}! Te recordamos que la vacuna de {{nombre_mascota}} está próxima a vencer. La inmunización oportuna previene enfermedades graves. Contáctanos para agendar su refuerzo.',
    active: true
  },
  {
    name: 'Saludo de Cumpleaños a Mascota',
    trigger: NotificationTrigger.birthday,
    channel: NotificationChannel.whatsapp,
    body: '¡Feliz Cumpleaños a {{nombre_mascota}}! 🎂🐾 Desde la familia VetPro le deseamos un día lleno de juegos y salud. ¡Ven por su regalo sorpresa en tu próxima visita!',
    active: false
  },
  {
    name: 'Resultados de Laboratorio Listos',
    trigger: NotificationTrigger.lab_ready,
    channel: NotificationChannel.whatsapp,
    body: 'Hola {{nombre_tutor}}, los resultados de laboratorio de {{nombre_mascota}} ya se encuentran listos y validados. Puedes consultarlos en tu portal de tutor o comunicarte con nosotros.',
    active: true
  }
];

// Helper para enviar mensaje WhatsApp real o registrar mock
async function sendWhatsApp(phone: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    // Modo local / sin token configurado: simular entrega exitosa
    return true;
  }

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
    console.error('[Notifications] Error al enviar WhatsApp:', error);
    return false;
  }
}

// ─────────────────────────────────────────────
// ENDPOINTS DE PLANTILLAS
// ─────────────────────────────────────────────

// GET /api/v1/notifications/templates
NOTIFICATION_ROUTES.get('/templates', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado' });

  try {
    let templates = await prisma.notificationTemplate.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' }
    });

    // Si la clínica no tiene plantillas configuradas, sembrar las predeterminadas
    if (templates.length === 0) {
      await prisma.$transaction(
        DEFAULT_TEMPLATES.map((tpl) =>
          prisma.notificationTemplate.create({
            data: {
              clinicId,
              name: tpl.name,
              trigger: tpl.trigger,
              channel: tpl.channel,
              body: tpl.body,
              active: tpl.active
            }
          })
        )
      );

      templates = await prisma.notificationTemplate.findMany({
        where: { clinicId },
        orderBy: { name: 'asc' }
      });
    }

    return res.json({ data: templates, total: templates.length });
  } catch (error) {
    console.error('[Notifications] Error al listar plantillas:', error);
    return res.status(500).json({ error: 'Error interno al consultar plantillas.' });
  }
});

// POST /api/v1/notifications/templates
const CreateTemplateSchema = z.object({
  name: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  trigger: z.nativeEnum(NotificationTrigger),
  channel: z.nativeEnum(NotificationChannel).default(NotificationChannel.whatsapp),
  subject: z.string().optional(),
  body: z.string().min(5, 'El cuerpo del mensaje es obligatorio'),
  active: z.boolean().default(true)
});

NOTIFICATION_ROUTES.post('/templates', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado' });

  const parsed = CreateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
  }

  try {
    const template = await prisma.notificationTemplate.create({
      data: {
        clinicId,
        ...parsed.data
      }
    });

    return res.status(201).json({ data: template });
  } catch (error) {
    console.error('[Notifications] Error al crear plantilla:', error);
    return res.status(500).json({ error: 'Error al crear la plantilla.' });
  }
});

// PUT /api/v1/notifications/templates/:id
const UpdateTemplateSchema = z.object({
  name: z.string().min(3).optional(),
  trigger: z.nativeEnum(NotificationTrigger).optional(),
  channel: z.nativeEnum(NotificationChannel).optional(),
  subject: z.string().optional(),
  body: z.string().min(5).optional(),
  active: z.boolean().optional()
});

NOTIFICATION_ROUTES.put('/templates/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado' });

  const parsed = UpdateTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' });
  }

  try {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { id, clinicId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Plantilla no encontrada.' });
    }

    const updated = await prisma.notificationTemplate.update({
      where: { id },
      data: parsed.data
    });

    return res.json({ data: updated });
  } catch (error) {
    console.error('[Notifications] Error al actualizar plantilla:', error);
    return res.status(500).json({ error: 'Error al actualizar la plantilla.' });
  }
});

// PATCH /api/v1/notifications/templates/:id/toggle
NOTIFICATION_ROUTES.patch('/templates/:id/toggle', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado' });

  try {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { id, clinicId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Plantilla no encontrada.' });
    }

    const updated = await prisma.notificationTemplate.update({
      where: { id },
      data: { active: !existing.active }
    });

    return res.json({ data: updated });
  } catch (error) {
    console.error('[Notifications] Error al cambiar estado de plantilla:', error);
    return res.status(500).json({ error: 'Error al cambiar estado de la plantilla.' });
  }
});

// DELETE /api/v1/notifications/templates/:id
NOTIFICATION_ROUTES.delete('/templates/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado' });

  try {
    const existing = await prisma.notificationTemplate.findFirst({
      where: { id, clinicId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Plantilla no encontrada.' });
    }

    await prisma.notificationTemplate.delete({ where: { id } });
    return res.json({ message: 'Plantilla eliminada exitosamente.' });
  } catch (error) {
    console.error('[Notifications] Error al eliminar plantilla:', error);
    return res.status(500).json({ error: 'Error al eliminar la plantilla.' });
  }
});

// ─────────────────────────────────────────────
// ENDPOINTS DE LOGS Y HISTORIAL
// ─────────────────────────────────────────────

// GET /api/v1/notifications/logs
NOTIFICATION_ROUTES.get('/logs', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado' });

  const { status, channel, search, limit = '50', page = '1' } = req.query;
  const take = Math.min(parseInt(limit as string, 10) || 50, 100);
  const skip = (Math.max(parseInt(page as string, 10) || 1, 1) - 1) * take;

  try {
    const where: any = { clinicId };
    if (status && Object.values(DeliveryStatus).includes(status as DeliveryStatus)) {
      where.status = status;
    }
    if (channel && Object.values(NotificationChannel).includes(channel as NotificationChannel)) {
      where.channel = channel;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { recipientPhone: { contains: q, mode: 'insensitive' } },
        { recipientEmail: { contains: q, mode: 'insensitive' } }
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        take,
        skip
      }),
      prisma.notificationLog.count({ where })
    ]);

    // Enriquecer logs con información de paciente si existe patientId
    const patientIds = Array.from(new Set(logs.map(l => l.patientId).filter(Boolean))) as string[];
    const patients = patientIds.length > 0
      ? await prisma.patient.findMany({
          where: { id: { in: patientIds } },
          select: { id: true, name: true, tutor: { select: { firstName: true, lastName: true } } }
        })
      : [];
    const patientMap = new Map(patients.map(p => [p.id, p]));

    const enrichedLogs = logs.map(log => {
      const p = log.patientId ? patientMap.get(log.patientId) : undefined;
      return {
        ...log,
        patientName: p?.name || 'Paciente',
        recipientName: p?.tutor ? `${p.tutor.firstName} ${p.tutor.lastName}`.trim() : 'Tutor'
      };
    });

    return res.json({
      data: enrichedLogs,
      total,
      page: Math.floor(skip / take) + 1,
      pageSize: take
    });
  } catch (error) {
    console.error('[Notifications] Error al consultar historial de notificaciones:', error);
    return res.status(500).json({ error: 'Error al consultar logs de notificaciones.' });
  }
});

// ─────────────────────────────────────────────
// DISPARADOR / DESPACHO AUTOMATIZADO
// ─────────────────────────────────────────────

// POST /api/v1/notifications/dispatch-reminders
NOTIFICATION_ROUTES.post('/dispatch-reminders', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado' });

  try {
    // 1. Buscar plantilla activa para recordatorio de 24h
    const template24h = await prisma.notificationTemplate.findFirst({
      where: { clinicId, trigger: NotificationTrigger.appointment_reminder_24h, active: true }
    });

    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);

    // 2. Buscar citas para mañana
    const upcomingAppointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { in: [AppointmentStatus.scheduled, AppointmentStatus.waiting] }
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            tutor: { select: { id: true, firstName: true, lastName: true, phone: true } }
          }
        },
        vet: { select: { firstName: true, lastName: true } }
      }
    });

    const dispatched: any[] = [];

    if (template24h && upcomingAppointments.length > 0) {
      for (const appt of upcomingAppointments) {
        const tutor = appt.patient?.tutor;
        const phone = tutor?.phone || appt.prospectPhone;
        if (!phone) continue;

        // Verificar si ya se envió notificación para esta cita
        const alreadySent = await prisma.notificationLog.findFirst({
          where: { clinicId, appointmentId: appt.id, status: DeliveryStatus.delivered }
        });
        if (alreadySent) continue;

        const tutorName = tutor ? `${tutor.firstName} ${tutor.lastName}`.trim() : (appt.prospectName || 'Tutor');
        const petName = appt.patient?.name || 'Mascota';
        const vetName = appt.vet ? `Dr(a). ${appt.vet.firstName} ${appt.vet.lastName}` : 'Especialista VetPro';
        const dateStr = appt.scheduledAt.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
        const timeStr = appt.scheduledAt.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

        const messageText = template24h.body
          .replace(/\{\{nombre_tutor\}\}/g, tutorName)
          .replace(/\{\{nombre_mascota\}\}/g, petName)
          .replace(/\{\{fecha_cita\}\}/g, dateStr)
          .replace(/\{\{hora_cita\}\}/g, timeStr)
          .replace(/\{\{veterinario\}\}/g, vetName);

        const ok = await sendWhatsApp(phone, messageText);

        const log = await prisma.notificationLog.create({
          data: {
            clinicId,
            templateId: template24h.id,
            recipientPhone: phone,
            channel: template24h.channel,
            status: ok ? DeliveryStatus.delivered : DeliveryStatus.failed,
            patientId: appt.patientId,
            appointmentId: appt.id,
            error: ok ? null : 'Fallo en servicio WhatsApp Cloud API'
          }
        });

        dispatched.push({
          appointmentId: appt.id,
          tutor: tutorName,
          pet: petName,
          status: log.status
        });
      }
    }

    return res.json({
      message: `Proceso completado. ${dispatched.length} recordatorios procesados.`,
      dispatchedCount: dispatched.length,
      dispatched
    });
  } catch (error) {
    console.error('[Notifications] Error al despachar recordatorios:', error);
    return res.status(500).json({ error: 'Error al procesar recordatorios automáticos.' });
  }
});
