import { notFound } from "next/navigation";
import { PageBlocks } from "@/components/PageBlocks";
import { can } from "@/lib/rbac";
import { currentStaff } from "@/lib/staff.server";
import { getSiteContent } from "@/lib/siteContent.server";

export const metadata = { title: "Page preview" };

/** Staff-only view of a saved page, including drafts that aren't on the public site yet. */
export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await currentStaff();
  if (!user || !can(user, "site.manage")) notFound();
  const { slug } = await params;
  const page = (await getSiteContent()).pages.find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <div className="rounded-3xl border-2 border-dashed border-violet bg-canvas">
      <p className="px-4 pt-3 text-sm text-violet font-semibold">
        Preview of /{page.slug} · {page.published ? "published" : "draft, not on the public site"}
      </p>
      <PageBlocks page={page} />
    </div>
  );
}
