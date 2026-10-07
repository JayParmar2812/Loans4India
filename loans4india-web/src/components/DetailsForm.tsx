"use client";

import { useState } from "react";
import {
  EXISTING_LOAN_TYPES, FIELDS, GENDERS, LOAN_PURPOSES, RESIDENCE_TYPES, SALARY_MODES, SECTIONS, TENURES,
  type DetailValues, type FieldKey, type SectionId,
} from "@/lib/profile";
import { EMPLOYMENT_LABELS } from "@/lib/validation";
import { formatINR } from "@/lib/format";
import type { PortalState } from "@/lib/portal.server";

type Props = {
  token: string;
  state: PortalState;
  onState: (s: PortalState) => void;
};

type Loan = { type: string; lender: string; emi: string };

const SELECTS: Partial<Record<FieldKey, Record<string, string>>> = {
  gender: GENDERS,
  residenceType: RESIDENCE_TYPES,
  employmentType: EMPLOYMENT_LABELS,
  salaryMode: SALARY_MODES,
  gstRegistered: { YES: "Yes", NO: "No" },
  purpose: LOAN_PURPOSES,
  tenureMonths: Object.fromEntries(TENURES.map((m) => [String(m), `${m / 12} year${m > 12 ? "s" : ""} (${m} months)`])),
};
const NUMERIC: FieldKey[] = ["monthlyIncome", "annualIncome", "existingEmi", "creditCardCount", "creditCardLimit", "loanAmount", "yearsAtAddress"];
const MONEY: FieldKey[] = ["monthlyIncome", "annualIncome", "existingEmi", "creditCardLimit", "loanAmount"];

/**
 * Application details (section 6): short sections, every field saves when the applicant leaves it,
 * and only the fields this applicant's loan and work type need are shown.
 */
export function DetailsForm({ token, state, onState }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => toStrings(state.details.values));
  const [loans, setLoans] = useState<Loan[]>(() => ((state.details.values.existingLoans as Loan[] | undefined) ?? []).map((l) => ({ ...l, emi: String(l.emi) })));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const editable = state.details.editable;
  const canEdit = (section: string) => editable === "all" || editable.includes(section);
  const rules = new Map(state.details.rules.map((r) => [r.key, r.required]));

  async function save(fields: Record<string, unknown>) {
    const key = Object.keys(fields)[0];
    setSaving(key);
    try {
      const res = await fetch(`/api/documents/${token}/details`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields }) });
      const data = await res.json().catch(() => ({ ok: false, error: "Couldn't save. Check your connection." }));
      if (!data.ok) {
        setErrors((e) => ({ ...e, [key]: data.error }));
        return;
      }
      setErrors((e) => {
        const next = { ...e };
        for (const k of Object.keys(fields)) delete next[k];
        return { ...next, ...(data.errors ?? {}) };
      });
      if (data.state) {
        onState(data.state);
        // Keep what the applicant typed, but pick up masked values (PAN, account) the server returns.
        const fresh = toStrings(data.state.details.values);
        setValues((v) => ({ ...v, ...Object.fromEntries(Object.keys(fields).filter((k) => !(data.errors ?? {})[k]).map((k) => [k, fresh[k] ?? ""])) }));
      }
      if (data.saved?.length) setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    } finally {
      setSaving(null);
    }
  }

  const commit = (k: string) => {
    const v = values[k] ?? "";
    const prev = toStrings(state.details.values)[k] ?? "";
    if (v === prev) return;
    void save({ [k]: v });
  };

  const text = state.details.text;
  const label = (f: { key: FieldKey; label: string }) => text[f.key]?.label ?? f.label;
  const hint = (f: { key: FieldKey; hint?: string }) => text[f.key]?.hint ?? f.hint ?? "";
  const sections = (Object.keys(SECTIONS) as SectionId[])
    .map((id) => ({ id, fields: FIELDS.filter((f) => f.section === id && rules.has(f.key)), questions: state.details.questions.filter((q) => q.section === id) }))
    .filter((x) => x.fields.length || x.questions.length);
  const problems = state.details.problems;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-bold">Your details</h2>
        <p className="text-xs text-muted" aria-live="polite">{saving ? "Saving…" : savedAt ? `All changes saved · ${savedAt}` : "Saves as you go"}</p>
      </div>
      {sections.map(({ id, fields, questions }) => {
        const locked = !canEdit(id);
        const open = problems.filter((p) => p.section === id).length;
        return (
          <fieldset key={id} disabled={locked} className="rounded-2xl border border-line bg-surface p-4 sm:p-5 space-y-4 disabled:opacity-70">
            <legend className="px-1 font-display font-semibold text-lg flex items-center gap-2">
              {SECTIONS[id]}
              {open > 0 && !locked && <span className="text-xs font-sans font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">{open} to fill</span>}
              {locked && <span className="text-xs font-sans font-medium text-muted">locked</span>}
            </legend>
            <div className="grid sm:grid-cols-2 gap-4">
              {fields.map((f) => {
                if (f.key === "existingLoans") {
                  return (
                    <div key={f.key} className="sm:col-span-2 space-y-2">
                      <p className="field-label">{label(f)} <span className="text-muted font-normal">(leave empty if none)</span></p>
                      {loans.map((l, i) => (
                        <div key={i} className="grid grid-cols-[1fr_1fr_8rem_auto] gap-2 items-start">
                          <select className="field-input" aria-label="Loan type" value={l.type} onChange={(e) => setLoans((ls) => ls.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} onBlur={() => saveLoans(loans)}>
                            {Object.entries(EXISTING_LOAN_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                          <input className="field-input" aria-label="Lender" placeholder="Lender" value={l.lender} onChange={(e) => setLoans((ls) => ls.map((x, j) => (j === i ? { ...x, lender: e.target.value } : x)))} onBlur={() => saveLoans(loans)} />
                          <input className="field-input num" aria-label="EMI per month" placeholder="EMI ₹" inputMode="numeric" value={l.emi} onChange={(e) => setLoans((ls) => ls.map((x, j) => (j === i ? { ...x, emi: e.target.value.replace(/\D/g, "") } : x)))} onBlur={() => saveLoans(loans)} />
                          <button type="button" className="text-danger text-sm font-semibold py-3" onClick={() => { const next = loans.filter((_, j) => j !== i); setLoans(next); saveLoans(next); }}>Remove</button>
                        </div>
                      ))}
                      {loans.length < 10 && (
                        <button type="button" className="btn-ghost !py-2" onClick={() => setLoans((ls) => [...ls, { type: "PERSONAL", lender: "", emi: "" }])}>Add a loan</button>
                      )}
                      {errors.existingLoans && <p className="field-error">{errors.existingLoans}</p>}
                    </div>
                  );
                }
                const required = rules.get(f.key);
                const opts = SELECTS[f.key];
                const id_ = `d-${f.key}`;
                return (
                  <div key={f.key} className={f.key === "addressLine" ? "sm:col-span-2" : ""}>
                    <label htmlFor={id_} className="field-label">{label(f)}{required && <span className="text-danger" aria-label="required"> *</span>}</label>
                    {opts ? (
                      <select id={id_} className="field-input" value={values[f.key] ?? ""} onChange={(e) => { setValues((v) => ({ ...v, [f.key]: e.target.value })); void save({ [f.key]: e.target.value }); }}>
                        <option value="">Select</option>
                        {Object.entries(opts).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <input
                        id={id_}
                        className={`field-input ${NUMERIC.includes(f.key) || f.key === "pan" || f.key === "ifsc" ? "num" : ""}`}
                        type={f.key === "dob" ? "date" : f.key === "email" ? "email" : "text"}
                        inputMode={NUMERIC.includes(f.key) || f.key === "accountNumber" ? "numeric" : f.key === "workYears" ? "decimal" : undefined}
                        autoComplete={f.key === "fullName" ? "name" : f.key === "email" ? "email" : f.key === "pincode" ? "postal-code" : f.key === "city" ? "address-level2" : f.key === "addressLine" ? "street-address" : "off"}
                        maxLength={f.key === "pincode" ? 6 : f.key === "pan" ? 10 : undefined}
                        value={values[f.key] ?? ""}
                        onChange={(e) => {
                          let v = e.target.value;
                          if (NUMERIC.includes(f.key) || f.key === "accountNumber" || f.key === "pincode") v = v.replace(/\D/g, "");
                          if (f.key === "pan" || f.key === "ifsc" || f.key === "gstin") v = v.toUpperCase();
                          setValues((x) => ({ ...x, [f.key]: v }));
                          setErrors((x) => ({ ...x, [f.key]: "" }));
                        }}
                        onFocus={() => {
                          // Masked secrets are replaced, not edited.
                          if ((f.key === "pan" || f.key === "accountNumber") && /X/.test(values[f.key] ?? "")) setValues((x) => ({ ...x, [f.key]: "" }));
                        }}
                        onBlur={() => {
                          if ((f.key === "pan" || f.key === "accountNumber") && !values[f.key]) {
                            setValues((x) => ({ ...x, [f.key]: toStrings(state.details.values)[f.key] ?? "" }));
                            return;
                          }
                          commit(f.key);
                        }}
                      />
                    )}
                    {MONEY.includes(f.key) && Number(values[f.key]) > 0 && <p className="text-xs text-muted mt-1 num">{formatINR(Number(values[f.key]))}</p>}
                    {hint(f) && <p className="text-xs text-muted mt-1">{hint(f)}</p>}
                    {errors[f.key] && <p className="field-error">{errors[f.key]}</p>}
                  </div>
                );
              })}
              {questions.map((q) => {
                const id_ = `d-${q.id}`;
                const choices = q.type === "yesno" ? { YES: "Yes", NO: "No" } : q.type === "choice" ? Object.fromEntries(q.options.map((o) => [o, o])) : null;
                return (
                  <div key={q.id} className={q.type === "text" ? "sm:col-span-2" : ""}>
                    <label htmlFor={id_} className="field-label">{q.label}{q.required && <span className="text-danger" aria-label="required"> *</span>}</label>
                    {choices ? (
                      <select id={id_} className="field-input" value={values[q.id] ?? ""} onChange={(e) => { setValues((v) => ({ ...v, [q.id]: e.target.value })); void save({ [q.id]: e.target.value }); }}>
                        <option value="">Select</option>
                        {Object.entries(choices).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <input
                        id={id_}
                        className={`field-input ${q.type === "number" ? "num" : ""}`}
                        inputMode={q.type === "number" ? "decimal" : undefined}
                        maxLength={300}
                        value={values[q.id] ?? ""}
                        onChange={(e) => {
                          const v = q.type === "number" ? e.target.value.replace(/[^\d.]/g, "") : e.target.value;
                          setValues((x) => ({ ...x, [q.id]: v }));
                          setErrors((x) => ({ ...x, [q.id]: "" }));
                        }}
                        onBlur={() => commit(q.id)}
                      />
                    )}
                    {q.hint && <p className="text-xs text-muted mt-1">{q.hint}</p>}
                    {errors[q.id] && <p className="field-error">{errors[q.id]}</p>}
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );

  function saveLoans(list: Loan[]) {
    const clean = list.filter((l) => l.lender.trim() || l.emi);
    void save({ existingLoans: clean.map((l) => ({ type: l.type, lender: l.lender.trim(), emi: Number(l.emi) || 0 })) });
  }
}

function toStrings(v: DetailValues): Record<string, string> {
  return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "existingLoans").map(([k, x]) => [k, x === null || x === undefined ? "" : String(x)]));
}
