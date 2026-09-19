import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';
import { roleMiddleware } from '../middleware/role.js';
import { MailerService } from '../services/mailer.service.js';
import { AuthService, toUserResponse } from '../services/auth.service.js';
import { TokenService } from '../services/token.service.js';
import { prisma } from '../config/database.js';

const router = Router();

// Helper para configurar la cookie de refresh token
function setRefreshTokenCookie(res: Response, refreshToken: string) {
  res.cookie('vetpro_refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
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
    const result = await AuthService.registerClinic({
      clinicName,
      businessType: bType,
      firstName,
      lastName,
      email,
      password,
      phone,
      municipioId,
      nit,
      documentType,
      documentNumber
    });

    const refreshToken = TokenService.signRefreshToken({ id: result.user.id, clinicId: result.user.clinicId });
    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
      message: 'Cuenta creada exitosamente.',
      token: result.token,
      user: result.user,
      clinic: result.clinic
    });
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
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
    const result = await AuthService.login(email, password);
    const refreshToken = TokenService.signRefreshToken({ id: result.user.id, clinicId: result.user.clinicId });
    setRefreshTokenCookie(res, refreshToken);

    return res.json(result);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error en /auth/login:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /auth/refresh (Renovación de token de acceso mediante refresh token en cookie)
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.vetpro_refresh_token || req.body?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token no proporcionado.' });
  }

  try {
    const decoded = TokenService.verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { clinic: true }
    });

    if (!user || !user.active) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo.' });
    }

    const newToken = TokenService.signStaff({
      id: user.id,
      email: user.email,
      role: user.role,
      clinicId: user.clinicId,
      branchId: user.branchId
    });

    // Rotación automática del refresh token
    const newRefreshToken = TokenService.signRefreshToken({ id: user.id, clinicId: user.clinicId });
    setRefreshTokenCookie(res, newRefreshToken);

    return res.json({
      token: newToken,
      user: toUserResponse(user),
      clinic: user.clinic
    });
  } catch (error) {
    return res.status(401).json({ error: 'Refresh token inválido o expirado.' });
  }
});

// POST /auth/logout (Cierre de sesión y revocación del refresh token)
router.post('/logout', (_req, res) => {
  res.clearCookie('vetpro_refresh_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  return res.json({ message: 'Sesión cerrada exitosamente.' });
});

// GET /auth/activation/:token (Consultar datos básicos antes de activar)
router.get('/activation/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const info = await AuthService.getActivationInfo(token);
    return res.json(info);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error en /auth/activation/:token:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /auth/activate (Define contraseña real y activa la cuenta)
router.post('/activate', async (req, res) => {
  const { token, password } = req.body;

  if (!token || !password) {
    return res.status(400).json({ error: 'Token y contraseña son obligatorios.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const result = await AuthService.activateAccount(token, password);
    return res.json({
      message: 'Cuenta activada exitosamente.',
      token: result.token,
      user: result.user,
      clinic: result.clinic
    });
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error en /auth/activate:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /auth/me
router.get('/me', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const result = await AuthService.getUserProfile(userId);
    return res.json(result);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error en /auth/me:', error);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PATCH /auth/complete-profile
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
    const user = await AuthService.completeProfile(userId, {
      documentType,
      documentNumber,
      phone,
      address,
      municipioId,
      birthDate
    });

    return res.json({
      message: 'Perfil completado exitosamente.',
      user
    });
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al completar perfil:', error);
    return res.status(500).json({ error: 'Error al guardar los datos del perfil.' });
  }
});

// GET /auth/clinic
router.get('/clinic', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const clinic = await AuthService.getClinicConfig(clinicId);
    return res.json(clinic);
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al consultar empresa:', error);
    return res.status(500).json({ error: 'Error al consultar la empresa.' });
  }
});

// PATCH /auth/clinic
router.patch('/clinic', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const updated = await AuthService.updateClinicConfig(clinicId, req.body);
    return res.json({
      message: 'Configuración de empresa actualizada exitosamente.',
      clinic: updated
    });
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al actualizar empresa:', error);
    return res.status(500).json({ error: 'Error al actualizar la configuración de la empresa.' });
  }
});

// GET /auth/users
router.get('/users', authMiddleware as any, roleMiddleware(['admin', 'vet', 'assistant', 'receptionist']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const users = await AuthService.listClinicUsers(clinicId);
    return res.json(users);
  } catch (error: any) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).json({ error: 'Error al consultar los usuarios del equipo.' });
  }
});

// POST /auth/users
router.post('/users', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  const { firstName, lastName, email, role, branchId } = req.body;
  if (!firstName || !lastName || !email || !role) {
    return res.status(400).json({ error: 'Nombre, apellido, correo y rol son obligatorios.' });
  }

  const validRoles = ['admin', 'vet', 'assistant', 'receptionist', 'walker', 'groomer'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: `Rol inválido. Los roles permitidos son: ${validRoles.join(', ')}` });
  }

  try {
    const appUrl = process.env.APP_URL || 'http://localhost:4201';
    const { newUser, activationLink, emailSent } = await AuthService.createClinicUser(clinicId, {
      firstName,
      lastName,
      email,
      role,
      branchId
    }, appUrl);

    return res.status(201).json({
      message: emailSent
        ? 'Usuario creado exitosamente. Se ha enviado un correo para que active su cuenta.'
        : 'Usuario creado, pero no se pudo enviar el correo. Comparte este enlace de activación manualmente.',
      emailSent,
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
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al crear usuario:', error);
    return res.status(500).json({ error: 'Error al registrar el nuevo usuario.' });
  }
});

// PATCH /auth/users/:id
router.patch('/users/:id', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const currentUserId = req.user?.id;
  const { id } = req.params;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });

  try {
    const updated = await AuthService.updateClinicUser(clinicId, id, currentUserId || '', req.body);
    return res.json({
      message: 'Usuario actualizado exitosamente.',
      user: updated
    });
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al actualizar usuario:', error);
    return res.status(500).json({ error: 'Error al actualizar usuario.' });
  }
});

// PATCH /auth/users/:id/reset-password
router.patch('/users/:id/reset-password', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const clinicId = req.user?.clinicId;
  const { id } = req.params;
  const { newPassword } = req.body;

  if (!clinicId) return res.status(401).json({ error: 'No autorizado.' });
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const { emailSent } = await AuthService.resetUserPassword(clinicId, id, newPassword);
    return res.json({
      message: emailSent
        ? 'Contraseña actualizada exitosamente y enviada al correo del usuario.'
        : 'Contraseña actualizada exitosamente.',
      emailSent
    });
  } catch (error: any) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error al restablecer contraseña:', error);
    return res.status(500).json({ error: 'Error al cambiar la contraseña del usuario.' });
  }
});

// GET /auth/smtp-status
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

// POST /auth/smtp-test
router.post('/smtp-test', authMiddleware as any, roleMiddleware(['admin']) as any, async (req: AuthRequest, res: Response) => {
  const { recipient } = req.body;
  const target = recipient || req.user?.email;

  if (!target) {
    return res.status(400).json({ error: 'Correo de destinatario requerido.' });
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinicId } });

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
