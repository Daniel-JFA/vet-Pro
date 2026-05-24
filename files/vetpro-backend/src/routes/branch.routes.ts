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
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Base de datos no disponible o credenciales inválidas. Retornando Fallback Mock de Sucursales.');
      return res.json([
        {
          id: 'dev-branch',
          clinicId: clinicId,
          name: 'Sede Principal (Medellín)',
          address: 'Av. El Poblado #3-45',
          phone: '+57 4 604 9876',
          email: 'principal@veterinariasanjose.co',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'dev-branch-bogota',
          clinicId: clinicId,
          name: 'Sede Chapinero (Bogotá)',
          address: 'Calle 100 #15-30',
          phone: '+57 1 601 2345',
          email: 'chapinero@veterinariasanjose.co',
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ]);
    }
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
