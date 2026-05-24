import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Almacén en memoria persistente durante la ejecución del proceso
interface ConsentForm {
  id: string;
  clinicId: string;
  patientId: string;
  patientName: string;
  tutorName: string;
  tutorPhone: string;
  title: string;
  content: string;
  signed: boolean;
  signature?: string; // Base64
  signedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

const MEMORY_CONSENTS: ConsentForm[] = [
  {
    id: 'c-form-1',
    clinicId: 'c1',
    patientId: 'p1',
    patientName: 'Toby',
    tutorName: 'Carlos Gómez',
    tutorPhone: '+57 312 456 7890',
    title: 'Autorización para Anestesia y Cirugía',
    content: 'Por medio del presente documento, yo Carlos Gómez autorizo a la clínica veterinaria VetPro a realizar el procedimiento de castración bajo anestesia general inhalatoria para mi mascota Toby. Entiendo los riesgos quirúrgicos implícitos...',
    signed: true,
    signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACWCAYAAAB...',
    signedAt: new Date(Date.now() - 1 * 86400000),
    expiresAt: new Date(Date.now() + 2 * 86400000),
    createdAt: new Date(Date.now() - 1 * 86400000)
  },
  {
    id: 'c-form-2',
    clinicId: 'c1',
    patientId: 'p1',
    patientName: 'Toby',
    tutorName: 'Carlos Gómez',
    tutorPhone: '+57 312 456 7890',
    title: 'Consentimiento para Hospitalización General',
    content: 'Por medio del presente documento, yo Carlos Gómez autorizo a la clínica veterinaria VetPro a hospitalizar a mi mascota Toby para administración de terapia de fluidos endovenosos y monitoreo clínico...',
    signed: false,
    expiresAt: new Date(Date.now() + 3 * 86400000),
    createdAt: new Date()
  }
];

// ─────────────────────────────────────────────
// RUTAS PROTEGIDAS (Para Veterinarios)
// ─────────────────────────────────────────────

// GET /api/v1/consent-forms (Lista general en panel vet)
router.get('/', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const list = MEMORY_CONSENTS.filter(c => c.clinicId === clinicId);
  return res.json(list);
});

// POST /api/v1/consent-forms (Vets generan nuevo consentimiento)
router.post('/', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { patientId, patientName, tutorName, tutorPhone, title, content } = req.body;

  if (!patientId || !patientName || !tutorName || !tutorPhone || !title || !content) {
    return res.status(400).json({ error: 'Todos los campos son requeridos para emitir un consentimiento.' });
  }

  const newForm: ConsentForm = {
    id: `c-form-${Date.now()}`,
    clinicId,
    patientId,
    patientName,
    tutorName,
    tutorPhone,
    title,
    content,
    signed: false,
    expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000), // Expiración en 72h
    createdAt: new Date()
  };

  MEMORY_CONSENTS.push(newForm);
  return res.status(201).json(newForm);
});

// ─────────────────────────────────────────────
// RUTAS PÚBLICAS (Para que el Tutor firme desde su celular)
// ─────────────────────────────────────────────

// GET /api/v1/consent-forms/:id (Visualizar el consentimiento)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const form = MEMORY_CONSENTS.find(c => c.id === id);

  if (!form) {
    return res.status(404).json({ error: 'Documento de consentimiento no encontrado.' });
  }

  // Verificar si expiró
  if (new Date() > new Date(form.expiresAt)) {
    return res.status(410).json({ error: 'Este documento de consentimiento ha expirado (límite de 72 horas excedido).' });
  }

  return res.json(form);
});

// PATCH /api/v1/consent-forms/:id/sign (Registrar la firma del tutor)
router.patch('/:id/sign', async (req, res) => {
  const { id } = req.params;
  const { signature } = req.body;

  if (!signature) {
    return res.status(400).json({ error: 'La firma gráfica es obligatoria.' });
  }

  const form = MEMORY_CONSENTS.find(c => c.id === id);

  if (!form) {
    return res.status(404).json({ error: 'Documento no encontrado.' });
  }

  if (form.signed) {
    return res.status(400).json({ error: 'Este documento ya se encuentra firmado.' });
  }

  form.signed = true;
  form.signature = signature;
  form.signedAt = new Date();

  return res.json(form);
});

export const CONSENT_ROUTES = router;
