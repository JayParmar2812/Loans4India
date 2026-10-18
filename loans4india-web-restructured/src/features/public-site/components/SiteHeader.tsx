"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/shared/ui/Logo";

/**
 * Public header. One primary action everywhere: "Start your application" (Platform Flow v4, section 2).
 * The strip above it carries the line v4 requires in the header or footer of every page.
 */
export function SiteHeader({ nav }: { nav: { href: string; label: string }[] }) {
  const path = usePathname();
  // The menu remembers the page it was opened on, so it is closed again after navigating.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (f: (o: boolean) => boolean) => setOpenOn(f(open) ? path : null);
  const current = (href: string) => (href !== "/" && path.startsWith(href.split("#")[0]) ? "page" : undefined);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
      <p className="bg-mint-soft text-mint-ink text-[0.78rem] sm:text-sm text-center px-4 py-1.5">
        <span className="font-semibold">Loan sourcing service, not a lender.</span> We don&apos;t charge you any fee.
      </p>
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4">
        <Logo className="h-8 sm:h-9 w-auto" priority />
        <nav aria-label="Main" className="hidden lg:flex items-center gap-1 text-[0.95rem]">
          {nav.map((n) => (
            <Link key={n.href + n.label} href={n.href} aria-current={current(n.href)} className="px-3 py-2 rounded-lg font-semibold text-muted hover:text-ink hover:bg-canvas aria-[current=page]:text-violet">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/my" className="hidden sm:inline-flex btn-quiet !min-h-0 !py-2 text-[0.95rem]">Sign in</Link>
          <Link href="/apply" className="btn-primary !py-2 !px-4 !min-h-[40px] !text-[0.95rem] whitespace-nowrap">
            <span className="sm:hidden">Apply</span>
            <span className="hidden sm:inline">Start your application</span>
          </Link>
          <button
            type="button"
            className="lg:hidden p-2 rounded-lg text-ink hover:bg-canvas"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">{open ? "Close menu" : "Menu"}</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="lg:hidden border-t border-line bg-white px-4 pb-4 pt-2 flex flex-col">
          {nav.map((n) => (
            <Link key={n.href + n.label} href={n.href} aria-current={current(n.href)} className="py-3 border-b border-line font-semibold text-ink aria-[current=page]:text-violet">
              {n.label}
            </Link>
          ))}
          <Link href="/my" className="py-3 font-semibold text-violet">Sign in to your application</Link>
        </nav>
      )}
    </header>
  );
}
