import { notFound } from "next/navigation";
import { prisma } from "@/shared/db/db";
import { can } from "@/features/staff/domain/rbac";
import { currentStaff } from "@/features/staff/server/staff.server";
import { ActionForm } from "@/features/case-management/components/ActionForm";
import { addRedirect, deleteRedirect } from "@/features/cms/actions/content.actions";

export const metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  const user = await currentStaff();
  if (!user || !can(user, "site.manage")) notFound();
  const rows = await prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold">Redirects</h1>
        <p className="text-sm text-muted">Send an old address to its replacement so links and search results keep working. Only addresses on this site; private areas can&apos;t be redirected; loops are refused. Renaming a published guide adds its redirect automatically.</p>
      </div>
      <section className="card p-5">
        <ActionForm action={addRedirect} buttons={[{ label: "Add redirect" }]} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] items-end">
          <label><span className="field-label">Old address</span><input name="from" className="field-input font-mono" placeholder="/old-page" required /></label>
          <label><span className="field-label">New address</span><input name="to" className="field-input font-mono" placeholder="/guides/new-page" required /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" name="temporary" /> Temporary (302) instead of permanent (308)</label>
        </ActionForm>
      </section>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-muted text-xs uppercase tracking-wide"><tr className="border-b border-line">{["From", "To", "Type", "Added", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">No redirects.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-mono">{r.fromPath}</td>
                <td className="px-4 py-3 font-mono">{r.toPath}</td>
                <td className="px-4 py-3">{r.permanent ? "Permanent" : "Temporary"}</td>
                <td className="px-4 py-3 text-xs text-muted">{r.createdBy.replace("staff:", "")} · {r.createdAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                <td className="px-4 py-3"><ActionForm action={deleteRedirect} hidden={{ id: r.id }} confirm={`Delete the redirect from ${r.fromPath}?`} buttons={[{ label: "Delete", tone: "ghost" }]} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
