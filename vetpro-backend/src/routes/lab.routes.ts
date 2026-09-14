import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { LabCategory, LabOrderStatus } from '@prisma/client';

export const LAB_ROUTES = Router();

LAB_ROUTES.use(authMiddleware as any);
LAB_ROUTES.use(roleMiddleware(['admin', 'vet', 'assistant']) as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────

const CreateCatalogTestSchema = z.object({
  code: z.string().min(1, 'El código del examen es obligatorio'),
  name: z.string().min(1, 'El nombre del examen es obligatorio'),
  category: z.nativeEnum(LabCategory).default(LabCategory.hematology),
  unit: z.string().optional(),
  canineRefMin: z.number().optional(),
  canineRefMax: z.number().optional(),
  canineRefText: z.string().optional(),
  felineRefMin: z.number().optional(),
  felineRefMax: z.number().optional(),
  felineRefText: z.string().optional(),
  salePrice: z.number().nonnegative().default(35000)
});

const CreateLabOrderSchema = z.object({
  patientId: z.string().uuid('ID de paciente inválido'),
  appointmentId: z.string().uuid().optional().nullable(),
  sampleType: z.string().min(1, 'El tipo de muestra es obligatorio (ej: Sangre EDTA, Suero, Orina)'),
  clinicalNotes: z.string().optional(),
  testCatalogIds: z.array(z.string().uuid()).min(1, 'Debe seleccionar al menos una prueba o perfil de laboratorio')
});

const SaveResultsSchema = z.object({
  status: z.nativeEnum(LabOrderStatus).default(LabOrderStatus.completed),
  results: z.array(z.object({
    labTestCatalogId: z.string().uuid().optional(),
    testName: z.string().min(1),
    valueMeasured: z.string().min(1),
    unit: z.string().optional(),
    interpretation: z.string().optional()
  })).min(1, 'Debe enviar al menos un resultado')
});

// ─────────────────────────────────────────────
// CATÁLOGO BASE POR DEFECTO
// ─────────────────────────────────────────────

const DEFAULT_LAB_CATALOG = [
  { code: 'HEM-LEU', name: 'Leucocitos Totales', category: LabCategory.hematology, unit: 'x10^3/uL', canineRefMin: 6.0, canineRefMax: 17.0, felineRefMin: 5.5, felineRefMax: 19.5, salePrice: 15000 },
  { code: 'HEM-ERI', name: 'Eritrocitos (Glóbulos Rojos)', category: LabCategory.hematology, unit: 'x10^6/uL', canineRefMin: 5.5, canineRefMax: 8.5, felineRefMin: 5.0, felineRefMax: 10.0, salePrice: 15000 },
  { code: 'HEM-HGB', name: 'Hemoglobina', category: LabCategory.hematology, unit: 'g/dL', canineRefMin: 12.0, canineRefMax: 18.0, felineRefMin: 8.0, felineRefMax: 15.0, salePrice: 15000 },
  { code: 'HEM-HCT', name: 'Hematocrito (PCV)', category: LabCategory.hematology, unit: '%', canineRefMin: 37.0, canineRefMax: 55.0, felineRefMin: 24.0, felineRefMax: 45.0, salePrice: 15000 },
  { code: 'HEM-PLQ', name: 'Plaquetas', category: LabCategory.hematology, unit: 'x10^3/uL', canineRefMin: 175.0, canineRefMax: 500.0, felineRefMin: 175.0, felineRefMax: 500.0, salePrice: 15000 },
  { code: 'BIO-CREA', name: 'Creatinina Sérica', category: LabCategory.biochemistry, unit: 'mg/dL', canineRefMin: 0.5, canineRefMax: 1.5, felineRefMin: 0.8, felineRefMax: 2.1, salePrice: 22000 },
  { code: 'BIO-BUN', name: 'BUN (Nitrógeno Ureico)', category: LabCategory.biochemistry, unit: 'mg/dL', canineRefMin: 7.0, canineRefMax: 27.0, felineRefMin: 16.0, felineRefMax: 36.0, salePrice: 22000 },
  { code: 'BIO-ALT', name: 'ALT / GPT (Alanina Aminotransferasa)', category: LabCategory.biochemistry, unit: 'U/L', canineRefMin: 10.0, canineRefMax: 100.0, felineRefMin: 12.0, felineRefMax: 130.0, salePrice: 25000 },
  { code: 'BIO-GLU', name: 'Glucosa Sérica', category: LabCategory.biochemistry, unit: 'mg/dL', canineRefMin: 70.0, canineRefMax: 140.0, felineRefMin: 75.0, felineRefMax: 150.0, salePrice: 18000 },
  { code: 'URI-DENS', name: 'Urianálisis - Densidad Urinaria', category: LabCategory.urinalysis, unit: 'g/ml', canineRefMin: 1.015, canineRefMax: 1.045, felineRefMin: 1.020, felineRefMax: 1.060, salePrice: 20000 },
  { code: 'PAR-COPRO', name: 'Coprológico Directo y Flotación', category: LabCategory.parasitology, unit: '', canineRefText: 'Negativo a parásitos y huevos', felineRefText: 'Negativo a parásitos y huevos', salePrice: 20000 },
  { code: 'IMG-RX', name: 'Estudio Radiográfico (2 Vistas)', category: LabCategory.imaging, unit: 'Estudio', canineRefText: 'Sin hallazgos patológicos óseos', felineRefText: 'Sin hallazgos patológicos óseos', salePrice: 85000 },
  { code: 'IMG-ECO', name: 'Ecografía Abdominal Completa', category: LabCategory.imaging, unit: 'Estudio', canineRefText: 'Arquitectura y ecogenicidad normal', felineRefText: 'Arquitectura y ecogenicidad normal', salePrice: 95000 }
];

// ─────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/v1/labs/catalog (Consultar catálogo de exámenes)
LAB_ROUTES.get('/catalog', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    let catalog = await prisma.labTestCatalog.findMany({
      where: { clinicId, active: true },
      orderBy: { category: 'asc' }
    });

    // Si el catálogo está vacío, sembrar automáticamente las pruebas estándar
    if (catalog.length === 0) {
      await prisma.labTestCatalog.createMany({
        data: DEFAULT_LAB_CATALOG.map(t => ({ ...t, clinicId }))
      });
      catalog = await prisma.labTestCatalog.findMany({
        where: { clinicId, active: true },
        orderBy: { category: 'asc' }
      });
    }

    return res.json(catalog);
  } catch (error: any) {
    console.error('[Lab] Error al consultar catálogo:', error);
    return res.status(500).json({ error: 'Error al consultar catálogo de laboratorio.' });
  }
});

// POST /api/v1/labs/catalog (Crear nuevo examen en el catálogo)
LAB_ROUTES.post('/catalog', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = CreateCatalogTestSchema.parse(req.body);

    const test = await prisma.labTestCatalog.create({
      data: {
        clinicId,
        code: data.code.toUpperCase(),
        name: data.name,
        category: data.category,
        unit: data.unit,
        canineRefMin: data.canineRefMin,
        canineRefMax: data.canineRefMax,
        canineRefText: data.canineRefText,
        felineRefMin: data.felineRefMin,
        felineRefMax: data.felineRefMax,
        felineRefText: data.felineRefText,
        salePrice: data.salePrice
      }
    });

    return res.status(201).json(test);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Lab] Error al crear examen:', error);
    return res.status(500).json({ error: 'Error al registrar prueba de laboratorio.' });
  }
});

// GET /api/v1/labs/orders (Listar órdenes de laboratorio)
LAB_ROUTES.get('/orders', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const status = req.query.status as LabOrderStatus | undefined;
  const patientId = req.query.patientId as string | undefined;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const orders = await prisma.labOrder.findMany({
      where: {
        clinicId,
        ...(status ? { status } : {}),
        ...(patientId ? { patientId } : {})
      },
      include: {
        patient: {
          include: { tutor: { select: { id: true, firstName: true, lastName: true, phone: true } } }
        },
        vet: { select: { id: true, firstName: true, lastName: true } },
        results: true,
        attachments: true
      },
      orderBy: { orderedAt: 'desc' }
    });

    return res.json(orders);
  } catch (error: any) {
    console.error('[Lab] Error al listar órdenes:', error);
    return res.status(500).json({ error: 'Error al consultar órdenes de laboratorio.' });
  }
});

// GET /api/v1/labs/orders/:id (Detalle de orden de laboratorio)
LAB_ROUTES.get('/orders/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const order = await prisma.labOrder.findFirst({
      where: { id, clinicId },
      include: {
        patient: {
          include: { tutor: true }
        },
        vet: { select: { id: true, firstName: true, lastName: true, email: true } },
        results: {
          include: { labTestCatalog: true }
        },
        attachments: true
      }
    });

    if (!order) return res.status(404).json({ error: 'Orden de laboratorio no encontrada.' });

    return res.json(order);
  } catch (error: any) {
    console.error('[Lab] Error al consultar orden:', error);
    return res.status(500).json({ error: 'Error al consultar el examen.' });
  }
});

// POST /api/v1/labs/orders (Crear nueva orden de laboratorio)
LAB_ROUTES.post('/orders', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const vetId = req.user?.id;

  if (!clinicId || !vetId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = CreateLabOrderSchema.parse(req.body);

    const patient = await prisma.patient.findFirst({
      where: { id: data.patientId, clinicId, deletedAt: null }
    });
    if (!patient) return res.status(404).json({ error: 'Paciente no encontrado.' });

    // Generar consecutivo amigable
    const count = await prisma.labOrder.count({ where: { clinicId } });
    const orderNumber = `LAB-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`;

    // Obtener pruebas seleccionadas
    const catalogTests = await prisma.labTestCatalog.findMany({
      where: { id: { in: data.testCatalogIds }, clinicId }
    });

    const isFeline = patient.species === 'cat';

    const order = await prisma.$transaction(async tx => {
      const createdOrder = await tx.labOrder.create({
        data: {
          clinicId,
          patientId: data.patientId,
          appointmentId: data.appointmentId,
          vetId,
          orderNumber,
          sampleType: data.sampleType,
          clinicalNotes: data.clinicalNotes,
          status: LabOrderStatus.pending
        }
      });

      // Crear resultados vacíos preparados para digitación
      for (const test of catalogTests) {
        let refRangeText = '';
        if (isFeline) {
          refRangeText = test.felineRefText || (test.felineRefMin != null && test.felineRefMax != null ? `${test.felineRefMin} - ${test.felineRefMax}` : '');
        } else {
          refRangeText = test.canineRefText || (test.canineRefMin != null && test.canineRefMax != null ? `${test.canineRefMin} - ${test.canineRefMax}` : '');
        }

        await tx.labResultItem.create({
          data: {
            labOrderId: createdOrder.id,
            labTestCatalogId: test.id,
            testName: test.name,
            valueMeasured: '',
            unit: test.unit || '',
            refRangeText,
            flag: 'normal'
          }
        });
      }

      return createdOrder;
    });

    return res.status(201).json(order);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Lab] Error al crear orden:', error);
    return res.status(500).json({ error: 'Error al generar la orden de laboratorio.' });
  }
});

// PATCH /api/v1/labs/orders/:id/results (Guardar y validar resultados de laboratorio)
LAB_ROUTES.patch('/orders/:id/results', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = SaveResultsSchema.parse(req.body);

    const order = await prisma.labOrder.findFirst({
      where: { id, clinicId },
      include: { patient: true }
    });
    if (!order) return res.status(404).json({ error: 'Orden de laboratorio no encontrada.' });

    const isFeline = order.patient.species === 'cat';

    await prisma.$transaction(async tx => {
      for (const resItem of data.results) {
        let flag = 'normal';
        let refRangeText = '';

        if (resItem.labTestCatalogId) {
          const testDef = await tx.labTestCatalog.findUnique({
            where: { id: resItem.labTestCatalogId }
          });

          if (testDef) {
            const min = isFeline ? testDef.felineRefMin : testDef.canineRefMin;
            const max = isFeline ? testDef.felineRefMax : testDef.canineRefMax;
            refRangeText = (isFeline ? testDef.felineRefText : testDef.canineRefText) || (min != null && max != null ? `${min} - ${max}` : '');

            const numValue = parseFloat(resItem.valueMeasured.replace(',', '.'));
            if (!isNaN(numValue) && min != null && max != null) {
              if (numValue < min) flag = 'low';
              else if (numValue > max) flag = 'high';
              else flag = 'normal';
            }
          }
        }

        // Buscar si ya existe el ítem en la orden
        const existing = await tx.labResultItem.findFirst({
          where: {
            labOrderId: id,
            ...(resItem.labTestCatalogId ? { labTestCatalogId: resItem.labTestCatalogId } : { testName: resItem.testName })
          }
        });

        if (existing) {
          await tx.labResultItem.update({
            where: { id: existing.id },
            data: {
              valueMeasured: resItem.valueMeasured,
              unit: resItem.unit || existing.unit,
              refRangeText: refRangeText || existing.refRangeText,
              flag,
              interpretation: resItem.interpretation
            }
          });
        } else {
          await tx.labResultItem.create({
            data: {
              labOrderId: id,
              labTestCatalogId: resItem.labTestCatalogId,
              testName: resItem.testName,
              valueMeasured: resItem.valueMeasured,
              unit: resItem.unit,
              refRangeText,
              flag,
              interpretation: resItem.interpretation
            }
          });
        }
      }

      await tx.labOrder.update({
        where: { id },
        data: {
          status: data.status,
          completedAt: data.status === LabOrderStatus.completed ? new Date() : null
        }
      });
    });

    const updated = await prisma.labOrder.findUnique({
      where: { id },
      include: { results: true, patient: true, vet: true }
    });

    return res.json({
      success: true,
      message: 'Resultados de laboratorio registrados y validados con éxito.',
      order: updated
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[Lab] Error al guardar resultados:', error);
    return res.status(500).json({ error: 'Error al registrar los resultados analíticos.' });
  }
});
