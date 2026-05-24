import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'vetpro_super_secret_signing_key_2026_dev';

export interface TutorAuthRequest extends Request {
  tutor?: {
    id: string;
    phone: string;
    clinicId: string;
  };
}

export const tutorAuthMiddleware = (req: TutorAuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      phone: string;
      clinicId: string;
      role?: string;
    };
    
    if (decoded.role !== 'tutor') {
      return res.status(403).json({ error: 'Acceso restringido. Se requiere rol de tutor.' });
    }

    req.tutor = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Token de tutor inválido o expirado.' });
  }
};
