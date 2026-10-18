import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/shared/db/db";
import { registrationSchema } from "@/features/apply/domain/validation";
import { consentNotice } from "@/features/consent/domain/consent";
import { recordConsent } from "@/features/consent/server/consent.server";
import { newReference } from "@/features/apply/domain/reference";
import { applicantMobile } from "@/features/applicant-auth/server/applicantSession.server";
import { clientIp, rateLimited, sameOrigin, userAgentOf } from "@/shared/security/request.server";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { getLiveFlow, openLoanTypes } from "@/features/applicant-flow/server/applicantFlow.server";
import { appFlowFrom } from "@/features/applicant-flow/config/applicantFlow";

export const runtime = "nodejs";

/**
 * Start an application (Platform Flow v4, sections 4-5). The mobile must already be verified by OTP in this browser,
 * and the required consent ticked on the screen that named the banks. Creates the application, records consent, done.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req.headers)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  const ip = clientIp(req.headers);
  const userAgent = userAgentOf(req.headers);

  if (rateLimited(`apply:${ip}`, 10, 10 * 60_000)) {
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

  // Only the person who proved this mobile by OTP can apply with it.
  const verified = await applicantMobile();
  if (!verified) return NextResponse.json({ ok: false, error: "Please verify your mobile number first.", needOtp: true }, { status: 401 });
  if (verified !== d.mobile) return NextResponse.json({ ok: false, error: "This isn't the mobile number you verified. Please verify it again.", needOtp: true }, { status: 403 });

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

  // One open application per mobile and product (section 4): the verified owner is taken to it, no second record.
  const existing = await prisma.loanApplication.findFirst({
    where: { mobile: d.mobile, product: d.product, stage: { not: "CLOSED" } },
    select: { id: true, reference: true },
  });
  if (existing) {
    await prisma.applicationEvent.create({
      data: { applicationId: existing.id, type: "DUPLICATE_ATTEMPT", actor: "customer", detail: JSON.stringify({ note: "Verified applicant sent to the open application" }) },
    });
    return NextResponse.json({ ok: true, status: "existing", reference: existing.reference });
  }

  const reference = await uniqueReference();

  await prisma.$transaction(async (tx) => {
    const app = await tx.loanApplication.create({
      data: {
        reference,
        stage: "ENQUIRY",
        lastApplicantAt: new Date(),
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

  // The applicant continues at /my/applications/<reference>, signed in by the OTP they just used.
  return NextResponse.json({ ok: true, status: "created", reference }, { status: 201 });
}

async function uniqueReference() {
  for (let i = 0; i < 5; i++) {
    const ref = newReference();
    const clash = await prisma.loanApplication.findUnique({ where: { reference: ref }, select: { id: true } });
    if (!clash) return ref;
  }
  throw new Error("Could not allocate a unique reference");
}
