import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Marketplace & Vet Profiles...');

  const clinic = await prisma.clinic.findFirst();
  if (!clinic) {
    throw new Error('No clinic found. Please run base seed first.');
  }

  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash('vet123', salt);

  // 1. Dra. Liliana Vet (Bogotá) - Verificada y Destacada
  const userLiliana = await prisma.user.upsert({
    where: { email: 'liliana@vetpro.co' },
    update: {
      firstName: 'Liliana',
      lastName: 'Gómez',
      role: 'vet',
      phone: '+57 300 123 4567',
      address: 'Carrera 15 #85-30',
      active: true,
      profileCompleted: true,
    },
    create: {
      clinicId: clinic.id,
      email: 'liliana@vetpro.co',
      firstName: 'Liliana',
      lastName: 'Gómez',
      passwordHash: defaultPassword,
      role: 'vet',
      phone: '+57 300 123 4567',
      address: 'Carrera 15 #85-30',
      active: true,
      profileCompleted: true,
    },
  });

  const profileLiliana = await prisma.vetProfile.upsert({
    where: { userId: userLiliana.id },
    update: {
      professionalCard: 'COMVEZCOL-28491',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verifiedBy: 'system',
      specialties: ['Medicina General', 'Dermatología Felina y Canina', 'Medicina Preventiva', 'Nutrición'],
      bio: 'Médica Veterinaria con más de 8 años de experiencia en atención integral, dermatología y urgencias domiciliarias. Enfoque amable y sin estrés para tus mascotas.',
      modalities: ['domicilio', 'consultorio'],
      consultationPrice: 65000,
      homeVisitPrice: 85000,
      city: 'Bogotá',
      coverageZones: ['Usaquén', 'Chapinero', 'Suba', 'Teusaquillo', 'Chía', 'Cedritos'],
      rating: 4.95,
      reviewCount: 12,
      isPublic: true,
      isFeatured: true,
      whatsappNumber: '573001234567',
    },
    create: {
      userId: userLiliana.id,
      clinicId: clinic.id,
      professionalCard: 'COMVEZCOL-28491',
      verificationStatus: 'verified',
      verifiedAt: new Date(),
      verifiedBy: 'system',
      specialties: ['Medicina General', 'Dermatología Felina y Canina', 'Medicina Preventiva', 'Nutrición'],
      bio: 'Médica Veterinaria con más de 8 años de experiencia en atención integral, dermatología y urgencias domiciliarias. Enfoque amable y sin estrés para tus mascotas.',
      modalities: ['domicilio', 'consultorio'],
      consultationPrice: 65000,
      homeVisitPrice: 85000,
      city: 'Bogotá',
      coverageZones: ['Usaquén', 'Chapinero', 'Suba', 'Teusaquillo', 'Chía', 'Cedritos'],
      rating: 4.95,
      reviewCount: 12,
      isPublic: true,
      isFeatured: true,
      whatsappNumber: '573001234567',
    },
  });

  // Reseñas para Liliana
  await prisma.vetReview.deleteMany({ where: { vetProfileId: profileLiliana.id } });
  await prisma.vetReview.createMany({
    data: [
      {
        vetProfileId: profileLiliana.id,
        tutorName: 'Carlos Mendoza',
        rating: 5,
        comment: 'Excelente atención a domicilio. Llegó muy puntual con todo su equipo y mi gato Tom no se estresó en lo más mínimo durante la vacunación.',
        serviceType: 'domicilio',
      },
      {
        vetProfileId: profileLiliana.id,
        tutorName: 'María Fernanda Ríos',
        rating: 5,
        comment: 'Solucionó el problema de dermatitis de Toby que llevaba 6 meses sin mejorar con otros doctores. Super profesional y empática.',
        serviceType: 'consulta general',
      },
      {
        vetProfileId: profileLiliana.id,
        tutorName: 'Alejandro Restrepo',
        rating: 5,
        comment: 'Me encantó el seguimiento por la plataforma y la historia clínica que me compartió. 10 de 10.',
        serviceType: 'domicilio',
      },
    ],
  });

  // 2. Dra. Laura Cardona (Medellín) - Verificada
  const userLaura = await prisma.user.findFirst({
    where: { email: 'vet@vetpro.co' },
  });

  if (userLaura) {
    const profileLaura = await prisma.vetProfile.upsert({
      where: { userId: userLaura.id },
      update: {
        professionalCard: 'COMVEZCOL-31902',
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verifiedBy: 'system',
        specialties: ['Medicina Felina Cat-Friendly', 'Ecografía Abdominal', 'Cirugía de Tejidos Blandos'],
        bio: 'Especialista en medicina interna y felina con certificación Cat-Friendly Clinic. Diagnóstico por ultrasonido y cirugía general.',
        modalities: ['consultorio', 'domicilio'],
        consultationPrice: 60000,
        homeVisitPrice: 80000,
        city: 'Medellín',
        coverageZones: ['El Poblado', 'Laureles', 'Envigado', 'Sabaneta', 'Bello'],
        rating: 5.0,
        reviewCount: 9,
        isPublic: true,
        isFeatured: true,
        whatsappNumber: '573119876543',
      },
      create: {
        userId: userLaura.id,
        clinicId: clinic.id,
        professionalCard: 'COMVEZCOL-31902',
        verificationStatus: 'verified',
        verifiedAt: new Date(),
        verifiedBy: 'system',
        specialties: ['Medicina Felina Cat-Friendly', 'Ecografía Abdominal', 'Cirugía de Tejidos Blandos'],
        bio: 'Especialista en medicina interna y felina con certificación Cat-Friendly Clinic. Diagnóstico por ultrasonido y cirugía general.',
        modalities: ['consultorio', 'domicilio'],
        consultationPrice: 60000,
        homeVisitPrice: 80000,
        city: 'Medellín',
        coverageZones: ['El Poblado', 'Laureles', 'Envigado', 'Sabaneta', 'Bello'],
        rating: 5.0,
        reviewCount: 9,
        isPublic: true,
        isFeatured: true,
        whatsappNumber: '573119876543',
      },
    });

    await prisma.vetReview.deleteMany({ where: { vetProfileId: profileLaura.id } });
    await prisma.vetReview.createMany({
      data: [
        {
          vetProfileId: profileLaura.id,
          tutorName: 'Daniela Ospina',
          rating: 5,
          comment: 'La mejor veterinaria de gatos en Medellín. Mi gata suele ser agresiva pero con la Dra. Laura estuvo súper tranquila.',
          serviceType: 'consultorio',
        },
        {
          vetProfileId: profileLaura.id,
          tutorName: 'Julián Morales',
          rating: 5,
          comment: 'Excelente ecografía y diagnóstico certero a tiempo para mi perrita Luna.',
          serviceType: 'domicilio',
        },
      ],
    });
  }

  // 3. Dr. Mateo Sánchez (Cali) - Pendiente de Verificación (para probar panel de admin)
  const userMateo = await prisma.user.upsert({
    where: { email: 'mateo@vetpro.co' },
    update: {
      firstName: 'Mateo',
      lastName: 'Sánchez',
      role: 'vet',
      phone: '+57 315 555 7890',
      active: true,
    },
    create: {
      clinicId: clinic.id,
      email: 'mateo@vetpro.co',
      firstName: 'Mateo',
      lastName: 'Sánchez',
      passwordHash: defaultPassword,
      role: 'vet',
      phone: '+57 315 555 7890',
      active: true,
    },
  });

  await prisma.vetProfile.upsert({
    where: { userId: userMateo.id },
    update: {
      professionalCard: 'COMVEZCOL-40118-PEND',
      verificationStatus: 'pending',
      verificationNotes: 'Documento subido pendiente de cotejo con registro COMVEZCOL.',
      specialties: ['Ortopedia Veterinaria', 'Fisioterapia y Rehabilitación'],
      bio: 'Médico veterinario con diplomado en traumatología y ortopedia en animales de compañía.',
      modalities: ['consultorio'],
      consultationPrice: 70000,
      city: 'Cali',
      coverageZones: ['Granada', 'Ciudad Jardín', 'Pance'],
      rating: 5.0,
      reviewCount: 0,
      isPublic: false,
      isFeatured: false,
      whatsappNumber: '573155557890',
    },
    create: {
      userId: userMateo.id,
      clinicId: clinic.id,
      professionalCard: 'COMVEZCOL-40118-PEND',
      verificationStatus: 'pending',
      verificationNotes: 'Documento subido pendiente de cotejo con registro COMVEZCOL.',
      specialties: ['Ortopedia Veterinaria', 'Fisioterapia y Rehabilitación'],
      bio: 'Médico veterinario con diplomado en traumatología y ortopedia en animales de compañía.',
      modalities: ['consultorio'],
      consultationPrice: 70000,
      city: 'Cali',
      coverageZones: ['Granada', 'Ciudad Jardín', 'Pance'],
      rating: 5.0,
      reviewCount: 0,
      isPublic: false,
      isFeatured: false,
      whatsappNumber: '573155557890',
    },
  });

  console.log('✅ Marketplace seeded successfully:');
  console.log('   - Dra. Liliana Gómez (Bogotá) -> Verificada & Destacada');
  console.log('   - Dra. Laura Cardona (Medellín) -> Verificada');
  console.log('   - Dr. Mateo Sánchez (Cali) -> Pendiente de Verificación');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding marketplace:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
