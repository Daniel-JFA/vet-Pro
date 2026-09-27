import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const defaultPrisma = new PrismaClient();

export async function seedMarketplace(prismaClient?: PrismaClient) {
  const prisma = prismaClient || defaultPrisma;
  console.log('🌱 Sembrando Directorio Marketplace y Veterinarios Verificados...');

  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash('vet123', salt);

  // ─────────────────────────────────────────────
  // 1. Clínicas Regionales por Ciudad
  // ─────────────────────────────────────────────
  const clinicsData = [
    {
      email: 'gerencia@vetpro.co',
      name: 'Veterinaria Domiciliaria VetPro Pro',
      city: 'Medellín',
      phone: '+57 4 444 8080',
      address: 'Calle 10A #34-11, El Poblado',
      nit: '901.345.678-2'
    },
    {
      email: 'bogota@vetpro.co',
      name: 'Centro Médico Veterinario Santa Bárbara',
      city: 'Bogotá',
      phone: '+57 1 612 3456',
      address: 'Carrera 15 #85-30, Chapinero',
      nit: '901.456.789-3'
    },
    {
      email: 'cali@vetpro.co',
      name: 'Clínica Veterinaria San Fernando Cali',
      city: 'Cali',
      phone: '+57 2 555 1234',
      address: 'Avenida 6 Norte #24N-15, San Fernando',
      nit: '901.567.890-4'
    },
    {
      email: 'barranquilla@vetpro.co',
      name: 'Centro Veterinario del Caribe',
      city: 'Barranquilla',
      phone: '+57 5 360 9876',
      address: 'Carrera 53 #76-120, Alto Prado',
      nit: '901.678.901-5'
    },
    {
      email: 'bucaramanga@vetpro.co',
      name: 'Clínica Veterinaria Bucaramanga Pro',
      city: 'Bucaramanga',
      phone: '+57 7 643 5678',
      address: 'Calle 48 #33-19, Cabecera',
      nit: '901.789.012-6'
    },
    {
      email: 'pereira@vetpro.co',
      name: 'Clínica Veterinaria Eje Cafetero',
      city: 'Pereira',
      phone: '+57 6 324 8899',
      address: 'Avenida Circunvalar #12-45, Pinares',
      nit: '901.890.123-7'
    },
    {
      email: 'cartagena@vetpro.co',
      name: 'Hospital Veterinario Ciudad Heroica',
      city: 'Cartagena',
      phone: '+57 5 665 4321',
      address: 'Carrera 3 #8-45, Bocagrande',
      nit: '901.901.234-8'
    },
    {
      email: 'manizales@vetpro.co',
      name: 'Centro Veterinario Los Nevados',
      city: 'Manizales',
      phone: '+57 6 887 6543',
      address: 'Carrera 23 #62-10, Palogrande',
      nit: '901.012.345-9'
    }
  ];

  const clinicsMap = new Map<string, string>();
  for (const c of clinicsData) {
    const clinic = await prisma.clinic.upsert({
      where: { email: c.email },
      update: {
        name: c.name,
        city: c.city,
        phone: c.phone,
        address: c.address,
        nit: c.nit
      },
      create: {
        email: c.email,
        name: c.name,
        city: c.city,
        phone: c.phone,
        address: c.address,
        nit: c.nit,
        plan: 'pro'
      }
    });
    clinicsMap.set(c.city, clinic.id);
  }

  // ─────────────────────────────────────────────
  // 2. Veterinarios por Ciudad y Especialidad
  // ─────────────────────────────────────────────
  const vetsData = [
    // 1. Bogotá - Liliana Gómez (Medicina General, Dermatología, Nutrición)
    {
      user: {
        email: 'liliana@vetpro.co',
        firstName: 'Liliana',
        lastName: 'Gómez',
        phone: '+57 300 123 4567',
        documentType: 'CC',
        documentNumber: '1018472910',
        address: 'Carrera 15 #85-30, Bogotá',
        avatarUrl: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Bogotá',
      profile: {
        professionalCard: 'COMVEZCOL-28491',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Medicina General', 'Dermatología', 'Nutrición y Dietética'],
        bio: 'Médica Veterinaria con más de 8 años de experiencia en atención integral, dermatología felina/canina y urgencias domiciliarias. Enfoque amable y sin estrés.',
        modalities: ['domicilio', 'consultorio'],
        consultationPrice: 65000,
        homeVisitPrice: 85000,
        coverageZones: ['Usaquén', 'Chapinero', 'Suba', 'Teusaquillo', 'Chía', 'Cedritos'],
        rating: 4.95,
        reviewCount: 3,
        isPublic: true,
        isFeatured: true,
        whatsappNumber: '573001234567'
      },
      reviews: [
        {
          tutorName: 'Carlos Mendoza',
          rating: 5,
          comment: 'Excelente atención a domicilio. Llegó muy puntual con todo su equipo y mi gato Tom no se estresó en lo más mínimo durante la vacunación.',
          serviceType: 'domicilio'
        },
        {
          tutorName: 'María Fernanda Ríos',
          rating: 5,
          comment: 'Solucionó el problema de dermatitis de Toby que llevaba 6 meses sin mejorar con otros doctores. Super profesional y empática.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Alejandro Restrepo',
          rating: 5,
          comment: 'Me encantó el seguimiento por la plataforma y la historia clínica digital que me compartió. 10 de 10.',
          serviceType: 'domicilio'
        }
      ]
    },

    // 2. Bogotá - Juan Pablo Duarte (Cardiología, Medicina General)
    {
      user: {
        email: 'juanpablo@vetpro.co',
        firstName: 'Juan Pablo',
        lastName: 'Duarte',
        phone: '+57 310 456 7890',
        documentType: 'CC',
        documentNumber: '80145229',
        address: 'Calle 122 #18A-24, Bogotá',
        avatarUrl: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Bogotá',
      profile: {
        professionalCard: 'COMVEZCOL-19482',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Cardiología', 'Medicina General'],
        bio: 'Especialista en cardiología clínica y ecocardiografía Doppler veterinaria con 10 años de trayectoria diagnosticando cardiopatías caninas y felinas.',
        modalities: ['consultorio', 'domicilio'],
        consultationPrice: 75000,
        homeVisitPrice: 95000,
        coverageZones: ['Santa Bárbara', 'Rosales', 'Pontevedra', 'Colina Campestre'],
        rating: 4.9,
        reviewCount: 2,
        isPublic: true,
        isFeatured: false,
        whatsappNumber: '573104567890'
      },
      reviews: [
        {
          tutorName: 'Mariana Silva',
          rating: 5,
          comment: 'Detectó a tiempo un soplo en mi poodle de 11 años. Su ecocardio fue súper minucioso y nos dio mucha tranquilidad.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Héctor Cardona',
          rating: 5,
          comment: 'Puntualidad impecable en la visita domiciliaria. Trajo equipo portátil de ecografía muy moderno.',
          serviceType: 'domicilio'
        }
      ]
    },

    // 3. Medellín - Laura Cardona (Medicina Felina, Cirugía, Medicina General)
    {
      user: {
        email: 'vet@vetpro.co',
        firstName: 'Laura',
        lastName: 'Cardona',
        phone: '+57 311 987 6543',
        documentType: 'CC',
        documentNumber: '1037648291',
        address: 'Carrera 43A #1-50, Medellín',
        avatarUrl: 'https://images.unsplash.com/photo-1594824813583-832c3f87fa3f?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Medellín',
      profile: {
        professionalCard: 'COMVEZCOL-31902',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Medicina Felina', 'Cirugía', 'Medicina General'],
        bio: 'Especialista en medicina felina Cat-Friendly, ultrasonido abdominal y cirugía de tejidos blandos. Manejo respetuoso y libre de miedo.',
        modalities: ['consultorio', 'domicilio'],
        consultationPrice: 60000,
        homeVisitPrice: 80000,
        coverageZones: ['El Poblado', 'Laureles', 'Envigado', 'Sabaneta', 'Bello'],
        rating: 5.0,
        reviewCount: 2,
        isPublic: true,
        isFeatured: true,
        whatsappNumber: '573119876543'
      },
      reviews: [
        {
          tutorName: 'Daniela Ospina',
          rating: 5,
          comment: 'La mejor veterinaria de gatos en Medellín. Mi gata suele ser agresiva pero con la Dra. Laura estuvo súper tranquila.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Julián Morales',
          rating: 5,
          comment: 'Excelente ecografía y diagnóstico certero a tiempo para mi perrita Luna.',
          serviceType: 'domicilio'
        }
      ]
    },

    // 4. Medellín - Carlos Mario Restrepo (Cirugía, Medicina General)
    {
      user: {
        email: 'carlos.restrepo@vetpro.co',
        firstName: 'Carlos Mario',
        lastName: 'Restrepo',
        phone: '+57 312 654 9870',
        documentType: 'CC',
        documentNumber: '71294812',
        address: 'Circular 4 #73-20, Medellín',
        avatarUrl: 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Medellín',
      profile: {
        professionalCard: 'COMVEZCOL-24150',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Cirugía', 'Medicina General'],
        bio: 'Cirujano veterinario con diplomado en cirugía reconstructiva y manejo avanzado del dolor posoperatorio. Consultorio equipado con quirófano moderno.',
        modalities: ['consultorio', 'domicilio'],
        consultationPrice: 70000,
        homeVisitPrice: 90000,
        coverageZones: ['Laureles', 'Belén', 'Conquistadores', 'Estadio'],
        rating: 4.85,
        reviewCount: 2,
        isPublic: true,
        isFeatured: false,
        whatsappNumber: '573126549870'
      },
      reviews: [
        {
          tutorName: 'Santiago Vélez',
          rating: 5,
          comment: 'Operó a mi bulldog de una hernia con excelentes resultados y recuperación súper rápida.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Paula Andrea Gómez',
          rating: 5,
          comment: 'Muy claro en sus explicaciones, nos dio seguimiento constante los días posteriores a la cirugía.',
          serviceType: 'consultorio'
        }
      ]
    },

    // 5. Cali - Valentina Ortiz (Oftalmología, Medicina General, Dermatología)
    {
      user: {
        email: 'valentina.ortiz@vetpro.co',
        firstName: 'Valentina',
        lastName: 'Ortiz',
        phone: '+57 316 789 1234',
        documentType: 'CC',
        documentNumber: '1144029481',
        address: 'Avenida 6 Norte #24N-15, Cali',
        avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Cali',
      profile: {
        professionalCard: 'COMVEZCOL-33019',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Oftalmología', 'Medicina General', 'Dermatología'],
        bio: 'Especialista en oftalmología veterinaria, microcirugía corneal y tratamiento de glaucoma y cataratas en mascotas.',
        modalities: ['domicilio', 'consultorio'],
        consultationPrice: 65000,
        homeVisitPrice: 85000,
        coverageZones: ['Ciudad Jardín', 'Granada', 'San Antonio', 'Pance', 'El Peñón'],
        rating: 4.95,
        reviewCount: 2,
        isPublic: true,
        isFeatured: true,
        whatsappNumber: '573167891234'
      },
      reviews: [
        {
          tutorName: 'Isabella Castillo',
          rating: 5,
          comment: 'Salvó el ojito de mi shih-tzu que tenía una úlcera profunda. La mejor oftalmóloga de Cali.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Rodrigo Echeverry',
          rating: 5,
          comment: 'La visita a domicilio fue muy completa. Trajo lámpara de hendidura y tonómetro para medir la presión ocular.',
          serviceType: 'domicilio'
        }
      ]
    },

    // 6. Cali - Mateo Sánchez (PENDIENTE ANTIFRAUDE / ADMIN)
    {
      user: {
        email: 'mateo@vetpro.co',
        firstName: 'Mateo',
        lastName: 'Sánchez',
        phone: '+57 315 555 7890',
        documentType: 'CC',
        documentNumber: '1143892014',
        address: 'Calle 18 #105-05, Cali',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Cali',
      profile: {
        professionalCard: 'COMVEZCOL-40118-PEND',
        verificationStatus: 'pending' as const,
        verificationNotes: 'Documento subido pendiente de cotejo con registro oficial COMVEZCOL.',
        specialties: ['Cirugía', 'Medicina General'],
        bio: 'Médico veterinario con diplomado en traumatología y ortopedia en animales de compañía.',
        modalities: ['consultorio'],
        consultationPrice: 70000,
        homeVisitPrice: null,
        coverageZones: ['Granada', 'Ciudad Jardín', 'Pance'],
        rating: 5.0,
        reviewCount: 0,
        isPublic: false,
        isFeatured: false,
        whatsappNumber: '573155557890'
      },
      reviews: []
    },

    // 7. Barranquilla - Sofía Valderrama (Dermatología, Medicina Felina, Medicina General)
    {
      user: {
        email: 'sofia.valderrama@vetpro.co',
        firstName: 'Sofía',
        lastName: 'Valderrama',
        phone: '+57 301 234 5678',
        documentType: 'CC',
        documentNumber: '1042481902',
        address: 'Carrera 53 #76-120, Barranquilla',
        avatarUrl: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Barranquilla',
      profile: {
        professionalCard: 'COMVEZCOL-15820',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Dermatología', 'Medicina Felina', 'Medicina General'],
        bio: 'Dermatóloga veterinaria con amplia experiencia en dermatitis alérgicas tropicales, atopia y otitis recurrentes en la costa caribe.',
        modalities: ['domicilio', 'consultorio'],
        consultationPrice: 55000,
        homeVisitPrice: 75000,
        coverageZones: ['Alto Prado', 'Villa Country', 'Riomar', 'El Golf', 'Puerto Colombia'],
        rating: 4.9,
        reviewCount: 2,
        isPublic: true,
        isFeatured: true,
        whatsappNumber: '573012345678'
      },
      reviews: [
        {
          tutorName: 'Beatriz De la Hoz',
          rating: 5,
          comment: 'Controló la pioderma severa de mi golden retriever cuando nadie más daba con el chiste. Muy recomendada.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Alfonso Char',
          rating: 5,
          comment: 'Puntual en la visita a domicilio en Villa Country, muy cariñosa con las mascotas.',
          serviceType: 'domicilio'
        }
      ]
    },

    // 8. Bucaramanga - Camilo Rueda (Odontología, Medicina General)
    {
      user: {
        email: 'camilo.rueda@vetpro.co',
        firstName: 'Camilo',
        lastName: 'Rueda',
        phone: '+57 318 890 1234',
        documentType: 'CC',
        documentNumber: '91528491',
        address: 'Calle 48 #33-19, Bucaramanga',
        avatarUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Bucaramanga',
      profile: {
        professionalCard: 'COMVEZCOL-27641',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Odontología', 'Medicina General'],
        bio: 'Especialista en odontología veterinaria: profilaxis ultrasónica sin dolor, endodoncia preventiva y extracciones complejas para caninos y felinos.',
        modalities: ['consultorio', 'domicilio'],
        consultationPrice: 60000,
        homeVisitPrice: 80000,
        coverageZones: ['Cabecera', 'Sotomayor', 'Cañaveral', 'Floridablanca'],
        rating: 4.88,
        reviewCount: 2,
        isPublic: true,
        isFeatured: false,
        whatsappNumber: '573188901234'
      },
      reviews: [
        {
          tutorName: 'Tatiana Suárez',
          rating: 5,
          comment: 'Le hizo limpieza dental a mi yorkie viejito con monitoreo anestésico impecable. Despertó súper bien.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Mauricio Prada',
          rating: 5,
          comment: 'Excelente médico, nos dio recomendaciones para el cuidado del sarro que realmente han funcionado.',
          serviceType: 'domicilio'
        }
      ]
    },

    // 9. Pereira - Santiago Morales (Nutrición y Dietética, Medicina General)
    {
      user: {
        email: 'santiago.morales@vetpro.co',
        firstName: 'Santiago',
        lastName: 'Morales',
        phone: '+57 314 345 6789',
        documentType: 'CC',
        documentNumber: '1088294819',
        address: 'Avenida Circunvalar #12-45, Pereira',
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Pereira',
      profile: {
        professionalCard: 'COMVEZCOL-38102',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Nutrición y Dietética', 'Medicina General'],
        bio: 'Nutricionista clínico veterinario. Formulación de dietas naturales balanceadas (BARF) y prescripción para patologías renales y digestivas crónicas.',
        modalities: ['domicilio', 'consultorio'],
        consultationPrice: 50000,
        homeVisitPrice: 70000,
        coverageZones: ['Circunvalar', 'Pinares', 'Álamos', 'Dosquebradas', 'Cerritos'],
        rating: 4.95,
        reviewCount: 2,
        isPublic: true,
        isFeatured: false,
        whatsappNumber: '573143456789'
      },
      reviews: [
        {
          tutorName: 'Gloria Inés Henao',
          rating: 5,
          comment: 'Gracias a su dieta personalizada mi schnauzer bajó de peso y sus triglicéridos se normalizaron por completo.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Diego Marín',
          rating: 5,
          comment: 'Muy buena atención domiciliaria en Pinares. Nos explicó paso a paso la transición a comida natural.',
          serviceType: 'domicilio'
        }
      ]
    },

    // 10. Cartagena - Mariana Echeverri (Cirugía, Medicina Felina, Medicina General)
    {
      user: {
        email: 'mariana.echeverri@vetpro.co',
        firstName: 'Mariana',
        lastName: 'Echeverri',
        phone: '+57 317 654 3210',
        documentType: 'CC',
        documentNumber: '1047481920',
        address: 'Carrera 3 #8-45, Cartagena',
        avatarUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Cartagena',
      profile: {
        professionalCard: 'COMVEZCOL-22941',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Cirugía', 'Medicina Felina', 'Medicina General'],
        bio: 'Atención personalizada médica y quirúrgica para felinos y caninos con enfoque en medicina preventiva, bienestar y cirugía de tejidos blandos.',
        modalities: ['domicilio', 'consultorio'],
        consultationPrice: 60000,
        homeVisitPrice: 80000,
        coverageZones: ['Bocagrande', 'Castillogrande', 'Manga', 'Crespo', 'Zona Norte'],
        rating: 4.9,
        reviewCount: 2,
        isPublic: true,
        isFeatured: false,
        whatsappNumber: '573176543210'
      },
      reviews: [
        {
          tutorName: 'Lorenzo Pardo',
          rating: 5,
          comment: 'La mejor atención en Bocagrande. Atendió de urgencia a mi gato a domicilio un domingo en la noche.',
          serviceType: 'domicilio'
        },
        {
          tutorName: 'Natalia Torres',
          rating: 5,
          comment: 'Esterilizó a mis dos gatitas y cicatrizaron en tiempo récord sin complicaciones.',
          serviceType: 'consultorio'
        }
      ]
    },

    // 11. Manizales - Felipe Castro (Cardiología, Oftalmología, Medicina General)
    {
      user: {
        email: 'felipe.castro@vetpro.co',
        firstName: 'Felipe',
        lastName: 'Castro',
        phone: '+57 313 456 7891',
        documentType: 'CC',
        documentNumber: '1053748291',
        address: 'Carrera 23 #62-10, Manizales',
        avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=300'
      },
      city: 'Manizales',
      profile: {
        professionalCard: 'COMVEZCOL-30514',
        verificationStatus: 'verified' as const,
        verifiedBy: 'system',
        specialties: ['Cardiología', 'Oftalmología', 'Medicina General'],
        bio: 'Cardiólogo y médico generalista dedicado al diagnóstico integral, monitoreo de presión arterial y seguimiento cardiorrespiratorio en pacientes geriátricos.',
        modalities: ['consultorio', 'domicilio'],
        consultationPrice: 55000,
        homeVisitPrice: 75000,
        coverageZones: ['Palogrande', 'La Florida', 'Milán', 'Chipre'],
        rating: 4.92,
        reviewCount: 2,
        isPublic: true,
        isFeatured: false,
        whatsappNumber: '573134567891'
      },
      reviews: [
        {
          tutorName: 'María Eugenia Arias',
          rating: 5,
          comment: 'Excelente control del soplo de mi perrita de 13 años. El Dr. Felipe es muy calmado y atento.',
          serviceType: 'consultorio'
        },
        {
          tutorName: 'Gabriel Londoño',
          rating: 5,
          comment: 'Diagnóstico acertado de ojo seco y tratamiento efectivo. Muy buen servicio.',
          serviceType: 'domicilio'
        }
      ]
    }
  ];

  for (const item of vetsData) {
    const clinicId = clinicsMap.get(item.city) || Array.from(clinicsMap.values())[0];

    const user = await prisma.user.upsert({
      where: { email: item.user.email },
      update: {
        firstName: item.user.firstName,
        lastName: item.user.lastName,
        role: 'vet',
        phone: item.user.phone,
        documentType: item.user.documentType,
        documentNumber: item.user.documentNumber,
        address: item.user.address,
        avatarUrl: item.user.avatarUrl,
        active: true,
        profileCompleted: true
      },
      create: {
        clinicId,
        email: item.user.email,
        firstName: item.user.firstName,
        lastName: item.user.lastName,
        passwordHash: defaultPassword,
        role: 'vet',
        phone: item.user.phone,
        documentType: item.user.documentType,
        documentNumber: item.user.documentNumber,
        address: item.user.address,
        avatarUrl: item.user.avatarUrl,
        active: true,
        profileCompleted: true
      }
    });

    const profile = await prisma.vetProfile.upsert({
      where: { userId: user.id },
      update: {
        clinicId,
        professionalCard: item.profile.professionalCard,
        verificationStatus: item.profile.verificationStatus,
        verificationNotes: (item.profile as any).verificationNotes || null,
        verifiedAt: item.profile.verificationStatus === 'verified' ? new Date() : null,
        verifiedBy: item.profile.verifiedBy,
        specialties: item.profile.specialties,
        bio: item.profile.bio,
        modalities: item.profile.modalities,
        consultationPrice: item.profile.consultationPrice,
        homeVisitPrice: item.profile.homeVisitPrice,
        city: item.city,
        coverageZones: item.profile.coverageZones,
        rating: item.profile.rating,
        reviewCount: item.profile.reviewCount,
        isPublic: item.profile.isPublic,
        isFeatured: item.profile.isFeatured,
        whatsappNumber: item.profile.whatsappNumber,
        subscriptionStatus: 'active'
      },
      create: {
        userId: user.id,
        clinicId,
        professionalCard: item.profile.professionalCard,
        verificationStatus: item.profile.verificationStatus,
        verificationNotes: (item.profile as any).verificationNotes || null,
        verifiedAt: item.profile.verificationStatus === 'verified' ? new Date() : null,
        verifiedBy: item.profile.verifiedBy,
        specialties: item.profile.specialties,
        bio: item.profile.bio,
        modalities: item.profile.modalities,
        consultationPrice: item.profile.consultationPrice,
        homeVisitPrice: item.profile.homeVisitPrice,
        city: item.city,
        coverageZones: item.profile.coverageZones,
        rating: item.profile.rating,
        reviewCount: item.profile.reviewCount,
        isPublic: item.profile.isPublic,
        isFeatured: item.profile.isFeatured,
        whatsappNumber: item.profile.whatsappNumber,
        subscriptionStatus: 'active'
      }
    });

    if (item.reviews.length > 0) {
      await prisma.vetReview.deleteMany({ where: { vetProfileId: profile.id } });
      await prisma.vetReview.createMany({
        data: item.reviews.map((r) => ({
          vetProfileId: profile.id,
          tutorName: r.tutorName,
          rating: r.rating,
          comment: r.comment,
          serviceType: r.serviceType
        }))
      });
    }
  }

  console.log(`✅ Directorio Marketplace poblado exitosamente con ${vetsData.length} veterinarios en 8 ciudades colombianas.`);
}

async function main() {
  await seedMarketplace();
}

if (process.argv[1]?.endsWith('seed_marketplace.ts') || process.argv[1]?.endsWith('seed_marketplace.js')) {
  main()
    .catch((e) => {
      console.error('❌ Error seeding marketplace:', e);
      process.exit(1);
    })
    .finally(async () => {
      await defaultPrisma.$disconnect();
    });
}
