import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = Router();

router.use(authMiddleware as any);
router.use(roleMiddleware(['admin', 'vet', 'assistant']) as any);

// POST /api/v1/medical-records/transcribe (Simular transcripción de voz con Whisper + Claude)
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

    // Obtener la clínica para validar y actualizar minutos consumidos
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    });

    if (!clinic) {
      return res.status(404).json({ error: 'Clínica no encontrada.' });
    }

    if (clinic.aiMinutesUsed + minutesUsed > clinic.aiMinutesLimit) {
      return res.status(400).json({ error: 'Límite de minutos de IA excedido para esta clínica.' });
    }

    // Actualizar minutos de la clínica
    await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        aiMinutesUsed: {
          increment: minutesUsed
        }
      }
    });

    // Simulador de Whisper + Prompt Engineering de Claude
    const speechText = text || "Toby asiste por diarrea y vómitos desde hace dos días, con dolor abdominal leve.";
    
    const responseData = {
      title: 'Consulta General por Dictado de Voz',
      anamnesis: `El tutor reporta que el paciente presenta: ${speechText}. Evolución de 48 horas.`,
      physicalExam: 'Alerta, hidratación normal. Frecuencia cardíaca dentro de rango. Dolor a la palpación abdominal leve. Resto de sistemas sin hallazgos patológicos aparentes.',
      diagnosis: 'Sospecha de gastroenteritis alimentaria o indiscreción dietaria.',
      treatment: '1. Dieta blanda por 3 días.\n2. Hidratación constante con suero oral.\n3. Monitorear deposiciones y volver a consulta si los síntomas persisten o empeoran.',
      aiGenerated: true,
      aiTranscriptionMinutes: minutesUsed
    };

    return res.json(responseData);
  } catch (error) {
    console.error('Error al procesar transcripción:', error);
    return res.status(500).json({ error: 'Error al transcribir y procesar la bitácora de voz.' });
  }
});

// GET /api/v1/medical-records/:id
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
        attachments: true
      }
    });

    if (!record) {
      return res.status(404).json({ error: 'Registro clínico no encontrado.' });
    }

    // Formato estandarizado para frontend (Dr(a). Nombre Apellido)
    const mappedRecord = {
      ...record,
      vetId: `Dr(a). ${record.vet.firstName} ${record.vet.lastName}`
    };

    return res.json(mappedRecord);
  } catch (error) {
    console.error('Error al obtener registro clínico:', error);
    return res.status(500).json({ error: 'Error al obtener detalles del registro clínico.' });
  }
});

// POST /api/v1/medical-records (Crear registro definitivo)
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const vetId = req.user?.id;

  if (!clinicId || !vetId) {
    return res.status(401).json({ error: 'No autorizado. Debe iniciar sesión.' });
  }

  const {
    patientId,
    appointmentId,
    type,
    title,
    anamnesis,
    physicalExam,
    diagnosis,
    treatment,
    observations,
    aiGenerated,
    aiTranscriptionMinutes,
    weight,
    attachments
  } = req.body;

  if (!patientId || !title) {
    return res.status(400).json({ error: 'ID de paciente y título son campos obligatorios.' });
  }

  try {
    // Validar existencia de paciente y pertenencia a la clínica
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, clinicId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Paciente no encontrado.' });
    }

    // Crear el registro clínico en una transacción
    const newRecord = await prisma.$transaction(async (tx) => {
      // 1. Crear el MedicalRecord
      const record = await tx.medicalRecord.create({
        data: {
          clinicId,
          patientId,
          appointmentId: appointmentId || null,
          vetId,
          type: type || 'consultation',
          title,
          anamnesis: anamnesis || '',
          physicalExam: physicalExam || '',
          diagnosis: diagnosis || '',
          treatment: treatment || '',
          observations: observations || '',
          aiGenerated: !!aiGenerated,
          aiTranscriptionMinutes: aiTranscriptionMinutes ? parseFloat(aiTranscriptionMinutes) : null
        }
      });

      // 2. Si se pasó un peso, actualizar el peso de la mascota
      if (weight) {
        await tx.patient.update({
          where: { id: patientId },
          data: { weight: parseFloat(weight) }
        });
      }

      // 3. Crear adjuntos si existen
      if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        for (const att of attachments) {
          await tx.attachment.create({
            data: {
              recordId: record.id,
              name: att.name,
              type: att.type || 'other',
              url: att.url,
              size: parseInt(att.size) || 0
            }
          });
        }
      }

      // 4. Si hay cita asociada, actualizar estado de la cita a 'done'
      if (appointmentId) {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { status: 'done' }
        });
      }

      return record;
    });

    return res.status(201).json(newRecord);
  } catch (error) {
    console.error('Error al registrar consulta médica:', error);
    return res.status(500).json({ error: 'Error al guardar la consulta en el historial clínico.' });
  }
});

export const MEDICAL_RECORD_ROUTES = router;
