"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { actorOf, currentStaff } from "@/features/staff/server/staff.server";
import type { ActionResult } from "@/features/case-management/actions/case.actions";
import { isTicketType, TICKET_OUTCOMES, TICKET_TYPES } from "@/features/support/domain/tickets";

/**
 * Ticket handling (Platform Flow v4, sections 36 and 41). Support works questions and complaints;
 * data-rights requests are resolved by Compliance. Every change is a SupportTicketEvent (append-only).
 */
const str = (f: FormData, k: string, max = 500) => String(f.get(k) ?? "").trim().slice(0, max);
const fail = (message: string): ActionResult => ({ ok: false, message });

export async function updateTicket(_p: ActionResult, f: FormData): Promise<ActionResult> {
  const user = await currentStaff();
  if (!user || !can(user, "support.manage")) return fail("You don't have permission for this.");
  const t = await prisma.supportTicket.findUnique({ where: { id: str(f, "id", 40) } });
  if (!t || !isTicketType(t.type)) return fail("Ticket not found.");
  if (["RESOLVED", "CLOSED"].includes(t.status) && str(f, "decision", 20) !== "note") return fail("This ticket is already resolved.");
  const actor = actorOf(user);
  const dataRight = TICKET_TYPES[t.type].dataRight;
  const decision = str(f, "decision", 20);
  const note = str(f, "note", 1000);

  const apply = async (data: Parameters<typeof prisma.supportTicket.update>[0]["data"], type: string, detail: Record<string, unknown>) => {
    await prisma.$transaction([
      prisma.supportTicket.update({ where: { id: t.id }, data }),
      prisma.supportTicketEvent.create({ data: { ticketId: t.id, actor, type, detail: JSON.stringify(detail) } }),
    ]);
    revalidatePath("/admin/support");
    return { ok: true, message: "Saved." } as ActionResult;
  };

  switch (decision) {
    case "take":
      return apply({ assignee: user.username, status: t.status === "OPEN" ? "IN_PROGRESS" : t.status, acknowledgedAt: t.acknowledgedAt ?? new Date() }, "ASSIGNED", { to: user.username });
    case "note":
      if (!note) return fail("Write a note.");
      return apply({}, "NOTE", { note });
    case "escalate":
      if (!note) return fail("Say why it's being escalated.");
      return apply({ status: "ESCALATED", level: 2 }, "ESCALATED", { note, to: "Grievance Officer" });
    case "resolve": {
      const outcome = str(f, "outcome", 40);
      if (!(outcome in TICKET_OUTCOMES)) return fail("Pick an outcome.");
      if (!note) return fail("Write what you told the person (they are always told the outcome).");
      // Data-rights decisions belong to Compliance (v4 section 41).
      if (dataRight && !can(user, "compliance.manage")) return fail("Data-rights requests are resolved by Compliance.");
      if (dataRight && !t.verified) return fail("The requester's mobile wasn't verified. Verify their identity before acting on a data request.");
      return apply({ status: "RESOLVED", outcome }, "STATUS_CHANGED", { to: "RESOLVED", outcome, note });
    }
    default:
      return fail("Unknown action.");
  }
}
