import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { hashToken } from "./uploadToken.server";
import { detailValues } from "./details.server";
import { getLiveFlow } from "./applicantFlow.server";

type Tx = Prisma.TransactionClient;

export const APPLICANT_INCLUDE = {
  documents: { where: { status: { not: "REMOVED" } }, orderBy: { createdAt: "asc" } },
  consents: { orderBy: { createdAt: "asc" } },
  tasks: { where: { status: "OPEN" }, orderBy: { createdAt: "asc" } },
  attempts: { orderBy: { createdAt: "asc" } },
  bankStatuses: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.LoanApplicationInclude;

/** The application behind the applicant's secret link, or null if invalid or expired. Closed applications stay readable. */
export async function applicantApp(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null;
  const app = await prisma.loanApplication.findUnique({ where: { uploadTokenHash: hashToken(token) }, include: APPLICANT_INCLUDE });
  if (!app || !app.uploadTokenExpiresAt || app.uploadTokenExpiresAt < new Date()) return null;
  // The live flow names the banks on a re-consent screen; the application's own flow decides its form and checklist.
  return { ...app, live: await getLiveFlow() };
}
export type ApplicantApp = NonNullable<Awaited<ReturnType<typeof applicantApp>>>;

/**
 * Applicant-facing messages (section 42). No SMS/email provider is connected yet, so each message is
 * recorded as due in the timeline for staff to send by hand. Messages carry only the reference, never personal details.
 */
export async function queueMessage(tx: Tx, applicationId: string, template: string, vars: Record<string, string> = {}) {
  await tx.applicationEvent.create({ data: { applicationId, type: "MESSAGE_DUE", actor: "system", detail: JSON.stringify({ template, ...vars }) } });
}

export const MESSAGE_TEMPLATES: Record<string, (v: Record<string, string>) => string> = {
  RECEIVED: (v) => `Application ${v.reference} received and under review. Sign in with your link to see progress.`,
  ACTION_NEEDED: (v) => `Action needed on application ${v.reference}. Please open your application link to see what's needed.`,
  RE_CONSENT: (v) => `Please review and confirm the updated consent for application ${v.reference}.`,
  SUBMITTED_TO_BANK: (v) => `Your application has been submitted to ${v.bank}. Reference: ${v.reference}.`,
  BANK_MILESTONE: (v) => `Update on application ${v.reference}: ${v.status}. Open your application link for details.`,
  REROUTED: (v) => `${v.fromBank} could not approve application ${v.reference}; we are now submitting it to ${v.toBank}.`,
  DISBURSED: (v) => `Your loan from ${v.bank} has been disbursed (application ${v.reference}).`,
  CLOSED: (v) => `Application ${v.reference} is closed.`,
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
