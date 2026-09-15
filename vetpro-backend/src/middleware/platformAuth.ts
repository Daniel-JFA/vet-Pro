import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vetpro_super_secret_signing_key_2026_dev';

export interface PlatformAuthRequest extends Request {
  platformAdmin?: {
    id: string;
    email: string;
    role: 'platform_admin';
  };
}

export const platformAuthMiddleware = (req: PlatformAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      role?: string;
    };

    if (decoded.role !== 'platform_admin') {
      return res.status(403).json({ error: 'Acceso restringido. Se requiere rol de super-administrador.' });
    }

    req.platformAdmin = { id: decoded.id, email: decoded.email, role: 'platform_admin' };
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token de plataforma inválido o expirado.' });
  }
};
