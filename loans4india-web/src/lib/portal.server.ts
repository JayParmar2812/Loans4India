import "server-only";
import { buildSlots, missingRequired, type DocView, type SlotView } from "./docstate";
import { consentNotice, type ConsentNotice } from "./consent";
import { consentState } from "./consentState";
import { detailsCheck, editableSections } from "./details.server";
import { fieldRules, fieldText, type DetailValues, type FieldKey } from "./profile";
import { appFlow, loanTypeLabel, type Question } from "@/config/applicantFlow";
import { trackerView, type TrackerView } from "./tracker";
import { APPLICANT_EDITABLE } from "./stages";
import { confirmedBankStatus, type ApplicantApp } from "./applicant.server";

export type PortalTask = { id: string; message: string; slots: string[]; fields: string[]; createdAt: string };

/** Everything the applicant's page needs, serialisable for the client. Never includes staff notes, flags or bank remarks. */
export type PortalState = {
  reference: string;
  product: string;
  loanAmount: number;
  stage: string;
  closed: boolean;
  tracker: TrackerView;
  productLabel: string;
  details: {
    values: DetailValues;
    rules: { key: FieldKey; required: boolean }[];
    /** Label and help text per shown field, as the master admin set them for this application. */
    text: Partial<Record<FieldKey, { label: string; hint: string }>>;
    /** The master admin's own questions this application asks. */
    questions: Question[];
    problems: { key: string; section: string; message: string }[];
    editable: string[] | "all";
  };
  slots: SlotView[];
  /** Slots that can take new files right now. */
  unlockedSlots: string[] | "all";
  tasks: PortalTask[];
  submitted: boolean;
  /** Ready to submit (or to send a response to an Action needed task). */
  canSubmit: boolean;
  submitLabel: string;
  reconsent: ConsentNotice | null;
  canWithdraw: boolean;
};

export const docViews = (docs: ApplicantApp["documents"]): DocView[] =>
  docs.map((d) => ({ id: d.id, slot: d.slot, name: d.originalName, sizeBytes: d.sizeBytes, status: d.status, rejectReason: d.rejectReason, rejectNote: d.rejectNote, createdAt: d.createdAt.toISOString() }));

export function uploadableSlots(app: { stage: string }, openTasks: { slots: string }[]): Set<string> | "all" {
  if ((APPLICANT_EDITABLE as readonly string[]).includes(app.stage)) return "all";
  const s = new Set<string>();
  // Action needed (ours, or a bank query passed on to the applicant): only the named slots unlock.
  for (const t of openTasks) for (const slot of JSON.parse(t.slots) as string[]) s.add(slot);
  return s;
}

export function portalState(app: ApplicantApp): PortalState {
  const { values, problems } = detailsCheck(app);
  const flow = appFlow(app);
  const employment = (values.employmentType as string | undefined) ?? app.employmentType;
  const slots = buildSlots(flow, employment, docViews(app.documents));
  const rules = fieldRules({ flow, employmentType: app.employmentType, values });
  const missing = missingRequired(slots);
  const tasks: PortalTask[] = app.tasks.map((t) => ({ id: t.id, message: t.message, slots: JSON.parse(t.slots), fields: JSON.parse(t.fields), createdAt: t.createdAt.toISOString() }));
  const active = [...app.attempts].reverse().find((a) => !["SUPERSEDED", "RETURNED_OR_FAILED"].includes(a.state)) ?? null;
  const submittedToBank = active && ["SUBMITTED", "OUTCOME_RECEIVED", "CLOSED"].includes(active.state);
  const bankStatus = confirmedBankStatus(app.bankStatuses, active?.id ?? null);
  const tracker = trackerView({
    stage: app.stage,
    onHold: app.onHold,
    closedReason: app.closedReason,
    bankStatus: bankStatus?.status ?? null,
    // The bank's name is shown only once the application is with that bank (section 15).
    bankName: submittedToBank ? active!.bankName : null,
    openTaskMessages: tasks.map((t) => t.message),
    missingDocuments: missing.map((m) => m.title),
  });
  const editable = editableSections(app, app.tasks);
  const unlocked = uploadableSlots(app, app.tasks);
  const consent = consentState(app.consents);
  const closed = app.stage === "CLOSED";
  const responding = app.stage === "ACTION_NEEDED";
  const beforeSubmit = (APPLICANT_EDITABLE as readonly string[]).includes(app.stage);
  return {
    reference: app.reference,
    product: app.product,
    loanAmount: app.loanAmount,
    stage: app.stage,
    closed,
    tracker,
    productLabel: loanTypeLabel(app.live.flow, app.product),
    details: {
      values,
      rules,
      text: Object.fromEntries(rules.map((r) => [r.key, fieldText(flow, r.key)])),
      questions: flow.questions,
      problems,
      editable: editable === "all" ? "all" : [...editable],
    },
    slots,
    unlockedSlots: unlocked === "all" ? "all" : [...unlocked],
    tasks,
    submitted: Boolean(app.submittedAt),
    canSubmit: !closed && consent.valid && problems.length === 0 && missing.length === 0 && (beforeSubmit || responding) && app.stage !== "CONSENT_PENDING",
    submitLabel: responding ? "Send my response" : "Submit application",
    reconsent: app.stage === "CONSENT_PENDING" ? consentNotice(app.product, app.live.flow) : null,
    canWithdraw: !closed,
  };
}
