import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Activar verificación de token JWT para todas las rutas de tutores
router.use(authMiddleware as any);

// GET /tutors (Listado de tutores de la clínica)
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado. ID de clínica no especificado.' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const skip = (page - 1) * pageSize;
  const search = req.query.search as string;

  try {
    const whereClause: any = { clinicId };

    if (search) {
      const q = search.trim().toLowerCase();
      whereClause.OR = [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { documentId: { contains: q } }
      ];
    }

    const [tutors, total] = await prisma.$transaction([
      prisma.tutor.findMany({
        where: whereClause,
        orderBy: { firstName: 'asc' },
        skip,
        take: pageSize
      }),
      prisma.tutor.count({ where: whereClause })
    ]);

    return res.json({
      data: tutors,
      total,
      page,
      pageSize
    });
  } catch (error) {
    console.error('Error al listar tutores:', error);
    return res.status(500).json({ error: 'Error al obtener listado de tutores.' });
  }
});

// POST /tutors (Crear nuevo tutor)
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { firstName, lastName, email, phone, documentId, address, notes } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Nombre, apellido y teléfono son campos obligatorios.' });
  }

  try {
    const tutor = await prisma.tutor.create({
      data: {
        clinicId,
        firstName,
        lastName,
        email,
        phone,
        documentId,
        address,
        notes
      }
    });

    return res.status(201).json(tutor);
  } catch (error) {
    console.error('Error al crear tutor:', error);
    return res.status(500).json({ error: 'Error al registrar el tutor en el sistema.' });
  }
});

export const TUTOR_ROUTES = router;
