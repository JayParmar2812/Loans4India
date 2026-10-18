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
