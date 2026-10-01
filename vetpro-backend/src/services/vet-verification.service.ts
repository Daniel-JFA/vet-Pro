import { Prisma, VerificationStatus } from '@prisma/client';
import { prisma } from '../config/database.js';
import { MailerService } from './mailer.service.js';

/**
 * Verificación COMVEZCOL de perfiles de veterinarios.
 *
 * Aprobar, rechazar y destacar es exclusivo del equipo de VetPro (panel de
 * plataforma): si lo hiciera la propia clínica podría aprobarse a sí misma y
 * el control antifraude no serviría. Las clínicas solo consultan el estado de
 * sus veterinarios.
 */

/** Perfiles con los datos de auditoría antifraude. */
export async function listVerificationProfiles(where: Prisma.VetProfileWhereInput = {}) {
  const profiles = await prisma.vetProfile.findMany({
    where,
    orderBy: [{ verificationStatus: 'asc' }, { createdAt: 'desc' }],
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          documentType: true,
          documentNumber: true
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

  return Promise.all(
    profiles.map(async (p) => {
      // La tarjeta duplicada se busca en toda la plataforma, aunque la
      // clínica solo vea sus perfiles (solo se expone el sí/no).
      let hasDuplicate = false;
      if (p.professionalCard) {
        const dups = await prisma.vetProfile.count({
          where: {
            professionalCard: { equals: p.professionalCard.trim(), mode: 'insensitive' },
            id: { not: p.id }
          }
        });
        hasDuplicate = dups > 0;
      }

      const hasValidCard = Boolean(p.professionalCard && p.professionalCard.trim().length >= 3);
      const hasDocument = Boolean(p.cardDocumentUrl || p.idDocumentUrl);
      const hasIdNumber = Boolean(p.user.documentNumber);

      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      if (hasDuplicate || !hasValidCard || !hasIdNumber) {
        riskLevel = 'high';
      } else if (!hasDocument) {
        riskLevel = 'medium';
      }

      return {
        ...p,
        antifraud: {
          hasDuplicate,
          hasValidCard,
          hasDocument,
          hasIdNumber,
          riskLevel,
          comvezcolQueryUrl: 'https://www.comvezcol.org/'
        }
      };
    })
  );
}

/** Aprueba/rechaza o destaca un perfil. `verifiedBy` identifica a quién lo hizo. */
export async function updateVerification(
  id: string,
  input: { status?: VerificationStatus; notes?: string; isFeatured?: boolean },
  verifiedBy: string
) {
  const dataToUpdate: Prisma.VetProfileUpdateInput = {};
  if (input.status !== undefined) {
    dataToUpdate.verificationStatus = input.status;
    dataToUpdate.verificationNotes = input.notes || null;
    dataToUpdate.verifiedAt = input.status === VerificationStatus.verified ? new Date() : null;
    dataToUpdate.verifiedBy = verifiedBy;
    if (input.status === VerificationStatus.verified) {
      dataToUpdate.isPublic = true;
    } else if (input.status === VerificationStatus.rejected) {
      dataToUpdate.isPublic = false;
    }
  }
  if (input.isFeatured !== undefined) {
    dataToUpdate.isFeatured = input.isFeatured;
  }

  const profile = await prisma.vetProfile.update({
    where: { id },
    data: dataToUpdate,
    include: {
      user: true,
      clinic: true
    }
  });

  if (input.status === VerificationStatus.verified && profile.user?.email && profile.professionalCard) {
    MailerService.sendProfessionalCardVerifiedEmail({
      to: profile.user.email,
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      professionalCard: profile.professionalCard,
      clinicName: profile.clinic?.name,
      city: profile.city || profile.clinic?.city || undefined
    }).catch((err: any) => console.error('Error enviando correo de certificación COMVEZCOL:', err));
  }

  return profile;
}
