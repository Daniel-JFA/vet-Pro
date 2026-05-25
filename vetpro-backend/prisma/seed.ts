import { PrismaClient, PatientSpecies, PatientSex, PatientStatus, AppointmentStatus, RecordType, ProductCategory, MovementType, InvoiceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando la siembra masiva e histórica (3 meses) de VetPro...');

  // 1. Limpieza de tablas existentes (en orden inverso de dependencia)
  await prisma.notificationLog.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseOrderItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.prescriptionItem.deleteMany();
  await prisma.prescription.deleteMany();
  await prisma.vaccine.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.medicalRecord.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.clinic.deleteMany();

  console.log('🧹 Base de datos limpia y lista para sembrar.');

  // 2. Crear Clínica Principal
  const clinic = await prisma.clinic.create({
    data: {
      name: 'Veterinaria Domiciliaria VetPro Pro',
      nit: '901.345.678-2',
      phone: '+57 4 444 8080',
      email: 'gerencia@vetpro.co',
      address: 'Calle 10A #34-11, Poblado',
      city: 'Medellín',
      plan: 'pro',
      aiMinutesUsed: 45.2,
      aiMinutesLimit: 120
    }
  });
  console.log(`🏢 Clínica creada: ${clinic.name}`);

  // 3. Crear Sucursal (Branch)
  const branch = await prisma.branch.create({
    data: {
      clinicId: clinic.id,
      name: 'Sede Medellín Metropolitana',
      address: 'Carrera 43A #1-50, San Fernando Plaza, Medellín',
      phone: '+57 300 456 7890',
      email: 'medellin@vetpro.co'
    }
  });
  console.log(`📍 Sucursal principal creada: ${branch.name}`);

  // 4. Crear Usuarios (Vets / Staff)
  const salt = await bcrypt.genSalt(10);
  const adminPasswordHash = await bcrypt.hash('admin123', salt);
  const vetPasswordHash = await bcrypt.hash('vet123', salt);

  const adminUser = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      firstName: 'Andrés',
      lastName: 'Espinoza',
      email: 'admin@vetpro.co',
      passwordHash: adminPasswordHash,
      role: 'admin',
      avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=150'
    }
  });

  const vetUser = await prisma.user.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      firstName: 'Laura',
      lastName: 'Cardona',
      email: 'vet@vetpro.co',
      passwordHash: vetPasswordHash,
      role: 'vet',
      avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=150'
    }
  });
  console.log('👤 Usuarios registrados: admin@vetpro.co (admin123) / vet@vetpro.co (vet123)');

  // 5. Proveedores de Inventario
  const supplier1 = await prisma.supplier.create({
    data: {
      clinicId: clinic.id,
      name: 'Distribuidora Veterinaria del Tolima S.A.S.',
      nit: '860.001.234-9',
      contactName: 'Carlos Mario Ruiz',
      email: 'ventas@vetolima.com.co',
      phone: '+57 311 888 7777',
      address: 'Zona Industrial Belén, Ibagué'
    }
  });

  const supplier2 = await prisma.supplier.create({
    data: {
      clinicId: clinic.id,
      name: 'Suministros Médicos de Antioquia',
      nit: '900.555.444-1',
      contactName: 'Beatriz Elena Gómez',
      email: 'compras@sumimedantioquia.co',
      phone: '+57 4 321 0987',
      address: 'Calle 33 #65C-12, Medellín'
    }
  });
  console.log('📦 Proveedores registrados.');

  // 6. Productos en el Inventario (Medicamentos y Vacunas)
  const productsData = [
    { sku: 'MED-AMX50', name: 'Amoxicilina 500mg', category: ProductCategory.medication, brand: 'Pfizer', unit: 'Tableta', minStock: 50, currentStock: 250, costPrice: 800, salePrice: 1800, taxRate: 0.19, supplierId: supplier2.id },
    { sku: 'VAC-RAB26', name: 'Vacuna Antirrábica Nobivac', category: ProductCategory.vaccine, brand: 'Nobivac', unit: 'Dosis', minStock: 20, currentStock: 80, costPrice: 12000, salePrice: 28000, taxRate: 0, supplierId: supplier1.id },
    { sku: 'VAC-RCP25', name: 'Vacuna Triple Felina RCP', category: ProductCategory.vaccine, brand: 'Felocell', unit: 'Dosis', minStock: 15, currentStock: 65, costPrice: 15000, salePrice: 38000, taxRate: 0, supplierId: supplier1.id },
    { sku: 'MED-PRED5', name: 'Prednisolona 5mg', category: ProductCategory.medication, brand: 'MSD', unit: 'Tableta', minStock: 40, currentStock: 180, costPrice: 500, salePrice: 1300, taxRate: 0.19, supplierId: supplier2.id },
    { sku: 'CON-JER3M', name: 'Jeringa 3ml c/aguja 21G', category: ProductCategory.consumable, brand: 'Nipro', unit: 'Unidad', minStock: 100, currentStock: 500, costPrice: 300, salePrice: 700, taxRate: 0.19, supplierId: supplier2.id },
    { sku: 'MED-ENRO5', name: 'Enrofloxacina 50mg/ml (Inyectable)', category: ProductCategory.medication, brand: 'Bayer', unit: 'ml', minStock: 30, currentStock: 150, costPrice: 3500, salePrice: 8500, taxRate: 0.19, supplierId: supplier2.id },
    { sku: 'ALI-RURSO', name: 'Royal Canin Urinary SO Perro', category: ProductCategory.food, brand: 'Royal Canin', unit: 'Kg', minStock: 10, currentStock: 25, costPrice: 42000, salePrice: 68000, taxRate: 0.05, supplierId: supplier1.id },
    { sku: 'MED-KET50', name: 'Ketamina 500mg/10ml', category: ProductCategory.medication, brand: 'Holliday', unit: 'Vial', requiresPrescription: true, controlled: true, minStock: 5, currentStock: 22, costPrice: 28000, salePrice: 65000, taxRate: 0.19, supplierId: supplier2.id },
    { sku: 'VAC-TEQ10', name: 'Vacuna Triple Equina (A/E/T)', category: ProductCategory.vaccine, brand: 'Zoetis', unit: 'Dosis', minStock: 5, currentStock: 18, costPrice: 32000, salePrice: 75000, taxRate: 0, supplierId: supplier1.id },
    { sku: 'MED-OXT20', name: 'Oxitetraciclina L.A. 200mg/ml', category: ProductCategory.medication, brand: 'Pfizer', unit: 'ml', minStock: 50, currentStock: 300, costPrice: 1800, salePrice: 4500, taxRate: 0.19, supplierId: supplier2.id }
  ];

  const products: any[] = [];
  for (const p of productsData) {
    const createdProduct = await prisma.product.create({
      data: {
        clinicId: clinic.id,
        ...p
      }
    });
    products.push(createdProduct);
  }
  console.log(`📦 ${products.length} productos sembrados en inventario.`);

  // Registrar carga inicial de stock en movimientos
  for (const prod of products) {
    await prisma.inventoryMovement.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        productId: prod.id,
        type: MovementType.in,
        quantity: prod.currentStock,
        quantityBefore: 0,
        quantityAfter: prod.currentStock,
        unitCost: prod.costPrice,
        reason: 'Carga inicial de inventario demo',
        performedBy: adminUser.id
      }
    });
  }

  // 7. Crear Tutores (12 clientes en el área metropolitana de Medellín)
  const tutorsData = [
    { firstName: 'Carlos', lastName: 'Gómez', email: 'carlos.gomez@gmail.com', phone: '+57 312 456 7890', documentId: '1.018.234.567', address: 'Carrera 43A #25S-15, Envigado', notes: 'Tutor muy puntual y comprometido.' },
    { firstName: 'María', lastName: 'Rodríguez', email: 'maria.rod@outlook.com', phone: '+57 315 789 1234', documentId: '52.345.678', address: 'Calle 30 #76-22, Belén, Medellín' },
    { firstName: 'Diana', lastName: 'Pérez', email: 'diana.perez@hotmail.com', phone: '+57 320 987 6543', documentId: '1.032.456.789', address: 'Circular 4 #73-10, Laureles, Medellín' },
    { firstName: 'Juan', lastName: 'Sánchez', email: 'juan.sanchez@gmail.com', phone: '+57 300 123 4567', documentId: '79.876.543', address: 'Carrera 38 #5-45, El Poblado, Medellín' },
    { firstName: 'Andrés', lastName: 'Tobón', email: 'andres.tobon@gmail.com', phone: '+57 310 999 1111', documentId: '70.123.456', address: 'Calle 50 Sur #43A-12, Sabaneta' },
    { firstName: 'Sofía', lastName: 'Restrepo', email: 'sofia.res@gmail.com', phone: '+57 318 765 4321', documentId: '1.020.304.050', address: 'Carrera 80 #33-40, Laureles, Medellín' },
    { firstName: 'Mateo', lastName: 'Alzate', email: 'mateo.alzate@outlook.com', phone: '+57 301 234 5678', documentId: '1.152.123.456', address: 'Calle 10 Sur #48-150, Poblado, Medellín' },
    { firstName: 'Valentina', lastName: 'Hoyos', email: 'vale.hoyos@gmail.com', phone: '+57 304 987 6543', documentId: '1.033.987.654', address: 'Carrera 65 #45-12, Medellín' },
    { firstName: 'Isabella', lastName: 'Muñoz', email: 'isabella.munoz@outlook.com', phone: '+57 313 111 2222', documentId: '1.045.678.901', address: 'Transversal 39B #8-10, Laureles, Medellín' },
    { firstName: 'Fernando', lastName: 'Correa', email: 'fdo.correa@gmail.com', phone: '+57 310 222 3333', documentId: '71.765.432', address: 'Finca La Pradera, Vereda El Tablazo, Rionegro' },
    { firstName: 'Juliana', lastName: 'López', email: 'juli.lopez@gmail.com', phone: '+57 321 444 5555', documentId: '1.017.333.444', address: 'Carrera 48 #26-85, Envigado' },
    { firstName: 'Gabriel', lastName: 'Jaramillo', email: 'gabriel.jaramillo@outlook.com', phone: '+57 300 777 8888', documentId: '70.999.000', address: 'Finca Los Caballos, Santa Elena, Medellín' }
  ];

  const tutors: any[] = [];
  for (const t of tutorsData) {
    const createdTutor = await prisma.tutor.create({
      data: {
        clinicId: clinic.id,
        ...t
      }
    });
    tutors.push(createdTutor);
  }
  console.log(`👥 ${tutors.length} tutores registrados exitosamente.`);

  // 8. Crear Pacientes (18 mascotas que abarcan todas las especies permitidas)
  const patientsData = [
    // Carlos Gómez
    { name: 'Toby', species: PatientSpecies.dog, breed: 'Golden Retriever', birthDate: new Date('2022-04-12'), sex: PatientSex.male, sterilized: true, weight: 32.5, chipId: '985112003456789', allergies: 'Alergia alimentaria (pollo), hipersensibilidad a pulgas.', notes: 'Toby es muy dócil, pero teme a la báscula.', tutorIndex: 0, photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150' },
    { name: 'Kira', species: PatientSpecies.dog, breed: 'Bulldog Francés', birthDate: new Date('2024-01-15'), sex: PatientSex.female, sterilized: false, weight: 11.8, chipId: '985112003456781', tutorIndex: 0 },
    // María Rodríguez
    { name: 'Luna', species: PatientSpecies.cat, breed: 'Siamés', birthDate: new Date('2023-08-01'), sex: PatientSex.female, sterilized: true, weight: 4.2, chipId: '985112003456780', tutorIndex: 1, photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=150' },
    { name: 'Mimi', species: PatientSpecies.cat, breed: 'Persa', birthDate: new Date('2021-03-05'), sex: PatientSex.female, sterilized: true, weight: 3.8, tutorIndex: 1 },
    // Diana Pérez
    { name: 'Copito', species: PatientSpecies.rabbit, breed: 'Angora', birthDate: new Date('2023-05-10'), sex: PatientSex.male, sterilized: false, weight: 2.1, tutorIndex: 2 },
    // Juan Sánchez
    { name: 'Rocky', species: PatientSpecies.dog, breed: 'Pastor Alemán', birthDate: new Date('2018-11-20'), sex: PatientSex.male, sterilized: true, weight: 38.0, chipId: '985112003456782', tutorIndex: 3, status: PatientStatus.active, photoUrl: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&q=80&w=150' },
    // Andrés Tobón
    { name: 'Bruno', species: PatientSpecies.dog, breed: 'Labrador Retriever', birthDate: new Date('2020-09-18'), sex: PatientSex.male, sterilized: true, weight: 34.0, tutorIndex: 4 },
    { name: 'Simba', species: PatientSpecies.cat, breed: 'Criollo Naranja', birthDate: new Date('2022-07-22'), sex: PatientSex.male, sterilized: true, weight: 5.1, tutorIndex: 4 },
    // Sofía Restrepo
    { name: 'Zoe', species: PatientSpecies.cat, breed: 'Ragdoll', birthDate: new Date('2023-11-02'), sex: PatientSex.female, sterilized: false, weight: 4.0, tutorIndex: 5 },
    // Mateo Alzate
    { name: 'Oliver', species: PatientSpecies.cat, breed: 'Bengala', birthDate: new Date('2022-01-30'), sex: PatientSex.male, sterilized: true, weight: 6.2, tutorIndex: 6 },
    // Valentina Hoyos
    { name: 'Tambor', species: PatientSpecies.rabbit, breed: 'Cabeza de León', birthDate: new Date('2024-02-14'), sex: PatientSex.male, sterilized: false, weight: 1.8, tutorIndex: 7 },
    { name: 'Paco', species: PatientSpecies.bird, breed: 'Loro Real', birthDate: new Date('2015-06-15'), sex: PatientSex.male, sterilized: false, weight: 0.45, tutorIndex: 7, notes: 'Loro doméstico muy hablador, legalizado.' },
    // Isabella Muñoz
    { name: 'Piolín', species: PatientSpecies.bird, breed: 'Canario', birthDate: new Date('2024-05-10'), sex: PatientSex.female, sterilized: false, weight: 0.02, tutorIndex: 8 },
    // Fernando Correa (Rionegro - Grandes Animales)
    { name: 'Lucero', species: PatientSpecies.horse, breed: 'Paso Fino Colombiano', birthDate: new Date('2019-08-24'), sex: PatientSex.male, sterilized: false, weight: 410.0, tutorIndex: 9, notes: 'Ejemplar valioso de exhibición.' },
    { name: 'Manuela', species: PatientSpecies.cow, breed: 'Holstein', birthDate: new Date('2020-03-12'), sex: PatientSex.female, sterilized: false, weight: 580.0, tutorIndex: 9, notes: 'Vaca lechera de alta producción.' },
    // Juliana López
    { name: 'Pepa', species: PatientSpecies.pig, breed: 'Mini Pig', birthDate: new Date('2023-10-10'), sex: PatientSex.female, sterilized: true, weight: 14.5, tutorIndex: 10, notes: 'Mascota consentida que vive dentro de apartamento.' },
    // Gabriel Jaramillo (Santa Elena - Equino / Porcino)
    { name: 'Relámpago', species: PatientSpecies.horse, breed: 'Criollo', birthDate: new Date('2018-02-10'), sex: PatientSex.male, sterilized: true, weight: 430.0, tutorIndex: 11 },
    { name: 'Pinta', species: PatientSpecies.cow, breed: 'Jersey', birthDate: new Date('2021-11-01'), sex: PatientSex.female, sterilized: false, weight: 460.0, tutorIndex: 11 }
  ];

  const patients: any[] = [];
  for (const p of patientsData) {
    const tutorId = tutors[p.tutorIndex].id;
    const { tutorIndex, ...rest } = p;
    const createdPatient = await prisma.patient.create({
      data: {
        clinicId: clinic.id,
        tutorId,
        ...rest
      }
    });
    patients.push(createdPatient);
  }
  console.log(`🐾 ${patients.length} pacientes registrados con soporte multiespecie.`);

  // 9. Siembra de Historial de Citas, Historias Clínicas, Facturación e Inventario (Últimos 90 Días)
  console.log('📅 Iniciando la siembra del historial de 90 días...');
  const now = new Date();

  // Mapeo de diagnósticos realistas por tipo de servicio
  const clinicalScenarios = [
    {
      serviceType: 'Consulta General',
      reason: 'Pérdida de apetito y decaimiento leve',
      anamnesis: 'Tutor indica que el paciente ha estado inapetente por 36 horas. Presenta letargo y ha bebido menos agua de lo habitual. Sin emesis ni diarrea previas.',
      physicalExam: 'T: 39.1°C. Mucosas rosadas y húmedas. Tiempo de llenado capilar < 2s. Deshidratación leve estimada en 4%. Abdomen blando, sin dolor reportado a la palpación profunda.',
      diagnosis: 'Indiscreción alimentaria leve con deshidratación subclínica.',
      treatment: 'Se prescribe hidratación oral forzada (suero electrolítico) y dieta blanda (arroz blanco con pechuga de pollo hervida sin sal) por 3 días. Se receta Amoxicilina 500mg (1 tableta c/12h por 7 días) como profiláctico digestivo.',
      productsUsed: [{ sku: 'MED-AMX50', qty: 14 }, { sku: 'CON-JER3M', qty: 2 }]
    },
    {
      serviceType: 'Vacunación',
      reason: 'Plan de vacunas anual y desparasitación',
      anamnesis: 'Paciente acude clínicamente sano para recibir los refuerzos obligatorios anuales. Última desparasitación hace 6 meses.',
      physicalExam: 'FC: 110 lpm, FR: 24 rpm. Temperatura: 38.5°C. Ganglios poplíteos y submandibulares normales. Ojos y oídos limpios. Peso estable.',
      diagnosis: 'Paciente sano apto para inmunización.',
      treatment: 'Se administra la Vacuna Antirrábica Nobivac y se revisa la cartilla. No se reportan reacciones adversas inmediatas.',
      productsUsed: [{ sku: 'VAC-RAB26', qty: 1 }, { sku: 'CON-JER3M', qty: 1 }]
    },
    {
      serviceType: 'Control',
      reason: 'Control evolutivo de otitis y revisión de conducto',
      anamnesis: 'Tutor reporta mejoría notable en la inflamación y rascado auricular. Cumplió tratamiento con gotas por 10 días.',
      physicalExam: 'Conducto auditivo externo derecho presenta leve eritema residual, sin presencia de detritos negruzcos ni secreción purulenta. Tímpano intacto y sin dolor a la palpación auricular.',
      diagnosis: 'Otitis externa eritematosa en resolución.',
      treatment: 'Se suspende el tratamiento antibiótico tópico. Se aconseja limpieza preventiva semanal con solución auricular.',
      productsUsed: []
    },
    {
      serviceType: 'Cirugía',
      reason: 'Herida en miembro anterior por alambre de púas',
      anamnesis: 'Paciente sufrió laceración accidental en miembro posterior izquierdo con alambre. Tutor realizó lavado primario en casa con agua.',
      physicalExam: 'Laceración de 6 cm de longitud en cara lateral. Compromete piel y tejido subcutáneo, sin afección de tendones. Sangrado activo moderado.',
      diagnosis: 'Herida cutánea lacerada contaminada.',
      treatment: 'Tricotomía y desbridamiento del tejido desvitalizado. Lavado profuso con clorhexidina al 2%. Sutura simple en puntos separados con nylon 3-0. Bloqueo anestésico local con Ketamina. Antibioticoterapia de amplio espectro.',
      productsUsed: [{ sku: 'MED-KET50', qty: 1 }, { sku: 'CON-JER3M', qty: 3 }, { sku: 'MED-AMX50', qty: 14 }]
    },
    {
      serviceType: 'Consulta Especial',
      reason: 'Fiebre y cojera en grandes animales',
      anamnesis: 'Tutor reporta que el equino/bovino presenta renuencia a la marcha, claudicación de grado 3/5 en miembro anterior izquierdo y decaimiento severo en potrero.',
      physicalExam: 'T: 40.2°C (Fiebre alta). Frecuencia respiratoria elevada. Pulso digital positivo en casco afectado. Dolor agudo a la percusión con pinza de cascos.',
      diagnosis: 'Infección bacteriana sistémica / pododermatitis infecciosa.',
      treatment: 'Administración de Oxitetraciclina L.A. 200mg (inyectable intramuscular profunda) a dosis única de 20 mg/kg. Recomendación de pediluvio con sulfato de cobre y aislamiento del lodo.',
      productsUsed: [{ sku: 'MED-OXT20', qty: 50 }, { sku: 'CON-JER3M', qty: 2 }]
    }
  ];

  let invoiceCounter = 1;

  // Generar 85 citas históricas en los últimos 90 días
  for (let i = 85; i >= 1; i--) {
    // Escoger fecha en el pasado
    const dateOffsetDays = i * 1.05; // Distribuye citas en un rango de 90 días
    const scheduledAt = new Date(now.getTime() - dateOffsetDays * 24 * 60 * 60 * 1000);
    scheduledAt.setHours(9 + (i % 8), (i % 4) * 15, 0, 0); // Distribuye las horas del día

    // Escoger paciente y veterinario aleatorio
    const patientIndex = i % patients.length;
    const patient = patients[patientIndex];
    const vet = i % 2 === 0 ? adminUser : vetUser;

    // Escoger escenario clínico
    let scenario = clinicalScenarios[i % clinicalScenarios.length];
    
    // Adaptar si el animal es caballo/vaca para usar el escenario especial
    if ((patient.species === PatientSpecies.horse || patient.species === PatientSpecies.cow) && i % 2 === 0) {
      scenario = clinicalScenarios[4]; // Escenario de Grandes Animales
    }

    // Determinar estado de la cita (85% completado, 8% inasistencia, 7% cancelado)
    let status: AppointmentStatus = AppointmentStatus.done;
    if (i % 12 === 0) status = AppointmentStatus.no_show;
    if (i % 15 === 0) status = AppointmentStatus.cancelled;

    const baseCost = status === AppointmentStatus.done ? 65000 : 0;
    let extraCost = 0;

    // Crear la cita
    const appointment = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        patientId: patient.id,
        vetId: vet.id,
        serviceType: scenario.serviceType,
        scheduledAt,
        durationMinutes: 30 + (i % 3) * 15,
        status,
        reason: scenario.reason,
        notes: `Visita domiciliaria realizada en ${tutors[patientIndex % tutors.length].address}.`,
        amountCharged: status === AppointmentStatus.done ? (baseCost + 35000) : 0 // Valor referencial
      }
    });

    if (status === AppointmentStatus.done) {
      // 1. Crear historia clínica (MedicalRecord)
      const record = await prisma.medicalRecord.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          appointmentId: appointment.id,
          vetId: vet.id,
          type: RecordType.consultation,
          title: `${scenario.serviceType}: ${scenario.reason}`,
          anamnesis: scenario.anamnesis,
          physicalExam: scenario.physicalExam,
          diagnosis: scenario.diagnosis,
          treatment: scenario.treatment,
          observations: 'Evolución satisfactoria recomendada. Control en 10 días.',
          aiGenerated: i % 3 === 0, // 33% generadas con IA
          aiTranscriptionMinutes: i % 3 === 0 ? 3.2 : null,
          createdAt: scheduledAt
        }
      });

      // 2. Registrar recetas médicas (Prescription) si requiere medicamentos
      if (scenario.productsUsed.length > 0) {
        const rx = await prisma.prescription.create({
          data: {
            recordId: record.id,
            patientId: patient.id,
            vetId: vet.id,
            instructions: 'Suministrar estrictamente según el horario y frecuencia indicada.',
            signedAt: scheduledAt,
            sentToTutor: true
          }
        });

        for (const item of scenario.productsUsed) {
          const product = products.find(p => p.sku === item.sku);
          if (product) {
            await prisma.prescriptionItem.create({
              data: {
                prescriptionId: rx.id,
                drugName: product.name,
                presentation: product.unit === 'Tableta' ? 'Tabletas orales' : 'Solución inyectable',
                dose: product.unit === 'Tableta' ? '1 tableta' : '2 ml',
                frequency: 'Cada 12 horas',
                durationDays: 7,
                quantity: item.qty
              }
            });
          }
        }
      }

      // 3. Crear vacunas aplicadas en la cartilla
      if (scenario.serviceType === 'Vacunación') {
        await prisma.vaccine.create({
          data: {
            patientId: patient.id,
            name: patient.species === PatientSpecies.cat ? 'Triple Felina RCP (Felocell)' : 'Vacuna Antirrábica Nobivac',
            brand: patient.species === PatientSpecies.cat ? 'Zoetis' : 'MSD Animal Health',
            batch: `VLT-${2026 + (i % 2)}X`,
            appliedAt: scheduledAt,
            nextDueAt: new Date(scheduledAt.getTime() + 365 * 24 * 60 * 60 * 1000),
            vetId: vet.id,
            notes: 'Aplicada vía subcutánea sin incidentes.'
          }
        });
      }

      // 4. Calcular precio de los productos
      const billItems: any[] = [];
      
      // Costo de consulta base
      billItems.push({
        description: `Honorarios por ${scenario.serviceType} a domicilio`,
        qty: 1,
        unitPrice: baseCost,
        taxRate: 0,
        total: baseCost
      });

      for (const item of scenario.productsUsed) {
        const product = products.find(p => p.sku === item.sku);
        if (product) {
          const itemTotal = product.salePrice * item.qty;
          extraCost += itemTotal;
          billItems.push({
            productId: product.id,
            description: `${product.name} (${product.brand})`,
            qty: item.qty,
            unitPrice: product.salePrice,
            taxRate: product.taxRate,
            total: itemTotal
          });

          // Restar stock y registrar movimiento de inventario (out)
          await prisma.product.update({
            where: { id: product.id },
            data: { currentStock: { decrement: item.qty } }
          });

          // Leer stock actualizado para registrar cantidades precisas
          const updatedProd = await prisma.product.findUnique({ where: { id: product.id } });
          const qtyBefore = updatedProd ? updatedProd.currentStock + item.qty : item.qty;
          const qtyAfter = updatedProd ? updatedProd.currentStock : 0;

          await prisma.inventoryMovement.create({
            data: {
              clinicId: clinic.id,
              branchId: branch.id,
              productId: product.id,
              type: MovementType.out,
              quantity: item.qty,
              quantityBefore: qtyBefore,
              quantityAfter: qtyAfter,
              reason: `Consumo médico en cita ${appointment.serviceType}`,
              referenceId: appointment.id,
              referenceType: 'appointment',
              performedBy: vet.id,
              performedAt: scheduledAt
            }
          });
        }
      }

      // 5. Generar factura financiera (Invoice)
      const subtotal = baseCost + extraCost;
      const taxTotal = billItems.reduce((acc, curr) => acc + (curr.unitPrice * curr.qty * curr.taxRate), 0);
      const invoiceTotal = subtotal + taxTotal;

      // Estado de factura (90% pagados del todo, 10% cobrados parcialmente)
      const isPaid = i % 10 !== 0;
      const invoiceStatus = isPaid ? InvoiceStatus.paid : InvoiceStatus.partial;
      const amountPaid = isPaid ? invoiceTotal : Math.round(invoiceTotal * 0.4);
      const balance = invoiceTotal - amountPaid;

      const invoiceNumString = `FAC-${String(invoiceCounter).padStart(6, '0')}`;
      invoiceCounter++;

      const invoice = await prisma.invoice.create({
        data: {
          clinicId: clinic.id,
          invoiceNumber: invoiceNumString,
          tutorId: tutors[patientIndex % tutors.length].id,
          appointmentId: appointment.id,
          status: invoiceStatus,
          subtotal,
          taxTotal,
          total: invoiceTotal,
          amountPaid,
          balance,
          issuedAt: scheduledAt,
          dueAt: new Date(scheduledAt.getTime() + 30 * 24 * 60 * 60 * 1000),
          paidAt: isPaid ? scheduledAt : null,
          notes: `Facturación por servicios profesionales de salud animal y medicamentos suministrados.`
        }
      });

      // Crear los ítems de factura
      for (const bi of billItems) {
        await prisma.invoiceItem.create({
          data: {
            invoiceId: invoice.id,
            description: bi.description,
            productId: bi.productId || null,
            quantity: bi.qty,
            unitPrice: bi.unitPrice,
            taxRate: bi.taxRate,
            discount: 0,
            total: bi.total
          }
        });
      }

      // Sincronizar amountCharged en la cita
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { amountCharged: invoiceTotal }
      });
    }
  }

  console.log(`📊 ${invoiceCounter - 1} facturas creadas e indexadas en la historia de 3 meses.`);

  // 10. Crear Citas de prueba para HOY (Itinerario en Medellín activo)
  console.log('📅 Creando las citas interactivas de prueba para el itinerario de hoy...');
  
  // Toby (Perro de Carlos Gómez) - Schedulado (Visita 1)
  const app1Today = new Date(now);
  app1Today.setHours(9, 30, 0, 0);
  await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patients[0].id, // Toby
      vetId: vetUser.id,
      serviceType: 'Consulta General',
      scheduledAt: app1Today,
      durationMinutes: 45,
      status: AppointmentStatus.scheduled,
      reason: 'Baja de apetito persistente, desgana para caminar',
      notes: 'Dirección de visita: Carrera 43A #25S-15, Envigado. Puerta con reja blanca. Carlos Gómez (+57 312 456 7890).'
    }
  });

  // Luna (Gata de María Rodríguez) - Waiting (Visita 2)
  const app2Today = new Date(now);
  app2Today.setHours(11, 45, 0, 0);
  await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patients[2].id, // Luna
      vetId: vetUser.id,
      serviceType: 'Vacunación',
      scheduledAt: app2Today,
      durationMinutes: 30,
      status: AppointmentStatus.waiting,
      reason: 'Refuerzo de vacuna Triple Felina RCP anual',
      notes: 'Dirección de visita: Calle 30 #76-22, Belén, Medellín. Apartamento 402. María Rodríguez (+57 315 789 1234).'
    }
  });

  // Pepa (Mini Pig de Juliana López) - In Progress (Visita 3)
  const app3Today = new Date(now);
  app3Today.setHours(14, 0, 0, 0);
  await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patients[15].id, // Pepa (Mini Pig)
      vetId: vetUser.id,
      serviceType: 'Control',
      scheduledAt: app3Today,
      durationMinutes: 45,
      status: AppointmentStatus.in_progress,
      reason: 'Control de cicatrización post-esterilización',
      notes: 'Dirección de visita: Carrera 48 #26-85, Envigado. Condominio El Portal, Torre 2 Apto 1503. Juliana López (+57 321 444 5555).'
    }
  });

  // Bruno (Perro de Andrés Tobón) - Done (Visita 4 ya completada temprano)
  const app4Today = new Date(now);
  app4Today.setHours(7, 30, 0, 0);
  const doneApp = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patients[6].id, // Bruno
      vetId: vetUser.id,
      serviceType: 'Vacunación',
      scheduledAt: app4Today,
      durationMinutes: 30,
      status: AppointmentStatus.done,
      reason: 'Vacuna Antirrábica Nobivac y revisión general',
      notes: 'Dirección de visita: Calle 50 Sur #43A-12, Sabaneta. Andrés Tobón (+57 310 999 1111).',
      amountCharged: 93000
    }
  });

  // Crear su historia clínica correspondiente
  const doneRec = await prisma.medicalRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: patients[6].id,
      appointmentId: doneApp.id,
      vetId: vetUser.id,
      type: RecordType.consultation,
      title: 'Control de Vacunación: Refuerzo Antirrábico',
      anamnesis: 'Tutor indica que Bruno se encuentra en perfectas condiciones. Come con normalidad, deposiciones duras y ánimo excelente.',
      physicalExam: 'T: 38.6°C. Peso: 34 kg. Paciente en excelente estado general, hidratado, mucosas rosadas. Dentadura limpia. Frecuencia cardiaca en 92 lpm.',
      diagnosis: 'Paciente clínicamente sano apto para vacunación.',
      treatment: 'Se realiza la aplicación intramuscular de 1 dosis de Vacuna Antirrábica Nobivac (Lote RAB-2026X) en miembro posterior izquierdo. Sin reacciones inmediatas.',
      createdAt: app4Today
    }
  });

  // Crear vacuna aplicada
  await prisma.vaccine.create({
    data: {
      patientId: patients[6].id,
      name: 'Vacuna Antirrábica Nobivac',
      brand: 'MSD Animal Health',
      batch: 'RAB-2026X',
      appliedAt: app4Today,
      nextDueAt: new Date(app4Today.getTime() + 365 * 24 * 60 * 60 * 1000),
      vetId: vetUser.id
    }
  });

  // Generar factura del control de Bruno
  const doneInvoice = await prisma.invoice.create({
    data: {
      clinicId: clinic.id,
      invoiceNumber: `FAC-${String(invoiceCounter).padStart(6, '0')}`,
      tutorId: tutors[6].id, // Andrés Tobón
      appointmentId: doneApp.id,
      status: InvoiceStatus.paid,
      subtotal: 93000,
      taxTotal: 0,
      total: 93000,
      amountPaid: 93000,
      balance: 0,
      issuedAt: app4Today,
      paidAt: app4Today,
      notes: 'Facturado por servicio médico veterinario a domicilio.'
    }
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: doneInvoice.id,
      description: 'Consulta de vacunación veterinaria a domicilio',
      quantity: 1,
      unitPrice: 65000,
      taxRate: 0,
      total: 65000
    }
  });

  await prisma.invoiceItem.create({
    data: {
      invoiceId: doneInvoice.id,
      description: 'Vacuna Antirrábica Nobivac (MSD)',
      productId: products[1].id,
      quantity: 1,
      unitPrice: 28000,
      taxRate: 0,
      total: 28000
    }
  });

  // Registrar salida de stock de la vacuna
  await prisma.product.update({
    where: { id: products[1].id },
    data: { currentStock: { decrement: 1 } }
  });

  await prisma.inventoryMovement.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      productId: products[1].id,
      type: MovementType.out,
      quantity: 1,
      quantityBefore: products[1].currentStock,
      quantityAfter: products[1].currentStock - 1,
      reason: 'Consumo médico en consulta de hoy (Bruno)',
      referenceId: doneApp.id,
      referenceType: 'appointment',
      performedBy: vetUser.id,
      performedAt: app4Today
    }
  });

  console.log('✅ Citas interactivas de hoy creadas con facturación e historial persistentes.');
  console.log('🎉 Siembra masiva e histórica completada exitosamente.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la siembra de la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
