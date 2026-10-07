import { z } from "zod";
import { BANK_LIST_VERSION, BANKS } from "./banks";
import { bannedPhrases } from "./siteContent";
import { BUILTIN_DOC_TYPES, SLOT_TITLES, type Slot, type SlotId } from "@/lib/documents";
import { EMPLOYMENT_TYPES, FIELDS, SECTIONS, type FieldKey, type SectionId } from "@/lib/profile";

/**
 * The applicant flow the master admin controls (JP, 5 Oct 2026; plan in specs/master-admin-site-control.md, stage 3):
 * loan types and their bank coverage, the application form's fields and extra questions, and the document checklists.
 *
 * Each application copies the part it needs (an AppFlow) when it starts, so a change reaches new applications only.
 * Bank coverage is the exception: it always comes from the live flow, because consent decides which banks a case can use.
 *
 * Fixed whatever is saved (v4 and compliance): the core identity fields, PAN and masked Aadhaar on every checklist
 * with their standard wording, and the banned words.
 * Pure: safe on client and server.
 */

export const EARNINGS = EMPLOYMENT_TYPES;
export type Earning = (typeof EARNINGS)[number];
export const EARNING_LABELS: Record<Earning, string> = {
  SALARIED: "Salaried",
  SELF_EMPLOYED_BUSINESS: "Business owner",
  SELF_EMPLOYED_PROFESSIONAL: "Professional (doctor, CA, etc.)",
};

export const FORM_BASES = {
  PERSONAL: "Personal loan form",
  BUSINESS: "Business loan form (also asks about GST)",
} as const;

/** Loan types existing applications depend on; they can be switched off but never removed. */
export const BUILTIN_LOAN_TYPES = ["PERSONAL_LOAN", "BUSINESS_LOAN"] as const;
/** Fields every application needs (identity, amount, and how you earn): label and help text only. */
export const CORE_FIELDS: readonly FieldKey[] = ["fullName", "dob", "pan", "loanAmount", "employmentType"];
/** On every checklist, required, with their standard wording (the Aadhaar masking instruction stays). */
export const LOCKED_DOCS: readonly SlotId[] = ["PAN", "AADHAAR"];

export const MIN_LOAN = 10_000;
export const MAX_LOAN = 5_00_00_000;

export const FIELD_MODES = { default: "As standard", required: "Always required", optional: "Optional", hidden: "Hidden" } as const;
export const QUESTION_TYPES = { text: "Short answer", number: "Number", yesno: "Yes or no", choice: "Pick one from a list" } as const;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const amount = z.number().int().min(MIN_LOAN, `Amounts start at ₹${MIN_LOAN.toLocaleString("en-IN")}`).max(MAX_LOAN, "Amounts go up to ₹5 crore");
const docId = z.string().regex(/^[A-Z][A-Z0-9_]{1,39}$/, "Document ids use capital letters, digits and _");

const entrySchema = z.object({ doc: docId, title: text(2, 80), hint: text(0, 400), maxFiles: z.number().int().min(1).max(20), required: z.boolean() });
const checklistSchema = z.array(entrySchema).max(30);

const loanTypeSchema = z.object({
  id: z.string().regex(/^[A-Z][A-Z0-9_]{2,39}$/, "Loan type ids use capital letters, digits and _"),
  label: text(2, 40),
  form: z.enum(["PERSONAL", "BUSINESS"]),
  minAmount: amount,
  maxAmount: amount,
  /** Taking new applications. */
  open: z.boolean(),
  /** Partner banks that cover this loan type (ids from src/config/banks.ts). */
  banks: z.array(z.string().max(60)).max(50),
  checklists: z.object({ SALARIED: checklistSchema, SELF_EMPLOYED_BUSINESS: checklistSchema, SELF_EMPLOYED_PROFESSIONAL: checklistSchema }),
});

const docTypeSchema = z.object({ id: docId, title: text(2, 80), hint: text(0, 400), maxFiles: z.number().int().min(1).max(20) });
const fieldSetupSchema = z.object({ label: text(2, 80), hint: text(0, 200), mode: z.enum(["default", "required", "optional", "hidden"]) });

const SECTION_IDS = Object.keys(SECTIONS) as [SectionId, ...SectionId[]];
const questionSchema = z.object({
  id: z.string().regex(/^q_[a-z0-9]{4,20}$/),
  section: z.enum(SECTION_IDS),
  label: text(2, 120),
  hint: text(0, 200),
  type: z.enum(Object.keys(QUESTION_TYPES) as [keyof typeof QUESTION_TYPES, ...(keyof typeof QUESTION_TYPES)[]]),
  /** Choices for a "choice" question; blank lines are dropped. */
  options: z.array(z.string().max(60)).max(20).transform((xs) => xs.map((x) => x.trim()).filter(Boolean)),
  required: z.boolean(),
  /** Loan types that ask it; empty = all. */
  loanTypes: z.array(z.string().max(40)).max(20),
});

const FIELD_KEYS = FIELDS.map((f) => f.key) as [FieldKey, ...FieldKey[]];

export const flowSchema = z.object({
  loanTypes: z.array(loanTypeSchema).min(1).max(12),
  /** The library of document types a checklist can use: the built-in ones plus any the master admin added. */
  docTypes: z.array(docTypeSchema).max(60),
  fields: z.record(z.enum(FIELD_KEYS), fieldSetupSchema),
  questions: z.array(questionSchema).max(40),
});

export type Flow = z.infer<typeof flowSchema>;
export type LoanType = Flow["loanTypes"][number];
export type ChecklistEntry = LoanType["checklists"]["SALARIED"][number];
export type DocType = Flow["docTypes"][number];
export type FieldSetup = Flow["fields"][FieldKey];
export type Question = Flow["questions"][number];

// ---------- Built-in defaults: exactly what the site did before the master admin changed anything ----------

const B = BUILTIN_DOC_TYPES;
const entry = (id: SlotId, required: boolean, hint?: string): ChecklistEntry => ({ doc: id, title: B[id].title, hint: hint ?? B[id].hint, maxFiles: B[id].maxFiles, required });

const SALARIED_PERSONAL = [entry("PAN", true), entry("AADHAAR", true), entry("SALARY_SLIPS", true), entry("BANK_STATEMENT", true), entry("ADDRESS_PROOF", false), entry("FORM16", false), entry("EXISTING_LOANS", false), entry("PHOTO", false)];
const SELF_EMPLOYED_PERSONAL = [
  entry("PAN", true),
  entry("AADHAAR", true),
  entry("ITR", true),
  entry("BANK_STATEMENT", true, "Last 12 months of your main bank account, as PDF from net banking without a password."),
  entry("BUSINESS_PROOF", true),
  entry("ADDRESS_PROOF", false),
  entry("EXISTING_LOANS", false),
  entry("PHOTO", false),
];
const BUSINESS = [
  entry("PAN", true),
  entry("AADHAAR", true),
  entry("BUSINESS_REGISTRATION", true),
  entry("BUSINESS_ADDRESS_PROOF", true),
  entry("ITR", true),
  entry("FINANCIALS", true),
  entry("BANK_STATEMENT", true, "Last 12 months of your main business (current) account, as PDF from net banking without a password."),
  entry("GST_RETURNS", false),
  entry("BUSINESS_PAN", false),
  entry("CONSTITUTION_DOCS", false),
  entry("ADDRESS_PROOF", false),
  entry("EXISTING_LOANS", false),
  entry("PHOTO", false),
];

/** Banks whose entry in src/config/banks.ts lists the product: the coverage before any change on the flow screen. */
const defaultBanks = (id: string) => BANKS.filter((b) => b.products.includes(id)).map((b) => b.id);

export const DEFAULT_FLOW: Flow = flowSchema.parse({
  loanTypes: [
    {
      id: "PERSONAL_LOAN", label: "Personal Loan", form: "PERSONAL", minAmount: MIN_LOAN, maxAmount: MAX_LOAN, open: true, banks: defaultBanks("PERSONAL_LOAN"),
      checklists: { SALARIED: SALARIED_PERSONAL, SELF_EMPLOYED_BUSINESS: SELF_EMPLOYED_PERSONAL, SELF_EMPLOYED_PROFESSIONAL: SELF_EMPLOYED_PERSONAL },
    },
    {
      id: "BUSINESS_LOAN", label: "Business Loan", form: "BUSINESS", minAmount: MIN_LOAN, maxAmount: MAX_LOAN, open: true, banks: defaultBanks("BUSINESS_LOAN"),
      checklists: { SALARIED: BUSINESS, SELF_EMPLOYED_BUSINESS: BUSINESS, SELF_EMPLOYED_PROFESSIONAL: BUSINESS },
    },
  ],
  docTypes: Object.values(B).map(({ id, title, hint, maxFiles }) => ({ id, title, hint, maxFiles })),
  fields: Object.fromEntries(FIELDS.map((f) => [f.key, { label: f.label, hint: f.hint ?? "", mode: "default" }])),
  questions: [],
});

// ---------- Saving ----------

/** Read a stored version. Fields added to the form later get their defaults. */
export function normaliseFlow(raw: unknown): Flow {
  const r = (raw ?? {}) as Partial<Flow>;
  return flowSchema.parse({ ...DEFAULT_FLOW, ...r, fields: { ...DEFAULT_FLOW.fields, ...(r.fields ?? {}) } });
}

/** Put back everything that is fixed, whatever the editor sent. */
export function enforceLocks(flow: Flow): Flow {
  const bankIds = new Set(BANKS.map((b) => b.id));
  const loanIds = new Set(flow.loanTypes.map((l) => l.id));
  const lockedEntries = LOCKED_DOCS.map((id) => entry(id, true));
  const fields = { ...flow.fields };
  for (const k of CORE_FIELDS) fields[k] = { ...fields[k], mode: "default" };
  return {
    loanTypes: flow.loanTypes.map((l) => ({
      ...l,
      banks: [...new Set(l.banks.filter((b) => bankIds.has(b)))],
      checklists: Object.fromEntries(
        EARNINGS.map((e) => [e, [...lockedEntries, ...l.checklists[e].filter((x) => !(LOCKED_DOCS as readonly string[]).includes(x.doc))]]),
      ) as LoanType["checklists"],
    })),
    docTypes: [
      ...LOCKED_DOCS.map((id) => ({ id, title: B[id].title, hint: B[id].hint, maxFiles: B[id].maxFiles })),
      ...flow.docTypes.filter((d) => !(LOCKED_DOCS as readonly string[]).includes(d.id)),
    ],
    fields,
    questions: flow.questions.map((q) => ({ ...q, options: q.type === "choice" ? q.options : [], loanTypes: q.loanTypes.filter((id) => loanIds.has(id)) })),
  };
}

const NOT_TEXT = new Set(["id", "doc", "banks", "loanTypes", "section", "type", "mode", "form"]);
const dupes = (xs: string[]) => [...new Set(xs.filter((x, i) => xs.indexOf(x) !== i))];

/** Reasons a flow can't be saved, in plain words. */
export function flowProblems(flow: Flow): string[] {
  const out: string[] = [];
  for (const id of BUILTIN_LOAN_TYPES) {
    if (!flow.loanTypes.some((l) => l.id === id)) out.push(`${DEFAULT_FLOW.loanTypes.find((l) => l.id === id)!.label} can't be removed. Switch it off instead`);
  }
  for (const d of dupes(flow.loanTypes.map((l) => l.id))) out.push(`Two loan types share the id ${d}`);
  for (const d of dupes(flow.docTypes.map((x) => x.id))) out.push(`Two document types share the id ${d}`);
  for (const d of dupes(flow.questions.map((x) => x.id))) out.push(`Two questions share the id ${d}`);
  const known = new Set(flow.docTypes.map((d) => d.id));
  for (const l of flow.loanTypes) {
    if (l.minAmount > l.maxAmount) out.push(`${l.label}: the smallest amount is more than the largest`);
    for (const e of EARNINGS) {
      const list = l.checklists[e];
      for (const x of list) if (!known.has(x.doc)) out.push(`${l.label} (${EARNING_LABELS[e]}) uses a document type that was removed: ${x.title}`);
      for (const d of dupes(list.map((x) => x.doc))) out.push(`${l.label} (${EARNING_LABELS[e]}) lists ${list.find((x) => x.doc === d)!.title} twice`);
    }
  }
  for (const q of flow.questions) if (q.type === "choice" && q.options.length < 2) out.push(`The question "${q.label}" needs at least two choices`);
  const banned = bannedPhrases(flow, NOT_TEXT);
  if (banned.length) out.push(`The form can't say "${banned.join('", "')}". An estimate is never an approval, and only the bank decides`);
  return out;
}

/** The first thing the form check rejects, in words the master admin can act on. */
export function flowSchemaProblem(flow: unknown): string | null {
  const r = flowSchema.safeParse(flow);
  if (r.success) return null;
  const i = r.error.issues[0];
  const f = flow as Partial<Flow>;
  const [area, idx, ...rest] = i.path as (string | number)[];
  const what =
    area === "loanTypes" ? `Loan type "${f.loanTypes?.[idx as number]?.label || Number(idx) + 1}"` :
    area === "questions" ? `Question ${Number(idx) + 1}` :
    area === "docTypes" ? `Document type "${f.docTypes?.[idx as number]?.title || Number(idx) + 1}"` :
    area === "fields" ? `The field ${String(idx)}` : "The form";
  const msg = i.code === "too_small" && i.origin === "string" ? "needs more text" : i.code === "too_big" && i.origin === "string" ? "is too long" : i.message;
  return `${what}${rest.length ? ` (${rest.join(" › ")})` : ""}: ${msg}`;
}

// ---------- What one application uses ----------

/** The slice of the flow one application keeps: its loan type, the field setup and the questions it asks. */
export type AppFlow = { version: number; loanType: LoanType; fields: Flow["fields"]; questions: Question[] };

export function appFlowFrom(flow: Flow, version: number, product: string): AppFlow | null {
  const loanType = flow.loanTypes.find((l) => l.id === product);
  if (!loanType) return null;
  return { version, loanType, fields: flow.fields, questions: flow.questions.filter((q) => q.loanTypes.length === 0 || q.loanTypes.includes(product)) };
}

const parsed = new Map<string, AppFlow>();

/** The flow an application started with (null = it started before the flow screen existed: the built-in defaults). */
export function appFlow(app: { product: string; flow: string | null }): AppFlow {
  const key = app.flow ?? `default:${app.product}`;
  const hit = parsed.get(key);
  if (hit) return hit;
  let af: AppFlow | null = null;
  if (app.flow) {
    try {
      af = JSON.parse(app.flow) as AppFlow;
    } catch {
      af = null;
    }
  }
  af ??= appFlowFrom(DEFAULT_FLOW, 0, app.product) ?? { ...appFlowFrom(DEFAULT_FLOW, 0, "PERSONAL_LOAN")!, loanType: { ...DEFAULT_FLOW.loanTypes[0], id: app.product, label: app.product } };
  if (parsed.size > 500) parsed.clear();
  parsed.set(key, af);
  return af;
}

/** Documents this applicant uploads. Until they say how they earn, the self-employed list is shown (as before). */
export function checklistFor(af: AppFlow, employmentType: string | null | undefined): Slot[] {
  const lists = af.loanType.checklists;
  const list = lists[employmentType as Earning] ?? lists.SELF_EMPLOYED_BUSINESS;
  return list.map((x) => ({ id: x.doc, title: x.title, hint: x.hint, maxFiles: x.maxFiles, required: x.required }));
}

export function slotTitle(af: AppFlow, slot: string): string {
  for (const e of EARNINGS) {
    const hit = af.loanType.checklists[e].find((x) => x.doc === slot);
    if (hit) return hit.title;
  }
  return SLOT_TITLES[slot] ?? slot;
}

export function loanTypeLabel(flow: Flow, product: string): string {
  return flow.loanTypes.find((l) => l.id === product)?.label ?? product;
}

/** Partner banks covering a loan type in this flow. */
export function coverage(flow: Flow, product: string): string[] {
  return flow.loanTypes.find((l) => l.id === product)?.banks ?? [];
}

const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, "0");
};

/**
 * The bank-list version the consent screen records. It stays the bank file's own version while coverage is as the
 * bank file says, and changes whenever the master admin changes which banks cover the loan type, so older consents show as outdated.
 */
export function bankListVersionFor(flow: Flow, product: string): string {
  const ids = [...coverage(flow, product)].sort().join(",");
  if (ids === [...defaultBanks(product)].sort().join(",")) return BANK_LIST_VERSION;
  return `${BANK_LIST_VERSION}.c${fnv(`${product}:${ids}`)}`;
}

/** Short id for a new loan type, document type or question, from its name. */
export function newId(name: string, taken: string[], prefix = ""): string {
  const base = (prefix + name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")).slice(0, 34) || `${prefix}X`;
  const start = /^[A-Z]/.test(base) ? base : `X_${base}`;
  let id = start.length >= 3 ? start : `${start}_TYPE`;
  for (let n = 2; taken.includes(id); n++) id = `${start}_${n}`;
  return id;
}
