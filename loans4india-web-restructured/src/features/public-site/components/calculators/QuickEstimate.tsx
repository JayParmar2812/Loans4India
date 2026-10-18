"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ELIGIBILITY_ASSUMPTIONS, estimateEligibility } from "@/features/public-site/domain/finance";
import { formatINR } from "@/shared/utils/format";
import { ResultPanel, Stat } from "./parts";

/**
 * Quick estimate (Platform Flow v4, section 3): half of income minus existing EMIs, repaid at 14% over 60 months,
 * rounded down to ₹10,000. Always "Indicative estimate, not an approval"; never a bank name or rate offer. Stores nothing.
 */
export function QuickEstimate() {
  const router = useRouter();
  const [income, setIncome] = useState("45000");
  const [emi, setEmi] = useState("0");
  const inc = Number(income) || 0;
  const est = inc > 0 ? estimateEligibility(inc, Number(emi) || 0) : null;
  const a = ELIGIBILITY_ASSUMPTIONS;

  function start() {
    // Carries the amount to the start form in session storage, never in the URL (v4 section 3).
    try {
      if (est?.status === "likely") window.sessionStorage.setItem("lfi_prefill", JSON.stringify({ amount: String(est.maxLoan) }));
    } catch { /* ignore */ }
    router.push("/apply");
  }

  return (
    <div className="card p-5 sm:p-8 grid md:grid-cols-2 gap-8">
      <div className="space-y-5">
        <div>
          <label htmlFor="qe-income" className="field-label">Monthly take-home income (₹)</label>
          <input id="qe-income" className="field-input num" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/\D/g, "").slice(0, 9))} />
          <p className="field-hint">Self-employed: your yearly income divided by 12.</p>
        </div>
        <div>
          <label htmlFor="qe-emi" className="field-label">EMIs you already pay each month (₹)</label>
          <input id="qe-emi" className="field-input num" inputMode="numeric" value={emi} onChange={(e) => setEmi(e.target.value.replace(/\D/g, "").slice(0, 9))} />
          <p className="field-hint">All loans and credit-card EMIs together. Enter 0 if none.</p>
        </div>
        <details className="text-sm text-muted">
          <summary className="cursor-pointer font-semibold text-ink">How we work this out</summary>
          <p className="mt-2">
            We assume up to {a.foir * 100}% of your income can go to all EMIs, then work out what the rest repays at {a.annualRatePct}% a year over {a.tenureMonths / 12} years,
            rounded down. It is simple arithmetic on what you typed, not a credit check. Banks use their own rules and may lend more or less.
          </p>
        </details>
      </div>
      <ResultPanel cta={false} note="Indicative estimate, not an approval. Only the bank decides.">
        {!est ? (
          <p className="text-muted">Enter your income to see an estimate.</p>
        ) : est.status === "likely" ? (
          <>
            <Stat label="You may be able to borrow up to" value={formatINR(est.maxLoan)} big />
            <p className="text-sm">with an EMI of about <strong className="num">{formatINR(est.maxEmi)}</strong> a month over {a.tenureMonths / 12} years.</p>
          </>
        ) : est.status === "low-income" ? (
          <p>Many banks look for at least {formatINR(a.minMonthlyIncome)} a month in income. A bank may still consider you, and you can still apply.</p>
        ) : (
          <p>Your existing EMIs are high; a bank may still consider you. You can still apply.</p>
        )}
        <button type="button" className="btn-primary mt-auto" onClick={start}>Start your application</button>
      </ResultPanel>
    </div>
  );
}
