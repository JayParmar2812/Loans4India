import Link from "next/link";
import { brand } from "@/shared/config/brand";
import { LegalPage } from "@/features/public-site/components/LegalPage";
import { pageMetadata } from "@/shared/seo/metadata";

export const metadata = pageMetadata({ title: "Privacy Policy", description: `How ${brand.name} collects, uses, shares, protects and deletes your personal data, and how to use your rights.`, path: "/privacy" });

// VERIFY (Platform Flow v4, sections 41, 43, 50): retention periods, LSP classification and DPDP Rules timelines with counsel before launch.
export default function Page() {
  return (
    <LegalPage title="Privacy Policy" path="/privacy" updated="18 October 2026">
      <p>This policy explains how {brand.legalEntity} (&quot;{brand.name}&quot;, &quot;we&quot;) collects, uses and protects your personal data when you use this website and apply for a loan through us. We are a loan sourcing service (Direct Selling Agent), not a lender.</p>
      <h2>What we collect</h2>
      <ul>
        <li><b>To start:</b> loan type, amount and your mobile number (checked with a one-time code).</li>
        <li><b>Your consent:</b> the exact wording you agreed to, its version, the list of banks named, the time, your IP address and browser.</li>
        <li><b>Application details:</b> name, date of birth, address, email, employment, income, existing loans and banking details, and only the fields your loan type and the banks need.</li>
        <li><b>Identifiers:</b> your PAN, stored encrypted. We never store your Aadhaar number; we accept only masked Aadhaar copies.</li>
        <li><b>Documents:</b> the files on your checklist (for example payslips and bank statements), virus-scanned and stored encrypted.</li>
        <li><b>Technical data:</b> how you reached us (campaign tags, referral code), and security logs.</li>
      </ul>
      <p>We do not pull your credit report.</p>
      <h2>Why we use it</h2>
      <ul>
        <li>To check your application is complete and consistent, and to choose which of the partner banks you agreed to will receive it.</li>
        <li>To share your application and documents with that bank, only with your consent and only with banks named on your consent screen.</li>
        <li>To send you service messages about your application.</li>
        <li>To send you tips and offers, only if you ticked the separate, optional marketing consent. You can stop these any time.</li>
        <li>To prevent fraud, keep the service secure and meet our legal obligations.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>The partner bank or NBFC processing your application (named to you once it receives it), and service providers that help us run the platform (hosting, messaging) under contracts that protect your data. We don&apos;t sell your data. Referral partners never receive your details.</p>
      <h2>How we protect it</h2>
      <p>Encrypted connections, documents and identifiers like your PAN encrypted at rest, access limited to the staff working on your application with two-step sign-in, and a record of every view and change.</p>
      <h2>How long we keep it</h2>
      <p>Only as long as your application and the law require. After an application closes, documents and personal details are deleted on a schedule; we keep only what the law requires, such as proof of your consent and accounting records. A dispute or regulator request can pause deletion for the affected application. Data a bank received is held by that bank under its own policy.</p>
      <h2>Your rights</h2>
      <p>You can withdraw your application or your consent from your application page, and ask to see, correct or erase your data, or nominate someone to act for you, through our <Link href="/contact?type=DATA_ACCESS">data request form</Link>. We confirm your identity with a one-time code first. You can also contact our Grievance Officer: {brand.grievanceOfficer.name}, {brand.grievanceOfficer.email}.</p>
    </LegalPage>
  );
}
