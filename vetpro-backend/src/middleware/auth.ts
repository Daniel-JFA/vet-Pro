import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vetpro_super_secret_signing_key_2026_dev';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    clinicId: string;
    branchId?: string | null;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role: string;
      clinicId: string;
      branchId?: string | null;
    };

    // Defensa en profundidad: un token de super-admin de plataforma (o de tutor)
    // firma válido con el mismo JWT_SECRET pero nunca debe colar en rutas de clínica.
    if (decoded.role === 'platform_admin' || decoded.role === 'tutor') {
      return res.status(403).json({ error: 'Este token no tiene acceso a rutas de clínica.' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};
