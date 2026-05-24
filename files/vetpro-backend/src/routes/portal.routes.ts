import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { tutorAuthMiddleware, TutorAuthRequest } from '../middleware/tutorAuth.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vetpro_super_secret_signing_key_2026_dev';
const isDevelopment = process.env.NODE_ENV !== 'production';

// Helper para asegurar que exista una clínica y tutor demo en desarrollo
async function ensureDemoTutor(phone: string) {
  if (!isDevelopment) return null;

  // 1. Obtener o crear clínica demo
  let clinic = await prisma.clinic.findFirst({
    where: { id: 'dev-clinic' }
  });

  if (!clinic) {
    clinic = await prisma.clinic.create({
      data: {
        id: 'dev-clinic',
        name: 'Clínica Veterinaria San José',
        nit: '900.123.456-7',
        phone: '+57 1 601 2345',
        email: 'contacto@veterinariasanjose.co',
        address: 'Calle 100 #15-30',
        city: 'Bogotá',
        plan: 'pro',
        aiMinutesUsed: 0,
        aiMinutesLimit: 120
      }
    });
  }

  // 2. Obtener o crear sucursal demo
  let branch = await prisma.branch.findFirst({
    where: { clinicId: clinic.id }
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        id: 'dev-branch',
        clinicId: clinic.id,
        name: 'Sede Principal',
        address: 'Calle 100 #15-30',
        phone: '+57 1 601 2345',
        active: true
      }
    });
  }

  // 3. Crear veterinarios demo si no existen (para agendamiento)
  const defaultVet = await prisma.user.findFirst({
    where: { role: 'vet', clinicId: clinic.id }
  });

  if (!defaultVet) {
    await prisma.user.create({
      data: {
        id: 'dev-vet',
        clinicId: clinic.id,
        branchId: branch.id,
        firstName: 'Laura',
        lastName: 'Cardona',
        email: 'vet@vetpro.co',
        passwordHash: 'vet123_hash_placeholder',
        role: 'vet',
        active: true
      }
    });
  }

  // 4. Mapear datos demo de tutores y mascotas basándonos en el teléfono
  const demoData: Record<string, { tutor: any, patients: any[] }> = {
    '3124567890': {
      tutor: { firstName: 'Carlos', lastName: 'Gómez', email: 'carlos@gmail.com', phone: '3124567890', documentId: '1018234567', address: 'Calle 100 #15-30, Bogotá' },
      patients: [
        { name: 'Toby', species: 'dog', breed: 'Golden Retriever', sex: 'male', sterilized: true, weight: 32.5, chipId: '985112003456789', photoUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=150', status: 'active' },
        { name: 'Kira', species: 'dog', breed: 'Bulldog Francés', sex: 'female', sterilized: false, weight: 11.8, chipId: '985112003456781', status: 'active' }
      ]
    },
    '3157891234': {
      tutor: { firstName: 'María', lastName: 'Rodríguez', email: 'maria@outlook.com', phone: '3157891234', documentId: '52345678', address: 'Carrera 7 #45-12, Medellín' },
      patients: [
        { name: 'Luna', species: 'cat', breed: 'Siamés', sex: 'female', sterilized: true, weight: 4.2, chipId: '985112003456780', photoUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&q=80&w=150', status: 'active' },
        { name: 'Mimi', species: 'cat', breed: 'Persa', sex: 'female', sterilized: true, weight: 3.8, status: 'active' }
      ]
    },
    '3209876543': {
      tutor: { firstName: 'Diana', lastName: 'Pérez', email: 'diana@hotmail.com', phone: '3209876543', documentId: '1032456789', address: 'Av. El Poblado #3-45, Envigado' },
      patients: [
        { name: 'Copito', species: 'rabbit', breed: 'Angora', sex: 'male', sterilized: false, weight: 2.1, status: 'active' }
      ]
    }
  };

  const selectedDemo = demoData[phone];
  if (!selectedDemo) return null;

  // 5. Upsert del tutor
  let tutor = await prisma.tutor.findFirst({
    where: { phone, clinicId: clinic.id }
  });

  if (!tutor) {
    tutor = await prisma.tutor.create({
      data: {
        ...selectedDemo.tutor,
        clinicId: clinic.id
      }
    });

    // 6. Crear pacientes demo asociados
    for (const pet of selectedDemo.patients) {
      const patient = await prisma.patient.create({
        data: {
          ...pet,
          clinicId: clinic.id,
          tutorId: tutor.id
        }
      });

      // Agregar algunas consultas médicas ficticias
      await prisma.medicalRecord.create({
        data: {
          clinicId: clinic.id,
          patientId: patient.id,
          vetId: defaultVet ? defaultVet.id : 'dev-vet',
          title: 'Consulta Preventiva General',
          anamnesis: 'Paciente asiste a chequeo general. El tutor reporta comportamiento y apetito normales.',
          physicalExam: 'Temperatura: 38.5C. Mucosas rosadas, hidratado. Auscultación cardiopulmonar normal.',
          diagnosis: 'Paciente sano y en peso óptimo.',
          treatment: 'Continuar con dieta habitual. Desparasitación al día.',
          type: 'consultation',
          createdAt: new Date(Date.now() - 30 * 86400000)
        }
      });

      // Agregar vacunas de demostración
      await prisma.vaccine.create({
        data: {
          patientId: patient.id,
          name: 'Vacuna Antirrábica Nobivac',
          brand: 'MSD Animal Health',
          batch: 'RAB-2026A',
          appliedAt: new Date(Date.now() - 60 * 86400000),
          nextDueAt: new Date(Date.now() + 305 * 86400000),
          vetId: defaultVet ? defaultVet.id : 'dev-vet',
          notes: 'Aplicación intramuscular sin reacciones adversas.'
        }
      });
      
      await prisma.vaccine.create({
        data: {
          patientId: patient.id,
          name: 'Pentavalente Canina / Triple Felina',
          brand: 'Zoetis',
          batch: 'PT-9988X',
          appliedAt: new Date(Date.now() - 120 * 86400000),
          nextDueAt: new Date(Date.now() + 245 * 86400000),
          vetId: defaultVet ? defaultVet.id : 'dev-vet',
          notes: 'Refuerzo anual recomendado.'
        }
      });
    }
  }

  return tutor;
}

// POST /auth/magic-link — Enviar o generar link de acceso mágico
router.post('/auth/magic-link', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'El número de teléfono es obligatorio.' });
  }

  try {
    // 1. Buscar tutor
    let tutor = await prisma.tutor.findFirst({
      where: { phone }
    });

    // 2. Si no existe, intentar asegurar demo en desarrollo
    if (!tutor && isDevelopment) {
      tutor = await ensureDemoTutor(phone);
    }

    if (!tutor) {
      return res.status(404).json({ error: 'Tutor no registrado con este número telefónico.' });
    }

    // 3. Generar token de magic link temporal (expira en 1 hora)
    const token = jwt.sign(
      {
        id: tutor.id,
        phone: tutor.phone,
        clinicId: tutor.clinicId,
        role: 'tutor'
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const magicLink = `http://localhost:4200/portal/auth?token=${token}`;

    return res.json({
      success: true,
      message: 'Enlace de acceso generado exitosamente.',
      // Se retorna directamente para que en desarrollo local puedan dar click
      magicLink: isDevelopment ? magicLink : null
    });
  } catch (error) {
    console.error('Error al solicitar link mágico de tutor:', error);
    return res.status(500).json({ error: 'Error al procesar el enlace de acceso.' });
  }
});

// POST /auth/verify — Intercambiar enlace mágico por token de sesión
router.post('/auth/verify', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token de acceso no proporcionado.' });
  }

  try {
    // 1. Verificar token temporal
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      phone: string;
      clinicId: string;
      role: string;
    };

    if (decoded.role !== 'tutor') {
      return res.status(403).json({ error: 'Token inválido para acceso de tutor.' });
    }

    // 2. Buscar tutor y clínica
    const tutor = await prisma.tutor.findUnique({
      where: { id: decoded.id }
    });

    const clinic = await prisma.clinic.findUnique({
      where: { id: decoded.clinicId },
      select: { name: true, phone: true, email: true, address: true, city: true, logoUrl: true }
    });

    if (!tutor) {
      return res.status(404).json({ error: 'Tutor ya no existe en el sistema.' });
    }

    // 3. Generar JWT de sesión prolongado (7 días)
    const sessionToken = jwt.sign(
      {
        id: tutor.id,
        phone: tutor.phone,
        clinicId: tutor.clinicId,
        role: 'tutor'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token: sessionToken,
      tutor: {
        id: tutor.id,
        firstName: tutor.firstName,
        lastName: tutor.lastName,
        phone: tutor.phone,
        email: tutor.email,
        address: tutor.address
      },
      clinic
    });
  } catch (error) {
    console.error('Error al verificar token de tutor:', error);
    return res.status(401).json({ error: 'El enlace de acceso es inválido o ha expirado.' });
  }
});

// GET /patients — Listado de mascotas del tutor
router.get('/patients', tutorAuthMiddleware as any, async (req: TutorAuthRequest, res: Response) => {
  const tutorId = req.tutor?.id;

  try {
    const patients = await prisma.patient.findMany({
      where: { tutorId },
      orderBy: { name: 'asc' }
    });

    return res.json(patients);
  } catch (error) {
    console.error('Error al obtener mascotas de tutor:', error);
    return res.status(500).json({ error: 'Error al obtener tus mascotas.' });
  }
});

// GET /patients/:id/history — Historial médico y vacunas de una mascota
router.get('/patients/:id/history', tutorAuthMiddleware as any, async (req: TutorAuthRequest, res: Response) => {
  const tutorId = req.tutor?.id;
  const { id } = req.params;

  try {
    const patient = await prisma.patient.findFirst({
      where: { id, tutorId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Mascota no encontrada o no pertenece a tu perfil.' });
    }

    // Historial clínico
    const medicalRecords = await prisma.medicalRecord.findMany({
      where: { patientId: id },
      include: {
        vet: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Vacunas
    const vaccines = await prisma.vaccine.findMany({
      where: { patientId: id },
      include: {
        vet: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: { appliedAt: 'desc' }
    });

    return res.json({
      patient,
      medicalRecords,
      vaccines
    });
  } catch (error) {
    console.error('Error al obtener historia clínica de mascota:', error);
    return res.status(500).json({ error: 'Error al obtener el historial médico de tu mascota.' });
  }
});

// GET /booking/vets — Veterinarios de la clínica del tutor
router.get('/booking/vets', tutorAuthMiddleware as any, async (req: TutorAuthRequest, res: Response) => {
  const clinicId = req.tutor?.clinicId;

  try {
    const vets = await prisma.user.findMany({
      where: {
        clinicId,
        role: { in: ['vet', 'admin'] },
        active: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true
      },
      orderBy: { firstName: 'asc' }
    });

    return res.json(vets);
  } catch (error) {
    console.error('Error al listar veterinarios para booking:', error);
    return res.status(500).json({ error: 'Error al obtener la lista de veterinarios.' });
  }
});

// POST /booking — Agendar cita online por tutor
router.post('/booking', tutorAuthMiddleware as any, async (req: TutorAuthRequest, res: Response) => {
  const clinicId = req.tutor?.clinicId;
  const tutorId = req.tutor?.id;
  const { patientId, vetId, serviceType, scheduledAt, reason } = req.body;

  if (!clinicId || !tutorId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  if (!patientId || !vetId || !serviceType || !scheduledAt) {
    return res.status(400).json({ error: 'Mascota, veterinario, tipo de servicio y horario son requeridos.' });
  }

  try {
    // 1. Validar que el paciente pertenece al tutor
    const patient = await prisma.patient.findFirst({
      where: { id: patientId, tutorId }
    });

    if (!patient) {
      return res.status(400).json({ error: 'Mascota inválida.' });
    }

    // 2. Buscar sucursal por defecto de la clínica
    const branch = await prisma.branch.findFirst({
      where: { clinicId, active: true }
    });

    if (!branch) {
      return res.status(400).json({ error: 'No se puede procesar el agendamiento (Sucursal inactiva).' });
    }

    // 3. Crear cita
    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        branchId: branch.id,
        patientId,
        vetId,
        serviceType,
        scheduledAt: new Date(scheduledAt),
        durationMinutes: 30,
        status: 'scheduled',
        reason: reason || 'Consulta agendada online',
        notes: 'Agendada en línea por el tutor de la mascota.'
      },
      include: {
        patient: true,
        vet: {
          select: { firstName: true, lastName: true }
        }
      }
    });

    return res.status(201).json(appointment);
  } catch (error) {
    console.error('Error al agendar cita online:', error);
    return res.status(500).json({ error: 'Error interno al registrar la cita.' });
  }
});

export { router as PORTAL_ROUTES };
