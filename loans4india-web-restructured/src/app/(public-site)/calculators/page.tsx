import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/features/public-site/components/PageHero";
import { CalculatorLinks } from "@/features/public-site/components/CalculatorLinks";
import { getSiteContent } from "@/features/site-control/server/siteContent.server";
import { pageMetadata } from "@/shared/seo/metadata";

export const metadata = pageMetadata({
  title: "Loan calculators: EMI, borrowing estimate, affordability, interest",
  description: "Free loan calculators: work out your EMI, a quick estimate of what you could borrow, the loan your budget repays, and the real cost of a longer tenure.",
  path: "/calculators",
});

export default async function CalculatorsHub() {
  if (!(await getSiteContent()).tools.emiCalculator) notFound();
  return (
    <>
      <PageHero
        crumbs={[{ label: "Calculators", href: "/calculators" }]}
        eyebrow="Plan before you apply"
        title="Loan calculators"
        intro="Simple, honest maths on numbers you enter. Nothing is saved and there's no credit check. Every result is an illustration: the bank sets the actual rate, fees and EMI."
      />
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-14">
        <CalculatorLinks heading={null} />
        <section className="grid gap-6 md:grid-cols-2">
          <div className="card p-6 space-y-2">
            <h2 className="text-xl font-extrabold">Which one should I use?</h2>
            <ul className="text-muted space-y-2 text-[0.95rem]">
              <li><b className="text-ink">Know the amount you need?</b> Use the <Link className="text-violet underline" href="/emi-calculator">EMI calculator</Link>.</li>
              <li><b className="text-ink">Not sure how much to ask for?</b> Try <Link className="text-violet underline" href="/calculators/how-much-can-i-borrow">How much can I borrow?</Link> or the <Link className="text-violet underline" href="/calculators/affordability">affordability calculator</Link>.</li>
              <li><b className="text-ink">Choosing a tenure?</b> The <Link className="text-violet underline" href="/calculators/interest">interest calculator</Link> shows what a longer loan really costs.</li>
            </ul>
          </div>
          <div className="card p-6 space-y-2">
            <h2 className="text-xl font-extrabold">What the numbers don&apos;t include</h2>
            <p className="text-muted text-[0.95rem]">
              Banks may charge processing fees, insurance and other charges, and set your rate from their own assessment. Before you accept a loan,
              the bank must give you a Key Fact Statement with the rate, all fees and the APR (the all-in yearly cost). Compare that, not just the EMI.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
