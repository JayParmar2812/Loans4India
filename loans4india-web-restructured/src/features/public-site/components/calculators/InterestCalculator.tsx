"use client";
import { useMemo, useState } from "react";
import { compareTenures } from "@/features/public-site/domain/finance";
import { formatINR, formatLakh } from "@/shared/utils/format";
import { SliderField } from "./parts";

const TENURES = [12, 24, 36, 48, 60, 84];

/** The cost of time: same loan and rate, different tenures, side by side. */
export function InterestCalculator() {
  const [amount, setAmount] = useState(500000);
  const [rate, setRate] = useState(13);
  const rows = useMemo(() => compareTenures(amount, rate, TENURES), [amount, rate]);
  const maxInterest = Math.max(...rows.map((r) => r.totalInterest), 1);

  return (
    <div className="card p-5 sm:p-8 space-y-8">
      <div className="grid md:grid-cols-2 gap-7">
        <SliderField id="in-amount" label="Loan amount" value={amount} min={10000} max={5000000} step={10000} onChange={setAmount} format={formatLakh} suffix="₹" />
        <SliderField id="in-rate" label="Interest rate (per year)" value={rate} min={6} max={36} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} suffix="%" />
      </div>
      <div className="overflow-x-auto" aria-live="polite">
        <table className="w-full text-sm num min-w-[520px]">
          <caption className="text-left text-muted pb-3">Monthly EMI and total interest for {formatINR(amount)} at {rate.toFixed(1)}% a year</caption>
          <thead className="text-left text-muted">
            <tr><th className="py-2 pr-4 font-medium">Tenure</th><th className="py-2 pr-4 font-medium">Monthly EMI</th><th className="py-2 pr-4 font-medium">Total interest</th><th className="py-2 font-medium w-1/3"><span className="sr-only">Interest compared</span></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.months} className="border-t border-line">
                <td className="py-2.5 pr-4 font-semibold">{r.months / 12} year{r.months > 12 ? "s" : ""}</td>
                <td className="py-2.5 pr-4">{formatINR(r.emi)}</td>
                <td className="py-2.5 pr-4">{formatINR(r.totalInterest)}</td>
                <td className="py-2.5"><div className="h-2.5 rounded-full bg-mint" style={{ width: `${(r.totalInterest / maxInterest) * 100}%` }} aria-hidden /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-muted">
        A longer tenure lowers the EMI but you pay more interest in total. Prepaying part of the loan early (if the bank allows it without high charges) cuts the interest most,
        because interest is charged on the balance still outstanding. Illustration only; the bank sets the actual rate and terms.
      </p>
    </div>
  );
}
