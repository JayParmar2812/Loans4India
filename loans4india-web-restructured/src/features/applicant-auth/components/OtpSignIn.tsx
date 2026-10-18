"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Returning applicants: mobile, then the one-time code (Platform Flow v4, section 4). */
export function OtpSignIn() {
  const router = useRouter();
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  async function call(url: string, body: unknown) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.json().catch(() => ({ ok: false, error: "Something went wrong. Please try again." }));
  }

  async function send() {
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError("Enter a valid 10-digit mobile number");
    setBusy(true);
    setError(null);
    try {
      const d = await call("/api/otp/send", { mobile });
      if (!d.ok) return setError(d.error);
      setSent(true);
      setResendIn(30);
      setInfo(`If this number has an application with us, you can sign in with the code we sent to +91 ${mobile}.${d.devHint ? ` ${d.devHint}` : ""}`);
    } catch {
      setError("We couldn't reach our server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code");
    setBusy(true);
    setError(null);
    try {
      const d = await call("/api/otp/verify", { mobile, code });
      if (!d.ok) return setError(d.error);
      router.push("/my");
      router.refresh();
    } catch {
      setError("We couldn't reach our server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) void (sent ? verify() : send());
      }}
    >
      <div>
        <label htmlFor="m" className="field-label">Mobile number</label>
        <div className="flex">
          <span className="grid place-items-center px-3 border-[1.5px] border-r-0 border-line rounded-l-xl text-muted bg-canvas">+91</span>
          <input id="m" className="field-input !rounded-l-none num" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={mobile} disabled={sent}
            onChange={(e) => { setMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(null); }} />
        </div>
      </div>
      {sent && (
        <>
          {info && <p className="rounded-xl bg-mint-soft text-mint-ink text-sm px-4 py-3" role="status">{info}</p>}
          <div>
            <label htmlFor="c" className="field-label">6-digit code</label>
            <input id="c" className="field-input num text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} autoFocus
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }} />
          </div>
          <div className="flex gap-4 text-sm">
            <button type="button" className="btn-quiet !min-h-0 !py-1" disabled={resendIn > 0 || busy} onClick={() => void send()}>{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}</button>
            <button type="button" className="btn-quiet !min-h-0 !py-1" onClick={() => { setSent(false); setCode(""); setInfo(null); }}>Change number</button>
          </div>
        </>
      )}
      {error && <p role="alert" className="rounded-xl bg-danger-soft text-danger px-3 py-2 text-sm">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : sent ? "Sign in" : "Send code"}</button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn-quiet !min-h-0 !py-1.5 text-sm"
      onClick={async () => {
        await fetch("/api/me/sign-out", { method: "POST" });
        router.push("/");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
