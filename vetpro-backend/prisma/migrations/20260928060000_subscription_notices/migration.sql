-- CreateTable
CREATE TABLE "subscription_notices" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "sentTo" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_notices_clinicId_expiresAt_kind_key" ON "subscription_notices"("clinicId", "expiresAt", "kind");

-- AddForeignKey
ALTER TABLE "subscription_notices" ADD CONSTRAINT "subscription_notices_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

