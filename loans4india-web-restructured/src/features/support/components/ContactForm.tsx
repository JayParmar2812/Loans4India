"use client";
import Link from "next/link";
import { useState } from "react";
import { TICKET_TYPES, type TicketType } from "@/features/support/domain/tickets";

/** Contact, complaint and data-rights form (v4 section 41). Data requests need an OTP sign-in first. */
export function ContactForm({ initialType, signedInMobile }: { initialType?: string; signedInMobile: string | null }) {
  const [type, setType] = useState<TicketType>(initialType && initialType in TICKET_TYPES ? (initialType as TicketType) : "QUERY");
  const [f, setF] = useState({ name: "", mobile: signedInMobile ?? "", email: "", applicationRef: "", message: "", website: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ reference: string; dueDays: number } | null>(null);
  const dataRight = TICKET_TYPES[type].dataRight;
  const needSignIn = dataRight && !signedInMobile;
  const set = (k: keyof typeof f, v: string) => {
    setF((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || needSignIn) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, type }) });
      const d = await res.json();
      if (!d.ok) {
        setError(d.error ?? "Something went wrong.");
        if (d.fieldErrors) setErrors(d.fieldErrors);
        return;
      }
      setDone({ reference: d.reference, dueDays: d.dueDays });
    } catch {
      setError("We couldn't reach our server. Please try again, or email us.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6 sm:p-8 space-y-3" role="status">
        <p className="eyebrow">Request received</p>
        <h2 className="text-2xl font-extrabold">Your ticket number is <span className="font-mono text-violet">{done.reference}</span></h2>
        <p className="text-muted">
          Keep this number. {type === "COMPLAINT" ? "We'll acknowledge your complaint within 1 working day and aim to resolve it within 15 days." : `We aim to respond within ${done.dueDays} day${done.dueDays > 1 ? "s" : ""}.`}{" "}
          We contact you only on the mobile or email you gave. We will never ask you for money, an OTP or a PIN.
        </p>
      </div>
    );
  }

  const field = (k: keyof typeof f, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => (
    <div>
      <label htmlFor={`c-${k}`} className="field-label">{label}</label>
      <input id={`c-${k}`} className="field-input" value={f[k]} onChange={(e) => set(k, e.target.value)} aria-invalid={Boolean(errors[k])} {...props} />
      {errors[k] ? <p className="field-error">{errors[k]}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );

  return (
    <form onSubmit={submit} className="card p-5 sm:p-8 space-y-5" noValidate>
      <div aria-hidden className="absolute -left-[9999px]"><label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></label></div>
      <fieldset>
        <legend className="field-label">What do you need?</legend>
        <div className="grid sm:grid-cols-2 gap-2">
          {(Object.keys(TICKET_TYPES) as TicketType[]).map((t) => (
            <label key={t} className={`cursor-pointer rounded-xl border-2 px-3 py-2.5 text-sm font-semibold ${type === t ? "border-violet bg-violet-soft text-violet-deep" : "border-line hover:border-violet/40"}`}>
              <input type="radio" name="type" value={t} className="sr-only" checked={type === t} onChange={() => setType(t)} />
              {TICKET_TYPES[t].label}
            </label>
          ))}
        </div>
      </fieldset>

      {needSignIn ? (
        <div className="rounded-xl bg-violet-soft p-4 text-sm space-y-2">
          <p><b>First, confirm it&apos;s you.</b> Data requests are only taken from the mobile number on the application, checked with a one-time code, so nobody else can see or change your data.</p>
          <Link href="/my/sign-in" className="btn-secondary !min-h-0 !py-2 text-sm">Sign in with your mobile</Link>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            {field("name", "Your name", { autoComplete: "name" })}
            {field("mobile", "Mobile number", { inputMode: "numeric", autoComplete: "tel-national", maxLength: 10, readOnly: Boolean(signedInMobile && dataRight) }, signedInMobile && dataRight ? "Verified when you signed in." : undefined)}
            {field("email", "Email (optional)", { type: "email", autoComplete: "email" })}
            {field("applicationRef", "Application reference (if you have one)", { placeholder: "LFI-XXXXXX", autoCapitalize: "characters" })}
          </div>
          <div>
            <label htmlFor="c-message" className="field-label">{type === "COMPLAINT" ? "What went wrong?" : "How can we help?"}</label>
            <textarea id="c-message" rows={5} className="field-input" value={f.message} onChange={(e) => set("message", e.target.value)} aria-invalid={Boolean(errors.message)} maxLength={2000} />
            {errors.message ? <p className="field-error">{errors.message}</p> : <p className="field-hint">Please don&apos;t include your PAN, Aadhaar or bank account number.</p>}
          </div>
          {error && <p role="alert" className="rounded-xl bg-danger-soft text-danger px-4 py-3 text-sm">{error}</p>}
          <button className="btn-primary" disabled={busy}>{busy ? "Sending…" : "Send"}</button>
        </>
      )}
    </form>
  );
}
