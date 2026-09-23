import { Router, Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import {
  VerificationStatus,
  PatientSpecies,
  PatientSex,
  AppointmentStatus,
  ServiceModality
} from '@prisma/client';

const router = Router();

// Directorio para documentos de verificación del veterinario
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'marketplace');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.bin';
      cb(null, `${crypto.randomUUID()}${ext}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Formato no soportado. Debe ser PDF, JPG, PNG o WEBP.'));
    }
    cb(null, true);
  }
});

// ─────────────────────────────────────────────
// 🌐 RUTAS PÚBLICAS (Directorio Web - Tipo Sittsy / DiDi)
// ─────────────────────────────────────────────

/**
 * GET /api/v1/marketplace/vets
 * Búsqueda y listado público de veterinarios verificados
 */
router.get('/vets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { city, specialty, modality, search, page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const where: any = {
      verificationStatus: VerificationStatus.verified,
      isPublic: true
    };

    if (city && typeof city === 'string' && city.trim() !== '') {
      where.city = { contains: city.trim(), mode: 'insensitive' };
    }

    if (specialty && typeof specialty === 'string' && specialty.trim() !== '') {
      where.specialties = { has: specialty.trim() };
    }

    if (modality && typeof modality === 'string' && modality.trim() !== '') {
      where.modalities = { has: modality.trim() };
    }

    if (search && typeof search === 'string' && search.trim() !== '') {
      const term = search.trim();
      where.OR = [
        { user: { firstName: { contains: term, mode: 'insensitive' } } },
        { user: { lastName: { contains: term, mode: 'insensitive' } } },
        { bio: { contains: term, mode: 'insensitive' } },
        { clinic: { name: { contains: term, mode: 'insensitive' } } }
      ];
    }

    const [total, vets] = await Promise.all([
      prisma.vetProfile.count({ where }),
      prisma.vetProfile.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { isFeatured: 'desc' },
          { rating: 'desc' },
          { reviewCount: 'desc' }
        ],
        select: {
          id: true,
          professionalCard: true,
          verificationStatus: true,
          specialties: true,
          bio: true,
          modalities: true,
          consultationPrice: true,
          homeVisitPrice: true,
          city: true,
          coverageZones: true,
          rating: true,
          reviewCount: true,
          isFeatured: true,
          whatsappNumber: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              avatarUrl: true
            }
          },
          clinic: {
            select: {
              name: true,
              city: true
            }
          }
        }
      })
    ]);

    res.json({
      data: vets,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al consultar el directorio de veterinarios' });
  }
});

/**
 * GET /api/v1/marketplace/vets/:id
 * Detalle público de un veterinario específico
 */
router.get('/vets/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const vet = await prisma.vetProfile.findUnique({
      where: { id },
      select: {
        id: true,
        professionalCard: true,
        verificationStatus: true,
        specialties: true,
        bio: true,
        modalities: true,
        consultationPrice: true,
        homeVisitPrice: true,
        city: true,
        coverageZones: true,
        rating: true,
        reviewCount: true,
        isFeatured: true,
        isPublic: true,
        whatsappNumber: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true
          }
        },
        clinic: {
          select: {
            name: true,
            phone: true,
            city: true
          }
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            tutorName: true,
            rating: true,
            comment: true,
            serviceType: true,
            createdAt: true
          }
        }
      }
    });

    if (!vet) {
      res.status(404).json({ error: 'Perfil de veterinario no encontrado' });
      return;
    }

    res.json(vet);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al consultar el perfil del veterinario' });
  }
});

/**
 * POST /api/v1/marketplace/vets/:id/reviews
 * Crear reseña con calificación para un veterinario
 */
const CreateReviewSchema = z.object({
  tutorName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  rating: z.number().int().min(1).max(5, 'La calificación debe ser de 1 a 5 estrellas'),
  comment: z.string().min(4, 'El comentario debe tener al menos 4 caracteres'),
  serviceType: z.string().optional()
});

router.post('/vets/:id/reviews', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = CreateReviewSchema.parse(req.body);

    const vet = await prisma.vetProfile.findUnique({
      where: { id }
    });

    if (!vet) {
      res.status(404).json({ error: 'Veterinario no encontrado' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const review = await tx.vetReview.create({
        data: {
          vetProfileId: id,
          tutorName: body.tutorName,
          rating: body.rating,
          comment: body.comment,
          serviceType: body.serviceType || 'Consulta General'
        }
      });

      const stats = await tx.vetReview.aggregate({
        where: { vetProfileId: id },
        _avg: { rating: true },
        _count: { id: true }
      });

      const newRating = stats._avg.rating ? Math.round(stats._avg.rating * 10) / 10 : body.rating;
      const newCount = stats._count.id;

      await tx.vetProfile.update({
        where: { id },
        data: {
          rating: newRating,
          reviewCount: newCount
        }
      });

      return { review, newRating, newCount };
    });

    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues[0]?.message || 'Datos de reseña inválidos' });
      return;
    }
    res.status(500).json({ error: 'Error al registrar la reseña' });
  }
});

/**
 * POST /api/v1/marketplace/vets/:id/appointments
 * Agendar cita desde el directorio web con canalización anti-saturación a WhatsApp
 */
const BookAppointmentSchema = z.object({
  tutorName: z.string().min(2, 'El nombre del tutor es obligatorio'),
  tutorPhone: z.string().min(7, 'El teléfono de contacto es obligatorio'),
  tutorEmail: z.string().email('Correo inválido').optional().nullable().or(z.literal('')),
  patientName: z.string().min(1, 'El nombre de la mascota es obligatorio'),
  patientSpecies: z.string().default('dog'),
  modality: z.enum(['home_visit', 'clinic']).default('clinic'),
  scheduledAt: z.string().min(5, 'La fecha y hora son obligatorias'),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  reason: z.string().min(3, 'El motivo de consulta es obligatorio'),
  notes: z.string().optional().nullable()
});

router.post('/vets/:id/appointments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = BookAppointmentSchema.parse(req.body);

    const vet = await prisma.vetProfile.findUnique({
      where: { id },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        clinic: { select: { id: true, name: true, phone: true, address: true } }
      }
    });

    if (!vet) {
      res.status(404).json({ error: 'Veterinario no encontrado' });
      return;
    }

    const clinicId = vet.clinicId;
    const vetUserId = vet.userId;

    // 1. Obtener o crear sucursal por defecto
    let branch = await prisma.branch.findFirst({
      where: { clinicId, active: true }
    });
    if (!branch) {
      branch = await prisma.branch.create({
        data: {
          clinicId,
          name: 'Sede Principal',
          address: vet.clinic.address || 'Principal',
          phone: vet.clinic.phone || '3000000000'
        }
      });
    }

    // 2. Obtener o crear Tutor
    let tutor = await prisma.tutor.findFirst({
      where: { clinicId, phone: body.tutorPhone, deletedAt: null }
    });
    if (!tutor) {
      const parts = body.tutorName.trim().split(' ');
      const firstName = parts[0] || 'Tutor';
      const lastName = parts.slice(1).join(' ') || 'Marketplace';

      tutor = await prisma.tutor.create({
        data: {
          clinicId,
          firstName,
          lastName,
          phone: body.tutorPhone,
          email: body.tutorEmail || null,
          address: body.address || null
        }
      });
    }

    // 3. Mapear especie de la mascota
    let speciesEnum: PatientSpecies = PatientSpecies.dog;
    const sLower = body.patientSpecies.toLowerCase();
    if (sLower.includes('cat') || sLower.includes('gat') || sLower.includes('felin')) {
      speciesEnum = PatientSpecies.cat;
    } else if (sLower.includes('conej') || sLower.includes('rab')) {
      speciesEnum = PatientSpecies.rabbit;
    } else if (sLower.includes('ave') || sLower.includes('pajar')) {
      speciesEnum = PatientSpecies.bird;
    }

    // 4. Obtener o crear Paciente
    let patient = await prisma.patient.findFirst({
      where: {
        clinicId,
        tutorId: tutor.id,
        name: { equals: body.patientName.trim(), mode: 'insensitive' },
        deletedAt: null
      }
    });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          clinicId,
          tutorId: tutor.id,
          name: body.patientName.trim(),
          species: speciesEnum,
          sex: PatientSex.male
        }
      });
    }

    // 5. Determinar tarifa
    const amount =
      body.modality === 'home_visit'
        ? vet.homeVisitPrice || vet.consultationPrice
        : vet.consultationPrice;

    const scheduledDate = new Date(body.scheduledAt);

    // 6. Crear Cita en el sistema de la clínica
    const appointment = await prisma.appointment.create({
      data: {
        clinicId,
        branchId: branch.id,
        vetId: vetUserId,
        patientId: patient.id,
        isNewPatient: false,
        serviceType: body.modality === 'home_visit' ? 'Consulta a Domicilio' : 'Consulta General',
        modality: body.modality === 'home_visit' ? ServiceModality.home_visit : ServiceModality.clinic,
        scheduledAt: scheduledDate,
        durationMinutes: 45,
        status: AppointmentStatus.scheduled,
        reason: body.reason,
        notes: body.notes
          ? `${body.notes} | Cita Web Marketplace`
          : `Agendado vía Marketplace Web. Tutor: ${body.tutorName} (Tel: ${body.tutorPhone})`,
        address: body.address || null,
        city: body.city || vet.city || null,
        amountCharged: amount
      }
    });

    // 7. Generar enlace inteligente de WhatsApp estructurado (Anti-Burnout)
    const rawNumber = vet.whatsappNumber || vet.user.phone || vet.clinic.phone || '';
    const cleanPhone = rawNumber.replace(/[^0-9]/g, '');

    const dateFormatted = scheduledDate.toLocaleString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const modalityText = body.modality === 'home_visit' ? 'A Domicilio 🚗' : 'En Consultorio 🏥';
    const addressLine = body.address ? `\n📍 *Dirección:* ${body.address}` : '';

    const text = `¡Hola Dr(a). ${vet.user.firstName}! He agendado una consulta médica en VetPro:

🆔 *Reserva:* #${appointment.id.slice(0, 8).toUpperCase()}
🐾 *Mascota:* ${patient.name} (${speciesEnum === PatientSpecies.cat ? 'Gato' : 'Perro'})
👤 *Tutor:* ${body.tutorName} (Tel: ${body.tutorPhone})
📅 *Fecha:* ${dateFormatted}
🩺 *Modalidad:* ${modalityText}${addressLine}
📝 *Motivo:* ${body.reason}
💰 *Tarifa Estimada:* $${amount.toLocaleString('es-CO')} COP

Quedo atento(a) a su confirmación. ¡Muchas gracias!`;

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

    res.status(201).json({
      success: true,
      appointmentId: appointment.id,
      reservationCode: appointment.id.slice(0, 8).toUpperCase(),
      patientId: patient.id,
      patientName: patient.name,
      tutorName: body.tutorName,
      scheduledAt: appointment.scheduledAt,
      amountCharged: amount,
      modality: body.modality,
      whatsappUrl,
      vetName: `${vet.user.firstName} ${vet.user.lastName}`
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues[0]?.message || 'Datos de cita inválidos' });
      return;
    }
    res.status(500).json({ error: 'Error al agendar la cita médica' });
  }
});

// ─────────────────────────────────────────────
// 🔒 RUTAS PRIVADAS DEL VETERINARIO (Autenticado)
// ─────────────────────────────────────────────

const UpdateProfileSchema = z.object({
  professionalCard: z.string().optional(),
  bio: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  modalities: z.array(z.string()).optional(),
  consultationPrice: z.number().nonnegative().optional(),
  homeVisitPrice: z.number().nonnegative().nullable().optional(),
  city: z.string().optional(),
  coverageZones: z.array(z.string()).optional(),
  whatsappNumber: z.string().optional(),
  payoutBank: z.string().nullable().optional(),
  payoutAccount: z.string().nullable().optional(),
  isPublic: z.boolean().optional()
});

/**
 * GET /api/v1/marketplace/profile/earnings
 * Consultar balance, comisiones e ingresos acumulados del veterinario en el marketplace
 */
router.get('/profile/earnings', authMiddleware as any, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const clinicId = req.user!.clinicId;

    const profile = await prisma.vetProfile.findUnique({
      where: { userId }
    });

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        vetId: userId
      },
      include: {
        patient: {
          select: {
            name: true,
            species: true,
            tutor: { select: { firstName: true, lastName: true, phone: true } }
          }
        }
      },
      orderBy: { scheduledAt: 'desc' },
      take: 20
    });

    const totalAppointments = appointments.length;
    const completedAppointments = appointments.filter(a => a.status === 'completed' || a.status === 'confirmed').length;
    const grossRevenue = appointments.reduce((sum, a) => sum + (a.amountCharged || 0), 0);
    const platformFeeRate = 0.15; // 15% comisión de plataforma
    const platformFee = Math.round(grossRevenue * platformFeeRate);
    const netEarnings = grossRevenue - platformFee;

    res.json({
      totalAppointments,
      completedAppointments,
      grossRevenue,
      platformFeeRate,
      platformFee,
      netEarnings,
      payoutBank: profile?.payoutBank || null,
      payoutAccount: profile?.payoutAccount || null,
      appointments: appointments.map(a => ({
        id: a.id,
        scheduledAt: a.scheduledAt,
        status: a.status,
        modality: a.modality,
        amount: a.amountCharged || 0,
        patientName: a.patient?.name || a.prospectName || 'Mascota',
        species: a.patient?.species || 'dog',
        tutorName: a.patient?.tutor ? `${a.patient.tutor.firstName} ${a.patient.tutor.lastName}`.trim() : (a.prospectName || 'Tutor')
      }))
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Error al consultar ingresos del veterinario' });
  }
});

/**
 * GET /api/v1/marketplace/profile/me
 * Obtener mi perfil de veterinario para el marketplace
 */
router.get('/profile/me', authMiddleware as any, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const clinicId = req.user!.clinicId;

    let profile = await prisma.vetProfile.findUnique({
      where: { userId },
      include: {
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!profile) {
      // Auto-crear draft
      profile = await prisma.vetProfile.create({
        data: {
          userId,
          clinicId,
          isPublic: false,
          verificationStatus: VerificationStatus.pending
        },
        include: {
          reviews: true
        }
      });
    }

    res.json(profile);
  } catch (err: any) {
    res.status(500).json({ error: 'Error al obtener el perfil de veterinario' });
  }
});

/**
 * PUT /api/v1/marketplace/profile/me
 * Actualizar datos del perfil de veterinario
 */
router.put('/profile/me', authMiddleware as any, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const clinicId = req.user!.clinicId;
    const body = UpdateProfileSchema.parse(req.body);

    const profile = await prisma.vetProfile.upsert({
      where: { userId },
      update: {
        ...body,
        updatedAt: new Date()
      },
      create: {
        userId,
        clinicId,
        ...body,
        verificationStatus: VerificationStatus.pending
      }
    });

    res.json(profile);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.issues[0]?.message || 'Datos inválidos' });
      return;
    }
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
});

/**
 * POST /api/v1/marketplace/profile/documents
 * Subida de tarjeta profesional (COMVEZCOL) y cédula
 */
router.post(
  '/profile/documents',
  authMiddleware as any,
  upload.fields([
    { name: 'cardDocument', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 }
  ]),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const clinicId = req.user!.clinicId;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      const updateData: any = {
        verificationStatus: VerificationStatus.pending,
        updatedAt: new Date()
      };

      if (files?.cardDocument?.[0]) {
        updateData.cardDocumentUrl = `/api/uploads/marketplace/${files.cardDocument[0].filename}`;
      }
      if (files?.idDocument?.[0]) {
        updateData.idDocumentUrl = `/api/uploads/marketplace/${files.idDocument[0].filename}`;
      }

      const profile = await prisma.vetProfile.upsert({
        where: { userId },
        update: updateData,
        create: {
          userId,
          clinicId,
          ...updateData
        }
      });

      res.json({
        message: 'Documentos cargados con éxito. Tu perfil está pendiente de verificación.',
        profile
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Error al subir los documentos de verificación' });
    }
  }
);

// ─────────────────────────────────────────────
// 🛡️ RUTAS ADMINISTRATIVAS DE VERIFICACIÓN (Admin)
// ─────────────────────────────────────────────

/**
 * GET /api/v1/marketplace/admin/verifications
 * Panel para auditar solicitudes de veterinarios
 */
router.get(
  '/admin/verifications',
  authMiddleware as any,
  roleMiddleware(['admin']),
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const profiles = await prisma.vetProfile.findMany({
        orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              avatarUrl: true
            }
          },
          clinic: {
            select: {
              name: true,
              city: true
            }
          }
        }
      });

      res.json(profiles);
    } catch (err: any) {
      res.status(500).json({ error: 'Error al consultar solicitudes de verificación' });
    }
  }
);

/**
 * PUT /api/v1/marketplace/admin/verifications/:id
 * Aprobar o rechazar la verificación de un veterinario
 */
const VerifySchema = z.object({
  status: z.nativeEnum(VerificationStatus),
  notes: z.string().optional()
});

router.put(
  '/admin/verifications/:id',
  authMiddleware as any,
  roleMiddleware(['admin']),
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, notes } = VerifySchema.parse(req.body);

      const profile = await prisma.vetProfile.update({
        where: { id },
        data: {
          verificationStatus: status,
          verificationNotes: notes || null,
          verifiedAt: status === VerificationStatus.verified ? new Date() : null,
          verifiedBy: req.user!.id,
          // Si se verifica y tiene tarjeta, permitir que sea público por defecto
          ...(status === VerificationStatus.verified ? { isPublic: true } : {})
        }
      });

      res.json({
        message: `Estado de verificación actualizado a: ${status}`,
        profile
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: err.issues[0]?.message });
        return;
      }
      res.status(500).json({ error: 'Error al actualizar estado de verificación' });
    }
  }
);

export const MARKETPLACE_ROUTES = router;
