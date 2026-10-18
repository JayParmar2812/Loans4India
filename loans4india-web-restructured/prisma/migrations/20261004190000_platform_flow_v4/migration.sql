-- AlterTable
ALTER TABLE "ApplicationDocument" ADD COLUMN "rejectNote" TEXT;

-- AlterTable
ALTER TABLE "ConsentRecord" ADD COLUMN "bankListVersion" TEXT;
ALTER TABLE "ConsentRecord" ADD COLUMN "banksNamed" TEXT;
ALTER TABLE "ConsentRecord" ADD COLUMN "noticeHash" TEXT;

-- CreateTable
CREATE TABLE "ApplicationSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationSnapshot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "slots" TEXT NOT NULL,
    "fields" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    CONSTRAINT "ApplicationTask_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raisedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "resolutionNote" TEXT,
    CONSTRAINT "ApplicationFlag_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankAttempt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "bankId" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'PREPARING',
    "selectionBasis" TEXT NOT NULL,
    "selectedBy" TEXT NOT NULL,
    "preparedBy" TEXT,
    "sentToGateAt" DATETIME,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "sendBackReason" TEXT,
    "templateVersion" TEXT,
    "manifest" TEXT,
    "packageHash" TEXT,
    "bankReference" TEXT,
    "branch" TEXT,
    "submittedBy" TEXT,
    "submittedAt" DATETIME,
    "evidenceKey" TEXT,
    "failedTries" INTEGER NOT NULL DEFAULT 0,
    "outcomeNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankAttempt_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BankStatusEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "evidenceKey" TEXT,
    "evidenceName" TEXT,
    "bankWording" TEXT,
    "reasonCode" TEXT,
    "amount" INTEGER,
    "ratePct" REAL,
    "tenureMonths" INTEGER,
    "loanAccountLast4" TEXT,
    "eventDate" TEXT,
    "recordedBy" TEXT NOT NULL,
    "needsCheck" BOOLEAN NOT NULL DEFAULT false,
    "checkedBy" TEXT,
    "checkedAt" DATETIME,
    "supersedesId" TEXT,
    "supersedeReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankStatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BankStatusEvent_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "BankAttempt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LoanApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'ENQUIRY',
    "onHold" BOOLEAN NOT NULL DEFAULT false,
    "holdReason" TEXT,
    "heldBy" TEXT,
    "product" TEXT NOT NULL,
    "loanAmount" INTEGER NOT NULL,
    "tenureMonths" INTEGER,
    "purpose" TEXT,
    "fullName" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "employmentType" TEXT,
    "employerName" TEXT,
    "monthlyIncome" INTEGER,
    "existingEmi" INTEGER NOT NULL DEFAULT 0,
    "dob" TEXT,
    "profile" TEXT,
    "panEnc" TEXT,
    "panHash" TEXT,
    "panMasked" TEXT,
    "accountEnc" TEXT,
    "accountMasked" TEXT,
    "detailsCompletedAt" DATETIME,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "landingPath" TEXT,
    "referrer" TEXT,
    "referralCode" TEXT,
    "ownerId" TEXT,
    "ownerDueAt" DATETIME,
    "assignedAt" DATETIME,
    "reviewPassedAt" DATETIME,
    "reviewPassedBy" TEXT,
    "closedReason" TEXT,
    "closedNote" TEXT,
    "closedAt" DATETIME,
    "uploadTokenHash" TEXT,
    "uploadTokenExpiresAt" DATETIME,
    "submittedAt" DATETIME,
    "declarationAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LoanApplication" ("campaign", "city", "closedReason", "createdAt", "declarationAt", "email", "employerName", "employmentType", "existingEmi", "fullName", "id", "landingPath", "loanAmount", "medium", "mobile", "monthlyIncome", "pincode", "product", "purpose", "reference", "referrer", "source", "stage", "submittedAt", "tenureMonths", "updatedAt", "uploadTokenExpiresAt", "uploadTokenHash") SELECT "campaign", "city", "closedReason", "createdAt", "declarationAt", "email", "employerName", "employmentType", "existingEmi", "fullName", "id", "landingPath", "loanAmount", "medium", "mobile", "monthlyIncome", "pincode", "product", "purpose", "reference", "referrer", "source", "stage", "submittedAt", "tenureMonths", "updatedAt", "uploadTokenExpiresAt", "uploadTokenHash" FROM "LoanApplication";
DROP TABLE "LoanApplication";
ALTER TABLE "new_LoanApplication" RENAME TO "LoanApplication";
CREATE UNIQUE INDEX "LoanApplication_reference_key" ON "LoanApplication"("reference");
CREATE UNIQUE INDEX "LoanApplication_uploadTokenHash_key" ON "LoanApplication"("uploadTokenHash");
CREATE INDEX "LoanApplication_mobile_idx" ON "LoanApplication"("mobile");
CREATE INDEX "LoanApplication_panHash_idx" ON "LoanApplication"("panHash");
CREATE INDEX "LoanApplication_stage_createdAt_idx" ON "LoanApplication"("stage", "createdAt");
CREATE INDEX "LoanApplication_ownerId_stage_idx" ON "LoanApplication"("ownerId", "stage");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSnapshot_applicationId_version_key" ON "ApplicationSnapshot"("applicationId", "version");

-- CreateIndex
CREATE INDEX "ApplicationTask_applicationId_status_idx" ON "ApplicationTask"("applicationId", "status");

-- CreateIndex
CREATE INDEX "ApplicationFlag_applicationId_status_idx" ON "ApplicationFlag"("applicationId", "status");

-- CreateIndex
CREATE INDEX "BankAttempt_applicationId_createdAt_idx" ON "BankAttempt"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "BankAttempt_state_idx" ON "BankAttempt"("state");

-- CreateIndex
CREATE UNIQUE INDEX "BankAttempt_bankId_bankReference_key" ON "BankAttempt"("bankId", "bankReference");

-- CreateIndex
CREATE INDEX "BankStatusEvent_applicationId_createdAt_idx" ON "BankStatusEvent"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "BankStatusEvent_attemptId_createdAt_idx" ON "BankStatusEvent"("attemptId", "createdAt");

-- Map the old stage names to the Platform Flow v4 application states.
UPDATE "LoanApplication" SET "stage" = 'PROFILE_IN_PROGRESS' WHERE "stage" = 'PROFILE_COMPLETE';
UPDATE "LoanApplication" SET "stage" = 'VERIFICATION_REVIEW' WHERE "stage" = 'UNDER_REVIEW';
-- Old free-text close reasons become notes; v4 close reasons are a fixed list.
UPDATE "LoanApplication" SET "closedNote" = "closedReason", "closedReason" = NULL WHERE "stage" = 'CLOSED';
