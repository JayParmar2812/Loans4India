/**
 * Partner-bank master (Platform Flow v4, sections 15, 16, 46, 47).
 * Not an eligibility engine: sourcing rules only remove banks that can't take a file; staff pick the bank.
 *
 * Every change to the list (adding, removing or renaming a bank) needs a new BANK_LIST_VERSION:
 * consents name the banks individually, and older consents don't cover a bank added later.
 *
 * As of 4 Oct 2026 no DSA agreement is signed, so only TEST banks exist. TEST banks are used with
 * synthetic data outside production and are never shown on the public website.
 */

export type BankStatus = "TEST" | "LIVE" | "SUSPENDED" | "INACTIVE";

export type FieldFormat = "text" | "date_dmy" | "annual_from_monthly" | "value_map" | "masked";

export type TemplateField = {
  /** The bank portal's own field name. */
  bankField: string;
  /** Our field key (see FIELD_SOURCES in src/lib/package.ts). */
  from: string;
  format?: FieldFormat;
  valueMap?: Record<string, string>;
  required: boolean;
};

export type BankTemplate = {
  version: string;
  fields: TemplateField[];
  /** File name pattern per slot; {ref} and {n} are replaced. */
  documentNames: Record<string, string>;
};

export type BankConfig = {
  id: string;
  name: string;
  type: "Bank" | "NBFC";
  status: BankStatus;
  products: string[];
  dsaCode?: string;
  /** Agreement end date (YYYY-MM-DD). The gate blocks if it has passed. */
  agreementValidTo?: string;
  grievanceUrl?: string;
  /** Published sourcing criteria from the bank (section 15 filter 3). Leave out what the bank doesn't specify. */
  sourcing: {
    pincodePrefixes?: string[];
    minAge?: number;
    maxAge?: number;
    minMonthlyIncome?: number;
    employmentTypes?: string[];
  };
  /** Guidance for staff only, never shown to applicants. */
  notes?: string;
  template: BankTemplate;
};

const EMPLOYMENT_MAP = { SALARIED: "Salaried", SELF_EMPLOYED_BUSINESS: "Self Employed Business", SELF_EMPLOYED_PROFESSIONAL: "Self Employed Professional" };
const RESIDENCE_MAP = { OWNED: "Owned", RENTED: "Rented", FAMILY: "Parental / Family", COMPANY: "Company Provided" };

/** One configurable template used by the test banks (MVP1: "one configurable bank template"). */
const STANDARD_TEMPLATE: BankTemplate = {
  version: "standard-2026-10-04.v1",
  fields: [
    { bankField: "Applicant Name", from: "fullName", required: true },
    { bankField: "Date of Birth", from: "dob", format: "date_dmy", required: true },
    { bankField: "Gender", from: "gender", required: false },
    { bankField: "PAN", from: "pan", format: "masked", required: true },
    { bankField: "Mobile", from: "mobile", required: true },
    { bankField: "Email", from: "email", required: true },
    { bankField: "Current Address", from: "addressLine", required: true },
    { bankField: "City", from: "city", required: true },
    { bankField: "PIN Code", from: "pincode", required: true },
    { bankField: "Residence", from: "residenceType", format: "value_map", valueMap: RESIDENCE_MAP, required: true },
    { bankField: "Occupation", from: "employmentType", format: "value_map", valueMap: EMPLOYMENT_MAP, required: true },
    { bankField: "Employer / Business Name", from: "employerName", required: true },
    { bankField: "Designation / Nature of Business", from: "designation", required: true },
    { bankField: "Years in Current Job / Business", from: "workYears", required: true },
    { bankField: "Annual Income", from: "monthlyIncome", format: "annual_from_monthly", required: true },
    { bankField: "Salary Mode", from: "salaryMode", required: false },
    { bankField: "Existing EMIs per Month", from: "existingEmi", required: true },
    { bankField: "Salary / Primary Bank", from: "primaryBankName", required: true },
    { bankField: "Loan Amount", from: "loanAmount", required: true },
    { bankField: "Tenure (months)", from: "tenureMonths", required: true },
    { bankField: "End Use", from: "purpose", required: true },
  ],
  documentNames: {
    PAN: "PAN_{ref}_{n}",
    AADHAAR: "AADHAAR_MASKED_{ref}_{n}",
    ADDRESS_PROOF: "ADDRESS_{ref}_{n}",
    PHOTO: "PHOTO_{ref}",
    SALARY_SLIPS: "SALARY_SLIP_{ref}_{n}",
    BANK_STATEMENT: "BANK_STATEMENT_{ref}_{n}",
    FORM16: "FORM16_{ref}_{n}",
    ITR: "ITR_{ref}_{n}",
    BUSINESS_PROOF: "BUSINESS_PROOF_{ref}_{n}",
    BUSINESS_PAN: "BUSINESS_PAN_{ref}_{n}",
    BUSINESS_REGISTRATION: "BUSINESS_REG_{ref}_{n}",
    BUSINESS_ADDRESS_PROOF: "BUSINESS_ADDRESS_{ref}_{n}",
    FINANCIALS: "FINANCIALS_{ref}_{n}",
    GST_RETURNS: "GST_{ref}_{n}",
    CONSTITUTION_DOCS: "CONSTITUTION_{ref}_{n}",
    EXISTING_LOANS: "EXISTING_LOAN_{ref}_{n}",
  },
};

/** Bump on every change to the list below. */
export const BANK_LIST_VERSION = "2026-10-04.banks.v1";

export const BANKS: BankConfig[] = [
  {
    id: "demo-bank-a",
    name: "Demo Bank A (test)",
    type: "Bank",
    status: "TEST",
    products: ["PERSONAL_LOAN", "BUSINESS_LOAN"],
    dsaCode: "TEST-DSA-001",
    agreementValidTo: "2027-12-31",
    sourcing: { minAge: 21, maxAge: 60, minMonthlyIncome: 25000 },
    notes: "Synthetic test bank for MVP1 walkthroughs.",
    template: STANDARD_TEMPLATE,
  },
  {
    id: "demo-nbfc-b",
    name: "Demo NBFC B (test)",
    type: "NBFC",
    status: "TEST",
    products: ["PERSONAL_LOAN"],
    dsaCode: "TEST-DSA-002",
    agreementValidTo: "2027-12-31",
    sourcing: { minAge: 23, maxAge: 58, minMonthlyIncome: 15000, employmentTypes: ["SALARIED"], pincodePrefixes: ["11", "12", "20", "40", "41", "56", "60"] },
    notes: "Synthetic test NBFC: salaried only, selected metros.",
    template: STANDARD_TEMPLATE,
  },
];

/** TEST banks work only outside production (synthetic data). */
const usable = (b: BankConfig) => b.status === "LIVE" || (b.status === "TEST" && process.env.NODE_ENV !== "production");

/**
 * Banks named on the consent screen, in a stable order: those covering the loan type (from the applicant flow,
 * src/config/applicantFlow.ts) that can be used here. `products` above is the coverage before any change there.
 */
export function consentBanks(coveringBankIds: string[]): BankConfig[] {
  return BANKS.filter((b) => usable(b) && coveringBankIds.includes(b.id));
}

export const bankById = (id: string) => BANKS.find((b) => b.id === id);

/** Is the bank's agreement in force today (section 15 filter 2, gate check 3)? */
export function agreementActive(b: BankConfig, today = new Date()): boolean {
  if (!usable(b) || !b.dsaCode) return false;
  if (b.agreementValidTo && b.agreementValidTo < today.toISOString().slice(0, 10)) return false;
  return true;
}

/**
 * The older "share link for a bank sales officer / POS" channel. Off by default because Platform Flow v4
 * says documents are never shared by link and reach a bank only through the operator's portal entry (sections 7, 18).
 */
export const BANK_SHARE_LINKS_ENABLED = false;
