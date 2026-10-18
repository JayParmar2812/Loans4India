"use client";
import { useActionState } from "react";
import { signIn, verifyMfa, type AuthState } from "@/features/staff/actions/auth.actions";

export function SignInForm({ next, notice }: { next: string; notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, null);
  const error = state?.error ?? notice;
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="username" className="field-label">Username</label>
        <input id="username" name="username" className="field-input" autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Password</label>
        <input id="password" name="password" type="password" className="field-input" autoComplete="current-password" required />
      </div>
      {error && <p role="alert" className="text-sm rounded-xl bg-danger-soft text-danger px-3 py-2">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
    </form>
  );
}

export function MfaForm({ next, enrolling }: { next: string; enrolling: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(verifyMfa, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="code" className="field-label">{enrolling ? "6-digit code shown in the app" : "6-digit code from your authenticator app"}</label>
        <input
          id="code" name="code" className="field-input num text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]*" maxLength={6} required autoFocus aria-invalid={Boolean(state?.error)} aria-describedby={state?.error ? "code-err" : undefined}
        />
      </div>
      {state?.error && <p id="code-err" role="alert" className="text-sm rounded-xl bg-danger-soft text-danger px-3 py-2">{state.error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending ? "Checking…" : enrolling ? "Turn on and sign in" : "Sign in"}</button>
    </form>
  );
}
