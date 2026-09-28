import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { MailerService } from '../services/mailer.service.js';

const router = Router();

const DeletionRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  audience: z.enum(['clinic_staff', 'tutor', 'other']),
  clinicName: z.string().trim().max(200).optional(),
  message: z.string().trim().max(2000).optional()
});

// POST /api/v1/privacy/deletion-requests — Solicitud pública de eliminación de datos
// (página /eliminar-cuenta), exigida por Google Play para quien no usa la app.
router.post('/deletion-requests', async (req, res) => {
  const parsed = DeletionRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Revisa el correo y el tipo de cuenta.' });
  }

  try {
    const request = await prisma.dataDeletionRequest.create({ data: parsed.data });

    const to = process.env.PRIVACY_EMAIL || process.env.SMTP_USER;
    if (to) {
      MailerService.sendDataDeletionRequestNotice({ to, requesterEmail: request.email, ...parsed.data }).catch(() => undefined);
    }

    return res.status(201).json({
      message: 'Recibimos tu solicitud. Te responderemos al correo indicado en un máximo de 15 días hábiles.'
    });
  } catch (error) {
    console.error('Error al registrar solicitud de eliminación:', error);
    return res.status(500).json({ error: 'No se pudo registrar la solicitud. Intenta de nuevo.' });
  }
});

export { router as PRIVACY_ROUTES };
