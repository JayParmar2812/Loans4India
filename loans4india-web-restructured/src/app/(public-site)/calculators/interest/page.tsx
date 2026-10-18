import { InterestCalculator } from "@/features/public-site/components/calculators/InterestCalculator";
import { CalculatorPage } from "@/features/public-site/components/CalculatorPage";
import { CALCULATORS } from "@/features/public-site/content/calculators";
import { pageMetadata } from "@/shared/seo/metadata";

const meta = CALCULATORS[3];
export const metadata = pageMetadata({ title: "Loan interest calculator: compare tenures and total interest", description: meta.description, path: meta.href });

export default function Page() {
  return (
    <CalculatorPage
      path={meta.href}
      title="Interest & tenure calculator"
      intro="The same loan costs more the longer you take to repay it. Compare the EMI and total interest across tenures side by side."
      description={meta.description}
      tool={<InterestCalculator />}
      explainer={
        <>
          <h2>Reducing balance, not flat rate</h2>
          <p>
            Most retail loans from banks charge interest on the reducing balance: each month&apos;s interest is on what you still owe. Some offers quote a &quot;flat&quot; rate on the original amount,
            which looks lower but costs more. The bank&apos;s Key Fact Statement shows the APR, which lets you compare loans fairly.
          </p>
          <h2>Ways to pay less interest</h2>
          <ul>
            <li>Choose the shortest tenure whose EMI you can comfortably manage.</li>
            <li>Prepay when you can, after checking the bank&apos;s prepayment charges.</li>
            <li>Borrow only what you need.</li>
          </ul>
        </>
      }
    />
  );
}
