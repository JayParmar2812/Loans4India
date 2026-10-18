/** Pure loan maths. No side effects — safe on client and server. */

/** Monthly EMI for principal P, annual rate r (%), n months. */
export function emi(principal: number, annualRatePct: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const f = Math.pow(1 + r, months);
  return (principal * r * f) / (f - 1);
}

/** Principal that a given EMI can support (inverse of emi()). */
export function principalForEmi(monthlyEmi: number, annualRatePct: number, months: number): number {
  if (monthlyEmi <= 0 || months <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r === 0) return monthlyEmi * months;
  const f = Math.pow(1 + r, months);
  return (monthlyEmi * (f - 1)) / (r * f);
}

export type EmiBreakdown = { emi: number; totalPayable: number; totalInterest: number };

export function emiBreakdown(principal: number, annualRatePct: number, months: number): EmiBreakdown {
  const m = emi(principal, annualRatePct, months);
  const total = m * months;
  return { emi: m, totalPayable: total, totalInterest: total - principal };
}

/**
 * Indicative eligibility using a FOIR (fixed obligations to income ratio) cap.
 * Banks commonly use roughly 40–60% depending on income band; we use a
 * conservative default. This is an estimate for guidance only — never an approval.
 */
export const ELIGIBILITY_ASSUMPTIONS = {
  foir: 0.5,
  annualRatePct: 14,
  tenureMonths: 60,
  minMonthlyIncome: 15000,
} as const;

export type EligibilityEstimate = {
  maxEmi: number;
  maxLoan: number;
  status: "likely" | "low-income" | "high-obligations";
};

export function estimateEligibility(
  monthlyIncome: number,
  existingEmi: number,
  a = ELIGIBILITY_ASSUMPTIONS,
): EligibilityEstimate {
  const maxEmi = Math.max(0, monthlyIncome * a.foir - existingEmi);
  const maxLoan = principalForEmi(maxEmi, a.annualRatePct, a.tenureMonths);
  let status: EligibilityEstimate["status"] = "likely";
  if (monthlyIncome < a.minMonthlyIncome) status = "low-income";
  else if (maxEmi < monthlyIncome * 0.1) status = "high-obligations";
  // Round down to the nearest ₹10,000 so we never overstate.
  return { maxEmi, maxLoan: Math.floor(maxLoan / 10000) * 10000, status };
}

export type AmortisationYear = { year: number; principalPaid: number; interestPaid: number; closingBalance: number };

/**
 * Year-by-year split of a reducing-balance loan: how much of each year's EMIs goes to interest and to principal.
 * Uses the unrounded EMI, so the balance reaches zero exactly at the end.
 */
export function amortisationByYear(principal: number, annualRatePct: number, months: number): AmortisationYear[] {
  if (principal <= 0 || months <= 0) return [];
  const r = annualRatePct / 12 / 100;
  const m = emi(principal, annualRatePct, months);
  const out: AmortisationYear[] = [];
  let balance = principal;
  let row: AmortisationYear = { year: 1, principalPaid: 0, interestPaid: 0, closingBalance: principal };
  for (let i = 1; i <= months; i++) {
    const interest = balance * r;
    const toPrincipal = Math.min(balance, m - interest);
    balance = Math.max(0, balance - toPrincipal);
    row.interestPaid += interest;
    row.principalPaid += toPrincipal;
    row.closingBalance = balance;
    if (i % 12 === 0 || i === months) {
      out.push(row);
      row = { year: row.year + 1, principalPaid: 0, interestPaid: 0, closingBalance: balance };
    }
  }
  return out;
}

/** Loan a monthly budget can repay (the affordability calculator), rounded down to ₹1,000 so it never overstates. */
export function affordableLoan(monthlyBudget: number, annualRatePct: number, months: number): number {
  return Math.floor(principalForEmi(monthlyBudget, annualRatePct, months) / 1000) * 1000;
}

/** Same loan, different tenures: EMI and total interest for each (the interest calculator). */
export function compareTenures(principal: number, annualRatePct: number, tenuresMonths: number[]) {
  return tenuresMonths.map((n) => ({ months: n, ...emiBreakdown(principal, annualRatePct, n) }));
}
