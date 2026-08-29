import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware as any);

// ─────────────────────────────────────────────
// ESQUEMAS DE VALIDACIÓN ZOD
// ─────────────────────────────────────────────
const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'La descripción del ítem es obligatoria'),
  productId: z.string().uuid('ID de producto inválido').optional().nullable(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0').default(1),
  unitPrice: z.number().nonnegative('El precio unitario no puede ser negativo'),
  taxRate: z.number().min(0).max(1).default(0.19), // IVA por defecto 19%
  discount: z.number().min(0).max(100).default(0)
});

const CreateInvoiceSchema = z.object({
  tutorId: z.string().uuid('ID de tutor inválido'),
  appointmentId: z.string().uuid('ID de cita inválido').optional().nullable(),
  items: z.array(InvoiceItemSchema).min(1, 'La factura debe contener al menos un ítem'),
  notes: z.string().optional(),
  dueAt: z.string().datetime().optional().nullable(),
  autoDeductInventory: z.boolean().default(true)
});

const PaymentSchema = z.object({
  amount: z.number().positive('El monto a pagar debe ser mayor a cero'),
  method: z.string().min(1, 'El método de pago es obligatorio').default('Efectivo')
});

// ─────────────────────────────────────────────
// CONTROLADOR DE CONSECUTIVOS SEGUROS
// ─────────────────────────────────────────────
async function generateNextInvoiceNumber(tx: any, clinicId: string): Promise<string> {
  const latestInvoice = await tx.invoice.findFirst({
    where: { clinicId },
    orderBy: { issuedAt: 'desc' },
    select: { invoiceNumber: true }
  });

  let nextSeq = 1;
  if (latestInvoice && latestInvoice.invoiceNumber) {
    const match = latestInvoice.invoiceNumber.match(/FAC-(\d+)/);
    if (match && match[1]) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `FAC-${nextSeq.toString().padStart(6, '0')}`;
}

// ─────────────────────────────────────────────
// ENDPOINTS DE FACTURACIÓN
// ─────────────────────────────────────────────

// GET /api/v1/billing/invoices (Listado de Facturas con Paginación y Filtros)
router.get('/invoices', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { status, tutorId, search, startDate, endDate } = req.query;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
  const skip = (page - 1) * pageSize;

  try {
    const whereClause: any = {
      clinicId,
      deletedAt: null
    };

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (tutorId) {
      whereClause.tutorId = String(tutorId);
    }

    if (startDate || endDate) {
      whereClause.issuedAt = {};
      if (startDate) whereClause.issuedAt.gte = new Date(String(startDate));
      if (endDate) whereClause.issuedAt.lte = new Date(String(endDate));
    }

    if (search) {
      whereClause.OR = [
        { invoiceNumber: { contains: String(search), mode: 'insensitive' } },
        { tutor: { firstName: { contains: String(search), mode: 'insensitive' } } },
        { tutor: { lastName: { contains: String(search), mode: 'insensitive' } } },
        { tutor: { phone: { contains: String(search), mode: 'insensitive' } } }
      ];
    }

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where: whereClause,
        include: {
          tutor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true
            }
          },
          items: true
        },
        orderBy: { issuedAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.invoice.count({ where: whereClause })
    ]);

    return res.json({
      data: invoices,
      total,
      page,
      pageSize
    });
  } catch (error: any) {
    console.error('[BillingRoutes] Error al listar facturas:', error);
    return res.status(500).json({ error: 'Error interno al consultar las facturas.' });
  }
});

// GET /api/v1/billing/stats (Métricas Financieras del Dashboard)
router.get('/stats', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allInvoices, monthInvoices] = await Promise.all([
      prisma.invoice.findMany({
        where: { clinicId, deletedAt: null },
        select: { total: true, amountPaid: true, balance: true, status: true }
      }),
      prisma.invoice.findMany({
        where: {
          clinicId,
          deletedAt: null,
          issuedAt: { gte: startOfMonth }
        },
        select: { total: true, amountPaid: true, balance: true, status: true }
      })
    ]);

    const totalIncome = allInvoices
      .filter(i => i.status !== 'void')
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    const pendingBalance = allInvoices
      .filter(i => i.status !== 'void')
      .reduce((acc, curr) => acc + curr.balance, 0);

    const monthIncome = monthInvoices
      .filter(i => i.status !== 'void')
      .reduce((acc, curr) => acc + curr.amountPaid, 0);

    const paidInvoicesCount = allInvoices.filter(i => i.status === 'paid').length;
    const partialInvoicesCount = allInvoices.filter(i => i.status === 'partial').length;
    const pendingInvoicesCount = allInvoices.filter(i => i.status === 'issued' || i.status === 'draft').length;

    return res.json({
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      pendingBalance: parseFloat(pendingBalance.toFixed(2)),
      monthIncome: parseFloat(monthIncome.toFixed(2)),
      counts: {
        total: allInvoices.length,
        paid: paidInvoicesCount,
        partial: partialInvoicesCount,
        pending: pendingInvoicesCount
      }
    });
  } catch (error: any) {
    console.error('[BillingRoutes] Error al calcular estadísticas:', error);
    return res.status(500).json({ error: 'Error al calcular las métricas financieras.' });
  }
});

// GET /api/v1/billing/invoices/:id (Detalle de Factura)
router.get('/invoices/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        clinic: {
          select: {
            name: true,
            nit: true,
            phone: true,
            email: true,
            address: true,
            city: true,
            logoUrl: true
          }
        },
        tutor: true,
        items: true,
        appointment: {
          include: {
            patient: true,
            vet: {
              select: { firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    return res.json(invoice);
  } catch (error: any) {
    console.error('[BillingRoutes] Error al buscar factura:', error);
    return res.status(500).json({ error: 'Error al obtener detalles del comprobante.' });
  }
});

// POST /api/v1/billing/invoices (Crear Factura Transaccional con Descuento de Inventario)
router.post('/invoices', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const userId = req.user?.id || 'system';
  const branchId = req.user?.branchId;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const parsed = CreateInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos de facturación inválidos',
      details: parsed.error.format()
    });
  }

  const { tutorId, appointmentId, items, notes, dueAt, autoDeductInventory } = parsed.data;

  try {
    // 1. Validar propiedad del tutor (Anti-IDOR)
    const tutor = await prisma.tutor.findFirst({
      where: { id: tutorId, clinicId, deletedAt: null }
    });

    if (!tutor) {
      return res.status(404).json({ error: 'El tutor no existe o no pertenece a su clínica.' });
    }

    // 2. Ejecutar transacción atómica: Consecutivo + Factura + Salida de Inventario
    const createdInvoice = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await generateNextInvoiceNumber(tx, clinicId);

      let subtotal = 0;
      let taxTotal = 0;

      const formattedItems = items.map((item) => {
        const baseTotal = item.quantity * item.unitPrice;
        const discountAmount = baseTotal * (item.discount / 100);
        const netTotal = baseTotal - discountAmount;
        const taxAmount = netTotal * item.taxRate;
        const finalTotal = netTotal + taxAmount;

        subtotal += netTotal;
        taxTotal += taxAmount;

        return {
          description: item.description,
          productId: item.productId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          discount: item.discount,
          total: parseFloat(finalTotal.toFixed(2))
        };
      });

      const total = subtotal + taxTotal;

      // Crear la factura
      const invoice = await tx.invoice.create({
        data: {
          clinicId,
          invoiceNumber,
          tutorId,
          appointmentId: appointmentId || null,
          status: 'draft',
          subtotal: parseFloat(subtotal.toFixed(2)),
          taxTotal: parseFloat(taxTotal.toFixed(2)),
          total: parseFloat(total.toFixed(2)),
          amountPaid: 0,
          balance: parseFloat(total.toFixed(2)),
          dueAt: dueAt ? new Date(dueAt) : null,
          notes: notes || '',
          items: {
            create: formattedItems
          }
        },
        include: {
          tutor: true,
          items: true
        }
      });

      // 3. Descuento automático de inventario para ítems con productId
      if (autoDeductInventory) {
        for (const item of items) {
          if (item.productId) {
            const product = await tx.product.findFirst({
              where: { id: item.productId, clinicId }
            });

            if (product) {
              const prevStock = product.currentStock;
              const newStock = prevStock - item.quantity;

              // Actualizar stock del producto
              await tx.product.update({
                where: { id: product.id },
                data: { currentStock: newStock }
              });

              // Determinar la sede del movimiento
              let movementBranchId = branchId;
              if (!movementBranchId) {
                const defaultBranch = await tx.branch.findFirst({ where: { clinicId } });
                movementBranchId = defaultBranch?.id;
              }

              if (movementBranchId) {
                await tx.inventoryMovement.create({
                  data: {
                    clinicId,
                    branchId: movementBranchId,
                    productId: product.id,
                    type: 'out',
                    quantity: item.quantity,
                    quantityBefore: prevStock,
                    quantityAfter: newStock,
                    unitCost: product.costPrice,
                    reason: `Venta en factura ${invoiceNumber}`,
                    referenceId: invoice.id,
                    referenceType: 'invoice',
                    performedBy: userId
                  }
                });
              }
            }
          }
        }
      }

      return invoice;
    });

    return res.status(201).json(createdInvoice);
  } catch (error: any) {
    console.error('[BillingRoutes] Error al crear factura transaccional:', error);
    return res.status(500).json({ error: 'Error al registrar la factura e inventario.' });
  }
});

// PATCH /api/v1/billing/invoices/:id/issue (Emitir Factura Oficial)
router.patch('/invoices/:id/issue', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId, deletedAt: null }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({ error: 'Solo se pueden emitir facturas en estado borrador.' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: invoice.amountPaid >= invoice.total ? 'paid' : 'issued',
        issuedAt: new Date()
      },
      include: {
        tutor: true,
        items: true
      }
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('[BillingRoutes] Error al emitir factura:', error);
    return res.status(500).json({ error: 'Error al formalizar el comprobante.' });
  }
});

// PATCH /api/v1/billing/invoices/:id/pay (Registrar Abono o Pago Total)
router.patch('/invoices/:id/pay', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const parsed = PaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Datos de pago inválidos',
      details: parsed.error.format()
    });
  }

  const { amount, method } = parsed.data;

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId, deletedAt: null }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    if (invoice.status === 'void' || invoice.status === 'paid') {
      return res.status(400).json({
        error: 'No se pueden registrar abonos a facturas anuladas o completamente pagadas.'
      });
    }

    const newAmountPaid = invoice.amountPaid + amount;
    const newBalance = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newBalance === 0 ? 'paid' : 'partial';

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: newStatus,
        amountPaid: parseFloat(newAmountPaid.toFixed(2)),
        balance: parseFloat(newBalance.toFixed(2)),
        paidAt: newStatus === 'paid' ? new Date() : null,
        notes: (invoice.notes ? invoice.notes + '\n' : '') +
          `[Pago: $${amount.toFixed(2)} vía ${method} en ${new Date().toLocaleDateString('es-CO')}]`
      },
      include: {
        tutor: true,
        items: true
      }
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('[BillingRoutes] Error al registrar pago:', error);
    return res.status(500).json({ error: 'Error al acreditar el pago a la factura.' });
  }
});

// PATCH /api/v1/billing/invoices/:id/void (Anular Factura)
router.patch('/invoices/:id/void', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { reason } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId, deletedAt: null }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'void',
        balance: 0,
        notes: (invoice.notes ? invoice.notes + '\n' : '') +
          `[Anulación: ${reason || 'Sin motivo indicado'} - ${new Date().toLocaleDateString('es-CO')}]`
      },
      include: {
        tutor: true,
        items: true
      }
    });

    return res.json(updated);
  } catch (error: any) {
    console.error('[BillingRoutes] Error al anular factura:', error);
    return res.status(500).json({ error: 'Error al anular el comprobante.' });
  }
});

export const BILLING_ROUTES = router;
