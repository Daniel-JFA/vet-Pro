import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { ProductCategory, MovementType } from '@prisma/client';

const router = Router();

router.use(authMiddleware as any);
router.use(roleMiddleware(['admin', 'vet']) as any);

// ─────────────────────────────────────────────
// 📦 PRODUCTOS DE INVENTARIO
// ─────────────────────────────────────────────

// GET /products — Listado paginado de productos con filtros
router.get('/products', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;

    const search = req.query.search as string;
    const category = req.query.category as string;
    const stockFilter = req.query.stockFilter as string; // 'all' | 'low' | 'ok' | 'out'

    // Construir clausula WHERE para Prisma
    const whereClause: any = {
      clinicId,
      active: true
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (category) {
      whereClause.category = category as any;
    }

    // Filtrados de stock reactivos
    if (stockFilter === 'out') {
      whereClause.currentStock = 0;
    }

    if (stockFilter === 'low') {
      const [products, countResult] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT p.*, 
                 json_build_object('id', s.id, 'name', s.name) as supplier
          FROM products p
          LEFT JOIN suppliers s ON p."supplierId" = s.id
          WHERE p."clinicId" = ${clinicId}
            AND p.active = true
            AND p."currentStock" > 0
            AND p."currentStock" <= p."minStock"
          ORDER BY p.name ASC
          LIMIT ${pageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint as count
          FROM products p
          WHERE p."clinicId" = ${clinicId}
            AND p.active = true
            AND p."currentStock" > 0
            AND p."currentStock" <= p."minStock"
        `
      ]);
      const total = Number(countResult[0]?.count || 0);
      return res.json({ data: products, page, pageSize, total });
    }

    if (stockFilter === 'ok') {
      const [products, countResult] = await Promise.all([
        prisma.$queryRaw<any[]>`
          SELECT p.*, 
                 json_build_object('id', s.id, 'name', s.name) as supplier
          FROM products p
          LEFT JOIN suppliers s ON p."supplierId" = s.id
          WHERE p."clinicId" = ${clinicId}
            AND p.active = true
            AND p."currentStock" > p."minStock"
          ORDER BY p.name ASC
          LIMIT ${pageSize} OFFSET ${skip}
        `,
        prisma.$queryRaw<{ count: bigint }[]>`
          SELECT COUNT(*)::bigint as count
          FROM products p
          WHERE p."clinicId" = ${clinicId}
            AND p.active = true
            AND p."currentStock" > p."minStock"
        `
      ]);
      const total = Number(countResult[0]?.count || 0);
      return res.json({ data: products, page, pageSize, total });
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: { supplier: true },
        orderBy: { name: 'asc' },
        skip,
        take: pageSize
      }),
      prisma.product.count({ where: whereClause })
    ]);

    return res.json({
      data: products,
      page,
      pageSize,
      total
    });
  } catch (error) {
    console.error('Error al obtener productos:', error);
    return res.status(500).json({ error: 'Error al consultar productos.' });
  }
});

// GET /products/low-stock — Alertas rápidas de productos con stock bajo
router.get('/products/low-stock', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const products = await prisma.$queryRaw<any[]>`
      SELECT p.*, 
             json_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'email', s.email) as supplier
      FROM products p
      LEFT JOIN suppliers s ON p."supplierId" = s.id
      WHERE p."clinicId" = ${clinicId}
        AND p.active = true
        AND p."currentStock" <= p."minStock"
      ORDER BY p."currentStock" ASC
    `;
    return res.json(products);
  } catch (error) {
    console.error('Error al obtener stock bajo:', error);
    return res.status(500).json({ error: 'Error al obtener alertas de inventario.' });
  }
});

// GET /products/expiring — Alertas de productos próximos a vencer
router.get('/products/expiring', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const daysAhead = parseInt(req.query.daysAhead as string) || 30;
    const limitDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

    const products = await prisma.product.findMany({
      where: {
        clinicId,
        active: true,
        expiresAt: {
          gte: new Date(),
          lte: limitDate
        }
      },
      include: { supplier: true },
      orderBy: { expiresAt: 'asc' }
    });
    return res.json(products);
  } catch (error) {
    console.error('Error al obtener productos próximos a vencer:', error);
    return res.status(500).json({ error: 'Error al obtener alertas de vencimiento.' });
  }
});

// GET /products/:id — Obtener detalle de un producto específico
router.get('/products/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id, clinicId, active: true },
      include: { supplier: true }
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    return res.json(product);
  } catch (error) {
    console.error('Error al obtener producto:', error);
    return res.status(500).json({ error: 'Error al obtener detalle del producto.' });
  }
});

// POST /products — Registrar un nuevo producto en el catálogo
router.post('/products', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const {
    sku, name, category, brand, unit, description, barcode,
    requiresPrescription, controlled, minStock, currentStock,
    costPrice, salePrice, taxRate, expiresAt, supplierId
  } = req.body;

  if (!sku || !name || !unit || costPrice === undefined || salePrice === undefined) {
    return res.status(400).json({ error: 'Los campos SKU, Nombre, Unidad, Precio Costo y Venta son obligatorios.' });
  }

  try {
    // Validar SKU único en la clínica
    const existing = await prisma.product.findUnique({
      where: { clinicId_sku: { clinicId, sku } }
    });

    if (existing) {
      return res.status(400).json({ error: `El SKU '${sku}' ya está registrado en esta clínica.` });
    }

    // Crear el producto y su movimiento inicial en una transacción
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          clinicId,
          sku,
          name,
          category: category as any || ProductCategory.medication,
          brand,
          unit,
          description,
          barcode,
          requiresPrescription: !!requiresPrescription,
          controlled: !!controlled,
          minStock: parseFloat(minStock) || 0,
          currentStock: parseFloat(currentStock) || 0,
          costPrice: parseFloat(costPrice),
          salePrice: parseFloat(salePrice),
          taxRate: parseFloat(taxRate) !== undefined ? parseFloat(taxRate) : 0.19,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          supplierId: supplierId || null
        }
      });

      // Crear movimiento inicial si hay existencias
      if (product.currentStock > 0) {
        let movementBranchId = req.user?.branchId;
        if (!movementBranchId) {
          const defaultBranch = await tx.branch.findFirst({ where: { clinicId } });
          movementBranchId = defaultBranch?.id || '';
        }

        await tx.inventoryMovement.create({
          data: {
            clinicId,
            branchId: movementBranchId,
            productId: product.id,
            type: MovementType.in,
            quantity: product.currentStock,
            quantityBefore: 0,
            quantityAfter: product.currentStock,
            unitCost: product.costPrice,
            reason: 'Registro inicial de producto',
            performedBy: req.user?.id || 'system'
          }
        });
      }

      return product;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error al crear producto:', error);
    return res.status(500).json({ error: 'Error al registrar el producto.' });
  }
});

// PUT /products/:id — Modificar un producto
router.put('/products/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const {
    name, category, brand, unit, description, barcode,
    requiresPrescription, controlled, minStock,
    costPrice, salePrice, taxRate, expiresAt, supplierId, active
  } = req.body;

  try {
    const product = await prisma.product.findFirst({
      where: { id, clinicId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const updated = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name : product.name,
        category: category !== undefined ? category as any : product.category,
        brand: brand !== undefined ? brand : product.brand,
        unit: unit !== undefined ? unit : product.unit,
        description: description !== undefined ? description : product.description,
        barcode: barcode !== undefined ? barcode : product.barcode,
        requiresPrescription: requiresPrescription !== undefined ? !!requiresPrescription : product.requiresPrescription,
        controlled: controlled !== undefined ? !!controlled : product.controlled,
        minStock: minStock !== undefined ? parseFloat(minStock) : product.minStock,
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : product.costPrice,
        salePrice: salePrice !== undefined ? parseFloat(salePrice) : product.salePrice,
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : product.taxRate,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : product.expiresAt,
        supplierId: supplierId !== undefined ? (supplierId || null) : product.supplierId,
        active: active !== undefined ? !!active : product.active
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error al editar producto:', error);
    return res.status(500).json({ error: 'Error al actualizar el producto.' });
  }
});

// DELETE /products/:id — Eliminación lógica de producto
router.delete('/products/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id, clinicId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    // Eliminación lógica marcando active = false
    await prisma.product.update({
      where: { id },
      data: { active: false }
    });

    return res.json({ success: true, message: 'Producto eliminado del catálogo.' });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    return res.status(500).json({ error: 'Error al eliminar el producto.' });
  }
});

// ─────────────────────────────────────────────
// 📈 MOVIMIENTOS DE STOCK (KARDEX)
// ─────────────────────────────────────────────

// GET /movements — Listado paginado de movimientos de inventario
router.get('/movements', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const skip = (page - 1) * pageSize;

    const productId = req.query.productId as string;

    const whereClause: any = { clinicId };
    if (productId) {
      whereClause.productId = productId;
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where: whereClause,
        include: { product: true },
        orderBy: { performedAt: 'desc' },
        skip,
        take: pageSize
      }),
      prisma.inventoryMovement.count({ where: whereClause })
    ]);

    return res.json({
      data: movements,
      page,
      pageSize,
      total
    });
  } catch (error) {
    console.error('Error al obtener movimientos:', error);
    return res.status(500).json({ error: 'Error al consultar movimientos.' });
  }
});

// POST /movements — Registrar un movimiento manual de stock (Ajuste, Pérdida, Ingreso)
router.post('/movements', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { productId, type, quantity, reason, referenceId, referenceType } = req.body;

  if (!productId || !type || quantity === undefined || quantity <= 0) {
    return res.status(400).json({ error: 'Los campos Producto, Tipo y Cantidad (> 0) son obligatorios.' });
  }

  try {
    const product = await prisma.product.findFirst({
      where: { id: productId, clinicId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    // Calcular nuevas existencias
    const currentQty = product.currentStock;
    let nextQty = currentQty;

    const movType = type as MovementType;
    if (movType === MovementType.in || movType === MovementType.return) {
      nextQty = currentQty + parseFloat(quantity);
    } else if (movType === MovementType.out || movType === MovementType.loss || movType === MovementType.adjustment) {
      // Si es un ajuste manual de salida
      nextQty = currentQty - parseFloat(quantity);
    }

    if (nextQty < 0) {
      return res.status(400).json({ error: `Inventario insuficiente. Stock actual: ${currentQty}, solicitado restar: ${quantity}` });
    }

    // Registrar el movimiento y actualizar el producto
    const result = await prisma.$transaction(async (tx) => {
      let movementBranchId = req.user?.branchId;
      if (!movementBranchId) {
        const defaultBranch = await tx.branch.findFirst({ where: { clinicId } });
        movementBranchId = defaultBranch?.id || '';
      }

      const movement = await tx.inventoryMovement.create({
        data: {
          clinicId,
          branchId: movementBranchId,
          productId,
          type: movType,
          quantity: parseFloat(quantity),
          quantityBefore: currentQty,
          quantityAfter: nextQty,
          unitCost: product.costPrice,
          reason: reason || 'Ajuste manual ejecutado por el personal',
          referenceId,
          referenceType,
          performedBy: req.user?.id || 'system'
        }
      });

      await tx.product.update({
        where: { id: productId },
        data: { currentStock: nextQty }
      });

      return movement;
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error al registrar movimiento manual:', error);
    return res.status(500).json({ error: 'Error al registrar el movimiento en el Kardex.' });
  }
});

// ─────────────────────────────────────────────
// 🤝 PROVEEDORES
// ─────────────────────────────────────────────

// GET /suppliers — Obtener listado de proveedores activos
router.get('/suppliers', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const suppliers = await prisma.supplier.findMany({
      where: { clinicId, active: true },
      orderBy: { name: 'asc' }
    });
    return res.json(suppliers);
  } catch (error) {
    console.error('Error al obtener proveedores:', error);
    return res.status(500).json({ error: 'Error al consultar proveedores.' });
  }
});

// POST /suppliers — Registrar un nuevo proveedor
router.post('/suppliers', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const { name, nit, contactName, email, phone, address, notes } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
  }

  try {
    const supplier = await prisma.supplier.create({
      data: {
        clinicId,
        name,
        nit,
        contactName,
        email,
        phone,
        address,
        notes
      }
    });
    return res.status(201).json(supplier);
  } catch (error) {
    console.error('Error al registrar proveedor:', error);
    return res.status(500).json({ error: 'Error al registrar el proveedor.' });
  }
});

export { router as INVENTORY_ROUTES };
