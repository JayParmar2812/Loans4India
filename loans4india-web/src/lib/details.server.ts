import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { encryptField, keyedHash } from "./fieldCrypto.server";
import { answerSchema, detailsProblems, fieldDef, fieldRules, FIELD_SCHEMAS, isFieldKey, maskAccount, maskPan, type DetailValues } from "./profile";
import { appFlow } from "@/config/applicantFlow";
import { APPLICANT_EDITABLE } from "./stages";

type AppRow = {
  id: string;
  stage: string;
  product: string;
  flow: string | null;
  fullName: string | null;
  email: string | null;
  city: string | null;
  pincode: string | null;
  employmentType: string | null;
  employerName: string | null;
  monthlyIncome: number | null;
  existingEmi: number;
  dob: string | null;
  loanAmount: number;
  tenureMonths: number | null;
  purpose: string | null;
  profile: string | null;
  panMasked: string | null;
  accountMasked: string | null;
};

/** Columns that hold a field directly; everything else lives in the profile JSON. */
const COLUMN_FIELDS = ["fullName", "email", "city", "pincode", "employmentType", "employerName", "monthlyIncome", "existingEmi", "dob", "loanAmount", "tenureMonths", "purpose"] as const;

export function parseProfile(raw: string | null): Record<string, unknown> {
  try {
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Current values for the form. PAN and account number are returned masked only. */
export function detailValues(app: AppRow): DetailValues {
  const v: DetailValues = { ...parseProfile(app.profile) };
  for (const k of COLUMN_FIELDS) {
    const val = app[k];
    if (val !== null && val !== undefined) v[k] = val;
  }
  // Older applications stored the purpose as free text; only keep it if it's one of today's codes.
  if (v.purpose && !FIELD_SCHEMAS.purpose.safeParse(v.purpose).success) delete v.purpose;
  if (app.panMasked) v.pan = app.panMasked;
  if (app.accountMasked) v.accountNumber = app.accountMasked;
  return v;
}

export function detailsCheck(app: AppRow) {
  const values = detailValues(app);
  return { values, problems: detailsProblems({ flow: appFlow(app), employmentType: app.employmentType, values }) };
}

/** Which sections the applicant may edit right now: all of them before submission, otherwise only those an open task unlocked. */
export function editableSections(app: { stage: string }, openTasks: { fields: string }[]): Set<string> | "all" {
  if ((APPLICANT_EDITABLE as readonly string[]).includes(app.stage)) return "all";
  const s = new Set<string>();
  if (app.stage === "ACTION_NEEDED") for (const t of openTasks) for (const f of JSON.parse(t.fields) as string[]) s.add(f);
  return s;
}

export type SaveResult = { saved: string[]; errors: Record<string, string>; values: DetailValues; problems: ReturnType<typeof detailsProblems> };

/**
 * Save one or more fields (autosave on leaving a field). Each field is validated on its own;
 * valid ones are stored even if another one in the same call is invalid.
 * Every change writes a DETAILS_UPDATED event with the field names (and old/new values for non-personal T0 fields).
 */
export async function saveDetails(appId: string, input: Record<string, unknown>, actor: string, allowed: Set<string> | "all"): Promise<SaveResult | null> {
  const app = await prisma.loanApplication.findUnique({ where: { id: appId } });
  if (!app) return null;
  const before = detailValues(app);
  const flow = appFlow(app);
  const visible = new Set(fieldRules({ flow, employmentType: app.employmentType, values: { ...before, ...input } }).map((r) => r.key));
  const errors: SaveResult["errors"] = {};
  const data: Prisma.LoanApplicationUpdateInput = {};
  const profile = parseProfile(app.profile);
  const changes: { field: string; from?: unknown; to?: unknown }[] = [];

  for (const [key, raw] of Object.entries(input)) {
    // The master admin's own questions: kept in the profile JSON under the question id.
    const q = flow.questions.find((x) => x.id === key);
    if (q) {
      if (allowed !== "all" && !allowed.has(q.section)) {
        errors[key] = "This can't be changed now. Our team will ask if anything needs updating.";
        continue;
      }
      const clearing = raw === "" || raw === null || raw === undefined;
      let value: unknown = null;
      if (!clearing) {
        const parsed = answerSchema(q).safeParse(raw);
        if (!parsed.success) {
          errors[key] = parsed.error.issues[0]?.message ?? "Please check this";
          continue;
        }
        value = parsed.data;
      }
      if (clearing) delete profile[key];
      else profile[key] = value;
      if (JSON.stringify((before as Record<string, unknown>)[key] ?? null) !== JSON.stringify(value)) changes.push({ field: key });
      continue;
    }
    if (!isFieldKey(key) || !visible.has(key)) continue;
    const def = fieldDef(key)!;
    if (allowed !== "all" && !allowed.has(def.section)) {
      errors[key] = "This can't be changed now. Our team will ask if anything needs updating.";
      continue;
    }
    // Leaving a masked value untouched means "no change".
    if ((key === "pan" && raw === app.panMasked) || (key === "accountNumber" && raw === app.accountMasked)) continue;
    const clearing = raw === "" || raw === null;
    let value: unknown = null;
    if (!clearing) {
      const parsed = FIELD_SCHEMAS[key].safeParse(raw);
      if (!parsed.success) {
        errors[key] = parsed.error.issues[0]?.message ?? "Please check this";
        continue;
      }
      value = parsed.data;
    }
    if (key === "loanAmount" && value !== null) {
      const lt = flow.loanType;
      if (Number(value) < lt.minAmount || Number(value) > lt.maxAmount) {
        errors[key] = `${lt.label} amounts are ₹${lt.minAmount.toLocaleString("en-IN")} to ₹${lt.maxAmount.toLocaleString("en-IN")}`;
        continue;
      }
    }
    if (key === "pan") {
      if (clearing) continue;
      const pan = String(value);
      Object.assign(data, { panEnc: encryptField(pan), panHash: keyedHash(pan), panMasked: maskPan(pan) });
    } else if (key === "accountNumber") {
      const acc = clearing ? null : String(value);
      Object.assign(data, { accountEnc: acc ? encryptField(acc) : null, accountMasked: acc ? maskAccount(acc) : null });
    } else if (key === "annualIncome") {
      profile.annualIncome = value;
      if (value !== null) Object.assign(data, { monthlyIncome: Math.round(Number(value) / 12) });
    } else if ((COLUMN_FIELDS as readonly string[]).includes(key)) {
      if (clearing && (key === "loanAmount" || key === "existingEmi")) continue;
      Object.assign(data, { [key]: value });
    } else {
      if (clearing) delete profile[key];
      else profile[key] = value;
    }
    const prev = before[key];
    if (JSON.stringify(prev ?? null) === JSON.stringify(value)) continue;
    changes.push(def.tier === "T0" && !def.identity ? { field: key, from: prev ?? null, to: value } : { field: key });
  }

  if (changes.length) {
    data.profile = JSON.stringify(profile);
    await prisma.$transaction(async (tx) => {
      const updated = await tx.loanApplication.update({ where: { id: appId }, data });
      const { problems } = detailsCheck(updated);
      const complete = problems.length === 0;
      const stageData: Prisma.LoanApplicationUpdateInput = { detailsCompletedAt: complete ? updated.detailsCompletedAt ?? new Date() : null };
      // While the applicant is still filling in, the state follows completeness.
      let to: string | null = null;
      if (complete && updated.stage === "PROFILE_IN_PROGRESS") to = "DOCUMENTS_PENDING";
      if (!complete && updated.stage === "DOCUMENTS_PENDING") to = "PROFILE_IN_PROGRESS";
      if (to) stageData.stage = to;
      await tx.loanApplication.update({ where: { id: appId }, data: stageData });
      await tx.applicationEvent.create({ data: { applicationId: appId, type: "DETAILS_UPDATED", actor, detail: JSON.stringify({ changes }) } });
      if (to) await tx.applicationEvent.create({ data: { applicationId: appId, type: "STAGE_CHANGED", actor: "system", detail: JSON.stringify({ from: updated.stage, to, note: complete ? "Application details complete" : "Application details incomplete" }) } });
    });
  }
  const fresh = await prisma.loanApplication.findUniqueOrThrow({ where: { id: appId } });
  const { values, problems } = detailsCheck(fresh);
  return { saved: changes.map((c) => c.field), errors, values, problems };
}
