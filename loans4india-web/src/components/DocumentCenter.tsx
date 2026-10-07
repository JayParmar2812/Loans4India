"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ACCEPT_ATTR, MAX_FILE_BYTES, rejectMessage } from "@/lib/documents";
import type { SlotView } from "@/lib/docstate";
import type { PortalState } from "@/lib/portal.server";
import { TRACKER_STEPS } from "@/lib/tracker";
import { brand } from "@/config/brand";
import { DetailsForm } from "./DetailsForm";

type Props = { token: string; initial: PortalState };

const STATE_UI: Record<SlotView["state"], { label: string; cls: string }> = {
  missing: { label: "Missing", cls: "bg-gray-100 text-gray-700" },
  uploaded: { label: "Uploaded", cls: "bg-violet-soft text-violet-deep" },
  accepted: { label: "Accepted", cls: "bg-emerald-100 text-emerald-900" },
  needs_replacing: { label: "Needs replacing", cls: "bg-amber-100 text-amber-900" },
};

/**
 * The applicant's own page (sections 6-10): status tracker, details, document checklist, submit,
 * Action needed tasks, re-consent and withdrawal. Reached through the private link until OTP sign-in exists.
 */
export function DocumentCenter({ token, initial }: Props) {
  const [state, setState] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null); // slot id being uploaded
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [declared, setDeclared] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const beforeSubmit = ["ENQUIRY", "PROFILE_IN_PROGRESS", "DOCUMENTS_PENDING"].includes(state.stage);
  const responding = state.stage === "ACTION_NEEDED";
  const showDetails = beforeSubmit || (responding && state.details.editable !== "all" && state.details.editable.length > 0);
  const unlocked = (slotId: string) => state.unlockedSlots === "all" || state.unlockedSlots.includes(slotId);
  const showDocs = !state.closed && (beforeSubmit || responding);
  const detailsDone = state.details.problems.length === 0;
  const required = state.slots.filter((s) => s.required);
  const doneCount = required.filter((s) => s.state === "uploaded" || s.state === "accepted").length;

  async function upload(slot: SlotView, files: FileList) {
    setErrors((e) => ({ ...e, [slot.id]: "" }));
    setBusy(slot.id);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_FILE_BYTES) {
          setErrors((e) => ({ ...e, [slot.id]: `${file.name} is bigger than 10 MB.` }));
          continue;
        }
        const fd = new FormData();
        fd.append("slot", slot.id);
        fd.append("file", file);
        const res = await fetch(`/api/documents/${token}`, { method: "POST", body: fd });
        const data = await res.json().catch(() => ({ ok: false, error: "Upload failed. Please try again." }));
        if (!data.ok) {
          setErrors((e) => ({ ...e, [slot.id]: data.error }));
          break;
        }
        if (data.state) setState(data.state);
      }
    } catch {
      setErrors((e) => ({ ...e, [slot.id]: "Upload failed. Check your internet connection and try again." }));
    } finally {
      setBusy(null);
    }
  }

  async function remove(slotId: string, docId: string) {
    setErrors((e) => ({ ...e, [slotId]: "" }));
    const res = await fetch(`/api/documents/${token}/${docId}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({ ok: false, error: "Couldn't remove the file." }));
    if (data.ok && data.state) setState(data.state);
    else setErrors((e) => ({ ...e, [slotId]: data.error }));
  }

  async function submit() {
    setSubmitError(null);
    if (!declared) {
      setSubmitError("Please tick the declaration to continue.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/documents/${token}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ declaration: true }) });
      const data = await res.json();
      if (!data.ok) setSubmitError(data.error);
      else {
        if (data.state) setState(data.state);
        setDeclared(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch {
      setSubmitError("We couldn't reach our server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <Tracker state={state} />

      {state.reconsent && <Reconsent token={token} notice={state.reconsent} onState={setState} />}

      {state.tasks.length > 0 && (
        <section className="rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 px-5 py-4 space-y-2" aria-labelledby="tasks-title">
          <h2 id="tasks-title" className="font-display font-semibold text-lg">What we need from you</h2>
          <ul className="space-y-1.5 text-[0.95rem]">
            {state.tasks.map((task) => <li key={task.id}>• {task.message}</li>)}
          </ul>
          <p className="text-sm">Update the items marked below, then press &quot;Send my response&quot;.</p>
        </section>
      )}

      {showDetails && !state.reconsent && <DetailsForm token={token} state={state} onState={setState} />}

      {showDocs && !state.reconsent && (
        <section className="space-y-4">
          <div className="rounded-2xl bg-violet-soft px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-violet-deep">
              Documents · <span className="num">{doneCount}</span> of <span className="num">{required.length}</span> required uploaded
            </h2>
            <div className="h-2.5 w-full sm:w-56 rounded-full bg-white overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={required.length} aria-valuenow={doneCount} aria-label="Required documents uploaded">
              <div className="h-full bg-violet transition-all" style={{ width: `${required.length ? (doneCount / required.length) * 100 : 0}%` }} />
            </div>
          </div>
          {!state.details.values.employmentType && <p className="text-sm text-muted">Tell us how you earn (under Work and income) to see your full document list.</p>}
          <ul className="space-y-4">
            {state.slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                busy={busy === slot.id}
                locked={!unlocked(slot.id)}
                error={errors[slot.id]}
                onFiles={(f) => upload(slot, f)}
                onRemove={(docId) => remove(slot.id, docId)}
              />
            ))}
          </ul>
        </section>
      )}

      {(beforeSubmit || responding) && !state.reconsent && (
        <section className="rounded-3xl bg-surface border border-line p-5 sm:p-6 space-y-4">
          <h2 className="text-xl font-bold">{responding ? "Send your response" : "Review and submit"}</h2>
          {beforeSubmit && (
            <ul className="text-sm space-y-1">
              <li>{detailsDone ? "✓" : "○"} Your details {detailsDone ? "are complete" : `(${state.details.problems.length} still to fill)`}</li>
              <li>{doneCount === required.length ? "✓" : "○"} Required documents ({doneCount} of {required.length})</li>
            </ul>
          )}
          <label className="flex gap-3 items-start cursor-pointer">
            <input type="checkbox" className="mt-1 size-5 shrink-0 accent-violet" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
            <span>The details I have given are true and complete, and the documents are my own. I understand the bank may verify them.</span>
          </label>
          {submitError && <p role="alert" className="rounded-xl bg-red-50 text-danger px-4 py-3 text-sm">{submitError}</p>}
          <button type="button" className="btn-primary w-full sm:w-auto" disabled={submitting || busy !== null || !state.canSubmit} onClick={submit}>
            {submitting ? "Sending…" : state.submitLabel}
          </button>
          {!state.canSubmit && <p className="text-xs text-muted">The button turns on once your details and required documents are complete.</p>}
          <p className="text-xs text-muted">
            After you submit, your application is locked and our team takes over. We&apos;ll ask here if anything needs fixing. {brand.name} is not a lender and doesn&apos;t charge you any fee.
          </p>
        </section>
      )}

      {!beforeSubmit && !responding && state.slots.some((s) => s.files.length) && <SlotSummary slots={state.slots} />}

      <ul className="text-sm space-y-2 bg-canvas rounded-2xl p-4">
        <li>• We will never ask for an OTP, PIN or any fee on a call. Any request for money in our name is fraud.</li>
        <li>• The bank makes the final decision on your loan and pays it directly.</li>
        <li>• Keep this link private. It gives access to your application.</li>
      </ul>

      {state.canWithdraw && <Withdraw token={token} onState={setState} />}
      {state.closed && <Link href="/apply" className="btn-ghost">Start a new application</Link>}
    </div>
  );
}

function Tracker({ state }: { state: PortalState }) {
  const t = state.tracker;
  const tone = t.tone === "action" ? "border-amber-300" : t.tone === "done" ? "border-emerald-300" : "border-line";
  return (
    <section className={`rounded-3xl bg-surface border-2 ${tone} p-5 sm:p-6 space-y-4`} aria-labelledby="tracker-title">
      <ol className="grid grid-cols-6 gap-1" aria-label="Progress">
        {TRACKER_STEPS.map((label, i) => (
          <li key={label} className="space-y-1" aria-current={i + 1 === t.step ? "step" : undefined}>
            <div className={`h-2 rounded-full ${i + 1 <= t.step && t.tone !== "closed" ? "bg-violet" : "bg-gray-200"}`} />
            <span className={`hidden sm:block text-[11px] ${i + 1 === t.step ? "font-semibold text-ink" : "text-muted"}`}>{label}</span>
          </li>
        ))}
      </ol>
      <div>
        <h2 id="tracker-title" className="text-2xl font-extrabold text-violet-deep">{t.title}</h2>
        <p className="text-muted mt-1">{t.body}</p>
      </div>
    </section>
  );
}

function Reconsent({ token, notice, onState }: { token: string; notice: NonNullable<PortalState["reconsent"]>; onState: (s: PortalState) => void }) {
  const [agree, setAgree] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setError(null);
    const res = await fetch(`/api/documents/${token}/consent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agree, marketing, bankListVersion: notice.bankListVersion }) });
    const data = await res.json().catch(() => ({ ok: false, error: "Please try again." }));
    if (data.reload) window.location.reload();
    if (!data.ok) setError(data.error);
    else if (data.state) onState(data.state);
  }
  return (
    <section className="rounded-3xl bg-surface border border-line p-5 sm:p-6 space-y-3">
      <h2 className="text-xl font-bold">Please confirm your consent</h2>
      <dl className="space-y-2 text-[0.95rem]">
        {notice.sections.map((s) => (
          <div key={s.title}><dt className="font-semibold">{s.title}</dt><dd className="text-muted">{s.body}</dd></div>
        ))}
      </dl>
      <label className="flex gap-3 items-start cursor-pointer"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-violet" checked={agree} onChange={(e) => setAgree(e.target.checked)} /><span>{notice.requiredText}</span></label>
      <label className="flex gap-3 items-start cursor-pointer"><input type="checkbox" className="mt-1 size-5 shrink-0 accent-violet" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /><span>{notice.marketingText}</span></label>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="button" className="btn-primary" disabled={!agree} onClick={send}>Confirm</button>
      <p className="text-xs text-muted">If you don&apos;t agree, you can withdraw your application below.</p>
    </section>
  );
}

function Withdraw({ token, onState }: { token: string; onState: (s: PortalState) => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function go(kind: "withdraw" | "revoke") {
    const msg = kind === "revoke"
      ? "Withdraw your consent? We will stop processing this application and close it."
      : "Withdraw this application? It will be closed.";
    if (!window.confirm(msg)) return;
    const res = await fetch(`/api/documents/${token}/withdraw`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, confirm: true }) });
    const data = await res.json().catch(() => ({ ok: false, error: "Please try again." }));
    if (!data.ok) setError(data.error);
    else if (data.state) onState(data.state);
  }
  return (
    <details open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)} className="rounded-2xl border border-line bg-surface px-5 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">Stop this application</summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted">You can withdraw at any time. If your application is already with a bank, we&apos;ll ask the bank to stop processing it; the bank keeps its own records under its own policy.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost !py-2" onClick={() => go("withdraw")}>Withdraw application</button>
          <button type="button" className="btn-ghost !py-2 !text-danger" onClick={() => go("revoke")}>Withdraw my consent</button>
        </div>
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
    </details>
  );
}

function SlotCard({ slot, busy, locked, error, onFiles, onRemove }: {
  slot: SlotView; busy: boolean; locked: boolean; error?: string; onFiles: (f: FileList) => void; onRemove: (docId: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const live = slot.files.filter((f) => f.status !== "REJECTED");
  const rejected = [...slot.files].reverse().find((f) => f.status === "REJECTED");
  const full = live.length >= slot.maxFiles;
  const ui = STATE_UI[slot.state];
  const inputId = `file-${slot.id}`;

  return (
    <li className={`rounded-2xl border bg-surface p-4 sm:p-5 ${slot.state === "needs_replacing" ? "border-amber-300" : "border-line"} ${locked ? "opacity-80" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold flex flex-wrap items-center gap-2">
            {slot.title}
            {!slot.required && <span className="text-xs font-sans font-medium text-muted">(optional)</span>}
          </h3>
          <p className="text-sm text-muted mt-0.5">{slot.hint}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${ui.cls}`}>{ui.label}</span>
      </div>

      {slot.state === "needs_replacing" && rejected && (
        <p className="mt-3 text-sm rounded-xl bg-amber-50 text-amber-900 px-3 py-2">
          {rejected.rejectNote || rejectMessage(rejected.rejectReason)}
        </p>
      )}

      {live.length > 0 && (
        <ul className="mt-3 space-y-2">
          {live.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-3 py-2 text-sm">
              <span className="min-w-0 truncate">
                {f.name} <span className="text-muted num">· {fileSize(f.sizeBytes)}</span>
                {f.status === "ACCEPTED" && <span className="text-success font-semibold"> · accepted</span>}
              </span>
              {f.status === "UPLOADED" && !locked && (
                <button type="button" className="text-danger text-sm font-semibold shrink-0" onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!locked && !full && (
        <div className="mt-3 flex flex-col items-start gap-1.5">
          <label htmlFor={inputId} className={`btn-ghost !py-2 cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}>
            {busy ? "Checking…" : live.length ? "Add another file" : slot.state === "needs_replacing" ? "Upload new copy" : "Upload"}
          </label>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={ACCEPT_ATTR}
            multiple={slot.maxFiles > 1}
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              if (e.target.files?.length) onFiles(e.target.files);
              if (input.current) input.current.value = "";
            }}
          />
          <span className="text-xs text-muted">PDF, JPG or PNG · up to 10 MB each · up to {slot.maxFiles} file{slot.maxFiles > 1 ? "s" : ""}</span>
        </div>
      )}
      {error && <p role="alert" className="field-error mt-2">{error}</p>}
    </li>
  );
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function SlotSummary({ slots }: { slots: SlotView[] }) {
  return (
    <ul className="rounded-3xl bg-surface border border-line divide-y divide-line">
      {slots.filter((s) => s.files.length || s.required).map((s) => (
        <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
          <span>{s.title}</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATE_UI[s.state].cls}`}>{STATE_UI[s.state].label}</span>
        </li>
      ))}
    </ul>
  );
}
