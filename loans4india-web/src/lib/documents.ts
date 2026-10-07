/**
 * Built-in document types, and the rules for uploads and replacements.
 * The checklists themselves (which documents each loan type and way of earning needs) live in
 * src/config/applicantFlow.ts, where the master admin can change them for new applications.
 * Pure data: safe to import on client and server.
 */

export type SlotId =
  | "PAN"
  | "AADHAAR"
  | "ADDRESS_PROOF"
  | "PHOTO"
  | "SALARY_SLIPS"
  | "BANK_STATEMENT"
  | "FORM16"
  | "ITR"
  | "BUSINESS_PROOF"
  | "BUSINESS_PAN"
  | "BUSINESS_REGISTRATION"
  | "BUSINESS_ADDRESS_PROOF"
  | "FINANCIALS"
  | "GST_RETURNS"
  | "CONSTITUTION_DOCS"
  | "EXISTING_LOANS";

export type Slot = {
  /** A built-in SlotId, or a document type the master admin added (C_...). */
  id: string;
  title: string;
  /** What exactly to upload, in plain words. */
  hint: string;
  required: boolean;
  /** Max files in this slot (multi-month statements, front/back images). */
  maxFiles: number;
};

export const BUILTIN_DOC_TYPES: Record<SlotId, Omit<Slot, "required">> = {
  PAN: { id: "PAN", title: "PAN card", hint: "Clear photo or PDF of your PAN card.", maxFiles: 2 },
  AADHAAR: {
    id: "AADHAAR",
    title: "Aadhaar card (masked)",
    hint: "Front and back of your Aadhaar with the first 8 digits hidden. Download a masked Aadhaar from the UIDAI website (myaadhaar.uidai.gov.in). Do not upload a copy showing the full number.",
    maxFiles: 2,
  },
  ADDRESS_PROOF: {
    id: "ADDRESS_PROOF",
    title: "Current address proof",
    hint: "Only if you now live somewhere other than the address on your Aadhaar: passport, driving licence, voter ID, rent agreement, or a utility bill under 3 months old.",
    maxFiles: 4,
  },
  PHOTO: { id: "PHOTO", title: "Your photograph", hint: "A recent passport-size photo. Only if you have one handy.", maxFiles: 1 },
  SALARY_SLIPS: { id: "SALARY_SLIPS", title: "Salary slips", hint: "Last 6 months, one slip per month. The latest slip should be less than 45 days old.", maxFiles: 12 },
  BANK_STATEMENT: {
    id: "BANK_STATEMENT",
    title: "Bank statement",
    hint: "Last 6 months of the account your salary comes into. Download it from net banking as a PDF without a password.",
    maxFiles: 6,
  },
  FORM16: { id: "FORM16", title: "Form 16", hint: "Latest Form 16 from your employer, if you have it.", maxFiles: 2 },
  ITR: { id: "ITR", title: "Income tax returns (ITR)", hint: "Last 2 years' ITR acknowledgements with computation of income.", maxFiles: 6 },
  BUSINESS_PROOF: {
    id: "BUSINESS_PROOF",
    title: "Business or profession proof",
    hint: "Any one: GST certificate, Udyam registration, Shop & Establishment licence, or professional registration (e.g. medical council, ICAI).",
    maxFiles: 3,
  },
  BUSINESS_PAN: { id: "BUSINESS_PAN", title: "Business PAN card", hint: "Needed for partnership firms, LLPs and companies. Proprietors can skip this.", maxFiles: 2 },
  BUSINESS_REGISTRATION: {
    id: "BUSINESS_REGISTRATION",
    title: "Business registration",
    hint: "Any one: GST certificate, Udyam registration certificate, or Shop & Establishment licence.",
    maxFiles: 3,
  },
  BUSINESS_ADDRESS_PROOF: {
    id: "BUSINESS_ADDRESS_PROOF",
    title: "Business address proof",
    hint: "Electricity bill, rent agreement or property papers for your business premises.",
    maxFiles: 3,
  },
  FINANCIALS: {
    id: "FINANCIALS",
    title: "Financial statements",
    hint: "Last 2 years' profit & loss account and balance sheet (CA-audited if your turnover requires an audit).",
    maxFiles: 6,
  },
  GST_RETURNS: { id: "GST_RETURNS", title: "GST returns", hint: "Last 12 months of GSTR-3B, if your business is GST registered.", maxFiles: 12 },
  CONSTITUTION_DOCS: {
    id: "CONSTITUTION_DOCS",
    title: "Firm / company documents",
    hint: "Partnership deed, LLP agreement, or MOA, AOA and certificate of incorporation, plus a board resolution for companies, and PAN and masked Aadhaar of every partner or director. Proprietors can skip this.",
    maxFiles: 6,
  },
  EXISTING_LOANS: {
    id: "EXISTING_LOANS",
    title: "Existing loan details",
    hint: "Sanction letters or repayment schedules of loans you are already paying, if any.",
    maxFiles: 6,
  },
};

export const SLOT_TITLES: Record<string, string> = Object.fromEntries(Object.values(BUILTIN_DOC_TYPES).map((s) => [s.id, s.title]));

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;
export const ACCEPT_ATTR = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

/**
 * Reason codes for asking for a replacement (Platform Flow v4, section 14), with the default plain-words
 * message the applicant sees. The reviewer adds their own instruction; OTHER requires one.
 * UNMASKED_AADHAAR is kept because a visible Aadhaar number must always be rejected (section 30).
 */
export const REJECT_REASONS: Record<string, string> = {
  BLURRY: "The file is blurry. Please upload a clearer copy.",
  UNREADABLE: "We couldn't read this file. Please upload a clearer copy.",
  WRONG_DOCUMENT: "This isn't the document we asked for in this slot.",
  EXPIRED: "This document is too old. Please upload a recent one.",
  MISSING_PAGES: "Some pages are missing. Please upload the full document.",
  NAME_MISMATCH: "The name on this document doesn't match your application.",
  PERIOD_INCOMPLETE: "Some months are missing. Please upload the full period.",
  PASSWORD_PROTECTED: "This file is password-protected. Please upload a copy without a password.",
  UNMASKED_AADHAAR: "Please upload a masked Aadhaar (first 8 digits hidden). You can download one from myaadhaar.uidai.gov.in.",
  OTHER: "Please upload this document again.",
};
/** Codes no longer offered but still on older records. */
export const LEGACY_REJECT_REASONS: Record<string, string> = {
  INCOMPLETE: "Some pages or months are missing. Please upload the full document.",
};
export const rejectMessage = (code: string | null) => REJECT_REASONS[code ?? "OTHER"] ?? LEGACY_REJECT_REASONS[code ?? ""] ?? REJECT_REASONS.OTHER;
