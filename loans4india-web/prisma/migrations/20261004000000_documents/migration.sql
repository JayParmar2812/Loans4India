-- AlterTable
ALTER TABLE "LoanApplication" ADD COLUMN "declarationAt" DATETIME;
ALTER TABLE "LoanApplication" ADD COLUMN "submittedAt" DATETIME;
ALTER TABLE "LoanApplication" ADD COLUMN "uploadTokenExpiresAt" DATETIME;
ALTER TABLE "LoanApplication" ADD COLUMN "uploadTokenHash" TEXT;

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADED',
    "scanResult" TEXT NOT NULL,
    "rejectReason" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_storageKey_key" ON "ApplicationDocument"("storageKey");

-- CreateIndex
CREATE INDEX "ApplicationDocument_applicationId_slot_idx" ON "ApplicationDocument"("applicationId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "LoanApplication_uploadTokenHash_key" ON "LoanApplication"("uploadTokenHash");
