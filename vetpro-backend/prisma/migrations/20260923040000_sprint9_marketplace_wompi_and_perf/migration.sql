-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "MarketplacePaymentStatus" AS ENUM ('pending', 'approved', 'declined', 'voided', 'error');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "paymentStatus" TEXT DEFAULT 'unpaid';

-- CreateTable
CREATE TABLE "vet_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "professionalCard" TEXT,
    "cardDocumentUrl" TEXT,
    "idDocumentUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'pending',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bio" TEXT,
    "modalities" TEXT[] DEFAULT ARRAY['consultorio']::TEXT[],
    "consultationPrice" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "homeVisitPrice" DOUBLE PRECISION,
    "city" TEXT,
    "coverageZones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNumber" TEXT,
    "payoutBank" TEXT,
    "payoutAccount" TEXT,
    "subscriptionStatus" TEXT DEFAULT 'free',
    "subscriptionExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_reviews" (
    "id" TEXT NOT NULL,
    "vetProfileId" TEXT NOT NULL,
    "tutorId" TEXT,
    "tutorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "comment" TEXT NOT NULL,
    "serviceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_payments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "vetProfileId" TEXT,
    "tutorId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "platformFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "vetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'COP',
    "paymentType" TEXT NOT NULL DEFAULT 'appointment_booking',
    "paymentMethod" TEXT,
    "status" "MarketplacePaymentStatus" NOT NULL DEFAULT 'pending',
    "wompiTransactionId" TEXT,
    "wompiReference" TEXT NOT NULL,
    "gatewayResponse" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vet_profiles_userId_key" ON "vet_profiles"("userId");

-- CreateIndex
CREATE INDEX "vet_profiles_clinicId_idx" ON "vet_profiles"("clinicId");

-- CreateIndex
CREATE INDEX "vet_profiles_verificationStatus_idx" ON "vet_profiles"("verificationStatus");

-- CreateIndex
CREATE INDEX "vet_profiles_city_idx" ON "vet_profiles"("city");

-- CreateIndex
CREATE INDEX "vet_reviews_vetProfileId_idx" ON "vet_reviews"("vetProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_payments_wompiTransactionId_key" ON "marketplace_payments"("wompiTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_payments_wompiReference_key" ON "marketplace_payments"("wompiReference");

-- CreateIndex
CREATE INDEX "marketplace_payments_clinicId_idx" ON "marketplace_payments"("clinicId");

-- CreateIndex
CREATE INDEX "marketplace_payments_appointmentId_idx" ON "marketplace_payments"("appointmentId");

-- CreateIndex
CREATE INDEX "marketplace_payments_vetProfileId_idx" ON "marketplace_payments"("vetProfileId");

-- CreateIndex
CREATE INDEX "marketplace_payments_status_idx" ON "marketplace_payments"("status");

-- CreateIndex
CREATE INDEX "marketplace_payments_wompiReference_idx" ON "marketplace_payments"("wompiReference");

-- CreateIndex
CREATE INDEX "appointments_clinicId_scheduledAt_idx" ON "appointments"("clinicId", "scheduledAt");

-- CreateIndex
CREATE INDEX "invoices_clinicId_status_idx" ON "invoices"("clinicId", "status");

-- CreateIndex
CREATE INDEX "invoices_clinicId_issuedAt_idx" ON "invoices"("clinicId", "issuedAt");

-- CreateIndex
CREATE INDEX "medical_records_clinicId_patientId_idx" ON "medical_records"("clinicId", "patientId");

-- AddForeignKey
ALTER TABLE "vet_profiles" ADD CONSTRAINT "vet_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_profiles" ADD CONSTRAINT "vet_profiles_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_reviews" ADD CONSTRAINT "vet_reviews_vetProfileId_fkey" FOREIGN KEY ("vetProfileId") REFERENCES "vet_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_reviews" ADD CONSTRAINT "vet_reviews_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_payments" ADD CONSTRAINT "marketplace_payments_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_payments" ADD CONSTRAINT "marketplace_payments_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_payments" ADD CONSTRAINT "marketplace_payments_vetProfileId_fkey" FOREIGN KEY ("vetProfileId") REFERENCES "vet_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_payments" ADD CONSTRAINT "marketplace_payments_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "tutors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

