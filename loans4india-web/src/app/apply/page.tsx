import type { Metadata } from "next";
import { ApplyFormClient } from "@/components/ApplyFormClient";
import { consentNotice } from "@/lib/consent";
import { getSiteContent } from "@/lib/siteContent.server";
import { getLiveFlow, openLoanTypes } from "@/lib/applicantFlow.server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Start your application",
  description: "Start your loan application in two minutes. Free for borrowers.",
  robots: { index: false },
};

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
      <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-violet-deep">Applications are paused</h1>
        <p className="text-lg mt-4 whitespace-pre-line">{site.applications.pausedMessage}</p>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:py-14">
      <h1 className="text-3xl sm:text-4xl font-extrabold text-violet-deep">Start your application</h1>
      <p className="text-muted mt-2 mb-8">Tell us the loan you need and your mobile number, read how we use your information, then fill in your details and upload your documents. You can stop and come back any time.</p>
      <ApplyFormClient initial={{ product }} notices={notices} loanTypes={open.map(({ id, label, minAmount, maxAmount }) => ({ id, label, minAmount, maxAmount }))} emiLink={site.tools.emiCalculator} />
    </div>
  );
}
