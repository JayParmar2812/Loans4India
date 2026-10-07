/**
 * The three status fields of Platform Flow v4 (section 39), kept separate on purpose:
 * 1. Application state: our own process.
 * 2. Attempt state: one submission to one bank.
 * 3. Bank-confirmed status: only from bank evidence.
 * Staff labels live here; the applicant's wording is computed in src/lib/tracker.ts.
 */

export const STAGES = [
  "ENQUIRY",
  "CONSENT_PENDING",
  "PROFILE_IN_PROGRESS",
  "DOCUMENTS_PENDING",
  "VERIFICATION_REVIEW",
  "ACTION_NEEDED",
  "APPLICATION_PREPARATION",
  "INTERNAL_REVIEW",
  "READY_FOR_BANK",
  "SUBMITTED_TO_BANK",
  "CLOSED",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  ENQUIRY: "Enquiry",
  CONSENT_PENDING: "Consent pending",
  PROFILE_IN_PROGRESS: "Filling details",
  DOCUMENTS_PENDING: "Documents pending",
  VERIFICATION_REVIEW: "Verification review",
  ACTION_NEEDED: "Action needed",
  APPLICATION_PREPARATION: "Preparing for bank",
  INTERNAL_REVIEW: "Awaiting gate approval",
  READY_FOR_BANK: "Ready for bank",
  SUBMITTED_TO_BANK: "Submitted to bank",
  CLOSED: "Closed",
};

export const STAGE_TONE: Record<Stage, string> = {
  ENQUIRY: "bg-violet-soft text-violet-deep",
  CONSENT_PENDING: "bg-violet-soft text-violet-deep",
  PROFILE_IN_PROGRESS: "bg-sky-100 text-sky-900",
  DOCUMENTS_PENDING: "bg-amber-100 text-amber-900",
  VERIFICATION_REVIEW: "bg-orange-100 text-orange-900",
  ACTION_NEEDED: "bg-amber-100 text-amber-900",
  APPLICATION_PREPARATION: "bg-indigo-100 text-indigo-900",
  INTERNAL_REVIEW: "bg-indigo-100 text-indigo-900",
  READY_FOR_BANK: "bg-emerald-100 text-emerald-900",
  SUBMITTED_TO_BANK: "bg-mint text-mint-ink",
  CLOSED: "bg-gray-200 text-gray-700",
};

export const isStage = (s: string): s is Stage => (STAGES as readonly string[]).includes(s);

/** States in which the applicant can still change their details and documents freely. */
export const APPLICANT_EDITABLE: readonly Stage[] = ["ENQUIRY", "CONSENT_PENDING", "PROFILE_IN_PROGRESS", "DOCUMENTS_PENDING"];
/** States in which the application has not yet reached a bank. */
export const BEFORE_BANK: readonly Stage[] = STAGES.filter((s) => s !== "SUBMITTED_TO_BANK" && s !== "CLOSED");

export const CLOSE_REASONS = {
  DISBURSED: "Disbursed by the bank",
  REJECTED_BY_BANK: "Rejected by the bank (no re-route)",
  REJECTED_INTERNAL: "Rejected in our review (fraud, forged documents, out of scope)",
  CANCELLED_BY_BANK: "Cancelled by the bank",
  WITHDRAWN: "Withdrawn by the applicant",
  CONSENT_REVOKED: "Applicant withdrew consent",
  DORMANT: "No applicant activity",
  DUPLICATE: "Duplicate of another open application",
  NO_ELIGIBLE_BANK: "No bank passes the sourcing filters",
} as const;
export type CloseReason = keyof typeof CLOSE_REASONS;
export const isCloseReason = (s: string): s is CloseReason => s in CLOSE_REASONS;
/** Close reasons staff may pick by hand; the rest are set by the system or the applicant. */
export const MANUAL_CLOSE_REASONS: CloseReason[] = ["REJECTED_BY_BANK", "REJECTED_INTERNAL", "WITHDRAWN", "DUPLICATE", "NO_ELIGIBLE_BANK", "DORMANT"];

export const ATTEMPT_STATES = ["PREPARING", "READY_TO_SUBMIT", "SUBMITTED", "OUTCOME_RECEIVED", "CLOSED", "RETURNED_OR_FAILED", "SUPERSEDED"] as const;
export type AttemptState = (typeof ATTEMPT_STATES)[number];
export const ACTIVE_ATTEMPT_STATES: readonly AttemptState[] = ["PREPARING", "READY_TO_SUBMIT", "SUBMITTED", "OUTCOME_RECEIVED"];
export const ATTEMPT_LABELS: Record<AttemptState, string> = {
  PREPARING: "Preparing",
  READY_TO_SUBMIT: "Ready to submit",
  SUBMITTED: "Submitted",
  OUTCOME_RECEIVED: "Outcome received",
  CLOSED: "Closed",
  RETURNED_OR_FAILED: "Returned / failed",
  SUPERSEDED: "Superseded (re-routed)",
};

export const BANK_STATUSES = ["RECEIVED", "PROCESSING", "QUERY", "IN_PRINCIPLE", "SANCTIONED", "AGREEMENT_COMPLETED", "DISBURSED", "REJECTED", "CANCELLED"] as const;
export type BankStatus = (typeof BANK_STATUSES)[number];
export const isBankStatus = (s: string): s is BankStatus => (BANK_STATUSES as readonly string[]).includes(s);
export const BANK_STATUS_LABELS: Record<BankStatus, string> = {
  RECEIVED: "Received",
  PROCESSING: "Processing",
  QUERY: "Query",
  IN_PRINCIPLE: "In-principle approval",
  SANCTIONED: "Sanctioned",
  AGREEMENT_COMPLETED: "Agreement completed",
  DISBURSED: "Disbursed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};
/** These need a second person to confirm against the evidence before they count (section 19 step 7). */
export const CHECKED_BANK_STATUSES: readonly BankStatus[] = ["IN_PRINCIPLE", "SANCTIONED", "DISBURSED"];
/** Order used to flag a status moving backwards (allowed only with a reason). */
export const BANK_STATUS_RANK: Record<BankStatus, number> = {
  RECEIVED: 1, PROCESSING: 2, QUERY: 2, IN_PRINCIPLE: 3, SANCTIONED: 4, AGREEMENT_COMPLETED: 5, DISBURSED: 6, REJECTED: 9, CANCELLED: 9,
};

/** Where bank evidence came from, strongest first (section 19 step 6). Manual entry uses the last four. */
export const EVIDENCE_SOURCES = {
  BANK_API: "Bank API",
  BANK_MIS: "Bank MIS file",
  BANK_EMAIL: "Email from the bank",
  PORTAL_SCREENSHOT: "Bank portal screenshot",
  MASTER_DSA_REPORT: "Master DSA report",
} as const;
export type EvidenceSource = keyof typeof EVIDENCE_SOURCES;
export const MANUAL_EVIDENCE_SOURCES: EvidenceSource[] = ["BANK_MIS", "BANK_EMAIL", "PORTAL_SCREENSHOT", "MASTER_DSA_REPORT"];

export const BANK_REJECTION_CODES = {
  POLICY_PINCODE: "Policy: pin code",
  POLICY_EMPLOYER: "Policy: employer category",
  CREDIT: "Credit",
  INCOME: "Income",
  DOCUMENTS: "Documents",
  FRAUD_SUSPICION: "Fraud suspicion",
  OTHER: "Other",
} as const;

/** Maximum re-routes per application (so at most 3 banks ever see one application). */
export const MAX_REROUTES = 2;
