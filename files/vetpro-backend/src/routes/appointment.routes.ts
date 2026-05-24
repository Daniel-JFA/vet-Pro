import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Activar verificación de token JWT para todas las rutas de citas
router.use(authMiddleware as any);

// GET /appointments (Listado de citas con filtros)
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado. ID de clínica no especificado.' });
  }

  const { date, vetId, branchId } = req.query;

  try {
    const whereClause: any = { clinicId };

    if (branchId) {
      whereClause.branchId = branchId as string;
    }

    if (vetId && vetId !== 'all') {
      whereClause.vetId = vetId as string;
    }

    // Filtrar por fecha específica (por ejemplo, citas de hoy)
    if (date) {
      const start = new Date(date as string);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date as string);
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
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    // Aplanar veterinario para el formato que espera el frontend
    const mapped = appointments.map(a => ({
      ...a,
      vetId: a.vetId // Mantiene el ID del vet y añade metadatos si fuera necesario
    }));

    return res.json({
      data: mapped,
      total: mapped.length,
      page: 1,
      pageSize: 100
    });
  } catch (error) {
    console.error('Error al listar citas:', error);
    return res.status(500).json({ error: 'Error al obtener agenda de citas.' });
  }
});

// GET /appointments/today (Citas programadas para hoy - Sala de Espera)
router.get('/today', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: { gte: start, lte: end }
      },
      include: {
        patient: {
          include: { tutor: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    return res.json(appointments);
  } catch (error) {
    console.error('Error al listar citas de hoy:', error);
    return res.status(500).json({ error: 'Error al obtener citas del día.' });
  }
});

// GET /appointments/:id (Obtener cita específica)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId },
      include: {
        patient: {
          include: { tutor: true }
        }
      }
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    return res.json(appointment);
  } catch (error) {
    console.error('Error al buscar cita:', error);
    return res.status(500).json({ error: 'Error al obtener cita.' });
  }
});

// POST /appointments (Agendar cita)
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { patientId, vetId, serviceType, scheduledAt, durationMinutes, reason, notes } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!patientId || !vetId || !serviceType || !scheduledAt) {
    return res.status(400).json({ error: 'Paciente, veterinario, tipo de servicio y horario son campos obligatorios.' });
  }

  try {
    // Buscar sucursal por defecto de la clínica para asignar la cita física
    const branch = await prisma.branch.findFirst({
      where: { clinicId, active: true }
    });

    if (!branch) {
      return res.status(400).json({ error: 'Debe configurar al menos una sucursal en el sistema antes de agendar citas.' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        branchId: branch.id,
        patientId,
        vetId,
        serviceType,
        scheduledAt: new Date(scheduledAt),
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 30,
        status: 'scheduled',
        reason,
        notes
      },
      include: {
        patient: {
          include: { tutor: true }
        }
      }
    });

    return res.status(201).json(appointment);
  } catch (error) {
    console.error('Error al agendar cita:', error);
    return res.status(500).json({ error: 'Error al registrar cita en la agenda.' });
  }
});

// PUT /appointments/:id (Editar cita)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { patientId, vetId, serviceType, scheduledAt, durationMinutes, reason, notes, status } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const existing = await prisma.appointment.findFirst({ where: { id, clinicId } });
    if (!existing) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        patientId: patientId || existing.patientId,
        vetId: vetId || existing.vetId,
        serviceType: serviceType || existing.serviceType,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : existing.scheduledAt,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : existing.durationMinutes,
        reason: reason !== undefined ? reason : existing.reason,
        notes: notes !== undefined ? notes : existing.notes,
        status: status || existing.status
      },
      include: {
        patient: {
          include: { tutor: true }
        }
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error al editar cita:', error);
    return res.status(500).json({ error: 'Error al actualizar cita.' });
  }
});

// PATCH /appointments/:id/status (Actualizar estado - Sala de Espera Digital Board)
router.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { status } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!status) {
    return res.status(400).json({ error: 'El estado es un parámetro requerido.' });
  }

  try {
    const existing = await prisma.appointment.findFirst({ where: { id, clinicId } });
    if (!existing) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        patient: {
          include: { tutor: true }
        }
      }
    });

    // [OPCIONAL WHATSAPP TRIGER LOGIC]
    // Si pasa a 'waiting' o 'done' se dispararía la cola BullMQ en producción

    return res.json(updated);
  } catch (error) {
    console.error('Error al cambiar estado de cita:', error);
    return res.status(500).json({ error: 'Error al registrar cambio en la sala de espera.' });
  }
});

// PATCH /appointments/:id/cancel (Cancelar cita con motivo)
router.patch('/:id/cancel', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { reason } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const existing = await prisma.appointment.findFirst({ where: { id, clinicId } });
    if (!existing) {
      return res.status(404).json({ error: 'Cita no encontrada.' });
    }

    await prisma.appointment.update({
      where: { id },
      data: {
        status: 'cancelled',
        notes: reason ? `Cancelación: ${reason}. ${existing.notes || ''}` : existing.notes
      }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Error al cancelar cita:', error);
    return res.status(500).json({ error: 'Error al registrar cancelación.' });
  }
});

export const APPOINTMENT_ROUTES = router;
