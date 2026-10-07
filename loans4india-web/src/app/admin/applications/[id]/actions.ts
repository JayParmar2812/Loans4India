"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { can, canSeeCase, holdsPortal, isOwnerOrManager, type Permission, type StaffUser } from "@/lib/rbac";
import { actorOf, assignableStaff, currentStaff } from "@/lib/staff.server";
import { REJECT_REASONS } from "@/lib/documents";
import { appFlow, checklistFor, coverage } from "@/config/applicantFlow";
import { getLiveFlow } from "@/lib/applicantFlow.server";
import { buildSlots } from "@/lib/docstate";
import { consentState } from "@/lib/consentState";
import { detailsCheck } from "@/lib/details.server";
import { bankCandidates, gateChecks, SELECTION_BASES } from "@/lib/bankFlow";
import { buildManifest } from "@/lib/bankPackage.server";
import { queueMessage } from "@/lib/applicant.server";
import { checkFile } from "@/lib/filecheck.server";
import { saveEncrypted } from "@/lib/storage.server";
import { newUploadToken } from "@/lib/uploadToken.server";
import { publicBaseUrl } from "@/lib/staff.server";
import { SECTIONS } from "@/lib/profile";
import {
  ACTIVE_ATTEMPT_STATES, BANK_REJECTION_CODES, BANK_STATUS_RANK, CHECKED_BANK_STATUSES, EVIDENCE_SOURCES, MANUAL_CLOSE_REASONS, MAX_REROUTES,
  isBankStatus, isCloseReason, type BankStatus,
} from "@/lib/stages";

type Tx = Prisma.TransactionClient;
export type ActionResult = { ok: boolean; message?: string; url?: string } | null;

/**
 * Every staff action on an application (Platform Flow v4, sections 11-21, 26-37).
 * Each one checks the role, the case scope and the application state on the server, and writes an audit event
 * in the same transaction as the change. Buttons on the page are only a convenience.
 */

const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const fail = (message: string): ActionResult => ({ ok: false, message });
const done = (id: string, message?: string): ActionResult => {
  revalidatePath(`/admin/applications/${id}`);
  revalidatePath("/admin");
  return { ok: true, message };
};

async function event(tx: Tx, applicationId: string, type: string, actor: string, detail: Record<string, unknown> = {}) {
  await tx.applicationEvent.create({ data: { applicationId, type, actor, detail: JSON.stringify(detail) } });
}
async function moveStage(tx: Tx, applicationId: string, from: string, to: string, actor: string, note?: string, extra: Prisma.LoanApplicationUpdateInput = {}) {
  // Optimistic lock: the change only applies if nobody moved the case meanwhile.
  const r = await tx.loanApplication.updateMany({ where: { id: applicationId, stage: from }, data: { stage: to, ...(extra as object) } });
  if (r.count === 0) throw new Error("STALE");
  await event(tx, applicationId, "STAGE_CHANGED", actor, { from, to, note });
}

const CASE_INCLUDE = {
  documents: { where: { status: { not: "REMOVED" } }, orderBy: { createdAt: "asc" } },
  consents: { orderBy: { createdAt: "asc" } },
  tasks: { where: { status: "OPEN" } },
  flags: { where: { status: "OPEN" } },
  attempts: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.LoanApplicationInclude;

/** Load a case the signed-in person may act on with this permission. */
async function guard(id: string, permission: Permission, opts: { ownerOnly?: boolean } = {}) {
  const user = await currentStaff();
  if (!user || !can(user, permission)) return { error: "You don't have permission for this." } as const;
  const app = await prisma.loanApplication.findUnique({ where: { id }, include: CASE_INCLUDE });
  if (!app) return { error: "Application not found." } as const;
  if (!canSeeCase(user, app, app.attempts.map((a) => a.bankId))) return { error: "This case isn't in your scope." } as const;
  if (opts.ownerOnly && !isOwnerOrManager(user, app)) return { error: "Only the case owner or the Ops Manager can do this." } as const;
  return { user, app, actor: actorOf(user) } as const;
}
type Case = Extract<Awaited<ReturnType<typeof guard>>, { app: unknown }>["app"];

const activeAttempt = (app: Case) => app.attempts.find((a) => (ACTIVE_ATTEMPT_STATES as readonly string[]).includes(a.state)) ?? null;
const docViews = (app: Case) => app.documents.map((d) => ({ id: d.id, slot: d.slot, name: d.originalName, sizeBytes: d.sizeBytes, status: d.status, rejectReason: d.rejectReason, createdAt: d.createdAt.toISOString() }));
const acceptedSlots = (app: Case) => buildSlots(appFlow(app), app.employmentType, docViews(app)).filter((s) => s.state === "accepted").map((s) => s.id);

async function run(id: string, fn: () => Promise<ActionResult | void>): Promise<ActionResult> {
  try {
    const r = await fn();
    return r ?? done(id);
  } catch (e) {
    if (e instanceof Error && e.message === "STALE") return fail("This case changed while you were looking at it. Reload and try again.");
    if (e instanceof Error && e.message.startsWith("RULE:")) return fail(e.message.slice(5));
    throw e;
  }
}

// ---------- Section 12: assignment ----------

export async function assignOwner(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "application.assign");
  if ("error" in g) return fail(g.error!);
  const owner = str(f, "owner", 80);
  const due = str(f, "due", 20);
  const reason = str(f, "reason");
  if (!(await assignableStaff()).some((s) => s.username === owner)) return fail("Pick a person who can own cases.");
  if (g.app.ownerId && g.app.ownerId !== owner && !reason) return fail("Give a reason for reassigning.");
  if (g.app.stage === "CLOSED") return fail("This application is closed.");
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      await tx.loanApplication.update({ where: { id }, data: { ownerId: owner, ownerDueAt: due ? new Date(`${due}T18:30:00+05:30`) : null, assignedAt: new Date() } });
      await event(tx, id, g.app.ownerId ? "REASSIGNED" : "ASSIGNED", g.actor, { from: g.app.ownerId, owner, due, note: reason || undefined });
    });
  });
}

// ---------- Section 14: document review and Action needed ----------

export async function reviewDocument(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const docId = str(f, "docId");
  const doc = await prisma.applicationDocument.findUnique({ where: { id: docId }, select: { applicationId: true, slot: true, status: true, id: true } });
  if (!doc) return fail("Document not found.");
  const g = await guard(doc.applicationId, "document.review", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  const decision = str(f, "decision", 20);
  const reason = str(f, "reason", 40);
  const note = str(f, "note", 400);
  if (doc.status !== "UPLOADED") return fail("This file has already been reviewed.");
  if (!["VERIFICATION_REVIEW", "APPLICATION_PREPARATION", "ACTION_NEEDED", "SUBMITTED_TO_BANK"].includes(g.app.stage)) return fail("Documents are reviewed after the applicant submits.");
  const id = g.app.id;
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      if (decision === "ACCEPTED") {
        await tx.applicationDocument.update({ where: { id: docId }, data: { status: "ACCEPTED", rejectReason: null, rejectNote: null, reviewedBy: g.actor, reviewedAt: new Date() } });
        await event(tx, id, "DOCUMENT_ACCEPTED", g.actor, { slot: doc.slot, documentId: docId });
        return;
      }
      if (decision === "FLAG") {
        // Suspected tampering is never discussed with the applicant: flag it and hold the case (section 30).
        await tx.applicationFlag.create({ data: { applicationId: id, type: "TAMPER_SUSPECTED", detail: `${doc.slot}: ${note || "reviewer suspects tampering"}`, raisedBy: g.actor } });
        await tx.loanApplication.update({ where: { id }, data: { onHold: true, holdReason: "Suspected document tampering", heldBy: g.actor } });
        await event(tx, id, "FLAG_RAISED", g.actor, { flag: "TAMPER_SUSPECTED", slot: doc.slot });
        await event(tx, id, "HOLD_SET", g.actor, { note: "Suspected document tampering" });
        return;
      }
      if (decision !== "REJECTED" || !(reason in REJECT_REASONS)) throw new Error("RULE:Pick a reason.");
      if (reason === "OTHER" && !note) throw new Error("RULE:Write what the applicant should do.");
      await tx.applicationDocument.update({ where: { id: docId }, data: { status: "REJECTED", rejectReason: reason, rejectNote: note || null, reviewedBy: g.actor, reviewedAt: new Date() } });
      await event(tx, id, "DOCUMENT_REJECTED", g.actor, { slot: doc.slot, documentId: docId, reason });
      await openTask(tx, g.app, g.actor, { slots: [doc.slot], sections: [], reasonCode: reason, message: note || REJECT_REASONS[reason] });
    });
  });
}

/** Create an Action needed task and hand the case to the applicant (section 14 steps 1-3). */
async function openTask(tx: Tx, app: Case, actor: string, t: { slots: string[]; sections: string[]; reasonCode: string; message: string }) {
  await tx.applicationTask.create({ data: { applicationId: app.id, slots: JSON.stringify(t.slots), fields: JSON.stringify(t.sections), reasonCode: t.reasonCode, message: t.message, createdBy: actor } });
  await event(tx, app.id, "TASK_RAISED", actor, { slots: t.slots, sections: t.sections, reason: t.reasonCode });
  const current = await tx.loanApplication.findUniqueOrThrow({ where: { id: app.id }, select: { stage: true } });
  if (current.stage !== "ACTION_NEEDED") await moveStage(tx, app.id, current.stage, "ACTION_NEEDED", actor, "Action needed from the applicant");
  await queueMessage(tx, app.id, "ACTION_NEEDED", { reference: app.reference });
}

export async function raiseTask(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "task.raise", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  const slots = f.getAll("slots").map(String).filter((s) => checklistFor(appFlow(g.app), g.app.employmentType).some((c) => c.id === s));
  const sections = f.getAll("sections").map(String).filter((s) => s in SECTIONS);
  const message = str(f, "message", 400);
  const reasonCode = str(f, "reasonCode", 40) || "OTHER";
  if (!slots.length && !sections.length) return fail("Pick at least one document or section to unlock.");
  if (message.length < 10) return fail("Write a short instruction in plain words.");
  if (!["VERIFICATION_REVIEW", "APPLICATION_PREPARATION", "ACTION_NEEDED", "SUBMITTED_TO_BANK"].includes(g.app.stage)) return fail("Action needed tasks are raised after the applicant submits.");
  return run(id, () => prisma.$transaction((tx) => openTask(tx, g.app, g.actor, { slots, sections, reasonCode, message })));
}

export async function cancelTask(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const taskId = str(f, "taskId");
  const task = await prisma.applicationTask.findUnique({ where: { id: taskId } });
  if (!task || task.status !== "OPEN") return fail("Task not found.");
  const g = await guard(task.applicationId, "task.raise", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  return run(g.app.id, async () => {
    await prisma.$transaction(async (tx) => {
      await tx.applicationTask.update({ where: { id: taskId }, data: { status: "CANCELLED" } });
      await event(tx, g.app.id, "TASK_CANCELLED", g.actor, { reason: task.reasonCode });
      const left = await tx.applicationTask.count({ where: { applicationId: g.app.id, status: "OPEN" } });
      if (left === 0 && g.app.stage === "ACTION_NEEDED") {
        const withBank = g.app.attempts.some((a) => ["SUBMITTED", "OUTCOME_RECEIVED"].includes(a.state));
        await moveStage(tx, g.app.id, "ACTION_NEEDED", withBank ? "SUBMITTED_TO_BANK" : "VERIFICATION_REVIEW", g.actor, "Task cancelled");
      }
    });
  });
}

/** Owner confirms the file is clean and consistent (section 14 → 15). Not KYC and never a credit judgement. */
export async function passReview(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "review.pass", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  const a = g.app;
  if (a.stage !== "VERIFICATION_REVIEW") return fail("Review can be passed only in Verification review.");
  if (!a.ownerId) return fail("Assign an owner first.");
  if (a.onHold) return fail("The case is on hold.");
  if (a.tasks.length) return fail("There is an open Action needed task.");
  if (a.flags.length) return fail("Clear the open flags first.");
  if (detailsCheck(a).problems.length) return fail("Some application details are missing.");
  const required = checklistFor(appFlow(a), a.employmentType).filter((s) => s.required).map((s) => s.id as string);
  const accepted = acceptedSlots(a);
  const missing = required.filter((s) => !(accepted as string[]).includes(s));
  if (missing.length) return fail("Accept every required document first.");
  if (a.documents.some((d) => d.status === "UPLOADED")) return fail("Some files are still waiting for review.");
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      await tx.loanApplication.update({ where: { id }, data: { reviewPassedAt: new Date(), reviewPassedBy: g.actor } });
      await event(tx, id, "REVIEW_PASSED", g.actor);
      // A package already being prepared (the case came back for a fix) continues where it was.
      if (activeAttempt(a)?.state === "PREPARING") await moveStage(tx, id, "VERIFICATION_REVIEW", "APPLICATION_PREPARATION", g.actor, "Back to preparation");
    });
  });
}

// ---------- Section 5: re-consent ----------

export async function requestReconsent(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "consent.request", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  if (["CLOSED", "CONSENT_PENDING", "SUBMITTED_TO_BANK", "READY_FOR_BANK"].includes(g.app.stage)) return fail("Re-consent can't be requested at this stage.");
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      await event(tx, id, "RECONSENT_REQUESTED", g.actor, { from: g.app.stage });
      await moveStage(tx, id, g.app.stage, "CONSENT_PENDING", g.actor, "Asked the applicant to confirm the updated bank list");
      await queueMessage(tx, id, "RE_CONSENT", { reference: g.app.reference });
    });
  });
}

// ---------- Section 15: bank selection ----------

export async function selectBank(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "bank.select", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  const bankId = str(f, "bankId", 60);
  const basis = str(f, "basis", 40);
  const note = str(f, "note", 300);
  const a = g.app;
  if (a.stage !== "VERIFICATION_REVIEW" || !a.reviewPassedAt) return fail("Pass review first.");
  if (activeAttempt(a)) return fail("This application already has an active bank attempt.");
  if (!(basis in SELECTION_BASES)) return fail("Record why you picked this bank.");
  const consent = consentState(a.consents);
  if (!consent.valid) return fail("Consent is not valid.");
  const tried = a.attempts.map((t) => t.bankId);
  if (a.attempts.filter((t) => ["SUPERSEDED", "RETURNED_OR_FAILED"].includes(t.state)).length > MAX_REROUTES) return fail(`This application has already been tried with ${MAX_REROUTES + 1} banks.`);
  const { flow } = await getLiveFlow();
  const cand = bankCandidates({ coverage: coverage(flow, a.product), consentBankIds: consent.bankIds, values: detailsCheck(a).values, triedBankIds: tried }).find((c) => c.bank.id === bankId);
  if (!cand?.ok) return fail(cand ? `This bank can't take the file: ${cand.reasons.join("; ")}.` : "Unknown bank.");
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      const basisText = `${SELECTION_BASES[basis as keyof typeof SELECTION_BASES]}${note ? `: ${note}` : ""}`;
      await tx.bankAttempt.create({ data: { applicationId: id, bankId, bankName: cand.bank.name, selectionBasis: basisText, selectedBy: g.actor, templateVersion: cand.bank.template.version } });
      await event(tx, id, "BANK_SELECTED", g.actor, { bank: cand.bank.name, note: basisText });
      await moveStage(tx, id, "VERIFICATION_REVIEW", "APPLICATION_PREPARATION", g.actor);
    });
  });
}

// ---------- Sections 16-17: package and gate ----------

export async function sendToGate(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "package.send_to_gate", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  const att = activeAttempt(g.app);
  if (g.app.stage !== "APPLICATION_PREPARATION" || att?.state !== "PREPARING") return fail("Nothing is being prepared.");
  const m = await buildManifest(id, att.bankId);
  const missingFields = m.mapped.filter((x) => x.required && !x.value);
  if (missingFields.length) return fail(`The package checklist isn't complete: ${missingFields.map((x) => x.bankField).join(", ")}.`);
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      await tx.bankAttempt.update({ where: { id: att.id }, data: { preparedBy: g.actor, sentToGateAt: new Date(), sendBackReason: null } });
      await event(tx, id, "SENT_TO_GATE", g.actor, { bank: att.bankName });
      await moveStage(tx, id, "APPLICATION_PREPARATION", "INTERNAL_REVIEW", g.actor);
    });
  });
}

export async function gateDecision(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "gate.approve");
  if ("error" in g) return fail(g.error!);
  const decision = str(f, "decision", 20);
  const att = activeAttempt(g.app);
  if (g.app.stage !== "INTERNAL_REVIEW" || att?.state !== "PREPARING") return fail("Nothing is waiting at the gate.");
  if (decision === "SEND_BACK") {
    const reason = str(f, "reason", 400);
    if (!reason) return fail("Say what needs fixing.");
    return run(id, async () => {
      await prisma.$transaction(async (tx) => {
        await tx.bankAttempt.update({ where: { id: att.id }, data: { sendBackReason: reason, preparedBy: null, sentToGateAt: null } });
        await event(tx, id, "GATE_SENT_BACK", g.actor, { bank: att.bankName, note: reason });
        await moveStage(tx, id, "INTERNAL_REVIEW", "APPLICATION_PREPARATION", g.actor);
      });
    });
  }
  if (decision !== "APPROVE") return fail("Pick approve or send back.");
  // The server runs all eight checks again at the moment of approval.
  const m = await buildManifest(id, att.bankId);
  const consent = consentState(g.app.consents);
  const checks = gateChecks({
    consentValid: consent.valid, consentBankIds: consent.bankIds, bankId: att.bankId, mapped: m.mapped, flow: appFlow(g.app), employmentType: g.app.employmentType,
    acceptedSlots: acceptedSlots(g.app), openTasks: g.app.tasks.length, onHold: g.app.onHold, openFlags: g.app.flags.length,
    templateVersion: m.manifest.templateVersion, preparedBy: att.preparedBy, approver: g.actor,
  });
  const failed = checks.filter((c) => !c.ok);
  if (failed.length) return fail(`Blocked by check ${failed.map((c) => `${c.id} (${c.label}${c.detail ? `: ${c.detail}` : ""})`).join("; ")}.`);
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "READY_TO_SUBMIT", approvedBy: g.actor, approvedAt: new Date(), manifest: m.json, packageHash: m.hash, templateVersion: m.manifest.templateVersion } });
      await event(tx, id, "GATE_APPROVED", g.actor, { bank: att.bankName, packageHash: m.hash.slice(0, 16) });
      await moveStage(tx, id, "INTERNAL_REVIEW", "READY_FOR_BANK", g.actor);
    });
  });
}

// ---------- Section 18: bank portal entry ----------

const EVIDENCE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

async function storeEvidence(file: FormDataEntryValue | null): Promise<{ key: string; name: string } | { error: string }> {
  if (!(file instanceof File) || file.size === 0) return { error: "Attach the evidence (screenshot or the bank's email as PDF)." };
  const buf = Buffer.from(await file.arrayBuffer());
  const c = checkFile(buf);
  if (!c.ok || !EVIDENCE_TYPES.includes(c.type.mime)) return { error: c.ok ? "Evidence must be a PDF, JPG or PNG." : c.error };
  return { key: await saveEncrypted(buf), name: file.name.replace(/[^\w .-]+/g, "").slice(0, 80) || `evidence.${c.type.ext}` };
}

/** Operator, before entry: re-check consent and that nothing changed since approval; otherwise send the case back. */
async function portalPrecheck(g: { app: Case; actor: string; user: StaffUser }, att: NonNullable<ReturnType<typeof activeAttempt>>) {
  if (!holdsPortal(g.user, att.bankId)) return "You don't hold a portal login for this bank.";
  if (att.preparedBy === g.actor) return "You prepared this package, so another operator must enter it.";
  const consent = consentState(g.app.consents);
  if (!consent.valid || !consent.bankIds.includes(att.bankId)) return "Consent no longer covers this bank. Entry is blocked.";
  const m = await buildManifest(g.app.id, att.bankId);
  if (m.hash !== att.packageHash) {
    await prisma.$transaction(async (tx) => {
      await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "PREPARING", approvedBy: null, approvedAt: null, preparedBy: null, sendBackReason: "Package changed after approval" } });
      await event(tx, g.app.id, "PACKAGE_UNFROZEN", "system", { bank: att.bankName, note: "Package changed after approval; back to preparation" });
      await moveStage(tx, g.app.id, "READY_FOR_BANK", "APPLICATION_PREPARATION", "system");
    });
    return "The package changed after approval, so it went back to preparation.";
  }
  return null;
}

export async function recordSubmission(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "portal.submit");
  if ("error" in g) return fail(g.error!);
  const att = activeAttempt(g.app);
  if (g.app.stage !== "READY_FOR_BANK" || att?.state !== "READY_TO_SUBMIT") return fail("Nothing is ready to submit.");
  const bankReference = str(f, "bankReference", 60);
  const branch = str(f, "branch", 80);
  if (!bankReference) return fail("Paste the bank's application / lead reference.");
  if (f.get("attest") !== "on") return fail('Tick "I submitted this personally".');
  const pre = await portalPrecheck(g, att);
  if (pre) return fail(pre);
  const dup = await prisma.bankAttempt.findFirst({ where: { bankId: att.bankId, bankReference } });
  if (dup) return fail("This bank reference is already recorded on another application.");
  const ev = await storeEvidence(f.get("evidence"));
  if ("error" in ev) return fail(ev.error);
  return run(id, async () => {
    // One transaction: attempt SUBMITTED, application SUBMITTED_TO_BANK, bank status RECEIVED (source: portal).
    await prisma.$transaction(async (tx) => {
      await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "SUBMITTED", bankReference, branch: branch || null, submittedBy: g.actor, submittedAt: new Date(), evidenceKey: ev.key } });
      await tx.bankStatusEvent.create({ data: { applicationId: id, attemptId: att.id, status: "RECEIVED", source: "PORTAL", evidenceKey: ev.key, evidenceName: ev.name, recordedBy: g.actor } });
      await event(tx, id, "BANK_SUBMISSION_RECORDED", g.actor, { bank: att.bankName, bankReference, attested: true });
      await moveStage(tx, id, "READY_FOR_BANK", "SUBMITTED_TO_BANK", g.actor, `${att.bankName} ref ${bankReference}`);
      const rerouted = g.app.attempts.find((x) => x.state === "SUPERSEDED");
      if (rerouted) await queueMessage(tx, id, "REROUTED", { reference: g.app.reference, fromBank: rerouted.bankName, toBank: att.bankName });
      else await queueMessage(tx, id, "SUBMITTED_TO_BANK", { reference: g.app.reference, bank: att.bankName });
    });
  });
}

export async function recordEntryFailed(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "portal.submit");
  if ("error" in g) return fail(g.error!);
  const att = activeAttempt(g.app);
  if (att?.state !== "READY_TO_SUBMIT") return fail("Nothing is ready to submit.");
  if (!holdsPortal(g.user, att.bankId)) return fail("You don't hold a portal login for this bank.");
  const kind = str(f, "kind", 20);
  const reason = str(f, "reason", 400);
  const partial = str(f, "partialCheck", 400);
  if (!reason) return fail("Write what happened.");
  if (kind === "PORTAL_REJECTED") {
    // The bank's portal refused the file (e.g. PIN code not serviced): back to bank selection, counts as a re-route.
    return run(id, async () => {
      await prisma.$transaction(async (tx) => {
        await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "RETURNED_OR_FAILED", outcomeNote: reason } });
        await event(tx, id, "PORTAL_RETURNED", g.actor, { bank: att.bankName, note: reason });
        await moveStage(tx, id, "READY_FOR_BANK", "VERIFICATION_REVIEW", g.actor, "Back to bank selection");
      });
    });
  }
  if (!partial) return fail("Before retrying, search the bank portal for a partial or duplicate lead and record what you found.");
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.bankAttempt.update({ where: { id: att.id }, data: { failedTries: { increment: 1 } } });
      await event(tx, id, "PORTAL_ENTRY_FAILED", g.actor, { bank: att.bankName, note: `${reason} · partial-entry check: ${partial}`, tries: updated.failedTries });
      if (updated.failedTries >= 3) await event(tx, id, "ESCALATED", "system", { note: `Portal entry failed ${updated.failedTries} times; Ops Manager to decide` });
    });
  });
}

// ---------- Sections 19-23: bank updates from evidence ----------

export async function recordBankStatus(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "bank_status.record");
  if ("error" in g) return fail(g.error!);
  const att = g.app.attempts.find((a) => ["SUBMITTED", "OUTCOME_RECEIVED"].includes(a.state));
  if (!att) return fail("No submission is with a bank.");
  if (g.user.role === "OPS_EXECUTIVE" && g.app.ownerId !== g.user.username) return fail("Only the case owner can record bank updates.");
  const status = str(f, "status", 30);
  const source = str(f, "source", 30);
  if (!isBankStatus(status)) return fail("Pick the bank status.");
  if (!(source in EVIDENCE_SOURCES)) return fail("Pick where the evidence came from.");
  const wording = str(f, "bankWording", 400);
  const reasonCode = str(f, "reasonCode", 40);
  const backwardReason = str(f, "backwardReason", 300);
  if (status === "REJECTED" && (!wording || !(reasonCode in BANK_REJECTION_CODES))) return fail("Record the bank's own words and a reason code.");
  if (status === "QUERY" && !wording) return fail("Copy the bank's query word for word.");
  const prev = await prisma.bankStatusEvent.findMany({ where: { attemptId: att.id }, orderBy: { createdAt: "asc" } });
  const last = prev.filter((p) => !p.needsCheck || p.checkedAt).pop();
  if (last && isBankStatus(last.status) && BANK_STATUS_RANK[status] < BANK_STATUS_RANK[last.status as BankStatus] && !backwardReason) {
    return fail(`The status would move backwards from ${last.status}. Give a reason.`);
  }
  const amount = Number(str(f, "amount", 15).replace(/\D/g, "")) || null;
  const rate = Number(str(f, "rate", 8)) || null;
  const tenure = Number(str(f, "tenure", 4)) || null;
  const acc = str(f, "loanAccountLast4", 4).replace(/\D/g, "") || null;
  const eventDate = str(f, "eventDate", 10) || null;
  if (status === "DISBURSED") {
    if (!amount || !eventDate || !acc) return fail("Record the disbursed amount, date and last 4 digits of the loan account.");
    const sanctioned = prev.filter((p) => p.status === "SANCTIONED" && p.checkedAt && p.amount).pop();
    if (sanctioned?.amount && amount > sanctioned.amount) return fail("Disbursed amount is above the sanctioned amount. Check the evidence.");
  }
  const ev = await storeEvidence(f.get("evidence"));
  if ("error" in ev) return fail(ev.error);
  const needsCheck = (CHECKED_BANK_STATUSES as readonly string[]).includes(status);
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      const row = await tx.bankStatusEvent.create({
        data: {
          applicationId: id, attemptId: att.id, status, source, evidenceKey: ev.key, evidenceName: ev.name, bankWording: wording || null, reasonCode: reasonCode || null,
          amount, ratePct: rate, tenureMonths: tenure, loanAccountLast4: acc, eventDate, recordedBy: g.actor, needsCheck, supersedeReason: backwardReason || null,
        },
      });
      await event(tx, id, "BANK_STATUS_RECORDED", g.actor, { bank: att.bankName, status, source, needsCheck });
      if (!needsCheck) await applyBankStatus(tx, g.app, att, row.status as BankStatus, g.actor);
    });
  });
}

export async function checkBankStatus(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "bank_status.check");
  if ("error" in g) return fail(g.error!);
  const row = await prisma.bankStatusEvent.findUnique({ where: { id: str(f, "eventId") } });
  if (!row || row.applicationId !== id || !row.needsCheck || row.checkedAt || row.supersedesId) return fail("Nothing to check.");
  if (await prisma.bankStatusEvent.count({ where: { supersedesId: row.id } })) return fail("This update was already rejected.");
  if (row.recordedBy === g.actor) return fail("A second person must check this against the evidence.");
  const att = g.app.attempts.find((a) => a.id === row.attemptId);
  if (!att) return fail("Attempt not found.");
  const decision = str(f, "decision", 20);
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      if (decision !== "CONFIRM") {
        // Unconfirmed rows never count; the recorder adds a corrected one.
        // The marker row supersedes the unconfirmed one; it is never checked, so it never counts either.
        await tx.bankStatusEvent.create({ data: { applicationId: id, attemptId: att.id, status: row.status, source: row.source, recordedBy: g.actor, checkedBy: g.actor, supersedesId: row.id, supersedeReason: str(f, "reason", 300) || "Not supported by the evidence", needsCheck: true } });
        await event(tx, id, "BANK_STATUS_CHECK_REJECTED", g.actor, { status: row.status });
        return;
      }
      await tx.bankStatusEvent.update({ where: { id: row.id }, data: { checkedBy: g.actor, checkedAt: new Date() } });
      await event(tx, id, "BANK_STATUS_CONFIRMED", g.actor, { status: row.status, bank: att.bankName });
      await applyBankStatus(tx, g.app, att, row.status as BankStatus, g.actor);
    });
  });
}

/** What a confirmed bank status does to the attempt and the application (sections 19-23). */
async function applyBankStatus(tx: Tx, app: Case, att: Case["attempts"][number], status: BankStatus, actor: string) {
  const vars = { reference: app.reference, bank: att.bankName };
  switch (status) {
    case "SANCTIONED":
    case "REJECTED":
      await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "OUTCOME_RECEIVED" } });
      if (status === "SANCTIONED") await queueMessage(tx, app.id, "BANK_MILESTONE", { ...vars, status: `${att.bankName} has sanctioned your loan` });
      break;
    case "IN_PRINCIPLE":
      await queueMessage(tx, app.id, "BANK_MILESTONE", { ...vars, status: `${att.bankName} has given in-principle approval (not a final sanction)` });
      break;
    case "QUERY":
      await queueMessage(tx, app.id, "BANK_MILESTONE", { ...vars, status: `${att.bankName} needs more information` });
      break;
    case "CANCELLED":
      await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "CLOSED" } });
      await closeCase(tx, app, "CANCELLED_BY_BANK", actor, "Bank evidence of cancellation");
      break;
    case "DISBURSED":
      // Disbursal closes the application; later tranches are further DISBURSED rows on the closed attempt.
      if (app.stage !== "CLOSED") {
        await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "CLOSED" } });
        await closeCase(tx, app, "DISBURSED", "system", "Bank evidence of disbursal");
        await queueMessage(tx, app.id, "DISBURSED", vars);
      }
      break;
    default:
      break;
  }
}

async function closeCase(tx: Tx, app: Case, reason: string, actor: string, note: string) {
  const current = await tx.loanApplication.findUniqueOrThrow({ where: { id: app.id }, select: { stage: true } });
  if (current.stage === "CLOSED") return;
  await tx.applicationTask.updateMany({ where: { applicationId: app.id, status: "OPEN" }, data: { status: "CANCELLED" } });
  await tx.bankAttempt.updateMany({ where: { applicationId: app.id, state: { in: ["PREPARING", "READY_TO_SUBMIT"] } }, data: { state: "CLOSED" } });
  await moveStage(tx, app.id, current.stage, "CLOSED", actor, note, { closedReason: reason, closedNote: note, closedAt: new Date(), onHold: false });
  await queueMessage(tx, app.id, "CLOSED", { reference: app.reference });
}

/** After a bank rejection or a portal return: try one more consented bank, or close (section 21). */
export async function decideAfterRejection(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "decision.reroute");
  if ("error" in g) return fail(g.error!);
  const att = g.app.attempts.find((a) => a.state === "OUTCOME_RECEIVED");
  if (!att) return fail("No bank decision is waiting.");
  const latest = await prisma.bankStatusEvent.findFirst({ where: { attemptId: att.id, OR: [{ needsCheck: false }, { checkedAt: { not: null } }] }, orderBy: { createdAt: "desc" } });
  if (latest?.status !== "REJECTED") return fail("The latest bank status isn't a rejection.");
  const decision = str(f, "decision", 20);
  const scope = str(f, "scope", 20);
  if (decision === "REROUTE") {
    if (latest.reasonCode === "FRAUD_SUSPICION") return fail("A fraud-related rejection is never re-routed. Raise a flag instead.");
    if (scope !== "BANK_SPECIFIC") return fail("Re-route only when the reason is specific to this bank.");
    const tries = g.app.attempts.filter((a) => ["SUPERSEDED", "RETURNED_OR_FAILED"].includes(a.state)).length;
    if (tries >= MAX_REROUTES) return fail(`The re-route limit (${MAX_REROUTES}) is reached.`);
    return run(id, async () => {
      await prisma.$transaction(async (tx) => {
        await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "SUPERSEDED", outcomeNote: latest.bankWording } });
        await event(tx, id, "REROUTE_DECIDED", g.actor, { bank: att.bankName, note: "Bank-specific reason; try another consented bank" });
        await moveStage(tx, id, "SUBMITTED_TO_BANK", "VERIFICATION_REVIEW", g.actor, "Back to bank selection");
      });
    });
  }
  return run(id, async () => {
    await prisma.$transaction(async (tx) => {
      await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "CLOSED", outcomeNote: latest.bankWording } });
      await closeCase(tx, g.app, "REJECTED_BY_BANK", g.actor, latest.bankWording ?? "Rejected by the bank");
    });
  });
}

// ---------- Holds, flags, close, notes ----------

export async function setHold(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "hold.set");
  if ("error" in g) return fail(g.error!);
  const reason = str(f, "reason", 300);
  if (g.app.stage === "CLOSED") return fail("This application is closed.");
  if (!g.app.onHold) {
    if (!reason) return fail("Give a reason for the hold.");
    return run(id, () => prisma.$transaction(async (tx) => {
      await tx.loanApplication.update({ where: { id }, data: { onHold: true, holdReason: reason, heldBy: g.actor } });
      await event(tx, id, "HOLD_SET", g.actor, { note: reason });
    }));
  }
  // A hold is released by someone other than the person who set it.
  if (g.app.heldBy === g.actor) return fail("Someone else must release a hold you set.");
  return run(id, () => prisma.$transaction(async (tx) => {
    await tx.loanApplication.update({ where: { id }, data: { onHold: false, holdReason: null, heldBy: null } });
    await event(tx, id, "HOLD_RELEASED", g.actor, { note: reason || undefined });
  }));
}

export async function resolveFlag(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const flag = await prisma.applicationFlag.findUnique({ where: { id: str(f, "flagId") } });
  if (!flag || flag.status !== "OPEN") return fail("Flag not found.");
  const g = await guard(flag.applicationId, "flag.resolve");
  if ("error" in g) return fail(g.error!);
  const outcome = str(f, "outcome", 20);
  const note = str(f, "note", 400);
  if (!["CLEARED", "CONFIRMED"].includes(outcome) || !note) return fail("Pick an outcome and write a note.");
  return run(g.app.id, () => prisma.$transaction(async (tx) => {
    await tx.applicationFlag.update({ where: { id: flag.id }, data: { status: outcome, resolvedBy: g.actor, resolvedAt: new Date(), resolutionNote: note } });
    await event(tx, g.app.id, outcome === "CLEARED" ? "FLAG_CLEARED" : "FLAG_CONFIRMED", g.actor, { flag: flag.type, note });
  }));
}

export async function closeApplication(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const user = await currentStaff();
  const reason = str(f, "reason", 40);
  const note = str(f, "note", 400);
  if (!isCloseReason(reason) || !MANUAL_CLOSE_REASONS.includes(reason)) return fail("Pick a close reason.");
  if (!note) return fail("Write a short note.");
  // Executives propose; the Ops Manager confirms (section 13).
  if (user && !can(user, "application.close") && can(user, "application.propose_close")) {
    const g = await guard(id, "application.propose_close", { ownerOnly: true });
    if ("error" in g) return fail(g.error!);
    await prisma.applicationEvent.create({ data: { applicationId: id, type: "CLOSE_PROPOSED", actor: g.actor, detail: JSON.stringify({ reason, note }) } });
    return done(id, "Proposed. The Ops Manager will confirm.");
  }
  const g = await guard(id, "application.close");
  if ("error" in g) return fail(g.error!);
  if (g.app.stage === "CLOSED") return fail("Already closed.");
  if (g.app.attempts.some((a) => a.state === "SUBMITTED") && reason !== "WITHDRAWN") return fail("The application is with a bank; its status decides the outcome.");
  return run(id, () => prisma.$transaction((tx) => closeCase(tx, g.app, reason, g.actor, note)));
}

export async function addNote(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "note.add");
  if ("error" in g) return fail(g.error!);
  const note = str(f, "note", 1000);
  if (!note) return fail("Write a note.");
  await prisma.applicationEvent.create({ data: { applicationId: id, type: "NOTE", actor: g.actor, detail: JSON.stringify({ note }) } });
  return done(id);
}

/** Staff resend the applicant's private link (the old one stops working). Shown once, to send by hand. */
export async function issueApplicantLink(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "task.raise", { ownerOnly: true });
  if ("error" in g) return fail(g.error!);
  if (g.app.stage === "CLOSED") return fail("This application is closed.");
  const { token, hash, expiresAt } = newUploadToken();
  await prisma.$transaction(async (tx) => {
    await tx.loanApplication.update({ where: { id }, data: { uploadTokenHash: hash, uploadTokenExpiresAt: expiresAt } });
    await event(tx, id, "APPLICANT_LINK_ISSUED", g.actor, {});
  });
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true, url: `${await publicBaseUrl()}/documents/${token}`, message: `Works until ${expiresAt.toLocaleDateString("en-IN")}. Send it only to the applicant's registered mobile.` };
}

/** Log a reveal of a masked field with a reason, and return the value (section 13: every reveal is logged). */
export async function revealField(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const id = str(f, "id");
  const g = await guard(id, "pii.reveal", { ownerOnly: false });
  if ("error" in g) return fail(g.error!);
  if (g.user.role === "OPS_EXECUTIVE" && g.app.ownerId !== g.user.username) return fail("Only the case owner can reveal this.");
  const field = str(f, "field", 20);
  const reason = str(f, "reason", 200);
  if (!reason) return fail("Give a reason.");
  const { decryptField } = await import("@/lib/fieldCrypto.server");
  const value = field === "pan" ? (g.app.panEnc ? decryptField(g.app.panEnc) : null) : field === "account" ? (g.app.accountEnc ? decryptField(g.app.accountEnc) : null) : field === "mobile" ? g.app.mobile : null;
  if (!value) return fail("Nothing to reveal.");
  await prisma.applicationEvent.create({ data: { applicationId: id, type: "PII_REVEALED", actor: g.actor, detail: JSON.stringify({ field, note: reason }) } });
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true, message: value };
}
