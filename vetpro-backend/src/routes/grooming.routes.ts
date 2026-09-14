import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { GroomingStatus } from '@prisma/client';

export const GROOMING_ROUTES = Router();

GROOMING_ROUTES.use(authMiddleware as any);
GROOMING_ROUTES.use(roleMiddleware(['admin', 'vet', 'assistant', 'receptionist', 'groomer']) as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────

const CheckInGroomingSchema = z.object({
  patientId: z.string().uuid('ID de paciente inválido'),
  branchId: z.string().uuid('ID de sucursal inválido'),
  groomerId: z.string().uuid().optional().nullable(),
  serviceType: z.string().min(2, 'El tipo de servicio de spa/peluquería es obligatorio'),
  coatCondition: z.string().optional(),
  skinObservations: z.string().optional(),
  medicatedShampoo: z.string().optional(),
  behaviorNotes: z.string().optional(),
  price: z.number().nonnegative().default(45000),
  notes: z.string().optional()
});

const UpdateStatusSchema = z.object({
  status: z.nativeEnum(GroomingStatus),
  groomerId: z.string().uuid().optional()
});

// ─────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/v1/grooming (Tablero Kanban de peluquería y spa)
GROOMING_ROUTES.get(['/', '/kanban'], async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const branchId = req.query.branchId as string | undefined;
  const status = req.query.status as GroomingStatus | undefined;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const services = await prisma.groomingService.findMany({
      where: {
        clinicId,
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {})
      },
      include: {
        patient: {
          include: {
            tutor: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } }
          }
        },
        groomer: { select: { id: true, firstName: true, lastName: true } },
        branch: { select: { id: true, name: true } }
      },
      orderBy: { checkedInAt: 'desc' }
    });

    return res.json(services);
  } catch (error: any) {
    console.error('[Grooming] Error al listar servicios:', error);
    return res.status(500).json({ error: 'Error al consultar servicios de peluquería.' });
  }
});

// POST /api/v1/grooming (Ingreso / Check-in de mascota a peluquería)
GROOMING_ROUTES.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = CheckInGroomingSchema.parse(req.body);

    const [patient, branch] = await Promise.all([
      prisma.patient.findFirst({ where: { id: data.patientId, clinicId, deletedAt: null } }),
      prisma.branch.findFirst({ where: { id: data.branchId, clinicId } })
    ]);

    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado.' });
    if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada.' });

    const grooming = await prisma.groomingService.create({
      data: {
        clinicId,
        branchId: data.branchId,
        patientId: data.patientId,
        groomerId: data.groomerId,
        serviceType: data.serviceType,
        coatCondition: data.coatCondition || 'Normal',
        skinObservations: data.skinObservations || 'Sin lesiones aparentes',
        medicatedShampoo: data.medicatedShampoo,
        behaviorNotes: data.behaviorNotes || 'Tranquilo',
        price: data.price,
        status: GroomingStatus.checked_in,
        notes: data.notes
      },
      include: {
        patient: {
          include: { tutor: true }
        }
      }
    });

    return res.status(201).json(grooming);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Grooming] Error al registrar ingreso:', error);
    return res.status(500).json({ error: 'Error al ingresar mascota a peluquería.' });
  }
});

// PATCH /api/v1/grooming/:id/status (Avanzar estado en el pipeline y alertar al tutor por WhatsApp)
GROOMING_ROUTES.patch('/:id/status', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = UpdateStatusSchema.parse(req.body);

    const service = await prisma.groomingService.findFirst({
      where: { id, clinicId },
      include: {
        patient: {
          include: { tutor: true }
        },
        clinic: true
      }
    });

    if (!service) return res.status(404).json({ error: 'Servicio de peluquería no encontrado.' });

    let readyAt = service.readyAt;
    let deliveredAt = service.deliveredAt;
    let tutorNotifiedAt = service.tutorNotifiedAt;
    let whatsappPayload: { phone: string; message: string; waLink: string } | null = null;

    if (data.status === GroomingStatus.ready_for_pickup) {
      readyAt = new Date();
      tutorNotifiedAt = new Date();

      const tutorPhone = service.patient.tutor.phone.replace(/[^0-9]/g, '');
      const petName = service.patient.name;
      const tutorName = service.patient.tutor.firstName;
      const clinicName = service.clinic.name;

      const message = `¡Hola ${tutorName}! 🛁 Te contamos que ${petName} ya terminó su sesión de spa en ${clinicName} y está listo(a) para que lo recojas. ¡Quedó hermoso(a) y oliendo delicioso! ✨🐾`;
      const waLink = `https://wa.me/${tutorPhone}?text=${encodeURIComponent(message)}`;

      whatsappPayload = {
        phone: tutorPhone,
        message,
        waLink
      };
    } else if (data.status === GroomingStatus.delivered) {
      deliveredAt = new Date();
    }

    const updated = await prisma.groomingService.update({
      where: { id },
      data: {
        status: data.status,
        groomerId: data.groomerId || service.groomerId,
        readyAt,
        deliveredAt,
        tutorNotifiedAt
      },
      include: {
        patient: { include: { tutor: true } },
        groomer: true
      }
    });

    return res.json({
      success: true,
      service: updated,
      whatsappNotification: whatsappPayload
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Grooming] Error al actualizar estado:', error);
    return res.status(500).json({ error: 'Error al actualizar el estado del servicio.' });
  }
});
