import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { getLiveFlow } from "@/features/applicant-flow/server/applicantFlow.server";
import { BANKS, consentBanks } from "@/features/bank-submission/config/banks";
import { FlowEditor } from "@/features/applicant-flow/components/FlowEditor";
import { SiteTabs } from "@/features/site-control/components/SiteTabs";

export const metadata = { title: "Application flow" };

/** The master admin's Application flow screen: loan types, form fields, extra questions and document checklists. */
export default async function FlowPage() {
  const user = await currentStaff();
  if (!user || !can(user, "site.manage")) notFound();
  const [live, rows, counts] = await Promise.all([
    getLiveFlow(),
    prisma.applicantFlowVersion.findMany({ orderBy: { id: "desc" }, take: 30, select: { id: true, note: true, createdBy: true, createdAt: true } }),
    prisma.loanApplication.groupBy({ by: ["product"], _count: { _all: true } }),
  ]);
  const versions = rows.map((r, i) => ({ ...r, createdAt: r.createdAt.toISOString(), live: i === 0 }));
  const banks = BANKS.map((b) => ({ id: b.id, name: b.name, status: b.status, usable: consentBanks([b.id]).length > 0 }));
  const inUse = Object.fromEntries(counts.map((c) => [c.product, c._count._all]));
  return (
    <div className="space-y-4">
      <SiteTabs current="flow" />
      <div>
        <h1 className="text-2xl font-extrabold text-violet-deep">Application flow</h1>
        <p className="text-muted text-sm max-w-3xl">
          Choose the loan types people can apply for, which partner banks cover each one, what the application form asks and which documents it needs.
          Saving applies to new applications straight away. Applications already started keep the form and checklist they began with.
          The core identity fields, PAN and masked Aadhaar, and the consent screen stay fixed.
        </p>
      </div>
      <FlowEditor initial={live.flow} versions={versions} banks={banks} inUse={inUse} />
    </div>
  );
}
