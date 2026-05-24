import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vetpro_super_secret_signing_key_2026_dev';
const isDevelopment = process.env.NODE_ENV !== 'production';

const demoClinic = {
  id: 'dev-clinic',
  name: 'Clínica Veterinaria San José',
  nit: '900.123.456-7',
  phone: '+57 1 601 2345',
  email: 'contacto@veterinariasanjose.co',
  address: 'Calle 100 #15-30',
  city: 'Medellín',
  plan: 'pro',
  aiMinutesUsed: 0,
  aiMinutesLimit: 120,
  createdAt: new Date(),
  updatedAt: new Date()
};

const demoUsers = [
  {
    id: 'dev-admin',
    clinicId: demoClinic.id,
    branchId: 'dev-branch',
    firstName: 'Andrés',
    lastName: 'Espinoza',
    email: 'admin@vetpro.co',
    password: 'admin123',
    role: 'admin',
    avatarUrl: null,
    active: true
  },
  {
    id: 'dev-vet',
    clinicId: demoClinic.id,
    branchId: 'dev-branch',
    firstName: 'Laura',
    lastName: 'Cardona',
    email: 'vet@vetpro.co',
    password: 'vet123',
    role: 'vet',
    avatarUrl: null,
    active: true
  }
];

function toUserResponse(user: {
  id: string;
  clinicId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  active: boolean;
}) {
  return {
    id: user.id,
    clinicId: user.clinicId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    active: user.active
  };
}

function signToken(user: {
  id: string;
  email: string;
  role: string;
  clinicId: string;
  branchId?: string | null;
}) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      branchId: user.branchId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function findDemoUser(email: string, password?: string) {
  return demoUsers.find(user =>
    user.email === email && (password === undefined || user.password === password)
  );
}

function sendDemoLogin(res: Response, email: string, password: string) {
  const user = findDemoUser(email, password);
  if (!isDevelopment || !user) return false;

  return res.json({
    token: signToken(user),
    user: toUserResponse(user),
    clinic: demoClinic
  });
}

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }

  try {
    // Buscar el usuario e incluir los datos de su clínica asociada
    const user = await prisma.user.findUnique({
      where: { email },
      include: { clinic: true }
    });

    if (!user) {
      if (sendDemoLogin(res, email, password)) return;
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
    }

    // Validar contraseña
    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    return res.json({
      token: signToken(user),
      user: toUserResponse(user),
      clinic: user.clinic
    });
  } catch (error) {
    console.error('Error en /auth/login:', error);
    if (isDevelopment) {
      const demoUser = findDemoUser(email);
      if (demoUser) {
        if (demoUser.password === password) {
          return res.json({
            token: signToken(demoUser),
            user: toUserResponse(demoUser),
            clinic: demoClinic
          });
        } else {
          return res.status(401).json({ error: 'Credenciales inválidas.' });
        }
      }
    }
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /auth/me (Verificación del token de sesión)
router.get('/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (isDevelopment && userId.startsWith('dev-')) {
    const demoUser = demoUsers.find(user => user.id === userId);
    if (demoUser) {
      return res.json({
        user: toUserResponse(demoUser),
        clinic: demoClinic
      });
    }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.json({
      user: toUserResponse(user),
      clinic: user.clinic
    });
  } catch (error) {
    console.error('Error en /auth/me:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

export const AUTH_ROUTES = router;
