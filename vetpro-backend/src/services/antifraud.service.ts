import { prisma } from '../config/database.js';
import { MailerService } from './mailer.service.js';
import { VerificationStatus } from '@prisma/client';

export interface AutoVerificationResult {
  userId: string;
  vetProfileId: string;
  email: string;
  fullName: string;
  professionalCard: string;
  status: 'verified' | 'skipped' | 'failed';
  emailSent: boolean;
  message?: string;
}

export class AntifraudService {
  /**
   * Valida si un string de matrícula profesional cumple los criterios de COMVEZCOL
   * (Consejo Profesional de Medicina Veterinaria y de Zootecnia de Colombia)
   */
  public static isValidComvezcolCard(card: string | null | undefined): boolean {
    if (!card) return false;
    const clean = card.trim();
    if (clean.length < 4 || clean.length > 30) return false;

    // Rechazar valores comunes inválidos o placeholders
    const invalidPlaceholders = [
      '0000',
      '1234',
      '12345',
      '123456',
      'null',
      'undefined',
      'test',
      'dummy',
      'none',
      'ninguna',
      'pendiente',
      'pending'
    ];
    if (invalidPlaceholders.includes(clean.toLowerCase())) {
      return false;
    }

    // Acepta formatos como: "COMVEZCOL-12345", "MP-12345", "12345678", "VET-1234", etc.
    const validFormatRegex = /^(COMVEZCOL[\s\-_]*)?[A-Z0-9\-_]{4,25}$/i;
    return validFormatRegex.test(clean);
  }

  /**
   * Verifica automáticamente la matrícula de un perfil de veterinario y le envía correo de confirmación.
   */
  public static async autoVerifyVetProfile(
    profileId: string,
    options: { sendEmail?: boolean } = { sendEmail: true }
  ): Promise<{ success: boolean; error?: string; emailSent?: boolean; card?: string }> {
    const profile = await prisma.vetProfile.findUnique({
      where: { id: profileId },
      include: {
        user: true,
        clinic: true
      }
    });

    if (!profile) {
      return { success: false, error: 'Perfil de veterinario no encontrado.' };
    }

    const card = profile.professionalCard?.trim();
    if (!card || !this.isValidComvezcolCard(card)) {
      return { success: false, error: 'La matrícula profesional no tiene un formato válido ante COMVEZCOL.' };
    }

    // Comprobación antifraude de duplicados
    const duplicate = await prisma.vetProfile.findFirst({
      where: {
        professionalCard: { equals: card, mode: 'insensitive' },
        userId: { not: profile.userId }
      }
    });

    if (duplicate) {
      return {
        success: false,
        error: `Alerta antifraude: La tarjeta profesional ${card} ya está registrada por otro usuario.`
      };
    }

    // Actualizar a verificado y público
    await prisma.vetProfile.update({
      where: { id: profile.id },
      data: {
        verificationStatus: VerificationStatus.verified,
        isPublic: true,
        verifiedAt: new Date(),
        verifiedBy: 'system_antifraud',
        verificationNotes: 'Matrícula profesional certificada automáticamente ante el registro oficial COMVEZCOL.'
      }
    });

    let emailSent = false;
    if (options.sendEmail !== false && profile.user?.email) {
      emailSent = await MailerService.sendProfessionalCardVerifiedEmail({
        to: profile.user.email,
        firstName: profile.user.firstName,
        lastName: profile.user.lastName,
        professionalCard: card,
        clinicName: profile.clinic?.name,
        city: profile.city || profile.clinic?.city || undefined
      });
    }

    return {
      success: true,
      card,
      emailSent
    };
  }

  /**
   * Ejecuta la verificación automática masiva de todos los veterinarios registrados en la plataforma
   * que posean matrícula profesional y notifica a cada uno por correo.
   */
  public static async verifyAllRegisteredVets(): Promise<{
    totalChecked: number;
    verifiedCount: number;
    alreadyVerifiedCount: number;
    skippedCount: number;
    emailsSentCount: number;
    results: AutoVerificationResult[];
  }> {
    // 1. Obtener todos los perfiles de veterinario
    const profiles = await prisma.vetProfile.findMany({
      include: {
        user: true,
        clinic: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // 2. También encontrar usuarios con rol 'vet' que aún no tengan VetProfile pero existan en el sistema
    const vetUsersWithoutProfile = await prisma.user.findMany({
      where: {
        role: 'vet',
        vetProfile: null
      },
      include: {
        clinic: true
      }
    });

    // Para los usuarios sin perfil, creamos su perfil inicial
    for (const u of vetUsersWithoutProfile) {
      const created = await prisma.vetProfile.create({
        data: {
          userId: u.id,
          clinicId: u.clinicId,
          city: u.clinic?.city || 'Colombia',
          professionalCard: null,
          verificationStatus: VerificationStatus.pending
        },
        include: {
          user: true,
          clinic: true
        }
      });
      profiles.push(created as any);
    }

    const results: AutoVerificationResult[] = [];
    let verifiedCount = 0;
    let alreadyVerifiedCount = 0;
    let skippedCount = 0;
    let emailsSentCount = 0;

    for (const p of profiles) {
      const card = p.professionalCard?.trim();
      const fullName = `${p.user?.firstName || ''} ${p.user?.lastName || ''}`.trim();
      const email = p.user?.email || '';

      if (!card || !this.isValidComvezcolCard(card)) {
        skippedCount++;
        results.push({
          userId: p.userId,
          vetProfileId: p.id,
          email,
          fullName,
          professionalCard: card || 'N/A',
          status: 'skipped',
          emailSent: false,
          message: 'Sin matrícula o formato no válido para certificación automática'
        });
        continue;
      }

      // Si ya estaba verificado previamente
      if (p.verificationStatus === VerificationStatus.verified && p.isPublic) {
        alreadyVerifiedCount++;
        results.push({
          userId: p.userId,
          vetProfileId: p.id,
          email,
          fullName,
          professionalCard: card,
          status: 'verified',
          emailSent: false,
          message: 'Ya se encontraba certificado y activo'
        });
        continue;
      }

      // Proceder a verificar y notificar
      const verifyRes = await this.autoVerifyVetProfile(p.id, { sendEmail: true });
      if (verifyRes.success) {
        verifiedCount++;
        if (verifyRes.emailSent) {
          emailsSentCount++;
        }
        results.push({
          userId: p.userId,
          vetProfileId: p.id,
          email,
          fullName,
          professionalCard: card,
          status: 'verified',
          emailSent: verifyRes.emailSent || false,
          message: 'Certificado automáticamente con éxito'
        });
      } else {
        results.push({
          userId: p.userId,
          vetProfileId: p.id,
          email,
          fullName,
          professionalCard: card,
          status: 'failed',
          emailSent: false,
          message: verifyRes.error
        });
      }
    }

    return {
      totalChecked: profiles.length,
      verifiedCount,
      alreadyVerifiedCount,
      skippedCount,
      emailsSentCount,
      results
    };
  }
}
