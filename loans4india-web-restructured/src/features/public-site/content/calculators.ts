import type { IconName } from "@/shared/ui/Icon";

/** The calculator pages: one entry each, used by the hub, the sitemap and the "other calculators" links. */
export const CALCULATORS: { href: string; title: string; short: string; description: string; icon: IconName }[] = [
  {
    href: "/emi-calculator",
    title: "EMI calculator",
    short: "Monthly instalment, total interest and a year-by-year breakdown.",
    description: "Work out the monthly EMI, total interest and total repayment for any loan amount, interest rate and tenure, with a year-by-year breakdown.",
    icon: "calculator",
  },
  {
    href: "/calculators/how-much-can-i-borrow",
    title: "How much can I borrow?",
    short: "A quick indicative estimate from your income and current EMIs.",
    description: "A quick, indicative estimate of how much you could borrow from your monthly income and the EMIs you already pay. Not an approval.",
    icon: "rupee",
  },
  {
    href: "/calculators/affordability",
    title: "Affordability calculator",
    short: "Start from the EMI you can pay; see the loan it repays.",
    description: "Start from the monthly EMI you can comfortably pay and see the loan amount it repays at the rate and tenure you choose.",
    icon: "chart",
  },
  {
    href: "/calculators/interest",
    title: "Interest & tenure calculator",
    short: "See how tenure changes your EMI and the total interest you pay.",
    description: "Compare the EMI and total interest on the same loan across tenures from 1 to 7 years, to see the real cost of a longer loan.",
    icon: "clock",
  },
];
