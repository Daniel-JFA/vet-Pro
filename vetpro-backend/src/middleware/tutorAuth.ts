import { Response, NextFunction, Request } from 'express';
import { TokenService } from '../services/token.service.js';
import { prisma } from '../config/database.js';

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

  let decoded;
  try {
    decoded = TokenService.verifyTutorSession(token);
  } catch (error) {
    return res.status(401).json({ error: 'Sesión de tutor inválida o expirada.' });
  }

  // La sesión dura 7 días: si el tutor eliminó sus datos, se corta de inmediato
  prisma.tutor
    .findUnique({ where: { id: decoded.id }, select: { anonymizedAt: true } })
    .then((tutor) => {
      if (!tutor || tutor.anonymizedAt) {
        return res.status(401).json({ error: 'Sesión de tutor inválida o expirada.' });
      }
      req.tutor = decoded;
      next();
    })
    .catch(next);
};
