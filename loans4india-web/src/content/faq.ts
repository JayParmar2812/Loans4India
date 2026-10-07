import type { FaqItem } from "@/components/Faq";
import { brand } from "@/config/brand";

export const generalFaq: FaqItem[] = [
  {
    q: `Is ${brand.name} a bank or lender?`,
    a: `No. ${brand.name} is a loan facilitation service. We prepare your application, submit it to one suitable partner bank or NBFC that you consented to, and follow up for you. The bank alone approves, sanctions and disburses your loan.`,
  },
  {
    q: "Do I have to pay anything to apply?",
    a: "No. Applying through us is free for you. Lenders may charge their own processing fees, which they will show you in the loan's Key Fact Statement before you sign. Never pay anyone upfront to 'get a loan approved'.",
  },
  {
    q: "Will checking my options affect my credit score?",
    a: "No. Our quick estimate uses only the details you enter. A lender may check your credit report when it processes your application, with your consent.",
  },
  {
    q: "What documents will I need?",
    a: "For salaried applicants: PAN, masked Aadhaar, the last 6 months' salary slips and 6 months' salary-account statement. For self-employed and business loans: PAN, masked Aadhaar, business registration (GST, Udyam or Shop Act), 2 years' ITR and 12 months' bank statements. You upload them securely in your application, and we check them before anything goes to a bank.",
  },
  {
    q: "How long does it take?",
    a: "We review your submitted application within one working day. After that, timelines depend on the bank. Many personal loans are decided within a few working days once documents are complete.",
  },
  {
    q: "How is my data protected?",
    a: "Your details are encrypted, accessed only by authorised staff, and shared only with lenders for your application, with your consent. You can ask us to stop processing your data anytime.",
  },
];
