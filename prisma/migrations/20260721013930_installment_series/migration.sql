-- Phase 7 — linked monthly installment series (yearly award paid monthly via the
-- live bKash/Nagad/Rocket path). ALL additive: two NEW tables only, no drops/renames
-- and no changes to existing columns, so the frozen money model and existing rows are
-- untouched. The optional Installment.donationId FK references existing Donation rows.

-- CreateTable
CREATE TABLE "InstallmentSeries" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "sessionId" TEXT,
    "label" TEXT NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "perInstallment" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstallmentSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Installment" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "dueMonth" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3),
    "txnRef" TEXT,
    "method" TEXT,
    "donationId" TEXT,
    "markedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Installment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstallmentSeries_studentId_idx" ON "InstallmentSeries"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentSeries_studentId_label_key" ON "InstallmentSeries"("studentId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_donationId_key" ON "Installment"("donationId");

-- CreateIndex
CREATE INDEX "Installment_seriesId_idx" ON "Installment"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "Installment_seriesId_index_key" ON "Installment"("seriesId", "index");

-- AddForeignKey
ALTER TABLE "InstallmentSeries" ADD CONSTRAINT "InstallmentSeries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentSeries" ADD CONSTRAINT "InstallmentSeries_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AcademicSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "InstallmentSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Installment" ADD CONSTRAINT "Installment_donationId_fkey" FOREIGN KEY ("donationId") REFERENCES "Donation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
