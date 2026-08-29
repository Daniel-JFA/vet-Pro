import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env var is not set. Refusing to start.');
  process.exit(1);
}

function toUserResponse(user: {
  id: string;
  clinicId: string;
  branchId?: string | null;
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
    branchId: user.branchId ?? null,
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

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { clinic: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
    }

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
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'No autorizado.' });
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
