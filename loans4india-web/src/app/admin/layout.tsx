import Link from "next/link";
import { currentStaff } from "@/lib/staff.server";
import { can, ROLES } from "@/lib/rbac";
export const dynamic = "force-dynamic";
export const metadata = { title: "Staff", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentStaff();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2">
          <Link href="/admin" className="font-display text-2xl font-extrabold text-violet-deep">Control tower</Link>
          {can(user, "staff.manage") && <Link href="/admin/staff" className="text-sm text-violet underline">Staff</Link>}
          {can(user, "site.manage") && <Link href="/admin/site" className="text-sm text-violet underline">Website</Link>}
          {can(user, "audit.view") && <Link href="/admin/activity" className="text-sm text-violet underline">Activity</Link>}
          {/* A file download, not a page: a plain link is right here. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          {can(user, "export.counts") && <a href="/admin/export" className="text-sm text-violet underline">Counts (CSV)</a>}
        </div>
        {user && <span className="text-xs rounded-full bg-violet-soft text-violet-deep px-3 py-1">{user.name} · {ROLES[user.role]}{user.banks.length ? ` · portal: ${user.banks.join(", ")}` : ""}</span>}
      </div>
      {children}
    </div>
  );
}
