"use client";
import { useState } from "react";
import Link from "next/link";
import { ELIGIBILITY_ASSUMPTIONS, estimateEligibility } from "@/lib/finance";
import { formatINR } from "@/lib/format";

export function EligibilityCalculator() {
  const [income, setIncome] = useState("45000");
  const [emi, setEmi] = useState("0");
  const inc = Number(income) || 0;
  const est = inc > 0 ? estimateEligibility(inc, Number(emi) || 0) : null;
  return (
    <div className="grid md:grid-cols-2 gap-6 bg-surface rounded-3xl border border-line p-5 sm:p-8">
      <div className="space-y-4">
        <div>
          <label htmlFor="el-income" className="field-label">Monthly take-home income (₹)</label>
          <input id="el-income" className="field-input num" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div>
          <label htmlFor="el-emi" className="field-label">EMIs you already pay each month (₹)</label>
          <input id="el-emi" className="field-input num" inputMode="numeric" value={emi} onChange={(e) => setEmi(e.target.value.replace(/\D/g, ""))} />
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Assumes lenders allow up to {ELIGIBILITY_ASSUMPTIONS.foir * 100}% of income towards all EMIs, at {ELIGIBILITY_ASSUMPTIONS.annualRatePct}% p.a.
          over {ELIGIBILITY_ASSUMPTIONS.tenureMonths / 12} years. Real limits vary by lender, credit score and employer.
        </p>
      </div>
      <div className="rounded-2xl bg-violet-soft p-6 flex flex-col gap-3" aria-live="polite">
        {!est ? (
          <p className="text-muted">Enter your income to see an estimate.</p>
        ) : est.status === "low-income" ? (
          <p>Many banks look for at least ₹{ELIGIBILITY_ASSUMPTIONS.minMonthlyIncome.toLocaleString("en-IN")} a month. A bank may still consider you. You can still apply.</p>
        ) : est.status === "high-obligations" ? (
          <p>Your existing EMIs are high; a bank may still consider you. You can still apply.</p>
        ) : (
          <>
            <p className="text-sm text-muted">Estimated loan up to</p>
            <p className="font-display font-extrabold text-4xl text-violet-deep num">{formatINR(est.maxLoan)}</p>
            <p className="text-sm">with an EMI of about <strong className="num">{formatINR(est.maxEmi)}</strong> a month.</p>
          </>
        )}
        <Link href="/apply" className="btn-primary mt-auto self-start">Start your application</Link>
        <p className="text-[11px] text-muted">Indicative estimate, not an approval. Only the bank decides.</p>
      </div>
    </div>
  );
}
