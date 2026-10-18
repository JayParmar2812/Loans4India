import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { actorOf, currentStaff } from "@/features/staff/server/staff.server";
import { ActionForm } from "@/features/case-management/components/ActionForm";
import { guideWorkflow } from "@/features/cms/actions/content.actions";
import { ArticleEditor } from "@/features/cms/components/ArticleEditor";
import { ARTICLE_STATUSES, articleDataSchema, emptyArticle, type ArticleData } from "@/features/cms/domain/article";

export const metadata = { title: "Edit guide" };

const ist = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

export default async function EditGuide({ params }: { params: Promise<{ id: string }> }) {
  const user = await currentStaff();
  if (!user || !(can(user, "content.edit") || can(user, "content.publish"))) notFound();
  const { id } = await params;
  const a = await prisma.article.findUnique({ where: { id }, include: { revisions: { orderBy: { version: "desc" } } } });
  if (!a) notFound();
  const draft = a.revisions.find((r) => r.id === a.draftRevisionId) ?? a.revisions[0];
  const parsed = draft ? articleDataSchema.safeParse(JSON.parse(draft.data)) : null;
  const data: ArticleData = parsed?.success ? parsed.data : emptyArticle(a.slug);
  const live = a.revisions.find((r) => r.id === a.liveRevisionId);
  const [assets, others] = await Promise.all([
    prisma.siteAsset.findMany({ where: { deletedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, name: true } }),
    prisma.article.findMany({ where: { id: { not: a.id }, liveRevisionId: { not: null } }, select: { slug: true, revisions: { orderBy: { version: "desc" }, take: 1, select: { data: true } } } }),
  ]);
  const guides = others.map((o) => ({ slug: o.slug, title: (JSON.parse(o.revisions[0]?.data ?? "{}") as { title?: string }).title ?? o.slug }));
  const me = actorOf(user);
  const canPublish = can(user, "content.publish");
  const authoredByMe = draft?.createdBy === me || a.reviewRequestedBy === me;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_360px] items-start">
      <div className="space-y-4">
        <Link href="/admin/content" className="text-sm text-violet underline">← All guides</Link>
        <h1 className="text-2xl font-extrabold">{data.title || a.slug}</h1>
        <ArticleEditor id={a.id} slug={a.slug} initial={data} assets={assets} guides={guides} readOnly={!can(user, "content.edit") || a.status === "IN_REVIEW"} />
        {a.status === "IN_REVIEW" && can(user, "content.edit") && <p className="text-sm text-muted">Editing is locked while this draft waits for approval. The approver can send it back.</p>}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-32">
        <section className="card p-5 space-y-3 text-sm">
          <h2 className="font-bold text-base">Status</h2>
          <p>Draft: <b>{ARTICLE_STATUSES[a.status as keyof typeof ARTICLE_STATUSES] ?? a.status}</b>{draft ? ` (v${draft.version})` : ""}</p>
          <p>Public: {live ? <b>v{live.version}{a.publishAt && a.publishAt > new Date() ? `, scheduled for ${ist(a.publishAt)}` : ` since ${a.publishedAt ? ist(a.publishedAt) : ""}`}</b> : <span className="text-muted">not public</span>}</p>
          {live && <p><Link href={`/guides/${a.slug}`} className="text-violet underline" target="_blank">View public page ↗</Link></p>}
          <p><Link href={`/admin/content/${a.id}/preview`} className="text-violet underline">Preview the draft (mobile and desktop)</Link></p>
        </section>

        {can(user, "content.edit") && a.status !== "IN_REVIEW" && a.draftRevisionId !== a.liveRevisionId && (
          <section className="card p-5 space-y-2">
            <h2 className="font-bold">Ready?</h2>
            <p className="text-sm text-muted">Save your changes first, then send them for approval. The checks run again on approval.</p>
            <ActionForm action={guideWorkflow} hidden={{ id: a.id }} buttons={[{ label: "Send for approval", value: "submit" }]} />
          </section>
        )}

        {canPublish && a.status === "IN_REVIEW" && (
          <section className="card p-5 space-y-3 border-warn/40">
            <h2 className="font-bold">Approval</h2>
            {authoredByMe ? (
              <p className="text-sm text-muted">You wrote or submitted this draft, so someone else must approve it.</p>
            ) : (
              <>
                <ActionForm action={guideWorkflow} hidden={{ id: a.id }} buttons={[{ label: "Approve and publish", value: "publish", tone: "ok" }]} className="space-y-2">
                  <label className="block text-sm"><span className="field-label">Schedule (optional, IST)</span><input type="datetime-local" name="publishAt" className="field-input" /></label>
                </ActionForm>
                <ActionForm action={guideWorkflow} hidden={{ id: a.id }} buttons={[{ label: "Send back", value: "sendBack", tone: "ghost" }]}>
                  <textarea name="reason" rows={2} className="field-input" placeholder="What needs changing?" />
                </ActionForm>
              </>
            )}
          </section>
        )}

        {canPublish && live && (
          <section className="card p-5 space-y-2">
            <h2 className="font-bold">Take down</h2>
            <ActionForm action={guideWorkflow} hidden={{ id: a.id }} confirm="Take this guide off the public site?" buttons={[{ label: "Unpublish", value: "unpublish", tone: "danger" }]} />
          </section>
        )}

        {(can(user, "content.edit") && !live) || (canPublish && live) ? (
          <section className="card p-5 space-y-2">
            <h2 className="font-bold">Address</h2>
            <ActionForm action={guideWorkflow} hidden={{ id: a.id }} buttons={[{ label: "Change address", value: "rename", tone: "ghost" }]}>
              <input name="slug" defaultValue={a.slug} className="field-input font-mono text-sm" maxLength={80} aria-label="New address" />
              {live && <p className="text-xs text-muted">The old address will redirect permanently to the new one.</p>}
            </ActionForm>
          </section>
        ) : null}

        <section className="card p-5 space-y-2 text-sm">
          <h2 className="font-bold text-base">History</h2>
          <ul className="space-y-2 max-h-80 overflow-y-auto">
            {a.revisions.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-2 border-b border-line pb-2 last:border-0">
                <span>
                  <b>v{r.version}</b>{r.id === a.liveRevisionId && <span className="chip bg-mint-soft text-mint-ink ml-1">live</span>}{r.id === a.draftRevisionId && <span className="chip bg-violet-soft text-violet-deep ml-1">draft</span>}
                  <span className="block text-xs text-muted">{r.createdBy.replace("staff:", "")} · {ist(r.createdAt)}{r.note ? ` · ${r.note}` : ""}</span>
                </span>
                {can(user, "content.edit") && r.id !== a.draftRevisionId && a.status !== "IN_REVIEW" && (
                  <ActionForm action={guideWorkflow} hidden={{ id: a.id, revisionId: r.id }} buttons={[{ label: "Restore", value: "restore", tone: "ghost" }]} className="shrink-0" />
                )}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
