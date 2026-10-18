import Link from "next/link";
import { brand } from "@/shared/config/brand";
import { Logo } from "@/shared/ui/Logo";

export function SiteFooter({ columns }: { columns: { title: string; links: { href: string; label: string }[] }[] }) {
  return (
    <footer className="mt-20 border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-4 py-12 grid gap-10 md:grid-cols-[1.3fr_2fr]">
        <div className="space-y-4">
          <Logo className="h-9 w-auto" />
          <p className="text-sm text-muted max-w-sm">
            {brand.tagline} <span lang="hi" className="block mt-1">{brand.taglineHi}</span>
          </p>
          <div className="text-sm space-y-1">
            <p><span className="text-muted">Support:</span> <a className="text-violet underline underline-offset-4" href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a></p>
            <p className="text-muted">{brand.supportHours}</p>
          </div>
        </div>
        <div className="grid gap-8 grid-cols-2 sm:grid-cols-3">
          {columns.map((c, i) => (
            <div key={`${i}-${c.title}`}>
              <h2 className="font-display text-sm font-bold text-ink mb-3">{c.title}</h2>
              <ul className="space-y-2 text-sm">
                {c.links.map((l, j) => (
                  <li key={`${j}-${l.href}`}><Link href={l.href} className="text-muted hover:text-violet">{l.label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed space-y-2 text-muted">
          <p>
            <strong className="text-ink">Important:</strong> {brand.name} is a loan sourcing service, not a lender. We don&apos;t charge you any fee.
            We act as a Direct Selling Agent (DSA) for partner banks and NBFCs. We do not lend money, approve loans or collect repayments. Every loan is
            assessed, approved, sanctioned and disbursed only by the lending bank or NBFC, at its discretion and on its terms.
            Estimates on this website are indicative and are not an offer or an approval. We never ask for money, an OTP or a PIN on a call.
          </p>
          {brand.partnersLive && brand.partners.length > 0 ? (
            <p>Lending partners: {brand.partners.map((p) => `${p.name} (${p.type})`).join(", ")}.</p>
          ) : (
            <p>Partner banks and NBFCs are named here and on the consent screen once our agreements with them are signed.</p>
          )}
          <p>
            Grievance Officer: {brand.grievanceOfficer.name} · <a className="underline" href={`mailto:${brand.grievanceOfficer.email}`}>{brand.grievanceOfficer.email}</a> ·{" "}
            <Link className="underline" href="/grievance">How complaints are handled</Link>
          </p>
          <p>© {new Date().getFullYear()} {brand.legalEntity}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
