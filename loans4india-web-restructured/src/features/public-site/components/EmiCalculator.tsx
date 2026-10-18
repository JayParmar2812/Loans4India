"use client";
import { useMemo, useState } from "react";
import { amortisationByYear, emiBreakdown } from "@/features/public-site/domain/finance";
import { formatINR, formatLakh } from "@/shared/utils/format";
import { ResultPanel, SliderField, Stat } from "./calculators/parts";

/** EMI for an amount, rate and tenure the visitor enters (Platform Flow v4, section 2). Runs in the browser; stores nothing. */
export function EmiCalculator({ showSchedule = true }: { showSchedule?: boolean }) {
  const [amount, setAmount] = useState(300000);
  const [rate, setRate] = useState(13.5);
  const [years, setYears] = useState(3);
  const b = useMemo(() => emiBreakdown(amount, rate, years * 12), [amount, rate, years]);
  const rows = useMemo(() => amortisationByYear(amount, rate, years * 12), [amount, rate, years]);
  const interestShare = b.totalPayable > 0 ? b.totalInterest / b.totalPayable : 0;

  return (
    <div className="card p-5 sm:p-8 space-y-8">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8">
        <div className="space-y-7">
          <SliderField id="emi-amount" label="Loan amount" value={amount} min={10000} max={5000000} step={10000} onChange={setAmount} format={formatLakh} suffix="₹" />
          <SliderField id="emi-rate" label="Interest rate (per year)" value={rate} min={6} max={36} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} suffix="%" />
          <SliderField id="emi-years" label="Tenure" value={years} min={1} max={10} step={1} onChange={setYears} format={(v) => `${v} yr${v > 1 ? "s" : ""}`} suffix="yrs" />
        </div>
        <ResultPanel>
          <Stat label="Your monthly EMI" value={formatINR(b.emi)} big />
          <div className="h-3 rounded-full overflow-hidden flex bg-white" role="img" aria-label={`Principal ${Math.round((1 - interestShare) * 100)}%, interest ${Math.round(interestShare * 100)}% of the total repaid`}>
            <span className="bg-violet" style={{ width: `${(1 - interestShare) * 100}%` }} />
            <span className="bg-mint" style={{ width: `${interestShare * 100}%` }} />
          </div>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-muted flex items-center gap-2"><i className="size-2.5 rounded-full bg-violet inline-block" />Principal</dt><dd className="font-bold text-lg num">{formatINR(amount)}</dd></div>
            <div><dt className="text-muted flex items-center gap-2"><i className="size-2.5 rounded-full bg-mint inline-block" />Total interest</dt><dd className="font-bold text-lg num">{formatINR(b.totalInterest)}</dd></div>
            <div className="col-span-2"><dt className="text-muted">Total you repay</dt><dd className="font-bold text-lg num">{formatINR(b.totalPayable)}</dd></div>
          </dl>
        </ResultPanel>
      </div>
      {showSchedule && rows.length > 0 && (
        <details className="group rounded-2xl border border-line">
          <summary className="cursor-pointer list-none px-4 py-3 font-semibold flex items-center justify-between [&::-webkit-details-marker]:hidden">
            Year-by-year breakdown
            <span aria-hidden className="text-violet transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="overflow-x-auto px-4 pb-4">
            <table className="w-full text-sm num">
              <caption className="sr-only">How each year&apos;s EMIs split between interest and principal</caption>
              <thead className="text-left text-muted">
                <tr><th className="py-2 pr-4 font-medium">Year</th><th className="py-2 pr-4 font-medium">Principal paid</th><th className="py-2 pr-4 font-medium">Interest paid</th><th className="py-2 font-medium">Balance left</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className="border-t border-line">
                    <td className="py-2 pr-4">{r.year}</td>
                    <td className="py-2 pr-4">{formatINR(r.principalPaid)}</td>
                    <td className="py-2 pr-4">{formatINR(r.interestPaid)}</td>
                    <td className="py-2">{formatINR(r.closingBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
