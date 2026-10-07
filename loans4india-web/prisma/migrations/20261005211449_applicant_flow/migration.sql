-- CreateTable
CREATE TABLE "ApplicantFlowVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "flow" TEXT,
    "flowVersion" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_LoanApplication" ("accountEnc", "accountMasked", "assignedAt", "campaign", "city", "closedAt", "closedNote", "closedReason", "createdAt", "declarationAt", "detailsCompletedAt", "dob", "email", "employerName", "employmentType", "existingEmi", "fullName", "heldBy", "holdReason", "id", "landingPath", "loanAmount", "medium", "mobile", "monthlyIncome", "onHold", "ownerDueAt", "ownerId", "panEnc", "panHash", "panMasked", "pincode", "product", "profile", "purpose", "reference", "referralCode", "referrer", "reviewPassedAt", "reviewPassedBy", "source", "stage", "submittedAt", "tenureMonths", "updatedAt", "uploadTokenExpiresAt", "uploadTokenHash") SELECT "accountEnc", "accountMasked", "assignedAt", "campaign", "city", "closedAt", "closedNote", "closedReason", "createdAt", "declarationAt", "detailsCompletedAt", "dob", "email", "employerName", "employmentType", "existingEmi", "fullName", "heldBy", "holdReason", "id", "landingPath", "loanAmount", "medium", "mobile", "monthlyIncome", "onHold", "ownerDueAt", "ownerId", "panEnc", "panHash", "panMasked", "pincode", "product", "profile", "purpose", "reference", "referralCode", "referrer", "reviewPassedAt", "reviewPassedBy", "source", "stage", "submittedAt", "tenureMonths", "updatedAt", "uploadTokenExpiresAt", "uploadTokenHash" FROM "LoanApplication";
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
