import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { AppointmentStatus, ServiceModality, TrackingStatus } from '@prisma/client';

const router = Router();

// Mapeadores auxiliares para compatibilidad del frontend (in-progress vs in_progress)
function toDbStatus(status: any): AppointmentStatus | undefined {
  if (!status) return undefined;
  if (status === 'in-progress') return AppointmentStatus.in_progress;
  if (status === 'no-show') return AppointmentStatus.no_show;
  return status as AppointmentStatus;
}

function toApiStatus(status: any): string {
  if (!status) return status;
  if (status === AppointmentStatus.in_progress) return 'in-progress';
  if (status === AppointmentStatus.no_show) return 'no-show';
  return status;
}

function mapAppointmentToApi(app: any): any {
  if (!app) return app;
  return {
    ...app,
    status: toApiStatus(app.status)
  };
}

router.use(authMiddleware as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────
const CreateAppointmentSchema = z.object({
  patientId: z.string().uuid('ID de paciente inválido'),
  vetId: z.string().uuid('ID de veterinario inválido').optional().nullable(),
  branchId: z.string().uuid('ID de sucursal inválido').optional().nullable(),
  serviceType: z.string().min(1, 'El tipo de servicio es obligatorio'),
  modality: z.nativeEnum(ServiceModality).default(ServiceModality.clinic),
  scheduledAt: z.string().datetime('Fecha de agendamiento inválida'),
  durationMinutes: z.number().int().positive().default(30),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  amountCharged: z.number().nonnegative().optional().nullable(),

  // Datos On-Demand / Domiciliarios
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  travelFee: z.number().nonnegative().default(0)
});

const UpdateAppointmentSchema = CreateAppointmentSchema.partial().extend({
  status: z.string().optional(),
  trackingStatus: z.nativeEnum(TrackingStatus).optional()
});

// ─────────────────────────────────────────────
// ENDPOINTS DE CITAS
// ─────────────────────────────────────────────

// GET /api/v1/appointments (Listado con Filtros)
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { date, vetId, branchId, modality, trackingStatus, status } = req.query;

  try {
    const whereClause: any = {
      clinicId,
      deletedAt: null
    };

    if (branchId) {
      whereClause.branchId = String(branchId);
    }

    if (vetId && vetId !== 'all') {
      whereClause.vetId = String(vetId);
    }

    if (modality && modality !== 'all') {
      whereClause.modality = modality;
    }

    if (trackingStatus && trackingStatus !== 'all') {
      whereClause.trackingStatus = trackingStatus;
    }

    if (status && status !== 'all') {
      whereClause.status = toDbStatus(status);
    }

    if (date) {
      const start = new Date(String(date));
      start.setHours(0, 0, 0, 0);
      const end = new Date(String(date));
      end.setHours(23, 59, 59, 999);
      whereClause.scheduledAt = {
        gte: start,
        lte: end
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: { tutor: true }
        },
        vet: {
          select: { firstName: true, lastName: true, email: true }
        },
        branch: {
          select: { id: true, name: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    const mapped = appointments.map(a => mapAppointmentToApi(a));

    return res.json({
      data: mapped,
      total: mapped.length,
      page: 1,
      pageSize: 100
    });
  } catch (error: any) {
    console.error('[AppointmentRoutes] Error al listar citas:', error);
    return res.status(500).json({ error: 'Error interno al consultar las citas.' });
  }
});

// GET /api/v1/appointments/waitlist (Sala de Espera Digital)
router.get('/waitlist', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { branchId } = req.query;

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const whereClause: any = {
      clinicId,
      deletedAt: null,
      scheduledAt: { gte: todayStart, lte: todayEnd },
      status: {
        in: [
          AppointmentStatus.waiting,
          AppointmentStatus.in_progress,
          AppointmentStatus.scheduled
        ]
      }
    };

    if (branchId) {
      whereClause.branchId = String(branchId);
    }

    const waitlist = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        patient: {
          include: { tutor: true }
        },
        vet: {
          select: { id: true, firstName: true, lastName: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    return res.json(waitlist.map(a => mapAppointmentToApi(a)));
  } catch (error: any) {
    console.error('[AppointmentRoutes] Error al consultar sala de espera:', error);
    return res.status(500).json({ error: 'Error al consultar la sala de espera.' });
  }
});

// GET /api/v1/appointments/:id (Detalle de Cita)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        patient: {
          include: { tutor: true }
        },
        vet: {
          select: { firstName: true, lastName: true, email: true }
        },
        branch: true
      }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    return res.json(mapAppointmentToApi(appointment));
  } catch (error: any) {
    console.error('[AppointmentRoutes] Error al buscar cita:', error);
    return res.status(500).json({ error: 'Error al obtener cita.' });
  }
});

// POST /api/v1/appointments (Agendar Cita con Protección IDOR)
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const parsed = CreateAppointmentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos de la cita inválidos',
      details: parsed.error.format()
    });
  }

  const data = parsed.data;

  try {
    // 1. Validar que el paciente pertenezca a la clínica (Anti-IDOR)
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, clinicId, deletedAt: null }
    });

    if (!patient) {
      return res.status(404).json({ error: 'El paciente especificado no existe o no pertenece a su clínica.' });
    }

    // 2. Validar o determinar la sucursal (Branch)
    let branchId = data.branchId || req.user?.branchId;
    if (!branchId) {
      const defaultBranch = await prisma.branch.findFirst({
        where: { clinicId, active: true }
      });
      if (!defaultBranch) {
        return res.status(400).json({ error: 'Debe configurar al menos una sucursal activa en el sistema.' });
      }
      branchId = defaultBranch.id;
    } else {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, clinicId }
      });
      if (!branch) {
        return res.status(404).json({ error: 'La sucursal especificada no pertenece a su clínica.' });
      }
    }

    // 3. Validar veterinario si fue provisto
    if (data.vetId) {
      const vet = await prisma.user.findFirst({
        where: { id: data.vetId, clinicId }
      });
      if (!vet) {
        return res.status(404).json({ error: 'El veterinario especificado no pertenece a su clínica.' });
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        branchId,
        patientId: data.patientId,
        vetId: data.vetId || null,
        serviceType: data.serviceType,
        modality: data.modality,
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: data.durationMinutes,
        status: AppointmentStatus.scheduled,
        reason: data.reason || null,
        notes: data.notes || null,
        amountCharged: data.amountCharged || null,
        address: data.address || null,
        city: data.city || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        travelFee: data.travelFee,
        trackingStatus: data.modality === ServiceModality.home_visit ? TrackingStatus.requested : TrackingStatus.requested
      },
      include: {
        patient: {
          include: { tutor: true }
        },
        vet: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    return res.status(201).json(mapAppointmentToApi(appointment));
  } catch (error: any) {
    console.error('[AppointmentRoutes] Error al agendar cita:', error);
    return res.status(500).json({ error: 'Error al registrar cita en la agenda.' });
  }
});

// PATCH /api/v1/appointments/:id/status (Cambiar Estado de Cita / Sala de Espera)
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { status, trackingStatus } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const existing = await prisma.appointment.findFirst({
      where: { id, clinicId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    const dbStatus = toDbStatus(status);

    const updateData: any = {};
    if (dbStatus) updateData.status = dbStatus;
    if (trackingStatus) {
      updateData.trackingStatus = trackingStatus;
      if (trackingStatus === TrackingStatus.on_the_way) updateData.onTheWayAt = new Date();
      if (trackingStatus === TrackingStatus.arrived) updateData.arrivedAt = new Date();
      if (trackingStatus === TrackingStatus.completed) updateData.completedAt = new Date();
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: {
          include: { tutor: true }
        },
        vet: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    return res.json(mapAppointmentToApi(updated));
  } catch (error: any) {
    console.error('[AppointmentRoutes] Error al actualizar estado de cita:', error);
    return res.status(500).json({ error: 'Error al actualizar el estado de la cita.' });
  }
});

// DELETE /api/v1/appointments/:id (Soft Delete / Cancelar)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const existing = await prisma.appointment.findFirst({
      where: { id, clinicId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    await prisma.appointment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: AppointmentStatus.cancelled
      }
    });

    return res.json({ message: 'Cita cancelada y eliminada de la agenda.' });
  } catch (error: any) {
    console.error('[AppointmentRoutes] Error al cancelar cita:', error);
    return res.status(500).json({ error: 'Error al cancelar la cita.' });
  }
});

export const APPOINTMENT_ROUTES = router;
