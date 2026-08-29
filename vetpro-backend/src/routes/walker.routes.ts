import { Router, Response } from 'express';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware as any);

// ─────────────────────────────────────────────
// WALKERS — PERFILES
// ─────────────────────────────────────────────

// GET /api/v1/walkers
router.get('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const role = req.user?.role;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });
  if (role !== 'admin' && role !== 'vet') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol admin o vet.' });
  }

  try {
    const { active } = req.query;
    const where: any = { clinicId };
    if (active !== undefined) where.active = active === 'true';

    const walkers = await prisma.walker.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true } }
      },
      orderBy: { rating: 'desc' }
    });

    return res.json({ data: walkers, total: walkers.length });
  } catch (error) {
    console.error('[WalkerRoutes] Error al listar paseadores:', error);
    return res.status(500).json({ error: 'Error al consultar los paseadores.' });
  }
});

// POST /api/v1/walkers
router.post('/', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const role = req.user?.role;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });
  if (role !== 'admin') return res.status(403).json({ error: 'Acceso denegado. Se requiere rol admin.' });

  const { userId, bio, photoUrl, pricePerHour, maxDogs, coverageZones } = req.body;
  if (!userId) return res.status(400).json({ error: 'El campo userId es obligatorio.' });

  try {
    const user = await prisma.user.findFirst({ where: { id: userId, clinicId } });
    if (!user) return res.status(404).json({ error: 'El usuario no existe o no pertenece a su clínica.' });
    if (user.role !== 'walker') {
      return res.status(400).json({ error: 'El usuario debe tener el rol walker.' });
    }

    const walker = await prisma.walker.create({
      data: {
        clinicId,
        userId,
        bio: bio || null,
        photoUrl: photoUrl || null,
        pricePerHour: pricePerHour ?? 25000,
        maxDogs: maxDogs ?? 3,
        coverageZones: coverageZones ?? []
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } }
      }
    });

    return res.status(201).json(walker);
  } catch (error: any) {
    console.error('[WalkerRoutes] Error al crear paseador:', error);
    if (error.code === 'P2002') return res.status(409).json({ error: 'Este usuario ya tiene un perfil de paseador.' });
    return res.status(500).json({ error: 'Error al crear el perfil de paseador.' });
  }
});

// ─────────────────────────────────────────────
// WALK BOOKINGS — antes de /:id para evitar colisión Express
// ─────────────────────────────────────────────

// GET /api/v1/walkers/bookings
router.get('/bookings', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const role = req.user?.role;
  const userId = req.user?.id;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const { status, tutorId, date } = req.query;
    const where: any = { clinicId, deletedAt: null };

    if (role === 'walker') {
      const walkerProfile = await prisma.walker.findFirst({ where: { userId, clinicId } });
      if (walkerProfile) {
        where.walkerId = walkerProfile.id;
      } else {
        return res.json({ data: [], total: 0 });
      }
    }

    if (status && status !== 'all') where.status = status;
    if (tutorId) where.tutorId = String(tutorId);
    if (date) {
      const start = new Date(String(date));
      start.setHours(0, 0, 0, 0);
      const end = new Date(String(date));
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = { gte: start, lte: end };
    }

    const bookings = await prisma.walkBooking.findMany({
      where,
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        walker: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }
      },
      orderBy: { scheduledAt: 'asc' }
    });

    return res.json({ data: bookings, total: bookings.length });
  } catch (error) {
    console.error('[WalkerRoutes] Error al listar reservas:', error);
    return res.status(500).json({ error: 'Error al consultar las reservas de paseos.' });
  }
});

// POST /api/v1/walkers/bookings
router.post('/bookings', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  const { tutorId, walkerId, patientIds, scheduledAt, durationMins, address, latitude, longitude, price, notes } = req.body;

  if (!tutorId || !scheduledAt || !address || price === undefined) {
    return res.status(400).json({ error: 'tutorId, scheduledAt, address y price son obligatorios.' });
  }

  try {
    const tutor = await prisma.tutor.findFirst({ where: { id: tutorId, clinicId, deletedAt: null } });
    if (!tutor) return res.status(404).json({ error: 'Tutor no encontrado en esta clínica.' });

    if (walkerId) {
      const walker = await prisma.walker.findFirst({ where: { id: walkerId, clinicId, active: true } });
      if (!walker) return res.status(404).json({ error: 'Paseador no encontrado o inactivo.' });
    }

    const booking = await prisma.walkBooking.create({
      data: {
        clinicId,
        tutorId,
        walkerId: walkerId || null,
        patientIds: patientIds ?? [],
        scheduledAt: new Date(scheduledAt),
        durationMins: durationMins ?? 30,
        address,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        price,
        notes: notes || null,
        status: walkerId ? 'assigned' : 'requested'
      },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, phone: true } },
        walker: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }
      }
    });

    return res.status(201).json(booking);
  } catch (error) {
    console.error('[WalkerRoutes] Error al crear reserva:', error);
    return res.status(500).json({ error: 'Error al registrar la reserva de paseo.' });
  }
});

// GET /api/v1/walkers/bookings/:id
router.get('/bookings/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const booking = await prisma.walkBooking.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        walker: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }
      }
    });

    if (!booking) return res.status(404).json({ error: 'Reserva de paseo no encontrada.' });
    return res.json(booking);
  } catch (error) {
    console.error('[WalkerRoutes] Error al obtener reserva:', error);
    return res.status(500).json({ error: 'Error al obtener la reserva.' });
  }
});

// PATCH /api/v1/walkers/bookings/:id/status
router.patch('/bookings/:id/status', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const role = req.user?.role;
  const userId = req.user?.id;
  const { id } = req.params;
  const { status, walkerId, cancelReason } = req.body;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });
  if (!status) return res.status(400).json({ error: 'El campo status es obligatorio.' });

  const validStatuses = ['requested', 'assigned', 'confirmed', 'on_the_way', 'walking', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `Estado inválido. Valores: ${validStatuses.join(', ')}` });
  }

  try {
    const existing = await prisma.walkBooking.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: { walker: true }
    });

    if (!existing) return res.status(404).json({ error: 'Reserva no encontrada.' });
    if (role === 'walker' && existing.walker?.userId !== userId) {
      return res.status(403).json({ error: 'No tiene permiso para actualizar esta reserva.' });
    }

    const data: any = { status };
    if (walkerId && role === 'admin') {
      const walker = await prisma.walker.findFirst({ where: { id: walkerId, clinicId, active: true } });
      if (!walker) return res.status(404).json({ error: 'Paseador no encontrado o inactivo.' });
      data.walkerId = walkerId;
    }

    if (status === 'walking') data.startedAt = new Date();
    if (status === 'completed') data.completedAt = new Date();
    if (status === 'cancelled') {
      data.cancelledAt = new Date();
      if (cancelReason) data.cancelReason = cancelReason;
    }

    const updated = await prisma.walkBooking.update({
      where: { id },
      data,
      include: {
        tutor: { select: { id: true, firstName: true, lastName: true, phone: true } },
        walker: { include: { user: { select: { id: true, firstName: true, lastName: true } } } }
      }
    });

    if (status === 'completed' && updated.walkerId) {
      await prisma.walker.update({ where: { id: updated.walkerId }, data: { totalWalks: { increment: 1 } } });
    }

    return res.json(updated);
  } catch (error) {
    console.error('[WalkerRoutes] Error al actualizar estado:', error);
    return res.status(500).json({ error: 'Error al actualizar el estado de la reserva.' });
  }
});

// PATCH /api/v1/walkers/bookings/:id/rating
router.patch('/bookings/:id/rating', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { rating, review } = req.body;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });
  if (rating === undefined || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5.' });
  }

  try {
    const existing = await prisma.walkBooking.findFirst({ where: { id, clinicId, deletedAt: null } });
    if (!existing) return res.status(404).json({ error: 'Reserva no encontrada.' });
    if (existing.status !== 'completed') return res.status(400).json({ error: 'Solo se pueden calificar paseos completados.' });
    if (existing.rating !== null) return res.status(409).json({ error: 'Este paseo ya fue calificado.' });

    const updated = await prisma.walkBooking.update({
      where: { id },
      data: { rating: Math.round(rating), review: review || null }
    });

    if (existing.walkerId) {
      const allRatings = await prisma.walkBooking.findMany({
        where: { walkerId: existing.walkerId, rating: { not: null }, status: 'completed' },
        select: { rating: true }
      });
      const avg = allRatings.reduce((sum, b) => sum + (b.rating ?? 0), 0) / allRatings.length;
      await prisma.walker.update({ where: { id: existing.walkerId }, data: { rating: Math.round(avg * 10) / 10 } });
    }

    return res.json(updated);
  } catch (error) {
    console.error('[WalkerRoutes] Error al calificar paseo:', error);
    return res.status(500).json({ error: 'Error al registrar la calificación.' });
  }
});

// ─────────────────────────────────────────────
// /:id routes — al final para no capturar /bookings
// ─────────────────────────────────────────────

// GET /api/v1/walkers/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const walker = await prisma.walker.findFirst({
      where: { id, clinicId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true, avatarUrl: true } },
        walkBookings: { where: { deletedAt: null }, orderBy: { scheduledAt: 'desc' }, take: 10 }
      }
    });

    if (!walker) return res.status(404).json({ error: 'Paseador no encontrado.' });
    return res.json(walker);
  } catch (error) {
    console.error('[WalkerRoutes] Error al obtener paseador:', error);
    return res.status(500).json({ error: 'Error al obtener el paseador.' });
  }
});

// PUT /api/v1/walkers/:id
router.put('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const role = req.user?.role;
  const userId = req.user?.id;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const existing = await prisma.walker.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ error: 'Paseador no encontrado.' });
    if (role !== 'admin' && existing.userId !== userId) {
      return res.status(403).json({ error: 'Sin permiso para editar este perfil.' });
    }

    const { bio, photoUrl, pricePerHour, maxDogs, coverageZones, active } = req.body;
    const data: any = {};
    if (bio !== undefined) data.bio = bio;
    if (photoUrl !== undefined) data.photoUrl = photoUrl;
    if (pricePerHour !== undefined) data.pricePerHour = pricePerHour;
    if (maxDogs !== undefined) data.maxDogs = maxDogs;
    if (coverageZones !== undefined) data.coverageZones = coverageZones;
    if (active !== undefined && role === 'admin') data.active = active;

    const walker = await prisma.walker.update({
      where: { id },
      data,
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } }
    });

    return res.json(walker);
  } catch (error) {
    console.error('[WalkerRoutes] Error al actualizar paseador:', error);
    return res.status(500).json({ error: 'Error al actualizar el perfil.' });
  }
});

// DELETE /api/v1/walkers/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const role = req.user?.role;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });
  if (role !== 'admin') return res.status(403).json({ error: 'Se requiere rol admin.' });

  try {
    const existing = await prisma.walker.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ error: 'Paseador no encontrado.' });

    await prisma.walker.update({ where: { id }, data: { active: false } });
    return res.json({ message: 'Paseador desactivado exitosamente.' });
  } catch (error) {
    console.error('[WalkerRoutes] Error al desactivar paseador:', error);
    return res.status(500).json({ error: 'Error al desactivar el paseador.' });
  }
});

export const WALKER_ROUTES = router;
