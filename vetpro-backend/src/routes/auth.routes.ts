import { Router, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { MailerService } from '../services/mailer.service.js';
import { TokenService } from '../services/token.service.js';

const router = Router();

// Token de activación/recuperación — nunca se escribe ni se copia a mano,
// solo viaja dentro de un enlace, así que no hay forma de transcribirlo mal.
function generateActivationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

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
  profileCompleted?: boolean;
  documentType?: string | null;
  documentNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  departamentoCode?: string | null;
  municipioId?: string | null;
  birthDate?: Date | null;
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
    active: user.active,
    profileCompleted: user.profileCompleted ?? false,
    documentType: user.documentType ?? null,
    documentNumber: user.documentNumber ?? null,
    phone: user.phone ?? null,
    address: user.address ?? null,
    departamentoCode: user.departamentoCode ?? null,
    municipioId: user.municipioId ?? null,
    birthDate: user.birthDate ?? null
  };
}

function signToken(user: {
  id: string;
  email: string;
  role: string;
  clinicId: string;
  branchId?: string | null;
}) {
  return TokenService.signStaff({
    id: user.id,
    email: user.email,
    role: user.role,
    clinicId: user.clinicId,
    branchId: user.branchId
  });
}

// POST /auth/register (Registro de nueva clínica o veterinario independiente)
router.post('/register', async (req, res) => {
  const { clinicName, businessType, firstName, lastName, password, phone, municipioId, nit, documentType, documentNumber } = req.body;
  const email: string | undefined = req.body.email?.trim().toLowerCase();

  if (!clinicName || !firstName || !lastName || !email || !password || !municipioId) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben ser completados, incluyendo el municipio.' });
  }

  const bType = businessType === 'independent_vet' ? 'independent_vet' : 'clinic';

  if (bType === 'clinic' && !nit) {
    return res.status(400).json({ error: 'El NIT es obligatorio para registrar una clínica.' });
  }
  const validDocTypes = ['CC', 'CE', 'PA', 'TI'];
  if (bType === 'independent_vet' && (!documentNumber || !validDocTypes.includes(documentType))) {
    return res.status(400).json({ error: 'El documento de identidad es obligatorio para un veterinario independiente.' });
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'El correo electrónico ya está registrado.' });
    }

    const municipio = await prisma.municipio.findUnique({ where: { id: municipioId } });
    if (!municipio) {
      return res.status(400).json({ error: 'El municipio seleccionado no es válido.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Crear clínica, sede base y usuario administrador en una transacción atómica
    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: clinicName,
          businessType: bType,
          email,
          phone: phone || '+57 300 000 0000',
          address: bType === 'independent_vet' ? 'Atención Domiciliaria / Móvil' : 'Sede Principal',
          city: municipio.nombre,
          departamentoCode: municipio.deptoCode,
          municipioId: municipio.id,
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
          active: true,
          phone: phone || null,
          documentType: bType === 'independent_vet' ? documentType : null,
          documentNumber: bType === 'independent_vet' ? documentNumber : null,
          departamentoCode: municipio.deptoCode,
          municipioId: municipio.id,
          // El admin ya provee sus datos en este mismo registro + el onboarding de la clínica
          profileCompleted: true
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

// GET /auth/activation/:token (Consultar datos básicos antes de activar — para mostrar "Hola, Nombre")
router.get('/activation/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const user = await prisma.user.findUnique({ where: { activationToken: token } });
    if (!user || !user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
      return res.status(404).json({ error: 'El enlace de activación no es válido o ya expiró.' });
    }

    return res.json({ firstName: user.firstName, lastName: user.lastName, email: user.email });
  } catch (error) {
    console.error('Error en /auth/activation/:token:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /auth/activate (Define la contraseña real y activa la cuenta — reemplaza el flujo de contraseña temporal)
router.post('/activate', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token y contraseña son obligatorios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { activationToken: token },
      include: { clinic: true }
    });

    if (!user || !user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
      return res.status(404).json({ error: 'El enlace de activación no es válido o ya expiró. Pide a tu administrador que te reenvíe la invitación.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const activated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        activationToken: null,
        activationTokenExpiresAt: null
      },
      include: { clinic: true }
    });

    return res.json({
      message: 'Cuenta activada exitosamente.',
      token: signToken(activated),
      user: toUserResponse(activated),
      clinic: activated.clinic
    });
  } catch (error) {
    console.error('Error en /auth/activate:', error);
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

// PATCH /auth/complete-profile (El propio usuario termina de ingresar sus datos tras el primer login)
router.patch('/complete-profile', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autorizado.' });

  const { documentType, documentNumber, phone, address, municipioId, birthDate } = req.body;

  const validDocTypes = ['CC', 'CE', 'PA', 'TI'];
  if (!documentType || !validDocTypes.includes(documentType)) {
    return res.status(400).json({ error: `Tipo de documento inválido. Valores permitidos: ${validDocTypes.join(', ')}` });
  }
  if (!documentNumber || !phone || !address || !municipioId) {
    return res.status(400).json({ error: 'Documento, teléfono, dirección y municipio son obligatorios.' });
  }

  try {
    const municipio = await prisma.municipio.findUnique({ where: { id: municipioId } });
    if (!municipio) {
      return res.status(400).json({ error: 'El municipio seleccionado no es válido.' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        documentType,
        documentNumber: documentNumber.trim(),
        phone: phone.trim(),
        address: address.trim(),
        departamentoCode: municipio.deptoCode,
        municipioId: municipio.id,
        birthDate: birthDate ? new Date(birthDate) : null,
        profileCompleted: true
      }
    });

    return res.json({
      message: 'Perfil completado exitosamente.',
      user: toUserResponse(updated)
    });
  } catch (error: any) {
    console.error('Error al completar perfil:', error);
    return res.status(500).json({ error: 'Error al guardar los datos del perfil.' });
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

  const { name, businessType, nit, phone, address, municipioId } = req.body;

  try {
    let municipioData = {};
    if (municipioId) {
      const municipio = await prisma.municipio.findUnique({ where: { id: municipioId } });
      if (!municipio) return res.status(400).json({ error: 'El municipio seleccionado no es válido.' });
      municipioData = { city: municipio.nombre, departamentoCode: municipio.deptoCode, municipioId: municipio.id };
    }

    const updated = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(name ? { name } : {}),
        ...(businessType ? { businessType } : {}),
        ...(nit !== undefined ? { nit } : {}),
        ...(phone ? { phone } : {}),
        ...(address ? { address } : {}),
        ...municipioData
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

  const { firstName, lastName, email, role, branchId } = req.body;

  if (!firstName || !lastName || !email || !role) {
    return res.status(400).json({ error: 'Nombre, apellido, correo y rol son obligatorios.' });
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

    // Contraseña inservible de por sí — nadie puede loguear con esto, el
    // usuario define su propia contraseña real al activar la cuenta.
    const placeholderHash = await bcrypt.hash(crypto.randomUUID(), 10);
    const activationToken = generateActivationToken();
    const activationTokenExpiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

    const newUser = await prisma.user.create({
      data: {
        clinicId,
        branchId: branchId || null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        passwordHash: placeholderHash,
        activationToken,
        activationTokenExpiresAt,
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

    const appUrl = process.env.APP_URL || 'http://localhost:4201';
    const activationLink = `${appUrl}/auth/activate?token=${activationToken}`;

    // Enviar correo con el enlace de activación de forma asíncrona / segura
    let emailSent = false;
    try {
      emailSent = await MailerService.sendActivationLink({
        to: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        clinicName: clinic?.name || 'VetPro Cloud',
        role: newUser.role,
        branchName: newUser.branch?.name || null,
        activationLink
      });
    } catch (mailError) {
      console.error('Error al enviar correo de activación:', mailError);
    }

    return res.status(201).json({
      message: emailSent
        ? 'Usuario creado exitosamente. Se ha enviado un correo para que active su cuenta.'
        : 'Usuario creado, pero no se pudo enviar el correo. Comparte este enlace de activación manualmente.',
      emailSent,
      // Solo se expone si el correo falló — es la única forma de que el admin lo comparta.
      // A diferencia de una contraseña, un link mal copiado simplemente no carga (no hay
      // forma de que "parezca funcionar" estando mal transcrito).
      ...(emailSent ? {} : { activationLink }),
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
