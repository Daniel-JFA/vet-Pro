import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { PERMISSIONS as P } from '../config/permissions.js';

const router = Router();

// Activar verificación de token JWT para todas las rutas de tutores
router.use(authMiddleware as any);

// GET /tutors (Listado de tutores de la clínica)
router.get('/', roleMiddleware(P.CLINIC_READ as unknown as string[]) as any, async (req: AuthRequest, res: Response) => {
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
        include: {
          patients: {
            where: { deletedAt: null },
            select: { id: true, name: true, species: true },
            orderBy: { name: 'asc' }
          }
        },
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
router.post('/', roleMiddleware(P.FRONT_DESK as unknown as string[]) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { firstName, lastName, email, phone, documentId, address, notes, allowDuplicate } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!firstName || !lastName || !phone) {
    return res.status(400).json({ error: 'Nombre, apellido y teléfono son campos obligatorios.' });
  }

  try {
    // Evitar duplicar clientes: mismo teléfono o mismo documento dentro de la clínica.
    // El cliente puede confirmar que es otra persona con allowDuplicate.
    if (!allowDuplicate) {
      const trimmedPhone = String(phone).trim();
      const trimmedDocument = documentId ? String(documentId).trim() : '';
      const existing = await prisma.tutor.findFirst({
        where: {
          clinicId,
          deletedAt: null,
          OR: [
            { phone: trimmedPhone },
            ...(trimmedDocument ? [{ documentId: trimmedDocument }] : [])
          ]
        },
        select: { id: true, firstName: true, lastName: true, phone: true, documentId: true }
      });

      if (existing) {
        return res.status(409).json({
          code: 'DUPLICATE_TUTOR',
          error: `Ya existe un tutor con ese ${existing.phone === trimmedPhone ? 'teléfono' : 'documento'}: ${existing.firstName} ${existing.lastName}.`,
          existing
        });
      }
    }

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

// GET /tutors/:id (Detalle de un tutor)
router.get('/:id', roleMiddleware(P.CLINIC_READ as unknown as string[]) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const tutor = await prisma.tutor.findFirst({ where: { id, clinicId } });
    if (!tutor) return res.status(404).json({ error: 'Tutor no encontrado.' });
    return res.json(tutor);
  } catch (error) {
    console.error('Error al consultar tutor:', error);
    return res.status(500).json({ error: 'Error al consultar el tutor.' });
  }
});

// PATCH /tutors/:id (Editar datos de contacto del tutor)
router.patch('/:id', roleMiddleware(P.FRONT_DESK as unknown as string[]) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { firstName, lastName, email, phone, documentId, address, notes } = req.body;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const existing = await prisma.tutor.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ error: 'Tutor no encontrado.' });

    const updated = await prisma.tutor.update({
      where: { id },
      data: {
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(phone !== undefined ? { phone } : {}),
        ...(documentId !== undefined ? { documentId } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(notes !== undefined ? { notes } : {})
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error al actualizar tutor:', error);
    return res.status(500).json({ error: 'Error al actualizar el tutor.' });
  }
});

export const TUTOR_ROUTES = router;
