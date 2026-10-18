import { AffordabilityCalculator } from "@/features/public-site/components/calculators/AffordabilityCalculator";
import { CalculatorPage } from "@/features/public-site/components/CalculatorPage";
import { CALCULATORS } from "@/features/public-site/content/calculators";
import { pageMetadata } from "@/shared/seo/metadata";

const meta = CALCULATORS[2];
export const metadata = pageMetadata({ title: "Loan affordability calculator: what does my EMI budget repay?", description: meta.description, path: meta.href });

export default function Page() {
  return (
    <CalculatorPage
      path={meta.href}
      title="Affordability calculator"
      intro="Start with the monthly EMI you can comfortably pay, then see the loan amount it repays at the rate and tenure you choose."
      description={meta.description}
      tool={<AffordabilityCalculator />}
      explainer={
        <>
          <h2>Setting a comfortable EMI</h2>
          <p>
            List your fixed monthly costs (rent, school fees, insurance, existing EMIs) and keep a buffer for emergencies. The EMI you can pay every month without strain,
            even in a tight month, is your budget. Many people aim to keep all EMIs together under about half of take-home pay; lower is safer.
          </p>
          <h2>Reading the result</h2>
          <p>The loan shown is what that EMI repays at the rate and tenure you set, rounded down. A higher rate or a shorter tenure means a smaller loan for the same EMI.</p>
        </>
      }
    />
  );
}
