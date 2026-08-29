import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { PatientSpecies, PatientSex, PatientStatus } from '@prisma/client';

const router = Router();
router.use(authMiddleware as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────
const CreatePatientSchema = z.object({
  tutorId: z.string().uuid('ID de tutor inválido'),
  name: z.string().min(1, 'El nombre de la mascota es obligatorio'),
  species: z.nativeEnum(PatientSpecies),
  breed: z.string().optional().nullable(),
  birthDate: z.string().datetime().optional().nullable(),
  sex: z.nativeEnum(PatientSex),
  sterilized: z.boolean().default(false),
  weight: z.number().positive().optional().nullable(),
  chipId: z.string().optional().nullable(),
  photoUrl: z.string().url().optional().nullable().or(z.literal('')),
  allergies: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.nativeEnum(PatientStatus).default(PatientStatus.active)
});

const UpdatePatientSchema = CreatePatientSchema.partial();

// ─────────────────────────────────────────────
// ENDPOINTS DE PACIENTES
// ─────────────────────────────────────────────

// GET /api/v1/patients (Listado de Pacientes con Búsqueda y Paginación)
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const skip = (page - 1) * pageSize;

  const species = req.query.species as string;
  const status = req.query.status as string;
  const search = req.query.search as string;

  try {
    const whereClause: any = {
      clinicId,
      deletedAt: null
    };

    if (species && species !== 'all') {
      whereClause.species = species;
    }

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      const q = search.trim().toLowerCase();
      whereClause.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { breed: { contains: q, mode: 'insensitive' } },
        { chipId: { contains: q } },
        { tutor: { firstName: { contains: q, mode: 'insensitive' } } },
        { tutor: { lastName: { contains: q, mode: 'insensitive' } } },
        { tutor: { phone: { contains: q } } }
      ];
    }

    const [patients, total] = await prisma.$transaction([
      prisma.patient.findMany({
        where: whereClause,
        include: {
          tutor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize
      }),
      prisma.patient.count({ where: whereClause })
    ]);

    return res.json({
      data: patients,
      total,
      page,
      pageSize
    });
  } catch (error: any) {
    console.error('[PatientRoutes] Error al listar pacientes:', error);
    return res.status(500).json({ error: 'Error interno al consultar los pacientes.' });
  }
});

// GET /api/v1/patients/:id (Ficha Completa de Mascota)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const patient = await prisma.patient.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        tutor: true,
        vaccines: {
          orderBy: { appliedAt: 'desc' },
          take: 10
        },
        appointments: {
          orderBy: { scheduledAt: 'desc' },
          take: 5
        },
        medicalRecords: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado o expediente inaccesible.' });
    }

    return res.json(patient);
  } catch (error: any) {
    console.error('[PatientRoutes] Error al buscar paciente:', error);
    return res.status(500).json({ error: 'Error al obtener ficha de mascota.' });
  }
});

// POST /api/v1/patients (Crear Nueva Mascota con Protección IDOR)
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const parsed = CreatePatientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos del paciente inválidos',
      details: parsed.error.format()
    });
  }

  const data = parsed.data;

  try {
    // Validar que el tutor pertenezca a la clínica (Anti-IDOR)
    const tutor = await prisma.tutor.findFirst({
      where: { id: data.tutorId, clinicId, deletedAt: null }
    });

    if (!tutor) {
      return res.status(404).json({ error: 'El tutor especificado no existe o no pertenece a su clínica.' });
    }

    const patient = await prisma.patient.create({
      data: {
        clinicId,
        tutorId: data.tutorId,
        name: data.name,
        species: data.species,
        breed: data.breed || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        sex: data.sex,
        sterilized: data.sterilized,
        weight: data.weight || null,
        chipId: data.chipId || null,
        photoUrl: data.photoUrl || null,
        allergies: data.allergies || null,
        notes: data.notes || null,
        status: data.status
      },
      include: { tutor: true }
    });

    return res.status(201).json(patient);
  } catch (error: any) {
    console.error('[PatientRoutes] Error al crear paciente:', error);
    return res.status(500).json({ error: 'Error al registrar expediente de mascota.' });
  }
});

// PUT /api/v1/patients/:id (Editar Mascota)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const parsed = UpdatePatientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos de actualización inválidos',
      details: parsed.error.format()
    });
  }

  const data = parsed.data;

  try {
    const existing = await prisma.patient.findFirst({
      where: { id, clinicId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Expediente de paciente no encontrado.' });
    }

    if (data.tutorId && data.tutorId !== existing.tutorId) {
      const tutor = await prisma.tutor.findFirst({
        where: { id: data.tutorId, clinicId, deletedAt: null }
      });
      if (!tutor) {
        return res.status(404).json({ error: 'El tutor especificado no pertenece a su clínica.' });
      }
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.species !== undefined && { species: data.species }),
        ...(data.breed !== undefined && { breed: data.breed }),
        ...(data.birthDate !== undefined && { birthDate: data.birthDate ? new Date(data.birthDate) : null }),
        ...(data.sex !== undefined && { sex: data.sex }),
        ...(data.sterilized !== undefined && { sterilized: data.sterilized }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.chipId !== undefined && { chipId: data.chipId }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        ...(data.allergies !== undefined && { allergies: data.allergies }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.tutorId !== undefined && { tutorId: data.tutorId })
      },
      include: { tutor: true }
    });

    return res.json(patient);
  } catch (error: any) {
    console.error('[PatientRoutes] Error al actualizar paciente:', error);
    return res.status(500).json({ error: 'Error al actualizar expediente de mascota.' });
  }
});

// DELETE /api/v1/patients/:id (Soft Delete de Mascota)
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const existing = await prisma.patient.findFirst({
      where: { id, clinicId, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    await prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() }
    });

    return res.json({ message: 'Paciente eliminado correctamente del sistema.' });
  } catch (error: any) {
    console.error('[PatientRoutes] Error al eliminar paciente:', error);
    return res.status(500).json({ error: 'Error al eliminar el expediente del paciente.' });
  }
});

export const PATIENT_ROUTES = router;
