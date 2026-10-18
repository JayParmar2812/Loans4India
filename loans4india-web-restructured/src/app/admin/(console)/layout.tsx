import Link from "next/link";
import { redirect } from "next/navigation";
import { can, ROLES, type Permission } from "@/features/staff/domain/rbac";
import { readStaffSession } from "@/features/staff/server/staffSession.server";
import { signOut } from "@/features/staff/actions/auth.actions";
import { Logo } from "@/shared/ui/Logo";
import { dataMode } from "@/shared/config/brand";
import { AdminNav } from "@/features/staff/components/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Staff", template: "%s · Staff" }, robots: { index: false, follow: false } };

const NAV: { href: string; label: string; perm?: Permission; anyOf?: Permission[] }[] = [
  { href: "/admin", label: "Control tower", anyOf: ["application.view_all", "application.view_own", "portal.submit", "bank_status.record"] },
  { href: "/admin/insights", label: "Insights", perm: "metrics.view" },
  { href: "/admin/support", label: "Support & data rights", perm: "support.view" },
  { href: "/admin/lenders", label: "Lenders", perm: "lender.view" },
  { href: "/admin/content", label: "Guides", anyOf: ["content.edit", "content.publish"] },
  { href: "/admin/site", label: "Website", perm: "site.manage" },
  { href: "/admin/redirects", label: "Redirects", perm: "site.manage" },
  { href: "/admin/compliance", label: "Retention & holds", perm: "compliance.manage" },
  { href: "/admin/staff", label: "Staff", perm: "staff.manage" },
  { href: "/admin/activity", label: "Activity", perm: "audit.view" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await readStaffSession();
  if (s.kind === "mfa") redirect("/admin/mfa");
  if (s.kind !== "ok") redirect("/admin/login");
  const user = s.user;
  const links = NAV.filter((n) => (n.perm ? can(user, n.perm) : n.anyOf ? n.anyOf.some((p) => can(user, p)) : true)).map(({ href, label }) => ({ href, label }));
  const synthetic = dataMode() === "synthetic";

  return (
    <div className="min-h-dvh bg-canvas">
      {synthetic && (
        <p className="bg-warn-soft text-warn text-xs sm:text-sm text-center px-4 py-1.5 font-semibold" role="status">
          Synthetic data mode: test applicants and test banks only. No real customer data until a bank agreement and counsel sign-off (Platform Flow v4 §52).
        </p>
      )}
      <header className="bg-white border-b border-line sticky top-0 z-30">
        <div className="mx-auto max-w-[1400px] px-4 h-14 flex items-center gap-4">
          <Logo href="/admin" className="h-7 w-auto" />
          <span className="hidden sm:inline text-xs font-semibold uppercase tracking-wider text-muted border-l border-line pl-4">Back office</span>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden md:inline text-xs rounded-full bg-violet-soft text-violet-deep px-3 py-1">
              {user.name} · {ROLES[user.role]}{user.banks.length ? ` · portal: ${user.banks.join(", ")}` : ""}
            </span>
            {/* A file download, not a page: a plain link is right here. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            {can(user, "export.counts") && <a href="/admin/export" className="hidden lg:inline text-sm text-violet underline underline-offset-4">Counts CSV</a>}
            <form action={signOut}>
              <button className="btn-quiet !min-h-0 !py-1.5 text-sm">Sign out</button>
            </form>
          </div>
        </div>
        <AdminNav links={links} />
      </header>
      <main id="main" className="mx-auto max-w-[1400px] px-4 py-6 sm:py-8">{children}</main>
      <footer className="mx-auto max-w-[1400px] px-4 pb-8 text-xs text-muted">
        Sessions end after 15 minutes without activity. Every view of personal data and every change is recorded. <Link href="/" className="underline">Public site</Link>
      </footer>
    </div>
  );
}
