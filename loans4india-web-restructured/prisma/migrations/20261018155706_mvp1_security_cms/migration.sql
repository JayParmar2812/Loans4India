-- AlterTable
ALTER TABLE "SiteContentVersion" ADD COLUMN "publishedAt" DATETIME;
ALTER TABLE "SiteContentVersion" ADD COLUMN "publishedBy" TEXT;

-- CreateTable
CREATE TABLE "StaffSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "mfaPassed" BOOLEAN NOT NULL DEFAULT false,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mobile" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "consumedAt" DATETIME,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ApplicantSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT,
    "template" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "provider" TEXT,
    "providerRef" TEXT,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "applicationRef" TEXT,
    "message" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "level" INTEGER NOT NULL DEFAULT 1,
    "assignee" TEXT,
    "dueAt" DATETIME NOT NULL,
    "acknowledgedAt" DATETIME,
    "outcome" TEXT,
    "ip" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SupportTicketEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketId" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportTicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Article" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "liveRevisionId" TEXT,
    "draftRevisionId" TEXT,
    "publishAt" DATETIME,
    "publishedBy" TEXT,
    "publishedAt" DATETIME,
    "reviewRequestedBy" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArticleRevision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleRevision_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Redirect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PurgeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dataClasses" TEXT NOT NULL,
    "filesDeleted" INTEGER NOT NULL,
    "jobVersion" TEXT NOT NULL,
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
    "lastApplicantAt" DATETIME,
    "purgeAfter" DATETIME,
    "purgedAt" DATETIME,
    "legalHold" BOOLEAN NOT NULL DEFAULT false,
    "legalHoldReason" TEXT,
    "legalHoldBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_LoanApplication" ("accountEnc", "accountMasked", "assignedAt", "campaign", "city", "closedAt", "closedNote", "closedReason", "createdAt", "declarationAt", "detailsCompletedAt", "dob", "email", "employerName", "employmentType", "existingEmi", "flow", "flowVersion", "fullName", "heldBy", "holdReason", "id", "landingPath", "loanAmount", "medium", "mobile", "monthlyIncome", "onHold", "ownerDueAt", "ownerId", "panEnc", "panHash", "panMasked", "pincode", "product", "profile", "purpose", "reference", "referralCode", "referrer", "reviewPassedAt", "reviewPassedBy", "source", "stage", "submittedAt", "tenureMonths", "updatedAt", "uploadTokenExpiresAt", "uploadTokenHash") SELECT "accountEnc", "accountMasked", "assignedAt", "campaign", "city", "closedAt", "closedNote", "closedReason", "createdAt", "declarationAt", "detailsCompletedAt", "dob", "email", "employerName", "employmentType", "existingEmi", "flow", "flowVersion", "fullName", "heldBy", "holdReason", "id", "landingPath", "loanAmount", "medium", "mobile", "monthlyIncome", "onHold", "ownerDueAt", "ownerId", "panEnc", "panHash", "panMasked", "pincode", "product", "profile", "purpose", "reference", "referralCode", "referrer", "reviewPassedAt", "reviewPassedBy", "source", "stage", "submittedAt", "tenureMonths", "updatedAt", "uploadTokenExpiresAt", "uploadTokenHash" FROM "LoanApplication";
DROP TABLE "LoanApplication";
ALTER TABLE "new_LoanApplication" RENAME TO "LoanApplication";
CREATE UNIQUE INDEX "LoanApplication_reference_key" ON "LoanApplication"("reference");
CREATE UNIQUE INDEX "LoanApplication_uploadTokenHash_key" ON "LoanApplication"("uploadTokenHash");
CREATE INDEX "LoanApplication_mobile_idx" ON "LoanApplication"("mobile");
CREATE INDEX "LoanApplication_panHash_idx" ON "LoanApplication"("panHash");
CREATE INDEX "LoanApplication_stage_createdAt_idx" ON "LoanApplication"("stage", "createdAt");
CREATE INDEX "LoanApplication_ownerId_stage_idx" ON "LoanApplication"("ownerId", "stage");
CREATE INDEX "LoanApplication_stage_purgeAfter_idx" ON "LoanApplication"("stage", "purgeAfter");
CREATE TABLE "new_StaffAccount" (
    "username" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "banks" TEXT NOT NULL DEFAULT '[]',
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfaSecretEnc" TEXT,
    "mfaEnabledAt" DATETIME,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "lastLoginAt" DATETIME,
    "passwordChangedAt" DATETIME,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_StaffAccount" ("active", "banks", "createdAt", "createdBy", "name", "passwordHash", "role", "updatedAt", "username") SELECT "active", "banks", "createdAt", "createdBy", "name", "passwordHash", "role", "updatedAt", "username" FROM "StaffAccount";
DROP TABLE "StaffAccount";
ALTER TABLE "new_StaffAccount" RENAME TO "StaffAccount";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "StaffSession_tokenHash_key" ON "StaffSession"("tokenHash");

-- CreateIndex
CREATE INDEX "StaffSession_username_idx" ON "StaffSession"("username");

-- CreateIndex
CREATE INDEX "OtpChallenge_mobile_createdAt_idx" ON "OtpChallenge"("mobile", "createdAt");

-- CreateIndex
CREATE INDEX "OtpChallenge_ip_createdAt_idx" ON "OtpChallenge"("ip", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantSession_tokenHash_key" ON "ApplicantSession"("tokenHash");

-- CreateIndex
CREATE INDEX "ApplicantSession_mobile_idx" ON "ApplicantSession"("mobile");

-- CreateIndex
CREATE INDEX "MessageLog_status_createdAt_idx" ON "MessageLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_applicationId_idx" ON "MessageLog"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_reference_key" ON "SupportTicket"("reference");

-- CreateIndex
CREATE INDEX "SupportTicket_status_dueAt_idx" ON "SupportTicket"("status", "dueAt");

-- CreateIndex
CREATE INDEX "SupportTicket_mobile_idx" ON "SupportTicket"("mobile");

-- CreateIndex
CREATE INDEX "SupportTicketEvent_ticketId_createdAt_idx" ON "SupportTicketEvent"("ticketId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Article_slug_key" ON "Article"("slug");

-- CreateIndex
CREATE INDEX "Article_status_idx" ON "Article"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleRevision_articleId_version_key" ON "ArticleRevision"("articleId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Redirect_fromPath_key" ON "Redirect"("fromPath");

-- CreateIndex
CREATE INDEX "PurgeLog_createdAt_idx" ON "PurgeLog"("createdAt");

-- Every version saved before drafts existed went live when it was saved.
UPDATE "SiteContentVersion" SET "publishedAt" = "createdAt", "publishedBy" = "createdBy" WHERE "publishedAt" IS NULL;
