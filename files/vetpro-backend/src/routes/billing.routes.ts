import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = Router();

router.use(authMiddleware as any);
router.use(roleMiddleware(['admin', 'receptionist']) as any);

// GET /billing/invoices (Listado paginado de facturas con filtros)
router.get('/invoices', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 20;
  const skip = (page - 1) * pageSize;

  const search = req.query.search as string;
  const status = req.query.status as string;

  try {
    const whereClause: any = { clinicId };

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (search) {
      const q = search.trim().toLowerCase();
      whereClause.OR = [
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { tutor: { firstName: { contains: q, mode: 'insensitive' } } },
        { tutor: { lastName: { contains: q, mode: 'insensitive' } } },
        { tutor: { phone: { contains: q } } }
      ];
    }

    const [invoices, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where: whereClause,
        include: { tutor: true },
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
  } catch (error) {
    console.error('Error al listar facturas:', error);
    return res.status(500).json({ error: 'Error al obtener listado de facturas.' });
  }
});

// GET /billing/summary (Resumen de facturación e ingresos por rango de fecha)
router.get('/summary', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const from = req.query.from ? new Date(req.query.from as string) : new Date(Date.now() - 30 * 86400000);
  const to = req.query.to ? new Date(req.query.to as string) : new Date();

  try {
    // Obtener todas las facturas en el rango
    const invoices = await prisma.invoice.findMany({
      where: {
        clinicId,
        issuedAt: {
          gte: from,
          lte: to
        }
      }
    });

    const activeInvoices = invoices.filter(inv => inv.status !== 'void');

    const totalInvoiced = activeInvoices.reduce((acc, cur) => acc + cur.total, 0);
    const totalCollected = activeInvoices.reduce((acc, cur) => acc + cur.amountPaid, 0);
    const totalPending = activeInvoices.reduce((acc, cur) => acc + cur.balance, 0);

    const invoicesCountByStatus = {
      paid: activeInvoices.filter(inv => inv.status === 'paid').length,
      partial: activeInvoices.filter(inv => inv.status === 'partial').length,
      issued: activeInvoices.filter(inv => inv.status === 'issued').length,
      draft: activeInvoices.filter(inv => inv.status === 'draft').length,
      void: invoices.filter(inv => inv.status === 'void').length
    };

    return res.json({
      totalInvoiced,
      totalCollected,
      totalPending,
      invoicesCount: invoices.length,
      statusBreakdown: invoicesCountByStatus
    });
  } catch (error) {
    console.error('Error al generar resumen financiero:', error);
    return res.status(500).json({ error: 'Error al calcular resumen financiero.' });
  }
});

// GET /billing/invoices/:id (Obtener detalle completo de factura)
router.get('/invoices/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId },
      include: {
        tutor: true,
        items: true,
        appointment: {
          include: {
            patient: true,
            vet: {
              select: { firstName: true, lastName: true }
            }
          }
        }
      }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    return res.json(invoice);
  } catch (error) {
    console.error('Error al buscar factura:', error);
    return res.status(500).json({ error: 'Error al obtener detalles del comprobante.' });
  }
});

// POST /billing/invoices (Crear borrador de factura)
router.post('/invoices', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { tutorId, appointmentId, items, notes, dueAt } = req.body;

  if (!tutorId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'tutorId y una lista de ítems no vacía son campos obligatorios.' });
  }

  try {
    // Generar consecutivo interno
    const count = await prisma.invoice.count({ where: { clinicId } });
    const invoiceNumber = `FAC-${(count + 1).toString().padStart(6, '0')}`;

    // Calcular montos de la factura basados en items
    let subtotal = 0;
    let taxTotal = 0;

    const formattedItems = items.map((item: any) => {
      const quantity = parseFloat(item.quantity) || 1;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const taxRate = parseFloat(item.taxRate) || 0.19; // pred. 19% IVA Colombia
      const discount = parseFloat(item.discount) || 0;

      const baseTotal = quantity * unitPrice;
      const discountAmount = baseTotal * (discount / 100);
      const netTotal = baseTotal - discountAmount;
      const taxAmount = netTotal * taxRate;
      const finalTotal = netTotal + taxAmount;

      subtotal += netTotal;
      taxTotal += taxAmount;

      return {
        description: item.description,
        productId: item.productId || null,
        quantity,
        unitPrice,
        taxRate,
        discount,
        total: parseFloat(finalTotal.toFixed(2))
      };
    });

    const total = subtotal + taxTotal;

    const invoice = await prisma.invoice.create({
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

    return res.status(201).json(invoice);
  } catch (error) {
    console.error('Error al crear factura:', error);
    return res.status(500).json({ error: 'Error al registrar comprobante borrador.' });
  }
});

// PATCH /billing/invoices/:id/issue (Emitir factura / Confirmar de borrador a emitida)
router.patch('/invoices/:id/issue', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId }
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
  } catch (error) {
    console.error('Error al emitir factura:', error);
    return res.status(500).json({ error: 'Error al formalizar el comprobante.' });
  }
});

// PATCH /billing/invoices/:id/pay (Registrar abono o pago completo)
router.patch('/invoices/:id/pay', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { amount, method } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'El monto a pagar debe ser mayor a cero.' });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    if (invoice.status === 'void' || invoice.status === 'paid') {
      return res.status(400).json({ error: 'No se pueden registrar abonos a facturas anuladas o completamente pagadas.' });
    }

    const payValue = parseFloat(amount);
    const newAmountPaid = invoice.amountPaid + payValue;
    const newBalance = Math.max(0, invoice.total - newAmountPaid);
    const newStatus = newBalance === 0 ? 'paid' : 'partial';

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: newStatus,
        amountPaid: parseFloat(newAmountPaid.toFixed(2)),
        balance: parseFloat(newBalance.toFixed(2)),
        paidAt: newStatus === 'paid' ? new Date() : null,
        notes: invoice.notes + `\n[Pago registrado: ${payValue.toFixed(2)} mediante ${method || 'Efectivo'}]`
      },
      include: {
        tutor: true,
        items: true
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error al registrar pago:', error);
    return res.status(500).json({ error: 'Error al acreditar el pago a la factura.' });
  }
});

// PATCH /billing/invoices/:id/void (Anular Factura)
router.patch('/invoices/:id/void', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { reason } = req.body;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { id, clinicId }
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: 'void',
        balance: 0,
        notes: invoice.notes + `\n[Anulación: ${reason || 'Sin motivo indicado'}]`
      },
      include: {
        tutor: true,
        items: true
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error al anular factura:', error);
    return res.status(500).json({ error: 'Error al anular el comprobante.' });
  }
});

export const BILLING_ROUTES = router;
