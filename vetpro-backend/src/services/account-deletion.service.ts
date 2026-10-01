import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database.js';
import { MailerService } from './mailer.service.js';

// Eliminación de cuentas (requisito de App Store y Google Play; Ley 1581 de 2012).
//
// - Personal de clínica: se borran sus datos personales y su acceso. Su nombre se
//   conserva porque figura como autor de historias clínicas que la clínica debe guardar.
// - Último usuario de una clínica: se programa el borrado completo de la clínica
//   a CLINIC_DELETION_DAYS, para que alcance a exportar su información.
// - Tutor: se borran sus datos de contacto. Si tiene facturas se conservan nombre y
//   documento, que la clínica debe guardar por obligación tributaria.

export const CLINIC_DELETION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

function removeUpload(url: string | null | undefined): void {
  if (!url || !url.startsWith('/api/uploads/')) return;
  const relative = url.replace('/api/uploads/', '');
  const target = path.join(UPLOADS_DIR, relative);
  // Evitar salir de la carpeta de uploads con rutas manipuladas
  if (!target.startsWith(UPLOADS_DIR + path.sep)) return;
  fs.promises.unlink(target).catch(() => undefined);
}

export type StaffDeletionResult =
  | { outcome: 'account_deleted' }
  | { outcome: 'clinic_scheduled'; deletionScheduledAt: Date };

export class AccountDeletionService {
  static async deleteStaffAccount(userId: string, password: string): Promise<StaffDeletionResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { vetProfile: true, clinic: { select: { id: true, name: true } } }
    });
    if (!user || user.anonymizedAt) {
      throw { status: 404, message: 'Cuenta no encontrada.' };
    }

    const passwordOk = await bcrypt.compare(password || '', user.passwordHash);
    if (!passwordOk) {
      throw { status: 401, message: 'La contraseña no es correcta.' };
    }

    const otherActiveUsers = await prisma.user.count({
      where: { clinicId: user.clinicId, active: true, id: { not: user.id } }
    });
    const otherActiveAdmins = await prisma.user.count({
      where: { clinicId: user.clinicId, active: true, role: 'admin', id: { not: user.id } }
    });

    // Una clínica con equipo no puede quedar sin administrador
    if (user.role === 'admin' && otherActiveAdmins === 0 && otherActiveUsers > 0) {
      throw {
        status: 409,
        message: 'Eres el único administrador de la clínica. Asigna el rol de administrador a otra persona del equipo antes de eliminar tu cuenta.'
      };
    }

    const closesClinic = otherActiveUsers === 0;
    const deletionScheduledAt = new Date(Date.now() + CLINIC_DELETION_DAYS * DAY_MS);
    const originalEmail = user.email;
    const unusablePasswordHash = await bcrypt.hash(crypto.randomUUID(), 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          email: `eliminado+${user.id}@vetpro.invalid`,
          passwordHash: unusablePasswordHash,
          activationToken: null,
          activationTokenExpiresAt: null,
          active: false,
          anonymizedAt: new Date(),
          avatarUrl: null,
          documentType: null,
          documentNumber: null,
          phone: null,
          address: null,
          departamentoCode: null,
          municipioId: null,
          birthDate: null
        }
      });

      if (user.vetProfile) {
        await tx.vetProfile.update({
          where: { id: user.vetProfile.id },
          data: {
            isPublic: false,
            isFeatured: false,
            professionalCard: null,
            cardDocumentUrl: null,
            idDocumentUrl: null,
            bio: null,
            whatsappNumber: null,
            payoutBank: null,
            payoutAccount: null
          }
        });
      }

      if (closesClinic) {
        await tx.clinic.update({
          where: { id: user.clinicId },
          data: { subscriptionStatus: 'cancelled', deletionScheduledAt }
        });
      }
    });

    removeUpload(user.avatarUrl);
    removeUpload(user.vetProfile?.cardDocumentUrl);
    removeUpload(user.vetProfile?.idDocumentUrl);

    MailerService.sendAccountDeletedEmail({
      to: originalEmail,
      firstName: user.firstName,
      clinicName: user.clinic.name,
      clinicDeletionDate: closesClinic ? deletionScheduledAt : null
    }).catch(() => undefined);

    return closesClinic ? { outcome: 'clinic_scheduled', deletionScheduledAt } : { outcome: 'account_deleted' };
  }

  static async deleteTutorAccount(tutorId: string): Promise<void> {
    const tutor = await prisma.tutor.findUnique({ where: { id: tutorId } });
    if (!tutor || tutor.anonymizedAt) {
      throw { status: 404, message: 'Cuenta no encontrada.' };
    }

    const invoiceCount = await prisma.invoice.count({ where: { tutorId } });
    const keepFiscalData = invoiceCount > 0;

    await prisma.tutor.update({
      where: { id: tutorId },
      data: {
        ...(keepFiscalData ? {} : { firstName: 'Tutor', lastName: 'eliminado', documentId: null }),
        email: null,
        phone: '',
        address: null,
        notes: null,
        anonymizedAt: new Date()
      }
    });
  }

  // Borra por completo una clínica y todos sus datos. Algunas tablas protegen sus
  // referencias (ON DELETE RESTRICT), así que se eliminan en orden antes de la clínica;
  // el resto cae en cascada.
  static async purgeClinic(clinicId: string): Promise<void> {
    const photoUrls = await prisma.patient.findMany({ where: { clinicId }, select: { photoUrl: true } });
    const vetDocs = await prisma.vetProfile.findMany({
      where: { clinicId },
      select: { cardDocumentUrl: true, idDocumentUrl: true }
    });

    await prisma.$transaction([
      prisma.prescription.deleteMany({ where: { record: { clinicId } } }),
      prisma.vaccine.deleteMany({ where: { patient: { clinicId } } }),
      prisma.hospitalEvolution.deleteMany({ where: { hospitalization: { clinicId } } }),
      prisma.hospitalization.deleteMany({ where: { clinicId } }),
      prisma.medicalRecord.deleteMany({ where: { clinicId } }),
      prisma.labOrder.deleteMany({ where: { clinicId } }),
      prisma.groomingService.deleteMany({ where: { clinicId } }),
      prisma.cashRegisterShift.deleteMany({ where: { clinicId } }),
      prisma.inventoryMovement.deleteMany({ where: { clinicId } }),
      prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrder: { clinicId } } }),
      prisma.purchaseOrder.deleteMany({ where: { clinicId } }),
      prisma.invoice.deleteMany({ where: { clinicId } }),
      prisma.walkBooking.deleteMany({ where: { clinicId } }),
      prisma.appointment.deleteMany({ where: { clinicId } }),
      prisma.patient.deleteMany({ where: { clinicId } }),
      prisma.clinic.delete({ where: { id: clinicId } })
    ]);

    photoUrls.forEach((p) => removeUpload(p.photoUrl));
    vetDocs.forEach((d) => {
      removeUpload(d.cardDocumentUrl);
      removeUpload(d.idDocumentUrl);
    });
  }

  static async purgeScheduledClinics(now: Date = new Date(), onlyClinicIds?: string[]): Promise<number> {
    const due = await prisma.clinic.findMany({
      where: {
        deletionScheduledAt: { lte: now },
        ...(onlyClinicIds ? { id: { in: onlyClinicIds } } : {})
      },
      select: { id: true }
    });

    let purged = 0;
    for (const { id } of due) {
      try {
        await this.purgeClinic(id);
        purged++;
        console.log(`[AccountDeletion] Clínica ${id} eliminada por solicitud de cierre.`);
      } catch (err) {
        console.error(`[AccountDeletion] No se pudo eliminar la clínica ${id}:`, err);
      }
    }
    return purged;
  }

  static startPurgeJob(): void {
    const run = () => this.purgeScheduledClinics().catch((err) => console.error('[AccountDeletion] Error:', err));
    run();
    setInterval(run, PURGE_INTERVAL_MS).unref();
  }
}
