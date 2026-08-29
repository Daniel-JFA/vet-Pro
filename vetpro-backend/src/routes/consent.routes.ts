import { Router, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../config/database.js';

const router = Router();

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN CON ZOD
// ─────────────────────────────────────────────
const CreateConsentSchema = z.object({
  patientId: z.string().uuid('ID de paciente inválido'),
  patientName: z.string().min(1, 'El nombre del paciente es requerido').optional(),
  tutorName: z.string().min(1, 'El nombre del tutor es requerido').optional(),
  tutorPhone: z.string().min(1, 'El teléfono del tutor es requerido').optional(),
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres'),
  content: z.string().min(10, 'El contenido legal del consentimiento es requerido'),
  expiresInHours: z.number().min(1).max(720).default(72)
});

const SignConsentSchema = z.object({
  signature: z.string().min(10, 'La firma gráfica en formato Base64 o SVG es requerida')
});

// ─────────────────────────────────────────────
// RUTAS PROTEGIDAS (Para Veterinarios y Staff)
// ─────────────────────────────────────────────

// GET /api/v1/consent-forms (Lista de consentimientos de la clínica)
router.get('/', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    const { patientId, signed } = req.query;

    const where: any = { clinicId };
    if (patientId) where.patientId = String(patientId);
    if (signed !== undefined) where.signed = signed === 'true';

    const consentForms = await prisma.consentForm.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true,
            tutor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
                email: true
              }
            }
          }
        }
      }
    });

    return res.json(consentForms);
  } catch (error: any) {
    console.error('[ConsentRoutes] Error fetching consent forms:', error);
    return res.status(500).json({ error: 'Error al consultar los consentimientos informados.' });
  }
});

// POST /api/v1/consent-forms (Emitir nuevo consentimiento)
router.post('/', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) {
      return res.status(401).json({ error: 'No autorizado.' });
    }

    const parsed = CreateConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de consentimiento inválidos',
        details: parsed.error.format()
      });
    }

    const { patientId, title, content, expiresInHours } = parsed.data;

    // Validar que el paciente pertenezca a la clínica (Prevención IDOR)
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId },
      include: { tutor: true }
    });

    if (!patient) {
      return res.status(404).json({ error: 'El paciente no existe o no pertenece a su clínica.' });
    }

    const patientName = parsed.data.patientName || patient.name;
    const tutorName = parsed.data.tutorName || `${patient.tutor.firstName} ${patient.tutor.lastName}`.trim();
    const tutorPhone = parsed.data.tutorPhone || patient.tutor.phone;

    const expiresAt = new Date(Date.now() + (expiresInHours || 72) * 60 * 60 * 1000);

    const newConsent = await prisma.consentForm.create({
      data: {
        clinicId,
        patientId,
        patientName,
        tutorName,
        tutorPhone,
        title,
        content,
        signed: false,
        expiresAt
      },
      include: {
        patient: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return res.status(201).json(newConsent);
  } catch (error: any) {
    console.error('[ConsentRoutes] Error creating consent form:', error);
    return res.status(500).json({ error: 'Error al emitir el consentimiento informado.' });
  }
});

// ─────────────────────────────────────────────
// RUTAS PÚBLICAS / TOKENIZADAS (Para firma del Tutor en móvil)
// ─────────────────────────────────────────────

// GET /api/v1/consent-forms/:id (Visualizar para firma)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const form = await prisma.consentForm.findUnique({
      where: { id },
      include: {
        clinic: {
          select: {
            name: true,
            logoUrl: true,
            phone: true,
            address: true,
            city: true
          }
        },
        patient: {
          select: {
            id: true,
            name: true,
            species: true,
            breed: true
          }
        }
      }
    });

    if (!form) {
      return res.status(404).json({ error: 'Documento de consentimiento no encontrado.' });
    }

    const isExpired = new Date() > new Date(form.expiresAt);

    return res.json({
      ...form,
      isExpired
    });
  } catch (error: any) {
    console.error('[ConsentRoutes] Error fetching public consent:', error);
    return res.status(500).json({ error: 'Error al cargar el consentimiento.' });
  }
});

// PATCH /api/v1/consent-forms/:id/sign (Registrar firma del tutor)
router.patch('/:id/sign', async (req, res) => {
  try {
    const { id } = req.params;

    const parsed = SignConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'La firma gráfica es obligatoria.',
        details: parsed.error.format()
      });
    }

    const form = await prisma.consentForm.findUnique({
      where: { id }
    });

    if (!form) {
      return res.status(404).json({ error: 'Documento de consentimiento no encontrado.' });
    }

    if (form.signed) {
      return res.status(400).json({ error: 'Este documento ya se encuentra firmado.' });
    }

    if (new Date() > new Date(form.expiresAt)) {
      return res.status(410).json({
        error: 'Este documento de consentimiento ha expirado. Solicite uno nuevo a la clínica.'
      });
    }

    const updated = await prisma.consentForm.update({
      where: { id },
      data: {
        signed: true,
        signature: parsed.data.signature,
        signedAt: new Date()
      }
    });

    return res.json({
      message: 'Consentimiento firmado exitosamente.',
      consent: updated
    });
  } catch (error: any) {
    console.error('[ConsentRoutes] Error signing consent form:', error);
    return res.status(500).json({ error: 'Error al procesar la firma del documento.' });
  }
});

export const CONSENT_ROUTES = router;
