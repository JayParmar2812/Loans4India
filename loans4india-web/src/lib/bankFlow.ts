import { agreementActive, bankById, BANKS, type BankConfig, type BankTemplate } from "@/config/banks";
import { checklistFor, type AppFlow } from "@/config/applicantFlow";
import { ageOn, GENDERS, LOAN_PURPOSES, SALARY_MODES, type DetailValues } from "./profile";

/**
 * Bank selection, submission package and the Ready-for-Bank gate (Platform Flow v4, sections 15-17).
 * Pure: the server decides, the screens show the same results.
 */

// ---------- Section 15: the three filters ----------

export type Candidate = { bank: BankConfig; ok: boolean; reasons: string[] };

export function bankCandidates(input: {
  /** Banks covering the loan type in the live applicant flow. */
  coverage: string[];
  consentBankIds: string[];
  values: DetailValues;
  /** Banks already tried on this application (re-route never goes back to them). */
  triedBankIds: string[];
  today?: Date;
}): Candidate[] {
  const v = input.values;
  return BANKS.filter((b) => input.coverage.includes(b.id)).map((bank) => {
    const reasons: string[] = [];
    if (input.triedBankIds.includes(bank.id)) reasons.push("Already tried on this application");
    if (!input.consentBankIds.includes(bank.id)) reasons.push("Not on the bank list the applicant consented to");
    if (!agreementActive(bank, input.today)) reasons.push("No active agreement / DSA code for this product today");
    const s = bank.sourcing;
    const age = typeof v.dob === "string" ? ageOn(v.dob, input.today) : null;
    if (age !== null && s.minAge && age < s.minAge) reasons.push(`Age ${age} is below the bank's minimum ${s.minAge}`);
    if (age !== null && s.maxAge && age > s.maxAge) reasons.push(`Age ${age} is above the bank's maximum ${s.maxAge}`);
    const income = Number(v.monthlyIncome) || 0;
    if (s.minMonthlyIncome && income < s.minMonthlyIncome) reasons.push(`Monthly income below the bank's minimum ₹${s.minMonthlyIncome.toLocaleString("en-IN")}`);
    if (s.employmentTypes && !s.employmentTypes.includes(String(v.employmentType ?? ""))) reasons.push("Employment type not sourced by this bank");
    if (s.pincodePrefixes && !s.pincodePrefixes.some((p) => String(v.pincode ?? "").startsWith(p))) reasons.push("PIN code not served by this bank");
    return { bank, ok: reasons.length === 0, reasons };
  });
}

export const SELECTION_BASES = {
  PRODUCT_COVERAGE: "Product coverage",
  SOURCING_FIT: "Best fit with the bank's sourcing criteria",
  TURNAROUND: "Bank turnaround",
  CAPACITY: "Bank capacity / relationship",
  ONLY_OPTION: "Only bank that passes the filters",
} as const;

// ---------- Section 16: mapping engine ----------

export type MappedField = { bankField: string; value: string | null; required: boolean };

/** Our record → the bank's format, using the template's value maps and conversions. */
export function mapFields(template: BankTemplate, values: Record<string, unknown>): MappedField[] {
  return template.fields.map((f) => {
    const raw = values[f.from];
    let value: string | null = raw === null || raw === undefined || raw === "" ? null : String(raw);
    if (value !== null) {
      switch (f.format) {
        case "date_dmy": {
          const [y, m, d] = value.split("-");
          value = d && m && y ? `${d}/${m}/${y}` : null;
          break;
        }
        case "annual_from_monthly":
          value = (Number(value) * 12).toLocaleString("en-IN");
          break;
        case "value_map":
          value = f.valueMap?.[value] ?? null;
          break;
        default:
          if (f.from === "purpose") value = LOAN_PURPOSES[value as keyof typeof LOAN_PURPOSES] ?? value;
          if (f.from === "gender") value = GENDERS[value as keyof typeof GENDERS] ?? value;
          if (f.from === "salaryMode") value = SALARY_MODES[value as keyof typeof SALARY_MODES] ?? value;
      }
    }
    return { bankField: f.bankField, value, required: f.required };
  });
}

/** Values the template reads, from the application record. PAN comes in masked unless the operator's download asks for it. */
export function packageValues(app: { mobile: string; loanAmount: number; tenureMonths: number | null; purpose: string | null }, values: DetailValues, pan: string | null) {
  return { ...values, pan, mobile: app.mobile, loanAmount: app.loanAmount, tenureMonths: app.tenureMonths ?? values.tenureMonths, purpose: values.purpose ?? app.purpose } as Record<string, unknown>;
}

/** File name a bank expects for a document. */
export function bankFileName(template: BankTemplate, slot: string, reference: string, n: number, ext: string) {
  const pattern = template.documentNames[slot] ?? `${slot}_{ref}_{n}`;
  return `${pattern.replace("{ref}", reference).replace("{n}", String(n))}.${ext}`;
}

// ---------- Section 17: the gate ----------

export type GateInput = {
  consentValid: boolean;
  consentBankIds: string[];
  bankId: string;
  mapped: MappedField[];
  /** The application's own flow: its checklist decides the required documents. */
  flow: AppFlow;
  employmentType: string | null;
  acceptedSlots: string[];
  openTasks: number;
  onHold: boolean;
  openFlags: number;
  templateVersion: string | null;
  preparedBy: string | null;
  approver: string;
  today?: Date;
};

export type GateCheck = { id: number; label: string; ok: boolean; detail?: string };

export function gateChecks(g: GateInput): GateCheck[] {
  const bank = bankById(g.bankId);
  const missingFields = g.mapped.filter((f) => f.required && !f.value).map((f) => f.bankField);
  const missingDocs = checklistFor(g.flow, g.employmentType).filter((s) => s.required && !g.acceptedSlots.includes(s.id)).map((s) => s.title);
  return [
    { id: 1, label: "Consent is valid right now", ok: g.consentValid },
    { id: 2, label: "The bank is on the applicant's consented bank list", ok: g.consentBankIds.includes(g.bankId) },
    { id: 3, label: "The bank's agreement and DSA code are active today", ok: Boolean(bank && agreementActive(bank, g.today)) },
    { id: 4, label: "Every required bank field has a value", ok: missingFields.length === 0, detail: missingFields.join(", ") || undefined },
    { id: 5, label: "Every required document has an accepted version", ok: missingDocs.length === 0, detail: missingDocs.join(", ") || undefined },
    {
      id: 6,
      label: "No open Action needed task, hold, duplicate or fraud flag",
      ok: g.openTasks === 0 && !g.onHold && g.openFlags === 0,
      detail: [g.openTasks && `${g.openTasks} open task(s)`, g.onHold && "on hold", g.openFlags && `${g.openFlags} open flag(s)`].filter(Boolean).join(", ") || undefined,
    },
    { id: 7, label: "The template version is recorded in the manifest", ok: Boolean(g.templateVersion) },
    { id: 8, label: "The approver is not the person who prepared the package", ok: Boolean(g.preparedBy) && g.preparedBy !== g.approver },
  ];
}
