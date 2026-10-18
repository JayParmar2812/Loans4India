import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { ActionForm } from "@/features/case-management/components/ActionForm";
import { createGuide } from "@/features/cms/actions/content.actions";
import { ARTICLE_STATUSES } from "@/features/cms/domain/article";

export const metadata = { title: "Guides" };

/** Guides and articles: the editorial queue (CMS). */
export default async function ContentPage() {
  const user = await currentStaff();
  if (!user || !(can(user, "content.edit") || can(user, "content.publish"))) notFound();
  const rows = await prisma.article.findMany({ orderBy: { updatedAt: "desc" }, include: { revisions: { orderBy: { version: "desc" }, take: 1, select: { data: true, createdBy: true, createdAt: true } } } });
  const title = (r: (typeof rows)[number]) => {
    try {
      return (JSON.parse(r.revisions[0]?.data ?? "{}") as { title?: string }).title || r.slug;
    } catch {
      return r.slug;
    }
  };
  const waiting = rows.filter((r) => r.status === "IN_REVIEW");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">Guides</h1>
          <p className="text-sm text-muted">Editors write and send for approval. Compliance or the master admin approve and publish; nobody approves their own draft.</p>
        </div>
      </div>

      {can(user, "content.publish") && waiting.length > 0 && (
        <p className="rounded-xl bg-warn-soft text-warn px-4 py-3 text-sm font-semibold">{waiting.length} guide{waiting.length > 1 ? "s" : ""} waiting for your approval.</p>
      )}

      {can(user, "content.edit") && (
        <section className="card p-5">
          <h2 className="font-bold mb-3">New guide</h2>
          <ActionForm action={createGuide} buttons={[{ label: "Create draft" }]} className="grid gap-3 sm:grid-cols-[2fr_1.5fr_auto] items-end">
            <label><span className="field-label">Title</span><input name="title" className="field-input" required maxLength={120} /></label>
            <label><span className="field-label">Address: /guides/…</span><input name="slug" className="field-input font-mono" required maxLength={80} placeholder="documents-for-a-personal-loan" /></label>
          </ActionForm>
        </section>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="text-left text-muted text-xs uppercase tracking-wide">
            <tr className="border-b border-line">{["Guide", "Address", "Draft", "Public", "Last edit"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">No guides yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-canvas">
                <td className="px-4 py-3"><Link href={`/admin/content/${r.id}`} className="text-violet font-semibold underline">{title(r)}</Link></td>
                <td className="px-4 py-3 font-mono text-xs">/guides/{r.slug}</td>
                <td className="px-4 py-3"><span className={`chip ${r.status === "IN_REVIEW" ? "bg-warn-soft text-warn" : r.status === "PUBLISHED" ? "bg-mint-soft text-mint-ink" : "bg-canvas text-muted border border-line"}`}>{ARTICLE_STATUSES[r.status as keyof typeof ARTICLE_STATUSES] ?? r.status}</span></td>
                <td className="px-4 py-3">{r.liveRevisionId ? (r.publishAt && r.publishAt > new Date() ? `Scheduled ${r.publishAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}` : "Live") : <span className="text-muted">Not public</span>}</td>
                <td className="px-4 py-3 text-xs text-muted">{r.revisions[0] ? `${r.revisions[0].createdBy.replace("staff:", "")} · ${r.revisions[0].createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" })}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
