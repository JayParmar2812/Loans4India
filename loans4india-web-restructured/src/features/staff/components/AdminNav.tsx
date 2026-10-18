"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section tabs under the staff header. Scrolls sideways on small screens instead of wrapping. */
export function AdminNav({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  const active = (href: string) => (href === "/admin" ? path === "/admin" || path.startsWith("/admin/applications") : path.startsWith(href));
  return (
    <nav aria-label="Back office" className="mx-auto max-w-[1400px] px-2 overflow-x-auto">
      <ul className="flex gap-1 text-sm whitespace-nowrap">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              aria-current={active(l.href) ? "page" : undefined}
              className={`inline-block px-3 py-2.5 border-b-2 font-semibold transition-colors ${active(l.href) ? "border-violet text-violet" : "border-transparent text-muted hover:text-ink"}`}
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
