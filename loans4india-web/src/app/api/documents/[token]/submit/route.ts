import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { applicantApp, freezeSnapshot, intakeChecks, queueMessage } from "@/lib/applicant.server";
import { portalState } from "@/lib/portal.server";
import { consentState } from "@/lib/consentState";
import { APPLICANT_EDITABLE } from "@/lib/stages";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/**
 * Submit (section 9) or send a response to an Action needed task (section 14).
 * Server-side completeness check, declaration, frozen snapshot, then the review queue. Idempotent.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicantApp(token);
  if (!app || app.stage === "CLOSED") return NextResponse.json({ ok: false, error: "This link has expired or is not valid." }, { status: 404, headers: noStore });

  const body = (await req.json().catch(() => ({}))) as { declaration?: boolean };
  if (body.declaration !== true) {
    return NextResponse.json({ ok: false, error: "Please confirm that the details you have given are true and complete." }, { status: 422, headers: noStore });
  }
  const before = (APPLICANT_EDITABLE as readonly string[]).includes(app.stage);
  const responding = app.stage === "ACTION_NEEDED";
  // Idempotent: a second tap after submitting changes nothing.
  if (!before && !responding) return NextResponse.json({ ok: true, state: portalState(app) }, { headers: noStore });
  if (!consentState(app.consents).valid) {
    return NextResponse.json({ ok: false, error: "Your consent is needed before we can process this application." }, { status: 409, headers: noStore });
  }
  const state = portalState(app);
  if (state.details.problems.length) {
    return NextResponse.json({ ok: false, error: `Please complete your details: ${state.details.problems.map((p) => p.message).join("; ")}.` }, { status: 422, headers: noStore });
  }
  const missing = state.slots.filter((s) => s.required && (s.state === "missing" || s.state === "needs_replacing"));
  if (missing.length) {
    return NextResponse.json({ ok: false, error: `Still needed: ${missing.map((m) => m.title).join(", ")}.` }, { status: 422, headers: noStore });
  }
  if (responding) {
    // Every slot named in an open task needs a file uploaded after the task was raised.
    for (const t of app.tasks) {
      for (const slot of JSON.parse(t.slots) as string[]) {
        if (!app.documents.some((d) => d.slot === slot && d.status === "UPLOADED" && d.createdAt > t.createdAt)) {
          const title = state.slots.find((s) => s.id === slot)?.title ?? slot;
          return NextResponse.json({ ok: false, error: `Please upload a new ${title} first.` }, { status: 422, headers: noStore });
        }
      }
    }
  }

  const now = new Date();
  // A response to a bank query goes back to the bank stage; otherwise back to our review queue.
  const withBank = app.attempts.some((a) => ["SUBMITTED", "OUTCOME_RECEIVED"].includes(a.state));
  const to = responding && withBank ? "SUBMITTED_TO_BANK" : "VERIFICATION_REVIEW";
  await prisma.$transaction(async (tx) => {
    // Guard against a double tap racing: only move if the state is still what we read.
    const moved = await tx.loanApplication.updateMany({ where: { id: app.id, stage: app.stage }, data: { stage: to, submittedAt: app.submittedAt ?? now, declarationAt: now } });
    if (moved.count === 0) return;
    if (responding) await tx.applicationTask.updateMany({ where: { applicationId: app.id, status: "OPEN" }, data: { status: "RESPONDED", respondedAt: now } });
    await freezeSnapshot(tx, app.id, responding ? "ACTION_RESPONSE" : "SUBMITTED");
    await tx.applicationEvent.create({
      data: { applicationId: app.id, type: responding ? "ACTION_RESPONDED" : "SUBMITTED", actor: "customer", detail: JSON.stringify({ from: app.stage, to, declaration: true }) },
    });
    if (!responding) {
      await intakeChecks(tx, app.id);
      await queueMessage(tx, app.id, "RECEIVED", { reference: app.reference });
    }
  });
  const fresh = await applicantApp(token);
  return NextResponse.json({ ok: true, state: fresh ? portalState(fresh) : null }, { headers: noStore });
}
