import type { Metadata } from "next";
import Link from "next/link";
import { applicantApp } from "@/lib/applicant.server";
import { portalState } from "@/lib/portal.server";
import { DocumentCenter } from "@/components/DocumentCenter";
import { loanTypeLabel } from "@/config/applicantFlow";
import { formatINR } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Your application",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await applicantApp(token);

  if (!app) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-4">
        <h1 className="text-3xl font-extrabold text-violet-deep">This link has expired</h1>
        <p className="text-muted">Application links work for a limited time. Contact us and our team will send you a new one.</p>
        <Link href="/apply" className="btn-primary">Start a new application</Link>
      </div>
    );
  }

  const state = portalState(app);
  const firstName = app.fullName?.split(" ")[0];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <p className="text-sm text-muted">
        Application <span className="font-mono font-semibold text-ink">{app.reference}</span> · {loanTypeLabel(app.live.flow, app.product)} · <span className="num">{formatINR(app.loanAmount)}</span>
      </p>
      <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold text-violet-deep">{firstName ? `Hello, ${firstName}` : "Your application"}</h1>
      <DocumentCenter token={token} initial={state} />
    </div>
  );
}
