import { brand } from "@/shared/config/brand";
import { LegalPage } from "@/features/public-site/components/LegalPage";
import { pageMetadata } from "@/shared/seo/metadata";

export const metadata = pageMetadata({ title: "Terms of Use", description: `The terms for using the ${brand.name} website and loan sourcing service.`, path: "/terms" });

export default function Page() {
  return (
    <LegalPage title="Terms of Use" path="/terms" updated="18 October 2026">
      <p>By using this website you agree to these terms.</p>
      <h2>Our role</h2>
      <p>{brand.name} is a loan sourcing service (Direct Selling Agent) for partner banks and NBFCs. We do not lend, approve, sanction or set rates. Any loan is a contract between you and the lender, on the lender&apos;s terms.</p>
      <h2>Estimates are not offers</h2>
      <p>Estimates, EMIs and interest figures on this website are illustrations from the numbers you enter. They are not loan offers, approvals or commitments by us or any lender.</p>
      <h2>Your information</h2>
      <p>You agree that the information and documents you provide are true, complete and your own. Providing false information may lead to your application being closed and may be reported where the law or our bank agreements require it.</p>
      <h2>No fees</h2>
      <p>We never charge borrowers. If anyone asks you for money, an OTP or a PIN in our name, don&apos;t pay or share it, and report it to {brand.supportEmail}.</p>
      <h2>Using the site fairly</h2>
      <p>Don&apos;t try to access other people&apos;s applications, disrupt the service or use automated tools to submit applications.</p>
    </LegalPage>
  );
}
