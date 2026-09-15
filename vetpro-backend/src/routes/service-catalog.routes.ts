import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';

const router = Router();
router.use(authMiddleware as any);

// GET /service-catalog (Listar servicios de la clínica — plantillas para facturación)
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const services = await prisma.serviceCatalog.findMany({
      where: { clinicId, active: true },
      orderBy: { name: 'asc' }
    });
    return res.json(services);
  } catch (error) {
    console.error('[ServiceCatalogRoutes] Error al listar servicios:', error);
    return res.status(500).json({ error: 'Error al consultar el catálogo de servicios.' });
  }
});

// POST /service-catalog (Crear plantilla de servicio propia de la clínica)
router.post('/', roleMiddleware(['admin', 'vet']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  const { name, salePrice, taxRate } = req.body;
  if (!name || salePrice === undefined || salePrice === null) {
    return res.status(400).json({ error: 'Nombre y precio del servicio son obligatorios.' });
  }
  if (Number(salePrice) < 0) {
    return res.status(400).json({ error: 'El precio no puede ser negativo.' });
  }

  try {
    const service = await prisma.serviceCatalog.create({
      data: {
        clinicId,
        name: name.trim(),
        salePrice: Number(salePrice),
        taxRate: taxRate !== undefined ? Number(taxRate) : 0.19
      }
    });
    return res.status(201).json(service);
  } catch (error) {
    console.error('[ServiceCatalogRoutes] Error al crear servicio:', error);
    return res.status(500).json({ error: 'Error al registrar el servicio.' });
  }
});

// PATCH /service-catalog/:id (Editar nombre/precio/impuesto)
router.patch('/:id', roleMiddleware(['admin', 'vet']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  const { name, salePrice, taxRate } = req.body;

  try {
    const existing = await prisma.serviceCatalog.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ error: 'Servicio no encontrado.' });

    const updated = await prisma.serviceCatalog.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(salePrice !== undefined ? { salePrice: Number(salePrice) } : {}),
        ...(taxRate !== undefined ? { taxRate: Number(taxRate) } : {})
      }
    });
    return res.json(updated);
  } catch (error) {
    console.error('[ServiceCatalogRoutes] Error al actualizar servicio:', error);
    return res.status(500).json({ error: 'Error al actualizar el servicio.' });
  }
});

// DELETE /service-catalog/:id (Desactivar — soft delete)
router.delete('/:id', roleMiddleware(['admin', 'vet']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const existing = await prisma.serviceCatalog.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ error: 'Servicio no encontrado.' });

    await prisma.serviceCatalog.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'Servicio eliminado del catálogo.' });
  } catch (error) {
    console.error('[ServiceCatalogRoutes] Error al eliminar servicio:', error);
    return res.status(500).json({ error: 'Error al eliminar el servicio.' });
  }
});

export const SERVICE_CATALOG_ROUTES = router;
