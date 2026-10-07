"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { actorOf, currentStaff } from "@/lib/staff.server";
import { getLiveFlow } from "@/lib/applicantFlow.server";
import { fieldDef, type FieldKey } from "@/lib/profile";
import { DEFAULT_FLOW, EARNINGS, enforceLocks, flowProblems, flowSchema, flowSchemaProblem, normaliseFlow, type Flow } from "@/config/applicantFlow";
import type { SiteResult } from "../actions";

/** On success, the flow as it went live (anything fixed put back), so the editor shows exactly that. */
export type FlowResult = SiteResult & { flow?: Flow };
const fail = (message: string): FlowResult => ({ ok: false, message });

async function guard() {
  const user = await currentStaff();
  if (!user || !can(user, "site.manage")) return null;
  return user;
}

/** Plain names of what changed, for the Activity screen. */
function changedParts(before: Flow, after: Flow): string[] {
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const out: string[] = [];
  const was = new Map(before.loanTypes.map((l) => [l.id, l]));
  for (const l of after.loanTypes) {
    const b = was.get(l.id);
    if (!b) {
      out.push(`New loan type ${l.label}`);
      continue;
    }
    if (b.label !== l.label || b.form !== l.form || b.minAmount !== l.minAmount || b.maxAmount !== l.maxAmount) out.push(`${l.label}: name or amounts`);
    if (b.open !== l.open) out.push(`${l.label}: ${l.open ? "taking applications" : "switched off"}`);
    if (!same([...b.banks].sort(), [...l.banks].sort())) out.push(`${l.label}: partner banks`);
    if (EARNINGS.some((e) => !same(b.checklists[e], l.checklists[e]))) out.push(`${l.label}: documents`);
  }
  for (const b of before.loanTypes) if (!after.loanTypes.some((l) => l.id === b.id)) out.push(`Removed loan type ${b.label}`);
  const kept = (f: Flow, other: Flow) => f.loanTypes.map((l) => l.id).filter((id) => other.loanTypes.some((o) => o.id === id));
  if (!same(kept(before, after), kept(after, before))) out.push("Loan type order");
  const fields = (Object.keys(after.fields) as FieldKey[]).filter((k) => !same(before.fields[k], after.fields[k]));
  if (fields.length) out.push(`Form fields (${fields.map((k) => fieldDef(k)?.label ?? k).slice(0, 5).join(", ")}${fields.length > 5 ? "…" : ""})`);
  if (!same(before.questions, after.questions)) out.push("Extra questions");
  if (!same(before.docTypes, after.docTypes)) out.push("Document types");
  return out;
}

/** Loan types that applications already use can't be removed; switching them off keeps those cases readable. */
async function removedInUse(next: Flow): Promise<string[]> {
  const { flow } = await getLiveFlow();
  const gone = flow.loanTypes.filter((l) => !next.loanTypes.some((n) => n.id === l.id));
  const out: string[] = [];
  for (const l of gone) if (await prisma.loanApplication.count({ where: { product: l.id } })) out.push(l.label);
  return out;
}

async function publish(flow: Flow, actor: string, type: "FLOW_SAVED" | "FLOW_RESTORED", note: string | null, extra: Record<string, unknown> = {}): Promise<FlowResult> {
  const problems = flowProblems(flow);
  if (problems.length) return fail(`${problems[0]}.`);
  const inUse = await removedInUse(flow);
  if (inUse.length) return fail(`${inUse.join(", ")} already has applications, so it can't be removed. Switch it off instead.`);
  const before = (await getLiveFlow()).flow;
  const changed = changedParts(before, flow);
  if (changed.length === 0) return fail("Nothing has changed since the last save.");
  const row = await prisma.applicantFlowVersion.create({ data: { content: JSON.stringify(flow), note, createdBy: actor } });
  await prisma.adminEvent.create({ data: { type, actor, target: `application flow v${row.id}`, detail: JSON.stringify({ changed, note, ...extra }) } });
  // The apply page, loan pages and staff screens read the flow on every request.
  revalidatePath("/", "layout");
  return { ok: true, message: `Live for new applications now (version ${row.id}). Changed: ${changed.join(", ")}. Applications already started keep their own form and checklist.`, version: row.id, flow };
}

export async function saveFlow(json: string, note: string): Promise<FlowResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can change the application flow.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return fail("The editor sent something unreadable. Reload the page and try again.");
  }
  const parsed = flowSchema.safeParse(raw);
  if (!parsed.success) return fail(`${flowSchemaProblem(raw)}.`);
  return publish(enforceLocks(parsed.data), actorOf(user), "FLOW_SAVED", note.trim().slice(0, 200) || null);
}

/** Put an older version (or the original flow, version 0) live again, as a new version. */
export async function restoreFlow(version: number): Promise<FlowResult> {
  const user = await guard();
  if (!user) return fail("Only the master admin can change the application flow.");
  let flow: Flow;
  if (version === 0) flow = DEFAULT_FLOW;
  else {
    const row = await prisma.applicantFlowVersion.findUnique({ where: { id: version } });
    if (!row) return fail("That version doesn't exist.");
    flow = normaliseFlow(JSON.parse(row.content));
  }
  return publish(enforceLocks(flow), actorOf(user), "FLOW_RESTORED", version === 0 ? "Back to the original flow" : `Restored version ${version}`, { from: version });
}
