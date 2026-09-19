import { Response, NextFunction, Request } from 'express';
import { TokenService } from '../services/token.service.js';

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
    // Solo valida tokens emitidos para el personal de clínica (audience 'staff'):
    // los de tutor y super-admin de plataforma no pasan aunque compartan la firma.
    const decoded = TokenService.verifyStaff(token);

    req.user = decoded;
    next();
  } catch (error) {
    // 401 (no 403) para que el frontend cierre la sesión y pida iniciar de nuevo
    return res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }
};
