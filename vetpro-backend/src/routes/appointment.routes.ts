import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Mapeadores auxiliares para reconciliar la discrepancia de AppointmentStatus (guión vs guión bajo)
// El frontend usa 'in-progress' y 'no-show', pero la BD usa 'in_progress' y 'no_show'.
function toDbStatus(status: any): any {
  if (!status) return undefined;
  if (status === 'in-progress') return 'in_progress';
  if (status === 'no-show') return 'no_show';
  return status;
}

function toApiStatus(status: any): any {
  if (!status) return undefined;
  if (status === 'in_progress') return 'in-progress';
  if (status === 'no_show') return 'no-show';
  return status;
}

function mapAppointmentToApi(app: any): any {
  if (!app) return app;
  return {
    ...app,
    status: toApiStatus(app.status)
  };
}

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

    // Aplanar veterinario y normalizar estados para el formato que espera el frontend
    const mapped = appointments.map(a => ({
      ...mapAppointmentToApi(a),
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
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Base de datos no disponible o credenciales inválidas. Retornando Fallback Mock de Citas.');
      const mockAppointments = [
        {
          id: 'dev-appointment-1',
          clinicId: clinicId,
          patientId: 'dev-patient-1',
          vetId: 'dev-vet',
          branchId: 'dev-branch',
          scheduledAt: new Date(new Date().setHours(10, 0, 0, 0)),
          duration: 30,
          reason: 'Consulta general de control',
          status: 'scheduled',
          patient: {
            id: 'dev-patient-1',
            clinicId: clinicId,
            name: 'Toby',
            species: 'dog',
            breed: 'Golden Retriever',
            tutor: {
              id: 'dev-tutor-1',
              firstName: 'Daniel',
              lastName: 'Flórez Aguirre',
              phone: '3122115299'
            }
          },
          vet: {
            firstName: 'Laura',
            lastName: 'Cardona'
          }
        },
        {
          id: 'dev-appointment-2',
          clinicId: clinicId,
          patientId: 'dev-patient-3',
          vetId: 'dev-vet',
          branchId: 'dev-branch',
          scheduledAt: new Date(new Date().setHours(14, 30, 0, 0)),
          duration: 45,
          reason: 'Vacunación y desparasitación',
          status: 'waiting',
          patient: {
            id: 'dev-patient-3',
            clinicId: clinicId,
            name: 'Luna',
            species: 'cat',
            breed: 'Siamés',
            tutor: {
              id: 'dev-tutor-2',
              firstName: 'María',
              lastName: 'Rodríguez',
              phone: '3157891234'
            }
          },
          vet: {
            firstName: 'Laura',
            lastName: 'Cardona'
          }
        }
      ];
      return res.json({
        data: mockAppointments,
        total: mockAppointments.length,
        page: 1,
        pageSize: 100
      });
    }
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

    return res.json(appointments.map(a => mapAppointmentToApi(a)));
  } catch (error) {
    console.error('Error al listar citas de hoy:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Base de datos no disponible o credenciales inválidas. Retornando Fallback Mock de Citas de Hoy.');
      const mockAppointments = [
        {
          id: 'dev-appointment-1',
          clinicId: clinicId,
          patientId: 'dev-patient-1',
          vetId: 'dev-vet',
          branchId: 'dev-branch',
          scheduledAt: new Date(new Date().setHours(10, 0, 0, 0)),
          duration: 30,
          reason: 'Consulta general de control',
          status: 'scheduled',
          patient: {
            id: 'dev-patient-1',
            clinicId: clinicId,
            name: 'Toby',
            species: 'dog',
            breed: 'Golden Retriever',
            tutor: {
              id: 'dev-tutor-1',
              firstName: 'Daniel',
              lastName: 'Flórez Aguirre',
              phone: '3122115299'
            }
          },
          vet: {
            firstName: 'Laura',
            lastName: 'Cardona'
          }
        },
        {
          id: 'dev-appointment-2',
          clinicId: clinicId,
          patientId: 'dev-patient-3',
          vetId: 'dev-vet',
          branchId: 'dev-branch',
          scheduledAt: new Date(new Date().setHours(14, 30, 0, 0)),
          duration: 45,
          reason: 'Vacunación y desparasitación',
          status: 'waiting',
          patient: {
            id: 'dev-patient-3',
            clinicId: clinicId,
            name: 'Luna',
            species: 'cat',
            breed: 'Siamés',
            tutor: {
              id: 'dev-tutor-2',
              firstName: 'María',
              lastName: 'Rodríguez',
              phone: '3157891234'
            }
          },
          vet: {
            firstName: 'Laura',
            lastName: 'Cardona'
          }
        }
      ];
      return res.json(mockAppointments);
    }
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

    return res.json(mapAppointmentToApi(appointment));
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
        status: status ? toDbStatus(status) : existing.status
      },
      include: {
        patient: {
          include: { tutor: true }
        }
      }
    });

    return res.json(mapAppointmentToApi(updated));
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
      data: { status: toDbStatus(status) },
      include: {
        patient: {
          include: { tutor: true }
        }
      }
    });

    // [OPCIONAL WHATSAPP TRIGER LOGIC]
    // Si pasa a 'waiting' o 'done' se dispararía la cola BullMQ en producción

    return res.json(mapAppointmentToApi(updated));
  } catch (error) {
    console.error('Error al cambiar estado de cita:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Servidor en desarrollo y base de datos desconectada. Retornando Fallback Mock de actualización.');
      const mockApp = {
        id,
        clinicId,
        patientId: id === 'a1' ? 'p1' : (id === 'a2' ? 'p2' : (id === 'a3' ? 'p1' : 'p3')),
        status,
        scheduledAt: new Date(),
        serviceType: 'Consulta General',
        reason: 'Motivo de consulta de prueba.',
        patient: {
          id: id === 'a2' ? 'p2' : 'p1',
          name: id === 'a2' ? 'Luna' : 'Toby',
          species: id === 'a2' ? 'cat' : 'dog',
          breed: id === 'a2' ? 'Siamés' : 'Golden Retriever',
          tutor: {
            id: 't1',
            firstName: 'Daniel',
            lastName: 'Flórez Aguirre',
            phone: '3122115299',
            email: 'florezaguirredaniel@gmail.com'
          }
        }
      };
      return res.json(mockApp);
    }
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
