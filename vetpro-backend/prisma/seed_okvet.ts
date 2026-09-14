import { 
  PrismaClient, 
  BedType, 
  BedStatus, 
  LabCategory, 
  GroomingStatus,
  UserRole,
  HospitalizationStatus,
  LabOrderStatus
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Sembrando datos completos de paridad OkVet en vivo...');

  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    console.error('No se encontró clínica registrada. Ejecute primero el seed principal.');
    return;
  }

  const branch = await prisma.branch.findFirst({ where: { clinicId: clinic.id } });
  if (!branch) {
    console.error('No se encontró sucursal.');
    return;
  }

  const existingVet = await prisma.user.findFirst({ where: { clinicId: clinic.id, role: UserRole.vet } });
  const existingAdmin = await prisma.user.findFirst({ where: { clinicId: clinic.id, role: UserRole.admin } });

  // ─────────────────────────────────────────────
  // 1. Usuarios para todos los roles del sistema
  // ─────────────────────────────────────────────
  const salt = await bcrypt.genSalt(10);
  const defaultPasswordHash = await bcrypt.hash('admin123', salt);

  const staffUsers = [
    { email: 'asistente@vetpro.co', firstName: 'Camilo', lastName: 'Rúa', role: UserRole.assistant },
    { email: 'recepcion@vetpro.co', firstName: 'Marcela', lastName: 'Gómez', role: UserRole.receptionist },
    { email: 'groomer@vetpro.co', firstName: 'Brayan', lastName: 'Peláez', role: UserRole.groomer },
    { email: 'paseador@vetpro.co', firstName: 'Santiago', lastName: 'Duque', role: UserRole.walker }
  ];

  for (const u of staffUsers) {
    const exists = await prisma.user.findUnique({ where: { email: u.email } });
    if (!exists) {
      await prisma.user.create({
        data: {
          clinicId: clinic.id,
          branchId: branch.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          passwordHash: defaultPasswordHash,
          role: u.role
        }
      });
      console.log(`👤 Usuario creado: ${u.firstName} ${u.lastName} (${u.role})`);
    }
  }

  const groomerUser = await prisma.user.findFirst({ where: { role: UserRole.groomer } });
  const vetUser = existingVet || existingAdmin!;

  // ─────────────────────────────────────────────
  // 2. Camas de Hospitalización
  // ─────────────────────────────────────────────
  const bedCount = await prisma.hospitalBed.count({ where: { clinicId: clinic.id } });
  if (bedCount === 0) {
    const beds = [
      { code: 'UCI-01', name: 'Jaula UCI Caninos Grande', type: BedType.dog_uci, status: BedStatus.available, dailyRate: 75000 },
      { code: 'UCI-02', name: 'Jaula UCI Caninos Mediana', type: BedType.dog_uci, status: BedStatus.available, dailyRate: 65000 },
      { code: 'FEL-01', name: 'Jaula Felinos Aislamiento', type: BedType.cat_ward, status: BedStatus.available, dailyRate: 50000 },
      { code: 'FEL-02', name: 'Jaula Felinos Observación', type: BedType.cat_ward, status: BedStatus.available, dailyRate: 45000 },
      { code: 'OBS-01', name: 'Canil Observación General 1', type: BedType.dog_standard, status: BedStatus.available, dailyRate: 40000 },
      { code: 'OBS-02', name: 'Canil Observación General 2', type: BedType.dog_standard, status: BedStatus.available, dailyRate: 40000 }
    ];

    for (const b of beds) {
      await prisma.hospitalBed.create({
        data: {
          clinicId: clinic.id,
          branchId: branch.id,
          code: b.code,
          name: b.name,
          type: b.type,
          status: b.status,
          dailyRate: b.dailyRate
        }
      });
    }
    console.log(`🏥 6 camas de hospitalización registradas.`);
  }

  // ─────────────────────────────────────────────
  // 3. Resolución DIAN de Prueba
  // ─────────────────────────────────────────────
  const resCount = await prisma.dianResolution.count({ where: { clinicId: clinic.id } });
  if (resCount === 0) {
    await prisma.dianResolution.create({
      data: {
        clinicId: clinic.id,
        prefix: 'SETP',
        resolutionNumber: '18760000001',
        fromNumber: 1,
        toNumber: 500000,
        currentNumber: 101,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2028-12-31'),
        technicalKey: 'fc8eac422eba16e122d5aa92a14da838ec4f23b16a407fe150fb46237c4f53bc01947815c690f97eee7b32be1bb013f4',
        environment: 'test',
        active: true
      }
    });
    console.log('📑 Resolución fiscal DIAN configurada (Ambiente Habilitación).');
  }

  // ─────────────────────────────────────────────
  // 4. Catálogo de Pruebas de Laboratorio
  // ─────────────────────────────────────────────
  const labCount = await prisma.labTestCatalog.count({ where: { clinicId: clinic.id } });
  if (labCount === 0) {
    const defaultTests = [
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

    for (const t of defaultTests) {
      await prisma.labTestCatalog.create({
        data: { ...t, clinicId: clinic.id }
      });
    }
    console.log(`🔬 ${defaultTests.length} pruebas de laboratorio configuradas.`);
  }

  // ─────────────────────────────────────────────
  // 5. Pacientes para Kardex de Hospitalización
  // ─────────────────────────────────────────────
  const patients = await prisma.patient.findMany({ take: 6 });
  const bedUci = await prisma.hospitalBed.findFirst({ where: { code: 'UCI-01' } });
  const bedFel = await prisma.hospitalBed.findFirst({ where: { code: 'FEL-01' } });

  const activeHospCount = await prisma.hospitalization.count({ where: { status: HospitalizationStatus.admitted } });
  if (activeHospCount === 0 && patients.length >= 2 && bedUci && bedFel) {
    // Hospitalización 1: Canino en UCI-01
    const hosp1 = await prisma.hospitalization.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        patientId: patients[0].id,
        bedId: bedUci.id,
        status: HospitalizationStatus.admitted,
        admissionReason: 'Gastroenteritis aguda deshidratante con hematoquecia',
        diagnosis: 'Sospecha Parvovirosis / Gastroenteritis infecciosa',
        fluidTherapy: 'Ringer Lactato a 40 ml/h + Cloruro de Potasio (KCl) 20 mEq/L',
        dailyRateCharged: bedUci.dailyRate
      }
    });

    await prisma.hospitalBed.update({
      where: { id: bedUci.id },
      data: { status: BedStatus.occupied }
    });

    // Medicamentos hosp1
    const med1 = await prisma.hospitalMedication.create({
      data: {
        hospitalizationId: hosp1.id,
        drugName: 'Metronidazol 500mg/100ml IV',
        dose: '15 mg/kg (6.5 ml)',
        route: 'IV',
        frequencyHours: 12,
        timeSlots: ['08:00 AM', '08:00 PM'],
        instructions: 'Pasar lento en microgotero en 30 minutos.'
      }
    });

    const med2 = await prisma.hospitalMedication.create({
      data: {
        hospitalizationId: hosp1.id,
        drugName: 'Maropitant (Cerenia) 10mg/ml',
        dose: '1 mg/kg (0.8 ml)',
        route: 'SC',
        frequencyHours: 24,
        timeSlots: ['08:00 AM'],
        instructions: 'Antiemético central una vez al día.'
      }
    });

    // Dosis aplicadas
    await prisma.hospitalDoseRecord.create({
      data: {
        hospitalizationId: hosp1.id,
        medicationId: med1.id,
        timeSlot: '08:00 AM',
        applied: true,
        administeredAt: new Date(),
        administeredBy: vetUser.firstName,
        notes: 'Dosis matutina administrada sin complicaciones.'
      }
    });

    await prisma.hospitalDoseRecord.create({
      data: {
        hospitalizationId: hosp1.id,
        medicationId: med2.id,
        timeSlot: '08:00 AM',
        applied: true,
        administeredAt: new Date(),
        administeredBy: vetUser.firstName,
        notes: 'Aplicado SC en región interescapular.'
      }
    });

    // Evolución de hoy
    await prisma.hospitalEvolution.create({
      data: {
        hospitalizationId: hosp1.id,
        vetId: vetUser.id,
        temperature: 38.6,
        heartRate: 108,
        respiratoryRate: 24,
        capillaryRefillTime: 1.5,
        bloodGlucose: 95,
        fluidTherapyRate: '40 ml/h',
        notes: 'Paciente alerta y receptivo. Pliegue cutáneo recuperado al 4%. Sin nuevos vómitos. Se mantiene en fluidoterapia estricta y NPO.'
      }
    });

    // Hospitalización 2: Felino en FEL-01
    const hosp2 = await prisma.hospitalization.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        patientId: patients[1].id,
        bedId: bedFel.id,
        status: HospitalizationStatus.admitted,
        admissionReason: 'FLUTD obstructivo - Síndrome Urológico Felino',
        diagnosis: 'Urolitiasis / Tapón uretral en desobstrucción',
        fluidTherapy: 'Solución Salina 0.9% a 15 ml/h',
        dailyRateCharged: bedFel.dailyRate
      }
    });

    await prisma.hospitalBed.update({
      where: { id: bedFel.id },
      data: { status: BedStatus.occupied }
    });

    const med3 = await prisma.hospitalMedication.create({
      data: {
        hospitalizationId: hosp2.id,
        drugName: 'Buprenorfina 0.3mg/ml',
        dose: '0.02 mg/kg (0.2 ml)',
        route: 'SC',
        frequencyHours: 8,
        timeSlots: ['08:00 AM', '04:00 PM', '12:00 AM'],
        instructions: 'Analgesia profunda post-sondaje.'
      }
    });

    await prisma.hospitalDoseRecord.create({
      data: {
        hospitalizationId: hosp2.id,
        medicationId: med3.id,
        timeSlot: '08:00 AM',
        applied: true,
        administeredAt: new Date(),
        administeredBy: vetUser.firstName
      }
    });

    await prisma.hospitalEvolution.create({
      data: {
        hospitalizationId: hosp2.id,
        vetId: vetUser.id,
        temperature: 38.2,
        heartRate: 165,
        respiratoryRate: 28,
        notes: 'Sonda uretral fijada y permeable. Bolsa colectora con 45ml de orina ligeramente hematúrica sin sedimentos gruesos. Ronroneo suave.'
      }
    });

    console.log('🐾 2 pacientes hospitalizados con Kardex, medicaciones y evoluciones en vivo.');
  }

  // ─────────────────────────────────────────────
  // 6. Órdenes de Laboratorio y Analitos
  // ─────────────────────────────────────────────
  const labOrdersCount = await prisma.labOrder.count({ where: { clinicId: clinic.id } });
  if (labOrdersCount === 0 && patients.length >= 3) {
    const labCatalogItems = await prisma.labTestCatalog.findMany({ where: { clinicId: clinic.id } });
    const leuTest = labCatalogItems.find(t => t.code === 'HEM-LEU');
    const hctTest = labCatalogItems.find(t => t.code === 'HEM-HCT');
    const plqTest = labCatalogItems.find(t => t.code === 'HEM-PLQ');
    const creaTest = labCatalogItems.find(t => t.code === 'BIO-CREA');
    const altTest = labCatalogItems.find(t => t.code === 'BIO-ALT');

    // Orden 1: Completada con resultados
    const order1 = await prisma.labOrder.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[2].id,
        vetId: vetUser.id,
        orderNumber: 'LAB-2026-0001',
        status: LabOrderStatus.completed,
        sampleType: 'Sangre entera EDTA + Suero',
        clinicalNotes: 'Perfil prequirúrgico profiláctico y función hepatorrenal.',
        completedAt: new Date()
      }
    });

    if (leuTest && hctTest && plqTest && creaTest && altTest) {
      await prisma.labResultItem.createMany({
        data: [
          { labOrderId: order1.id, labTestCatalogId: leuTest.id, testName: leuTest.name, valueMeasured: '12.4', unit: leuTest.unit, refRangeText: `${leuTest.canineRefMin} - ${leuTest.canineRefMax}`, flag: 'normal' },
          { labOrderId: order1.id, labTestCatalogId: hctTest.id, testName: hctTest.name, valueMeasured: '44.0', unit: hctTest.unit, refRangeText: `${hctTest.canineRefMin} - ${hctTest.canineRefMax}`, flag: 'normal' },
          { labOrderId: order1.id, labTestCatalogId: plqTest.id, testName: plqTest.name, valueMeasured: '320.0', unit: plqTest.unit, refRangeText: `${plqTest.canineRefMin} - ${plqTest.canineRefMax}`, flag: 'normal' },
          { labOrderId: order1.id, labTestCatalogId: creaTest.id, testName: creaTest.name, valueMeasured: '1.1', unit: creaTest.unit, refRangeText: `${creaTest.canineRefMin} - ${creaTest.canineRefMax}`, flag: 'normal' },
          { labOrderId: order1.id, labTestCatalogId: altTest.id, testName: altTest.name, valueMeasured: '135.0', unit: altTest.unit, refRangeText: `${altTest.canineRefMin} - ${altTest.canineRefMax}`, flag: 'high' }
        ]
      });
    }

    // Orden 2: Muestra tomada / En análisis
    await prisma.labOrder.create({
      data: {
        clinicId: clinic.id,
        patientId: patients[0].id,
        vetId: vetUser.id,
        orderNumber: 'LAB-2026-0002',
        status: LabOrderStatus.sample_taken,
        sampleType: 'Muestra fecal en fresco',
        clinicalNotes: 'Coprológico seriadopor flotación y frotis directo.'
      }
    });

    console.log('🔬 2 órdenes de laboratorio creadas con analitos y flags de referencia.');
  }

  // ─────────────────────────────────────────────
  // 7. Servicios de Pet Spa / Peluquería Kanban
  // ─────────────────────────────────────────────
  const groomingCount = await prisma.groomingService.count({ where: { clinicId: clinic.id } });
  if (groomingCount === 0 && patients.length >= 4) {
    const gUsers = groomerUser ? groomerUser.id : vetUser.id;

    await prisma.groomingService.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        patientId: patients[0].id,
        groomerId: gUsers,
        serviceType: 'Baño Completo + Deslanado Especial',
        coatCondition: 'Abundante muda de pelo y nudos retroauriculares',
        skinObservations: 'Piel sana, sin ectoparásitos visibles',
        status: GroomingStatus.checked_in,
        price: 55000,
        notes: 'Cuidado especial en orejas, no le gusta el agua muy caliente.'
      }
    });

    await prisma.groomingService.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        patientId: patients[1].id,
        groomerId: gUsers,
        serviceType: 'Baño Medicado Dermatológico',
        coatCondition: 'Pelo seco y descamación dorsal',
        skinObservations: 'Eritema leve en pliegues inguinales',
        medicatedShampoo: 'Clorhexidina 3% + Ketoconazol 2%',
        status: GroomingStatus.bathing,
        price: 65000,
        notes: 'Dejar actuar el shampoo medicado por 10 minutos de reloj.'
      }
    });

    await prisma.groomingService.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        patientId: patients[2].id,
        groomerId: gUsers,
        serviceType: 'Corte de Raza Schnauzer + Limpieza Ótica',
        coatCondition: 'Barba con restos de comida, cuerpo largo',
        status: GroomingStatus.drying_styling,
        price: 60000,
        notes: 'Mantener cejas y barba clásicas de la raza.'
      }
    });

    await prisma.groomingService.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        patientId: patients[3].id,
        groomerId: gUsers,
        serviceType: 'Spa Relax + Corte de Uñas + Vaciado de Sacos',
        status: GroomingStatus.ready_for_pickup,
        price: 50000,
        readyAt: new Date(),
        notes: 'Listo para entrega. Aroma a lavanda aplicado.'
      }
    });

    console.log('✂️ 4 servicios de spa/grooming distribuidos en las etapas del Kanban.');
  }

  // ─────────────────────────────────────────────
  // 8. Turno de Caja POS Abierto para el día de hoy
  // ─────────────────────────────────────────────
  const openShift = await prisma.cashRegisterShift.findFirst({
    where: { clinicId: clinic.id, status: 'open' }
  });

  if (!openShift) {
    await prisma.cashRegisterShift.create({
      data: {
        clinicId: clinic.id,
        branchId: branch.id,
        userId: existingAdmin ? existingAdmin.id : vetUser.id,
        openingBalance: 150000,
        cashSales: 93000,
        electronicSales: 175000,
        expectedBalance: 243000,
        status: 'open',
        notes: 'Turno matutino de caja abierto con base de $150.000 COP.'
      }
    });
    console.log('💵 Turno de caja POS abierto y listo para arqueo.');
  }

  console.log('🎉 Siembra de paridad OkVet completada con éxito. Todos los módulos operativos al 100%.');
}

main()
  .catch((e) => {
    console.error('Error en seed_okvet:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
