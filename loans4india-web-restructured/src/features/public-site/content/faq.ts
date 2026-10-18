import type { FaqItem } from "@/features/public-site/components/Faq";
import { brand } from "@/shared/config/brand";

/**
 * The FAQ hub (/faq). Wording follows Platform Flow v4's language rules (section 10):
 * never "approved", "eligible" or "pre-approved"; no rates, turnaround promises or fees from the applicant.
 * VERIFY: legal review of the consent, data-rights and retention answers before launch.
 */
export const FAQ_TOPICS: { id: string; title: string; items: FaqItem[] }[] = [
  {
    id: "about",
    title: `About ${brand.name}`,
    items: [
      { q: `Is ${brand.name} a bank or lender?`, a: `No. ${brand.name} is a loan sourcing service (a Direct Selling Agent) working under agreements with banks and NBFCs. We prepare your application, submit it to one suitable partner bank from the list you agree to, and follow it up. The bank alone checks, decides, sanctions and disburses the loan.` },
      { q: "Do I pay anything to apply?", a: "No. We never charge you a fee, at any stage. Banks may have their own charges, which they must show you in their Key Fact Statement before you sign. If anyone asks you for money in our name, it is fraud: please report it to us." },
      { q: `How does ${brand.name} earn money?`, a: "When a bank disburses a loan we sourced, the bank pays us a commission under our agreement with it. You never pay us." },
      { q: "Which banks do you work with?", a: "We name each partner bank on this website and on the consent screen once our agreement with it is signed. Until then we don't show bank names or logos." },
    ],
  },
  {
    id: "applying",
    title: "Applying",
    items: [
      { q: "What do I need to start?", a: "Your loan type, the amount and your mobile number. We send a one-time code to check the number is yours, show you exactly how we'll use your information, and only then ask for your other details." },
      { q: "Can I stop and finish later?", a: "Yes. Your details save as you go. Come back any time and sign in with your mobile number and a one-time code." },
      { q: "How long does it take?", a: "Starting takes a couple of minutes. After you submit, our team aims to begin reviewing within one working day. Once your file is with the bank, the timeline depends on the bank's own checks." },
      { q: "Can I choose the bank?", a: "You agree to a list of partner banks on the consent screen. From that list our team picks one bank that suits your file, records why, and tells you its name once the application is submitted to it. If that bank declines for a reason another bank might see differently, we may try one more bank from the same list." },
      { q: "Can I withdraw my application?", a: "Yes, any time, from your application page. If it has already gone to a bank, we also ask the bank to stop processing it." },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    items: [
      { q: "Which documents will I need?", a: "Usually PAN, masked Aadhaar, income proof (salary slips, or ITR for self-employed) and recent bank statements. Business loans also need business registration and financial statements. Your application shows the exact checklist for your loan type." },
      { q: "What is a masked Aadhaar and why do you need it masked?", a: "A masked Aadhaar shows only the last 4 digits of the number; you can download it from the UIDAI website. We never store your full Aadhaar number and we don't do Aadhaar authentication; the bank completes KYC itself." },
      { q: "What file types can I upload?", a: "PDF, JPG or PNG, up to 10 MB each. If your bank statement PDF is password-protected, download a copy without a password (or use Print → Save as PDF) and upload that." },
      { q: "Is uploading safe?", a: "Every file is checked for its real type and scanned for viruses, then stored encrypted. Only authorised staff working on your application can view it, and every view is recorded." },
    ],
  },
  {
    id: "data",
    title: "Your data and consent",
    items: [
      { q: "What am I agreeing to on the consent screen?", a: "That we may process your application, share it and your documents only with the partner banks named on that screen for this loan, and send you service messages about it. Marketing messages are a separate, optional tick that is never pre-ticked." },
      { q: "Do you check my credit score?", a: `No. ${brand.name} never pulls credit reports. The bank does its own credit checks when it processes your application.` },
      { q: "Can I withdraw my consent?", a: "Yes, from your application page. We stop processing straight away and close the application. Messages the law requires (for example, confirming your withdrawal) still reach you." },
      { q: "Can I see, correct or delete my data?", a: "Yes. Send a data request from the Contact page; we confirm it's you with a one-time code and respond within the time the law allows. Data a bank already received is held by that bank, and we tell you how to ask it." },
      { q: "How long do you keep my data?", a: "Only as long as your application and the law need it. After an application closes, personal data is deleted on a schedule, keeping only records the law requires (such as proof of consent). Details are in our Privacy Policy." },
    ],
  },
  {
    id: "decisions",
    title: "Bank decisions",
    items: [
      { q: "Who decides whether I get the loan?", a: `Only the bank. ${brand.name} checks that your file is complete and consistent before it goes out, but that is not a credit decision.` },
      { q: "Will you tell me my interest rate?", a: "We don't quote or promise rates. The bank sets your rate. Before you accept a loan, it must give you a Key Fact Statement showing the rate, all fees and the APR (the all-in yearly cost)." },
      { q: "What if the bank says no?", a: "We tell you in plain words. If the reason is specific to that bank, we may submit to one more bank from the list you agreed to. Questions about a bank's decision go to that bank's grievance team." },
    ],
  },
];

/** A short set for the home page. */
export const generalFaq: FaqItem[] = [FAQ_TOPICS[0].items[0], FAQ_TOPICS[0].items[1], FAQ_TOPICS[1].items[2], FAQ_TOPICS[3].items[1]];
