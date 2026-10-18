import { QuickEstimate } from "@/features/public-site/components/calculators/QuickEstimate";
import { CalculatorPage } from "@/features/public-site/components/CalculatorPage";
import { CALCULATORS } from "@/features/public-site/content/calculators";
import { ELIGIBILITY_ASSUMPTIONS as A } from "@/features/public-site/domain/finance";
import { pageMetadata } from "@/shared/seo/metadata";

const meta = CALCULATORS[1];
export const metadata = pageMetadata({ title: "How much can I borrow? Quick loan estimate", description: meta.description, path: meta.href });

export default function Page() {
  return (
    <CalculatorPage
      path={meta.href}
      title="How much can I borrow?"
      intro="A quick, indicative estimate from your income and the EMIs you already pay. It is not a credit check and not an approval: only the bank decides."
      description={meta.description}
      tool={<QuickEstimate />}
      explainer={
        <>
          <h2>How the estimate works</h2>
          <p>
            Banks look at how much of your monthly income already goes to EMIs (often called FOIR, the fixed obligations to income ratio). This estimate assumes up to {A.foir * 100}% of
            your take-home income can go to all EMIs together. Whatever is left after your current EMIs is the most a new EMI could be, and we work out the loan that EMI repays at {A.annualRatePct}% a year over {A.tenureMonths / 12} years,
            then round down to the nearest ₹10,000.
          </p>
          <h2>Why a bank may decide differently</h2>
          <p>Each bank applies its own rules: your credit history, employer, city, job stability and the documents you provide all matter. That&apos;s why this is an estimate and why we never show it as an offer.</p>
        </>
      }
      faq={[
        { q: "Does this affect my credit score?", a: "No. It's arithmetic on the numbers you type. Nothing is saved and no credit report is pulled. Loans4India never pulls credit reports; a bank may check yours, with your consent, when it processes an application." },
        { q: "Can I apply for more than the estimate?", a: "Yes. You choose the amount when you apply. The bank decides what it can lend." },
      ]}
    />
  );
}
