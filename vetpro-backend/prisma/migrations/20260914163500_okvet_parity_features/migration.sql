-- CreateEnum
CREATE TYPE "BedType" AS ENUM ('dog_standard', 'dog_uci', 'cat_ward', 'isolation');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('available', 'occupied', 'maintenance', 'cleaning');

-- CreateEnum
CREATE TYPE "HospitalizationStatus" AS ENUM ('admitted', 'critical', 'stable', 'ready_for_discharge', 'discharged');

-- CreateEnum
CREATE TYPE "LabCategory" AS ENUM ('hematology', 'biochemistry', 'urinalysis', 'parasitology', 'imaging', 'cytology', 'other');

-- CreateEnum
CREATE TYPE "LabOrderStatus" AS ENUM ('pending', 'sample_taken', 'in_analysis', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "GroomingStatus" AS ENUM ('checked_in', 'bathing', 'drying_styling', 'ready_for_pickup', 'delivered', 'cancelled');

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'groomer';

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "cufe" TEXT,
ADD COLUMN     "dianErrors" TEXT,
ADD COLUMN     "dianResolutionId" TEXT,
ADD COLUMN     "dianStatus" TEXT NOT NULL DEFAULT 'not_applicable',
ADD COLUMN     "qrCodeUrl" TEXT,
ADD COLUMN     "xmlUblUrl" TEXT;

-- CreateTable
CREATE TABLE "hospital_beds" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BedType" NOT NULL DEFAULT 'dog_standard',
    "status" "BedStatus" NOT NULL DEFAULT 'available',
    "dailyRate" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospital_beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospitalizations" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "status" "HospitalizationStatus" NOT NULL DEFAULT 'admitted',
    "admissionReason" TEXT NOT NULL,
    "diagnosis" TEXT,
    "fluidTherapy" TEXT,
    "dischargeSummary" TEXT,
    "dailyRateCharged" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "totalCharged" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hospitalizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_evolutions" (
    "id" TEXT NOT NULL,
    "hospitalizationId" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "heartRate" INTEGER,
    "respiratoryRate" INTEGER,
    "capillaryRefillTime" DOUBLE PRECISION,
    "bloodGlucose" DOUBLE PRECISION,
    "fluidTherapyRate" TEXT,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_evolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_medications" (
    "id" TEXT NOT NULL,
    "hospitalizationId" TEXT NOT NULL,
    "productId" TEXT,
    "drugName" TEXT NOT NULL,
    "dose" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "frequencyHours" INTEGER NOT NULL DEFAULT 8,
    "timeSlots" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hospital_medications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_dose_records" (
    "id" TEXT NOT NULL,
    "hospitalizationId" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "timeSlot" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "administeredAt" TIMESTAMP(3),
    "administeredBy" TEXT,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "inventoryMovementId" TEXT,

    CONSTRAINT "hospital_dose_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dian_resolutions" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "prefix" TEXT NOT NULL DEFAULT 'SETP',
    "resolutionNumber" TEXT NOT NULL,
    "fromNumber" INTEGER NOT NULL,
    "toNumber" INTEGER NOT NULL,
    "currentNumber" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "technicalKey" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'test',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dian_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_register_shifts" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "electronicSales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "expectedBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualBalance" DOUBLE PRECISION,
    "difference" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,

    CONSTRAINT "cash_register_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_test_catalogs" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "LabCategory" NOT NULL DEFAULT 'hematology',
    "unit" TEXT,
    "canineRefMin" DOUBLE PRECISION,
    "canineRefMax" DOUBLE PRECISION,
    "canineRefText" TEXT,
    "felineRefMin" DOUBLE PRECISION,
    "felineRefMax" DOUBLE PRECISION,
    "felineRefText" TEXT,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salePrice" DOUBLE PRECISION NOT NULL DEFAULT 35000,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_test_catalogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_orders" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "vetId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "status" "LabOrderStatus" NOT NULL DEFAULT 'pending',
    "sampleType" TEXT,
    "clinicalNotes" TEXT,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lab_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_result_items" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "labTestCatalogId" TEXT,
    "testName" TEXT NOT NULL,
    "valueMeasured" TEXT NOT NULL,
    "unit" TEXT,
    "refRangeText" TEXT,
    "flag" TEXT NOT NULL DEFAULT 'normal',
    "interpretation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_result_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lab_attachments" (
    "id" TEXT NOT NULL,
    "labOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'pdf',
    "size" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lab_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grooming_services" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "groomerId" TEXT,
    "serviceType" TEXT NOT NULL,
    "coatCondition" TEXT,
    "skinObservations" TEXT,
    "medicatedShampoo" TEXT,
    "behaviorNotes" TEXT,
    "status" "GroomingStatus" NOT NULL DEFAULT 'checked_in',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 45000,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "tutorNotifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grooming_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_campaigns" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "templateBody" TEXT NOT NULL,
    "potentialRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "patientsTargeted" INTEGER NOT NULL DEFAULT 0,
    "messagesSent" INTEGER NOT NULL DEFAULT 0,
    "messagesDelivered" INTEGER NOT NULL DEFAULT 0,
    "responsesReceived" INTEGER NOT NULL DEFAULT 0,
    "appointmentsBooked" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hospital_beds_clinicId_idx" ON "hospital_beds"("clinicId");

-- CreateIndex
CREATE INDEX "hospital_beds_branchId_idx" ON "hospital_beds"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_beds_clinicId_branchId_code_key" ON "hospital_beds"("clinicId", "branchId", "code");

-- CreateIndex
CREATE INDEX "hospitalizations_clinicId_idx" ON "hospitalizations"("clinicId");

-- CreateIndex
CREATE INDEX "hospitalizations_patientId_idx" ON "hospitalizations"("patientId");

-- CreateIndex
CREATE INDEX "hospitalizations_bedId_idx" ON "hospitalizations"("bedId");

-- CreateIndex
CREATE INDEX "hospital_evolutions_hospitalizationId_idx" ON "hospital_evolutions"("hospitalizationId");

-- CreateIndex
CREATE INDEX "hospital_evolutions_vetId_idx" ON "hospital_evolutions"("vetId");

-- CreateIndex
CREATE INDEX "hospital_medications_hospitalizationId_idx" ON "hospital_medications"("hospitalizationId");

-- CreateIndex
CREATE INDEX "hospital_dose_records_hospitalizationId_idx" ON "hospital_dose_records"("hospitalizationId");

-- CreateIndex
CREATE INDEX "hospital_dose_records_medicationId_idx" ON "hospital_dose_records"("medicationId");

-- CreateIndex
CREATE INDEX "dian_resolutions_clinicId_idx" ON "dian_resolutions"("clinicId");

-- CreateIndex
CREATE INDEX "cash_register_shifts_clinicId_idx" ON "cash_register_shifts"("clinicId");

-- CreateIndex
CREATE INDEX "cash_register_shifts_branchId_idx" ON "cash_register_shifts"("branchId");

-- CreateIndex
CREATE INDEX "cash_register_shifts_userId_idx" ON "cash_register_shifts"("userId");

-- CreateIndex
CREATE INDEX "lab_test_catalogs_clinicId_idx" ON "lab_test_catalogs"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_test_catalogs_clinicId_code_key" ON "lab_test_catalogs"("clinicId", "code");

-- CreateIndex
CREATE INDEX "lab_orders_clinicId_idx" ON "lab_orders"("clinicId");

-- CreateIndex
CREATE INDEX "lab_orders_patientId_idx" ON "lab_orders"("patientId");

-- CreateIndex
CREATE INDEX "lab_orders_vetId_idx" ON "lab_orders"("vetId");

-- CreateIndex
CREATE UNIQUE INDEX "lab_orders_clinicId_orderNumber_key" ON "lab_orders"("clinicId", "orderNumber");

-- CreateIndex
CREATE INDEX "lab_result_items_labOrderId_idx" ON "lab_result_items"("labOrderId");

-- CreateIndex
CREATE INDEX "lab_attachments_labOrderId_idx" ON "lab_attachments"("labOrderId");

-- CreateIndex
CREATE INDEX "grooming_services_clinicId_idx" ON "grooming_services"("clinicId");

-- CreateIndex
CREATE INDEX "grooming_services_branchId_idx" ON "grooming_services"("branchId");

-- CreateIndex
CREATE INDEX "grooming_services_patientId_idx" ON "grooming_services"("patientId");

-- CreateIndex
CREATE INDEX "grooming_services_groomerId_idx" ON "grooming_services"("groomerId");

-- CreateIndex
CREATE INDEX "crm_campaigns_clinicId_idx" ON "crm_campaigns"("clinicId");

-- CreateIndex
CREATE INDEX "invoices_dianResolutionId_idx" ON "invoices"("dianResolutionId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_dianResolutionId_fkey" FOREIGN KEY ("dianResolutionId") REFERENCES "dian_resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_beds" ADD CONSTRAINT "hospital_beds_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_beds" ADD CONSTRAINT "hospital_beds_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalizations" ADD CONSTRAINT "hospitalizations_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalizations" ADD CONSTRAINT "hospitalizations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalizations" ADD CONSTRAINT "hospitalizations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospitalizations" ADD CONSTRAINT "hospitalizations_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "hospital_beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_evolutions" ADD CONSTRAINT "hospital_evolutions_hospitalizationId_fkey" FOREIGN KEY ("hospitalizationId") REFERENCES "hospitalizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_evolutions" ADD CONSTRAINT "hospital_evolutions_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_medications" ADD CONSTRAINT "hospital_medications_hospitalizationId_fkey" FOREIGN KEY ("hospitalizationId") REFERENCES "hospitalizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_dose_records" ADD CONSTRAINT "hospital_dose_records_hospitalizationId_fkey" FOREIGN KEY ("hospitalizationId") REFERENCES "hospitalizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_dose_records" ADD CONSTRAINT "hospital_dose_records_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "hospital_medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dian_resolutions" ADD CONSTRAINT "dian_resolutions_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_shifts" ADD CONSTRAINT "cash_register_shifts_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_shifts" ADD CONSTRAINT "cash_register_shifts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_register_shifts" ADD CONSTRAINT "cash_register_shifts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_test_catalogs" ADD CONSTRAINT "lab_test_catalogs_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_vetId_fkey" FOREIGN KEY ("vetId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_items" ADD CONSTRAINT "lab_result_items_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_result_items" ADD CONSTRAINT "lab_result_items_labTestCatalogId_fkey" FOREIGN KEY ("labTestCatalogId") REFERENCES "lab_test_catalogs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lab_attachments" ADD CONSTRAINT "lab_attachments_labOrderId_fkey" FOREIGN KEY ("labOrderId") REFERENCES "lab_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_services" ADD CONSTRAINT "grooming_services_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_services" ADD CONSTRAINT "grooming_services_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_services" ADD CONSTRAINT "grooming_services_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grooming_services" ADD CONSTRAINT "grooming_services_groomerId_fkey" FOREIGN KEY ("groomerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_campaigns" ADD CONSTRAINT "crm_campaigns_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "clinics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

