import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { BedStatus, BedType, HospitalizationStatus, MovementType } from '@prisma/client';

export const HOSPITALIZATION_ROUTES = Router();

HOSPITALIZATION_ROUTES.use(authMiddleware as any);
HOSPITALIZATION_ROUTES.use(roleMiddleware(['admin', 'vet', 'assistant']) as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────

const CreateBedSchema = z.object({
  branchId: z.string().uuid('ID de sucursal inválido'),
  code: z.string().min(1, 'El código de jaula/cama es obligatorio'),
  name: z.string().min(1, 'El nombre descriptivo es obligatorio'),
  type: z.nativeEnum(BedType).default(BedType.dog_standard),
  dailyRate: z.number().nonnegative().default(50000),
  notes: z.string().optional()
});

const AdmitPatientSchema = z.object({
  patientId: z.string().uuid('ID de paciente inválido'),
  branchId: z.string().uuid('ID de sucursal inválido'),
  bedId: z.string().uuid('ID de cama inválido'),
  admissionReason: z.string().min(3, 'El motivo de hospitalización es obligatorio'),
  diagnosis: z.string().optional(),
  fluidTherapy: z.string().optional(),
  dailyRate: z.number().positive().optional(),
  temperature: z.number().optional(),
  heartRate: z.number().int().optional(),
  respiratoryRate: z.number().int().optional(),
  medications: z.array(z.object({
    drugName: z.string().min(1),
    dose: z.string().min(1),
    route: z.string().min(1),
    frequencyHours: z.number().int().positive().default(8),
    timeSlots: z.array(z.string()).default(['08:00 AM', '02:00 PM', '08:00 PM']),
    productId: z.string().uuid().optional(),
    instructions: z.string().optional()
  })).optional()
});

const AddEvolutionSchema = z.object({
  temperature: z.number().optional(),
  heartRate: z.number().int().optional(),
  respiratoryRate: z.number().int().optional(),
  capillaryRefillTime: z.number().optional(),
  bloodGlucose: z.number().optional(),
  fluidTherapyRate: z.string().optional(),
  notes: z.string().min(1, 'La nota de evolución es obligatoria')
});

const AddMedicationSchema = z.object({
  drugName: z.string().min(1, 'El nombre del fármaco es obligatorio'),
  dose: z.string().min(1, 'La dosis es obligatoria'),
  route: z.string().min(1, 'La vía de administración es obligatoria'),
  frequencyHours: z.number().int().positive().default(8),
  timeSlots: z.array(z.string()).min(1, 'Debe especificar al menos un horario'),
  productId: z.string().uuid().optional(),
  instructions: z.string().optional()
});

const AdministerDoseSchema = z.object({
  medicationId: z.string().uuid('ID de medicación inválido'),
  timeSlot: z.string().min(1),
  notes: z.string().optional(),
  deductStock: z.boolean().default(true)
});

const DischargePatientSchema = z.object({
  dischargeSummary: z.string().min(3, 'El resumen de alta o epicrisis es obligatorio')
});

// ─────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/v1/hospitalizations/beds (Lista de camas por clínica/sucursal)
HOSPITALIZATION_ROUTES.get('/beds', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const branchId = req.query.branchId as string | undefined;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const beds = await prisma.hospitalBed.findMany({
      where: {
        clinicId,
        ...(branchId ? { branchId } : {})
      },
      include: {
        branch: { select: { id: true, name: true } },
        hospitalizations: {
          where: { status: { not: HospitalizationStatus.discharged } },
          include: {
            patient: { select: { id: true, name: true, species: true, breed: true, weight: true } }
          }
        }
      },
      orderBy: { code: 'asc' }
    });

    return res.json(beds);
  } catch (error: any) {
    console.error('[Hospitalization] Error al listar camas:', error);
    return res.status(500).json({ error: 'Error al consultar las camas de hospitalización.' });
  }
});

// POST /api/v1/hospitalizations/beds (Crear jaula/cama)
HOSPITALIZATION_ROUTES.post('/beds', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = CreateBedSchema.parse(req.body);

    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, clinicId }
    });
    if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada.' });

    const bed = await prisma.hospitalBed.create({
      data: {
        clinicId,
        branchId: data.branchId,
        code: data.code,
        name: data.name,
        type: data.type,
        dailyRate: data.dailyRate,
        notes: data.notes
      }
    });

    return res.status(201).json(bed);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Hospitalization] Error al crear cama:', error);
    return res.status(500).json({ error: 'Error al registrar la cama.' });
  }
});

// GET /api/v1/hospitalizations y /api/v1/hospitalizations/active (Pacientes actualmente hospitalizados y Kardex)
HOSPITALIZATION_ROUTES.get(['/', '/active'], async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const branchId = req.query.branchId as string | undefined;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const hospitalizations = await prisma.hospitalization.findMany({
      where: {
        clinicId,
        status: { not: HospitalizationStatus.discharged },
        ...(branchId ? { branchId } : {})
      },
      include: {
        patient: {
          include: {
            tutor: { select: { id: true, firstName: true, lastName: true, phone: true } }
          }
        },
        bed: true,
        branch: { select: { id: true, name: true } },
        evolutions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: { vet: { select: { id: true, firstName: true, lastName: true } } }
        },
        medications: {
          where: { active: true },
          include: {
            doses: {
              where: {
                scheduledFor: {
                  gte: new Date(new Date().setHours(0, 0, 0, 0)),
                  lte: new Date(new Date().setHours(23, 59, 59, 999))
                }
              }
            }
          }
        }
      },
      orderBy: { admittedAt: 'desc' }
    });

    // Mapeo amigable para el frontend
    const mapped = hospitalizations.map(h => {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - new Date(h.admittedAt).getTime());
      const daysHospitalized = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const latestEvolution = h.evolutions[0];

      return {
        id: h.id,
        cageNumber: h.bed.code,
        cageType: h.bed.name,
        bedId: h.bed.id,
        status: h.status,
        patientId: h.patient.id,
        patientName: h.patient.name,
        patientSpecies: h.patient.species,
        patientBreed: h.patient.breed || 'Mestizo',
        weight: h.patient.weight || 0,
        tutorName: `${h.patient.tutor.firstName} ${h.patient.tutor.lastName}`,
        tutorPhone: h.patient.tutor.phone,
        admittedAt: h.admittedAt,
        daysHospitalized,
        admissionReason: h.admissionReason,
        diagnosis: h.diagnosis,
        fluidTherapy: h.fluidTherapy || 'Sin infusión continua',
        temperature: latestEvolution?.temperature || 38.5,
        heartRate: latestEvolution?.heartRate || 100,
        respiratoryRate: latestEvolution?.respiratoryRate || 24,
        medications: h.medications.flatMap(m =>
          m.timeSlots.map(slot => {
            const doseRecord = m.doses.find(d => d.timeSlot === slot);
            return {
              id: doseRecord?.id || `${m.id}-${slot}`,
              medicationId: m.id,
              timeSlot: slot,
              drugName: m.drugName,
              dose: m.dose,
              route: m.route,
              applied: doseRecord?.applied || false,
              appliedAt: doseRecord?.administeredAt,
              appliedBy: doseRecord?.administeredBy
            };
          })
        ),
        evolutions: h.evolutions
      };
    });

    return res.json(mapped);
  } catch (error: any) {
    console.error('[Hospitalization] Error al listar hospitalizaciones:', error);
    return res.status(500).json({ error: 'Error al consultar hospitalizaciones activas.' });
  }
});

// POST /api/v1/hospitalizations/admit (Ingresar paciente a hospitalización)
HOSPITALIZATION_ROUTES.post('/admit', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const vetId = req.user?.id;

  if (!clinicId || !vetId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = AdmitPatientSchema.parse(req.body);

    const [patient, bed] = await Promise.all([
      prisma.patient.findFirst({ where: { id: data.patientId, clinicId, deletedAt: null } }),
      prisma.hospitalBed.findFirst({ where: { id: data.bedId, clinicId } })
    ]);

    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado.' });
    if (!bed) return res.status(404).json({ error: 'Cama/jaula no encontrada.' });
    if (bed.status === BedStatus.occupied) {
      return res.status(400).json({ error: `La cama ${bed.code} ya se encuentra ocupada.` });
    }

    const hospitalization = await prisma.$transaction(async tx => {
      // 1. Crear hospitalización
      const hosp = await tx.hospitalization.create({
        data: {
          clinicId,
          branchId: data.branchId,
          patientId: data.patientId,
          bedId: data.bedId,
          admissionReason: data.admissionReason,
          diagnosis: data.diagnosis,
          fluidTherapy: data.fluidTherapy,
          dailyRateCharged: data.dailyRate || bed.dailyRate,
          status: HospitalizationStatus.admitted
        }
      });

      // 2. Marcar cama como ocupada
      await tx.hospitalBed.update({
        where: { id: data.bedId },
        data: { status: BedStatus.occupied }
      });

      // 3. Registrar primera evolución con signos de ingreso
      await tx.hospitalEvolution.create({
        data: {
          hospitalizationId: hosp.id,
          vetId,
          temperature: data.temperature || 38.5,
          heartRate: data.heartRate || 100,
          respiratoryRate: data.respiratoryRate || 24,
          notes: `Ingreso a hospitalización por ${data.admissionReason}. Plan inicial establecido.`
        }
      });

      // 4. Agregar medicamentos si vienen en el payload
      if (data.medications && data.medications.length > 0) {
        for (const med of data.medications) {
          const createdMed = await tx.hospitalMedication.create({
            data: {
              hospitalizationId: hosp.id,
              drugName: med.drugName,
              dose: med.dose,
              route: med.route,
              frequencyHours: med.frequencyHours,
              timeSlots: med.timeSlots,
              productId: med.productId,
              instructions: med.instructions
            }
          });

          // Crear registros de dosis para hoy
          for (const slot of med.timeSlots) {
            await tx.hospitalDoseRecord.create({
              data: {
                hospitalizationId: hosp.id,
                medicationId: createdMed.id,
                timeSlot: slot,
                scheduledFor: new Date(),
                applied: false
              }
            });
          }
        }
      }

      return hosp;
    });

    return res.status(201).json(hospitalization);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Hospitalization] Error al admitir paciente:', error);
    return res.status(500).json({ error: 'Error al procesar el ingreso a hospitalización.' });
  }
});

// POST /api/v1/hospitalizations/:id/evolutions (Registrar evolución clínica y constantes)
HOSPITALIZATION_ROUTES.post('/:id/evolutions', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const vetId = req.user?.id;
  const { id } = req.params;

  if (!clinicId || !vetId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = AddEvolutionSchema.parse(req.body);

    const hosp = await prisma.hospitalization.findFirst({
      where: { id, clinicId }
    });
    if (!hosp) return res.status(404).json({ error: 'Hospitalización no encontrada.' });

    const evolution = await prisma.hospitalEvolution.create({
      data: {
        hospitalizationId: id,
        vetId,
        temperature: data.temperature,
        heartRate: data.heartRate,
        respiratoryRate: data.respiratoryRate,
        capillaryRefillTime: data.capillaryRefillTime,
        bloodGlucose: data.bloodGlucose,
        fluidTherapyRate: data.fluidTherapyRate,
        notes: data.notes
      }
    });

    return res.status(201).json(evolution);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Hospitalization] Error al registrar evolución:', error);
    return res.status(500).json({ error: 'Error al registrar evolución médica.' });
  }
});

// POST /api/v1/hospitalizations/:id/medications (Agregar medicación al Kardex)
HOSPITALIZATION_ROUTES.post('/:id/medications', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = AddMedicationSchema.parse(req.body);

    const hosp = await prisma.hospitalization.findFirst({
      where: { id, clinicId }
    });
    if (!hosp) return res.status(404).json({ error: 'Hospitalización no encontrada.' });

    const med = await prisma.$transaction(async tx => {
      const created = await tx.hospitalMedication.create({
        data: {
          hospitalizationId: id,
          drugName: data.drugName,
          dose: data.dose,
          route: data.route,
          frequencyHours: data.frequencyHours,
          timeSlots: data.timeSlots,
          productId: data.productId,
          instructions: data.instructions
        }
      });

      for (const slot of data.timeSlots) {
        await tx.hospitalDoseRecord.create({
          data: {
            hospitalizationId: id,
            medicationId: created.id,
            timeSlot: slot,
            scheduledFor: new Date(),
            applied: false
          }
        });
      }

      return created;
    });

    return res.status(201).json(med);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Hospitalization] Error al agregar medicación:', error);
    return res.status(500).json({ error: 'Error al programar medicación en Kardex.' });
  }
});

// POST /api/v1/hospitalizations/:id/doses/administer (Administrar dosis con descuento atómico de stock)
HOSPITALIZATION_ROUTES.post('/:id/doses/administer', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const userName = req.user?.email || 'Enfermero de Turno';
  const userId = req.user?.id;
  const { id } = req.params;

  if (!clinicId || !userId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = AdministerDoseSchema.parse(req.body);

    const hosp = await prisma.hospitalization.findFirst({
      where: { id, clinicId },
      include: { bed: true }
    });
    if (!hosp) return res.status(404).json({ error: 'Hospitalización no encontrada.' });

    const medication = await prisma.hospitalMedication.findUnique({
      where: { id: data.medicationId }
    });
    if (!medication) return res.status(404).json({ error: 'Medicación no encontrada.' });

    const result = await prisma.$transaction(async tx => {
      let movementId: string | undefined;

      // Descuento atómico de inventario si el fármaco está vinculado a un producto
      if (data.deductStock && medication.productId) {
        const product = await tx.product.findUnique({
          where: { id: medication.productId }
        });

        if (product && product.currentStock > 0) {
          const qtyBefore = product.currentStock;
          const qtyAfter = qtyBefore - 1;

          await tx.product.update({
            where: { id: product.id },
            data: { currentStock: qtyAfter }
          });

          const mov = await tx.inventoryMovement.create({
            data: {
              clinicId,
              branchId: hosp.branchId,
              productId: product.id,
              type: MovementType.out,
              quantity: 1,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
              reason: `Dosis Kardex: ${medication.drugName} aplicada a paciente`,
              referenceId: hosp.id,
              referenceType: 'hospitalization',
              performedBy: userId
            }
          });
          movementId = mov.id;
        }
      }

      // Actualizar o crear el registro de dosis
      const existingDose = await tx.hospitalDoseRecord.findFirst({
        where: {
          hospitalizationId: id,
          medicationId: data.medicationId,
          timeSlot: data.timeSlot
        }
      });

      if (existingDose) {
        return tx.hospitalDoseRecord.update({
          where: { id: existingDose.id },
          data: {
            applied: true,
            administeredAt: new Date(),
            administeredBy: userName,
            notes: data.notes,
            inventoryMovementId: movementId
          }
        });
      } else {
        return tx.hospitalDoseRecord.create({
          data: {
            hospitalizationId: id,
            medicationId: data.medicationId,
            timeSlot: data.timeSlot,
            scheduledFor: new Date(),
            applied: true,
            administeredAt: new Date(),
            administeredBy: userName,
            notes: data.notes,
            inventoryMovementId: movementId
          }
        });
      }
    });

    return res.json({ success: true, dose: result });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Hospitalization] Error al registrar dosis administrada:', error);
    return res.status(500).json({ error: 'Error al marcar dosis administrada.' });
  }
});

// POST /api/v1/hospitalizations/:id/discharge (Dar de alta médica al paciente)
HOSPITALIZATION_ROUTES.post('/:id/discharge', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = DischargePatientSchema.parse(req.body);

    const hosp = await prisma.hospitalization.findFirst({
      where: { id, clinicId }
    });
    if (!hosp) return res.status(404).json({ error: 'Hospitalización no encontrada.' });

    const dischargeDate = new Date();
    const diffTime = Math.abs(dischargeDate.getTime() - new Date(hosp.admittedAt).getTime());
    const daysHospitalized = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const totalCharged = daysHospitalized * hosp.dailyRateCharged;

    const updated = await prisma.$transaction(async tx => {
      const h = await tx.hospitalization.update({
        where: { id },
        data: {
          status: HospitalizationStatus.discharged,
          dischargedAt: dischargeDate,
          dischargeSummary: data.dischargeSummary,
          totalCharged
        }
      });

      // Liberar la cama y colocarla en limpieza
      await tx.hospitalBed.update({
        where: { id: hosp.bedId },
        data: { status: BedStatus.cleaning }
      });

      return h;
    });

    return res.json({
      success: true,
      hospitalization: updated,
      daysHospitalized,
      totalCharged,
      message: 'Alta médica procesada exitosamente. La cama ha sido asignada para limpieza.'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Hospitalization] Error al dar de alta médica:', error);
    return res.status(500).json({ error: 'Error al dar de alta al paciente.' });
  }
});
