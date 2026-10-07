import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { registrationSchema } from "@/lib/validation";
import { consentNotice } from "@/lib/consent";
import { recordConsent } from "@/lib/consent.server";
import { newReference } from "@/lib/reference";
import { newUploadToken } from "@/lib/uploadToken.server";
import { getSiteContent } from "@/lib/siteContent.server";
import { getLiveFlow, openLoanTypes } from "@/lib/applicantFlow.server";
import { appFlowFrom } from "@/config/applicantFlow";

export const runtime = "nodejs";

// Basic per-IP throttle. In production replace with Redis / edge rate limiting.
const hits = new Map<string, number[]>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
function throttled(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  return list.length > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null;

  if (throttled(ip)) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ ok: false, error: "Please fix the highlighted fields.", fieldErrors }, { status: 422 });
  }
  const d = parsed.data;

  // Bots fill hidden fields. Pretend success, store nothing.
  if (d.website) return NextResponse.json({ ok: true, status: "received" });

  // Paused on the Website screen, or this loan type is switched off or has no partner bank.
  const site = await getSiteContent();
  const live = await getLiveFlow();
  const loanType = openLoanTypes(site, live.flow).find((l) => l.id === d.product);
  if (!loanType) {
    return NextResponse.json({ ok: false, error: site.applications.open ? "We can't take applications for this loan right now." : site.applications.pausedMessage }, { status: 409 });
  }
  if (d.loanAmount < loanType.minAmount || d.loanAmount > loanType.maxAmount) {
    const range = `${loanType.label} amounts are ₹${loanType.minAmount.toLocaleString("en-IN")} to ₹${loanType.maxAmount.toLocaleString("en-IN")}`;
    return NextResponse.json({ ok: false, error: "Please fix the highlighted fields.", fieldErrors: { loanAmount: range } }, { status: 422 });
  }

  // The consent screen must name the banks on today's list; an old screen would record the wrong banks.
  const notice = consentNotice(d.product, live.flow);
  if (d.bankListVersion !== notice.bankListVersion) {
    return NextResponse.json({ ok: false, error: "Our list of partner banks has just changed. Please read the consent again.", reload: true }, { status: 409 });
  }
  if (notice.bankIds.length === 0) {
    return NextResponse.json({ ok: false, error: "We can't take applications for this loan yet. Please check back soon." }, { status: 409 });
  }

  // One open application per mobile and product (section 4). Never reveal whether a number already applied.
  const existing = await prisma.loanApplication.findFirst({
    where: { mobile: d.mobile, product: d.product, stage: { not: "CLOSED" } },
    select: { id: true },
  });
  if (existing) {
    await prisma.applicationEvent.create({
      data: { applicationId: existing.id, type: "DUPLICATE_ATTEMPT", actor: "customer", detail: JSON.stringify({ ip }) },
    });
    return NextResponse.json({ ok: true, status: "already_received" });
  }

  const reference = await uniqueReference();
  const upload = newUploadToken();

  await prisma.$transaction(async (tx) => {
    const app = await tx.loanApplication.create({
      data: {
        reference,
        stage: "ENQUIRY",
        uploadTokenHash: upload.hash,
        uploadTokenExpiresAt: upload.expiresAt,
        product: d.product,
        // The form, questions and checklist live now stay with this application.
        flow: JSON.stringify(appFlowFrom(live.flow, live.version, d.product)),
        flowVersion: live.version,
        loanAmount: d.loanAmount,
        mobile: d.mobile,
        source: d.source || "direct",
        medium: d.medium || null,
        campaign: d.campaign || null,
        landingPath: d.landingPath || null,
        referrer: d.referrer || null,
        referralCode: d.referralCode || null,
      },
    });
    await tx.applicationEvent.create({ data: { applicationId: app.id, type: "CREATED", actor: "customer", detail: JSON.stringify({ stage: "ENQUIRY" }) } });
    await recordConsent(tx, app.id, notice, { required: true, marketing: d.consentMarketing }, { ip, userAgent });
    // Consent given: details come next (ENQUIRY -> PROFILE_IN_PROGRESS).
    await tx.loanApplication.update({ where: { id: app.id }, data: { stage: "PROFILE_IN_PROGRESS" } });
    await tx.applicationEvent.create({
      data: { applicationId: app.id, type: "CONSENT_GIVEN", actor: "customer", detail: JSON.stringify({ from: "ENQUIRY", to: "PROFILE_IN_PROGRESS", bankListVersion: notice.bankListVersion }) },
    });
  });

  // The link is shown once, to this browser, so the applicant can continue. Only its hash is stored.
  // (Later: OTP sign-in replaces the link, and the link also goes by SMS.)
  return NextResponse.json({ ok: true, status: "created", reference, uploadToken: upload.token }, { status: 201 });
}

async function uniqueReference() {
  for (let i = 0; i < 5; i++) {
    const ref = newReference();
    const clash = await prisma.loanApplication.findUnique({ where: { reference: ref }, select: { id: true } });
    if (!clash) return ref;
  }
  throw new Error("Could not allocate a unique reference");
}
