import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = Router();

router.use(authMiddleware as any);
router.use(roleMiddleware(['admin', 'vet']) as any);

/**
 * Calcula los rangos de fecha "actual" y "anterior" (para comparación) según
 * el periodo seleccionado en el filtro del dashboard ejecutivo.
 */
function getPeriodRanges(period: string, now: Date) {
  if (period === 'thisYear') {
    const currentStart = new Date(now.getFullYear(), 0, 1);
    const previousStart = new Date(now.getFullYear() - 1, 0, 1);
    const previousEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate(), 23, 59, 59);
    return { currentStart, currentEnd: now, previousStart, previousEnd };
  }
  if (period === 'thisMonth') {
    const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const previousEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { currentStart, currentEnd: now, previousStart, previousEnd };
  }
  // '30days' (por defecto): últimos 30 días vs los 30 días anteriores
  const currentStart = new Date(now.getTime() - 30 * 86400000);
  const previousStart = new Date(now.getTime() - 60 * 86400000);
  const previousEnd = currentStart;
  return { currentStart, currentEnd: now, previousStart, previousEnd };
}

// GET /api/v1/reports/dashboard — Métricas de Negocio & Datasets de Gráficas
router.get('/dashboard', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const now = new Date();
    const period = (req.query.period as string) || '30days';
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodRanges(period, now);

    // 1. KPIs Generales (según el periodo seleccionado)
    const billingThisMonth = await prisma.invoice.aggregate({
      where: {
        clinicId,
        status: { not: 'void' },
        issuedAt: { gte: currentStart, lte: currentEnd }
      },
      _sum: { total: true }
    });

    const billingLastMonth = await prisma.invoice.aggregate({
      where: {
        clinicId,
        status: { not: 'void' },
        issuedAt: { gte: previousStart, lte: previousEnd }
      },
      _sum: { total: true }
    });

    // Consultas médicas en el periodo
    const recordsThisMonth = await prisma.medicalRecord.count({
      where: {
        clinicId,
        createdAt: { gte: currentStart, lte: currentEnd }
      }
    });

    const recordsLastMonth = await prisma.medicalRecord.count({
      where: {
        clinicId,
        createdAt: { gte: previousStart, lte: previousEnd }
      }
    });

    // Pacientes nuevos en el periodo
    const newPatientsThisMonth = await prisma.patient.count({
      where: {
        clinicId,
        createdAt: { gte: currentStart, lte: currentEnd }
      }
    });

    const newPatientsLastMonth = await prisma.patient.count({
      where: {
        clinicId,
        createdAt: { gte: previousStart, lte: previousEnd }
      }
    });

    // Citas por estado
    const apptsByStatus = await prisma.appointment.groupBy({
      by: ['status'],
      where: { clinicId },
      _count: { id: true }
    });

    // Distribución de especies
    const speciesDist = await prisma.patient.groupBy({
      by: ['species'],
      where: { clinicId },
      _count: { id: true }
    });

    // Total de pacientes
    const totalPatientsCount = await prisma.patient.count({
      where: { clinicId, status: 'active' }
    });

    // Tasa de retención (Pacientes atendidos en los últimos 90 días vs. los 90 días previos)
    const date90DaysAgo = new Date(Date.now() - 90 * 86400000);
    const date180DaysAgo = new Date(Date.now() - 180 * 86400000);

    const activeAttendedCount = await prisma.medicalRecord.groupBy({
      by: ['patientId'],
      where: {
        clinicId,
        createdAt: { gte: date90DaysAgo }
      }
    });

    const previousActiveAttendedCount = await prisma.medicalRecord.groupBy({
      by: ['patientId'],
      where: {
        clinicId,
        createdAt: { gte: date180DaysAgo, lt: date90DaysAgo }
      }
    });

    const retentionRate = totalPatientsCount > 0
      ? parseFloat(((activeAttendedCount.length / totalPatientsCount) * 100).toFixed(1))
      : 0;

    const previousRetentionRate = totalPatientsCount > 0
      ? parseFloat(((previousActiveAttendedCount.length / totalPatientsCount) * 100).toFixed(1))
      : 0;

    // Rentabilidad real por categoría de servicio (ítems facturados en el periodo actual)
    const periodInvoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoice: { clinicId, status: { not: 'void' }, issuedAt: { gte: currentStart, lte: currentEnd } }
      },
      select: { productId: true, total: true }
    });

    const productIds = [...new Set(periodInvoiceItems.map(i => i.productId).filter((id): id is string => !!id))];
    const products = productIds.length
      ? await prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, category: true } })
      : [];
    const categoryById = new Map(products.map(p => [p.id, p.category]));

    const categoryLabels: Record<string, string> = {
      medication: 'Medicamentos',
      vaccine: 'Vacunación',
      surgical_supply: 'Cirugías/Insumos Quirúrgicos',
      consumable: 'Consumibles',
      food: 'Alimentos',
      accessory: 'Accesorios',
      lab_reagent: 'Laboratorios/Ecografías',
      other: 'Otros Insumos',
      services: 'Consultas y Servicios'
    };

    const rentabilityByCategory = new Map<string, number>();
    for (const item of periodInvoiceItems) {
      const category = item.productId ? (categoryById.get(item.productId) || 'other') : 'services';
      rentabilityByCategory.set(category, (rentabilityByCategory.get(category) || 0) + item.total);
    }
    const sortedRentability = [...rentabilityByCategory.entries()].sort((a, b) => b[1] - a[1]);

    // Historial de Ingresos de los últimos 6 meses
    const monthsData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);

      const sumTotal = await prisma.invoice.aggregate({
        where: {
          clinicId,
          status: { not: 'void' },
          issuedAt: { gte: start, lte: end }
        },
        _sum: { total: true }
      });

      const label = d.toLocaleString('es-CO', { month: 'short' });
      monthsData.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        amount: sumTotal._sum.total || 0
      });
    }

    // Respuesta consolidada con datos reales
    return res.json({
      kpis: {
        revenue: {
          current: billingThisMonth._sum.total || 0,
          previous: billingLastMonth._sum.total || 0,
          growth: billingLastMonth._sum.total ? parseFloat((((billingThisMonth._sum.total || 0) - billingLastMonth._sum.total) / billingLastMonth._sum.total * 100).toFixed(1)) : 0
        },
        consultations: {
          current: recordsThisMonth,
          previous: recordsLastMonth,
          growth: recordsLastMonth ? parseFloat(((recordsThisMonth - recordsLastMonth) / recordsLastMonth * 100).toFixed(1)) : 0
        },
        newPatients: {
          current: newPatientsThisMonth,
          previous: newPatientsLastMonth,
          growth: newPatientsLastMonth ? parseFloat(((newPatientsThisMonth - newPatientsLastMonth) / newPatientsLastMonth * 100).toFixed(1)) : 0
        },
        retentionRate: {
          current: retentionRate,
          previous: previousRetentionRate,
          growth: parseFloat((retentionRate - previousRetentionRate).toFixed(1))
        }
      },
      charts: {
        revenueHistory: {
          labels: monthsData.map(m => m.label),
          data: monthsData.map(m => m.amount)
        },
        serviceRentability: sortedRentability.length
          ? {
              labels: sortedRentability.map(([cat]) => categoryLabels[cat] || cat),
              data: sortedRentability.map(([, total]) => Math.round(total))
            }
          : { labels: [], data: [] },
        appointmentStatus: {
          labels: ['Completadas', 'Agendadas', 'En Espera', 'Canceladas'],
          data: [
            apptsByStatus.find(a => a.status === 'done')?._count.id || 0,
            apptsByStatus.find(a => a.status === 'scheduled')?._count.id || 0,
            apptsByStatus.find(a => a.status === 'waiting')?._count.id || 0,
            apptsByStatus.find(a => a.status === 'cancelled')?._count.id || 0
          ]
        },
        speciesDistribution: {
          labels: ['Perros', 'Gatos', 'Conejos', 'Otros'],
          data: [
            speciesDist.find(s => s.species === 'dog')?._count.id || 0,
            speciesDist.find(s => s.species === 'cat')?._count.id || 0,
            speciesDist.find(s => s.species === 'rabbit')?._count.id || 0,
            speciesDist.filter(s => s.species !== 'dog' && s.species !== 'cat' && s.species !== 'rabbit').reduce((acc, curr) => acc + curr._count.id, 0)
          ]
        }
      },
      inventoryRotation: await (async () => {
        const lowStockProducts = await prisma.product.findMany({
          where: { clinicId, active: true },
          orderBy: { currentStock: 'asc' },
          take: 5
        });

        const last30Days = new Date(Date.now() - 30 * 86400000);
        const salesByProduct = await prisma.inventoryMovement.groupBy({
          by: ['productId'],
          where: {
            clinicId,
            type: 'out',
            performedAt: { gte: last30Days },
            productId: { in: lowStockProducts.map(p => p.id) }
          },
          _sum: { quantity: true }
        });
        const salesByProductId = new Map(salesByProduct.map(s => [s.productId, s._sum.quantity || 0]));

        return lowStockProducts.map(p => ({
          sku: p.sku,
          name: p.name,
          category: p.category,
          stock: p.currentStock,
          minStock: p.minStock,
          salesCount: salesByProductId.get(p.id) || 0
        }));
      })()
    });
  } catch (dbError) {
    console.error('Error al calcular métricas de reporte:', dbError);
    return res.status(500).json({ error: 'Error al consultar las métricas del dashboard.' });
  }
});

// GET /api/v1/reports/export/excel — Generar y descargar reporte CSV compatible con Excel
router.get('/export/excel', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    // 1. Obtener la información consolidada en base de datos
    const invoicesList = await prisma.invoice.findMany({
      where: { clinicId, status: { not: 'void' } },
      include: { tutor: true },
      orderBy: { issuedAt: 'desc' }
    });

    // 2. Generar el string de datos CSV compatible con Microsoft Excel (separador ';' regional y BOM UTF-8)
    const BOM = '\uFEFF';
    let csvContent = '';

    // Encabezado
    csvContent += 'REPORTE EJECUTIVO FINANCIERO - VETPRO SaaS\n';
    csvContent += `Fecha de generación:;${new Date().toLocaleDateString('es-CO')} ${new Date().toLocaleTimeString('es-CO')}\n\n`;
    csvContent += 'Consecutivo;Fecha de Emisión;Tutor;Teléfono;Total Facturado;Monto Abonado;Saldo Pendiente;Estado\n';

    // Filas de datos
    invoicesList.forEach((inv: any) => {
      const date = new Date(inv.issuedAt).toLocaleDateString('es-CO');
      const tutorName = inv.tutor ? `${inv.tutor.firstName} ${inv.tutor.lastName}` : 'Anónimo';
      const tutorPhone = inv.tutor ? inv.tutor.phone : 'N/A';
      const statusText = inv.status === 'paid' ? 'Pagado' : (inv.status === 'partial' ? 'Pago Parcial' : (inv.status === 'void' ? 'Anulado' : 'Emitido'));

      csvContent += `${inv.invoiceNumber};${date};${tutorName};${tutorPhone};${inv.total};${inv.amountPaid};${inv.balance};${statusText}\n`;
    });

    // Resumen General
    const sumTotal = invoicesList.reduce((acc, curr: any) => acc + curr.total, 0);
    const sumPaid = invoicesList.reduce((acc, curr: any) => acc + curr.amountPaid, 0);
    const sumBalance = invoicesList.reduce((acc, curr: any) => acc + curr.balance, 0);

    csvContent += `\nTOTALES GENERALES:;;;;${sumTotal};${sumPaid};${sumBalance};\n`;

    // 3. Configurar Headers y responder con descarga
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=reporte_ejecutivo_vetpro.csv');
    
    // Enviar el Byte Order Mark (BOM) primero para forzar el reconocimiento UTF-8 de acentos en Excel
    res.write(Buffer.from(BOM));
    return res.end(csvContent);
  } catch (error) {
    console.error('Error al exportar reporte Excel/CSV:', error);
    return res.status(500).json({ error: 'Error al generar la descarga del reporte.' });
  }
});

export { router as REPORT_ROUTES };
