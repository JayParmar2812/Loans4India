import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "About us" };

export default function Page() {
  return (
    <LegalPage title={`About ${brand.name}`} updated="2 October 2026">
      <p>{brand.name} helps people across India find the right loan without applying at ten different places. You tell us what you need once; we work out which banks and NBFCs suit your profile, help you prepare your application, and follow up until the lender decides.</p>
      <h2>What we are, and what we are not</h2>
      <p>We are a Direct Selling Agent (DSA) and loan facilitation service. We are not a bank or NBFC: we do not lend money, decide on loans, or collect repayments. Every loan is approved and disbursed by the lender, directly into your bank account.</p>
      <h2>How we earn</h2>
      <p>Lenders pay us a commission when a loan we facilitated is disbursed. You do not pay us anything to apply.</p>
    </LegalPage>
  );
}
