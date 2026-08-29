import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { RecordType, AttachmentType, AppointmentStatus } from '@prisma/client';

const router = Router();

router.use(authMiddleware as any);
router.use(roleMiddleware(['admin', 'vet', 'assistant']) as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────
const AttachmentSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(AttachmentType).default(AttachmentType.other),
  url: z.string().url(),
  size: z.number().int().nonnegative().default(0)
});

const CreateMedicalRecordSchema = z.object({
  patientId: z.string().uuid('ID de paciente inválido'),
  appointmentId: z.string().uuid('ID de cita inválido').optional().nullable(),
  type: z.nativeEnum(RecordType).default(RecordType.consultation),
  title: z.string().min(1, 'El título o motivo de la consulta es obligatorio'),
  anamnesis: z.string().optional().nullable(),
  physicalExam: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  treatment: z.string().optional().nullable(),
  observations: z.string().optional().nullable(),
  aiGenerated: z.boolean().default(false),
  aiTranscriptionMinutes: z.number().positive().optional().nullable(),
  weight: z.number().positive().optional().nullable(),
  attachments: z.array(AttachmentSchema).optional().nullable()
});

// ─────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/v1/medical-records/patient/:patientId (Historial cronológico de una mascota)
router.get('/patient/:patientId', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { patientId } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId, deletedAt: null }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    const records = await prisma.medicalRecord.findMany({
      where: { patientId, clinicId },
      include: {
        vet: {
          select: { id: true, firstName: true, lastName: true, role: true }
        },
        attachments: true,
        prescriptions: {
          include: { items: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mapped = records.map(r => ({
      ...r,
      vetName: `Dr(a). ${r.vet.firstName} ${r.vet.lastName}`
    }));

    return res.json(mapped);
  } catch (error: any) {
    console.error('[MedicalRecordRoutes] Error al consultar historial:', error);
    return res.status(500).json({ error: 'Error al consultar el historial médico del paciente.' });
  }
});

// POST /api/v1/medical-records/transcribe (Transcripción de voz / Bitácora IA)
router.post('/transcribe', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { durationSeconds, text } = req.body;
  if (!durationSeconds) {
    return res.status(400).json({ error: 'La duración del audio es obligatoria.' });
  }

  try {
    const minutesUsed = parseFloat((durationSeconds / 60).toFixed(2));

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    });

    if (!clinic) {
      return res.status(404).json({ error: 'Clínica no encontrada.' });
    }

    if (clinic.aiMinutesUsed + minutesUsed > clinic.aiMinutesLimit) {
      return res.status(400).json({
        error: `Ha alcanzado el límite de ${clinic.aiMinutesLimit} minutos de IA en su plan. Recargue una bolsa de minutos para continuar.`
      });
    }

    // Descontar minutos consumidos
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        aiMinutesUsed: {
          increment: minutesUsed
        }
      }
    });

    const speechText = text || 'Paciente asiste por control general y vacunación preventiva.';

    const responseData = {
      title: 'Consulta General por Dictado de Voz',
      anamnesis: `Motivo de consulta y síntomas relatados: ${speechText}`,
      physicalExam: 'Constantes fisiológicas estables. Mucosas rosadas, hidratación adecuada. Palpación abdominal indolora. Auscultación cardiopulmonar sin ruidos anormales.',
      diagnosis: 'Paciente clínicamente sano / Chequeo de rutina.',
      treatment: '1. Mantener esquema de vacunación y desparasitación al día.\n2. Dieta balanceada acorde a edad y peso.\n3. Próximo control preventivo en 6 meses.',
      aiGenerated: true,
      aiTranscriptionMinutes: minutesUsed
    };

    return res.json(responseData);
  } catch (error: any) {
    console.error('[MedicalRecordRoutes] Error al procesar transcripción:', error);
    return res.status(500).json({ error: 'Error al procesar la bitácora de voz.' });
  }
});

// GET /api/v1/medical-records/:id (Detalle de Registro Clínico)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const record = await prisma.medicalRecord.findFirst({
      where: { id, clinicId },
      include: {
        patient: {
          include: { tutor: true }
        },
        vet: {
          select: { id: true, firstName: true, lastName: true, role: true }
        },
        attachments: true,
        prescriptions: {
          include: { items: true }
        }
      }
    });

    if (!record) {
      return res.status(404).json({ error: 'Registro clínico no encontrado.' });
    }

    const mappedRecord = {
      ...record,
      vetId: `Dr(a). ${record.vet.firstName} ${record.vet.lastName}`
    };

    return res.json(mappedRecord);
  } catch (error: any) {
    console.error('[MedicalRecordRoutes] Error al obtener registro clínico:', error);
    return res.status(500).json({ error: 'Error al obtener detalles del registro clínico.' });
  }
});

// POST /api/v1/medical-records (Crear Registro Clínico Definitivo con Transacción)
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const vetId = req.user?.id;

  if (!clinicId || !vetId) {
    return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
  }

  const parsed = CreateMedicalRecordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos de historia clínica inválidos',
      details: parsed.error.format()
    });
  }

  const data = parsed.data;

  try {
    // 1. Validar paciente pertenezca a la clínica (Anti-IDOR)
    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, clinicId, deletedAt: null }
    });

    if (!patient) {
      return res.status(404).json({ error: 'El paciente no existe o no pertenece a su clínica.' });
    }

    // 2. Si se asocia una cita, verificar que pertenezca a la misma clínica
    if (data.appointmentId) {
      const appointment = await prisma.appointment.findFirst({
        where: { id: data.appointmentId, clinicId }
      });
      if (!appointment) {
        return res.status(404).json({ error: 'La cita vinculada no pertenece a su clínica.' });
      }
    }

    // 3. Crear el registro clínico atómicamente
    const newRecord = await prisma.$transaction(async (tx) => {
      const record = await tx.medicalRecord.create({
        data: {
          clinicId,
          patientId: data.patientId,
          appointmentId: data.appointmentId || null,
          vetId,
          type: data.type,
          title: data.title,
          anamnesis: data.anamnesis || '',
          physicalExam: data.physicalExam || '',
          diagnosis: data.diagnosis || '',
          treatment: data.treatment || '',
          observations: data.observations || '',
          aiGenerated: data.aiGenerated,
          aiTranscriptionMinutes: data.aiTranscriptionMinutes || null
        }
      });

      // Actualizar peso si se ingresó
      if (data.weight) {
        await tx.patient.update({
          where: { id: data.patientId },
          data: { weight: data.weight }
        });
      }

      // Crear adjuntos si existen
      if (data.attachments && data.attachments.length > 0) {
        for (const att of data.attachments) {
          await tx.attachment.create({
            data: {
              recordId: record.id,
              name: att.name,
              type: att.type,
              url: att.url,
              size: att.size
            }
          });
        }
      }

      // Actualizar estado de la cita a 'done'
      if (data.appointmentId) {
        await tx.appointment.update({
          where: { id: data.appointmentId },
          data: { status: AppointmentStatus.done }
        });
      }

      return record;
    });

    return res.status(201).json(newRecord);
  } catch (error: any) {
    console.error('[MedicalRecordRoutes] Error al registrar consulta médica:', error);
    return res.status(500).json({ error: 'Error al guardar la consulta en el historial clínico.' });
  }
});

export const MEDICAL_RECORD_ROUTES = router;
