import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando la siembra de la base de datos de VetPro...');

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

  console.log('🧹 Limpieza de base de datos completada.');

  // 2. Crear Clínica Principal
  const clinic = await prisma.clinic.create({
    data: {
      name: 'Clínica Veterinaria San José',
      nit: '900.123.456-7',
      phone: '+57 1 601 2345',
      email: 'contacto@veterinariasanjose.co',
      address: 'Calle 100 #15-30',
      city: 'Bogotá',
      plan: 'pro',
      aiMinutesUsed: 25.5,
      aiMinutesLimit: 120
    }
  });
  console.log(`🏢 Clínica creada: ${clinic.name}`);

  // 3. Crear Sucursal (Branch)
  const branch = await prisma.branch.create({
    data: {
      clinicId: clinic.id,
      name: 'Sede Norte',
      address: 'Calle 140 #19-40, Bogotá D.C.',
      phone: '+57 310 999 8888',
      email: 'sedenorte@veterinariasanjose.co'
    }
  });
  console.log(`📍 Sucursal creada: ${branch.name}`);

  // 4. Crear Usuarios (Vets / Staff) con hashes bcrypt
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
  console.log('👤 Usuarios de clínica registrados (admin@vetpro.co / vet@vetpro.co).');

  // 5. Crear Tutores (Clientes)
  const tutor1 = await prisma.tutor.create({
    data: {
      clinicId: clinic.id,
      firstName: 'Carlos',
      lastName: 'Gómez',
      email: 'carlos.gomez@correo.co',
      phone: '+57 312 456 7890',
      documentId: '1.018.234.567',
      address: 'Calle 100 #15-30, Apto 502, Bogotá',
      notes: 'Tutor muy puntual y comprometido.'
    }
  });

  const tutor2 = await prisma.tutor.create({
    data: {
      clinicId: clinic.id,
      firstName: 'María',
      lastName: 'Rodríguez',
      email: 'maria.rod@outlook.com',
      phone: '+57 315 789 1234',
      documentId: '52.345.678',
      address: 'Carrera 7 #45-12, Medellín'
    }
  });

  const tutor3 = await prisma.tutor.create({
    data: {
      clinicId: clinic.id,
      firstName: 'Diana',
      lastName: 'Pérez',
      email: 'diana.perez@hotmail.com',
      phone: '+57 320 987 6543',
      documentId: '1.032.456.789',
      address: 'Av. El Poblado #3-45, Envigado'
    }
  });

  const tutor4 = await prisma.tutor.create({
    data: {
      clinicId: clinic.id,
      firstName: 'Juan',
      lastName: 'Sánchez',
      email: 'juan.sanchez@gmail.com',
      phone: '+57 300 123 4567',
      documentId: '79.876.543',
      address: 'Transversal 5 #80-22, Cali'
    }
  });
  console.log('👥 Tutores registrados exitosamente.');

  // 6. Crear Pacientes (Mascotas)
  // Toby (Perro de Carlos)
  const patient1 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      tutorId: tutor1.id,
      name: 'Toby',
      species: 'dog',
      breed: 'Golden Retriever',
      birthDate: new Date('2022-04-12'),
      sex: 'male',
      sterilized: true,
      weight: 32.5,
      chipId: '985112003456789',
      photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150',
      allergies: 'Alergia alimentaria (pollo), hipersensibilidad a pulgas.',
      notes: 'Toby es un perro muy dócil, pero suele ponerse nervioso al subir a la báscula metálica. Requiere premios.',
      status: 'active'
    }
  });

  // Luna (Gato de María)
  const patient2 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      tutorId: tutor2.id,
      name: 'Luna',
      species: 'cat',
      breed: 'Siamés',
      birthDate: new Date('2023-08-01'),
      sex: 'female',
      sterilized: true,
      weight: 4.2,
      chipId: '985112003456780',
      photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=150',
      status: 'active'
    }
  });

  // Kira (Perro de Carlos)
  const patient3 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      tutorId: tutor1.id,
      name: 'Kira',
      species: 'dog',
      breed: 'Bulldog Francés',
      birthDate: new Date('2024-01-15'),
      sex: 'female',
      sterilized: false,
      weight: 11.8,
      chipId: '985112003456781',
      status: 'active'
    }
  });

  // Copito (Conejo de Diana)
  const patient4 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      tutorId: tutor3.id,
      name: 'Copito',
      species: 'rabbit',
      breed: 'Angora',
      birthDate: new Date('2025-05-10'),
      sex: 'male',
      sterilized: false,
      weight: 2.1,
      status: 'active'
    }
  });

  // Rocky (Perro de Juan - Inactivo)
  const patient5 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      tutorId: tutor4.id,
      name: 'Rocky',
      species: 'dog',
      breed: 'Pastor Alemán',
      birthDate: new Date('2018-11-20'),
      sex: 'male',
      sterilized: true,
      weight: 38.0,
      chipId: '985112003456782',
      photoUrl: 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95?auto=format&fit=crop&q=80&w=150',
      status: 'inactive'
    }
  });

  // Mimi (Gato de María)
  const patient6 = await prisma.patient.create({
    data: {
      clinicId: clinic.id,
      tutorId: tutor2.id,
      name: 'Mimi',
      species: 'cat',
      breed: 'Persa',
      birthDate: new Date('2021-03-05'),
      sex: 'female',
      sterilized: true,
      weight: 3.8,
      status: 'active'
    }
  });

  console.log('🐾 Mascotas iniciales sembradas.');

  // 7. Crear Expediente Clínico de Toby (patient1)
  // Registro 1: Consulta de vacunas
  const record1 = await prisma.medicalRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: patient1.id,
      vetId: adminUser.id,
      type: 'consultation',
      title: 'Control de Vacunación y Control de Peso',
      anamnesis: 'Tutor asiste con Toby para control de vacunas anual. Informa que ha estado comiendo bien y su nivel de energía es alto. Sin problemas digestivos reportados en los últimos meses.',
      physicalExam: 'Paciente alerta y responsivo. Mucosas rosadas, tiempo de llenado capilar < 2s. Frecuencia cardíaca: 95 lpm, frecuencia respiratoria: 20 rpm, temperatura: 38.6°C. Peso estable de 32.5 kg. Ligera acumulación de sarro en premolares superiores.',
      diagnosis: 'Paciente clínicamente sano. Gingivitis leve grado 1.',
      treatment: 'Se realiza la aplicación de la vacuna Antirrábica Nobivac. Se aconseja iniciar profilaxis dental casera o cepillado regular.',
      aiGenerated: true,
      aiTranscriptionMinutes: 2.5,
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
    }
  });

  // Adjunto para Registro 1
  await prisma.attachment.create({
    data: {
      recordId: record1.id,
      name: 'Cuadro_Hematico_Toby.pdf',
      type: 'pdf',
      url: 'https://vetpro.co/files/toby_hemo.pdf',
      size: 250880
    }
  });

  // Registro 2: Gastroenteritis
  const record2 = await prisma.medicalRecord.create({
    data: {
      clinicId: clinic.id,
      patientId: patient1.id,
      vetId: vetUser.id,
      type: 'consultation',
      title: 'Cuadro Agudo de Gastroenteritis Leve',
      anamnesis: 'Carlos reporta que Toby presentó dos episodios de emesis líquida (bilis) en la madrugada y deposición blanda. Apetito disminuido hoy. Pudo haber ingerido pasto húmedo en el parque.',
      physicalExam: 'Paciente algo decaído. Deshidratación estimada del 5%. Abdomen blando, dolor a la palpación profunda en fosa epigástrica. Mucosas ligeramente secas.',
      diagnosis: 'Gastroenteritis infecciosa leve / indiscreción alimentaria.',
      treatment: '1. Hidratación oral con suero electrolítico en casa.\n2. Inyección SC de Metoclopramida (antiemético) en clínica.\n3. Prescripción de Amoxicilina 500mg oral (1 tableta cada 12h por 7 días).\n4. Dieta blanda (arroz blanco con pechuga de pollo hervida) por 3 días.',
      aiGenerated: false,
      createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    }
  });

  // Adjunto para Registro 2
  await prisma.attachment.create({
    data: {
      recordId: record2.id,
      name: 'Ecografia_Abdominal.png',
      type: 'image',
      url: 'https://images.unsplash.com/photo-1579684389782-64d84b5e901d?auto=format&fit=crop&q=80&w=300',
      size: 1258291
    }
  });

  console.log('🗒️ Historial clínico de Toby sembrado.');

  // 8. Crear Vacunas aplicadas a Toby
  await prisma.vaccine.create({
    data: {
      patientId: patient1.id,
      name: 'Vacuna Antirrábica (Nobivac)',
      brand: 'MSD Animal Health',
      batch: 'RAB-2026X',
      appliedAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      nextDueAt: new Date(Date.now() + 350 * 24 * 60 * 60 * 1000),
      vetId: adminUser.id,
      notes: 'Aplicada en miembro posterior derecho SC.'
    }
  });

  await prisma.vaccine.create({
    data: {
      patientId: patient1.id,
      name: 'Vacuna Múltiple Canina (DHPPI+L)',
      brand: 'Zoetis',
      batch: 'MULT-990A',
      appliedAt: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
      nextDueAt: new Date(Date.now() + 185 * 24 * 60 * 60 * 1000),
      vetId: adminUser.id,
      notes: 'Refuerzo anual aplicado con éxito.'
    }
  });
  console.log('💉 Cartilla de vacunas de Toby sembrada.');

  // 9. Crear Citas de prueba para hoy
  console.log('📅 Sembrando citas para el día de hoy...');
  const today = new Date();

  // Toby (Perro de Carlos) - Programado
  const app1Today = new Date(today);
  app1Today.setHours(10, 0, 0, 0);
  const appointment1 = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patient1.id,
      vetId: vetUser.id,
      serviceType: 'Consulta General',
      scheduledAt: app1Today,
      durationMinutes: 30,
      status: 'scheduled',
      reason: 'Baja de apetito y letargo leve',
      notes: 'Tutor reside en Envigado. Dirección: Carrera 43A #25S-15, Envigado.'
    }
  });

  // Luna (Gata de María) - En espera (Llegada marcada)
  const app2Today = new Date(today);
  app2Today.setHours(12, 30, 0, 0);
  const appointment2 = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patient2.id,
      vetId: vetUser.id,
      serviceType: 'Vacunación',
      scheduledAt: app2Today,
      durationMinutes: 30,
      status: 'waiting',
      reason: 'Refuerzo de Triple Felina anual',
      notes: 'Tutor reside en Belén, Medellín. Dirección: Calle 30 #76-22, Medellín.'
    }
  });

  // Copito (Conejo de Diana) - En consulta
  const app3Today = new Date(today);
  app3Today.setHours(14, 0, 0, 0);
  const appointment3 = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patient4.id,
      vetId: vetUser.id,
      serviceType: 'Control',
      scheduledAt: app3Today,
      durationMinutes: 45,
      status: 'in_progress',
      reason: 'Control post-operatorio de esterilización',
      notes: 'Revisar sutura abdominal. Tutor reside en Laureles, Medellín. Dirección: Circular 4 #73-10, Medellín.'
    }
  });

  // Kira (Perro de Carlos) - Finalizado
  const app4Today = new Date(today);
  app4Today.setHours(8, 30, 0, 0);
  const appointment4 = await prisma.appointment.create({
    data: {
      clinicId: clinic.id,
      branchId: branch.id,
      patientId: patient3.id,
      vetId: vetUser.id,
      serviceType: 'Vacunación',
      scheduledAt: app4Today,
      durationMinutes: 30,
      status: 'done',
      reason: 'Vacuna Pentavalente canina',
      notes: 'Control general sano. Tutor reside en El Poblado, Medellín. Dirección: Carrera 38 #5-45, El Poblado.'
    }
  });

  console.log('📅 Citas de prueba sembradas.');

  console.log('✅ Base de datos sembrada perfectamente con datos realistas.');
}

main()
  .catch((e) => {
    console.error('❌ Error durante la siembra de la base de datos:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
