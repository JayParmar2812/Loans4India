import Link from "next/link";
import { brand } from "@/shared/config/brand";
import { LegalPage } from "@/features/public-site/components/LegalPage";
import { pageMetadata } from "@/shared/seo/metadata";

export const metadata = pageMetadata({ title: "About us", description: `${brand.name} is a loan sourcing service: we prepare your application and submit it to one suitable partner bank. Not a lender. No fee from you.`, path: "/about" });

export default function Page() {
  return (
    <LegalPage title={`About ${brand.name}`} path="/about" updated="18 October 2026">
      <p>{brand.name} helps people across India apply for a loan once, properly, instead of filling in the same forms on many lender websites. We check your file carefully and submit it to one suitable partner bank or NBFC from the list you agree to, then keep you informed until the bank decides.</p>
      <h2>What we are, and what we are not</h2>
      <p>We are a Direct Selling Agent (DSA): a loan sourcing company working under agreements with banks and NBFCs. We are not a bank or NBFC. We do not lend money, decide on loans, set rates or collect repayments. Every loan is assessed, approved and disbursed by the lender.</p>
      <h2>How we earn</h2>
      <p>When a bank disburses a loan we sourced, the bank pays us a commission. You never pay us anything.</p>
      <h2>How we work</h2>
      <p>Clear consent naming the banks, documents stored encrypted, a named person reviewing each application, a second person approving every submission, and only bank-confirmed updates shown to you. <Link href="/how-it-works">See every step</Link>.</p>
    </LegalPage>
  );
}
