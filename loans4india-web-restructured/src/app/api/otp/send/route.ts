import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mobileSchema } from "@/features/apply/domain/validation";
import { requestOtp } from "@/features/applicant-auth/server/otp.server";
import { clientIp, rateLimited, sameOrigin } from "@/shared/security/request.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const body = z.object({ mobile: mobileSchema, website: z.string().max(0).optional() });

/** Send a sign-in / registration OTP (Platform Flow v4, section 4). The same answer whether or not the mobile has applied before. */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: noStore });
  const ip = clientIp(req.headers);
  if (rateLimited(`otp-send:${ip}`, 20, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait a few minutes." }, { status: 429, headers: noStore });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 422, headers: noStore });
  // Bots fill the hidden field: pretend it worked, send nothing.
  if (parsed.data.website) return NextResponse.json({ ok: true }, { headers: noStore });
  const r = await requestOtp(parsed.data.mobile, ip);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: r.status, headers: noStore });
  return NextResponse.json({ ok: true, devHint: process.env.NODE_ENV !== "production" ? "Development: the code is printed in the server console." : undefined }, { headers: noStore });
}
