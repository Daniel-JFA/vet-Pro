import { Response, NextFunction, Request } from 'express';
import { TokenService } from '../services/token.service.js';

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
    const decoded = TokenService.verifyPlatform(token);

    req.platformAdmin = { id: decoded.id, email: decoded.email, role: 'platform_admin' };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sesión de plataforma inválida o expirada.' });
  }
};
