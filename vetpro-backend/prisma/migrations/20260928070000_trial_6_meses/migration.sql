-- 6 meses de gracia para las clínicas existentes (decisión del 28-sep-2026).
-- Las clínicas en prueba o con pago pendiente quedan cubiertas al menos hasta
-- 180 días después de aplicar esta migración. No se tocan las suspendidas ni
-- las canceladas (decisión de la plataforma) ni los períodos pagados vigentes.
UPDATE "clinics"
SET
  "subscriptionStatus" = 'trial',
  "trialEndsAt" = GREATEST(COALESCE("trialEndsAt", NOW()), NOW() + INTERVAL '180 days'),
  "nextBillingDate" = GREATEST(COALESCE("nextBillingDate", NOW()), NOW() + INTERVAL '180 days')
WHERE "subscriptionStatus" IN ('trial', 'past_due');
