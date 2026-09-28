import { prisma } from '../config/database.js';
import { MailerService } from './mailer.service.js';
import { getClinicAccess, GRACE_DAYS } from './subscription-access.service.js';

// Avisos por correo 7 días y 1 día antes del vencimiento (Sprint 14.3).
// Es idempotente: SubscriptionNotice guarda qué aviso se envió para cada vencimiento.

const NOTICES = [
  { kind: '1d', maxDays: 1 },
  { kind: '7d', maxDays: 7 }
] as const;

const CHECK_INTERVAL_MS = 60 * 60 * 1000;

export class SubscriptionReminderService {
  // onlyClinicIds limita la revisión a ciertas clínicas (pruebas y ejecuciones manuales)
  static async sendDueNotices(now: Date = new Date(), onlyClinicIds?: string[]): Promise<number> {
    const clinics = await prisma.clinic.findMany({
      where: {
        subscriptionStatus: { in: ['trial', 'active', 'past_due'] },
        ...(onlyClinicIds ? { id: { in: onlyClinicIds } } : {})
      },
      select: {
        id: true,
        name: true,
        email: true,
        subscriptionStatus: true,
        trialEndsAt: true,
        nextBillingDate: true,
        createdAt: true
      }
    });

    const renewLink = `${process.env.APP_URL || 'http://localhost:4200'}/suscripcion`;
    let sent = 0;

    for (const clinic of clinics) {
      const { expiresAt, daysUntilExpiry } = getClinicAccess(clinic, now);
      if (daysUntilExpiry < 1) continue;

      // Solo el aviso más cercano: a 1 día no se manda también el de 7
      const notice = NOTICES.find((n) => daysUntilExpiry <= n.maxDays);
      if (!notice) continue;

      const already = await prisma.subscriptionNotice.findUnique({
        where: { clinicId_expiresAt_kind: { clinicId: clinic.id, expiresAt, kind: notice.kind } }
      });
      if (already) continue;

      const ok = await MailerService.sendSubscriptionExpiryNotice({
        to: clinic.email,
        clinicName: clinic.name,
        expiresAt,
        daysLeft: daysUntilExpiry,
        graceDays: GRACE_DAYS,
        renewLink
      });
      if (!ok) continue;

      await prisma.subscriptionNotice.create({
        data: { clinicId: clinic.id, expiresAt, kind: notice.kind, sentTo: clinic.email }
      });
      sent++;
    }

    return sent;
  }

  // Revisión cada hora; el costo es una consulta por clínica activa.
  static start(): void {
    const run = () =>
      this.sendDueNotices().catch((err) => console.error('[SubscriptionReminder] Error al enviar avisos:', err));
    run();
    setInterval(run, CHECK_INTERVAL_MS).unref();
  }
}
