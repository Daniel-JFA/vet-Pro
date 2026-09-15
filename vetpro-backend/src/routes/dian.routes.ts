import { Router, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

export const DIAN_ROUTES = Router();

DIAN_ROUTES.use(authMiddleware as any);

// ─────────────────────────────────────────────
// UTILIDADES CRIPTOGRÁFICAS DIAN (COLOMBIA)
// ─────────────────────────────────────────────

/**
 * Calcula el CUFE (Código Único de Factura Electrónica) oficial según el estándar DIAN:
 * CUFE = SHA-384(NumFac + FecFac + HorFac + ValFac + CodImp1 + ValImp1 + ValTot + NitEmisor + NumAdq + ClaveTecnica + TipoAmbiente)
 */
export function calculateCufe(params: {
  invoiceNumber: string;
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss-05:00
  subtotal: number;
  taxAmount: number;
  total: number;
  issuerNit: string;
  customerDoc: string;
  technicalKey: string;
  environment: string; // '1' para producción, '2' para pruebas
}): string {
  const valFac = params.subtotal.toFixed(2);
  const valImp1 = params.taxAmount.toFixed(2);
  const valTot = params.total.toFixed(2);
  const codImp1 = '01'; // 01 = IVA en el catálogo DIAN

  const rawString = [
    params.invoiceNumber,
    params.issueDate,
    params.issueTime,
    valFac,
    codImp1,
    valImp1,
    valTot,
    params.issuerNit.replace(/[^0-9]/g, ''),
    params.customerDoc.replace(/[^0-9]/g, ''),
    params.technicalKey,
    params.environment === 'production' ? '1' : '2'
  ].join('');

  return crypto.createHash('sha384').update(rawString).digest('hex');
}

/**
 * Genera el enlace de consulta para el código QR oficial de la DIAN
 */
export function generateDianQrUrl(cufe: string): string {
  return `https://catalogo-vpfe.dian.gov.co/document/searchqr?documentkey=${cufe}`;
}

/**
 * Adaptador genérico de transmisión a un Proveedor Tecnológico Autorizado por la DIAN
 * (Alegra, Siigo, Facture, etc.). Solo se activa si DIAN_PROVIDER_URL y DIAN_PROVIDER_API_KEY
 * están configurados en el entorno. Sin esta configuración, el sistema NO puede emitir
 * documentos con validez fiscal real ante la DIAN.
 */
interface DianProviderResult {
  transmitted: boolean;
  cufe?: string;
  qrCodeUrl?: string;
  xmlUblUrl?: string;
  error?: string;
}

async function transmitToDianProvider(payload: {
  invoiceNumber: string;
  issueDate: string;
  issuerNit: string;
  customerDoc: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  environment: string;
}): Promise<DianProviderResult> {
  const providerUrl = process.env.DIAN_PROVIDER_URL;
  const providerApiKey = process.env.DIAN_PROVIDER_API_KEY;

  if (!providerUrl || !providerApiKey) {
    return { transmitted: false, error: 'PROVIDER_NOT_CONFIGURED' };
  }

  try {
    const response = await fetch(providerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${providerApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      return { transmitted: false, error: `PROVIDER_ERROR_${response.status}` };
    }

    const data: any = await response.json();
    return {
      transmitted: true,
      cufe: data.cufe,
      qrCodeUrl: data.qrCodeUrl,
      xmlUblUrl: data.xmlUblUrl
    };
  } catch (error: any) {
    console.error('[DIAN] Error al transmitir al proveedor tecnológico:', error);
    return { transmitted: false, error: 'PROVIDER_UNREACHABLE' };
  }
}

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────

const CreateResolutionSchema = z.object({
  prefix: z.string().min(1, 'El prefijo es obligatorio (ej: SETP, FEV)').max(6),
  resolutionNumber: z.string().min(3, 'El número de resolución DIAN es obligatorio'),
  fromNumber: z.number().int().positive(),
  toNumber: z.number().int().positive(),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  technicalKey: z.string().min(10, 'La clave técnica suministrada por la DIAN es obligatoria'),
  environment: z.enum(['test', 'production']).default('test')
});

const OpenShiftSchema = z.object({
  branchId: z.string().uuid('ID de sucursal inválido'),
  openingBalance: z.number().nonnegative('La base inicial de efectivo no puede ser negativa'),
  notes: z.string().optional()
});

const CloseShiftSchema = z.object({
  shiftId: z.string().uuid('ID de turno inválido'),
  actualBalance: z.number().nonnegative('El efectivo físico contado no puede ser negativo'),
  notes: z.string().optional()
});

// ─────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────

// GET /api/v1/billing/dian/resolutions (Consultar resoluciones de facturación)
DIAN_ROUTES.get('/resolutions', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const resolutions = await prisma.dianResolution.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(resolutions);
  } catch (error: any) {
    console.error('[DIAN] Error al consultar resoluciones:', error);
    return res.status(500).json({ error: 'Error al consultar resoluciones DIAN.' });
  }
});

// POST /api/v1/billing/dian/resolutions (Registrar nueva resolución autorizada por la DIAN)
DIAN_ROUTES.post('/resolutions', roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = CreateResolutionSchema.parse(req.body);

    // Desactivar resoluciones previas si es necesario
    await prisma.dianResolution.updateMany({
      where: { clinicId, active: true, prefix: data.prefix },
      data: { active: false }
    });

    const resolution = await prisma.dianResolution.create({
      data: {
        clinicId,
        prefix: data.prefix.toUpperCase(),
        resolutionNumber: data.resolutionNumber,
        fromNumber: data.fromNumber,
        toNumber: data.toNumber,
        currentNumber: data.fromNumber,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        technicalKey: data.technicalKey,
        environment: data.environment,
        active: true
      }
    });

    return res.status(201).json(resolution);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[DIAN] Error al crear resolución:', error);
    return res.status(500).json({ error: 'Error al registrar la resolución DIAN.' });
  }
});

// POST /api/v1/billing/dian/invoices/:id/issue (Emitir Factura Electrónica FEV ante la DIAN)
DIAN_ROUTES.post('/invoices/:id/issue', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId },
      include: {
        clinic: true,
        tutor: true,
        items: true
      }
    });

    if (!invoice) return res.status(404).json({ error: 'Factura no encontrada.' });
    if (invoice.dianStatus === 'validated') {
      return res.status(400).json({
        error: 'Esta factura ya fue emitida y validada electrónicamente ante la DIAN.',
        cufe: invoice.cufe
      });
    }

    // Buscar resolución activa
    let resolution = await prisma.dianResolution.findFirst({
      where: { clinicId, active: true },
      orderBy: { createdAt: 'desc' }
    });

    // Si no hay resolución configurada, crear una provisional de pruebas (Ambiente Habilitación DIAN)
    if (!resolution) {
      resolution = await prisma.dianResolution.create({
        data: {
          clinicId,
          prefix: 'SETP',
          resolutionNumber: '18760000001',
          fromNumber: 1,
          toNumber: 500000,
          currentNumber: 1,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2028-12-31'),
          technicalKey: 'fc8eac422eba16e122d5aa92a14da838ec4f23b16a407fe150fb46237c4f53bc01947815c690f97eee7b32be1bb013f4',
          environment: 'test',
          active: true
        }
      });
    }

    const now = new Date();
    const issueDate = now.toISOString().split('T')[0];
    const issueTime = `${now.toTimeString().split(' ')[0]}-05:00`;
    const issuerNit = invoice.clinic.nit || '900123456-1';
    const customerDoc = invoice.tutor.documentId || '222222222222'; // Consumidor final

    // Consecutivo fiscal
    const fiscalNumber = `${resolution.prefix}-${String(resolution.currentNumber).padStart(6, '0')}`;

    // Cálculo del CUFE oficial
    const cufe = calculateCufe({
      invoiceNumber: fiscalNumber,
      issueDate,
      issueTime,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxTotal,
      total: invoice.total,
      issuerNit,
      customerDoc,
      technicalKey: resolution.technicalKey,
      environment: resolution.environment
    });

    // Intentar transmisión real a un Proveedor Tecnológico Autorizado (si está configurado)
    const providerResult = await transmitToDianProvider({
      invoiceNumber: fiscalNumber,
      issueDate,
      issuerNit,
      customerDoc,
      subtotal: invoice.subtotal,
      taxAmount: invoice.taxTotal,
      total: invoice.total,
      environment: resolution.environment
    });

    const wasTransmitted = providerResult.transmitted;
    const finalCufe = providerResult.cufe || cufe;
    const qrCodeUrl = providerResult.qrCodeUrl || generateDianQrUrl(finalCufe);
    const xmlUblUrl = providerResult.xmlUblUrl;

    const updated = await prisma.$transaction(async tx => {
      // 1. Incrementar consecutivo en la resolución
      await tx.dianResolution.update({
        where: { id: resolution.id },
        data: { currentNumber: { increment: 1 } }
      });

      // 2. Actualizar factura con metadatos fiscales
      return tx.invoice.update({
        where: { id: invoice.id },
        data: {
          invoiceNumber: fiscalNumber,
          electronicId: finalCufe,
          cufe: finalCufe,
          qrCodeUrl,
          xmlUblUrl: xmlUblUrl || null,
          // Solo se marca "validated" cuando un Proveedor Tecnológico Autorizado
          // confirmó la transmisión real ante la DIAN. Sin esa confirmación el
          // documento no tiene validez fiscal, aunque ya tenga un CUFE calculado.
          dianStatus: wasTransmitted ? 'validated' : 'pending',
          dianResolutionId: resolution.id,
          status: invoice.status === 'draft' ? 'issued' : invoice.status
        }
      });
    });

    return res.json({
      success: true,
      transmittedToDian: wasTransmitted,
      message: wasTransmitted
        ? 'Factura Electrónica de Venta (FEV) transmitida y validada exitosamente ante la DIAN.'
        : 'Documento generado en modo de pruebas internas con CUFE de referencia. NO ha sido transmitido ni validado por la DIAN: configure DIAN_PROVIDER_URL y DIAN_PROVIDER_API_KEY con un Proveedor Tecnológico Autorizado (Alegra, Siigo, Facture, etc.) para emitir documentos con validez fiscal real.',
      invoice: updated,
      dianDetails: {
        cufe: finalCufe,
        qrCodeUrl,
        xmlUblUrl: xmlUblUrl || null,
        resolutionNumber: resolution.resolutionNumber,
        prefix: resolution.prefix,
        environment: resolution.environment,
        transmittedToDian: wasTransmitted,
        validatedAt: wasTransmitted ? now : null
      }
    });
  } catch (error: any) {
    console.error('[DIAN] Error al emitir factura electrónica:', error);
    return res.status(500).json({ error: 'Error al emitir el documento electrónico ante la DIAN.' });
  }
});

// ─────────────────────────────────────────────
// CONTROL DE CAJA / POS (CIERRES Y ARQUEOS)
// ─────────────────────────────────────────────

// GET /api/v1/billing/dian/pos/current-shift (Consultar turno de caja activo)
DIAN_ROUTES.get(['/pos/current-shift', '/cash-shifts/current'], async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const userId = req.user?.id;

  if (!clinicId || !userId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const activeShift = await prisma.cashRegisterShift.findFirst({
      where: { clinicId, userId, status: 'open' },
      include: { branch: { select: { id: true, name: true } } },
      orderBy: { openedAt: 'desc' }
    });

    return res.json(activeShift || null);
  } catch (error: any) {
    console.error('[POS] Error al consultar turno:', error);
    return res.status(500).json({ error: 'Error al consultar el turno de caja.' });
  }
});

// POST /api/v1/billing/dian/pos/shift-open (Apertura de caja)
DIAN_ROUTES.post('/pos/shift-open', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const userId = req.user?.id;

  if (!clinicId || !userId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = OpenShiftSchema.parse(req.body);

    const existingOpen = await prisma.cashRegisterShift.findFirst({
      where: { clinicId, userId, status: 'open' }
    });
    if (existingOpen) {
      return res.status(400).json({ error: 'Ya tiene un turno de caja abierto en este momento.' });
    }

    const shift = await prisma.cashRegisterShift.create({
      data: {
        clinicId,
        branchId: data.branchId,
        userId,
        openingBalance: data.openingBalance,
        expectedBalance: data.openingBalance,
        status: 'open',
        notes: data.notes
      }
    });

    return res.status(201).json(shift);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[POS] Error al abrir turno:', error);
    return res.status(500).json({ error: 'Error al realizar la apertura de caja.' });
  }
});

// POST /api/v1/billing/dian/pos/shift-close (Cierre de caja y arqueo diario)
DIAN_ROUTES.post('/pos/shift-close', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const userId = req.user?.id;

  if (!clinicId || !userId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const data = CloseShiftSchema.parse(req.body);

    const shift = await prisma.cashRegisterShift.findFirst({
      where: { id: data.shiftId, clinicId, userId, status: 'open' }
    });
    if (!shift) return res.status(404).json({ error: 'Turno de caja abierto no encontrado.' });

    // Calcular ventas realizadas durante el turno
    const invoices = await prisma.invoice.findMany({
      where: {
        clinicId,
        issuedAt: { gte: shift.openedAt },
        status: { in: ['issued', 'paid', 'partial'] }
      }
    });

    const cashSales = invoices.reduce((acc, inv) => acc + (inv.amountPaid || 0), 0);
    const expectedBalance = shift.openingBalance + cashSales;
    const difference = data.actualBalance - expectedBalance;

    const closed = await prisma.cashRegisterShift.update({
      where: { id: shift.id },
      data: {
        closedAt: new Date(),
        cashSales,
        expectedBalance,
        actualBalance: data.actualBalance,
        difference,
        status: 'closed',
        notes: data.notes
      }
    });

    return res.json({
      success: true,
      message: 'Turno de caja cerrado y arqueo completado.',
      shift: closed
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Datos inválidos', details: error.flatten().fieldErrors });
    }
    console.error('[POS] Error al cerrar turno:', error);
    return res.status(500).json({ error: 'Error al realizar el cierre de caja.' });
  }
});
