-- CreateTable
CREATE TABLE "BankShare" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "contactName" TEXT,
    "documentIds" TEXT NOT NULL,
    "linkTokenHash" TEXT,
    "linkExpiresAt" DATETIME,
    "maxDownloads" INTEGER NOT NULL DEFAULT 3,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" DATETIME,
    "bankReference" TEXT,
    "sharedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankShare_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "BankShare_linkTokenHash_key" ON "BankShare"("linkTokenHash");

-- CreateIndex
CREATE INDEX "BankShare_applicationId_createdAt_idx" ON "BankShare"("applicationId", "createdAt");
