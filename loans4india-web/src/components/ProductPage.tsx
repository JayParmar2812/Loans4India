import Link from "next/link";
import { QuickCheck } from "./QuickCheck";

import { Faq } from "./Faq";
import type { ProductSiteContent } from "@/config/siteContent";

export type ProductContent = ProductSiteContent & { product: "PERSONAL_LOAN" | "BUSINESS_LOAN" };

export function ProductPage({ c }: { c: ProductContent }) {
  return (
    <>
      <section className="bg-violet text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14 grid gap-10 lg:grid-cols-[1.25fr_1fr] items-center">
          <div>
            {c.eyebrow && <p className="text-mint font-display font-semibold">{c.eyebrow}</p>}
            <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold">{c.title}</h1>
            <p className="mt-4 text-lg text-white/85 max-w-xl">{c.intro}</p>
            {c.highlights.length > 0 && <dl className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {c.highlights.map((h, i) => (
                <div key={i} className="rounded-2xl bg-white/10 p-3">
                  <dt className="text-xs text-white/70">{h.k}</dt>
                  <dd className="font-display font-bold text-lg num">{h.v}</dd>
                </div>
              ))}
            </dl>}
            <p className="mt-3 text-xs text-white/60">Indicative ranges across lenders. Your offer depends on your profile and the lender&apos;s policy.</p>
          </div>
          <QuickCheck product={c.product} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 grid gap-6 md:grid-cols-2">
        {c.whoCanApply.length > 0 && <div className="rounded-3xl bg-surface border border-line p-6">
          <h2 className="text-2xl font-extrabold text-violet-deep">Who can apply</h2>
          <ul className="mt-4 space-y-2">{c.whoCanApply.map((w, i) => <li key={i} className="flex gap-2"><span className="text-success">✓</span>{w}</li>)}</ul>
          <p className="mt-4 text-xs text-muted">Typical criteria. Each lender sets its own rules.</p>
        </div>}
        {c.documents.length > 0 && <div className="rounded-3xl bg-surface border border-line p-6">
          <h2 className="text-2xl font-extrabold text-violet-deep">Documents to keep ready</h2>
          <ul className="mt-4 space-y-2">{c.documents.map((d, i) => <li key={i} className="flex gap-2"><span className="text-violet">▸</span>{d}</li>)}</ul>
          <p className="mt-4 text-xs text-muted">You&apos;ll upload these online right after the application form. The lender may ask for a few more.</p>
        </div>}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-6">
        {c.faq.length > 0 && (
          <>
            <h2 className="text-3xl font-extrabold text-violet-deep mb-6">Frequently asked</h2>
            <Faq items={c.faq} />
          </>
        )}
        <div className="mt-10 text-center">
          <Link href={c.product === "BUSINESS_LOAN" ? "/apply?product=BUSINESS_LOAN" : "/apply"} className="btn-primary">Start your application. It&apos;s free</Link>
        </div>
      </section>
    </>
  );
}
