import { Response, NextFunction, Request } from 'express';
import { TokenService } from '../services/token.service.js';

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
    const decoded = TokenService.verifyTutorSession(token);

    req.tutor = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Sesión de tutor inválida o expirada.' });
  }
};
