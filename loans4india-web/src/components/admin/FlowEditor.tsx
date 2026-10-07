"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BUILTIN_LOAN_TYPES, CORE_FIELDS, DEFAULT_FLOW, EARNING_LABELS, EARNINGS, FIELD_MODES, FORM_BASES, LOCKED_DOCS, MAX_LOAN, MIN_LOAN, QUESTION_TYPES,
  flowProblems, flowSchemaProblem, newId, type ChecklistEntry, type Earning, type Flow, type LoanType, type Question,
} from "@/config/applicantFlow";
import { FIELDS, SECTIONS, type SectionId } from "@/lib/profile";
import { formatINR } from "@/lib/format";
import { restoreFlow, saveFlow, type FlowResult } from "@/app/admin/site/flow/actions";
import { IconButton, Panel, Text, Toggle } from "./SiteEditor";

type Version = { id: number; note: string | null; createdBy: string; createdAt: string; live: boolean };
type Bank = { id: string; name: string; status: string; usable: boolean };

const locked = (doc: string) => (LOCKED_DOCS as readonly string[]).includes(doc);
const builtin = (id: string) => (BUILTIN_LOAN_TYPES as readonly string[]).includes(id);
const move = <T,>(xs: T[], i: number, d: number) => {
  const next = [...xs];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
};

/** The master admin's editor for loan types, the form and document checklists. Nothing changes for applicants until Save. */
export function FlowEditor({ initial, versions, banks, inUse }: { initial: Flow; versions: Version[]; banks: Bank[]; inUse: Record<string, number> }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [f, setF] = useState(initial);
  const [note, setNote] = useState("");
  const [result, setResult] = useState<FlowResult | null>(null);
  const [pending, start] = useTransition();
  const dirty = useMemo(() => JSON.stringify(f) !== JSON.stringify(saved), [f, saved]);
  const problems = useMemo(() => {
    const shape = flowSchemaProblem(f);
    return shape ? [shape] : flowProblems(f);
  }, [f]);
  const usable = new Set(banks.filter((b) => b.usable).map((b) => b.id));

  const set = <K extends keyof Flow>(k: K, v: Flow[K]) => setF((s) => ({ ...s, [k]: v }));
  const setLoanType = (id: string, v: LoanType) => set("loanTypes", f.loanTypes.map((l) => (l.id === id ? v : l)));

  function save() {
    start(async () => {
      const r = await saveFlow(JSON.stringify(f), note);
      setResult(r);
      if (r.ok && r.flow) {
        // The server put back anything fixed (PAN and Aadhaar first on every list); show what is live.
        setF(r.flow);
        setSaved(r.flow);
        setNote("");
        router.refresh();
      }
    });
  }
  function restore(id: number) {
    if (dirty && !window.confirm("You have unsaved changes. Restoring will throw them away. Continue?")) return;
    if (!dirty && !window.confirm(id === 0 ? "Put the original flow back live for new applications?" : `Put version ${id} back live for new applications?`)) return;
    start(async () => {
      const r = await restoreFlow(id);
      setResult(r);
      if (r.ok) window.location.reload();
    });
  }

  return (
    <div className="space-y-4 pb-28">
      <Panel title="Loan types" open>
        <p className="text-sm text-muted">The apply page lists the loan types that are switched on and have at least one partner bank, in this order. Changing a loan type&apos;s banks changes the bank list on the consent screen; people who already applied are asked to re-consent before a new bank is used.</p>
        {f.loanTypes.map((l, i) => (
          <LoanTypeEditor
            key={l.id}
            l={l}
            banks={banks}
            usable={usable}
            applications={inUse[l.id] ?? 0}
            onChange={(v) => setLoanType(l.id, v)}
            onUp={i > 0 ? () => set("loanTypes", move(f.loanTypes, i, -1)) : undefined}
            onDown={i < f.loanTypes.length - 1 ? () => set("loanTypes", move(f.loanTypes, i, 1)) : undefined}
            onRemove={builtin(l.id) || inUse[l.id] ? undefined : () => set("loanTypes", f.loanTypes.filter((x) => x.id !== l.id))}
          />
        ))}
        {f.loanTypes.length < 12 && <AddLoanType flow={f} onAdd={(l) => set("loanTypes", [...f.loanTypes, l])} />}
      </Panel>

      <Panel title="Document checklists">
        <ChecklistEditor flow={f} onChange={setF} />
      </Panel>

      <Panel title="Document types">
        <DocTypesEditor flow={f} onChange={setF} />
      </Panel>

      <Panel title="Application form: fields">
        <p className="text-sm text-muted">Change what each field is called and its help text, hide it, or make it required or optional. Fields only show when they apply (a salaried applicant never sees business questions). Name, date of birth, PAN, loan amount and how they earn are always asked.</p>
        {(Object.keys(SECTIONS) as SectionId[]).map((sec) => (
          <div key={sec} className="space-y-2">
            <h3 className="font-semibold mt-3">{SECTIONS[sec]}</h3>
            {FIELDS.filter((x) => x.section === sec).map((fd) => {
              const s = f.fields[fd.key];
              const core = CORE_FIELDS.includes(fd.key);
              const put = (v: Partial<typeof s>) => set("fields", { ...f.fields, [fd.key]: { ...s, ...v } });
              return (
                <div key={fd.key} className="grid gap-2 sm:grid-cols-[1fr_1fr_11rem] items-end rounded-xl border border-line p-3 bg-canvas" data-field={fd.key}>
                  <Text label={`Label${s.label !== DEFAULT_FLOW.fields[fd.key].label ? " (changed)" : ""}`} value={s.label} onChange={(v) => put({ label: v })} />
                  <Text label="Help text" value={s.hint} onChange={(v) => put({ hint: v })} placeholder="None" />
                  {core ? (
                    <p className="text-sm text-muted pb-3">Always asked (fixed)</p>
                  ) : (
                    <label className="block">
                      <span className="field-label">Show</span>
                      <select className="field-input" aria-label={`${s.label}: show`} value={s.mode} onChange={(e) => put({ mode: e.target.value as typeof s.mode })}>
                        {Object.entries(FIELD_MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </Panel>

      <Panel title="Application form: extra questions">
        <QuestionsEditor flow={f} onChange={(q) => set("questions", q)} />
      </Panel>

      <Panel title="History">
        <ul className="divide-y divide-line text-sm">
          {versions.map((v) => (
            <li key={v.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Version {v.id}</strong> · {new Date(v.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {v.createdBy.replace(/^staff:/, "")}
                {v.note && <span className="text-muted"> · {v.note}</span>}
                {v.live && <span className="ml-2 rounded-full bg-mint/30 px-2 py-0.5 text-xs">live</span>}
              </span>
              {!v.live && <button type="button" className="btn-ghost !py-1 !px-3 text-sm" disabled={pending} onClick={() => restore(v.id)}>Restore</button>}
            </li>
          ))}
          <li className="py-2 flex flex-wrap items-center justify-between gap-2">
            <span><strong>Original flow</strong> <span className="text-muted">· as it was built</span></span>
            <button type="button" className="btn-ghost !py-1 !px-3 text-sm" disabled={pending} onClick={() => restore(0)}>Restore</button>
          </li>
        </ul>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3">
          <span className={`text-sm font-semibold ${dirty ? "text-violet" : "text-muted"}`}>{dirty ? "Unsaved changes" : "No unsaved changes"}</span>
          <input className="field-input !py-2 flex-1 min-w-48" placeholder="What changed? (optional, shows in History)" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="btn-ghost !py-2" disabled={!dirty || pending} onClick={() => { setF(saved); setResult(null); }}>Discard</button>
          <button type="button" className="btn-primary !py-2" disabled={!dirty || pending || problems.length > 0} onClick={save}>{pending ? "Saving…" : "Save and publish"}</button>
          <a href="/apply" target="_blank" rel="noreferrer" className="text-sm text-violet underline">View apply page</a>
          {problems.length > 0 && <p role="alert" className="w-full text-sm text-danger">{problems[0]}.</p>}
          {result && <p role="status" className={`w-full text-sm ${result.ok ? "text-success" : "text-danger"}`}>{result.message}</p>}
        </div>
      </div>
    </div>
  );
}

function Amount({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      <input className="field-input num" inputMode="numeric" value={value ? String(value) : ""} onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)} />
      {value > 0 && <span className="block text-xs text-muted mt-1 num">{formatINR(value)}</span>}
    </label>
  );
}

function LoanTypeEditor({ l, banks, usable, applications, onChange, onUp, onDown, onRemove }: {
  l: LoanType; banks: Bank[]; usable: Set<string>; applications: number; onChange: (v: LoanType) => void; onUp?: () => void; onDown?: () => void; onRemove?: () => void;
}) {
  const covered = l.banks.filter((b) => usable.has(b));
  return (
    <div className="rounded-xl border border-line p-4 bg-canvas space-y-3" data-loan-type={l.id}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-56"><Text label="Name" value={l.label} onChange={(v) => onChange({ ...l, label: v })} /></div>
        <div className="flex gap-1 pt-6">
          <IconButton label="Move up" disabled={!onUp} onClick={() => onUp?.()}>↑</IconButton>
          <IconButton label="Move down" disabled={!onDown} onClick={() => onDown?.()}>↓</IconButton>
          <IconButton label={`Remove ${l.label}`} disabled={!onRemove} onClick={() => onRemove?.()}>✕</IconButton>
        </div>
      </div>
      <p className="text-xs text-muted">
        Id {l.id} · {applications ? `${applications} application${applications === 1 ? "" : "s"} so far, so it can be switched off but not removed` : builtin(l.id) ? "built in: can be switched off but not removed" : "no applications yet"}
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="field-label">Form</span>
          <select className="field-input" value={l.form} disabled={builtin(l.id)} onChange={(e) => onChange({ ...l, form: e.target.value as LoanType["form"] })}>
            {Object.entries(FORM_BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <Amount label="Smallest amount (₹)" value={l.minAmount} onChange={(v) => onChange({ ...l, minAmount: v })} />
        <Amount label="Largest amount (₹)" value={l.maxAmount} onChange={(v) => onChange({ ...l, maxAmount: v })} />
      </div>
      <Toggle label="Taking new applications" checked={l.open} onChange={(v) => onChange({ ...l, open: v })} />
      <fieldset>
        <legend className="field-label">Partner banks that cover it</legend>
        <div className="grid sm:grid-cols-2 gap-1 text-sm">
          {banks.map((b) => (
            <label key={b.id} className="flex gap-2 items-center">
              <input type="checkbox" className="size-4 accent-violet" checked={l.banks.includes(b.id)} onChange={(e) => onChange({ ...l, banks: e.target.checked ? [...l.banks, b.id] : l.banks.filter((x) => x !== b.id) })} />
              {b.name} <span className="text-xs text-muted">{b.status.toLowerCase()}{b.usable ? "" : ", can't be used here"}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {l.open && covered.length === 0 && <p className="text-sm text-amber-900">No usable partner bank covers {l.label || "this loan type"}, so it won&apos;t show on the apply page.</p>}
    </div>
  );
}

function AddLoanType({ flow, onAdd }: { flow: Flow; onAdd: (l: LoanType) => void }) {
  const [name, setName] = useState("");
  const [form, setForm] = useState<LoanType["form"]>("PERSONAL");
  const add = () => {
    const label = name.trim();
    if (label.length < 2) return;
    // Starts with the documents of the form it follows; edit them under Document checklists.
    const base = flow.loanTypes.find((l) => l.id === (form === "BUSINESS" ? "BUSINESS_LOAN" : "PERSONAL_LOAN")) ?? DEFAULT_FLOW.loanTypes[form === "BUSINESS" ? 1 : 0];
    onAdd({ id: newId(label, flow.loanTypes.map((l) => l.id)), label, form, minAmount: MIN_LOAN, maxAmount: MAX_LOAN, open: false, banks: [], checklists: structuredClone(base.checklists) });
    setName("");
  };
  return (
    <div className="rounded-xl border border-dashed border-line p-4 grid gap-3 sm:grid-cols-[1fr_16rem_auto] items-end">
      <Text label="New loan type" value={name} onChange={setName} placeholder="For example: Loan Against Property" />
      <label className="block">
        <span className="field-label">Uses the</span>
        <select className="field-input" value={form} onChange={(e) => setForm(e.target.value as LoanType["form"])}>
          {Object.entries(FORM_BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      <button type="button" className="btn-ghost !py-2.5" disabled={name.trim().length < 2} onClick={add}>Add loan type</button>
      <p className="text-xs text-muted sm:col-span-3">A new loan type starts switched off with no partner banks, and copies the documents of the form it uses.</p>
    </div>
  );
}

function ChecklistEditor({ flow, onChange }: { flow: Flow; onChange: (f: Flow) => void }) {
  const [ltId, setLtId] = useState(flow.loanTypes[0].id);
  const [earning, setEarning] = useState<Earning>("SALARIED");
  const lt = flow.loanTypes.find((l) => l.id === ltId) ?? flow.loanTypes[0];
  const list = lt.checklists[earning];
  const setList = (next: ChecklistEntry[], all = false) =>
    onChange({
      ...flow,
      loanTypes: flow.loanTypes.map((l) => (l.id === lt.id ? { ...l, checklists: all ? { SALARIED: next, SELF_EMPLOYED_BUSINESS: next, SELF_EMPLOYED_PROFESSIONAL: next } : { ...l.checklists, [earning]: next } } : l)),
    });
  const available = flow.docTypes.filter((d) => !list.some((x) => x.doc === d.id));
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Each loan type has its own list for each way of earning. PAN and masked Aadhaar are always first and required.</p>
      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="field-label">Loan type</span>
          <select className="field-input" aria-label="Checklist loan type" value={lt.id} onChange={(e) => setLtId(e.target.value)}>
            {flow.loanTypes.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Applicant earns as</span>
          <select className="field-input" aria-label="Checklist way of earning" value={earning} onChange={(e) => setEarning(e.target.value as Earning)}>
            {EARNINGS.map((e) => <option key={e} value={e}>{EARNING_LABELS[e]}</option>)}
          </select>
        </label>
      </div>
      <div className="space-y-2">
        {list.map((x, i) =>
          locked(x.doc) ? (
            <div key={x.doc} className="rounded-xl border border-line p-3 bg-canvas text-sm" data-doc={x.doc}>
              <strong>{x.title}</strong> <span className="text-xs rounded-full bg-line px-2 py-0.5">required, fixed</span>
              <p className="text-muted mt-1">{x.hint}</p>
            </div>
          ) : (
            <div key={x.doc} className="flex gap-2 items-start rounded-xl border border-line p-3 bg-canvas" data-doc={x.doc}>
              <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-[1fr_7rem]">
                <Text label="Title" value={x.title} onChange={(v) => setList(list.map((y, j) => (j === i ? { ...y, title: v } : y)))} />
                <label className="block">
                  <span className="field-label">Max files</span>
                  <input className="field-input num" inputMode="numeric" value={String(x.maxFiles)} onChange={(e) => setList(list.map((y, j) => (j === i ? { ...y, maxFiles: Math.min(20, Number(e.target.value.replace(/\D/g, "")) || 1) } : y)))} />
                </label>
                <div className="sm:col-span-2"><Text label="What to upload" multiline value={x.hint} onChange={(v) => setList(list.map((y, j) => (j === i ? { ...y, hint: v } : y)))} /></div>
                <Toggle label="Required" checked={x.required} onChange={(v) => setList(list.map((y, j) => (j === i ? { ...y, required: v } : y)))} />
              </div>
              <div className="flex gap-1 shrink-0">
                <IconButton label="Move up" disabled={i === 0 || locked(list[i - 1].doc)} onClick={() => setList(move(list, i, -1))}>↑</IconButton>
                <IconButton label="Move down" disabled={i === list.length - 1} onClick={() => setList(move(list, i, 1))}>↓</IconButton>
                <IconButton label={`Remove ${x.title}`} onClick={() => setList(list.filter((_, j) => j !== i))}>✕</IconButton>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {available.length > 0 && (
          <label className="block">
            <span className="field-label">Add a document</span>
            <select
              className="field-input"
              aria-label="Add a document"
              value=""
              onChange={(e) => {
                const d = flow.docTypes.find((x) => x.id === e.target.value);
                if (d) setList([...list, { doc: d.id, title: d.title, hint: d.hint, maxFiles: d.maxFiles, required: true }]);
              }}
            >
              <option value="">Pick a document type</option>
              {available.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </label>
        )}
        <button type="button" className="btn-ghost !py-2" onClick={() => setList(list, true)}>Use this list for every way of earning</button>
      </div>
    </div>
  );
}

function DocTypesEditor({ flow, onChange }: { flow: Flow; onChange: (f: Flow) => void }) {
  const [title, setTitle] = useState("");
  const [hint, setHint] = useState("");
  const used = (id: string) => flow.loanTypes.some((l) => EARNINGS.some((e) => l.checklists[e].some((x) => x.doc === id)));
  const builtinDoc = (id: string) => DEFAULT_FLOW.docTypes.some((d) => d.id === id);
  const put = (id: string, v: Partial<Flow["docTypes"][number]>) => onChange({ ...flow, docTypes: flow.docTypes.map((d) => (d.id === id ? { ...d, ...v } : d)) });
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">The documents a checklist can ask for. Changing one here sets the wording used the next time it is added to a list; edit a list itself under Document checklists.</p>
      {flow.docTypes.map((d) =>
        locked(d.id) ? null : (
          <div key={d.id} className="grid gap-2 sm:grid-cols-[1fr_2fr_7rem_auto] items-end rounded-xl border border-line p-3 bg-canvas" data-doc-type={d.id}>
            <Text label="Title" value={d.title} onChange={(v) => put(d.id, { title: v })} />
            <Text label="What to upload" value={d.hint} onChange={(v) => put(d.id, { hint: v })} />
            <label className="block">
              <span className="field-label">Max files</span>
              <input className="field-input num" inputMode="numeric" value={String(d.maxFiles)} onChange={(e) => put(d.id, { maxFiles: Math.min(20, Number(e.target.value.replace(/\D/g, "")) || 1) })} />
            </label>
            <div className="pb-1">
              <IconButton label={`Remove ${d.title}`} disabled={builtinDoc(d.id) || used(d.id)} onClick={() => onChange({ ...flow, docTypes: flow.docTypes.filter((x) => x.id !== d.id) })}>✕</IconButton>
            </div>
          </div>
        ),
      )}
      <div className="rounded-xl border border-dashed border-line p-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto] items-end">
        <Text label="New document type" value={title} onChange={setTitle} placeholder="For example: Property papers" />
        <Text label="What to upload" value={hint} onChange={setHint} />
        <button
          type="button"
          className="btn-ghost !py-2.5"
          disabled={title.trim().length < 2 || flow.docTypes.length >= 60}
          onClick={() => {
            onChange({ ...flow, docTypes: [...flow.docTypes, { id: newId(title, flow.docTypes.map((d) => d.id), "C_"), title: title.trim(), hint: hint.trim(), maxFiles: 4 }] });
            setTitle("");
            setHint("");
          }}
        >
          Add document type
        </button>
      </div>
    </div>
  );
}

const newQuestionId = () => `q_${Math.random().toString(36).slice(2, 10).padEnd(6, "0")}`;

function QuestionsEditor({ flow, onChange }: { flow: Flow; onChange: (q: Question[]) => void }) {
  const qs = flow.questions;
  const put = (i: number, v: Partial<Question>) => onChange(qs.map((q, j) => (j === i ? { ...q, ...v } : q)));
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Your own questions, shown in the section you pick. Staff see the answers on the case. They don&apos;t go to banks automatically.</p>
      {qs.map((q, i) => (
        <div key={q.id} className="flex gap-2 items-start rounded-xl border border-line p-3 bg-canvas" data-question={q.id}>
          <div className="flex-1 min-w-0 grid gap-2 sm:grid-cols-2">
            <Text label="Question" value={q.label} onChange={(v) => put(i, { label: v })} />
            <Text label="Help text" value={q.hint} onChange={(v) => put(i, { hint: v })} placeholder="None" />
            <label className="block">
              <span className="field-label">Section</span>
              <select className="field-input" value={q.section} onChange={(e) => put(i, { section: e.target.value as SectionId })}>
                {Object.entries(SECTIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="field-label">Answer</span>
              <select className="field-input" value={q.type} onChange={(e) => put(i, { type: e.target.value as Question["type"] })}>
                {Object.entries(QUESTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {q.type === "choice" && (
              <div className="sm:col-span-2">
                <Text label="Choices, one per line" multiline value={q.options.join("\n")} onChange={(v) => put(i, { options: v.split("\n").map((x) => x.trimStart()).slice(0, 20) })} />
              </div>
            )}
            <Toggle label="Required" checked={q.required} onChange={(v) => put(i, { required: v })} />
            <fieldset className="sm:col-span-2">
              <legend className="field-label">Ask for (none ticked = every loan type)</legend>
              <div className="flex flex-wrap gap-3 text-sm">
                {flow.loanTypes.map((l) => (
                  <label key={l.id} className="flex gap-2 items-center">
                    <input type="checkbox" className="size-4 accent-violet" checked={q.loanTypes.includes(l.id)} onChange={(e) => put(i, { loanTypes: e.target.checked ? [...q.loanTypes, l.id] : q.loanTypes.filter((x) => x !== l.id) })} />
                    {l.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="flex gap-1 shrink-0">
            <IconButton label="Move up" disabled={i === 0} onClick={() => onChange(move(qs, i, -1))}>↑</IconButton>
            <IconButton label="Move down" disabled={i === qs.length - 1} onClick={() => onChange(move(qs, i, 1))}>↓</IconButton>
            <IconButton label={`Remove ${q.label || "question"}`} onClick={() => onChange(qs.filter((_, j) => j !== i))}>✕</IconButton>
          </div>
        </div>
      ))}
      {qs.length < 40 && (
        <button
          type="button"
          className="text-sm text-violet font-semibold underline"
          onClick={() => onChange([...qs, { id: newQuestionId(), section: "personal", label: "", hint: "", type: "text", options: [], required: false, loanTypes: [] }])}
        >
          + Add a question
        </button>
      )}
    </div>
  );
}
