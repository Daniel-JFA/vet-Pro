-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "isNewPatient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "prospectName" TEXT,
ADD COLUMN     "prospectPhone" TEXT,
ALTER COLUMN "patientId" DROP NOT NULL;
