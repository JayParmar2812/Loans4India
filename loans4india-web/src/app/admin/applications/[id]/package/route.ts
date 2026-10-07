import { prisma } from "@/lib/db";
import { buildManifest, buildOperatorPackage } from "@/lib/bankPackage.server";
import { consentState } from "@/lib/consentState";
import { can, canSeeCase, holdsPortal } from "@/lib/rbac";
import { actorOf, currentStaff } from "@/lib/staff.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Authorised DSA Operator's download for portal entry (Platform Flow v4, section 18): entry sheet, renamed documents
 * and the frozen manifest of an approved package. Only for the attempt's own bank, only while it is ready to submit,
 * and only if nothing changed since the gate approved it. Every download is logged with its purpose.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Basic-auth credentials are sent on cross-site form posts too, so only accept our own pages.
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return new Response("Forbidden", { status: 403 });

  const user = await currentStaff();
  if (!user || !can(user, "portal.submit")) return new Response("You don't have permission for this.", { status: 403 });
  const { id } = await params;
  const form = await req.formData();
  const attemptId = String(form.get("attemptId") ?? "");
  const app = await prisma.loanApplication.findUnique({ where: { id }, include: { attempts: true, consents: true } });
  if (!app || !canSeeCase(user, app, app.attempts.map((a) => a.bankId))) return new Response("Not found", { status: 404 });
  const att = app.attempts.find((a) => a.id === attemptId);
  if (!att || app.stage !== "READY_FOR_BANK" || att.state !== "READY_TO_SUBMIT") return new Response("Nothing is ready to submit.", { status: 409 });
  if (!holdsPortal(user, att.bankId)) return new Response("You don't hold a portal login for this bank.", { status: 403 });
  const consent = consentState(app.consents);
  if (!consent.valid || !consent.bankIds.includes(att.bankId)) return new Response("Consent no longer covers this bank.", { status: 409 });
  const m = await buildManifest(id, att.bankId);
  if (m.hash !== att.packageHash) {
    // Something changed since the gate approved it: back to preparation, and through the gate again.
    await prisma.$transaction(async (tx) => {
      const moved = await tx.loanApplication.updateMany({ where: { id, stage: "READY_FOR_BANK" }, data: { stage: "APPLICATION_PREPARATION" } });
      if (!moved.count) return;
      await tx.bankAttempt.update({ where: { id: att.id }, data: { state: "PREPARING", approvedBy: null, approvedAt: null, preparedBy: null, sendBackReason: "Package changed after approval" } });
      await tx.applicationEvent.create({ data: { applicationId: id, type: "PACKAGE_UNFROZEN", actor: "system", detail: JSON.stringify({ bank: att.bankName, note: "Package changed after approval; back to preparation" }) } });
      await tx.applicationEvent.create({ data: { applicationId: id, type: "STAGE_CHANGED", actor: "system", detail: JSON.stringify({ from: "READY_FOR_BANK", to: "APPLICATION_PREPARATION" }) } });
    });
    return new Response("The package changed after approval, so it went back to preparation. Don't enter it on the portal.", { status: 409 });
  }

  const actor = actorOf(user);
  const pkg = await buildOperatorPackage(id, att.id, user.name);
  await prisma.applicationEvent.create({
    data: { applicationId: id, type: "OPERATOR_PACKAGE_DOWNLOADED", actor, detail: JSON.stringify({ bank: att.bankName, files: pkg.count, note: "Purpose: bank submission" }) },
  });
  return new Response(new Uint8Array(pkg.zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${pkg.fileName}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
}
