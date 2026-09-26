import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { MailerService } from './mailer.service.js';
import { TokenService } from './token.service.js';

export const ACTIVATION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hora

export function generateActivationToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function toUserResponse(user: any) {
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

export function signToken(user: {
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

export class AuthService {
  static async registerClinic(data: {
    clinicName: string;
    businessType?: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    municipioId: string;
    nit?: string;
    documentType?: string;
    documentNumber?: string;
  }) {
    const email = data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw { status: 409, message: 'El correo electrónico ya está registrado.' };
    }

    const municipio = await prisma.municipio.findUnique({ where: { id: data.municipioId } });
    if (!municipio) {
      throw { status: 400, message: 'El municipio seleccionado no es válido.' };
    }

    const bType = data.businessType === 'independent_vet' ? 'independent_vet' : 'clinic';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const result = await prisma.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: data.clinicName,
          businessType: bType,
          email,
          phone: data.phone || '+57 300 000 0000',
          address: bType === 'independent_vet' ? 'Atención Domiciliaria / Móvil' : 'Sede Principal',
          city: municipio.nombre,
          departamentoCode: municipio.deptoCode,
          municipioId: municipio.id,
          nit: data.nit || null,
          plan: 'pro'
        }
      });

      const branch = await tx.branch.create({
        data: {
          clinicId: clinic.id,
          name: bType === 'independent_vet' ? 'Operación Móvil' : 'Sede Principal',
          address: bType === 'independent_vet' ? 'Cobertura Móvil' : 'Calle Principal #1',
          phone: data.phone || '+57 300 000 0000',
          email
        }
      });

      const user = await tx.user.create({
        data: {
          clinicId: clinic.id,
          branchId: bType === 'independent_vet' ? null : branch.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email,
          passwordHash,
          role: 'admin',
          active: true,
          phone: data.phone || null,
          documentType: bType === 'independent_vet' ? data.documentType : null,
          documentNumber: bType === 'independent_vet' ? data.documentNumber : null,
          departamentoCode: municipio.deptoCode,
          municipioId: municipio.id,
          profileCompleted: true
        }
      });

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
    return {
      token,
      user: toUserResponse(result.user),
      clinic: result.clinic
    };
  }

  static async login(email: string, passwordPlain: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { clinic: true }
    });

    if (!user) {
      throw { status: 401, message: 'Credenciales inválidas.' };
    }

    if (!user.active) {
      throw { status: 403, message: 'Usuario inactivo. Contacte al administrador.' };
    }

    const passwordMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!passwordMatch) {
      throw { status: 401, message: 'Credenciales inválidas.' };
    }

    return {
      token: signToken(user),
      user: toUserResponse(user),
      clinic: user.clinic
    };
  }

  static async getActivationInfo(token: string) {
    const user = await prisma.user.findUnique({ where: { activationToken: token } });
    if (!user || !user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
      throw { status: 404, message: 'El enlace no es válido o ya expiró.' };
    }

    return { firstName: user.firstName, lastName: user.lastName, email: user.email };
  }

  static async activateAccount(token: string, newPasswordPlain: string) {
    const user = await prisma.user.findUnique({
      where: { activationToken: token },
      include: { clinic: true }
    });

    if (!user || !user.activationTokenExpiresAt || user.activationTokenExpiresAt < new Date()) {
      throw {
        status: 404,
        message: 'El enlace no es válido o ya expiró. Solicita uno nuevo desde "¿Olvidaste tu contraseña?" en el inicio de sesión.'
      };
    }

    const passwordHash = await bcrypt.hash(newPasswordPlain, 10);
    const activated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        activationToken: null,
        activationTokenExpiresAt: null
      },
      include: { clinic: true }
    });

    return {
      token: signToken(activated),
      user: toUserResponse(activated),
      clinic: activated.clinic
    };
  }

  /**
   * Recuperación de contraseña iniciada por el propio usuario. Reutiliza el
   * token de activación (un enlace de un solo uso para definir contraseña).
   * Nunca revela si el correo existe: el llamador responde lo mismo siempre.
   */
  static async requestPasswordReset(emailRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, include: { clinic: true } });
    if (!user || !user.active) return;

    const resetToken = generateActivationToken();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        activationToken: resetToken,
        activationTokenExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS)
      }
    });

    const appUrl = process.env.APP_URL || 'http://localhost:4201';
    // Sin await: el tiempo de respuesta no debe delatar si el correo existe
    MailerService.sendPasswordRecoveryLink({
      to: user.email,
      firstName: user.firstName,
      clinicName: user.clinic?.name || 'VetPro Cloud',
      resetLink: `${appUrl}/auth/reset-password?token=${resetToken}`
    }).catch((mailError) => {
      console.error('Error al enviar correo de recuperación de contraseña:', mailError);
    });
  }

  static async getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { clinic: true }
    });

    if (!user) {
      throw { status: 404, message: 'Usuario no encontrado.' };
    }

    return {
      user: toUserResponse(user),
      clinic: user.clinic
    };
  }

  static async completeProfile(userId: string, data: {
    documentType: string;
    documentNumber: string;
    phone: string;
    address: string;
    municipioId: string;
    birthDate?: string | null;
  }) {
    const municipio = await prisma.municipio.findUnique({ where: { id: data.municipioId } });
    if (!municipio) {
      throw { status: 400, message: 'El municipio seleccionado no es válido.' };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        documentType: data.documentType,
        documentNumber: data.documentNumber.trim(),
        phone: data.phone.trim(),
        address: data.address.trim(),
        departamentoCode: municipio.deptoCode,
        municipioId: municipio.id,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        profileCompleted: true
      }
    });

    return toUserResponse(updated);
  }

  static async getClinicConfig(clinicId: string) {
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: {
        branches: {
          select: { id: true, name: true, address: true, phone: true, active: true }
        }
      }
    });

    if (!clinic) {
      throw { status: 404, message: 'Empresa no encontrada.' };
    }

    return clinic;
  }

  static async updateClinicConfig(clinicId: string, data: {
    name?: string;
    businessType?: string;
    nit?: string | null;
    phone?: string;
    address?: string;
    municipioId?: string;
  }) {
    let municipioData = {};
    if (data.municipioId) {
      const municipio = await prisma.municipio.findUnique({ where: { id: data.municipioId } });
      if (!municipio) throw { status: 400, message: 'El municipio seleccionado no es válido.' };
      municipioData = { city: municipio.nombre, departamentoCode: municipio.deptoCode, municipioId: municipio.id };
    }

    const updated = await prisma.clinic.update({
      where: { id: clinicId },
      data: {
        ...(data.name ? { name: data.name } : {}),
        ...(data.businessType ? { businessType: data.businessType as any } : {}),
        ...(data.nit !== undefined ? { nit: data.nit } : {}),
        ...(data.phone ? { phone: data.phone } : {}),
        ...(data.address ? { address: data.address } : {}),
        ...municipioData
      },
      include: {
        branches: {
          select: { id: true, name: true, address: true, phone: true, active: true }
        }
      }
    });

    return updated;
  }

  static async listClinicUsers(clinicId: string) {
    const users = await prisma.user.findMany({
      where: { clinicId },
      include: {
        branch: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return users.map(u => ({
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
    }));
  }

  static async createClinicUser(clinicId: string, data: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    branchId?: string | null;
  }, appUrl: string) {
    const email = data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw { status: 400, message: 'Ya existe un usuario registrado con este correo electrónico.' };
    }

    if (data.branchId) {
      const branch = await prisma.branch.findFirst({ where: { id: data.branchId, clinicId } });
      if (!branch) throw { status: 404, message: 'Sucursal no encontrada.' };
    }

    const placeholderHash = await bcrypt.hash(crypto.randomUUID(), 10);
    const activationToken = generateActivationToken();
    const activationTokenExpiresAt = new Date(Date.now() + ACTIVATION_TOKEN_TTL_MS);

    const newUser = await prisma.user.create({
      data: {
        clinicId,
        branchId: data.branchId || null,
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email,
        passwordHash: placeholderHash,
        activationToken,
        activationTokenExpiresAt,
        role: data.role as any,
        active: true
      },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
    const activationLink = `${appUrl}/auth/activate?token=${activationToken}`;

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

    return {
      newUser,
      activationLink,
      emailSent
    };
  }

  static async updateClinicUser(clinicId: string, userId: string, currentUserId: string, data: {
    firstName?: string;
    lastName?: string;
    role?: string;
    branchId?: string | null;
    active?: boolean;
  }) {
    const user = await prisma.user.findFirst({ where: { id: userId, clinicId } });
    if (!user) {
      throw { status: 404, message: 'Usuario no encontrado.' };
    }

    if (user.id === currentUserId && data.active === false) {
      throw { status: 400, message: 'No puedes desactivar tu propia cuenta de administrador.' };
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName ? { firstName: data.firstName.trim() } : {}),
        ...(data.lastName ? { lastName: data.lastName.trim() } : {}),
        ...(data.role ? { role: data.role as any } : {}),
        ...(data.branchId !== undefined ? { branchId: data.branchId || null } : {}),
        ...(data.active !== undefined ? { active: Boolean(data.active) } : {})
      },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    return {
      id: updated.id,
      clinicId: updated.clinicId,
      branchId: updated.branchId,
      branchName: updated.branch?.name || 'Todas las sedes (Global)',
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      role: updated.role,
      active: updated.active
    };
  }

  static async resetUserPassword(clinicId: string, userId: string, newPasswordPlain: string) {
    const user = await prisma.user.findFirst({ where: { id: userId, clinicId } });
    if (!user) {
      throw { status: 404, message: 'Usuario no encontrado.' };
    }

    const passwordHash = await bcrypt.hash(newPasswordPlain, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });

    let emailSent = false;
    try {
      emailSent = await MailerService.sendPasswordResetEmail({
        to: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        clinicName: clinic?.name || 'VetPro Cloud',
        newPasswordPlain
      });
    } catch (mailError) {
      console.error('Error al enviar correo de restablecimiento de contraseña:', mailError);
    }

    return { emailSent };
  }
}
