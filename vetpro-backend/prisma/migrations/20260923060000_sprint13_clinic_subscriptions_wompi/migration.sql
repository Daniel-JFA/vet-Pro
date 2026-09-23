-- AlterTable
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "billingCycle" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "nextBillingDate" TIMESTAMP(3);
ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "lastPaymentDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "clinic_subscription_payments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "plan" "PlanType" NOT NULL,
    "amountInCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "paymentMethod" TEXT,
    "wompiTransactionId" TEXT,
    "wompiReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "receiptUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clinic_subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "clinic_subscription_payments_wompiReference_key" ON "clinic_subscription_payments"("wompiReference");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "clinic_subscription_payments_clinicId_idx" ON "clinic_subscription_payments"("clinicId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'clinic_subscription_payments_clinicId_fkey'
    ) THEN
        ALTER TABLE "clinic_subscription_payments" ADD CONSTRAINT "clinic_subscription_payments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
