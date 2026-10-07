"use client";

import { useActionState, useState } from "react";
import type { ShareLinkState } from "@/app/admin/applications/[id]/bank-actions";

type Props = { applicationId: string; action: (prev: ShareLinkState, fd: FormData) => Promise<ShareLinkState>; disabled: boolean };

/** Creates a bank share link and shows it once, with a copy button. */
export function ShareLinkForm({ applicationId, action, disabled }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <form action={formAction} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input type="hidden" name="id" value={applicationId} />
        <input name="bankName" required placeholder="Bank / NBFC name" className="field-input" aria-label="Bank or NBFC name" disabled={disabled} />
        <input name="contactName" placeholder="Sales officer / POS name (optional)" className="field-input" aria-label="Sales officer name" disabled={disabled} />
        <button className="btn-primary" disabled={disabled || pending}>{pending ? "Creating…" : "Create share link"}</button>
      </form>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      {state?.ok && state.url && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-2">
          <p className="font-semibold text-emerald-900">Link ready. Copy it now: it is shown only once.</p>
          <div className="flex gap-2">
            <input readOnly value={state.url} className="field-input !py-1.5 font-mono text-xs" aria-label="Share link" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-ghost !py-1.5" onClick={() => navigator.clipboard.writeText(state.url!).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="text-xs text-muted">Valid until {new Date(state.expiresAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}. Send it only to the bank&apos;s official contact.</p>
        </div>
      )}
    </div>
  );
}
