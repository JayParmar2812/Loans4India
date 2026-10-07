import { z } from "zod";
import type { AppFlow, Question } from "@/config/applicantFlow";

/**
 * Application details: the one form the applicant fills (Platform Flow v4, section 6).
 * Each field saves on its own when the applicant leaves it, and is validated here on the server.
 * Pure: safe on client and server.
 */

export const SECTIONS = {
  personal: "Personal",
  employment: "Work and income",
  financial: "Existing loans",
  banking: "Your bank",
  loan: "Loan requirement",
  identity: "Identity details",
} as const;
export type SectionId = keyof typeof SECTIONS;

export const RESIDENCE_TYPES = { OWNED: "Owned", RENTED: "Rented", FAMILY: "Living with family", COMPANY: "Company provided" } as const;
export const GENDERS = { FEMALE: "Female", MALE: "Male", OTHER: "Other" } as const;
export const SALARY_MODES = { BANK_TRANSFER: "Bank transfer", CASH: "Cash", CHEQUE: "Cheque" } as const;
export const LOAN_PURPOSES = {
  MEDICAL: "Medical expenses",
  WEDDING: "Wedding",
  HOME_RENOVATION: "Home renovation",
  EDUCATION: "Education",
  TRAVEL: "Travel",
  DEBT_CONSOLIDATION: "Paying off other loans",
  BUSINESS_EXPANSION: "Business expansion",
  WORKING_CAPITAL: "Working capital",
  EQUIPMENT: "Machinery or equipment",
  OTHER: "Other",
} as const;
export const EXISTING_LOAN_TYPES = { HOME: "Home loan", PERSONAL: "Personal loan", CAR: "Car / two-wheeler", BUSINESS: "Business loan", GOLD: "Gold loan", CREDIT_CARD_EMI: "Credit card EMI", OTHER: "Other" } as const;
export const EMPLOYMENT_TYPES = ["SALARIED", "SELF_EMPLOYED_BUSINESS", "SELF_EMPLOYED_PROFESSIONAL"] as const;
export const TENURES = [12, 24, 36, 48, 60, 72, 84] as const;

/** Data tiers (section 43): decide masking for staff and what goes into the field history. */
export type Tier = "T0" | "T1" | "T2" | "T3";

export type FieldKey =
  | "fullName" | "dob" | "gender" | "addressLine" | "city" | "pincode" | "residenceType" | "yearsAtAddress" | "email"
  | "employmentType" | "employerName" | "designation" | "industry" | "workYears" | "monthlyIncome" | "annualIncome" | "salaryMode" | "gstRegistered" | "gstin"
  | "existingLoans" | "existingEmi" | "creditCardCount" | "creditCardLimit" | "otherObligations"
  | "primaryBankName" | "accountNumber" | "ifsc"
  | "loanAmount" | "tenureMonths" | "purpose"
  | "pan" | "fatherOrSpouseName";

const name = z.string().trim().min(3, "Enter the full name as on your PAN card").max(80).regex(/^[A-Za-z][A-Za-z .'-]+$/, "Use letters only");
const shortText = (label: string, max = 100) => z.string().trim().min(2, `Enter ${label}`).max(max);
const whole = (min: number, max: number, label: string) =>
  z.coerce.number({ error: `Enter ${label}` }).int(`${label} must be a whole number`).min(min, `${label} must be at least ${min.toLocaleString("en-IN")}`).max(max, `${label} looks too high, please check`);

/** Age on a date from a YYYY-MM-DD birth date. */
export function ageOn(dob: string, on = new Date()): number {
  const [y, m, d] = dob.split("-").map(Number);
  let age = on.getFullYear() - y;
  if (on.getMonth() + 1 < m || (on.getMonth() + 1 === m && on.getDate() < d)) age--;
  return age;
}

export const MIN_AGE = 21;
export const MAX_AGE = 60;

const existingLoan = z.object({
  type: z.enum(Object.keys(EXISTING_LOAN_TYPES) as [keyof typeof EXISTING_LOAN_TYPES]),
  lender: z.string().trim().min(2, "Enter the lender").max(60),
  emi: whole(0, 1_00_00_000, "EMI"),
});

export const FIELD_SCHEMAS: Record<FieldKey, z.ZodType> = {
  fullName: name,
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter your date of birth")
    .refine((s) => !Number.isNaN(Date.parse(s)), "Enter a valid date")
    .refine((s) => ageOn(s) >= MIN_AGE && ageOn(s) <= MAX_AGE, `Applicants must be ${MIN_AGE} to ${MAX_AGE} years old`),
  gender: z.enum(Object.keys(GENDERS) as [keyof typeof GENDERS]),
  addressLine: z.string().trim().min(8, "Enter your full current address").max(200),
  city: shortText("your city", 60),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  residenceType: z.enum(Object.keys(RESIDENCE_TYPES) as [keyof typeof RESIDENCE_TYPES]),
  yearsAtAddress: whole(0, 80, "Years at this address"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  employerName: shortText("the employer or business name"),
  designation: shortText("your designation or nature of business", 80),
  industry: shortText("the industry", 60),
  workYears: z.coerce.number({ error: "Enter years" }).min(0, "Enter years").max(50, "Please check the years"),
  monthlyIncome: whole(5000, 1_00_00_000, "Monthly income"),
  annualIncome: whole(60000, 1_00_00_00_000, "Annual income"),
  salaryMode: z.enum(Object.keys(SALARY_MODES) as [keyof typeof SALARY_MODES]),
  gstRegistered: z.enum(["YES", "NO"]),
  gstin: z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Enter a valid 15-character GSTIN"),
  existingLoans: z.array(existingLoan).max(10),
  existingEmi: whole(0, 1_00_00_000, "Existing EMIs"),
  creditCardCount: whole(0, 30, "Number of cards"),
  creditCardLimit: whole(0, 1_00_00_000, "Total card limit"),
  otherObligations: z.string().trim().max(200),
  primaryBankName: shortText("your bank's name", 60),
  accountNumber: z.string().trim().regex(/^\d{9,18}$/, "Enter a valid account number (9 to 18 digits)"),
  ifsc: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid 11-character IFSC"),
  loanAmount: whole(10000, 5_00_00_000, "Loan amount"),
  tenureMonths: z.coerce.number().int().refine((n) => (TENURES as readonly number[]).includes(n), "Pick a tenure"),
  purpose: z.enum(Object.keys(LOAN_PURPOSES) as [keyof typeof LOAN_PURPOSES]),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, "Enter a valid 10-character PAN, like ABCDE1234F"),
  fatherOrSpouseName: name,
};

export type FieldDef = { key: FieldKey; section: SectionId; label: string; tier: Tier; hint?: string; identity?: boolean };

export const FIELDS: FieldDef[] = [
  { key: "fullName", section: "personal", label: "Full name (as on PAN)", tier: "T1", identity: true },
  { key: "dob", section: "personal", label: "Date of birth", tier: "T2", identity: true },
  { key: "gender", section: "personal", label: "Gender", tier: "T2" },
  { key: "email", section: "personal", label: "Email", tier: "T1" },
  { key: "addressLine", section: "personal", label: "Current address (house, street, area)", tier: "T2" },
  { key: "city", section: "personal", label: "City", tier: "T2" },
  { key: "pincode", section: "personal", label: "PIN code", tier: "T2" },
  { key: "residenceType", section: "personal", label: "This home is", tier: "T2" },
  { key: "yearsAtAddress", section: "personal", label: "Years at this address", tier: "T2" },
  { key: "employmentType", section: "employment", label: "How do you earn?", tier: "T0" },
  { key: "employerName", section: "employment", label: "Employer or business name", tier: "T2" },
  { key: "designation", section: "employment", label: "Designation or nature of business", tier: "T2" },
  { key: "industry", section: "employment", label: "Industry", tier: "T2" },
  { key: "workYears", section: "employment", label: "Years in this job or business", tier: "T2" },
  { key: "monthlyIncome", section: "employment", label: "Monthly take-home salary (₹)", tier: "T2" },
  { key: "annualIncome", section: "employment", label: "Annual income (₹, as per ITR)", tier: "T2" },
  { key: "salaryMode", section: "employment", label: "How is your salary paid?", tier: "T2" },
  { key: "gstRegistered", section: "employment", label: "Is the business GST registered?", tier: "T2" },
  { key: "gstin", section: "employment", label: "GSTIN", tier: "T2" },
  { key: "existingLoans", section: "financial", label: "Loans you are paying now", tier: "T2" },
  { key: "existingEmi", section: "financial", label: "Total EMIs you pay per month (₹)", tier: "T2" },
  { key: "creditCardCount", section: "financial", label: "Credit cards you hold", tier: "T2" },
  { key: "creditCardLimit", section: "financial", label: "Total credit card limit (₹)", tier: "T2" },
  { key: "otherObligations", section: "financial", label: "Other regular payments (optional)", tier: "T2" },
  { key: "primaryBankName", section: "banking", label: "Bank your income comes into", tier: "T2" },
  { key: "accountNumber", section: "banking", label: "Account number (optional)", tier: "T3", hint: "Some banks need it to set up disbursal." },
  { key: "ifsc", section: "banking", label: "IFSC", tier: "T2" },
  { key: "loanAmount", section: "loan", label: "Loan amount (₹)", tier: "T0" },
  { key: "tenureMonths", section: "loan", label: "Repay over", tier: "T0" },
  { key: "purpose", section: "loan", label: "Purpose", tier: "T0" },
  { key: "pan", section: "identity", label: "PAN", tier: "T3", identity: true, hint: "Stored encrypted. Our team sees only the last 4 characters." },
  { key: "fatherOrSpouseName", section: "identity", label: "Father's or spouse's name", tier: "T2" },
];
export const fieldDef = (k: string) => FIELDS.find((f) => f.key === k);
export const isFieldKey = (k: string): k is FieldKey => FIELDS.some((f) => f.key === k);

/** Values as the form sees them. PAN and account number come back masked. */
export type DetailValues = Partial<Record<FieldKey, unknown>>;

type Ctx = { flow: AppFlow; employmentType?: string | null; values: DetailValues };

/** Label and help text for a field, as the master admin set them for this application. */
export function fieldText(flow: AppFlow, key: FieldKey): { label: string; hint: string } {
  const set = flow.fields[key];
  const def = fieldDef(key)!;
  return { label: set?.label ?? def.label, hint: set?.hint ?? def.hint ?? "" };
}

/** Core fields (identity, amount, how you earn) can't be hidden or made optional. */
const CORE: readonly FieldKey[] = ["fullName", "dob", "pan", "loanAmount", "employmentType"];

/**
 * Which fields this applicant sees, and which are mandatory (section 6: a salaried applicant never sees business questions).
 * The master admin's choices (hidden, always required, optional) apply on top, never to the core fields.
 */
export function fieldRules(ctx: Ctx): { key: FieldKey; required: boolean }[] {
  const emp = (ctx.values.employmentType as string | undefined) ?? ctx.employmentType ?? "";
  const salaried = emp === "SALARIED";
  const business = ctx.flow.loanType.form === "BUSINESS";
  const rules: { key: FieldKey; required: boolean; show?: boolean }[] = [
    { key: "fullName", required: true },
    { key: "dob", required: true },
    { key: "gender", required: false },
    { key: "email", required: true },
    { key: "addressLine", required: true },
    { key: "city", required: true },
    { key: "pincode", required: true },
    { key: "residenceType", required: true },
    { key: "yearsAtAddress", required: false },
    { key: "employmentType", required: true },
    { key: "employerName", required: true },
    { key: "designation", required: true },
    { key: "industry", required: false },
    { key: "workYears", required: true },
    { key: "monthlyIncome", required: true, show: salaried || !emp },
    { key: "annualIncome", required: true, show: !salaried && Boolean(emp) },
    { key: "salaryMode", required: true, show: salaried },
    { key: "gstRegistered", required: business, show: !salaried && Boolean(emp) },
    { key: "gstin", required: ctx.values.gstRegistered === "YES", show: ctx.values.gstRegistered === "YES" },
    { key: "existingLoans", required: false },
    { key: "existingEmi", required: true },
    { key: "creditCardCount", required: false },
    { key: "creditCardLimit", required: false },
    { key: "otherObligations", required: false },
    { key: "primaryBankName", required: true },
    { key: "accountNumber", required: false },
    { key: "ifsc", required: Boolean(ctx.values.accountNumber), show: true },
    { key: "loanAmount", required: true },
    { key: "tenureMonths", required: true },
    { key: "purpose", required: true },
    { key: "pan", required: true },
    { key: "fatherOrSpouseName", required: false },
  ];
  const out: { key: FieldKey; required: boolean }[] = [];
  for (const r of rules) {
    if (r.show === false) continue;
    const mode = CORE.includes(r.key) ? "default" : (ctx.flow.fields[r.key]?.mode ?? "default");
    if (mode === "hidden") continue;
    out.push({ key: r.key, required: mode === "required" ? true : mode === "optional" ? false : r.required });
  }
  return out;
}

/** How an answer to one of the master admin's own questions is checked. */
export function answerSchema(q: Question): z.ZodType {
  switch (q.type) {
    case "number":
      return z.coerce.number({ error: "Enter a number" }).min(0, "Enter a number").max(1e12, "Please check this number");
    case "yesno":
      return z.enum(["YES", "NO"], { error: "Pick yes or no" });
    case "choice":
      return z.string().refine((v) => q.options.includes(v), "Pick one of the choices");
    default:
      return z.string().trim().min(1, "Enter an answer").max(300, "Keep it under 300 characters");
  }
}

const empty = (v: unknown) => v === undefined || v === null || v === "";

export type DetailProblem = { key: string; section: SectionId | "form"; message: string };

/** Required fields and questions still missing or invalid, plus cross-field problems. */
export function detailsProblems(ctx: Ctx): DetailProblem[] {
  const out: DetailProblem[] = [];
  for (const r of fieldRules(ctx)) {
    const v = ctx.values[r.key];
    const def = fieldDef(r.key)!;
    const { label } = fieldText(ctx.flow, r.key);
    if (empty(v)) {
      if (r.required) out.push({ key: r.key, section: def.section, message: `${label} is needed` });
      continue;
    }
    // Masked secrets (PAN, account number) were validated when saved.
    if (r.key === "pan" || r.key === "accountNumber") continue;
    if (!FIELD_SCHEMAS[r.key].safeParse(v).success) out.push({ key: r.key, section: def.section, message: `${label} needs fixing` });
  }
  const lt = ctx.flow.loanType;
  const amount = Number(ctx.values.loanAmount) || 0;
  if (amount && (amount < lt.minAmount || amount > lt.maxAmount)) {
    out.push({ key: "loanAmount", section: "loan", message: `${lt.label} amounts are ₹${lt.minAmount.toLocaleString("en-IN")} to ₹${lt.maxAmount.toLocaleString("en-IN")}` });
  }
  const answers = ctx.values as Record<string, unknown>;
  for (const q of ctx.flow.questions) {
    const v = answers[q.id];
    if (empty(v)) {
      if (q.required) out.push({ key: q.id, section: q.section, message: `${q.label} is needed` });
    } else if (!answerSchema(q).safeParse(v).success) out.push({ key: q.id, section: q.section, message: `${q.label} needs fixing` });
  }
  const income = Number(ctx.values.monthlyIncome) || 0;
  const emi = Number(ctx.values.existingEmi) || 0;
  if (income > 0 && emi >= income) out.push({ key: "existingEmi", section: "financial", message: "Existing EMIs can't be more than your income" });
  return out;
}

/** Mask helpers for staff screens (section 43 tiers). */
export const maskPan = (pan: string) => `XXXXXX${pan.slice(-4)}`;
export const maskAccount = (acc: string) => `${"X".repeat(Math.max(0, acc.length - 4))}${acc.slice(-4)}`;
