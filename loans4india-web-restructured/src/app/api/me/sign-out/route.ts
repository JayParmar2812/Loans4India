import { NextResponse, type NextRequest } from "next/server";
import { endApplicantSession } from "@/features/applicant-auth/server/applicantSession.server";
import { sameOrigin } from "@/shared/security/request.server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ ok: false }, { status: 403 });
  await endApplicantSession();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
