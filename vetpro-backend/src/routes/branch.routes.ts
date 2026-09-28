import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { PlanLimitsService } from '../services/plan-limits.service.js';

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
    await PlanLimitsService.assertCanAddBranch(clinicId);

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
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al crear sucursal física:', error);
    return res.status(500).json({ error: 'Error interno al registrar la nueva sede física.' });
  }
});

// PATCH /api/v1/branches/:id — Actualizar datos de una sede (Solo administradores)
router.patch('/:id', roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { name, address, phone, email } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const existing = await prisma.branch.findFirst({ where: { id, clinicId } });
    if (!existing) {
      return res.status(404).json({ error: 'Sede no encontrada.' });
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name ? { name: String(name).trim() } : {}),
        ...(address ? { address: String(address).trim() } : {}),
        ...(phone ? { phone: String(phone).trim() } : {}),
        ...(email !== undefined ? { email: email ? String(email).trim() : null } : {})
      }
    });

    return res.json(branch);
  } catch (error) {
    console.error('Error al actualizar sucursal:', error);
    return res.status(500).json({ error: 'Error interno al actualizar la sede.' });
  }
});

export { router as BRANCH_ROUTES };
