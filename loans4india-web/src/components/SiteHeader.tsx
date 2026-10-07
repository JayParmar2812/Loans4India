"use client";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "./Logo";

export function SiteHeader({ nav, wordmark }: { nav: { href: string; label: string }[]; wordmark: [string, string] }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-line">
      <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-4">
        <Logo wordmark={wordmark} />
        <nav aria-label="Main" className="hidden md:flex items-center gap-7 text-[0.95rem] text-muted">
          {nav.map((n) => (
            <Link key={n.href + n.label} href={n.href} className="hover:text-violet transition-colors">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/apply" className="btn-primary !py-2 !px-4 !text-[0.95rem] whitespace-nowrap">Start your application</Link>
          <button
            type="button"
            className="md:hidden p-2 rounded-lg text-ink"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            <span className="sr-only">Menu</span>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="md:hidden border-t border-line bg-white px-4 py-3 flex flex-col">
          {nav.map((n) => (
            <Link key={n.href + n.label} href={n.href} className="py-2.5 text-ink" onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
