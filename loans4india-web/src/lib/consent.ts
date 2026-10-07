import { brand } from "@/config/brand";
import { consentBanks } from "@/config/banks";
import { bankListVersionFor, coverage, type Flow } from "@/config/applicantFlow";

/**
 * The one consent screen (Platform Flow v4, section 5).
 * One required tick covers processing, sharing with the banks named on the screen, and service messages;
 * one optional tick covers marketing and is never pre-ticked.
 * Bump CONSENT_VERSION whenever wording changes. Each ConsentRecord stores the exact text, its hash,
 * this version and the bank-list version the applicant saw.
 * TODO: legal review before live data (DPDP Act 2023 / DPDP Rules 2025, RBI Digital Lending Directions 2025).
 */
export const CONSENT_VERSION = "2026-10-04.v3";

export type ConsentPurpose = "CONTACT" | "PROCESS_APPLICATION" | "SHARE_WITH_PARTNER_LENDERS" | "MARKETING";
/** Purposes covered by the required tick. */
export const REQUIRED_PURPOSES: ConsentPurpose[] = ["PROCESS_APPLICATION", "SHARE_WITH_PARTNER_LENDERS", "CONTACT"];

export type ConsentNotice = {
  version: string;
  bankListVersion: string;
  bankIds: string[];
  /** The notice paragraphs shown on the screen, in order. */
  sections: { title: string; body: string }[];
  requiredText: string;
  marketingText: string;
};

/** Build the notice for a loan type from the live flow. The same function renders the screen and records what was shown. */
export function consentNotice(product: string, flow: Flow): ConsentNotice {
  const banks = consentBanks(coverage(flow, product));
  const bankNames = banks.map((b) => `${b.name} (${b.type})`);
  const list = bankNames.length ? bankNames.join("; ") : "no partner bank is available for this loan yet";
  const sections = [
    {
      title: "Who we are",
      body: `${brand.name} is a loan sourcing service (Direct Selling Agent), not a lender. We don't charge you any fee.`,
    },
    {
      title: "What we collect",
      body: "Your application details and the documents listed for your loan type.",
    },
    {
      title: "Who receives it",
      body: `Only these partner banks for this loan: ${list}. We choose one of them; you will see its name once your application is submitted to it. If that bank declines, we may try another bank on this list, one at a time.`,
    },
    {
      title: "What the bank does",
      body: "The bank does its own checks (including KYC and credit checks) and makes every decision about your loan. The bank may contact you directly.",
    },
    {
      title: "Your rights",
      body: `You can withdraw your application, revoke this consent, ask to see, correct or erase your data, and nominate someone to act for you. Grievance Officer: ${brand.grievanceOfficer.name}, ${brand.grievanceOfficer.email}.`,
    },
    {
      title: "How long we keep it",
      body: "We keep your data only as long as your application and the law need it, then delete it. Details are in our Privacy Policy.",
    },
  ];
  return {
    version: CONSENT_VERSION,
    bankListVersion: bankListVersionFor(flow, product),
    bankIds: banks.map((b) => b.id),
    sections,
    requiredText: `I agree to ${brand.name} processing my application, sharing it and my documents with the partner banks named above for this loan only, and sending me service messages about it by SMS, WhatsApp, email or call.`,
    marketingText: "Send me tips and relevant loan information in future. (Optional. You can stop this any time.)",
  };
}

/** The exact text stored with the required consent records: every section plus the tick wording. */
export function requiredNoticeText(n: ConsentNotice): string {
  return [...n.sections.map((s) => `${s.title}: ${s.body}`), `Tick: ${n.requiredText}`].join("\n");
}
