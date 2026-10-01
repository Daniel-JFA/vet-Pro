-- Onboarding completado, guardado en el servidor. Antes vivía en localStorage y
-- se repetía en cada navegador nuevo, creando sedes duplicadas.
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "onboardedAt" TIMESTAMP(3);

-- Todas las clínicas existentes ya pasaron por el onboarding al registrarse
UPDATE "clinics" SET "onboardedAt" = "createdAt" WHERE "onboardedAt" IS NULL;
