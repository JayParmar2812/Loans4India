-- Append-only records (Platform Flow v4, section 39): consent, audit, snapshots, bank-confirmed status,
-- ticket history, article revisions and purge proof can never be edited or deleted, by the app or by anyone with DB access
-- through the app's connection. Corrections are new rows.
-- (Postgres: replace with BEFORE UPDATE OR DELETE triggers and revoke UPDATE/DELETE from the app role.)

CREATE TRIGGER "ConsentRecord_no_update" BEFORE UPDATE ON "ConsentRecord" BEGIN SELECT RAISE(ABORT, 'ConsentRecord is append-only'); END;
CREATE TRIGGER "ConsentRecord_no_delete" BEFORE DELETE ON "ConsentRecord" BEGIN SELECT RAISE(ABORT, 'ConsentRecord is append-only'); END;

CREATE TRIGGER "ApplicationEvent_no_update" BEFORE UPDATE ON "ApplicationEvent" BEGIN SELECT RAISE(ABORT, 'ApplicationEvent is append-only'); END;
CREATE TRIGGER "ApplicationEvent_no_delete" BEFORE DELETE ON "ApplicationEvent" BEGIN SELECT RAISE(ABORT, 'ApplicationEvent is append-only'); END;

CREATE TRIGGER "AdminEvent_no_update" BEFORE UPDATE ON "AdminEvent" BEGIN SELECT RAISE(ABORT, 'AdminEvent is append-only'); END;
CREATE TRIGGER "AdminEvent_no_delete" BEFORE DELETE ON "AdminEvent" BEGIN SELECT RAISE(ABORT, 'AdminEvent is append-only'); END;

CREATE TRIGGER "SupportTicketEvent_no_update" BEFORE UPDATE ON "SupportTicketEvent" BEGIN SELECT RAISE(ABORT, 'SupportTicketEvent is append-only'); END;
CREATE TRIGGER "SupportTicketEvent_no_delete" BEFORE DELETE ON "SupportTicketEvent" BEGIN SELECT RAISE(ABORT, 'SupportTicketEvent is append-only'); END;

CREATE TRIGGER "ArticleRevision_no_update" BEFORE UPDATE ON "ArticleRevision" BEGIN SELECT RAISE(ABORT, 'ArticleRevision is append-only'); END;
CREATE TRIGGER "ArticleRevision_no_delete" BEFORE DELETE ON "ArticleRevision" BEGIN SELECT RAISE(ABORT, 'ArticleRevision is append-only'); END;

CREATE TRIGGER "PurgeLog_no_update" BEFORE UPDATE ON "PurgeLog" BEGIN SELECT RAISE(ABORT, 'PurgeLog is append-only'); END;
CREATE TRIGGER "PurgeLog_no_delete" BEFORE DELETE ON "PurgeLog" BEGIN SELECT RAISE(ABORT, 'PurgeLog is append-only'); END;

-- Snapshots hold personal data, so the purge job may blank one (and only to the purge marker). Nothing else changes them.
CREATE TRIGGER "ApplicationSnapshot_no_update" BEFORE UPDATE ON "ApplicationSnapshot"
WHEN NEW."data" <> '{"purged":true}' OR NEW."contentHash" IS NOT OLD."contentHash" OR NEW."version" IS NOT OLD."version" OR NEW."applicationId" IS NOT OLD."applicationId"
BEGIN SELECT RAISE(ABORT, 'ApplicationSnapshot is append-only'); END;
CREATE TRIGGER "ApplicationSnapshot_no_delete" BEFORE DELETE ON "ApplicationSnapshot" BEGIN SELECT RAISE(ABORT, 'ApplicationSnapshot is append-only'); END;

-- Bank-confirmed status: the only allowed change is the one-time second-person check stamp (section 19 step 7).
CREATE TRIGGER "BankStatusEvent_no_update" BEFORE UPDATE ON "BankStatusEvent"
WHEN OLD."checkedAt" IS NOT NULL
  OR NEW."status" IS NOT OLD."status" OR NEW."source" IS NOT OLD."source" OR NEW."attemptId" IS NOT OLD."attemptId"
  OR NEW."applicationId" IS NOT OLD."applicationId" OR NEW."evidenceKey" IS NOT OLD."evidenceKey" OR NEW."bankWording" IS NOT OLD."bankWording"
  OR NEW."reasonCode" IS NOT OLD."reasonCode" OR NEW."amount" IS NOT OLD."amount" OR NEW."ratePct" IS NOT OLD."ratePct"
  OR NEW."tenureMonths" IS NOT OLD."tenureMonths" OR NEW."loanAccountLast4" IS NOT OLD."loanAccountLast4" OR NEW."eventDate" IS NOT OLD."eventDate"
  OR NEW."recordedBy" IS NOT OLD."recordedBy" OR NEW."needsCheck" IS NOT OLD."needsCheck" OR NEW."supersedesId" IS NOT OLD."supersedesId"
  OR NEW."supersedeReason" IS NOT OLD."supersedeReason" OR NEW."createdAt" IS NOT OLD."createdAt"
BEGIN SELECT RAISE(ABORT, 'BankStatusEvent is append-only'); END;
CREATE TRIGGER "BankStatusEvent_no_delete" BEFORE DELETE ON "BankStatusEvent" BEGIN SELECT RAISE(ABORT, 'BankStatusEvent is append-only'); END;
