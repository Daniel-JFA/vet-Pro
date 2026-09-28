-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tutors" ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "clinicName" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "data_deletion_requests_status_idx" ON "data_deletion_requests"("status");

