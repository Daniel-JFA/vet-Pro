-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('clinic', 'independent_vet');

-- AlterTable
ALTER TABLE "clinics" ADD COLUMN     "businessType" "BusinessType" NOT NULL DEFAULT 'clinic';

