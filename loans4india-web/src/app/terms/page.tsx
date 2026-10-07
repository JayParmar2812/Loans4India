import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Use" };

export default function Page() {
  return (
    <LegalPage title="Terms of Use" updated="2 October 2026">
      <p>By using this website you agree to these terms.</p>
      <h2>Our role</h2>
      <p>{brand.name} is a loan facilitation service. We do not lend. Any loan is a contract between you and the lender, on the lender&apos;s terms.</p>
      <h2>Estimates are not offers</h2>
      <p>Eligibility amounts, EMIs and interest rates shown on this website are indicative illustrations. They are not loan offers, approvals or commitments by us or any lender.</p>
      <h2>Your information</h2>
      <p>You agree that the information you provide is true and complete. Providing false information may lead to rejection and may be reported where required by law.</p>
      <h2>No fees for facilitation</h2>
      <p>We do not charge borrowers to facilitate a loan. If anyone asks you for money claiming to be from {brand.name}, report it to {brand.supportEmail}.</p>
    </LegalPage>
  );
}
