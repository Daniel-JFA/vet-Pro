import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

/**
 * Script de inicialización seguro para PRODUCCIÓN.
 * - Idempotente: solo crea si NO existe.
 * - CERO BORRADO: Jamás ejecuta deleteMany() ni destruye datos previos.
 */
async function main() {
  console.log('🛡️ Verificando estado inicial de la base de datos de producción...');

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@vetpro.co';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || 'AdminSeguro2026!';
  const clinicName = process.env.INITIAL_CLINIC_NAME || 'Veterinaria Principal';
  const clinicNit = process.env.INITIAL_CLINIC_NIT || '901.000.000-1';

  // 1. Obtener o crear Clínica
  let clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        name: clinicName,
        nit: clinicNit,
        phone: '+57 300 000 0000',
        email: adminEmail,
        address: 'Sede Principal',
        city: 'Medellín',
        plan: 'pro'
      }
    });
    console.log(`🏢 Clínica base creada: ${clinic.name} (${clinic.id})`);
  } else {
    console.log(`ℹ️ Clínica existente encontrada: ${clinic.name}`);
  }

  // 2. Obtener o crear Sede Base
  let branch = await prisma.branch.findFirst({ where: { clinicId: clinic.id } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        clinicId: clinic.id,
        name: 'Sede Central',
        address: 'Calle Principal # 1-1',
        phone: '+57 300 000 0000',
        email: adminEmail
      }
    });
    console.log(`📍 Sucursal base creada: ${branch.name} (${branch.id})`);
  } else {
    console.log(`ℹ️ Sucursal existente encontrada: ${branch.name}`);
  }

  // 3. Obtener o crear Usuario Administrador
  let adminUser = await prisma.user.findFirst({
    where: { clinicId: clinic.id, role: UserRole.admin }
  });

  if (!adminUser) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    adminUser = await prisma.user.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        firstName: 'Administrador',
        lastName: 'Principal',
        email: adminEmail,
        passwordHash: passwordHash,
        role: UserRole.admin,
        active: true
      }
    });
    console.log(`👑 Administrador de producción inicial creado:`);
    console.log(`   - Email: ${adminEmail}`);
    console.log(`   - Password: ${adminPassword}`);
  } else {
    console.log(`ℹ️ Usuario Administrador ya existe: ${adminUser.email}`);
  }

  // 4. Catálogo base de Laboratorio (solo si está vacío)
  const labCount = await prisma.labTestCatalog.count({ where: { clinicId: clinic.id } });
  if (labCount === 0) {
    const basicTests = [
      { code: 'HEM-LEU', name: 'Leucocitos Totales', category: 'hematology', unit: 'x10^3/uL', canineRefMin: 6.0, canineRefMax: 17.0, felineRefMin: 5.5, felineRefMax: 19.5, salePrice: 15000 },
      { code: 'HEM-HCT', name: 'Hematocrito (PCV)', category: 'hematology', unit: '%', canineRefMin: 37.0, canineRefMax: 55.0, felineRefMin: 24.0, felineRefMax: 45.0, salePrice: 15000 },
      { code: 'BIO-CREA', name: 'Creatinina Sérica', category: 'biochemistry', unit: 'mg/dL', canineRefMin: 0.5, canineRefMax: 1.5, felineRefMin: 0.8, felineRefMax: 2.1, salePrice: 22000 },
      { code: 'BIO-ALT', name: 'ALT / GPT Hepática', category: 'biochemistry', unit: 'U/L', canineRefMin: 10.0, canineRefMax: 100.0, felineRefMin: 12.0, felineRefMax: 130.0, salePrice: 25000 }
    ];

    for (const t of basicTests) {
      await prisma.labTestCatalog.create({
        data: { ...t, category: t.category as any, clinicId: clinic.id }
      });
    }
    console.log(`🔬 Catálogo de laboratorio esencial configurado.`);
  }

  console.log('✅ Verificación de producción completada. La base de datos es segura y persistente.');
}

main()
  .catch((e) => {
    console.error('❌ Error en init_prod:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
