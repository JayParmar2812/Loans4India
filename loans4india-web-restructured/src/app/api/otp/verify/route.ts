import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mobileSchema } from "@/features/apply/domain/validation";
import { checkOtp } from "@/features/applicant-auth/server/otp.server";
import { startApplicantSession } from "@/features/applicant-auth/server/applicantSession.server";
import { clientIp, rateLimited, sameOrigin } from "@/shared/security/request.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const body = z.object({ mobile: mobileSchema, code: z.string().trim().max(10) });

/** Check the OTP; on success the browser gets an applicant session for this mobile. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: noStore });
  if (rateLimited(`otp-verify:${clientIp(req.headers)}`, 40, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please wait a few minutes." }, { status: 429, headers: noStore });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter your mobile number and the 6-digit code." }, { status: 422, headers: noStore });
  const r = await checkOtp(parsed.data.mobile, parsed.data.code);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: noStore });
  await startApplicantSession(parsed.data.mobile);
  return NextResponse.json({ ok: true }, { headers: noStore });
}
