/**
 * What the applicant sees (Platform Flow v4, section 10).
 * The label is computed from the three status fields; it is never stored, and never shows internal codes.
 * Bank milestones show only after the bank confirmed them (and a second person checked the key ones).
 * Pure: safe on client and server.
 */
import { brand } from "@/config/brand";

export type TrackerInput = {
  stage: string;
  onHold: boolean;
  closedReason: string | null;
  /** Latest confirmed bank status of the active (or last) attempt. */
  bankStatus: string | null;
  bankName: string | null;
  openTaskMessages: string[];
  missingDocuments: string[];
};

export type TrackerView = { step: number; title: string; body: string; tone: "info" | "action" | "done" | "closed" };

/** Six steps on the progress bar. */
export const TRACKER_STEPS = ["Details", "Documents", "Review by us", "With the bank", "Bank decision", "Disbursed"] as const;

export function trackerView(t: TrackerInput): TrackerView {
  const bank = t.bankName ?? "the bank";
  if (t.stage === "CLOSED") {
    switch (t.closedReason) {
      case "DISBURSED":
        return { step: 6, title: `${bank} has disbursed your loan`, body: `Any questions about the loan itself go to ${bank}. We're glad we could help.`, tone: "done" };
      case "REJECTED_BY_BANK":
        return { step: 5, title: `${bank} could not approve this application`, body: "The decision was made by the bank. You can ask the bank's grievance team for more detail.", tone: "closed" };
      case "CANCELLED_BY_BANK":
        return { step: 5, title: "Closed: cancelled", body: "This application has been cancelled.", tone: "closed" };
      case "WITHDRAWN":
        return { step: 0, title: "Closed: withdrawn", body: "You withdrew this application.", tone: "closed" };
      case "CONSENT_REVOKED":
        return { step: 0, title: "Closed: consent withdrawn", body: "You withdrew your consent, so we have stopped processing this application.", tone: "closed" };
      case "DORMANT":
        return { step: 0, title: "Closed: expired", body: "This application expired because it wasn't completed. You can start a new one any time.", tone: "closed" };
      default:
        return { step: 0, title: "Closed", body: "This application is closed. You can start a new one any time.", tone: "closed" };
    }
  }
  // A hold is never explained to the applicant.
  if (t.onHold) return { step: 3, title: `Under review by ${brand.name}`, body: "We need a little more time to review your application.", tone: "info" };

  if (t.stage === "SUBMITTED_TO_BANK") {
    if (t.openTaskMessages.length) return { step: 4, title: `${bank} needs more information`, body: t.openTaskMessages.join(" "), tone: "action" };
    switch (t.bankStatus) {
      case "PROCESSING":
        return { step: 4, title: `${bank} is reviewing your application`, body: "The bank may call you to verify your details.", tone: "info" };
      case "QUERY":
        return { step: 4, title: `${bank} needs more information`, body: "Our team will tell you exactly what is needed.", tone: "action" };
      case "IN_PRINCIPLE":
        return { step: 5, title: `${bank} has given in-principle approval`, body: "This is not a final sanction yet. The bank will complete its checks before deciding.", tone: "info" };
      case "SANCTIONED":
        return { step: 5, title: `${bank} has sanctioned your loan`, body: `Next steps, including the Key Fact Statement and agreement, are with ${bank}.`, tone: "done" };
      case "AGREEMENT_COMPLETED":
        return { step: 5, title: `Loan agreement completed with ${bank}`, body: "The bank will disburse the loan as per its process.", tone: "done" };
      default:
        return { step: 4, title: `Submitted to ${bank}`, body: "The bank does its own checks and makes the decision. It may contact you directly.", tone: "info" };
    }
  }
  if (t.stage === "ACTION_NEEDED") {
    return { step: 3, title: "Action needed", body: t.openTaskMessages.join(" ") || "Please update the items marked below.", tone: "action" };
  }
  if (t.stage === "CONSENT_PENDING") return { step: 1, title: "Please review and give consent to continue", body: "Our list of partner banks has changed. Please read the updated consent below.", tone: "action" };
  if (t.stage === "ENQUIRY" || t.stage === "PROFILE_IN_PROGRESS") return { step: 1, title: "Application started: finish your details", body: "Fill in the sections below. Everything saves as you go.", tone: "action" };
  if (t.stage === "DOCUMENTS_PENDING") {
    return { step: 2, title: "Documents needed", body: t.missingDocuments.length ? t.missingDocuments.join(", ") : "Review and submit your application.", tone: "action" };
  }
  // VERIFICATION_REVIEW, APPLICATION_PREPARATION, INTERNAL_REVIEW, READY_FOR_BANK
  return { step: 3, title: `Under review by ${brand.name}`, body: "Our team is checking your details and documents and preparing your application. We'll tell you if anything is needed.", tone: "info" };
}
