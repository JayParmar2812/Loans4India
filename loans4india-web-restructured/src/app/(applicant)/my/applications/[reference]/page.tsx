import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { applicantApp, REFERENCE_RE } from "@/features/applications/server/applicant.server";
import { portalState } from "@/features/applicant-portal/server/portal.server";
import { DocumentCenter } from "@/features/applicant-portal/components/DocumentCenter";
import { loanTypeLabel } from "@/features/applicant-flow/config/applicantFlow";
import { formatINR } from "@/shared/utils/format";
import { MarketingPreference } from "@/features/applicant-portal/components/MarketingPreference";
import { consentState } from "@/features/consent/domain/consentState";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your application", robots: { index: false, follow: false }, referrer: "no-referrer" };

/**
 * One application for a signed-in applicant. applicantApp() checks that the OTP-verified mobile owns this reference;
 * anything else (someone else's reference, a guess) is a plain 404, so references can't be probed.
 */
export default async function ApplicationPage({ params, searchParams }: { params: Promise<{ reference: string }>; searchParams: Promise<{ existing?: string }> }) {
  const { reference } = await params;
  const { existing } = await searchParams;
  if (!REFERENCE_RE.test(reference)) notFound();
  const app = await applicantApp(reference);
  if (!app) notFound();
  const state = portalState(app);
  const firstName = app.fullName?.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <Link href="/my" className="text-sm text-violet underline underline-offset-4">← All your applications</Link>
      <p className="mt-4 text-sm text-muted">
        Application <span className="font-mono font-semibold text-ink">{app.reference}</span> · {loanTypeLabel(app.live.flow, app.product)} · <span className="num">{formatINR(app.loanAmount)}</span>
      </p>
      <h1 className="mt-1 text-3xl sm:text-4xl font-extrabold">{firstName ? `Hello, ${firstName}` : "Your application"}</h1>
      {existing && (
        <p className="mt-4 rounded-xl bg-mint-soft text-mint-ink px-4 py-3 text-sm" role="status">
          You already have an open application for this loan, so we brought you back to it instead of starting a second one.
        </p>
      )}
      <DocumentCenter token={app.reference} initial={state} />
      {!state.closed && <MarketingPreference appKey={app.reference} initial={consentState(app.consents).marketing} />}
    </div>
  );
}
