import Link from "next/link";
import { brand } from "@/config/brand";
import { Logo } from "./Logo";

export function SiteFooter({ columns, wordmark }: { columns: { title: string; links: { href: string; label: string }[] }[]; wordmark: [string, string] }) {
  return (
    <footer className="bg-violet-deep text-white/80 mt-20">
      <div style={{ "--cols": Math.max(1, columns.length) } as React.CSSProperties} className="mx-auto max-w-6xl px-4 py-12 grid gap-10 md:grid-cols-[1.4fr_repeat(var(--cols),minmax(0,1fr))]">
        <div className="space-y-3">
          <Logo inverted wordmark={wordmark} />
          <p className="text-sm max-w-sm">{brand.tagline} <span lang="hi">{brand.taglineHi}</span></p>
        </div>
        {columns.map((c, i) => <FooterCol key={`${i}-${c.title}`} title={c.title} links={c.links} />)}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed space-y-2 text-white/65">
          <p>
            <strong className="text-white/85">Important:</strong> {brand.name} is a loan sourcing service, not a lender. We don&apos;t charge you any fee.
            We act as a Direct Selling Agent (DSA) for partner banks and NBFCs. We do not lend money, approve loans or collect repayments. All loans are offered,
            approved, sanctioned and disbursed solely by the lending bank or NBFC, at its discretion and on its terms.
            Loan estimates on this website are indicative and are not an offer or approval.
          </p>
          {brand.partnersLive && brand.partners.length > 0 && (
            <p>Lending partners: {brand.partners.map((p) => `${p.name} (${p.type})`).join(", ")}.</p>
          )}
          <p>
            Grievance Officer: {brand.grievanceOfficer.name} · {brand.grievanceOfficer.email}
          </p>
          <p>© {new Date().getFullYear()} {brand.legalEntity}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="font-display text-white text-base mb-3">{title}</h3>
      <ul className="space-y-2 text-sm">
        {links.map((l, i) => (
          <li key={`${i}-${l.href}`}><Link href={l.href} className="hover:text-mint">{l.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}
