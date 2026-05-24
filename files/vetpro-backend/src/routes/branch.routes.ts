import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = Router();

// Todas las rutas de sucursales requieren autenticación base
router.use(authMiddleware as any);

// GET /api/v1/branches — Listar sedes físicas de la clínica
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado. ID de clínica no especificado.' });
  }

  try {
    const branches = await prisma.branch.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' }
    });

    return res.json(branches);
  } catch (error) {
    console.error('Error al listar sucursales:', error);
    return res.status(500).json({ error: 'Error al obtener las sedes físicas de la clínica.' });
  }
});

// POST /api/v1/branches — Crear nueva sucursal (Solo administradores)
router.post('/', roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { name, address, phone, email } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!name || !address || !phone) {
    return res.status(400).json({ error: 'El nombre, dirección y teléfono son obligatorios.' });
  }

  try {
    const branch = await prisma.branch.create({
      data: {
        clinicId,
        name,
        address,
        phone,
        email,
        active: true
      }
    });

    return res.status(201).json(branch);
  } catch (error) {
    console.error('Error al crear sucursal física:', error);
    return res.status(500).json({ error: 'Error interno al registrar la nueva sede física.' });
  }
});

export { router as BRANCH_ROUTES };
