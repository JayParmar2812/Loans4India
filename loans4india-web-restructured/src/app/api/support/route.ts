import { NextResponse, type NextRequest } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/shared/db/db";
import { dueFor, ticketSchema, TICKET_TYPES, type TicketType } from "@/features/support/domain/tickets";
import { applicantMobile } from "@/features/applicant-auth/server/applicantSession.server";
import { clientIp, rateLimited, sameOrigin } from "@/shared/security/request.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const ticketRef = () => `TKT-${Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

/**
 * Contact, complaint or data-rights request (Platform Flow v4, section 41).
 * Data-rights requests need the mobile proved by OTP (an applicant session for that mobile), so nothing is released
 * to someone who only knows a phone number. The reply never reveals whether the mobile has an application.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403, headers: noStore });
  const ip = clientIp(req.headers);
  if (rateLimited(`support:${ip}`, 5, 60 * 60_000)) {
    return NextResponse.json({ ok: false, error: "Too many requests from this network. Please email us instead." }, { status: 429, headers: noStore });
  }
  const parsed = ticketSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[i.path.join(".")] ??= i.message;
    return NextResponse.json({ ok: false, error: "Please fix the highlighted fields.", fieldErrors }, { status: 422, headers: noStore });
  }
  const d = parsed.data;
  const type = d.type as TicketType;
  if (d.website) return NextResponse.json({ ok: true, reference: ticketRef() }, { headers: noStore });

  const verifiedMobile = await applicantMobile();
  const verified = verifiedMobile === d.mobile;
  if (TICKET_TYPES[type].dataRight && !verified) {
    return NextResponse.json({ ok: false, error: "For a data request, first sign in with this mobile number so we know it's you.", needSignIn: true }, { status: 401, headers: noStore });
  }

  let reference = ticketRef();
  for (let i = 0; i < 4 && (await prisma.supportTicket.findUnique({ where: { reference }, select: { id: true } })); i++) reference = ticketRef();
  await prisma.$transaction(async (tx) => {
    const t = await tx.supportTicket.create({
      data: {
        reference, type, name: d.name, mobile: d.mobile, email: d.email || null, applicationRef: d.applicationRef || null,
        message: d.message, verified, dueAt: dueFor(type), ip,
      },
    });
    await tx.supportTicketEvent.create({ data: { ticketId: t.id, actor: verified ? "customer:verified" : "customer", type: "CREATED", detail: JSON.stringify({ type }) } });
  });
  return NextResponse.json({ ok: true, reference, dueDays: TICKET_TYPES[type].dueDays }, { status: 201, headers: noStore });
}
