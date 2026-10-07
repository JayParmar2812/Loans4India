import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatINR, maskMobile } from "@/lib/format";
import {
  ACTIVE_ATTEMPT_STATES, ATTEMPT_LABELS, BANK_REJECTION_CODES, BANK_STATUSES, BANK_STATUS_LABELS, CLOSE_REASONS, EVIDENCE_SOURCES, MANUAL_CLOSE_REASONS,
  MANUAL_EVIDENCE_SOURCES, MAX_REROUTES, STAGE_LABELS, STAGE_TONE, isStage, type AttemptState, type BankStatus,
} from "@/lib/stages";
import { EMPLOYMENT_LABELS } from "@/lib/validation";
import { REJECT_REASONS, rejectMessage } from "@/lib/documents";
import { appFlow, checklistFor, coverage, loanTypeLabel, slotTitle } from "@/config/applicantFlow";
import { getLiveFlow } from "@/lib/applicantFlow.server";
import { consentNotice } from "@/lib/consent";
import { buildSlots, missingRequired } from "@/lib/docstate";
import { consentState } from "@/lib/consentState";
import { detailsCheck } from "@/lib/details.server";
import { FIELDS, GENDERS, LOAN_PURPOSES, RESIDENCE_TYPES, SALARY_MODES, SECTIONS, fieldRules, fieldText } from "@/lib/profile";
import { bankCandidates, gateChecks, SELECTION_BASES } from "@/lib/bankFlow";
import { buildManifest } from "@/lib/bankPackage.server";
import { confirmedBankStatus, MESSAGE_TEMPLATES, pendingChecks } from "@/lib/applicant.server";
import { can, canSeeCase, holdsPortal, isOwnerOrManager, ROLES } from "@/lib/rbac";
import { actorOf, assignableStaff, currentStaff, staffDirectory } from "@/lib/staff.server";
import { slaFor, SLA_TONE, fmtHours } from "@/lib/sla";
import { bankById } from "@/config/banks";
import { ActionForm } from "@/components/admin/ActionForm";
import {
  addNote, assignOwner, cancelTask, checkBankStatus, closeApplication, decideAfterRejection, gateDecision, issueApplicantLink, passReview, raiseTask,
  recordBankStatus, recordEntryFailed, recordSubmission, requestReconsent, resolveFlag, reviewDocument, revealField, selectBank, sendToGate, setHold,
} from "./actions";

const ist = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
const label = (s: string) => s.replaceAll("_", " ").toLowerCase();
const parse = (s: string | null) => {
  try {
    return s ? (JSON.parse(s) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

/** What happens next in each state, for the person looking at the case. */
const NEXT_STEP: Record<string, string> = {
  ENQUIRY: "The applicant has not finished registering.",
  CONSENT_PENDING: "Waiting for the applicant to confirm consent.",
  PROFILE_IN_PROGRESS: "The applicant is filling in their details.",
  DOCUMENTS_PENDING: "The applicant is uploading documents.",
  VERIFICATION_REVIEW: "Owner reviews every document and detail, then passes review and picks one bank.",
  ACTION_NEEDED: "Waiting for the applicant to respond to the Action needed task.",
  APPLICATION_PREPARATION: "Owner fills the bank package checklist and sends it to the gate.",
  INTERNAL_REVIEW: "A second person (Ops Manager) runs the eight gate checks and approves or sends back.",
  READY_FOR_BANK: "An Authorised DSA Operator enters the application on the bank portal and records the reference with evidence.",
  SUBMITTED_TO_BANK: "Record each bank update from evidence; a second person confirms in-principle, sanction and disbursal.",
  CLOSED: "This application is closed.",
};

export default async function CaseWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentStaff();
  const a = await prisma.loanApplication.findUnique({
    where: { id },
    include: {
      consents: { orderBy: { createdAt: "asc" } },
      events: { orderBy: { createdAt: "desc" }, take: 300 },
      documents: { where: { status: { not: "REMOVED" } }, orderBy: { createdAt: "asc" } },
      tasks: { orderBy: { createdAt: "desc" } },
      flags: { orderBy: { createdAt: "desc" } },
      attempts: { orderBy: { createdAt: "asc" } },
      bankStatuses: { orderBy: { createdAt: "asc" } },
      snapshots: { orderBy: { version: "desc" }, take: 1, select: { version: true, contentHash: true, createdAt: true } },
    },
  });
  if (!a || !user || !canSeeCase(user, a, a.attempts.map((t) => t.bankId))) notFound();

  const me = actorOf(user);
  const stage = isStage(a.stage) ? a.stage : "ENQUIRY";
  const owner = isOwnerOrManager(user, a);
  const consent = consentState(a.consents);
  const details = detailsCheck(a);
  // This case's own form and checklist (as when it started); bank coverage and labels come from the live flow.
  const af = appFlow(a);
  const live = await getLiveFlow();
  const values = details.values;
  const docViews = a.documents.map((d) => ({ id: d.id, slot: d.slot, name: d.originalName, sizeBytes: d.sizeBytes, status: d.status, rejectReason: d.rejectReason, rejectNote: d.rejectNote, createdAt: d.createdAt.toISOString() }));
  const slots = buildSlots(af, a.employmentType, docViews);
  const missing = missingRequired(slots);
  const docById = new Map(a.documents.map((d) => [d.id, d]));
  const openTasks = a.tasks.filter((t) => t.status === "OPEN");
  const openFlags = a.flags.filter((f) => f.status === "OPEN");
  const active = a.attempts.find((t) => (ACTIVE_ATTEMPT_STATES as readonly string[]).includes(t.state)) ?? null;
  const withBank = a.attempts.find((t) => t.state === "SUBMITTED" || t.state === "OUTCOME_RECEIVED") ?? null;
  const confirmed = confirmedBankStatus(a.bankStatuses, withBank?.id ?? active?.id ?? null);
  const checksDue = pendingChecks(a.bankStatuses);
  const reroutes = a.attempts.filter((t) => t.state === "SUPERSEDED" || t.state === "RETURNED_OR_FAILED").length;
  const stageSince = a.events.find((e) => e.type === "STAGE_CHANGED")?.createdAt ?? a.createdAt;
  const sla = slaFor({ stage, onHold: a.onHold, ownerId: a.ownerId, submittedAt: a.submittedAt, stageSince, sentToGateAt: active?.sentToGateAt, approvedAt: active?.approvedAt });
  const staff = await assignableStaff();
  const directory = await staffDirectory({ includeDisabled: true });
  const nameOf = (actorOrUser: string | null) => {
    if (!actorOrUser) return "—";
    const u = actorOrUser.replace(/^staff:/, "");
    return directory.find((s) => s.username === u)?.name ?? u;
  };
  const closeProposal = stage !== "CLOSED" ? a.events.find((e) => e.type === "CLOSE_PROPOSED") : undefined;
  const latest = consentNotice(a.product, live.flow);
  const consentOutdated = consent.valid && (consent.bankListVersion !== latest.bankListVersion || latest.bankIds.some((b) => !consent.bankIds.includes(b)));

  // Section 15: candidates once review has passed and no bank is active.
  const candidates =
    stage === "VERIFICATION_REVIEW" && a.reviewPassedAt && !active
      ? bankCandidates({ coverage: coverage(live.flow, a.product), consentBankIds: consent.bankIds, values, triedBankIds: a.attempts.map((t) => t.bankId) })
      : [];
  // Sections 16-17: package checklist and gate checks.
  const manifest = active && (active.state === "PREPARING" || active.state === "READY_TO_SUBMIT") ? await buildManifest(a.id, active.bankId) : null;
  const accepted = slots.filter((s) => s.state === "accepted").map((s) => s.id as string);
  const gate =
    stage === "INTERNAL_REVIEW" && active && manifest
      ? gateChecks({
          consentValid: consent.valid, consentBankIds: consent.bankIds, bankId: active.bankId, mapped: manifest.mapped, flow: af, employmentType: a.employmentType,
          acceptedSlots: accepted, openTasks: openTasks.length, onHold: a.onHold, openFlags: openFlags.length, templateVersion: manifest.manifest.templateVersion,
          preparedBy: active.preparedBy, approver: me,
        })
      : null;
  const packageChanged = active?.state === "READY_TO_SUBMIT" && manifest && manifest.hash !== active.packageHash;
  const rules = new Map(fieldRules({ flow: af, employmentType: a.employmentType, values }).map((r) => [r.key, r.required]));

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm text-violet">← Control tower</Link>

      {/* Header: state, owner, SLA, hold */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-extrabold font-mono">{a.reference}</h1>
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${STAGE_TONE[stage]}`}>{STAGE_LABELS[stage]}</span>
          {a.onHold && <span className="rounded-full px-3 py-1 text-sm font-semibold bg-red-100 text-red-900">On hold</span>}
          {sla && <span className={`rounded-full px-3 py-1 text-sm font-semibold num ${SLA_TONE[sla.colour]}`}>{sla.label}: {fmtHours(sla.used)} of {sla.limit}h</span>}
          {confirmed && <span className="rounded-full px-3 py-1 text-sm font-semibold bg-mint text-mint-ink">Bank: {BANK_STATUS_LABELS[confirmed.status as BankStatus] ?? confirmed.status}</span>}
        </div>
        <p className="text-sm text-muted">
          {a.fullName ?? "Name not given yet"} · {loanTypeLabel(live.flow, a.product)} · <span className="num">{formatINR(a.loanAmount)}</span> · owner <b>{a.ownerId ? nameOf(a.ownerId) : "unassigned"}</b>
          {a.ownerDueAt && <> · due {ist(a.ownerDueAt)}</>} · received {ist(a.createdAt)}
          {a.closedReason && <> · closed: {CLOSE_REASONS[a.closedReason as keyof typeof CLOSE_REASONS] ?? a.closedReason}</>}
        </p>
        <p className="text-sm rounded-xl bg-canvas border border-line px-3 py-2"><b>Next:</b> {NEXT_STEP[stage]}{a.onHold && <> Paused: {a.holdReason} (set by {nameOf(a.heldBy)}).</>}</p>
        {closeProposal && can(user, "application.close") && (
          <p className="text-sm rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-amber-900">
            {nameOf(closeProposal.actor)} proposed closing this case: {String(parse(closeProposal.detail).reason ?? "")} · “{String(parse(closeProposal.detail).note ?? "")}”. Confirm with Close below, or leave it open.
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] items-start">
        <div className="space-y-6 min-w-0">
          {/* Applicant */}
          <Panel title="Applicant details" aside={details.problems.length ? `${details.problems.length} missing` : a.detailsCompletedAt ? "complete" : undefined}>
            {(Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]).map((sec) => {
              const fields = FIELDS.filter((f) => f.section === sec && rules.has(f.key));
              return (
                <div key={sec} className="mb-4 last:mb-0">
                  <h3 className="text-xs uppercase tracking-wide text-muted mb-1">{SECTIONS[sec]}</h3>
                  <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    {fields.map((f) => (
                      <div key={f.key}>
                        <dt className="text-muted text-xs">{fieldText(af, f.key).label}{rules.get(f.key) ? " *" : ""}</dt>
                        <dd className="font-medium num break-words">{show(f.key, values[f.key])}</dd>
                      </div>
                    ))}
                    {af.questions.filter((q) => q.section === sec).map((q) => {
                      const v = (values as Record<string, unknown>)[q.id];
                      return (
                        <div key={q.id}>
                          <dt className="text-muted text-xs">{q.label}{q.required ? " *" : ""}</dt>
                          <dd className="font-medium break-words">{v === undefined || v === null || v === "" ? "—" : q.type === "yesno" ? (v === "YES" ? "Yes" : "No") : String(v)}</dd>
                        </div>
                      );
                    })}
                    {sec === "personal" && (
                      <div><dt className="text-muted text-xs">Mobile</dt><dd className="font-medium num">+91 {maskMobile(a.mobile)}</dd></div>
                    )}
                  </dl>
                </div>
              );
            })}
            <p className="text-xs text-muted">Source: {[a.source, a.medium, a.campaign].filter(Boolean).join(" / ") || "direct"}{a.referralCode ? ` · referral ${a.referralCode}` : ""}{a.snapshots[0] ? ` · snapshot v${a.snapshots[0].version} (${a.snapshots[0].contentHash.slice(0, 12)}) frozen ${ist(a.snapshots[0].createdAt)}` : ""}</p>
            {can(user, "pii.reveal") && (
              <ActionForm action={revealField} hidden={{ id: a.id }} buttons={[{ label: "Reveal", tone: "ghost" }]} showValue className="mt-3 grid sm:grid-cols-[10rem_1fr_auto] gap-2 items-start">
                <select name="field" className="field-input !py-2" aria-label="Field to reveal">
                  <option value="mobile">Mobile</option>
                  <option value="pan">PAN</option>
                  <option value="account">Account number</option>
                </select>
                <input name="reason" required placeholder="Why you need it (logged)" className="field-input !py-2" aria-label="Reason" />
              </ActionForm>
            )}
          </Panel>

          {/* Documents */}
          <Panel title="Documents" aside={a.submittedAt ? `submitted ${ist(a.submittedAt)}` : "not submitted yet"}>
            {missing.length > 0 && <p className="text-sm text-danger mb-2">Missing: {missing.map((m) => m.title).join(", ")}</p>}
            <ul className="divide-y divide-line">
              {slots.map((slot) => (
                <li key={slot.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{slot.title}</span>
                    {!slot.required && <span className="text-xs text-muted">optional</span>}
                    <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${slot.state === "accepted" ? "bg-emerald-100 text-emerald-900" : slot.state === "needs_replacing" ? "bg-amber-100 text-amber-900" : slot.state === "uploaded" ? "bg-violet-soft text-violet-deep" : "bg-gray-100 text-gray-700"}`}>
                      {slot.state === "needs_replacing" ? "replacement requested" : slot.state === "missing" && !slot.required ? "not uploaded" : slot.state}
                    </span>
                  </div>
                  {slot.files.length > 0 && (
                    <ul className="mt-2 space-y-2">
                      {slot.files.map((f) => {
                        const d = docById.get(f.id)!;
                        return (
                          <li key={f.id} className="text-sm rounded-xl bg-canvas px-3 py-2 space-y-2">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <a href={`/admin/documents/${f.id}`} target="_blank" rel="noopener noreferrer" className="text-violet underline min-w-0 truncate">{f.name}</a>
                              <span className="text-muted num">{f.sizeBytes < 1048576 ? `${Math.max(1, Math.round(f.sizeBytes / 1024))} KB` : `${(f.sizeBytes / 1048576).toFixed(1)} MB`} · {ist(d.createdAt)}</span>
                              {d.scanResult === "SKIPPED_DEV" && <span className="text-xs text-amber-800">not virus-scanned (dev)</span>}
                              <span className="font-semibold">{f.status.toLowerCase()}</span>
                              {f.status === "REJECTED" && <span className="text-xs text-muted">{d.rejectNote || rejectMessage(d.rejectReason)}</span>}
                              {d.reviewedBy && <span className="text-xs text-muted">by {nameOf(d.reviewedBy)}</span>}
                            </div>
                            {f.status === "UPLOADED" && owner && can(user, "document.review") && a.submittedAt && (
                              <div className="flex flex-wrap gap-2 items-start">
                                <ActionForm action={reviewDocument} hidden={{ docId: f.id, decision: "ACCEPTED" }} buttons={[{ label: "Accept", tone: "ok" }]} />
                                <ActionForm action={reviewDocument} hidden={{ docId: f.id, decision: "REJECTED" }} buttons={[{ label: "Ask to replace", tone: "ghost" }]} className="flex flex-wrap gap-2 items-start">
                                  <select name="reason" className="field-input !py-2 !w-auto" aria-label="Reason">
                                    {Object.keys(REJECT_REASONS).map((r) => <option key={r} value={r}>{label(r)}</option>)}
                                  </select>
                                  <input name="note" placeholder="Note to the applicant (optional)" className="field-input !py-2 !w-56" aria-label="Note to the applicant" />
                                </ActionForm>
                                <ActionForm action={reviewDocument} hidden={{ docId: f.id, decision: "FLAG" }} buttons={[{ label: "Flag tampering", tone: "danger" }]} confirm="Flag this file and put the case on hold? The applicant is not told." className="flex flex-wrap gap-2">
                                  <input name="note" placeholder="What looks wrong" className="field-input !py-2 !w-44" aria-label="What looks wrong" />
                                </ActionForm>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted mt-3">Opening a document is logged. Check each file against the details (name, dates, masked Aadhaar). This is document collection, not KYC: the bank does KYC.</p>
            {stage === "VERIFICATION_REVIEW" && !a.reviewPassedAt && owner && can(user, "review.pass") && (
              <ActionForm action={passReview} hidden={{ id: a.id }} buttons={[{ label: "Pass review" }]} className="mt-4 space-y-2">
                <p className="text-sm text-muted">Passes when every required document is accepted, details are complete, and there are no open tasks, flags or holds.</p>
              </ActionForm>
            )}
            {a.reviewPassedAt && <p className="text-sm text-emerald-800 mt-3">Review passed by {nameOf(a.reviewPassedBy)} on {ist(a.reviewPassedAt)}.</p>}
          </Panel>

          {/* Action needed tasks */}
          <Panel title="Action needed tasks" aside={openTasks.length ? `${openTasks.length} open` : undefined}>
            {a.tasks.length === 0 && <p className="text-sm text-muted">None raised.</p>}
            <ul className="space-y-2 text-sm">
              {a.tasks.map((t) => {
                const s = JSON.parse(t.slots) as string[];
                const secs = JSON.parse(t.fields) as string[];
                return (
                  <li key={t.id} className="rounded-xl bg-canvas px-3 py-2">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className={`text-xs rounded-full px-2 py-0.5 font-semibold ${t.status === "OPEN" ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"}`}>{label(t.status)}</span>
                      <span>{t.message}</span>
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Unlocks: {[...s.map((x) => slotTitle(af, x)), ...secs.map((x) => SECTIONS[x as keyof typeof SECTIONS] ?? x)].join(", ")} · by {nameOf(t.createdBy)} {ist(t.createdAt)}
                      {t.respondedAt && <> · answered {ist(t.respondedAt)}</>}
                    </p>
                    {t.status === "OPEN" && owner && can(user, "task.raise") && (
                      <ActionForm action={cancelTask} hidden={{ taskId: t.id }} buttons={[{ label: "Cancel task", tone: "ghost" }]} className="mt-2" />
                    )}
                  </li>
                );
              })}
            </ul>
            {owner && can(user, "task.raise") && ["VERIFICATION_REVIEW", "APPLICATION_PREPARATION", "ACTION_NEEDED", "SUBMITTED_TO_BANK"].includes(stage) && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-violet">Ask the applicant for something</summary>
                <ActionForm action={raiseTask} hidden={{ id: a.id }} buttons={[{ label: "Send Action needed" }]} className="mt-3 space-y-3">
                  <fieldset className="text-sm">
                    <legend className="field-label">Documents to unlock</legend>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {checklistFor(af, a.employmentType).map((c) => (
                        <label key={c.id} className="flex gap-2 items-center"><input type="checkbox" name="slots" value={c.id} />{c.title}</label>
                      ))}
                    </div>
                  </fieldset>
                  <fieldset className="text-sm">
                    <legend className="field-label">Detail sections to unlock</legend>
                    <div className="grid sm:grid-cols-2 gap-1">
                      {Object.entries(SECTIONS).map(([k, v]) => <label key={k} className="flex gap-2 items-center"><input type="checkbox" name="sections" value={k} />{v}</label>)}
                    </div>
                  </fieldset>
                  <select name="reasonCode" className="field-input !py-2" aria-label="Reason">
                    {Object.keys(REJECT_REASONS).map((r) => <option key={r} value={r}>{label(r)}</option>)}
                    <option value="BANK_QUERY">bank query</option>
                  </select>
                  <textarea name="message" rows={2} required className="field-input" placeholder="What the applicant should do, in plain words" aria-label="Message to the applicant" />
                </ActionForm>
              </details>
            )}
          </Panel>

          {/* Bank: attempts, selection, preparation, gate, portal entry, updates */}
          <Panel title="Bank" aside={`re-routes ${reroutes}/${MAX_REROUTES}`}>
            {a.attempts.length > 0 && (
              <div className="overflow-x-auto mb-4">
                <table className="w-full text-sm min-w-[640px]">
                  <thead className="text-left text-muted text-xs uppercase tracking-wide">
                    <tr className="border-b border-line">{["Bank", "Attempt", "Picked", "Gate", "Submitted", "Bank status"].map((h) => <th key={h} className="px-2 py-2 font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {a.attempts.map((t) => {
                      const st = confirmedBankStatus(a.bankStatuses, t.id);
                      return (
                        <tr key={t.id} className="border-b border-line last:border-0 align-top">
                          <td className="px-2 py-2 font-medium">{t.bankName}</td>
                          <td className="px-2 py-2">{ATTEMPT_LABELS[t.state as AttemptState] ?? t.state}{t.outcomeNote && <span className="block text-xs text-muted">{t.outcomeNote}</span>}</td>
                          <td className="px-2 py-2 text-xs">{nameOf(t.selectedBy)}<span className="block text-muted">{t.selectionBasis}</span></td>
                          <td className="px-2 py-2 text-xs">{t.approvedBy ? <>approved by {nameOf(t.approvedBy)}<span className="block text-muted font-mono">{t.packageHash?.slice(0, 12)}</span></> : t.sendBackReason ? <span className="text-amber-800">sent back: {t.sendBackReason}</span> : "—"}</td>
                          <td className="px-2 py-2 text-xs">{t.bankReference ? <><span className="font-mono">{t.bankReference}</span><span className="block text-muted">{nameOf(t.submittedBy)} · {t.submittedAt && ist(t.submittedAt)}</span></> : "—"}</td>
                          <td className="px-2 py-2 text-xs">{st ? BANK_STATUS_LABELS[st.status as BankStatus] ?? st.status : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {stage === "VERIFICATION_REVIEW" && !a.reviewPassedAt && <p className="text-sm text-muted">Pick a bank after review passes.</p>}

            {candidates.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold">Pick one bank</h3>
                <ul className="text-sm space-y-1">
                  {candidates.map((c) => (
                    <li key={c.bank.id} className={c.ok ? "" : "text-muted"}>
                      <b>{c.bank.name}</b> {c.ok ? <span className="text-emerald-800">can take this file</span> : <>removed: {c.reasons.join("; ")}</>}
                      {c.ok && c.bank.notes && <span className="block text-xs text-muted">{c.bank.notes}</span>}
                    </li>
                  ))}
                </ul>
                {candidates.some((c) => c.ok) ? (
                  owner && can(user, "bank.select") && (
                    <ActionForm action={selectBank} hidden={{ id: a.id }} buttons={[{ label: "Select bank" }]} className="grid sm:grid-cols-2 gap-2">
                      <select name="bankId" className="field-input !py-2" aria-label="Bank">
                        {candidates.filter((c) => c.ok).map((c) => <option key={c.bank.id} value={c.bank.id}>{c.bank.name}</option>)}
                      </select>
                      <select name="basis" className="field-input !py-2" aria-label="Why this bank">
                        {Object.entries(SELECTION_BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                      <input name="note" placeholder="Note (optional)" className="field-input !py-2 sm:col-span-2" aria-label="Selection note" />
                    </ActionForm>
                  )
                ) : (
                  <p className="text-sm text-amber-900">No consented bank passes the filters. Close as “No bank passes the sourcing filters”, or ask the applicant to re-consent if the bank list changed.</p>
                )}
              </div>
            )}

            {manifest && active && (stage === "APPLICATION_PREPARATION" || stage === "INTERNAL_REVIEW") && (
              <div className="space-y-3 mt-2">
                <h3 className="font-semibold">Package for {active.bankName} <span className="text-xs text-muted font-normal">template {manifest.manifest.templateVersion}</span></h3>
                {active.sendBackReason && <p className="text-sm text-amber-900">Sent back: {active.sendBackReason}</p>}
                <table className="w-full text-sm">
                  <tbody>
                    {manifest.mapped.map((m) => (
                      <tr key={m.bankField} className="border-b border-line last:border-0">
                        <td className="py-1 pr-3 text-muted">{m.bankField}{m.required ? " *" : ""}</td>
                        <td className={`py-1 num ${!m.value && m.required ? "text-danger font-semibold" : ""}`}>{m.value ?? (m.required ? "missing" : "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-muted">Documents: {manifest.documents.map((d) => d.fileName).join(", ") || "none accepted"}. A missing value is fixed by asking the applicant (Action needed), never by typing it in.</p>
                {stage === "APPLICATION_PREPARATION" && owner && can(user, "package.send_to_gate") && (
                  <ActionForm action={sendToGate} hidden={{ id: a.id }} buttons={[{ label: "Send to gate" }]} />
                )}
              </div>
            )}

            {gate && (
              <div className="space-y-3 mt-4">
                <h3 className="font-semibold">Ready-for-Bank gate <span className="text-xs text-muted font-normal">prepared by {nameOf(active?.preparedBy ?? null)}</span></h3>
                <ol className="text-sm space-y-1">
                  {gate.map((c) => (
                    <li key={c.id} className={c.ok ? "text-emerald-900" : "text-danger"}>{c.ok ? "✓" : "✗"} {c.id}. {c.label}{c.detail ? `: ${c.detail}` : ""}</li>
                  ))}
                </ol>
                {can(user, "gate.approve") && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <ActionForm action={gateDecision} hidden={{ id: a.id, decision: "APPROVE" }} buttons={[{ label: "Approve for bank", tone: "ok" }]} />
                    <ActionForm action={gateDecision} hidden={{ id: a.id, decision: "SEND_BACK" }} buttons={[{ label: "Send back", tone: "ghost" }]} className="space-y-2">
                      <input name="reason" placeholder="What needs fixing" className="field-input !py-2" aria-label="What needs fixing" />
                    </ActionForm>
                  </div>
                )}
              </div>
            )}

            {stage === "READY_FOR_BANK" && active?.state === "READY_TO_SUBMIT" && (
              <div className="space-y-3 mt-2">
                <h3 className="font-semibold">Portal entry: {active.bankName}</h3>
                <p className="text-sm text-muted">Approved by {nameOf(active.approvedBy)} {active.approvedAt && ist(active.approvedAt)} · package {active.packageHash?.slice(0, 12)}</p>
                {packageChanged && <p className="text-sm text-danger">Something changed since approval. Recording the submission will send the case back to preparation.</p>}
                {can(user, "portal.submit") && holdsPortal(user, active.bankId) ? (
                  <>
                    <form method="post" action={`/admin/applications/${a.id}/package`}>
                      <input type="hidden" name="attemptId" value={active.id} />
                      <button className="btn-ghost !py-2">Download entry sheet and documents</button>
                      <p className="text-xs text-muted mt-1">For {active.bankName} submission only. Logged. Delete the files after you record the reference.</p>
                    </form>
                    <ActionForm action={recordSubmission} hidden={{ id: a.id }} buttons={[{ label: "Record submission" }]} className="space-y-2 rounded-xl border border-line p-3">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <input name="bankReference" required placeholder="Bank's application / lead reference" className="field-input !py-2 font-mono" aria-label="Bank reference" />
                        <input name="branch" placeholder="Branch (optional)" className="field-input !py-2" aria-label="Branch" />
                      </div>
                      <label className="block text-sm">Evidence: portal confirmation screenshot or the bank&apos;s email (PDF, JPG, PNG)
                        <input type="file" name="evidence" required accept=".pdf,.jpg,.jpeg,.png" className="block mt-1 text-sm" />
                      </label>
                      <label className="flex gap-2 text-sm items-start"><input type="checkbox" name="attest" className="mt-1" /> I submitted this application personally on the bank&apos;s portal, using my own login, exactly as approved.</label>
                    </ActionForm>
                    <details>
                      <summary className="cursor-pointer text-sm font-semibold text-violet">Entry failed or the portal refused it</summary>
                      <ActionForm action={recordEntryFailed} hidden={{ id: a.id }} buttons={[{ label: "Record", tone: "ghost" }]} className="mt-2 space-y-2">
                        <select name="kind" className="field-input !py-2" aria-label="What happened">
                          <option value="ENTRY_FAILED">Entry failed (portal error, timeout); will retry</option>
                          <option value="PORTAL_REJECTED">The portal refused the file (e.g. PIN not serviced); back to bank selection</option>
                        </select>
                        <input name="reason" placeholder="What happened" className="field-input !py-2" aria-label="What happened" />
                        <input name="partialCheck" placeholder="Partial / duplicate lead check: what you found on the portal" className="field-input !py-2" aria-label="Partial-entry check" />
                      </ActionForm>
                    </details>
                  </>
                ) : (
                  <p className="text-sm text-muted">Waiting for an Authorised DSA Operator who holds a {active.bankName} portal login.</p>
                )}
              </div>
            )}

            {withBank && (
              <div className="space-y-3 mt-4">
                <h3 className="font-semibold">Updates from {withBank.bankName}</h3>
                <ul className="text-sm space-y-2">
                  {a.bankStatuses.filter((r) => r.attemptId === withBank.id).map((r) => {
                    const superseded = a.bankStatuses.some((x) => x.supersedesId === r.id);
                    return (
                      <li key={r.id} className={`rounded-xl bg-canvas px-3 py-2 ${superseded || r.supersedesId ? "opacity-60" : ""}`}>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
                          <b>{BANK_STATUS_LABELS[r.status as BankStatus] ?? r.status}</b>
                          <span className="text-xs text-muted">{EVIDENCE_SOURCES[r.source as keyof typeof EVIDENCE_SOURCES] ?? r.source} · {nameOf(r.recordedBy)} · {ist(r.createdAt)}</span>
                          {r.evidenceKey && <a href={`/admin/evidence/${r.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-violet underline">evidence</a>}
                          {r.supersedesId ? <span className="text-xs text-danger">check rejected: {r.supersedeReason}</span>
                            : superseded ? <span className="text-xs text-danger">not confirmed</span>
                            : r.needsCheck ? (r.checkedAt ? <span className="text-xs text-emerald-800">confirmed by {nameOf(r.checkedBy)}</span> : <span className="text-xs text-amber-800">waiting for a second-person check</span>) : null}
                        </div>
                        {(r.bankWording || r.amount || r.reasonCode) && (
                          <p className="text-xs mt-1">
                            {r.bankWording && <>“{r.bankWording}” </>}
                            {r.reasonCode && <>({BANK_REJECTION_CODES[r.reasonCode as keyof typeof BANK_REJECTION_CODES] ?? r.reasonCode}) </>}
                            {r.amount ? <span className="num">{formatINR(r.amount)}</span> : null}
                            {r.ratePct ? <> at {r.ratePct}%</> : null}
                            {r.tenureMonths ? <> for {r.tenureMonths} months</> : null}
                            {r.loanAccountLast4 ? <> · loan a/c …{r.loanAccountLast4}</> : null}
                            {r.eventDate ? <> · {r.eventDate}</> : null}
                          </p>
                        )}
                        {r.supersedeReason && !r.supersedesId && <p className="text-xs text-muted mt-1">Moved backwards because: {r.supersedeReason}</p>}
                        {checksDue.some((c) => c.id === r.id) && can(user, "bank_status.check") && r.recordedBy !== me && (
                          <ActionForm action={checkBankStatus} hidden={{ id: a.id, eventId: r.id }} buttons={[{ label: "Confirm against evidence", value: "CONFIRM", tone: "ok" }, { label: "Doesn't match", value: "REJECT", tone: "ghost" }]} className="mt-2 flex flex-wrap gap-2 items-start">
                            <input name="reason" placeholder="If it doesn't match, why" className="field-input !py-2 !w-56" aria-label="Reason" />
                          </ActionForm>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {(withBank.state === "SUBMITTED" || (withBank.state === "OUTCOME_RECEIVED" && confirmed?.status !== "REJECTED")) && can(user, "bank_status.record") && (user.role !== "OPS_EXECUTIVE" || a.ownerId === user.username) && (
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-violet">Record a bank update</summary>
                    <ActionForm action={recordBankStatus} hidden={{ id: a.id }} buttons={[{ label: "Record update" }]} className="mt-2 space-y-2">
                      <div className="grid sm:grid-cols-2 gap-2">
                        <select name="status" className="field-input !py-2" aria-label="Bank status">
                          {BANK_STATUSES.filter((s) => s !== "RECEIVED").map((s) => <option key={s} value={s}>{BANK_STATUS_LABELS[s]}</option>)}
                        </select>
                        <select name="source" className="field-input !py-2" aria-label="Evidence source">
                          {MANUAL_EVIDENCE_SOURCES.map((s) => <option key={s} value={s}>{EVIDENCE_SOURCES[s]}</option>)}
                        </select>
                      </div>
                      <textarea name="bankWording" rows={2} className="field-input" placeholder="The bank's own words (required for a query or rejection)" aria-label="Bank wording" />
                      <div className="grid sm:grid-cols-3 gap-2">
                        <select name="reasonCode" className="field-input !py-2" aria-label="Rejection reason">
                          <option value="">Rejection reason (if rejected)</option>
                          {Object.entries(BANK_REJECTION_CODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <input name="amount" inputMode="numeric" placeholder="Amount ₹ (sanction / disbursal)" className="field-input !py-2 num" aria-label="Amount" />
                        <input name="eventDate" type="date" className="field-input !py-2" aria-label="Date on the evidence" />
                        <input name="rate" inputMode="decimal" placeholder="Rate % (sanction)" className="field-input !py-2 num" aria-label="Rate" />
                        <input name="tenure" inputMode="numeric" placeholder="Tenure months" className="field-input !py-2 num" aria-label="Tenure" />
                        <input name="loanAccountLast4" inputMode="numeric" maxLength={4} placeholder="Loan a/c last 4 (disbursal)" className="field-input !py-2 num" aria-label="Loan account last 4" />
                      </div>
                      <input name="backwardReason" placeholder="Only if the status moves backwards: why" className="field-input !py-2" aria-label="Reason for moving backwards" />
                      <label className="block text-sm">Evidence (MIS extract, bank email as PDF, or portal screenshot)
                        <input type="file" name="evidence" required accept=".pdf,.jpg,.jpeg,.png" className="block mt-1 text-sm" />
                      </label>
                      <p className="text-xs text-muted">In-principle, sanction and disbursal count only after a second person confirms them. A phone call is never evidence.</p>
                    </ActionForm>
                  </details>
                )}
                {withBank.state === "OUTCOME_RECEIVED" && confirmed?.status === "REJECTED" && can(user, "decision.reroute") && (
                  <ActionForm action={decideAfterRejection} hidden={{ id: a.id }} buttons={[{ label: "Try another bank", value: "REROUTE" }, { label: "Close as rejected", value: "CLOSE", tone: "ghost" }]} className="space-y-2 rounded-xl border border-line p-3">
                    <p className="text-sm">The bank rejected this application. Re-route only when the reason is specific to this bank, never for fraud, and at most {MAX_REROUTES} times. The applicant&apos;s current consent must cover the next bank.</p>
                    <select name="scope" className="field-input !py-2" aria-label="Is the reason specific to this bank">
                      <option value="BANK_SPECIFIC">Reason is specific to this bank (policy, pin code, employer category)</option>
                      <option value="GENERAL">Reason would apply at any bank (credit, income, documents)</option>
                    </select>
                  </ActionForm>
                )}
                {withBank.state === "OUTCOME_RECEIVED" && confirmed?.status === "SANCTIONED" && (
                  <p className="text-sm text-muted">Sanctioned. Record the disbursal from evidence when it happens.</p>
                )}
              </div>
            )}
          </Panel>

          {/* Timeline */}
          <Panel title="Timeline">
            <ol className="space-y-2 text-sm">
              {a.events.map((e) => {
                const d = parse(e.detail) as Record<string, string>;
                if (e.type === "MESSAGE_DUE") {
                  const text = MESSAGE_TEMPLATES[d.template]?.(d) ?? d.template;
                  return (
                    <li key={e.id} className="flex flex-wrap gap-x-3 rounded-lg bg-violet-soft/50 px-2 py-1">
                      <span className="text-muted num">{ist(e.createdAt)}</span>
                      <span className="font-semibold">message to send by hand</span>
                      <span>“{text}”</span>
                    </li>
                  );
                }
                return (
                  <li key={e.id} className="flex flex-wrap gap-x-3">
                    <span className="text-muted num">{ist(e.createdAt)}</span>
                    <span className="font-semibold">{label(e.type)}</span>
                    <span className="text-muted">by {e.actor === "system" || e.actor === "applicant" ? e.actor : nameOf(e.actor)}</span>
                    {d.from && d.to && <span>{STAGE_LABELS[d.from as keyof typeof STAGE_LABELS] ?? d.from} → {STAGE_LABELS[d.to as keyof typeof STAGE_LABELS] ?? d.to}</span>}
                    {d.owner && <span>owner {nameOf(d.owner)}</span>}
                    {d.bank && <span>{d.bank}{d.bankReference ? ` · ref ${d.bankReference}` : ""}</span>}
                    {d.status && <span>{BANK_STATUS_LABELS[d.status as BankStatus] ?? d.status}</span>}
                    {d.slot && <span>{slotTitle(af, d.slot)}</span>}
                    {d.reason && <span>{label(d.reason)}</span>}
                    {d.flag && <span>{label(d.flag)}</span>}
                    {d.field && <span>{d.field}</span>}
                    {Array.isArray(d.fields) && <span>{(d.fields as unknown as string[]).join(", ")}</span>}
                    {d.note && <span className="italic">“{d.note}”</span>}
                  </li>
                );
              })}
            </ol>
          </Panel>
        </div>

        {/* Right column: case handling */}
        <div className="space-y-6">
          {can(user, "application.assign") && stage !== "CLOSED" && (
            <Panel title="Owner">
              <ActionForm action={assignOwner} hidden={{ id: a.id }} buttons={[{ label: a.ownerId ? "Reassign" : "Assign" }]} className="space-y-2">
                <select name="owner" defaultValue={a.ownerId ?? ""} className="field-input !py-2" aria-label="Owner">
                  <option value="" disabled>Pick a person</option>
                  {staff.map((s) => <option key={s.username} value={s.username}>{s.name} ({ROLES[s.role]})</option>)}
                </select>
                <label className="block text-xs text-muted">Due by (optional)<input type="date" name="due" className="field-input !py-2 mt-1" /></label>
                {a.ownerId && <input name="reason" placeholder="Reason for reassigning" className="field-input !py-2" aria-label="Reason for reassigning" />}
              </ActionForm>
            </Panel>
          )}

          <Panel title="Flags" aside={openFlags.length ? `${openFlags.length} open` : undefined}>
            {a.flags.length === 0 && <p className="text-sm text-muted">No flags. Intake checks raise duplicate and velocity flags for a person to decide; nothing is rejected automatically.</p>}
            <ul className="space-y-2 text-sm">
              {a.flags.map((f) => (
                <li key={f.id} className="rounded-xl bg-canvas px-3 py-2">
                  <p><b>{label(f.type)}</b> · {f.detail} <span className="text-xs text-muted">({label(f.status)}{f.resolvedBy ? ` by ${nameOf(f.resolvedBy)}` : ""})</span></p>
                  {f.resolutionNote && <p className="text-xs text-muted">{f.resolutionNote}</p>}
                  {f.status === "OPEN" && can(user, "flag.resolve") && (
                    <ActionForm action={resolveFlag} hidden={{ flagId: f.id }} buttons={[{ label: "Clear", tone: "ghost" }]} className="mt-2 space-y-2">
                      <select name="outcome" className="field-input !py-2" aria-label="Outcome">
                        <option value="CLEARED">Cleared: not a problem</option>
                        <option value="CONFIRMED">Confirmed: a real problem</option>
                      </select>
                      <input name="note" placeholder="What you checked" className="field-input !py-2" aria-label="What you checked" />
                    </ActionForm>
                  )}
                </li>
              ))}
            </ul>
          </Panel>

          {can(user, "hold.set") && stage !== "CLOSED" && (
            <Panel title="Hold">
              <ActionForm action={setHold} hidden={{ id: a.id }} buttons={[{ label: a.onHold ? "Release hold" : "Put on hold", tone: a.onHold ? "ghost" : "danger" }]} className="space-y-2">
                <input name="reason" placeholder={a.onHold ? "Note (optional)" : "Reason (not shown to the applicant)"} className="field-input !py-2" aria-label="Hold reason" />
                <p className="text-xs text-muted">A hold stops every step and is released by a different person. The applicant sees only “under review”.</p>
              </ActionForm>
            </Panel>
          )}

          <Panel title="Consent" aside={consent.valid ? "valid" : "not valid"}>
            <p className="text-sm">Banks consented: {consent.bankIds.length ? consent.bankIds.map((b) => bankById(b)?.name ?? b).join(", ") : "none"}</p>
            <p className="text-xs text-muted">Bank list {consent.bankListVersion ?? "—"} · notice {consent.noticeVersion ?? "—"}{consent.grantedAt ? ` · ${ist(consent.grantedAt)}` : ""}{consent.marketing ? " · marketing yes" : ""}</p>
            {consentOutdated && <p className="text-sm text-amber-900 mt-2">The bank list changed since the applicant consented. Ask them to re-consent before a new bank is used.</p>}
            {consentOutdated && owner && can(user, "consent.request") && (
              <ActionForm action={requestReconsent} hidden={{ id: a.id }} buttons={[{ label: "Ask to re-consent", tone: "ghost" }]} className="mt-2" />
            )}
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-violet">Consent ledger ({a.consents.length})</summary>
              <ul className="mt-2 space-y-1 text-xs">
                {a.consents.map((c) => (
                  <li key={c.id}><span className={c.granted ? "text-emerald-800" : "text-danger"}>{c.granted ? "granted" : "withdrawn"}</span> {label(c.purpose)} · {c.noticeVersion}{c.bankListVersion ? ` · ${c.bankListVersion}` : ""} · {ist(c.createdAt)}</li>
                ))}
              </ul>
            </details>
          </Panel>

          {owner && can(user, "task.raise") && stage !== "CLOSED" && (
            <Panel title="Applicant link">
              <ActionForm action={issueApplicantLink} hidden={{ id: a.id }} buttons={[{ label: "Issue a new link", tone: "ghost" }]} confirm="The applicant's current link will stop working. Continue?" className="space-y-2">
                <p className="text-xs text-muted">For an applicant who lost their link. Send it only to +91 {maskMobile(a.mobile)}.</p>
              </ActionForm>
            </Panel>
          )}

          {(can(user, "application.close") || (can(user, "application.propose_close") && owner)) && stage !== "CLOSED" && (
            <Panel title={can(user, "application.close") ? "Close" : "Propose closing"}>
              <ActionForm action={closeApplication} hidden={{ id: a.id }} buttons={[{ label: can(user, "application.close") ? "Close application" : "Propose", tone: "danger" }]} confirm={can(user, "application.close") ? "Close this application?" : undefined} className="space-y-2">
                <select name="reason" className="field-input !py-2" aria-label="Close reason">
                  {MANUAL_CLOSE_REASONS.map((r) => <option key={r} value={r}>{CLOSE_REASONS[r]}</option>)}
                </select>
                <input name="note" placeholder="Note" className="field-input !py-2" aria-label="Close note" />
              </ActionForm>
            </Panel>
          )}

          {can(user, "note.add") && (
            <Panel title="Note">
              <ActionForm action={addNote} hidden={{ id: a.id }} buttons={[{ label: "Save note", tone: "ghost" }]} className="space-y-2">
                <textarea name="note" rows={3} className="field-input" placeholder="Call notes, what the applicant said" aria-label="Note" />
              </ActionForm>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function Panel({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h2 className="font-bold text-lg">{title}</h2>
        {aside && <span className="text-xs text-muted">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

function show(key: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (key === "existingLoans" && Array.isArray(v)) return v.length ? v.map((l: { type: string; lender: string; emi: number }) => `${l.lender || l.type} ₹${Number(l.emi).toLocaleString("en-IN")}`).join(", ") : "none";
  if (["monthlyIncome", "annualIncome", "existingEmi", "creditCardLimit", "loanAmount"].includes(key)) return formatINR(Number(v));
  const maps: Record<string, Record<string, string>> = { employmentType: EMPLOYMENT_LABELS, gender: GENDERS, residenceType: RESIDENCE_TYPES, salaryMode: SALARY_MODES, purpose: LOAN_PURPOSES, gstRegistered: { YES: "Yes", NO: "No" } };
  if (maps[key]) return maps[key][String(v)] ?? String(v);
  if (key === "tenureMonths") return `${v} months`;
  return String(v);
}
