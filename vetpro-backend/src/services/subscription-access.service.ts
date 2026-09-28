// Reglas de acceso por suscripción (Sprint 14.3). Una clínica con la prueba o el
// período pagado vencido tiene 5 días de gracia; después queda en solo lectura:
// puede consultar y exportar, pero no crear ni modificar nada.

export const TRIAL_DAYS = 14;
export const GRACE_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ClinicSubscriptionFields {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  nextBillingDate: Date | null;
  createdAt: Date;
}

export interface ClinicAccess {
  expiresAt: Date;
  graceEndsAt: Date;
  readOnly: boolean;
  // Días hasta el vencimiento (negativo si ya venció)
  daysUntilExpiry: number;
}

export function getClinicExpiry(clinic: ClinicSubscriptionFields): Date {
  const trialFallback = new Date(clinic.createdAt.getTime() + TRIAL_DAYS * DAY_MS);
  if (clinic.subscriptionStatus === 'trial') {
    return clinic.trialEndsAt ?? clinic.nextBillingDate ?? trialFallback;
  }
  return clinic.nextBillingDate ?? clinic.trialEndsAt ?? trialFallback;
}

export function getClinicAccess(clinic: ClinicSubscriptionFields, now: Date = new Date()): ClinicAccess {
  const expiresAt = getClinicExpiry(clinic);
  const graceEndsAt = new Date(expiresAt.getTime() + GRACE_DAYS * DAY_MS);
  // Suspendida o cancelada desde la plataforma: solo lectura sin esperar la gracia
  const blockedByStatus = clinic.subscriptionStatus === 'suspended' || clinic.subscriptionStatus === 'cancelled';

  return {
    expiresAt,
    graceEndsAt,
    readOnly: blockedByStatus || now.getTime() > graceEndsAt.getTime(),
    daysUntilExpiry: Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS)
  };
}
