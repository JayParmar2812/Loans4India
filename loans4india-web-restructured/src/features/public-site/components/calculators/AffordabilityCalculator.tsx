"use client";
import { useMemo, useState } from "react";
import { affordableLoan, emiBreakdown } from "@/features/public-site/domain/finance";
import { formatINR, formatLakh } from "@/shared/utils/format";
import { ResultPanel, SliderField, Stat } from "./parts";

/** Start from the EMI you are comfortable with; see the loan it repays at a rate and tenure you choose. */
export function AffordabilityCalculator() {
  const [budget, setBudget] = useState(15000);
  const [rate, setRate] = useState(13);
  const [years, setYears] = useState(4);
  const loan = useMemo(() => affordableLoan(budget, rate, years * 12), [budget, rate, years]);
  const b = useMemo(() => emiBreakdown(loan, rate, years * 12), [loan, rate, years]);

  return (
    <div className="card p-5 sm:p-8 grid lg:grid-cols-[1.2fr_1fr] gap-8">
      <div className="space-y-7">
        <SliderField id="af-budget" label="EMI you can comfortably pay" value={budget} min={1000} max={200000} step={500} onChange={setBudget} format={formatINR} suffix="₹/mo"
          hint="A common rule of thumb is to keep all EMIs together under about half of your take-home pay." />
        <SliderField id="af-rate" label="Interest rate (per year)" value={rate} min={6} max={36} step={0.1} onChange={setRate} format={(v) => `${v.toFixed(1)}%`} suffix="%" />
        <SliderField id="af-years" label="Tenure" value={years} min={1} max={10} step={1} onChange={setYears} format={(v) => `${v} yr${v > 1 ? "s" : ""}`} suffix="yrs" />
      </div>
      <ResultPanel>
        <Stat label="A loan this EMI repays" value={formatINR(loan)} big />
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="text-muted">In lakh</dt><dd className="font-bold text-lg num">{formatLakh(loan)}</dd></div>
          <div><dt className="text-muted">Total interest</dt><dd className="font-bold text-lg num">{formatINR(b.totalInterest)}</dd></div>
        </dl>
      </ResultPanel>
    </div>
  );
}
