import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { applicantApp } from "@/lib/applicant.server";
import { portalState } from "@/lib/portal.server";
import { consentNotice } from "@/lib/consent";
import { recordConsent } from "@/lib/consent.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/** One-tap re-consent when the partner-bank list changed (section 5, state CONSENT_PENDING). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicantApp(token);
  if (!app || app.stage !== "CONSENT_PENDING") return NextResponse.json({ ok: false, error: "Nothing to confirm here." }, { status: 409, headers: noStore });
  const body = (await req.json().catch(() => ({}))) as { agree?: boolean; marketing?: boolean; bankListVersion?: string };
  if (body.agree !== true) return NextResponse.json({ ok: false, error: "Please tick the consent to continue." }, { status: 422, headers: noStore });
  const notice = consentNotice(app.product, app.live.flow);
  if (body.bankListVersion !== notice.bankListVersion) {
    return NextResponse.json({ ok: false, error: "The list of banks has just changed. Please read it again.", reload: true }, { status: 409, headers: noStore });
  }
  // Return to the state the application was in when re-consent was requested.
  const req_ = await prisma.applicationEvent.findFirst({ where: { applicationId: app.id, type: "RECONSENT_REQUESTED" }, orderBy: { createdAt: "desc" } });
  const back = (req_?.detail ? (JSON.parse(req_.detail) as { from?: string }).from : null) ?? "VERIFICATION_REVIEW";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  await prisma.$transaction(async (tx) => {
    const n = await recordConsent(tx, app.id, notice, { required: true, marketing: Boolean(body.marketing) }, { ip, userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null });
    await tx.loanApplication.update({ where: { id: app.id }, data: { stage: back } });
    await tx.applicationEvent.create({ data: { applicationId: app.id, type: "CONSENT_GIVEN", actor: "customer", detail: JSON.stringify({ from: "CONSENT_PENDING", to: back, bankListVersion: n.bankListVersion }) } });
  });
  const fresh = await applicantApp(token);
  return NextResponse.json({ ok: true, state: fresh ? portalState(fresh) : null }, { headers: noStore });
}
