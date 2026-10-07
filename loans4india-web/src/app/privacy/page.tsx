import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function Page() {
  return (
    <LegalPage title="Privacy Policy" updated="2 October 2026">
      <p>This policy explains how {brand.legalEntity} (&quot;{brand.name}&quot;, &quot;we&quot;) collects and uses your personal data when you use this website and apply for a loan through us.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Details you enter: name, mobile number, email, city, PIN code, employment, income, existing EMIs and loan requirement.</li>
        <li>Your consent choices, with the time and the exact wording you agreed to.</li>
        <li>Technical data: IP address, browser type, pages visited and how you reached us (e.g. campaign tags).</li>
      </ul>
      <h2>Why we use it</h2>
      <ul>
        <li>To assess which loan products may suit you and prepare your application.</li>
        <li>To share your application with banks or NBFCs for processing, only with your consent.</li>
        <li>To contact you about your application.</li>
        <li>To send offers and tips, only if you opted in.</li>
      </ul>
      <h2>Who we share it with</h2>
      <p>Only with the lenders processing your application and with service providers who help us operate (hosting, communication), under contract. We do not sell your data.</p>
      <h2>How long we keep it</h2>
      <p>For as long as needed for your application and as required by law or our lender agreements, after which it is deleted or anonymised.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct or erase your data, withdraw consent, or raise a grievance by writing to {brand.grievanceOfficer.email}.</p>
    </LegalPage>
  );
}
