"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { estimateEligibility } from "@/lib/finance";
import { formatINR } from "@/lib/format";

/** Hero widget: amount + income → indicative estimate (never an approval) → start the application at /apply. */
export function QuickCheck({ product = "PERSONAL_LOAN" }: { product?: "PERSONAL_LOAN" | "BUSINESS_LOAN" }) {
  const router = useRouter();
  const [amount, setAmount] = useState("300000");
  const [income, setIncome] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inc = Number(income) || 0;
  const est = inc >= 5000 ? estimateEligibility(inc, 0) : null;

  function go(e: React.FormEvent) {
    e.preventDefault();
    // Mobile is optional here; the application asks for it with consent.
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) { setError("Enter a valid 10-digit mobile number, or leave it empty"); return; }
    try {
      window.sessionStorage.setItem("lfi_prefill", JSON.stringify({ amount, mobile, product }));
    } catch { /* ignore */ }
    router.push(product === "BUSINESS_LOAN" ? "/apply?product=BUSINESS_LOAN" : "/apply");
  }

  return (
    <form onSubmit={go} className="bg-surface text-ink rounded-3xl p-5 sm:p-6 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)] space-y-4" noValidate>
      <h2 className="text-xl font-bold text-violet-deep">Estimate what you can borrow</h2>
      <div>
        <label htmlFor="qc-amount" className="field-label">Loan amount</label>
        <input id="qc-amount" className="field-input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        {Number(amount) > 0 && <p className="text-xs text-muted mt-1 num">{formatINR(Number(amount))}</p>}
      </div>
      <div>
        <label htmlFor="qc-income" className="field-label">{product === "BUSINESS_LOAN" ? "Monthly business income" : "Monthly take-home salary"}</label>
        <input id="qc-income" className="field-input num" inputMode="numeric" placeholder="e.g. 45000" value={income} onChange={(e) => setIncome(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div>
        <label htmlFor="qc-mobile" className="field-label">Mobile number <span className="text-muted font-normal">(optional)</span></label>
        <input id="qc-mobile" className="field-input num" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile" value={mobile}
          onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }} aria-invalid={!!error} aria-describedby={error ? "qc-err" : undefined} />
        {error && <p id="qc-err" className="field-error">{error}</p>}
      </div>
      {est && est.status === "likely" && (
        <p className="text-sm rounded-xl bg-violet-soft px-3 py-2" aria-live="polite">
          Estimated loan up to <strong className="text-violet-deep num">{formatINR(est.maxLoan)}</strong>
          <span className="block text-xs text-muted">Indicative estimate, not an approval. The bank decides.</span>
        </p>
      )}
      {est && est.status !== "likely" && (
        <p className="text-sm rounded-xl bg-violet-soft px-3 py-2" aria-live="polite">Your existing EMIs are high; a bank may still consider you. You can still apply.</p>
      )}
      <button type="submit" className="btn-primary w-full">Start your application</button>
      <p className="text-[11px] leading-snug text-muted">
        LoansForIndia is a loan sourcing service, not a lender. We don&apos;t charge you any fee. No impact on your credit score at this step.
      </p>
    </form>
  );
}
