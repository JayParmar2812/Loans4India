import type { Metadata } from "next";
import { EmiCalculator } from "@/components/EmiCalculator";
import { EligibilityCalculator } from "@/components/EligibilityCalculator";
import { notFound } from "next/navigation";
import { getSiteContent } from "@/lib/siteContent.server";

export const metadata: Metadata = {
  title: "EMI Calculator & Loan Estimate",
  description: "Calculate your loan EMI, total interest and a quick estimate of how much you could borrow. Indicative only, never an approval.",
};

export default async function Page() {
  if (!(await getSiteContent()).tools.emiCalculator) notFound();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 space-y-16">
      <section>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-violet-deep">EMI Calculator</h1>
        <p className="text-muted mt-2 max-w-2xl">See your monthly instalment, total interest and total repayment for any loan amount, rate and tenure.</p>
        <div className="mt-8"><EmiCalculator /></div>
      </section>
      <section id="eligibility" className="scroll-mt-24">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-violet-deep">How much can I borrow?</h2>
        <p className="text-muted mt-2 max-w-2xl">A quick estimate based on your income and the EMIs you already pay.</p>
        <div className="mt-8"><EligibilityCalculator /></div>
      </section>
      <section className="max-w-3xl space-y-3 text-muted">
        <h2 className="text-2xl font-extrabold text-ink">How EMI is calculated</h2>
        <p>EMI = P × r × (1 + r)<sup>n</sup> ÷ ((1 + r)<sup>n</sup> − 1), where P is the loan amount, r is the monthly interest rate (annual rate ÷ 12 ÷ 100) and n is the number of months.</p>
        <p>Example: ₹3,00,000 at 13.5% for 3 years gives an EMI of about ₹10,180 and total interest of about ₹66,500.</p>
      </section>
    </div>
  );
}
