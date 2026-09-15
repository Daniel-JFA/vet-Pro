import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { platformAuthMiddleware, PlatformAuthRequest } from '../middleware/platformAuth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

// POST /platform/auth/login
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }

  try {
    const admin = await prisma.platformAdmin.findUnique({ where: { email } });

    if (!admin || !admin.active) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'platform_admin' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      admin: { id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName }
    });
  } catch (error) {
    console.error('Error en /platform/auth/login:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /platform/auth/me
router.get('/auth/me', platformAuthMiddleware as any, async (req: PlatformAuthRequest, res: Response) => {
  const admin = await prisma.platformAdmin.findUnique({ where: { id: req.platformAdmin!.id } });
  if (!admin) return res.status(404).json({ error: 'Super-administrador no encontrado.' });
  return res.json({ id: admin.id, email: admin.email, firstName: admin.firstName, lastName: admin.lastName });
});

// GET /platform/stats (totales agregados de toda la plataforma)
router.get('/stats', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    const [clinicsCount, usersCount, patientsCount, appointmentsCount] = await Promise.all([
      prisma.clinic.count(),
      prisma.user.count(),
      prisma.patient.count(),
      prisma.appointment.count()
    ]);

    return res.json({ clinicsCount, usersCount, patientsCount, appointmentsCount });
  } catch (error) {
    console.error('Error en /platform/stats:', error);
    return res.status(500).json({ error: 'Error al calcular estadísticas de la plataforma.' });
  }
});

// GET /platform/clinics (lista de tenants con conteo de usuarios y pacientes, sin data clínica)
router.get('/clinics', platformAuthMiddleware as any, async (_req: PlatformAuthRequest, res: Response) => {
  try {
    const clinics = await prisma.clinic.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        businessType: true,
        plan: true,
        email: true,
        city: true,
        createdAt: true,
        _count: {
          select: { users: true, patients: true, branches: true, tutors: true }
        }
      }
    });

    return res.json(clinics.map(c => ({
      id: c.id,
      name: c.name,
      businessType: c.businessType,
      plan: c.plan,
      email: c.email,
      city: c.city,
      createdAt: c.createdAt,
      usersCount: c._count.users,
      patientsCount: c._count.patients,
      branchesCount: c._count.branches,
      tutorsCount: c._count.tutors
    })));
  } catch (error) {
    console.error('Error en /platform/clinics:', error);
    return res.status(500).json({ error: 'Error al consultar los tenants de la plataforma.' });
  }
});

export const PLATFORM_ROUTES = router;
