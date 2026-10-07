import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { applicantApp, queueMessage } from "@/lib/applicant.server";
import { portalState } from "@/lib/portal.server";
import { recordRevocation } from "@/lib/consent.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/**
 * Self-service withdrawal (section 26). "withdraw" closes the application; "revoke" also withdraws consent.
 * If the application is already with a bank, the operator must ask the bank to stop: a task is left in the timeline.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicantApp(token);
  if (!app || app.stage === "CLOSED") return NextResponse.json({ ok: false, error: "This application is already closed." }, { status: 409, headers: noStore });
  const body = (await req.json().catch(() => ({}))) as { kind?: string; confirm?: boolean };
  if (!body.confirm || (body.kind !== "withdraw" && body.kind !== "revoke")) {
    return NextResponse.json({ ok: false, error: "Please confirm." }, { status: 422, headers: noStore });
  }
  const reason = body.kind === "revoke" ? "CONSENT_REVOKED" : "WITHDRAWN";
  const withBank = app.attempts.some((a) => ["SUBMITTED", "OUTCOME_RECEIVED"].includes(a.state));
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await prisma.$transaction(async (tx) => {
    if (body.kind === "revoke") await recordRevocation(tx, app.id, { ip, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null });
    await tx.loanApplication.update({ where: { id: app.id }, data: { stage: "CLOSED", closedReason: reason, closedAt: new Date(), onHold: false } });
    await tx.applicationTask.updateMany({ where: { applicationId: app.id, status: "OPEN" }, data: { status: "CANCELLED" } });
    await tx.applicationEvent.create({ data: { applicationId: app.id, type: "CLOSED", actor: "customer", detail: JSON.stringify({ from: app.stage, to: "CLOSED", reason }) } });
    if (withBank) {
      await tx.applicationEvent.create({
        data: { applicationId: app.id, type: "ASK_BANK_TO_STOP", actor: "system", detail: JSON.stringify({ note: "Applicant withdrew after submission. Operator: ask the bank to stop processing through its channel and save the evidence." }) },
      });
    }
    await queueMessage(tx, app.id, "CLOSED", { reference: app.reference });
  });
  const fresh = await applicantApp(token);
  return NextResponse.json({ ok: true, state: fresh ? portalState(fresh) : null }, { headers: noStore });
}
