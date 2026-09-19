import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/database.js';
import { TokenService } from '../src/services/token.service.js';

describe('Facturación, Caja y Aislamiento Multi-Tenant (Integration Tests)', () => {
  let clinicAId: string;
  let clinicBId: string;
  let branchAId: string;
  let branchBId: string;
  let userAdminAToken: string;
  let userVetAToken: string;
  let userAdminBToken: string;
  let tutorAId: string;
  let productAId: string;
  let createdInvoiceAId: string;
  let adminAId: string;

  beforeAll(async () => {
    const timestamp = Date.now();

    // 1. Crear Clínica A con Sede, Usuarios, Tutor y Producto
    const clinicA = await prisma.clinic.create({
      data: {
        name: `Clínica Test A ${timestamp}`,
        phone: '3001112233',
        email: `clinicA_${timestamp}@test.com`,
        address: 'Calle 100 # 10-20',
        city: 'Bogotá',
        plan: 'pro'
      }
    });
    clinicAId = clinicA.id;

    const branchA = await prisma.branch.create({
      data: {
        clinicId: clinicAId,
        name: 'Sede Norte',
        address: 'Calle 100 # 10-20',
        phone: '3001112233'
      }
    });
    branchAId = branchA.id;

    const userAdminA = await prisma.user.create({
      data: {
        clinicId: clinicAId,
        branchId: branchAId,
        firstName: 'Admin',
        lastName: 'Clinica A',
        email: `adminA_${timestamp}@test.com`,
        passwordHash: 'hashed_password_test',
        role: 'admin'
      }
    });
    adminAId = userAdminA.id;

    const userVetA = await prisma.user.create({
      data: {
        clinicId: clinicAId,
        branchId: branchAId,
        firstName: 'Vet',
        lastName: 'Clinica A',
        email: `vetA_${timestamp}@test.com`,
        passwordHash: 'hashed_password_test',
        role: 'vet'
      }
    });

    const tutorA = await prisma.tutor.create({
      data: {
        clinicId: clinicAId,
        firstName: 'Carlos',
        lastName: 'Pérez',
        phone: `310${Math.floor(1000000 + Math.random() * 9000000)}`,
        email: `carlos_${timestamp}@test.com`
      }
    });
    tutorAId = tutorA.id;

    const productA = await prisma.product.create({
      data: {
        clinicId: clinicAId,
        name: 'Vacuna Antirrábica Test',
        sku: `VAC-${timestamp}`,
        category: 'vaccine',
        currentStock: 10,
        minStock: 2,
        costPrice: 5000,
        salePrice: 10000,
        unit: 'dosis'
      }
    });
    productAId = productA.id;

    // 2. Crear Clínica B (para pruebas de aislamiento multi-tenant cruzado)
    const clinicB = await prisma.clinic.create({
      data: {
        name: `Clínica Test B ${timestamp}`,
        phone: '3009998877',
        email: `clinicB_${timestamp}@test.com`,
        address: 'Carrera 7 # 45-10',
        city: 'Medellín',
        plan: 'starter'
      }
    });
    clinicBId = clinicB.id;

    const branchB = await prisma.branch.create({
      data: {
        clinicId: clinicBId,
        name: 'Sede Poblado',
        address: 'Carrera 7 # 45-10',
        phone: '3009998877'
      }
    });
    branchBId = branchB.id;

    const userAdminB = await prisma.user.create({
      data: {
        clinicId: clinicBId,
        branchId: branchBId,
        firstName: 'Admin',
        lastName: 'Clinica B',
        email: `adminB_${timestamp}@test.com`,
        passwordHash: 'hashed_password_test',
        role: 'admin'
      }
    });

    // 3. Generar tokens JWT para cada usuario
    userAdminAToken = TokenService.signStaff({
      id: userAdminA.id,
      email: userAdminA.email,
      role: 'admin',
      clinicId: clinicAId,
      branchId: branchAId
    });

    userVetAToken = TokenService.signStaff({
      id: userVetA.id,
      email: userVetA.email,
      role: 'vet',
      clinicId: clinicAId,
      branchId: branchAId
    });

    userAdminBToken = TokenService.signStaff({
      id: userAdminB.id,
      email: userAdminB.email,
      role: 'admin',
      clinicId: clinicBId,
      branchId: branchBId
    });
  });

  afterAll(async () => {
    // Limpieza en cascada de los datos de prueba
    if (clinicAId) await prisma.clinic.delete({ where: { id: clinicAId } }).catch(() => null);
    if (clinicBId) await prisma.clinic.delete({ where: { id: clinicBId } }).catch(() => null);
  });

  // ─────────────────────────────────────────────
  // 1. FACTURACIÓN: TOTALES, CONSECUTIVOS Y STOCK
  // ─────────────────────────────────────────────
  describe('Creación de Facturas y Totales', () => {
    it('calcula subtotales, IVA (19%) y descuentos correctamente', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          tutorId: tutorAId,
          branchId: branchAId,
          autoDeductInventory: true,
          items: [
            {
              description: 'Vacuna Antirrábica',
              productId: productAId,
              quantity: 2,
              unitPrice: 10000,
              discount: 10, // 10% de descuento -> base 20000 - 2000 = 18000 net
              taxRate: 0.19 // IVA: 18000 * 0.19 = 3420 -> total item = 21420
            },
            {
              description: 'Consulta General',
              quantity: 1,
              unitPrice: 50000,
              discount: 0,
              taxRate: 0.19 // IVA: 50000 * 0.19 = 9500 -> total item = 59500
            }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.subtotal).toBe(68000); // 18000 + 50000
      expect(res.body.taxTotal).toBe(12920); // 3420 + 9500
      expect(res.body.total).toBe(80920); // 68000 + 12920
      expect(res.body.balance).toBe(80920);
      expect(res.body.amountPaid).toBe(0);
      expect(res.body.status).toBe('draft');
      expect(res.body.invoiceNumber).toMatch(/^FAC-\d{6}$/);

      createdInvoiceAId = res.body.id;

      // Verificar que el inventario se descontó en 2 unidades (10 - 2 = 8)
      const updatedProduct = await prisma.product.findUnique({ where: { id: productAId } });
      expect(updatedProduct?.currentStock).toBe(8);

      // Verificar que se registró el movimiento de salida
      const movement = await prisma.inventoryMovement.findFirst({
        where: { clinicId: clinicAId, productId: productAId, referenceId: createdInvoiceAId }
      });
      expect(movement).toBeDefined();
      expect(movement?.type).toBe('out');
      expect(movement?.quantity).toBe(2);
    });

    it('rechaza la creación de factura si el stock es insuficiente', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          tutorId: tutorAId,
          branchId: branchAId,
          autoDeductInventory: true,
          items: [
            {
              description: 'Vacuna en exceso',
              productId: productAId,
              quantity: 999, // Stock actual es 8
              unitPrice: 10000
            }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Inventario insuficiente');
    });
  });

  // ─────────────────────────────────────────────
  // 2. PAGOS Y ABONOS
  // ─────────────────────────────────────────────
  describe('Registro de Pagos y Abonos', () => {
    it('registra abono parcial actualizando saldo y estado a "partial"', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${createdInvoiceAId}/pay`)
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          amount: 30000,
          method: 'Efectivo'
        });

      expect(res.status).toBe(200);
      expect(res.body.amountPaid).toBe(30000);
      expect(res.body.balance).toBe(50920); // 80920 - 30000
      expect(res.body.status).toBe('partial');

      // Verificar que se registró en invoice_payments con método 'Efectivo'
      const payment = await prisma.invoicePayment.findFirst({
        where: { invoiceId: createdInvoiceAId, method: 'Efectivo' }
      });
      expect(payment).toBeDefined();
      expect(payment?.amount).toBe(30000);
    });

    it('completa el pago restante actualizando estado a "paid" y saldo a 0', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${createdInvoiceAId}/pay`)
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          amount: 50920,
          method: 'Tarjeta Débito'
        });

      expect(res.status).toBe(200);
      expect(res.body.amountPaid).toBe(80920);
      expect(res.body.balance).toBe(0);
      expect(res.body.status).toBe('paid');
      expect(res.body.paidAt).toBeDefined();
    });

    it('rechaza abonos a una factura que ya está completamente pagada', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${createdInvoiceAId}/pay`)
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          amount: 1000,
          method: 'Efectivo'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No se pueden registrar abonos');
    });
  });

  // ─────────────────────────────────────────────
  // 3. ANULACIÓN Y REVERSA DE INVENTARIO
  // ─────────────────────────────────────────────
  describe('Anulación de Facturas y Reversa de Stock', () => {
    let invoiceToVoidId: string;

    beforeAll(async () => {
      // Crear una segunda factura que descuente 3 unidades de Producto A (stock 8 -> 5)
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          tutorId: tutorAId,
          branchId: branchAId,
          autoDeductInventory: true,
          items: [
            {
              description: 'Vacunas adicionales',
              productId: productAId,
              quantity: 3,
              unitPrice: 10000
            }
          ]
        });
      invoiceToVoidId = res.body.id;

      const prod = await prisma.product.findUnique({ where: { id: productAId } });
      expect(prod?.currentStock).toBe(5);
    });

    it('un usuario sin rol admin no puede anular facturas (403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${invoiceToVoidId}/void`)
        .set('Authorization', `Bearer ${userVetAToken}`)
        .send({ reason: 'Error de prueba por vet' });

      expect(res.status).toBe(403);
    });

    it('el admin puede anular la factura y el inventario se revierte automáticamente', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${invoiceToVoidId}/void`)
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({ reason: 'Cobro duplicado por error del cliente' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('void');
      expect(res.body.balance).toBe(0);

      // Verificar que el stock se restauró de 5 a 8
      const restoredProduct = await prisma.product.findUnique({ where: { id: productAId } });
      expect(restoredProduct?.currentStock).toBe(8);

      // Verificar que se registró el movimiento de reversión tipo 'in'
      const revertMovement = await prisma.inventoryMovement.findFirst({
        where: {
          clinicId: clinicAId,
          productId: productAId,
          referenceId: invoiceToVoidId,
          type: 'in'
        }
      });
      expect(revertMovement).toBeDefined();
      expect(revertMovement?.quantity).toBe(3);
      expect(revertMovement?.reason).toContain('Reversión por anulación');
    });

    it('rechaza anular una factura que ya está anulada', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${invoiceToVoidId}/void`)
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({ reason: 'Intento de anular otra vez' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('ya está anulada');
    });
  });

  // ─────────────────────────────────────────────
  // 4. CONTROL DE CAJA / POS (CIERRE Y ARQUEO)
  // ─────────────────────────────────────────────
  describe('Control de Caja (Apertura, Arqueo y Cierre)', () => {
    let openShiftId: string;

    it('permite abrir turno de caja con base inicial en efectivo', async () => {
      const res = await request(app)
        .post('/api/v1/billing/dian/pos/shift-open')
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          branchId: branchAId,
          openingBalance: 100000,
          notes: 'Base de caja turno mañana'
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('open');
      expect(res.body.openingBalance).toBe(100000);
      expect(res.body.expectedBalance).toBe(100000);
      openShiftId = res.body.id;
    });

    it('rechaza abrir otro turno si el usuario ya tiene uno activo', async () => {
      const res = await request(app)
        .post('/api/v1/billing/dian/pos/shift-open')
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          branchId: branchAId,
          openingBalance: 50000
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Ya tiene un turno de caja abierto');
    });

    it('cierra la caja calculando ventas en efectivo vs electrónicas y diferencia de arqueo', async () => {
      // Registrar un pago en efectivo de $20000 para la Sede A
      await prisma.invoicePayment.create({
        data: {
          clinicId: clinicAId,
          branchId: branchAId,
          invoiceId: createdInvoiceAId,
          amount: 20000,
          method: 'Efectivo',
          recordedBy: adminAId
        }
      });

      // Registrar un pago electrónico de $15000 para la Sede A
      await prisma.invoicePayment.create({
        data: {
          clinicId: clinicAId,
          branchId: branchAId,
          invoiceId: createdInvoiceAId,
          amount: 15000,
          method: 'Tarjeta Débito',
          recordedBy: adminAId
        }
      });

      // Se espera:
      // Base: 100000
      // Ventas efectivo: 20000
      // Esperado en caja: 120000
      // Si el arqueo físico contó 120000 -> diferencia = 0
      const res = await request(app)
        .post('/api/v1/billing/dian/pos/shift-close')
        .set('Authorization', `Bearer ${userAdminAToken}`)
        .send({
          shiftId: openShiftId,
          actualBalance: 120000,
          notes: 'Arqueo perfecto, turno cerrado'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.shift.status).toBe('closed');
      expect(res.body.shift.cashSales).toBe(20000);
      expect(res.body.shift.electronicSales).toBe(15000);
      expect(res.body.shift.expectedBalance).toBe(120000);
      expect(res.body.shift.actualBalance).toBe(120000);
      expect(res.body.shift.difference).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // 5. AISLAMIENTO MULTI-TENANT (TENANT CRUZADO)
  // ─────────────────────────────────────────────
  describe('Aislamiento Multi-Tenant Cruzado (Anti-IDOR)', () => {
    it('un usuario de Clínica B recibe 404 al consultar una factura de Clínica A', async () => {
      const res = await request(app)
        .get(`/api/v1/billing/invoices/${createdInvoiceAId}`)
        .set('Authorization', `Bearer ${userAdminBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Factura no encontrada');
    });

    it('un usuario de Clínica B recibe 404 al intentar registrar un pago en factura de Clínica A', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${createdInvoiceAId}/pay`)
        .set('Authorization', `Bearer ${userAdminBToken}`)
        .send({ amount: 10000, method: 'Efectivo' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Factura no encontrada');
    });

    it('un usuario de Clínica B recibe 404 al intentar anular una factura de Clínica A', async () => {
      const res = await request(app)
        .patch(`/api/v1/billing/invoices/${createdInvoiceAId}/void`)
        .set('Authorization', `Bearer ${userAdminBToken}`)
        .send({ reason: 'Intento de anulación cruzada' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Factura no encontrada');
    });

    it('el listado de facturas de Clínica B no expone facturas de Clínica A', async () => {
      const res = await request(app)
        .get('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${userAdminBToken}`);

      expect(res.status).toBe(200);
      const invoiceIds = res.body.data.map((i: any) => i.id);
      expect(invoiceIds).not.toContain(createdInvoiceAId);
    });

    it('Clínica B no puede crear facturas asociadas a un tutor de Clínica A (Anti-IDOR)', async () => {
      const res = await request(app)
        .post('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${userAdminBToken}`)
        .send({
          tutorId: tutorAId, // Tutor pertenece a Clínica A
          branchId: branchBId,
          items: [{ description: 'Consulta', unitPrice: 50000 }]
        });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('no pertenece a su clínica');
    });

    it('Clínica B no puede ver ni modificar los productos de inventario de Clínica A', async () => {
      const res = await request(app)
        .get('/api/v1/inventory/products')
        .set('Authorization', `Bearer ${userAdminBToken}`);

      expect(res.status).toBe(200);
      const productIds = res.body.data.map((p: any) => p.id);
      expect(productIds).not.toContain(productAId);
    });
  });
});
