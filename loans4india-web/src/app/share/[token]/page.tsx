import type { Metadata } from "next";
import { shareForToken } from "@/lib/bankPackage.server";
import { loanTypeLabel } from "@/config/applicantFlow";
import { getLiveFlow } from "@/lib/applicantFlow.server";
import { formatINR } from "@/lib/format";
import { brand } from "@/config/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Loan application documents",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/**
 * Landing page for a bank sales officer. Opening it does not count as a download,
 * so link previews in WhatsApp or email don't use up the link; the download is a POST.
 */
export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const share = await shareForToken(token);
  const { flow: liveFlow } = await getLiveFlow();
  if (!share) {
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center space-y-4">
        <h1 className="text-3xl font-extrabold text-violet-deep">This link is no longer active</h1>
        <p className="text-muted">Document links expire after a few days or a few downloads. Please ask your {brand.name} contact for a new link.</p>
      </div>
    );
  }
  const a = share.application;
  const files = (JSON.parse(share.documentIds) as string[]).length;
  const left = share.maxDownloads - share.downloadCount;
  return (
    <div className="mx-auto max-w-xl px-4 py-14 space-y-6">
      <div>
        <p className="text-sm text-muted">Shared with {share.bankName}{share.contactName ? ` · for ${share.contactName}` : ""}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-violet-deep">Application <span className="font-mono">{a.reference}</span></h1>
      </div>
      <dl className="rounded-2xl border border-line bg-surface p-5 grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-muted text-xs">Applicant</dt><dd className="font-medium">{a.fullName}</dd></div>
        <div><dt className="text-muted text-xs">Loan</dt><dd className="font-medium">{loanTypeLabel(liveFlow, a.product)} · <span className="num">{formatINR(a.loanAmount)}</span></dd></div>
        <div><dt className="text-muted text-xs">Package</dt><dd className="font-medium num">Cover sheet + {files} verified files</dd></div>
        <div><dt className="text-muted text-xs">Link valid until</dt><dd className="font-medium num">{share.linkExpiresAt!.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })} · {left} download{left === 1 ? "" : "s"} left</dd></div>
      </dl>
      <form method="post" action={`/share/${token}/download`}>
        <button className="btn-primary w-full">Download documents (ZIP)</button>
      </form>
      <p className="text-xs text-muted">
        Shared with the applicant&apos;s consent only to process this loan application. Every download is recorded. Please don&apos;t forward this link. {brand.name} is a loan sourcing service, not a lender.
      </p>
    </div>
  );
}
