"use client";
import Link from "next/link";

/** Range slider with a typed value box: drag or type, same number. Keyboard-accessible (native range + number input). */
export function SliderField(p: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  suffix?: string;
  minLabel?: string;
  maxLabel?: string;
  hint?: string;
}) {
  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, v));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label htmlFor={`${p.id}-n`} className="font-semibold text-[0.95rem]">{p.label}</label>
        <div className="flex items-center gap-1 rounded-lg border border-line bg-white focus-within:border-violet focus-within:ring-4 focus-within:ring-violet-soft px-2">
          <input
            id={`${p.id}-n`}
            type="number"
            inputMode="decimal"
            className="w-28 text-right font-display font-bold text-violet num py-1 outline-none bg-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            value={p.value}
            min={p.min}
            max={p.max}
            step={p.step}
            onChange={(e) => p.onChange(clamp(Number(e.target.value) || p.min))}
          />
          {p.suffix && <span className="text-sm text-muted">{p.suffix}</span>}
        </div>
      </div>
      <input
        id={p.id}
        type="range"
        className="w-full"
        aria-label={p.label}
        aria-valuetext={p.format(p.value)}
        min={p.min}
        max={p.max}
        step={p.step}
        value={p.value}
        onChange={(e) => p.onChange(Number(e.target.value))}
      />
      <div className="flex justify-between text-xs text-muted mt-1">
        <span>{p.minLabel ?? p.format(p.min)}</span>
        <span className="text-ink font-medium">{p.format(p.value)}</span>
        <span>{p.maxLabel ?? p.format(p.max)}</span>
      </div>
      {p.hint && <p className="field-hint">{p.hint}</p>}
    </div>
  );
}

/** The result side of every calculator: same look, same disclaimer, same next step. */
export function ResultPanel({ children, cta = true, note }: { children: React.ReactNode; cta?: boolean; note?: string }) {
  return (
    <div className="rounded-2xl bg-mint-soft border border-mint/40 p-5 sm:p-6 flex flex-col gap-4" aria-live="polite">
      {children}
      {cta && (
        <Link href="/apply" className="btn-primary mt-auto">
          Start your application
        </Link>
      )}
      <p className="text-xs text-muted leading-snug">{note ?? "Illustration only, not an offer or approval. The bank sets the actual rate, fees and EMI."}</p>
    </div>
  );
}

export function Stat({ label, value, big = false }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={`font-display font-extrabold num text-ink ${big ? "text-4xl sm:text-5xl" : "text-xl"}`}>{value}</p>
    </div>
  );
}
