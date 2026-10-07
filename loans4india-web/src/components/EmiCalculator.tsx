"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { emiBreakdown } from "@/lib/finance";
import { formatINR, formatLakh } from "@/lib/format";

export function EmiCalculator() {
  const [amount, setAmount] = useState(300000);
  const [rate, setRate] = useState(13.5);
  const [years, setYears] = useState(3);
  const b = useMemo(() => emiBreakdown(amount, rate, years * 12), [amount, rate, years]);
  const interestShare = b.totalPayable > 0 ? b.totalInterest / b.totalPayable : 0;

  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6 bg-surface rounded-3xl border border-line p-5 sm:p-8">
      <div className="space-y-7">
        <Slider id="emi-amount" label="Loan amount" value={amount} display={formatINR(amount)} min={10000} max={4000000} step={10000} onChange={setAmount} minLabel="₹10K" maxLabel="₹40L" />
        <Slider id="emi-rate" label="Interest rate (per year)" value={rate} display={`${rate.toFixed(1)}%`} min={8} max={30} step={0.1} onChange={setRate} minLabel="8%" maxLabel="30%" />
        <Slider id="emi-years" label="Tenure" value={years} display={`${years} year${years > 1 ? "s" : ""}`} min={1} max={7} step={1} onChange={setYears} minLabel="1 yr" maxLabel="7 yrs" />
      </div>
      <div className="rounded-2xl bg-violet-deep text-white p-6 flex flex-col gap-5">
        <div>
          <p className="text-white/70 text-sm">Your monthly EMI</p>
          <p className="font-display font-extrabold text-4xl sm:text-5xl num" aria-live="polite">{formatINR(b.emi)}</p>
        </div>
        <div className="h-3 rounded-full overflow-hidden flex bg-white/15" role="img" aria-label={`Principal ${Math.round((1 - interestShare) * 100)}%, interest ${Math.round(interestShare * 100)}%`}>
          <span className="bg-mint" style={{ width: `${(1 - interestShare) * 100}%` }} />
          <span className="bg-white/40" style={{ width: `${interestShare * 100}%` }} />
        </div>
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-white/70 flex items-center gap-2"><i className="size-2.5 rounded-full bg-mint inline-block" />Principal</dt><dd className="font-semibold text-lg num">{formatLakh(amount)}</dd></div>
          <div><dt className="text-white/70 flex items-center gap-2"><i className="size-2.5 rounded-full bg-white/40 inline-block" />Total interest</dt><dd className="font-semibold text-lg num">{formatINR(b.totalInterest)}</dd></div>
          <div className="col-span-2"><dt className="text-white/70">Total amount payable</dt><dd className="font-semibold text-lg num">{formatINR(b.totalPayable)}</dd></div>
        </dl>
        <Link href="/apply" className="btn-primary mt-auto">Apply for {formatLakh(amount)}</Link>
        <p className="text-[11px] text-white/60 leading-snug">Illustration only. Actual rate, fees and EMI are decided by the lender based on your profile.</p>
      </div>
    </div>
  );
}

function Slider(p: { id: string; label: string; value: number; display: string; min: number; max: number; step: number; onChange: (v: number) => void; minLabel: string; maxLabel: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <label htmlFor={p.id} className="font-semibold">{p.label}</label>
        <output htmlFor={p.id} className="font-display font-bold text-violet text-lg num bg-violet-soft rounded-lg px-3 py-0.5">{p.display}</output>
      </div>
      <input id={p.id} type="range" className="w-full" min={p.min} max={p.max} step={p.step} value={p.value} onChange={(e) => p.onChange(Number(e.target.value))} />
      <div className="flex justify-between text-xs text-muted mt-1"><span>{p.minLabel}</span><span>{p.maxLabel}</span></div>
    </div>
  );
}
