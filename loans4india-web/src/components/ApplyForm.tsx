"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@/config/brand";
import type { ConsentNotice } from "@/lib/consent";
import { formatINR } from "@/lib/format";

type Product = string;
/** A loan type open for new applications, from the master admin's Application flow screen. */
export type ApplyLoanType = { id: string; label: string; minAmount: number; maxAmount: number };
type Form = {
  product: Product;
  loanAmount: string;
  mobile: string;
  consentRequired: boolean;
  consentMarketing: boolean;
  website: string;
};

const STEPS = ["Your loan", "Consent", "Details & documents"] as const;

type Result = { status: "created"; reference: string; uploadToken: string } | { status: "already_received" | "received" };

/**
 * Registration (Platform Flow v4, sections 4-5): loan type, amount and mobile, then one consent screen.
 * Nothing personal beyond the enquiry is asked before the required consent tick.
 */
export function ApplyForm({ initial, notices, loanTypes, emiLink = true }: { initial: { product?: string }; notices: Record<string, ConsentNotice>; loanTypes: ApplyLoanType[]; emiLink?: boolean }) {
  const products = loanTypes.map((l) => l.id);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // Lazy init runs only in the browser (this component is loaded with ssr: false),
  // so we can read the quick-estimate prefill from sessionStorage — kept out of the URL on purpose.
  // Only loan types open for new applications can be picked.
  const pick = (p?: string): Product => products.find((x) => x === p) ?? products[0];
  const [form, setForm] = useState<Form>(() => withPrefill({
    product: pick(initial.product),
    loanAmount: "300000",
    mobile: "",
    consentRequired: false,
    consentMarketing: false,
    website: "",
  }, pick));
  const notice = notices[form.product];
  const loanType = loanTypes.find((l) => l.id === form.product) ?? loanTypes[0];

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function validateStep(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      const amt = Number(form.loanAmount);
      if (!amt || amt < loanType.minAmount) e.loanAmount = `Enter an amount of at least ${formatINR(loanType.minAmount)}`;
      else if (amt > loanType.maxAmount) e.loanAmount = `${loanType.label} amounts go up to ${formatINR(loanType.maxAmount)}`;
      if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = "Enter a valid 10-digit mobile number";
    }
    if (s === 1 && !form.consentRequired) e.consentRequired = "This consent is needed to process your application";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validateStep(step)) {
      setStep((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submit() {
    if (!validateStep(1)) return;
    setSubmitting(true);
    setServerError(null);
    const params = new URLSearchParams(window.location.search);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: form.product,
          loanAmount: form.loanAmount,
          mobile: form.mobile,
          consentRequired: form.consentRequired,
          consentMarketing: form.consentMarketing,
          bankListVersion: notice.bankListVersion,
          website: form.website,
          source: params.get("utm_source") ?? sessionStorageGet("lfi_utm_source") ?? undefined,
          medium: params.get("utm_medium") ?? sessionStorageGet("lfi_utm_medium") ?? undefined,
          campaign: params.get("utm_campaign") ?? sessionStorageGet("lfi_utm_campaign") ?? undefined,
          referralCode: params.get("ref") ?? sessionStorageGet("lfi_ref") ?? undefined,
          landingPath: sessionStorageGet("lfi_landing") ?? window.location.pathname,
          referrer: document.referrer || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        if (data.reload) {
          router.refresh();
          setStep(1);
        }
        setServerError(data.error ?? "Something went wrong. Please try again.");
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
          setStep(Object.keys(data.fieldErrors).some((k) => ["loanAmount", "mobile", "product"].includes(k)) ? 0 : 1);
        }
        return;
      }
      if (data.status === "created" && data.uploadToken) {
        try { window.sessionStorage.removeItem("lfi_prefill"); } catch { /* ignore */ }
        // Details and documents live on the applicant's own page so they can come back to it later.
        router.push(`/documents/${data.uploadToken}`);
        return;
      }
      setResult(data as Result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setServerError("We couldn't reach our server. Check your internet connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) return <Success result={result} emiLink={emiLink} />;

  return (
    <div className="bg-surface rounded-3xl border border-line shadow-[0_20px_60px_-30px_rgb(42_22_112/0.35)] overflow-hidden">
      <ol className="grid grid-cols-3 border-b border-line text-xs sm:text-sm" aria-label="Application steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`px-3 py-3 text-center font-display font-semibold ${i === step ? "text-violet border-b-[3px] border-violet" : i < step ? "text-ink" : "text-muted"}`}
          >
            <span className="num">{i + 1}.</span> {label}
          </li>
        ))}
      </ol>

      <form className="p-5 sm:p-8 space-y-6" onSubmit={(e) => { e.preventDefault(); if (step < 1) next(); else submit(); }} noValidate>
        {/* Honeypot for bots */}
        <div aria-hidden className="absolute -left-[9999px]" >
          <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} /></label>
        </div>

        {step === 0 && (
          <div className="space-y-5">
            <fieldset>
              <legend className="field-label">Which loan do you need?</legend>
              <div className={`grid gap-3 ${products.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {loanTypes.map((l) => (
                  <label key={l.id} className={`cursor-pointer rounded-xl border-2 px-4 py-3 font-display font-semibold text-center ${form.product === l.id ? "border-violet bg-violet-soft text-violet-deep" : "border-line"}`}>
                    <input type="radio" name="product" value={l.id} className="sr-only" checked={form.product === l.id} onChange={() => set("product", l.id)} />
                    {l.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="loanAmount" label="Loan amount (₹)" error={errors.loanAmount}>
                <input id="loanAmount" className="field-input num" inputMode="numeric" value={form.loanAmount} onChange={(e) => set("loanAmount", digits(e.target.value) ?? "")} />
                {Number(form.loanAmount) > 0 && <p className="text-sm text-muted mt-1 num">{formatINR(Number(form.loanAmount))}</p>}
              </Field>
              <Field id="mobile" label="Mobile number" error={errors.mobile}>
                <div className="flex">
                  <span className="grid place-items-center px-3 border-[1.5px] border-r-0 border-line rounded-l-xl text-muted bg-canvas">+91</span>
                  <input id="mobile" className="field-input !rounded-l-none num" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.mobile} onChange={(e) => set("mobile", (digits(e.target.value) ?? "").slice(0, 10))} />
                </div>
              </Field>
            </div>
            <p className="text-sm text-muted">Next you&apos;ll see what we do with your information. We ask for your other details only after you agree.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <dl className="grid grid-cols-3 gap-4 rounded-2xl bg-canvas p-4 text-sm">
              <Summary k="Loan" v={loanType.label} />
              <Summary k="Amount" v={formatINR(Number(form.loanAmount))} />
              <Summary k="Mobile" v={`+91 ${form.mobile}`} />
            </dl>
            <section aria-labelledby="consent-title" className="space-y-3">
              <h2 id="consent-title" className="font-display font-semibold text-lg">Before you continue</h2>
              <dl className="space-y-2 text-[0.95rem] leading-snug">
                {notice.sections.map((s) => (
                  <div key={s.title}>
                    <dt className="font-semibold">{s.title}</dt>
                    <dd className="text-muted">{s.body}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted">Read the full <Link className="underline" href="/privacy">Privacy Policy</Link>. Notice {notice.version} · bank list {notice.bankListVersion}</p>
            </section>
            <fieldset className="space-y-3">
              <legend className="sr-only">Your consent</legend>
              <label className="flex gap-3 items-start text-[0.95rem] leading-snug cursor-pointer">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-violet" checked={form.consentRequired} onChange={(e) => set("consentRequired", e.target.checked)} />
                <span>{notice.requiredText}<span className="text-danger" aria-label="required"> *</span></span>
              </label>
              {errors.consentRequired && <p className="field-error ml-8">{errors.consentRequired}</p>}
              <label className="flex gap-3 items-start text-[0.95rem] leading-snug cursor-pointer">
                <input type="checkbox" className="mt-1 size-5 shrink-0 accent-violet" checked={form.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} />
                <span>{notice.marketingText}</span>
              </label>
            </fieldset>
          </div>
        )}

        {serverError && <p role="alert" className="rounded-xl bg-red-50 text-danger px-4 py-3 text-sm">{serverError}</p>}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step > 0 ? (
            <button type="button" className="btn-ghost" onClick={() => setStep((s) => s - 1)}>Back</button>
          ) : <span />}
          <button type="submit" className="btn-primary min-w-40" disabled={submitting}>
            {step < 1 ? "Continue" : submitting ? "Saving…" : "Agree & continue"}
          </button>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          {brand.name} is a loan sourcing service, not a lender. We don&apos;t charge you any fee. The bank alone decides on your loan.
        </p>
      </form>
    </div>
  );
}

function Success({ result, emiLink }: { result: Result; emiLink: boolean }) {
  return (
    <div className="bg-surface rounded-3xl border border-line p-8 sm:p-10 text-center space-y-5">
      <div className="mx-auto size-16 rounded-full bg-mint grid place-items-center text-mint-ink text-3xl" aria-hidden>✓</div>
      <h2 className="text-3xl font-extrabold text-violet-deep">
        {result.status === "created" ? "Application received" : "We already have your application"}
      </h2>
      {result.status === "created" && (
        <p className="text-lg">
          Your reference number is <strong className="font-display text-violet num tracking-wide">{result.reference}</strong>
        </p>
      )}
      <p className="text-muted max-w-md mx-auto">
        {result.status === "created"
          ? "Our loan expert will call you within one working day to understand your needs and tell you which documents to keep ready."
          : "There is already an open application for this loan. Please use the link you got when you applied, or contact us and we'll send it again."}
      </p>
      <ul className="text-left max-w-md mx-auto text-sm space-y-2 bg-canvas rounded-2xl p-5">
        <li>• Keep your PAN, masked Aadhaar, last 6 months&apos; salary slips and bank statement handy.</li>
        <li>• We will never ask for an OTP, PIN or any upfront fee on a call.</li>
        <li>• The bank or NBFC makes the final decision on your loan.</li>
      </ul>
      {emiLink && <Link href="/emi-calculator" className="btn-ghost">Plan your EMI meanwhile</Link>}
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
      {error && <p className="field-error" id={`${id}-error`}>{error}</p>}
    </div>
  );
}

function Summary({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted text-xs">{k}</dt>
      <dd className="font-semibold truncate num">{v}</dd>
    </div>
  );
}

function digits(s?: string | null) {
  return s == null ? undefined : s.replace(/\D/g, "");
}

function withPrefill(f: Form, pick: (p?: string) => Product): Form {
  try {
    const raw = window.sessionStorage.getItem("lfi_prefill");
    if (!raw) return f;
    const p = JSON.parse(raw) as { amount?: string; mobile?: string; product?: string };
    return {
      ...f,
      loanAmount: digits(p.amount) || f.loanAmount,
      mobile: (digits(p.mobile) || f.mobile).slice(0, 10),
      product: p.product ? pick(p.product) : f.product,
    };
  } catch {
    return f;
  }
}

function sessionStorageGet(k: string) {
  try { return window.sessionStorage.getItem(k); } catch { return null; }
}
