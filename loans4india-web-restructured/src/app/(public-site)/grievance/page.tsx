import Link from "next/link";
import { brand } from "@/shared/config/brand";
import { LegalPage } from "@/features/public-site/components/LegalPage";
import { pageMetadata } from "@/shared/seo/metadata";

export const metadata = pageMetadata({ title: "Grievance Redressal", description: `How to raise a complaint with ${brand.name}, response times, our Grievance Officer, and where to go if it isn't resolved.`, path: "/grievance" });

// Platform Flow v4, section 41: acknowledge in 1 day, resolve in 15 (proposed defaults; VERIFY with counsel).
export default function Page() {
  return (
    <LegalPage title="Grievance Redressal" path="/grievance" updated="18 October 2026">
      <p>If you&apos;re unhappy with our service, we want to know and to put it right. Every complaint gets a ticket number, and we always tell you the outcome.</p>
      <h2>Level 1: Customer support</h2>
      <p><Link href="/contact?type=COMPLAINT">Raise a complaint</Link> or email {brand.supportEmail} with your application reference. We acknowledge within 1 working day and aim to resolve within 15 days.</p>
      <h2>Level 2: Grievance Officer</h2>
      <p>If it isn&apos;t resolved, or you&apos;re not satisfied, write to our Grievance Officer: {brand.grievanceOfficer.name}, {brand.grievanceOfficer.email}, quoting your ticket number.</p>
      <h2>If it&apos;s still not resolved</h2>
      <ul>
        <li><b>About a bank&apos;s decision, loan terms, sanction, disbursement or recovery:</b> these are handled by the lending bank or NBFC through its own grievance process. If the bank doesn&apos;t resolve it within 30 days, you can approach the RBI Integrated Ombudsman through the RBI&apos;s Complaint Management System (cms.rbi.org.in).</li>
        <li><b>About your personal data:</b> you can approach the Data Protection Board of India once your complaint has been through our process.</li>
      </ul>
    </LegalPage>
  );
}
