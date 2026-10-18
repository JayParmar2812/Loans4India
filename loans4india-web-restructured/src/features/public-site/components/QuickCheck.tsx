"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { estimateEligibility } from "@/features/public-site/domain/finance";
import { formatINR } from "@/shared/utils/format";
import { brand } from "@/shared/config/brand";

/**
 * Hero widget (Platform Flow v4, section 3): amount + income → indicative estimate (never an approval) → start at /apply.
 * The mobile is optional here and goes to the start form in session storage, never in the URL.
 */
export function QuickCheck({ product = "PERSONAL_LOAN" }: { product?: string }) {
  const router = useRouter();
  const [amount, setAmount] = useState("300000");
  const [income, setIncome] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inc = Number(income) || 0;
  const est = inc >= 5000 ? estimateEligibility(inc, 0) : null;

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (mobile && !/^[6-9]\d{9}$/.test(mobile)) {
      setError("Enter a valid 10-digit mobile number, or leave it empty");
      return;
    }
    try {
      window.sessionStorage.setItem("lfi_prefill", JSON.stringify({ amount, mobile, product }));
    } catch { /* ignore */ }
    router.push(product === "PERSONAL_LOAN" ? "/apply" : `/apply?product=${encodeURIComponent(product)}`);
  }

  return (
    <form onSubmit={go} className="card p-5 sm:p-6 space-y-4 shadow-[0_30px_60px_-30px_rgb(36_16_122/0.35)]" noValidate aria-labelledby="qc-title">
      <div>
        <h2 id="qc-title" className="text-xl font-extrabold">Estimate what you can borrow</h2>
        <p className="text-sm text-muted">No credit check. Nothing is saved.</p>
      </div>
      <div>
        <label htmlFor="qc-amount" className="field-label">Loan amount you need (₹)</label>
        <input id="qc-amount" className="field-input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 9))} />
        {Number(amount) > 0 && <p className="field-hint num">{formatINR(Number(amount))}</p>}
      </div>
      <div>
        <label htmlFor="qc-income" className="field-label">{product === "BUSINESS_LOAN" ? "Monthly business income (₹)" : "Monthly take-home salary (₹)"}</label>
        <input id="qc-income" className="field-input num" inputMode="numeric" placeholder="e.g. 45000" value={income} onChange={(e) => setIncome(e.target.value.replace(/\D/g, "").slice(0, 9))} />
      </div>
      <div>
        <label htmlFor="qc-mobile" className="field-label">Mobile number <span className="text-muted font-normal">(optional)</span></label>
        <input id="qc-mobile" className="field-input num" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit mobile" value={mobile}
          onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }} aria-invalid={!!error} aria-describedby={error ? "qc-err" : undefined} />
        {error && <p id="qc-err" className="field-error">{error}</p>}
      </div>
      <div aria-live="polite">
        {est && est.status === "likely" && (
          <p className="text-sm rounded-xl bg-mint-soft px-3 py-2.5">
            Estimated up to <strong className="text-ink num text-base">{formatINR(est.maxLoan)}</strong>
            <span className="block text-xs text-muted">Indicative estimate, not an approval. The bank decides.</span>
          </p>
        )}
        {est && est.status !== "likely" && (
          <p className="text-sm rounded-xl bg-mint-soft px-3 py-2.5">Your existing EMIs are high; a bank may still consider you. You can still apply.</p>
        )}
      </div>
      <button type="submit" className="btn-primary w-full">Start your application</button>
      <p className="text-[11px] leading-snug text-muted">{brand.name} is a loan sourcing service, not a lender. We don&apos;t charge you any fee.</p>
    </form>
  );
}
