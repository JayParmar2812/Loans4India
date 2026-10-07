import type { Metadata } from "next";
import { brand } from "@/config/brand";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Grievance Redressal" };

export default function Page() {
  return (
    <LegalPage title="Grievance Redressal" updated="2 October 2026">
      <p>If you are unhappy with our service, we want to fix it.</p>
      <h2>Step 1: Customer support</h2>
      <p>Email {brand.supportEmail} with your application reference number. We aim to respond within 2 working days.</p>
      <h2>Step 2: Grievance Officer</h2>
      <p>If unresolved within 7 days, write to our Grievance Officer: {brand.grievanceOfficer.name}, {brand.grievanceOfficer.email}. We will resolve your complaint within 30 days.</p>
      <h2>Complaints about a loan</h2>
      <p>Complaints about a loan&apos;s terms, sanction, disbursement or recovery are handled by the lending bank or NBFC through its grievance process. If not resolved within 30 days, you may approach the RBI Ombudsman through the Complaint Management System at cms.rbi.org.in.</p>
    </LegalPage>
  );
}
