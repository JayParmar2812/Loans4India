import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { currentStaff } from "@/lib/staff.server";
import { getSiteContent } from "@/lib/siteContent.server";
import { SiteEditor } from "@/components/admin/SiteEditor";
import { SiteTabs } from "@/components/admin/SiteTabs";

export const metadata = { title: "Website" };

/** The master admin's Website screen: what the public site shows, and its saved versions. */
export default async function SitePage() {
  const user = await currentStaff();
  if (!user || !can(user, "site.manage")) notFound();
  const [content, rows, assets] = await Promise.all([
    getSiteContent(),
    prisma.siteContentVersion.findMany({ orderBy: { id: "desc" }, take: 30, select: { id: true, note: true, createdBy: true, createdAt: true } }),
    prisma.siteAsset.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, alt: true } }),
  ]);
  const versions = rows.map((r, i) => ({ ...r, createdAt: r.createdAt.toISOString(), live: i === 0 }));
  return (
    <div className="space-y-4">
      <SiteTabs current="content" />
      <div>
        <h1 className="text-2xl font-extrabold text-violet-deep">Website</h1>
        <p className="text-muted text-sm max-w-3xl">
          Change what the public site shows. Saving publishes straight away and is recorded in Activity; every save is kept in History so you can put an older version back.
          The &quot;not a lender&quot; notices, the consent screen and the legal pages stay fixed.
        </p>
      </div>
      <SiteEditor initial={content} versions={versions} images={assets} />
    </div>
  );
}
