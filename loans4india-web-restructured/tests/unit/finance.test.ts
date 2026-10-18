import { describe, expect, it } from "vitest";
import { emi, estimateEligibility, principalForEmi } from "@/features/public-site/domain/finance";

describe("finance", () => {
  it("emi matches the standard formula", () => {
    expect(Math.round(emi(100000, 12, 12))).toBe(8885);
  });
  it("principalForEmi inverts emi", () => {
    expect(Math.round(principalForEmi(emi(500000, 14, 60), 14, 60))).toBe(500000);
  });
  it("quick estimate rounds down to the nearest 10,000 (v4 §3)", () => {
    const e = estimateEligibility(50000, 5000);
    expect(e.maxEmi).toBe(20000);
    expect(e.maxLoan % 10000).toBe(0);
  });
});

import { affordableLoan, amortisationByYear, compareTenures, emiBreakdown } from "@/features/public-site/domain/finance";

describe("amortisation, affordability and tenure comparison", () => {
  it("year rows add up to the loan and the total interest, ending at zero", () => {
    const rows = amortisationByYear(300000, 13.5, 36);
    expect(rows).toHaveLength(3);
    const principal = rows.reduce((s, r) => s + r.principalPaid, 0);
    const interest = rows.reduce((s, r) => s + r.interestPaid, 0);
    expect(Math.round(principal)).toBe(300000);
    expect(Math.round(interest)).toBe(Math.round(emiBreakdown(300000, 13.5, 36).totalInterest));
    expect(rows[2].closingBalance).toBeCloseTo(0, 6);
    // Interest falls each year on a reducing balance.
    expect(rows[0].interestPaid).toBeGreaterThan(rows[1].interestPaid);
  });
  it("handles a part year at the end", () => {
    const rows = amortisationByYear(100000, 12, 18);
    expect(rows.map((r) => r.year)).toEqual([1, 2]);
    expect(rows[1].closingBalance).toBeCloseTo(0, 6);
  });
  it("affordability inverts the EMI and never overstates", () => {
    const loan = affordableLoan(10000, 14, 60);
    expect(loan % 1000).toBe(0);
    expect(emiBreakdown(loan, 14, 60).emi).toBeLessThanOrEqual(10000);
  });
  it("longer tenure: lower EMI, more total interest", () => {
    const [a, b] = compareTenures(500000, 12, [24, 60]);
    expect(b.emi).toBeLessThan(a.emi);
    expect(b.totalInterest).toBeGreaterThan(a.totalInterest);
  });
  it("zero and negative inputs are safe", () => {
    expect(amortisationByYear(0, 12, 12)).toEqual([]);
    expect(affordableLoan(0, 12, 12)).toBe(0);
  });
});
