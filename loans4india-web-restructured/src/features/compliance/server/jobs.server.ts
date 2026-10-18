import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";
import { deleteStored } from "@/shared/storage/storage.server";
import { smsProvider } from "@/shared/messaging/sms.server";
import { queueMessage } from "@/features/applications/server/applicant.server";
import { BEFORE_SUBMIT_STATES, DORMANCY, inQuietHours, JOB_VERSION, retention } from "@/features/compliance/domain/retention";

/**
 * Background jobs (Platform Flow v4, sections 26, 42, 43). Run them with `npm run jobs` from a scheduler (cron,
 * Task Scheduler, a platform cron) every 15 minutes or so; each job is safe to run again (idempotent).
 * Every change writes an audit event as "system:jobs" in the same transaction.
 */
type Tx = Prisma.TransactionClient;
const ACTOR = "system:jobs";
const DAY = 864e5;

async function event(tx: Tx, applicationId: string, type: string, detail: Record<string, unknown>) {
  await tx.applicationEvent.create({ data: { applicationId, type, actor: ACTOR, detail: JSON.stringify(detail) } });
}

async function closeDormant(tx: Tx, app: { id: string; stage: string; reference: string }, note: string) {
  const moved = await tx.loanApplication.updateMany({ where: { id: app.id, stage: app.stage }, data: { stage: "CLOSED", closedReason: "DORMANT", closedNote: note, closedAt: new Date(), onHold: false } });
  if (!moved.count) return false; // someone moved it meanwhile
  await tx.applicationTask.updateMany({ where: { applicationId: app.id, status: "OPEN" }, data: { status: "CANCELLED" } });
  await tx.bankAttempt.updateMany({ where: { applicationId: app.id, state: { in: ["PREPARING", "READY_TO_SUBMIT"] } }, data: { state: "CLOSED" } });
  await event(tx, app.id, "STAGE_CHANGED", { from: app.stage, to: "CLOSED", note, reason: "DORMANT" });
  await queueMessage(tx, app.id, "CLOSED", { reference: app.reference });
  return true;
}

/** Section 26: reminders, then auto-close as DORMANT. Never touches an application that has reached a bank. */
export async function runDormancy(now = new Date()) {
  const out = { reminded: 0, closed: 0 };
  // 1. Still filling in.
  const filling = await prisma.loanApplication.findMany({
    where: { stage: { in: BEFORE_SUBMIT_STATES }, onHold: false },
    select: { id: true, stage: true, reference: true, createdAt: true, lastApplicantAt: true, events: { where: { type: "REMINDER_QUEUED" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });
  for (const a of filling) {
    const last = a.lastApplicantAt ?? a.createdAt;
    const idle = (now.getTime() - last.getTime()) / DAY;
    if (idle >= DORMANCY.closeAfterDays) {
      if (await prisma.$transaction((tx) => closeDormant(tx, a, `No applicant activity for ${DORMANCY.closeAfterDays} days`))) out.closed++;
    } else if (idle >= DORMANCY.remindAfterDays && !(a.events[0] && a.events[0].createdAt > last)) {
      await prisma.$transaction(async (tx) => {
        await event(tx, a.id, "REMINDER_QUEUED", { idleDays: Math.floor(idle) });
        await queueMessage(tx, a.id, "REMINDER", { reference: a.reference });
      });
      out.reminded++;
    }
  }
  // 2. Action needed before the application reached a bank.
  const waiting = await prisma.loanApplication.findMany({
    where: { stage: "ACTION_NEEDED", onHold: false, attempts: { none: { state: { in: ["SUBMITTED", "OUTCOME_RECEIVED"] } } } },
    select: { id: true, stage: true, reference: true, tasks: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } }, events: { where: { type: "REMINDER_QUEUED" }, select: { createdAt: true } } },
  });
  for (const a of waiting) {
    const since = a.tasks[0]?.createdAt;
    if (!since) continue;
    const age = (now.getTime() - since.getTime()) / DAY;
    if (age >= DORMANCY.actionCloseDays) {
      if (await prisma.$transaction((tx) => closeDormant(tx, a, `No response to the Action needed request for ${DORMANCY.actionCloseDays} days`))) out.closed++;
      continue;
    }
    const sent = a.events.filter((e) => e.createdAt >= since).length;
    const due = DORMANCY.actionReminderDays.filter((d) => age >= d).length;
    if (due > sent) {
      await prisma.$transaction(async (tx) => {
        await event(tx, a.id, "REMINDER_QUEUED", { taskAgeDays: Math.floor(age) });
        await queueMessage(tx, a.id, "ACTION_NEEDED", { reference: a.reference });
      });
      out.reminded++;
    }
  }
  return out;
}

/**
 * Sections 26 and 43: after close, delete documents (close + documentsDays) and remove personal fields
 * (close + profileDays). Legal holds pause both. Consent records, audit events and the purge log stay (no personal data in the log).
 */
export async function runPurge(now = new Date()) {
  const r = retention();
  const out = { documentsPurged: 0, profilesPurged: 0, filesDeleted: 0 };
  const closed = await prisma.loanApplication.findMany({
    where: { stage: "CLOSED", legalHold: false, purgedAt: null, closedAt: { lte: new Date(now.getTime() - r.documentsDays * DAY) } },
    select: { id: true, reference: true, closedAt: true, attempts: { select: { evidenceKey: true } }, bankStatuses: { select: { evidenceKey: true } } },
  });
  for (const a of closed) {
    const docs = await prisma.applicationDocument.findMany({ where: { applicationId: a.id, status: { not: "PURGED" } }, select: { id: true, storageKey: true } });
    let files = 0;
    if (docs.length) {
      for (const d of docs) {
        await deleteStored(d.storageKey);
        files++;
      }
      await prisma.applicationDocument.updateMany({ where: { id: { in: docs.map((d) => d.id) } }, data: { status: "PURGED", originalName: "purged" } });
      out.documentsPurged++;
    }
    const profileDue = a.closedAt!.getTime() + r.profileDays * DAY <= now.getTime();
    const classes = docs.length ? ["DOCUMENTS"] : [];
    if (profileDue) {
      // Evidence screenshots and the bank's emails hold personal data too.
      for (const k of [...a.attempts.map((x) => x.evidenceKey), ...a.bankStatuses.map((x) => x.evidenceKey)].filter((k): k is string => Boolean(k))) {
        await deleteStored(k);
        files++;
      }
      await prisma.$transaction(async (tx) => {
        await tx.loanApplication.update({
          where: { id: a.id },
          data: {
            fullName: null, email: null, city: null, pincode: null, employerName: null, dob: null, profile: null, monthlyIncome: null,
            panEnc: null, panHash: null, panMasked: null, accountEnc: null, accountMasked: null, mobile: "0000000000",
            uploadTokenHash: null, uploadTokenExpiresAt: null, referrer: null, purgedAt: now,
          },
        });
        await tx.applicationSnapshot.updateMany({ where: { applicationId: a.id }, data: { data: '{"purged":true}' } });
        await tx.purgeLog.create({ data: { applicationId: a.id, reference: a.reference, dataClasses: JSON.stringify([...classes, "PROFILE", "IDENTIFIERS", "EVIDENCE"]), filesDeleted: files, jobVersion: JOB_VERSION } });
        await event(tx, a.id, "PURGED", { classes: [...classes, "PROFILE", "IDENTIFIERS", "EVIDENCE"], files });
      });
      out.profilesPurged++;
    } else if (docs.length) {
      await prisma.$transaction(async (tx) => {
        await tx.purgeLog.create({ data: { applicationId: a.id, reference: a.reference, dataClasses: JSON.stringify(classes), filesDeleted: files, jobVersion: JOB_VERSION } });
        await event(tx, a.id, "PURGED", { classes, files });
      });
    }
    out.filesDeleted += files;
  }
  return out;
}

/** Section 42: send queued messages. Held in quiet hours; without a provider they are marked NO_PROVIDER, never SENT. */
export async function runMessages(now = new Date(), limit = 200) {
  const out = { sent: 0, failed: 0, held: 0, noProvider: 0 };
  if (inQuietHours(now)) {
    out.held = await prisma.messageLog.count({ where: { status: "QUEUED" } });
    return out;
  }
  const provider = smsProvider();
  const queued = await prisma.messageLog.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: limit });
  for (const m of queued) {
    if (!provider) {
      await prisma.messageLog.update({ where: { id: m.id }, data: { status: "NO_PROVIDER", error: "No SMS provider configured (DLT pending)" } });
      out.noProvider++;
      continue;
    }
    const app = m.applicationId ? await prisma.loanApplication.findUnique({ where: { id: m.applicationId }, select: { mobile: true, purgedAt: true } }) : null;
    if (!app || app.purgedAt) {
      await prisma.messageLog.update({ where: { id: m.id }, data: { status: "FAILED", error: "No recipient" } });
      out.failed++;
      continue;
    }
    const r = await provider.send(app.mobile, m.body, { template: m.template });
    await prisma.messageLog.update({ where: { id: m.id }, data: r.ok ? { status: "SENT", provider: r.provider, providerRef: r.ref } : { status: "FAILED", provider: r.provider, error: r.error.slice(0, 300) } });
    if (r.ok) out.sent++;
    else out.failed++;
  }
  return out;
}

/** Housekeeping: expired OTP challenges and sessions are deleted (they hold no lasting value). */
export async function runHousekeeping(now = new Date()) {
  const [otp, staff, applicant] = await Promise.all([
    prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - DAY) } } }),
    prisma.staffSession.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: new Date(now.getTime() - 30 * DAY) } }] } }),
    prisma.applicantSession.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { not: null } }] } }),
  ]);
  return { otpDeleted: otp.count, staffSessionsDeleted: staff.count, applicantSessionsDeleted: applicant.count };
}
