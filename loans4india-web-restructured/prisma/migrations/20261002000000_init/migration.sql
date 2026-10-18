-- CreateTable
CREATE TABLE "LoanApplication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "stage" TEXT NOT NULL DEFAULT 'ENQUIRY',
    "product" TEXT NOT NULL,
    "loanAmount" INTEGER NOT NULL,
    "tenureMonths" INTEGER,
    "purpose" TEXT,
    "fullName" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "city" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "employerName" TEXT,
    "monthlyIncome" INTEGER NOT NULL,
    "existingEmi" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "landingPath" TEXT,
    "referrer" TEXT,
    "closedReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "noticeVersion" TEXT NOT NULL,
    "noticeText" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "applicationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApplicationEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "LoanApplication" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "LoanApplication_reference_key" ON "LoanApplication"("reference");

-- CreateIndex
CREATE INDEX "LoanApplication_mobile_idx" ON "LoanApplication"("mobile");

-- CreateIndex
CREATE INDEX "LoanApplication_stage_createdAt_idx" ON "LoanApplication"("stage", "createdAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_applicationId_idx" ON "ConsentRecord"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationEvent_applicationId_createdAt_idx" ON "ApplicationEvent"("applicationId", "createdAt");
