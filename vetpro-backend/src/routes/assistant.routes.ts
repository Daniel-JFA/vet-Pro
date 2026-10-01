import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AiService } from '../services/ai.service.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Solo usuarios con sesión: cada mensaje consume la clave de OpenAI de VetPro
router.use(authMiddleware as any);

// Tope por usuario para que nadie dispare el gasto de IA
const assistantLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as AuthRequest).user?.id || 'anon',
  message: { action: 'REPLY', payload: 'Has enviado muchos mensajes seguidos. Espera un minuto e intenta de nuevo.' }
});

const ChatSchema = z.object({
  message: z.string().trim().min(1, 'El mensaje es obligatorio').max(500, 'El mensaje es demasiado largo'),
  context: z.string().max(200).optional().default('')
});

// Rutas a las que el asistente puede llevar al usuario (la respuesta de la IA
// no se usa tal cual para navegar)
const ALLOWED_ROUTES = ['/dashboard', '/patients', '/appointments', '/billing', '/inventory', '/reports', '/grooming'];

function isAllowedRoute(path: string): boolean {
  const base = path.split(/[?#]/)[0];
  return ALLOWED_ROUTES.includes(base);
}

router.post('/chat', assistantLimiter, async (req: AuthRequest, res: Response) => {
  const parsed = ChatSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Mensaje inválido' });
  }

  try {
    const { message, context } = parsed.data;
    const response = await AiService.processAssistantCommand(message, context);
    if (response?.action === 'NAVIGATE') {
      if (typeof response.payload !== 'string' || !isAllowedRoute(response.payload)) {
        return res.json({ action: 'REPLY', payload: 'No encontré esa sección. Usa el menú lateral para navegar.' });
      }
      return res.json(response);
    }
    return res.json({ action: 'REPLY', payload: String(response?.payload ?? '') });
  } catch (error) {
    console.error('[Assistant Route Error]:', error);
    res.status(500).json({ action: 'REPLY', payload: 'Lo siento, hubo un error procesando tu solicitud en este momento.' });
  }
});

export const ASSISTANT_ROUTES = router;
