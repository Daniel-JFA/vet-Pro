-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "invoice_payments" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "branchId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedBy" TEXT NOT NULL,

    CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_payments_clinicId_idx" ON "invoice_payments"("clinicId");

-- CreateIndex
CREATE INDEX "invoice_payments_invoiceId_idx" ON "invoice_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_payments_branchId_idx" ON "invoice_payments"("branchId");

-- CreateIndex
CREATE INDEX "invoices_branchId_idx" ON "invoices"("branchId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_payments" ADD CONSTRAINT "invoice_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

