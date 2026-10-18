"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { actorOf, currentStaff } from "@/features/staff/server/staff.server";
import type { ActionResult } from "@/features/case-management/actions/case.actions";

const str = (f: FormData, k: string, max = 400) => String(f.get(k) ?? "").trim().slice(0, max);
const fail = (message: string): ActionResult => ({ ok: false, message });

/**
 * Legal hold (Platform Flow v4, sections 26 and 34): pauses the purge for one application (dispute, fraud case,
 * regulator request). Set and lifted by Compliance with a reason; lifting needs a different person from the one who set it.
 */
export async function legalHold(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await currentStaff();
  if (!user || !can(user, "compliance.manage")) return fail("Only Compliance can set or lift a legal hold.");
  const reference = str(f, "reference", 20).toUpperCase();
  const reason = str(f, "reason");
  const app = await prisma.loanApplication.findUnique({ where: { reference } });
  if (!app) return fail("No application with that reference.");
  if (app.purgedAt) return fail("This application's personal data has already been purged.");
  const actor = actorOf(user);
  if (str(f, "decision", 10) === "lift") {
    if (!app.legalHold) return fail("There is no hold on this application.");
    if (app.legalHoldBy === actor) return fail("Someone other than the person who set the hold must lift it.");
    await prisma.$transaction([
      prisma.loanApplication.update({ where: { id: app.id }, data: { legalHold: false, legalHoldReason: null, legalHoldBy: null } }),
      prisma.applicationEvent.create({ data: { applicationId: app.id, type: "LEGAL_HOLD_LIFTED", actor, detail: JSON.stringify({ note: reason || undefined }) } }),
    ]);
  } else {
    if (!reason) return fail("Give the reason for the hold.");
    if (app.legalHold) return fail("This application is already on hold.");
    await prisma.$transaction([
      prisma.loanApplication.update({ where: { id: app.id }, data: { legalHold: true, legalHoldReason: reason, legalHoldBy: actor } }),
      prisma.applicationEvent.create({ data: { applicationId: app.id, type: "LEGAL_HOLD_SET", actor, detail: JSON.stringify({ note: reason }) } }),
    ]);
  }
  revalidatePath("/admin/compliance");
  return { ok: true, message: "Saved." };
}
