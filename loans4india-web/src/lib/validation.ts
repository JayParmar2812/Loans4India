import { z } from "zod";

/** The two built-in loan types. The master admin can add more on the Application flow screen (src/config/applicantFlow.ts). */
export const PRODUCTS = ["PERSONAL_LOAN", "BUSINESS_LOAN"] as const;
export const EMPLOYMENT_TYPES = ["SALARIED", "SELF_EMPLOYED_BUSINESS", "SELF_EMPLOYED_PROFESSIONAL"] as const;

export const PRODUCT_LABELS: Record<(typeof PRODUCTS)[number], string> = {
  PERSONAL_LOAN: "Personal Loan",
  BUSINESS_LOAN: "Business Loan",
};
export const EMPLOYMENT_LABELS: Record<(typeof EMPLOYMENT_TYPES)[number], string> = {
  SALARIED: "Salaried",
  SELF_EMPLOYED_BUSINESS: "Self-employed (business owner)",
  SELF_EMPLOYED_PROFESSIONAL: "Self-employed professional (doctor, CA, etc.)",
};

const rupees = (min: number, max: number, label: string) =>
  z.coerce
    .number({ error: `Enter ${label}` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ₹${min.toLocaleString("en-IN")}`)
    .max(max, `${label} looks too high — please check`);

/**
 * Registration (Platform Flow v4, section 4): loan type, amount and mobile, then the one consent screen.
 * Everything else is collected after consent, in the application details form (src/lib/profile.ts).
 */
export const registrationSchema = z.object({
  /** A loan type id; the route checks it is open in the live flow. */
  product: z.string().regex(/^[A-Z][A-Z0-9_]{2,39}$/, "Pick a loan type"),
  loanAmount: rupees(10000, 5_00_00_000, "Loan amount"),
  mobile: z
    .string()
    .trim()
    .transform((s) => s.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, ""))
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")),
  /** The required tick: processing, sharing with the named banks, service messages. */
  consentRequired: z.literal(true, { error: "This consent is needed to process your application" }),
  consentMarketing: z.boolean().default(false),
  /** Bank-list version the screen showed; must match the current one. */
  bankListVersion: z.string().max(60),

  // Attribution (filled automatically)
  source: z.string().max(100).optional(),
  medium: z.string().max(100).optional(),
  campaign: z.string().max(150).optional(),
  landingPath: z.string().max(300).optional(),
  referrer: z.string().max(500).optional(),
  referralCode: z.string().trim().max(40).regex(/^[A-Za-z0-9_-]*$/).optional(),

  // Honeypot — must stay empty
  website: z.string().max(0).optional(),
});

export type RegistrationInput = z.input<typeof registrationSchema>;
