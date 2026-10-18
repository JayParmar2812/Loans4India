"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brand } from "@/shared/config/brand";
import type { ConsentNotice } from "@/features/consent/domain/consent";
import { formatINR } from "@/shared/utils/format";

type Product = string;
/** A loan type open for new applications, from the master admin's Application flow screen. */
export type ApplyLoanType = { id: string; label: string; minAmount: number; maxAmount: number };
type Form = {
  product: Product;
  loanAmount: string;
  mobile: string;
  code: string;
  consentRequired: boolean;
  consentMarketing: boolean;
  website: string;
};

const STEPS = ["Your loan", "Verify mobile", "Consent", "Details & documents"] as const;
const RESEND_SECONDS = 30;

/**
 * Registration (Platform Flow v4, sections 4-5): loan type, amount and mobile; a one-time password proves the mobile;
 * then one consent screen naming the banks. Nothing personal beyond the enquiry is asked before the required consent tick.
 * After that the applicant continues in their own application at /my/applications/<reference>.
 */
export function ApplyForm({ initial, notices, loanTypes, synthetic = false }: { initial: { product?: string }; notices: Record<string, ConsentNotice>; loanTypes: ApplyLoanType[]; synthetic?: boolean }) {
  const products = loanTypes.map((l) => l.id);
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const heading = useRef<HTMLDivElement>(null);
  // Lazy init runs only in the browser (this component is loaded with ssr: false),
  // so we can read the quick-estimate prefill from sessionStorage — kept out of the URL on purpose.
  const pick = (p?: string): Product => products.find((x) => x === p) ?? products[0];
  const [form, setForm] = useState<Form>(() => withPrefill({
    product: pick(initial.product),
    loanAmount: "300000",
    mobile: "",
    code: "",
    consentRequired: false,
    consentMarketing: false,
    website: "",
  }, pick));
  const notice = notices[form.product];
  const loanType = loanTypes.find((l) => l.id === form.product) ?? loanTypes[0];

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  function go(s: number) {
    setStep(s);
    setServerError(null);
    heading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateLoan(): boolean {
    const e: Record<string, string> = {};
    const amt = Number(form.loanAmount);
    if (!amt || amt < loanType.minAmount) e.loanAmount = `Enter an amount of at least ${formatINR(loanType.minAmount)}`;
    else if (amt > loanType.maxAmount) e.loanAmount = `${loanType.label} amounts go up to ${formatINR(loanType.maxAmount)}`;
    if (!/^[6-9]\d{9}$/.test(form.mobile)) e.mobile = "Enter a valid 10-digit mobile number";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ ok: false, error: "Something went wrong. Please try again." }));
    return { res, data };
  }

  async function sendCode() {
    setBusy(true);
    setServerError(null);
    try {
      const { data } = await post("/api/otp/send", { mobile: form.mobile, website: form.website });
      if (!data.ok) {
        setServerError(data.error ?? "We couldn't send the code. Please try again.");
        return false;
      }
      setResendIn(RESEND_SECONDS);
      setInfo(`We sent a 6-digit code to +91 ${form.mobile}.${data.devHint ? ` ${data.devHint}` : ""}`);
      return true;
    } catch {
      setServerError("We couldn't reach our server. Check your internet connection and try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    if (!/^\d{6}$/.test(form.code)) {
      setErrors({ code: "Enter the 6-digit code" });
      return;
    }
    setBusy(true);
    setServerError(null);
    try {
      const { data } = await post("/api/otp/verify", { mobile: form.mobile, code: form.code });
      if (!data.ok) {
        setErrors({ code: data.error ?? "That code didn't work." });
        return;
      }
      setInfo(null);
      go(2);
    } catch {
      setServerError("We couldn't reach our server. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!form.consentRequired) {
      setErrors({ consentRequired: "This consent is needed to process your application" });
      return;
    }
    setBusy(true);
    setServerError(null);
    const params = new URLSearchParams(window.location.search);
    try {
      const { data } = await post("/api/applications", {
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
      });
      if (!data.ok) {
        if (data.needOtp) {
          set("code", "");
          go(1);
        }
        if (data.reload) router.refresh();
        setServerError(data.error ?? "Something went wrong. Please try again.");
        if (data.fieldErrors) {
          setErrors(data.fieldErrors);
          if (Object.keys(data.fieldErrors).some((k) => ["loanAmount", "mobile", "product"].includes(k))) go(0);
        }
        return;
      }
      try { window.sessionStorage.removeItem("lfi_prefill"); } catch { /* ignore */ }
      if (data.reference) {
        router.push(`/my/applications/${data.reference}${data.status === "existing" ? "?existing=1" : ""}`);
        return;
      }
      // Honeypot path: nothing was created.
      setServerError("Thanks. We'll be in touch.");
    } catch {
      setServerError("We couldn't reach our server. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step === 0) {
      if (validateLoan() && (await sendCode())) go(1);
    } else if (step === 1) await verifyCode();
    else await submit();
  }

  const primaryLabel = busy ? "Please wait…" : step === 0 ? "Send verification code" : step === 1 ? "Verify & continue" : "Agree & continue";

  return (
    <div ref={heading} className="card overflow-hidden scroll-mt-28">
      <ol className="grid grid-cols-4 border-b border-line text-[0.7rem] sm:text-sm" aria-label="Application steps">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`px-1.5 sm:px-3 py-3 text-center font-display font-semibold leading-tight ${i === step ? "text-violet border-b-[3px] border-violet bg-violet-soft/40" : i < step ? "text-mint-deep" : "text-muted"}`}
          >
            <span className="num block sm:inline">{i < step ? "✓" : `${i + 1}.`}</span> {label}
          </li>
        ))}
      </ol>

      <form className="p-5 sm:p-8 space-y-6" onSubmit={onSubmit} noValidate>
        {/* Honeypot for bots */}
        <div aria-hidden className="absolute -left-[9999px]">
          <label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set("website", e.target.value)} /></label>
        </div>

        {synthetic && step === 0 && (
          <p className="rounded-xl bg-warn-soft text-warn text-sm px-4 py-3">
            <b>Test mode.</b> We are not taking real applications yet. Please use made-up details only.
          </p>
        )}

        {step === 0 && (
          <div className="space-y-5">
            <fieldset>
              <legend className="field-label">Which loan do you need?</legend>
              <div className={`grid gap-3 ${products.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                {loanTypes.map((l) => (
                  <label key={l.id} className={`cursor-pointer rounded-xl border-2 px-4 py-3 font-display font-semibold text-center transition-colors ${form.product === l.id ? "border-violet bg-violet-soft text-violet-deep" : "border-line hover:border-violet/40"}`}>
                    <input type="radio" name="product" value={l.id} className="sr-only" checked={form.product === l.id} onChange={() => set("product", l.id)} />
                    {l.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field id="loanAmount" label="Loan amount (₹)" error={errors.loanAmount} hint={`${formatINR(loanType.minAmount)} to ${formatINR(loanType.maxAmount)}`}>
                <input id="loanAmount" className="field-input num" inputMode="numeric" value={form.loanAmount} aria-invalid={Boolean(errors.loanAmount)} onChange={(e) => set("loanAmount", digits(e.target.value) ?? "")} />
                {Number(form.loanAmount) > 0 && <p className="text-sm text-muted mt-1 num">{formatINR(Number(form.loanAmount))}</p>}
              </Field>
              <Field id="mobile" label="Mobile number" error={errors.mobile} hint="We'll send a one-time code to check it's yours.">
                <div className="flex">
                  <span className="grid place-items-center px-3 border-[1.5px] border-r-0 border-line rounded-l-xl text-muted bg-canvas">+91</span>
                  <input id="mobile" className="field-input !rounded-l-none num" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={form.mobile} aria-invalid={Boolean(errors.mobile)} onChange={(e) => set("mobile", (digits(e.target.value) ?? "").slice(0, 10))} />
                </div>
              </Field>
            </div>
            <p className="text-sm text-muted">Next you&apos;ll confirm your mobile and see exactly how we use your information. We ask for your other details only after you agree.</p>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            {info && <p className="rounded-xl bg-mint-soft text-mint-ink text-sm px-4 py-3" role="status">{info}</p>}
            <Field id="code" label="Verification code" error={errors.code}>
              <input
                id="code" className="field-input num text-center text-2xl tracking-[0.4em] max-w-60" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={form.code} aria-invalid={Boolean(errors.code)} onChange={(e) => set("code", (digits(e.target.value) ?? "").slice(0, 6))} autoFocus
              />
            </Field>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <button type="button" className="btn-quiet !min-h-0 !py-1" disabled={resendIn > 0 || busy} onClick={() => void sendCode()}>
                {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
              </button>
              <button type="button" className="btn-quiet !min-h-0 !py-1" onClick={() => go(0)}>Change number</button>
            </div>
            <p className="text-xs text-muted">The code expires in 5 minutes. Our staff will never ask you for it.</p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <dl className="grid grid-cols-3 gap-4 rounded-2xl bg-canvas border border-line p-4 text-sm">
              <Summary k="Loan" v={loanType.label} />
              <Summary k="Amount" v={formatINR(Number(form.loanAmount))} />
              <Summary k="Mobile ✓" v={`+91 ${form.mobile}`} />
            </dl>
            <section aria-labelledby="consent-title" className="space-y-3">
              <h2 id="consent-title" className="font-display font-bold text-lg">Before you continue</h2>
              <dl className="space-y-3 text-[0.95rem] leading-snug">
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
              <label className="flex gap-3 items-start text-[0.95rem] leading-snug cursor-pointer rounded-xl border border-line p-3">
                <input type="checkbox" className="mt-1 size-5 shrink-0" checked={form.consentRequired} onChange={(e) => set("consentRequired", e.target.checked)} aria-describedby={errors.consentRequired ? "consent-err" : undefined} />
                <span>{notice.requiredText}<span className="text-danger" aria-label="required"> *</span></span>
              </label>
              {errors.consentRequired && <p id="consent-err" className="field-error">{errors.consentRequired}</p>}
              <label className="flex gap-3 items-start text-[0.95rem] leading-snug cursor-pointer rounded-xl border border-line p-3">
                <input type="checkbox" className="mt-1 size-5 shrink-0" checked={form.consentMarketing} onChange={(e) => set("consentMarketing", e.target.checked)} />
                <span>{notice.marketingText}</span>
              </label>
            </fieldset>
          </div>
        )}

        {serverError && <p role="alert" className="rounded-xl bg-danger-soft text-danger px-4 py-3 text-sm">{serverError}</p>}

        <div className="flex items-center justify-between gap-3 pt-2">
          {step === 2 ? (
            <button type="button" className="btn-ghost" onClick={() => go(0)}>Back</button>
          ) : <span />}
          <button type="submit" className="btn-primary min-w-44" disabled={busy}>{primaryLabel}</button>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          {brand.name} is a loan sourcing service, not a lender. We don&apos;t charge you any fee. The bank alone decides on your loan.
          Already applied? <Link href="/my" className="underline">Sign in</Link>.
        </p>
      </form>
    </div>
  );
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">{label}</label>
      {children}
      {error ? <p className="field-error" id={`${id}-error`} role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
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
