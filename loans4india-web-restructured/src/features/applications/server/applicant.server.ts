import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/db";
import { hashToken } from "@/features/applicant-portal/server/uploadToken.server";
import { detailValues } from "./details.server";
import { getLiveFlow } from "@/features/applicant-flow/server/applicantFlow.server";
import { applicantMobile } from "@/features/applicant-auth/server/applicantSession.server";
import { brand } from "@/shared/config/brand";

type Tx = Prisma.TransactionClient;

export const APPLICANT_INCLUDE = {
  documents: { where: { status: { not: "REMOVED" } }, orderBy: { createdAt: "asc" } },
  consents: { orderBy: { createdAt: "asc" } },
  tasks: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" } },
  attempts: { orderBy: { createdAt: "asc" } },
  bankStatuses: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.LoanApplicationInclude;

/** Applicant-facing reference, e.g. LFI-7K3P9Q (no 0/O/1/I/L). */
export const REFERENCE_RE = /^LFI-[2-9A-HJKMNP-Z]{6}$/;

/**
 * The application an applicant may act on, or null. Two ways in:
 *  - a reference (LFI-XXXXXX) plus an OTP session for the same mobile (Platform Flow v4, section 4);
 *  - the older secret link token (staff can still issue one by hand while SMS isn't connected).
 * Object-level check: a reference alone is never enough, the session's verified mobile must own the application.
 * Closed applications stay readable; purged ones don't exist any more for the applicant.
 */
export async function applicantApp(key: string) {
  let app;
  if (REFERENCE_RE.test(key)) {
    const mobile = await applicantMobile();
    if (!mobile) return null;
    app = await prisma.loanApplication.findUnique({ where: { reference: key }, include: APPLICANT_INCLUDE });
    if (!app || app.mobile !== mobile) return null;
  } else {
    if (!/^[A-Za-z0-9_-]{40,60}$/.test(key)) return null;
    app = await prisma.loanApplication.findUnique({ where: { uploadTokenHash: hashToken(key) }, include: APPLICANT_INCLUDE });
    if (!app || !app.uploadTokenExpiresAt || app.uploadTokenExpiresAt < new Date()) return null;
  }
  if (app.purgedAt) return null;
  // Dormancy timers count from the applicant's last visit (section 26); one write per hour at most.
  if (!app.lastApplicantAt || Date.now() - app.lastApplicantAt.getTime() > 3600e3) {
    await prisma.loanApplication.update({ where: { id: app.id }, data: { lastApplicantAt: new Date() } });
  }
  // The live flow names the banks on a re-consent screen; the application's own flow decides its form and checklist.
  return { ...app, live: await getLiveFlow() };
}
export type ApplicantApp = NonNullable<Awaited<ReturnType<typeof applicantApp>>>;

/**
 * Applicant-facing messages (section 42). Each one is recorded as due in the timeline (staff see it) and queued in the
 * delivery log; `npm run jobs` sends queued messages through the SMS provider outside quiet hours. A message is never
 * marked SENT unless a provider accepted it. Messages carry only the reference and a sign-in link, never personal details.
 */
export async function queueMessage(tx: Tx, applicationId: string, template: string, vars: Record<string, string> = {}) {
  await tx.applicationEvent.create({ data: { applicationId, type: "MESSAGE_DUE", actor: "system", detail: JSON.stringify({ template, ...vars }) } });
  const render = MESSAGE_TEMPLATES[template];
  const app = await tx.loanApplication.findUnique({ where: { id: applicationId }, select: { mobile: true } });
  if (!render || !app) return;
  await tx.messageLog.create({
    data: { applicationId, template, channel: "SMS", recipient: `******${app.mobile.slice(-4)}`, body: `${render(vars)} ${brand.siteUrl}/my -${brand.name}` },
  });
}

export const MESSAGE_TEMPLATES: Record<string, (v: Record<string, string>) => string> = {
  RECEIVED: (v) => `Application ${v.reference} received and under review. Sign in with your mobile to see progress:`,
  ACTION_NEEDED: (v) => `Action needed on application ${v.reference}. Sign in with your mobile to see what's needed:`,
  RE_CONSENT: (v) => `Please review and confirm the updated consent for application ${v.reference}. Sign in:`,
  SUBMITTED_TO_BANK: (v) => `Your application has been submitted to ${v.bank}. Reference: ${v.reference}. Track it:`,
  BANK_MILESTONE: (v) => `Update on application ${v.reference}: ${v.status}. Details:`,
  REROUTED: (v) => `${v.fromBank} could not approve application ${v.reference}; we are now submitting it to ${v.toBank}. Track it:`,
  DISBURSED: (v) => `Your loan from ${v.bank} has been disbursed (application ${v.reference}). Details:`,
  CLOSED: (v) => `Application ${v.reference} is closed. Details:`,
  REMINDER: (v) => `Your application ${v.reference} isn't finished yet. Continue where you left off:`,
};

/** Freeze what the applicant submitted: field values (identifiers masked) and document versions, with a content hash. */
export async function freezeSnapshot(tx: Tx, applicationId: string, reason: "SUBMITTED" | "ACTION_RESPONSE") {
  const app = await tx.loanApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { documents: { where: { status: { notIn: ["REMOVED", "REJECTED"] } }, orderBy: { createdAt: "asc" } } },
  });
  const data = {
    reference: app.reference,
    product: app.product,
    fields: detailValues(app),
    documents: app.documents.map((d) => ({ id: d.id, slot: d.slot, sha256: d.sha256, status: d.status })),
  };
  const json = JSON.stringify(data);
  const last = await tx.applicationSnapshot.findFirst({ where: { applicationId }, orderBy: { version: "desc" }, select: { version: true } });
  const version = (last?.version ?? 0) + 1;
  const contentHash = createHash("sha256").update(json).digest("hex");
  await tx.applicationSnapshot.create({ data: { applicationId, version, contentHash, data: json, reason } });
  await tx.applicationEvent.create({ data: { applicationId, type: "SNAPSHOT_FROZEN", actor: "system", detail: JSON.stringify({ version, contentHash: contentHash.slice(0, 16), reason }) } });
  return { version, contentHash };
}

const OPEN_STATES = { not: "CLOSED" };

/**
 * Intake checks right after submit (section 11). They only raise flags for a person; nothing is merged or rejected automatically.
 */
export async function intakeChecks(tx: Tx, applicationId: string) {
  const app = await tx.loanApplication.findUniqueOrThrow({ where: { id: applicationId }, include: { consents: { take: 1, orderBy: { createdAt: "asc" } } } });
  const flags: { type: string; detail: string }[] = [];
  if (app.panHash) {
    const others = await tx.loanApplication.findMany({ where: { panHash: app.panHash, id: { not: app.id }, stage: OPEN_STATES }, select: { reference: true } });
    if (others.length) flags.push({ type: "DUPLICATE_PAN", detail: `Same PAN on open application ${others.map((o) => o.reference).join(", ")}` });
  }
  const sameMobile = await tx.loanApplication.findMany({ where: { mobile: app.mobile, id: { not: app.id }, stage: OPEN_STATES }, select: { reference: true } });
  if (sameMobile.length) flags.push({ type: "DUPLICATE_MOBILE", detail: `Same mobile on open application ${sameMobile.map((o) => o.reference).join(", ")}` });
  const ip = app.consents[0]?.ipAddress;
  if (ip && ip !== "unknown") {
    const since = new Date(Date.now() - 24 * 3600e3);
    const fromIp = await tx.consentRecord.findMany({ where: { ipAddress: ip, purpose: "PROCESS_APPLICATION", createdAt: { gte: since } }, select: { applicationId: true }, distinct: ["applicationId"] });
    if (fromIp.length >= 5) flags.push({ type: "VELOCITY_IP", detail: `${fromIp.length} applications from the same network in 24 hours` });
  }
  for (const f of flags) {
    const exists = await tx.applicationFlag.findFirst({ where: { applicationId, type: f.type, status: "OPEN" } });
    if (exists) continue;
    await tx.applicationFlag.create({ data: { applicationId, type: f.type, detail: f.detail, raisedBy: "system" } });
    await tx.applicationEvent.create({ data: { applicationId, type: "FLAG_RAISED", actor: "system", detail: JSON.stringify({ flag: f.type }) } });
  }
  return flags;
}

/** Latest bank-confirmed status of an attempt: checked milestones only, superseded rows ignored. */
export function confirmedBankStatus(rows: { id: string; attemptId: string; status: string; needsCheck: boolean; checkedAt: Date | null; supersedesId: string | null; createdAt: Date }[], attemptId: string | null) {
  if (!attemptId) return null;
  const superseded = new Set(rows.map((r) => r.supersedesId).filter(Boolean) as string[]);
  const valid = rows.filter((r) => r.attemptId === attemptId && !superseded.has(r.id) && (!r.needsCheck || r.checkedAt));
  return valid.sort((a, b) => +a.createdAt - +b.createdAt).pop() ?? null;
}

/** Milestones recorded but not yet confirmed by a second person (section 19 step 7). */
export function pendingChecks<T extends { id: string; needsCheck: boolean; checkedAt: Date | null; supersedesId: string | null }>(rows: T[]): T[] {
  const superseded = new Set(rows.map((r) => r.supersedesId).filter(Boolean) as string[]);
  return rows.filter((r) => r.needsCheck && !r.checkedAt && !r.supersedesId && !superseded.has(r.id));
}
