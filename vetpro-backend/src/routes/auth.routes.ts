import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { MailerService } from '../services/mailer.service.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET!;

if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET env var is not set. Refusing to start.');
  process.exit(1);
}

function toUserResponse(user: {
  id: string;
  clinicId: string;
  branchId?: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  active: boolean;
}) {
  return {
    id: user.id,
    clinicId: user.clinicId,
    branchId: user.branchId ?? null,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    active: user.active
  };
}

function signToken(user: {
  id: string;
  email: string;
  role: string;
  clinicId: string;
  branchId?: string | null;
}) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      branchId: user.branchId
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /auth/register (Registro de nueva clínica o veterinario independiente)
router.post('/register', async (req, res) => {
  const { clinicName, businessType, firstName, lastName, email, password, phone, city, nit } = req.body;

  if (!clinicName || !firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const bType = businessType === 'independent_vet' ? 'independent_vet' : 'clinic';

    // Crear clínica, sede base y usuario administrador en una transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: clinicName,
          businessType: bType,
          email,
          phone: phone || '+57 300 000 0000',
          address: bType === 'independent_vet' ? 'Atención Domiciliaria / Móvil' : 'Sede Principal',
          city: city || 'Medellín',
          nit: nit || null,
          plan: 'pro'
        }
      });

      const branch = await tx.branch.create({
        data: {
          clinicId: clinic.id,
          name: bType === 'independent_vet' ? 'Operación Móvil' : 'Sede Principal',
          address: bType === 'independent_vet' ? 'Cobertura Móvil' : 'Calle Principal #1',
          phone: phone || '+57 300 000 0000',
          email
        }
      });

      const user = await tx.user.create({
        data: {
          clinicId: clinic.id,
          branchId: bType === 'independent_vet' ? null : branch.id,
          firstName,
          lastName,
          email,
          passwordHash,
          role: 'admin',
          active: true
        }
      });

      // Crear catálogo básico de laboratorio para la nueva clínica
      const defaultTests = [
        { code: 'HEM-LEU', name: 'Leucocitos Totales', category: 'hematology', unit: 'x10^3/uL', canineRefMin: 6.0, canineRefMax: 17.0, felineRefMin: 5.5, felineRefMax: 19.5, salePrice: 15000 },
        { code: 'HEM-HCT', name: 'Hematocrito (PCV)', category: 'hematology', unit: '%', canineRefMin: 37.0, canineRefMax: 55.0, felineRefMin: 24.0, felineRefMax: 45.0, salePrice: 15000 },
        { code: 'BIO-CREA', name: 'Creatinina Sérica', category: 'biochemistry', unit: 'mg/dL', canineRefMin: 0.5, canineRefMax: 1.5, felineRefMin: 0.8, felineRefMax: 2.1, salePrice: 22000 },
        { code: 'BIO-ALT', name: 'ALT / GPT Hepática', category: 'biochemistry', unit: 'U/L', canineRefMin: 10.0, canineRefMax: 100.0, felineRefMin: 12.0, felineRefMax: 130.0, salePrice: 25000 }
      ];

      for (const t of defaultTests) {
        await tx.labTestCatalog.create({
          data: { ...t, category: t.category as any, clinicId: clinic.id }
        });
      }

      return { clinic, user };
    });

    const token = signToken(result.user);

    return res.status(201).json({
      message: 'Cuenta creada exitosamente.',
      token,
      user: toUserResponse(result.user),
      clinic: result.clinic
    });
  } catch (error: any) {
    console.error('Error en /auth/register:', error);
    return res.status(500).json({ error: 'Error al registrar la cuenta.' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'El correo y la contraseña son obligatorios.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { clinic: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (!user.active) {
      return res.status(403).json({ error: 'Usuario inactivo. Contacte al administrador.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    return res.json({
      token: signToken(user),
      user: toUserResponse(user),
      clinic: user.clinic
    });
  } catch (error) {
    console.error('Error en /auth/login:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.json({
      user: toUserResponse(user),
      clinic: user.clinic
    });
  } catch (error) {
    console.error('Error en /auth/me:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// ─────────────────────────────────────────────
// 🏢 CONFIGURACIÓN DE EMPRESA (SEDES VS VET INDEPENDIENTE)
// ─────────────────────────────────────────────

// GET /auth/clinic (Consultar datos de la clínica o profesional)
router.get('/clinic', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        branches: {
          select: { id: true, name: true, address: true, phone: true, active: true }
        }
      }
    });

    if (!clinic) return res.status(404).json({ error: 'Empresa no encontrada.' });
    return res.json(clinic);
  } catch (error: any) {
    console.error('Error al consultar empresa:', error);
    return res.status(500).json({ error: 'Error al consultar la empresa.' });
  }
});

// PATCH /auth/clinic (Actualizar modalidad: Clínica con sedes vs Vet Independiente)
router.patch('/clinic', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  const { name, businessType, nit, phone, address, city } = req.body;

  try {
    const updated = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(name ? { name } : {}),
        ...(businessType ? { businessType } : {}),
        ...(nit !== undefined ? { nit } : {}),
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
        ...(city ? { city } : {})
      },
      include: {
        branches: {
          select: { id: true, name: true, address: true, phone: true, active: true }
        }
      }
    });

    return res.json({
      message: 'Configuración de empresa actualizada exitosamente.',
      clinic: updated
    });
  } catch (error: any) {
    console.error('Error al actualizar empresa:', error);
    return res.status(500).json({ error: 'Error al actualizar la configuración de la empresa.' });
  }
});

// ─────────────────────────────────────────────
// 👥 GESTIÓN DE USUARIOS DEL EQUIPO (ADMIN ONLY)
// ─────────────────────────────────────────────

// GET /auth/users (Listar usuarios de la clínica)
router.get('/users', authMiddleware as any, roleMiddleware(['admin', 'vet', 'assistant', 'receptionist']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const users = await prisma.user.findMany({
      where: { clinicId },
      include: {
        branch: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(users.map(u => ({
      id: u.id,
      clinicId: u.clinicId,
      branchId: u.branchId,
      branchName: u.branch?.name || 'Todas las sedes (Global)',
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      role: u.role,
      avatarUrl: u.avatarUrl,
      active: u.active,
      createdAt: u.createdAt
    })));
  } catch (error: any) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ error: 'Error al consultar los usuarios del equipo.' });
  }
});

// POST /auth/users (Crear nuevo usuario / empleado)
router.post('/users', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  const { firstName, lastName, email, password, role, branchId } = req.body;

  if (!firstName || !lastName || !email || !password || !role) {
    return res.status(400).json({ error: 'Nombre, apellido, correo, contraseña y rol son obligatorios.' });
  }

  const validRoles = ['admin', 'vet', 'assistant', 'receptionist', 'walker', 'groomer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      error: `Rol inválido. Los roles permitidos son: ${validRoles.join(', ')}`
    });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return res.status(400).json({ error: 'Ya existe un usuario registrado con este correo electrónico.' });
    }

    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, clinicId }
      });
      if (!branch) return res.status(404).json({ error: 'Sucursal no encontrada.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        clinicId,
        branchId: branchId || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash,
        role: role as any,
        active: true
      },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    // Consultar datos de la clínica para el correo de bienvenida
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    });

    // Enviar correo con credenciales de acceso de forma asíncrona / segura
    let emailSent = false;
    try {
      emailSent = await MailerService.sendNewUserCredentials({
        to: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        clinicName: clinic?.name || 'VetPro Cloud',
        role: newUser.role,
        branchName: newUser.branch?.name || null,
        passwordPlain: password
      });
    } catch (mailError) {
      console.error('Error al enviar correo de bienvenida con credenciales:', mailError);
    }

    return res.status(201).json({
      message: emailSent
        ? 'Usuario creado exitosamente. Se ha enviado un correo con las credenciales de acceso.'
        : 'Usuario creado exitosamente.',
      emailSent,
      user: {
        id: newUser.id,
        clinicId: newUser.clinicId,
        branchId: newUser.branchId,
        branchName: newUser.branch?.name || 'Todas las sedes (Global)',
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        role: newUser.role,
        active: newUser.active
      }
    });
  } catch (error: any) {
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error al registrar el nuevo usuario.' });
  }
});

// PATCH /auth/users/:id (Modificar rol, sucursal o estado activo)
router.patch('/users/:id', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const currentUserId = req.user?.id;
  const { id } = req.params;
  const { firstName, lastName, role, branchId, active } = req.body;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const user = await prisma.user.findFirst({
      where: { id, clinicId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Evitar que el administrador se desactive a sí mismo
    if (user.id === currentUserId && active === false) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia cuenta de administrador.' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName ? { firstName: firstName.trim() } : {}),
        ...(lastName ? { lastName: lastName.trim() } : {}),
        ...(role ? { role: role as any } : {}),
        ...(branchId !== undefined ? { branchId: branchId || null } : {}),
        ...(active !== undefined ? { active: Boolean(active) } : {})
      },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    return res.json({
      message: 'Usuario actualizado exitosamente.',
      user: {
        id: updated.id,
        clinicId: updated.clinicId,
        branchId: updated.branchId,
        branchName: updated.branch?.name || 'Todas las sedes (Global)',
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        role: updated.role,
        active: updated.active
      }
    });
  } catch (error: any) {
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// PATCH /auth/users/:id/reset-password (Restablecer contraseña de empleado)
router.patch('/users/:id/reset-password', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const user = await prisma.user.findFirst({
      where: { id, clinicId }
    });

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash }
    });

    // Enviar correo de notificación de restablecimiento
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId }
    });

    let emailSent = false;
    try {
      emailSent = await MailerService.sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        clinicName: clinic?.name || 'VetPro Cloud',
        newPasswordPlain: newPassword
      });
    } catch (mailError) {
      console.error('Error al enviar correo de restablecimiento de contraseña:', mailError);
    }

    return res.json({
      message: emailSent
        ? 'Contraseña actualizada exitosamente y enviada al correo del usuario.'
        : 'Contraseña actualizada exitosamente.',
      emailSent
    });
  } catch (error: any) {
    console.error('Error al restablecer contraseña:', error);
    return res.status(500).json({ error: 'Error al cambiar la contraseña del usuario.' });
  }
});

// GET /auth/smtp-status (Consultar estado del servidor de correos)
router.get('/smtp-status', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const result = await MailerService.verifyConnection();
  return res.json({
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
    smtpUser: process.env.SMTP_USER || null,
    verified: result.ok,
    message: result.message
  });
});

// POST /auth/smtp-test (Probar envío de correo de prueba)
router.post('/smtp-test', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const { recipient } = req.body;
  const target = recipient || req.user?.email;

  if (!target) {
    return res.status(400).json({ error: 'Correo de destinatario requerido.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user!.id }
  });

  const clinic = await prisma.clinic.findUnique({
    where: { id: req.user!.clinicId }
  });

  const success = await MailerService.sendNewUserCredentials({
    to: target,
    firstName: user?.firstName || 'Usuario',
    lastName: user?.lastName || 'Administrador',
    clinicName: clinic?.name || 'VetPro Cloud',
    role: 'admin',
    branchName: 'Sede Principal',
    passwordPlain: 'Prueba123*'
  });

  if (success) {
    return res.json({ success: true, message: `Correo de prueba enviado exitosamente a: ${target}` });
  } else {
    return res.status(500).json({
      success: false,
      error: 'No se pudo enviar el correo de prueba. Verifica las credenciales SMTP en el archivo .env.'
    });
  }
});

export const AUTH_ROUTES = router;
