import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { ArticleView } from "@/features/cms/components/ArticleView";
import { articleDataSchema } from "@/features/cms/domain/article";

export const metadata = { title: "Guide preview", robots: { index: false, follow: false } };

/** Staff-only preview of the working draft, at phone width or full width, exactly as the public page renders it. */
export default async function GuidePreview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const user = await currentStaff();
  if (!user || !(can(user, "content.edit") || can(user, "content.publish"))) notFound();
  const { id } = await params;
  const phone = (await searchParams).w === "phone";
  const a = await prisma.article.findUnique({ where: { id } });
  const rev = a?.draftRevisionId ? await prisma.articleRevision.findUnique({ where: { id: a.draftRevisionId } }) : null;
  if (!a || !rev) notFound();
  const parsed = articleDataSchema.safeParse(JSON.parse(rev.data));
  if (!parsed.success) return <p className="text-danger">This draft doesn&apos;t match the current format. Open it in the editor and save it again.</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/admin/content/${a.id}`} className="text-violet underline">← Back to the editor</Link>
        <span className="text-muted">Preview of draft v{rev.version}. Not public.</span>
        <span className="ml-auto flex gap-1">
          <Link href="?w=phone" className={`chip ${phone ? "bg-violet text-white" : "bg-violet-soft text-violet-deep"}`}>Phone (360px)</Link>
          <Link href="?" className={`chip ${!phone ? "bg-violet text-white" : "bg-violet-soft text-violet-deep"}`}>Full width</Link>
        </span>
      </div>
      <div className={`mx-auto rounded-3xl border-2 border-dashed border-violet bg-white overflow-hidden ${phone ? "max-w-[360px]" : ""}`}>
        <ArticleView slug={a.slug} data={parsed.data} publishedAt={a.publishedAt} updatedAt={rev.createdAt} preview />
      </div>
    </div>
  );
}
