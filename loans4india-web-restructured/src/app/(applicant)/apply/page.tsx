import type { Metadata } from "next";
import Link from "next/link";
import { ApplyFormClient } from "@/features/apply/components/ApplyFormClient";
import { consentNotice } from "@/features/consent/domain/consent";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { getLiveFlow, openLoanTypes } from "@/features/applicant-flow/server/applicantFlow.server";
import { dataMode } from "@/shared/config/brand";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Start your application",
  description: "Start your loan application in a few minutes. Free for borrowers.",
  robots: { index: false },
};

const NEXT = [
  { t: "Fill in your details", d: "One form, saved as you go. Only what your loan type and the bank need." },
  { t: "Upload documents", d: "PAN, masked Aadhaar, income proof, bank statements. Checked and stored encrypted." },
  { t: "We review and submit", d: "A named person checks your file and submits it to one suitable partner bank." },
];

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const product = typeof sp.product === "string" ? sp.product : undefined;
  const site = await getSiteContent();
  const { flow } = await getLiveFlow();
  const open = openLoanTypes(site, flow);
  // The consent screen names the partner banks for each loan type; built on the server from the bank master and the flow's coverage.
  const notices = Object.fromEntries(open.map((l) => [l.id, consentNotice(l.id, flow)]));
  if (open.length === 0) {
    // Applications paused on the Website screen, or every loan type switched off.
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-extrabold">Applications are paused</h1>
        <p className="text-lg mt-4 whitespace-pre-line">{site.applications.pausedMessage}</p>
        <p className="mt-6"><Link href="/my" className="btn-ghost">Sign in to an existing application</Link></p>
      </div>
    );
  }
  return (
    <div className="hero-wash">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14 grid gap-10 lg:grid-cols-[1.4fr_1fr] items-start">
        <div>
          <p className="eyebrow">Free for you · About 2 minutes to start</p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold">Start your application</h1>
          <p className="text-muted mt-2 mb-8 max-w-2xl">Tell us the loan you need, confirm your mobile, and read how we use your information. You can stop and come back any time by signing in with your mobile.</p>
          <ApplyFormClient initial={{ product }} notices={notices} loanTypes={open.map(({ id, label, minAmount, maxAmount }) => ({ id, label, minAmount, maxAmount }))} synthetic={dataMode() === "synthetic"} />
        </div>
        <aside className="space-y-4 lg:sticky lg:top-32">
          <div className="card p-5">
            <h2 className="font-bold">After you start</h2>
            <ol className="mt-3 space-y-3">
              {NEXT.map((s, i) => (
                <li key={s.t} className="flex gap-3">
                  <span className="grid place-items-center size-7 shrink-0 rounded-full bg-mint-soft text-mint-deep text-sm font-bold num">{i + 1}</span>
                  <span><b className="block text-sm">{s.t}</b><span className="text-sm text-muted">{s.d}</span></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 text-sm space-y-2">
            <p className="font-bold">Your safety</p>
            <p className="text-muted">We never charge you a fee and never ask for money, an OTP or a PIN on a call. Only the bank decides on your loan.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
