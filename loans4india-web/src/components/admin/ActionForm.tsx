"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/app/admin/applications/[id]/actions";

type Button = { label: string; value?: string; tone?: "primary" | "ghost" | "danger" | "ok" };

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  /** Hidden fields sent with every submit. */
  hidden?: Record<string, string>;
  children?: React.ReactNode;
  /** One submit button, or several that send `decision=<value>`. */
  buttons: Button[];
  className?: string;
  /** Show the result value in a copy box (used for links and revealed fields). */
  showValue?: boolean;
  confirm?: string;
};

const TONE: Record<NonNullable<Button["tone"]>, string> = {
  primary: "btn-primary !py-2",
  ghost: "btn-ghost !py-2",
  danger: "rounded-xl bg-red-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50",
  ok: "rounded-xl bg-emerald-600 text-white px-4 py-2 text-sm font-semibold disabled:opacity-50",
};

/** A staff action form: the server decides, this only shows the answer. */
export function ActionForm({ action, hidden = {}, children, buttons, className = "space-y-2", showValue, confirm }: Props) {
  const [state, formAction, actionPending] = useActionState(action, null);
  const [transitionPending, startTransition] = useTransition();
  const pending = actionPending || transitionPending;
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  // Keep what staff typed when the server says no; clear the form only after it worked.
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  const value = state?.ok ? state.url ?? (showValue ? state.message : undefined) : undefined;
  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        if (confirm && !window.confirm(confirm)) return;
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(fd));
      }}
    >
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      <div className="flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button key={b.label} name={b.value ? "decision" : undefined} value={b.value} className={TONE[b.tone ?? "primary"]} disabled={pending}>
            {pending ? "Working…" : b.label}
          </button>
        ))}
      </div>
      {state && !state.ok && state.message && <p className="text-sm text-danger" role="alert">{state.message}</p>}
      {state?.ok && !value && state.message && <p className="text-sm text-emerald-800">{state.message}</p>}
      {value && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm space-y-2">
          <div className="flex gap-2">
            <input readOnly value={value} className="field-input !py-1.5 font-mono text-xs" aria-label="Value" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn-ghost !py-1.5" onClick={() => navigator.clipboard.writeText(value).then(() => setCopied(true))}>{copied ? "Copied" : "Copy"}</button>
          </div>
          {state?.url && state.message && <p className="text-xs text-muted">{state.message}</p>}
          <p className="text-xs text-muted">Shown once. This was logged.</p>
        </div>
      )}
    </form>
  );
}
