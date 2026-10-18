import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/shared/db/db";
import { applicantApp } from "@/features/applications/server/applicant.server";
import { consentState } from "@/features/consent/domain/consentState";
import { clientIp, sameOrigin, userAgentOf } from "@/shared/security/request.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };

/**
 * One-tap marketing opt-in / opt-out (Platform Flow v4, section 42). Appends a MARKETING consent record; never edits one.
 * Service messages about the application are covered by the required consent and are not affected.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: noStore });
  const { token } = await params;
  const app = await applicantApp(token);
  if (!app) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404, headers: noStore });
  const body = (await req.json().catch(() => ({}))) as { marketing?: unknown };
  if (typeof body.marketing !== "boolean") return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 422, headers: noStore });
  const current = consentState(app.consents).marketing;
  if (current !== body.marketing) {
    const text = body.marketing ? "Applicant opted in to tips and loan information." : "Applicant opted out of marketing messages.";
    await prisma.$transaction([
      prisma.consentRecord.create({
        data: {
          applicationId: app.id, purpose: "MARKETING", granted: body.marketing, noticeVersion: "PREFERENCE", noticeText: text,
          noticeHash: createHash("sha256").update(text).digest("hex"), ipAddress: clientIp(req.headers), userAgent: userAgentOf(req.headers),
        },
      }),
      prisma.applicationEvent.create({ data: { applicationId: app.id, type: "MARKETING_PREFERENCE", actor: "customer", detail: JSON.stringify({ marketing: body.marketing }) } }),
    ]);
  }
  return NextResponse.json({ ok: true, marketing: body.marketing }, { headers: noStore });
}
