import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Activar verificación de token JWT para todas las rutas de pacientes
router.use(authMiddleware as any);

// GET /patients (Listado de pacientes paginado con filtros)
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado. ID de clínica no especificado.' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const skip = (page - 1) * pageSize;

  const search = req.query.search as string;
  const species = req.query.species as string;
  const status = req.query.status as string;

  try {
    const whereClause: any = { clinicId };

    if (species) {
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
        include: { tutor: true },
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
  } catch (error) {
    console.error('Error al listar pacientes:', error);
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Base de datos no disponible o credenciales inválidas. Retornando Fallback Mock de Pacientes.');
      const mockPatients = [
        {
          id: 'dev-patient-1',
          clinicId: clinicId,
          name: 'Toby',
          species: 'dog',
          breed: 'Golden Retriever',
          sex: 'male',
          sterilized: true,
          weight: 32.5,
          chipId: '985112003456789',
          photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          tutor: {
            id: 'dev-tutor-1',
            clinicId: clinicId,
            firstName: 'Carlos',
            lastName: 'Gómez',
            email: 'carlos@gmail.com',
            phone: '3124567890',
            documentId: '1018234567',
            address: 'Calle 100 #15-30, Bogotá'
          }
        },
        {
          id: 'dev-patient-2',
          clinicId: clinicId,
          name: 'Kira',
          species: 'dog',
          breed: 'Bulldog Francés',
          sex: 'female',
          sterilized: false,
          weight: 11.8,
          chipId: '985112003456781',
          photoUrl: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          tutor: {
            id: 'dev-tutor-1',
            clinicId: clinicId,
            firstName: 'Carlos',
            lastName: 'Gómez',
            email: 'carlos@gmail.com',
            phone: '3124567890',
            documentId: '1018234567',
            address: 'Calle 100 #15-30, Bogotá'
          }
        },
        {
          id: 'dev-patient-3',
          clinicId: clinicId,
          name: 'Luna',
          species: 'cat',
          breed: 'Siamés',
          sex: 'female',
          sterilized: true,
          weight: 4.2,
          chipId: '985112003456780',
          photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=150',
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          tutor: {
            id: 'dev-tutor-2',
            clinicId: clinicId,
            firstName: 'María',
            lastName: 'Rodríguez',
            email: 'maria@outlook.com',
            phone: '3157891234',
            documentId: '52345678',
            address: 'Carrera 7 #45-12, Medellín'
          }
        }
      ];
      return res.json({
        data: mockPatients,
        total: mockPatients.length,
        page: 1,
        pageSize: 20
      });
    }
    return res.status(500).json({ error: 'Error al obtener expedientes de pacientes.' });
  }
});

// GET /patients/:id (Ficha completa de mascota)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const patient = await prisma.patient.findFirst({
      where: { id, clinicId },
      include: { tutor: true }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado o expediente inaccesible.' });
    }

    return res.json(patient);
  } catch (error) {
    console.error('Error al buscar paciente:', error);
    return res.status(500).json({ error: 'Error al obtener ficha de mascota.' });
  }
});

// POST /patients (Crear nueva mascota)
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const {
    name, species, breed, birthDate, sex, sterilized,
    weight, chipId, photoUrl, allergies, notes, status, tutorId
  } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!name || !species || !sex || !tutorId) {
    return res.status(400).json({ error: 'Nombre, especie, sexo y tutorId son campos obligatorios.' });
  }

  try {
    const patient = await prisma.patient.create({
      data: {
        clinicId,
        tutorId,
        name,
        species,
        breed,
        birthDate: birthDate ? new Date(birthDate) : null,
        sex,
        sterilized: !!sterilized,
        weight: weight ? parseFloat(weight) : null,
        chipId,
        photoUrl,
        allergies,
        notes,
        status: status || 'active'
      },
      include: { tutor: true }
    });

    return res.status(201).json(patient);
  } catch (error) {
    console.error('Error al crear paciente:', error);
    return res.status(500).json({ error: 'Error al registrar expediente de mascota.' });
  }
});

// PUT /patients/:id (Editar mascota)
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const {
    name, species, breed, birthDate, sex, sterilized,
    weight, chipId, photoUrl, allergies, notes, status, tutorId
  } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const existing = await prisma.patient.findFirst({
      where: { id, clinicId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Expediente no encontrado.' });
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        tutorId: tutorId || existing.tutorId,
        name: name || existing.name,
        species: species || existing.species,
        breed: breed !== undefined ? breed : existing.breed,
        birthDate: birthDate ? new Date(birthDate) : existing.birthDate,
        sex: sex || existing.sex,
        sterilized: sterilized !== undefined ? !!sterilized : existing.sterilized,
        weight: weight !== undefined ? (weight ? parseFloat(weight) : null) : existing.weight,
        chipId: chipId !== undefined ? chipId : existing.chipId,
        photoUrl: photoUrl !== undefined ? photoUrl : existing.photoUrl,
        allergies: allergies !== undefined ? allergies : existing.allergies,
        notes: notes !== undefined ? notes : existing.notes,
        status: status || existing.status
      },
      include: { tutor: true }
    });

    return res.json(patient);
  } catch (error) {
    console.error('Error al editar paciente:', error);
    return res.status(500).json({ error: 'Error al actualizar expediente.' });
  }
});

// GET /patients/:id/medical-records (Timeline Clínico)
router.get('/:id/medical-records', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const patient = await prisma.patient.findFirst({ where: { id, clinicId } });
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    const records = await prisma.medicalRecord.findMany({
      where: { patientId: id, clinicId },
      include: {
        vet: {
          select: { firstName: true, lastName: true }
        },
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Mapear respuesta para aplanar el nombre del veterinario
    const mappedRecords = records.map(r => ({
      ...r,
      vetId: `Dr(a). ${r.vet.firstName} ${r.vet.lastName}` // Formato estandarizado para frontend
    }));

    return res.json(mappedRecords);
  } catch (error) {
    console.error('Error al listar historias:', error);
    return res.status(500).json({ error: 'Error al obtener timeline clínico.' });
  }
});

// GET /patients/:id/vaccines (Cartilla de vacunas aplicadas)
router.get('/:id/vaccines', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const patient = await prisma.patient.findFirst({ where: { id, clinicId } });
    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    const vaccines = await prisma.vaccine.findMany({
      where: { patientId: id },
      include: {
        vet: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { appliedAt: 'desc' }
    });

    const mappedVaccines = vaccines.map(v => ({
      ...v,
      vetId: `Dr(a). ${v.vet.firstName} ${v.vet.lastName}`
    }));

    return res.json(mappedVaccines);
  } catch (error) {
    console.error('Error al listar vacunas:', error);
    return res.status(500).json({ error: 'Error al obtener cartilla de vacunas.' });
  }
});

export const PATIENT_ROUTES = router;
