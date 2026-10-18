import { EmiCalculator } from "@/features/public-site/components/EmiCalculator";
import { CalculatorPage } from "@/features/public-site/components/CalculatorPage";
import { CALCULATORS } from "@/features/public-site/content/calculators";
import { pageMetadata } from "@/shared/seo/metadata";
import { emiBreakdown } from "@/features/public-site/domain/finance";
import { formatINR } from "@/shared/utils/format";

const meta = CALCULATORS[0];
export const metadata = pageMetadata({ title: "EMI Calculator: monthly instalment and total interest", description: meta.description, path: meta.href });

// Worked example computed from the same formula the calculator uses, so the page never disagrees with the tool.
const ex = emiBreakdown(300000, 13.5, 36);

export default function Page() {
  return (
    <CalculatorPage
      path={meta.href}
      title="EMI calculator"
      intro="See the monthly instalment, total interest and total repayment for any loan amount, rate and tenure, and how each year splits between interest and principal."
      description={meta.description}
      tool={<EmiCalculator />}
      explainer={
        <>
          <h2>How EMI is calculated</h2>
          <p>
            EMI = P × r × (1 + r)<sup>n</sup> ÷ ((1 + r)<sup>n</sup> − 1), where P is the loan amount, r is the monthly interest rate (annual rate ÷ 12 ÷ 100) and n is the number of monthly instalments.
          </p>
          <p>
            Example: {formatINR(300000)} at 13.5% a year for 3 years gives an EMI of about {formatINR(ex.emi)}, total interest of about {formatINR(ex.totalInterest)} and a total repayment of about {formatINR(ex.totalPayable)}.
          </p>
          <h2>Why early EMIs are mostly interest</h2>
          <p>Interest is charged on the balance you still owe. At the start the balance is highest, so more of each EMI goes to interest; as the balance falls, more goes to repaying the loan itself. Open the year-by-year breakdown to see it.</p>
        </>
      }
      faq={[
        { q: "Is the EMI shown here what the bank will charge?", a: "No. It's an illustration from the rate you enter. The bank sets your actual rate from its own assessment, and may add fees. Its Key Fact Statement shows the final EMI, fees and APR before you accept." },
        { q: "Does a lower EMI mean a cheaper loan?", a: "Not always. Stretching the tenure lowers the EMI but increases the total interest you pay. Use the interest calculator to compare tenures." },
      ]}
    />
  );
}
